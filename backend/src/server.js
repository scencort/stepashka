import crypto from "crypto"
import dotenv from "dotenv"
import express from "express"
import cors from "cors"
import helmet from "helmet"
import cookieParser from "cookie-parser"
import rateLimit from "express-rate-limit"
import morgan from "morgan"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import nodemailer from "nodemailer"
import { z } from "zod"
import { initDb, pool } from "./db.js"

dotenv.config()

const app = express()
const port = Number(process.env.PORT || 4000)
const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5173"
const jwtAccessSecret = process.env.JWT_ACCESS_SECRET || "dev_access_secret_change_me"
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || "dev_refresh_secret_change_me"
const accessTtl = process.env.JWT_ACCESS_TTL || "15m"
const refreshTtlDays = Number(process.env.JWT_REFRESH_DAYS || 7)
const resetTokenTtlMinutes = Number(process.env.RESET_TOKEN_TTL_MINUTES || 30)

const smtpHost = process.env.SMTP_HOST || ""
const smtpPort = Number(process.env.SMTP_PORT || 587)
const smtpSecure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true"
const smtpUser = process.env.SMTP_USER || ""
const smtpPass = process.env.SMTP_PASS || ""
const smtpFrom = process.env.SMTP_FROM || "Stepashka <no-reply@stepashka.dev>"
const showDevResetCode = String(process.env.SHOW_DEV_RESET_CODE || "true").toLowerCase() === "true"
const openAiApiKey = process.env.OPENAI_API_KEY || ""
const openAiBaseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "")
const openAiModel = process.env.OPENAI_MODEL || "gpt-4o-mini"

let dbReady = false

app.use(helmet())
app.use(cors({ origin: frontendOrigin, credentials: true }))
app.use(cookieParser())
app.use(express.json({ limit: "2mb" }))
app.use(morgan("combined"))

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: "Слишком много попыток. Повторите позже." },
  standardHeaders: true,
  legacyHeaders: false,
})

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: "Слишком много AI-запросов. Повторите позже." },
  standardHeaders: true,
  legacyHeaders: false,
})

app.use("/api", globalLimiter)

const registerSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email().max(180),
  password: z.string().min(8).max(120),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

const resetPasswordSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/),
  password: z.string().min(8).max(120),
})

const loginTwoFactorVerifySchema = z.object({
  challengeId: z.string().min(8).max(200),
  code: z.string().regex(/^\d{6}$/),
})

const courseSchema = z.object({
  title: z.string().min(3).max(180),
  slug: z.string().min(3).max(180).regex(/^[a-z0-9-]+$/),
  description: z.string().min(20).max(5000),
  level: z.enum(["Beginner", "Intermediate", "Advanced"]),
  category: z.string().min(2).max(80),
  priceCents: z.number().int().min(0).max(10_000_000),
})

const roleSchema = z.object({
  role: z.enum(["student", "teacher", "admin"]),
})

const assignmentSchema = z.object({
  lessonId: z.number().int().positive(),
  assignmentType: z.enum(["code", "essay", "quiz"]),
  title: z.string().min(3).max(180),
  description: z.string().min(10).max(5000),
  tests: z.array(z.any()).optional(),
  rubric: z.record(z.string(), z.number()).optional(),
  maxScore: z.number().int().min(1).max(1000).optional(),
})

const submitSchema = z.object({
  answerText: z.string().optional(),
  codeText: z.string().optional(),
})

const profilePatchSchema = z.object({
  fullName: z.string().min(2).max(120).optional(),
  email: z.string().email().max(180).optional(),
  phone: z.string().max(40).optional(),
  bio: z.string().max(280).optional(),
  timezone: z.string().max(80).optional(),
  language: z.enum(["ru", "en"]).optional(),
  emailNotifications: z.boolean().optional(),
  marketingNotifications: z.boolean().optional(),
  avatarUrl: z.string().max(1000).optional(),
})

const accountChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(120),
  confirmPassword: z.string().min(8).max(120),
})

const confirmEmailSchema = z.object({
  code: z.string().regex(/^\d{6}$/),
})

const twoFactorConfirmSchema = z.object({
  code: z.string().regex(/^\d{6}$/),
})

const twoFactorDisableSchema = z.object({
  password: z.string().min(1),
})

const aiChatSchema = z.object({
  message: z.string().min(1).max(4000),
  context: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string().min(1).max(4000),
      })
    )
    .max(12)
    .optional(),
})

const loginChallenges = new Map()

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex")
}

function createResetCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

async function createResetToken(userId) {
  const rawCode = createResetCode()
  const tokenHash = hashToken(rawCode)
  const expiresAt = new Date(Date.now() + resetTokenTtlMinutes * 60 * 1000)

  await pool.query(
    `UPDATE password_reset_tokens
     SET used_at = NOW()
     WHERE user_id = $1 AND used_at IS NULL`,
    [userId]
  )

  await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt.toISOString()]
  )

  return { rawCode, expiresAt }
}

function createMailer() {
  if (!smtpHost || !smtpUser || !smtpPass) {
    return null
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  })
}

async function sendResetEmail(email, fullName, code) {
  const transporter = createMailer()
  const subject = "Восстановление пароля Stepashka"
  const text = `Здравствуйте, ${fullName}.\n\nКод для сброса пароля: ${code}\n\nКод действителен ${resetTokenTtlMinutes} минут. Если вы не запрашивали сброс, просто проигнорируйте письмо.`

  if (!transporter) {
    console.log(`[PASSWORD_RESET_DEV] ${email}: code=${code}`)
    return { delivered: false, devCode: code }
  }

  await transporter.sendMail({
    from: smtpFrom,
    to: email,
    subject,
    text,
    html: `<p>Здравствуйте, ${fullName}.</p><p>Код для сброса пароля:</p><p style="font-size:20px;font-weight:700;letter-spacing:3px">${code}</p><p>Код действителен ${resetTokenTtlMinutes} минут.</p><p>Если вы не запрашивали сброс, просто проигнорируйте письмо.</p>`,
  })

  return { delivered: true }
}

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      role: user.role,
      email: user.email,
      fullName: user.full_name,
    },
    jwtAccessSecret,
    { expiresIn: accessTtl }
  )
}

function signRefreshToken(user) {
  return jwt.sign({ sub: String(user.id), type: "refresh" }, jwtRefreshSecret, { expiresIn: `${refreshTtlDays}d` })
}

function getRequestMeta(req) {
  const userAgent = String(req.headers["user-agent"] || "").slice(0, 512)
  const ipAddress = String(req.ip || req.socket?.remoteAddress || "").slice(0, 128)
  return { userAgent, ipAddress }
}

async function storeRefreshToken(userId, refreshToken, meta = { userAgent: "", ipAddress: "" }) {
  const tokenHash = hashToken(refreshToken)
  const expiresAt = new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000)
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, user_agent, ip_address, last_used_at, expires_at)
     VALUES ($1, $2, $3, $4, NOW(), $5)`,
    [userId, tokenHash, meta.userAgent, meta.ipAddress, expiresAt.toISOString()]
  )
}

async function revokeRefreshToken(refreshToken) {
  const tokenHash = hashToken(refreshToken)
  await pool.query(
    `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL`,
    [tokenHash]
  )
}

async function writeAudit(actorUserId, action, targetType, targetId, details = {}) {
  await pool.query(
    `INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, details)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [actorUserId || null, action, targetType, String(targetId), JSON.stringify(details)]
  )
}

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    status: user.status,
    avatarUrl: user.avatar_url || "",
  }
}

async function getOrCreateAccountProfile(userId) {
  const existing = await pool.query(`SELECT * FROM account_profiles WHERE user_id = $1 LIMIT 1`, [userId])
  if (existing.rows.length > 0) {
    return existing.rows[0]
  }

  const created = await pool.query(
    `INSERT INTO account_profiles (user_id)
     VALUES ($1)
     RETURNING *`,
    [userId]
  )

  return created.rows[0]
}

function authRequired(req, res, next) {
  const auth = req.headers.authorization || ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null

  if (!token) {
    return res.status(401).json({ error: "Требуется авторизация" })
  }

  try {
    const payload = jwt.verify(token, jwtAccessSecret)
    req.user = {
      id: Number(payload.sub),
      role: payload.role,
      email: payload.email,
      fullName: payload.fullName,
    }
    return next()
  } catch {
    return res.status(401).json({ error: "Сессия недействительна" })
  }
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Требуется авторизация" })
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Недостаточно прав" })
    }

    return next()
  }
}

function zParse(schema, payload, res) {
  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    res.status(400).json({ error: "Некорректные данные", details: parsed.error.flatten() })
    return null
  }
  return parsed.data
}

function estimateCodeQuality(codeText, testsWeight) {
  const code = (codeText || "").trim()
  const complexityPenalty = code.split("\n").length > 120 ? 15 : 0
  const keywordBoost = /class |function |async |await |try|catch/.test(code) ? 10 : 0

  const tests = Math.max(0, Math.min(100, testsWeight + (code.length > 80 ? 15 : 0)))
  const quality = Math.max(0, Math.min(100, 60 + keywordBoost - complexityPenalty))
  const style = Math.max(0, Math.min(100, 50 + (code.includes("\n") ? 20 : 0)))
  const efficiency = Math.max(0, Math.min(100, 55 + (code.includes("map(") || code.includes("reduce(") ? 15 : 0)))
  const plagiarismScore = Math.min(95, code.length > 0 ? 8 + Math.floor(Math.random() * 20) : 0)

  const score = Math.round(0.5 * tests + 0.2 * quality + 0.2 * style + 0.1 * efficiency)

  return {
    score,
    metrics: { tests, quality, style, efficiency, plagiarismScore },
    status: score >= 70 ? "passed" : "failed",
    feedback:
      score >= 70
        ? "Решение прошло проверку. Рекомендуем добавить больше граничных тестов."
        : "Решение требует доработки: улучшите покрытие тестами и читаемость кода.",
    hints: [
      "Проверьте обработку пустых входных данных.",
      "Добавьте отдельный тест на невалидный payload.",
      "Упростите ветвления в основном обработчике.",
    ],
  }
}

function estimateEssay(answerText, rubric = {}) {
  const text = (answerText || "").trim()
  const relevance = Math.min(30, text.length > 80 ? 24 : 12)
  const depth = Math.min(30, text.length > 200 ? 25 : 13)
  const clarity = Math.min(20, /\n/.test(text) ? 16 : 10)
  const practicality = Math.min(20, /пример|метрика|шаг|план/i.test(text) ? 16 : 9)
  const plagiarismScore = Math.min(95, text.length > 0 ? 6 + Math.floor(Math.random() * 18) : 0)
  const total = relevance + depth + clarity + practicality

  return {
    score: total,
    metrics: {
      relevance,
      depth,
      clarity,
      practicality,
      rubric,
      plagiarismScore,
    },
    status: total >= 70 ? "passed" : "manual_review",
    feedback:
      total >= 70
        ? "Ответ содержательный и хорошо структурирован."
        : "Ответ частично покрывает задачу. Добавьте практические аргументы и структуру.",
    hints: [
      "Сформулируйте тезис в первом абзаце.",
      "Добавьте минимум один измеримый критерий.",
      "Разделите выводы и рекомендации по пунктам.",
    ],
  }
}

app.get("/api/health", async (_req, res) => {
  if (!dbReady) {
    return res.status(503).json({ status: "degraded", dbReady: false })
  }

  const ping = await pool.query("SELECT NOW() AS now")
  return res.json({ status: "ok", dbReady: true, dbTime: ping.rows[0].now })
})

app.get("/api/catalog", async (_req, res) => {
  const rows = await pool.query(
    `SELECT c.id, c.title, c.slug, c.description, c.level, c.category, c.status, c.rating,
            c.students_count AS "studentsCount", c.duration_hours AS "durationHours", c.price_cents AS "priceCents",
            c.currency, u.full_name AS "teacherName"
     FROM courses c
     LEFT JOIN users u ON u.id = c.teacher_id
     WHERE c.status IN ('published', 'pending_review')
     ORDER BY c.created_at DESC`
  )
  return res.json(rows.rows)
})

app.use("/api/auth", authLimiter)

app.post("/api/auth/register", async (req, res) => {
  const parsed = zParse(registerSchema, req.body, res)
  if (!parsed) return

  const email = parsed.email.trim().toLowerCase()
  const exists = await pool.query("SELECT id FROM users WHERE email = $1 LIMIT 1", [email])
  if (exists.rows.length > 0) {
    return res.status(409).json({ error: "Пользователь с таким email уже существует" })
  }

  const passwordHash = await bcrypt.hash(parsed.password, 10)

  const created = await pool.query(
    `INSERT INTO users (email, password_hash, full_name, role)
     VALUES ($1, $2, $3, 'student')
     RETURNING id, email, full_name, role, status`,
    [email, passwordHash, parsed.fullName.trim()]
  )

  const user = created.rows[0]
  const accessToken = signAccessToken(user)
  const refreshToken = signRefreshToken(user)
  await storeRefreshToken(user.id, refreshToken, getRequestMeta(req))
  await writeAudit(user.id, "user.register", "user", user.id, { email: user.email })

  return res.status(201).json({
    user: sanitizeUser(user),
    accessToken,
    refreshToken,
  })
})

app.post("/api/auth/login", async (req, res) => {
  const parsed = zParse(loginSchema, req.body, res)
  if (!parsed) return

  const email = parsed.email.trim().toLowerCase()
  const row = await pool.query(
    `SELECT id, email, password_hash, full_name, role, status FROM users WHERE email = $1 LIMIT 1`,
    [email]
  )

  if (row.rows.length === 0) {
    return res.status(401).json({ error: "Неверный email или пароль" })
  }

  const user = row.rows[0]
  if (user.status === "banned") {
    return res.status(403).json({ error: "Аккаунт заблокирован" })
  }

  const ok = await bcrypt.compare(parsed.password, user.password_hash)
  if (!ok) {
    return res.status(401).json({ error: "Неверный email или пароль" })
  }

  const profileRow = await pool.query(
    `SELECT two_factor_enabled FROM account_profiles WHERE user_id = $1 LIMIT 1`,
    [user.id]
  )
  const twoFactorEnabled = Boolean(profileRow.rows[0]?.two_factor_enabled)

  if (twoFactorEnabled) {
    const code = createResetCode()
    const challengeId = crypto.randomUUID()
    loginChallenges.set(challengeId, {
      userId: user.id,
      codeHash: hashToken(code),
      expiresAt: Date.now() + 10 * 60 * 1000,
      createdAt: Date.now(),
    })

    const transporter = createMailer()
    const subject = "Код входа Stepashka (2FA)"
    const text = `Код подтверждения входа: ${code}. Срок действия 10 минут.`
    let devCode = null

    if (!transporter) {
      if (showDevResetCode) {
        devCode = code
      }
      console.log(`[AUTH_2FA_DEV] user=${user.id} challenge=${challengeId} code=${code}`)
    } else {
      await transporter.sendMail({ from: smtpFrom, to: user.email, subject, text })
    }

    return res.status(202).json({
      requiresTwoFactor: true,
      challengeId,
      message: "Требуется подтверждение 2FA",
      devCode,
    })
  }

  const accessToken = signAccessToken(user)
  const refreshToken = signRefreshToken(user)
  await storeRefreshToken(user.id, refreshToken, getRequestMeta(req))
  await writeAudit(user.id, "auth.login", "user", user.id)

  return res.json({ user: sanitizeUser(user), accessToken, refreshToken })
})

app.post("/api/auth/2fa/verify", async (req, res) => {
  const parsed = zParse(loginTwoFactorVerifySchema, req.body, res)
  if (!parsed) return

  const challenge = loginChallenges.get(parsed.challengeId)
  if (!challenge) {
    return res.status(400).json({ error: "Challenge не найден или истек" })
  }

  if (Date.now() > challenge.expiresAt) {
    loginChallenges.delete(parsed.challengeId)
    return res.status(400).json({ error: "Код 2FA истек" })
  }

  if (hashToken(parsed.code) !== challenge.codeHash) {
    return res.status(400).json({ error: "Неверный код 2FA" })
  }

  const userRow = await pool.query(
    `SELECT id, email, full_name, role, status, avatar_url FROM users WHERE id = $1 LIMIT 1`,
    [challenge.userId]
  )
  if (userRow.rows.length === 0 || userRow.rows[0].status !== "active") {
    loginChallenges.delete(parsed.challengeId)
    return res.status(401).json({ error: "Пользователь недоступен" })
  }

  const user = userRow.rows[0]
  const accessToken = signAccessToken(user)
  const refreshToken = signRefreshToken(user)
  await storeRefreshToken(user.id, refreshToken)
  await writeAudit(user.id, "auth.login.2fa", "user", user.id)
  loginChallenges.delete(parsed.challengeId)

  return res.json({ user: sanitizeUser(user), accessToken, refreshToken })
})

app.post("/api/auth/forgot-password", async (req, res) => {
  const parsed = zParse(forgotPasswordSchema, req.body, res)
  if (!parsed) return

  const email = parsed.email.trim().toLowerCase()

  const row = await pool.query(
    `SELECT id, email, full_name, status FROM users WHERE email = $1 LIMIT 1`,
    [email]
  )

  // Нейтральный ответ, чтобы нельзя было определить существование аккаунта.
  const neutralResponse = {
    success: true,
    message: "Если аккаунт с таким email существует, мы отправили ссылку для восстановления пароля.",
  }

  if (row.rows.length === 0 || row.rows[0].status !== "active") {
    return res.json(neutralResponse)
  }

  const user = row.rows[0]
  const { rawCode } = await createResetToken(user.id)

  const mailResult = await sendResetEmail(user.email, user.full_name, rawCode)
  await writeAudit(null, "auth.password_reset_requested", "user", user.id, { email: user.email })

  if (!mailResult.delivered && showDevResetCode) {
    return res.json({ ...neutralResponse, devCode: mailResult.devCode, devMode: true })
  }

  return res.json(neutralResponse)
})

app.post("/api/auth/reset-password", async (req, res) => {
  const parsed = zParse(resetPasswordSchema, req.body, res)
  if (!parsed) return

  const email = parsed.email.trim().toLowerCase()

  const userRow = await pool.query(
    `SELECT id, email, full_name, status FROM users WHERE email = $1 LIMIT 1`,
    [email]
  )

  if (userRow.rows.length === 0 || userRow.rows[0].status !== "active") {
    return res.status(400).json({ error: "Неверный код или email" })
  }

  const tokenHash = hashToken(parsed.code)

  const tokenRow = await pool.query(
    `SELECT id, user_id, expires_at, used_at, token_hash
     FROM password_reset_tokens
     WHERE user_id = $1
       AND used_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [userRow.rows[0].id]
  )

  if (tokenRow.rows.length === 0) {
    return res.status(400).json({ error: "Неверный код или email" })
  }

  const token = tokenRow.rows[0]

  if (token.token_hash !== tokenHash) {
    return res.status(400).json({ error: "Неверный код или email" })
  }

  if (new Date(token.expires_at).getTime() < Date.now()) {
    return res.status(400).json({ error: "Срок действия кода истёк" })
  }

  const passwordHash = await bcrypt.hash(parsed.password, 10)

  await pool.query(
    `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
    [passwordHash, token.user_id]
  )

  await pool.query(
    `UPDATE password_reset_tokens
     SET used_at = NOW()
     WHERE id = $1`,
    [token.id]
  )

  await pool.query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW()
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [token.user_id]
  )

  await writeAudit(token.user_id, "auth.password_reset_completed", "user", token.user_id)

  return res.json({ success: true, message: "Пароль успешно обновлён" })
})

app.post("/api/auth/refresh", async (req, res) => {
  const refreshToken = String(req.body?.refreshToken || "")
  if (!refreshToken) {
    return res.status(400).json({ error: "refreshToken обязателен" })
  }

  try {
    const payload = jwt.verify(refreshToken, jwtRefreshSecret)
    if (payload.type !== "refresh") {
      return res.status(401).json({ error: "Неверный тип токена" })
    }

    const tokenHash = hashToken(refreshToken)
    const tokenRow = await pool.query(
      `SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = $1 LIMIT 1`,
      [tokenHash]
    )

    if (tokenRow.rows.length === 0) {
      return res.status(401).json({ error: "Refresh токен не найден" })
    }

    const tokenDb = tokenRow.rows[0]
    if (tokenDb.revoked_at) {
      return res.status(401).json({ error: "Refresh токен отозван" })
    }

    if (new Date(tokenDb.expires_at).getTime() < Date.now()) {
      return res.status(401).json({ error: "Refresh токен истёк" })
    }

    const meta = getRequestMeta(req)
    await pool.query(
      `UPDATE refresh_tokens
       SET last_used_at = NOW(), user_agent = $1, ip_address = $2
       WHERE id = $3`,
      [meta.userAgent, meta.ipAddress, tokenDb.id]
    )

    const userRow = await pool.query(
      `SELECT id, email, full_name, role, status FROM users WHERE id = $1 LIMIT 1`,
      [tokenDb.user_id]
    )

    if (userRow.rows.length === 0 || userRow.rows[0].status !== "active") {
      return res.status(401).json({ error: "Пользователь недоступен" })
    }

    await revokeRefreshToken(refreshToken)
    const user = userRow.rows[0]
    const newAccessToken = signAccessToken(user)
    const newRefreshToken = signRefreshToken(user)
    await storeRefreshToken(user.id, newRefreshToken, meta)

    return res.json({ user: sanitizeUser(user), accessToken: newAccessToken, refreshToken: newRefreshToken })
  } catch {
    return res.status(401).json({ error: "Невалидный refresh токен" })
  }
})

app.post("/api/auth/logout", authRequired, async (req, res) => {
  const refreshToken = String(req.body?.refreshToken || "")
  if (refreshToken) {
    await revokeRefreshToken(refreshToken)
  }
  await writeAudit(req.user.id, "auth.logout", "user", req.user.id)
  return res.json({ success: true })
})

app.get("/api/auth/me", authRequired, async (req, res) => {
  const row = await pool.query(
    `SELECT id, email, full_name, role, status, avatar_url FROM users WHERE id = $1 LIMIT 1`,
    [req.user.id]
  )
  if (row.rows.length === 0) {
    return res.status(404).json({ error: "Пользователь не найден" })
  }
  return res.json(sanitizeUser(row.rows[0]))
})

app.get("/api/account/profile", authRequired, async (req, res) => {
  const userRow = await pool.query(
    `SELECT id, email, full_name AS "fullName", role, avatar_url AS "avatarUrl"
     FROM users WHERE id = $1 LIMIT 1`,
    [req.user.id]
  )

  if (userRow.rows.length === 0) {
    return res.status(404).json({ error: "Пользователь не найден" })
  }

  const profile = await getOrCreateAccountProfile(req.user.id)
  return res.json({
    id: userRow.rows[0].id,
    name: userRow.rows[0].fullName,
    email: userRow.rows[0].email,
    role: userRow.rows[0].role,
    avatarUrl: userRow.rows[0].avatarUrl || "",
    phone: profile.phone || "",
    bio: profile.bio || "",
    timezone: profile.timezone || "Europe/Moscow",
    language: profile.language || "ru",
    emailNotifications: Boolean(profile.email_notifications),
    marketingNotifications: Boolean(profile.marketing_notifications),
    twoFactorEnabled: Boolean(profile.two_factor_enabled),
    pendingEmail: profile.pending_email || null,
  })
})

app.patch("/api/account/profile", authRequired, async (req, res) => {
  const parsed = zParse(profilePatchSchema, req.body, res)
  if (!parsed) return

  const profile = await getOrCreateAccountProfile(req.user.id)
  const updates = []
  const values = []
  let idx = 1

  if (typeof parsed.fullName === "string") {
    updates.push(`full_name = $${idx++}`)
    values.push(parsed.fullName.trim())
  }

  if (typeof parsed.avatarUrl === "string") {
    updates.push(`avatar_url = $${idx++}`)
    values.push(parsed.avatarUrl.trim().slice(0, 1000))
  }

  if (updates.length > 0) {
    values.push(req.user.id)
    await pool.query(
      `UPDATE users SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $${idx}`,
      values
    )
  }

  const profileUpdates = []
  const profileValues = []
  let profileIdx = 1

  if (typeof parsed.phone === "string") {
    profileUpdates.push(`phone = $${profileIdx++}`)
    profileValues.push(parsed.phone.trim().slice(0, 40))
  }
  if (typeof parsed.bio === "string") {
    profileUpdates.push(`bio = $${profileIdx++}`)
    profileValues.push(parsed.bio.trim().slice(0, 280))
  }
  if (typeof parsed.timezone === "string") {
    profileUpdates.push(`timezone = $${profileIdx++}`)
    profileValues.push(parsed.timezone.trim() || "Europe/Moscow")
  }
  if (typeof parsed.language === "string") {
    profileUpdates.push(`language = $${profileIdx++}`)
    profileValues.push(parsed.language)
  }
  if (typeof parsed.emailNotifications === "boolean") {
    profileUpdates.push(`email_notifications = $${profileIdx++}`)
    profileValues.push(parsed.emailNotifications)
  }
  if (typeof parsed.marketingNotifications === "boolean") {
    profileUpdates.push(`marketing_notifications = $${profileIdx++}`)
    profileValues.push(parsed.marketingNotifications)
  }

  if (profileUpdates.length > 0) {
    profileValues.push(req.user.id)
    await pool.query(
      `UPDATE account_profiles SET ${profileUpdates.join(", ")}, updated_at = NOW() WHERE user_id = $${profileIdx}`,
      profileValues
    )
  }

  let emailChangeRequired = false
  let devEmailCode = null

  if (typeof parsed.email === "string") {
    const nextEmail = parsed.email.trim().toLowerCase()
    const userRow = await pool.query(`SELECT email FROM users WHERE id = $1 LIMIT 1`, [req.user.id])
    const currentEmail = userRow.rows[0]?.email || ""

    if (nextEmail !== currentEmail) {
      const exists = await pool.query(`SELECT id FROM users WHERE email = $1 AND id <> $2 LIMIT 1`, [nextEmail, req.user.id])
      if (exists.rows.length > 0) {
        return res.status(409).json({ error: "Пользователь с таким email уже существует" })
      }

      const code = createResetCode()
      const codeHash = hashToken(code)
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
      await pool.query(
        `UPDATE account_profiles
         SET pending_email = $1, pending_email_code_hash = $2, pending_email_expires_at = $3, updated_at = NOW()
         WHERE user_id = $4`,
        [nextEmail, codeHash, expiresAt.toISOString(), req.user.id]
      )

      const transporter = createMailer()
      const subject = "Подтверждение смены email Stepashka"
      const text = `Код подтверждения смены email: ${code}. Код действителен 10 минут.`

      if (!transporter) {
        if (showDevResetCode) {
          devEmailCode = code
        }
        console.log(`[EMAIL_CHANGE_DEV] user=${req.user.id} new_email=${nextEmail} code=${code}`)
      } else {
        await transporter.sendMail({ from: smtpFrom, to: nextEmail, subject, text })
      }

      emailChangeRequired = true
    }
  }

  await writeAudit(req.user.id, "account.profile.update", "user", req.user.id, {
    fields: Object.keys(parsed),
    emailChangeRequired,
  })

  const user = await pool.query(
    `SELECT id, email, full_name AS "fullName", role, avatar_url AS "avatarUrl" FROM users WHERE id = $1 LIMIT 1`,
    [req.user.id]
  )
  const freshProfile = await getOrCreateAccountProfile(req.user.id)

  return res.json({
    id: user.rows[0].id,
    name: user.rows[0].fullName,
    email: user.rows[0].email,
    role: user.rows[0].role,
    avatarUrl: user.rows[0].avatarUrl || "",
    phone: freshProfile.phone || "",
    bio: freshProfile.bio || "",
    timezone: freshProfile.timezone || "Europe/Moscow",
    language: freshProfile.language || "ru",
    emailNotifications: Boolean(freshProfile.email_notifications),
    marketingNotifications: Boolean(freshProfile.marketing_notifications),
    twoFactorEnabled: Boolean(freshProfile.two_factor_enabled),
    pendingEmail: freshProfile.pending_email || null,
    emailChangeRequired,
    devEmailCode,
  })
})

app.post("/api/account/confirm-email-change", authRequired, async (req, res) => {
  const parsed = zParse(confirmEmailSchema, req.body, res)
  if (!parsed) return

  const profile = await getOrCreateAccountProfile(req.user.id)
  if (!profile.pending_email || !profile.pending_email_code_hash || !profile.pending_email_expires_at) {
    return res.status(400).json({ error: "Нет ожидающей смены email" })
  }

  const isExpired = new Date(profile.pending_email_expires_at).getTime() < Date.now()
  if (isExpired) {
    return res.status(400).json({ error: "Код подтверждения истек" })
  }

  if (hashToken(parsed.code) !== profile.pending_email_code_hash) {
    return res.status(400).json({ error: "Неверный код подтверждения" })
  }

  const exists = await pool.query(`SELECT id FROM users WHERE email = $1 AND id <> $2 LIMIT 1`, [profile.pending_email, req.user.id])
  if (exists.rows.length > 0) {
    return res.status(409).json({ error: "Пользователь с таким email уже существует" })
  }

  await pool.query(
    `UPDATE users SET email = $1, updated_at = NOW() WHERE id = $2`,
    [profile.pending_email, req.user.id]
  )

  await pool.query(
    `UPDATE account_profiles
     SET pending_email = NULL, pending_email_code_hash = NULL, pending_email_expires_at = NULL, updated_at = NOW()
     WHERE user_id = $1`,
    [req.user.id]
  )

  await writeAudit(req.user.id, "account.email.confirmed", "user", req.user.id)
  return res.json({ success: true, message: "Email успешно обновлен" })
})

app.post("/api/account/change-password", authRequired, async (req, res) => {
  const parsed = zParse(accountChangePasswordSchema, req.body, res)
  if (!parsed) return

  if (parsed.newPassword !== parsed.confirmPassword) {
    return res.status(400).json({ error: "Подтверждение пароля не совпадает" })
  }

  const userRow = await pool.query(`SELECT id, password_hash FROM users WHERE id = $1 LIMIT 1`, [req.user.id])
  if (userRow.rows.length === 0) {
    return res.status(404).json({ error: "Пользователь не найден" })
  }

  const ok = await bcrypt.compare(parsed.currentPassword, userRow.rows[0].password_hash)
  if (!ok) {
    return res.status(400).json({ error: "Текущий пароль указан неверно" })
  }

  const nextHash = await bcrypt.hash(parsed.newPassword, 10)
  await pool.query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [nextHash, req.user.id])
  await pool.query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`, [req.user.id])
  await writeAudit(req.user.id, "account.password.changed", "user", req.user.id)

  return res.json({ success: true, message: "Пароль успешно изменен. Выполните вход заново на других устройствах." })
})

app.get("/api/account/sessions", authRequired, async (req, res) => {
  const rows = await pool.query(
    `SELECT id, user_agent AS "userAgent", ip_address AS "ipAddress", last_used_at AS "lastUsedAt",
            expires_at AS "expiresAt", created_at AS "createdAt"
     FROM refresh_tokens
     WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC`,
    [req.user.id]
  )

  return res.json(rows.rows)
})

app.delete("/api/account/sessions/:id", authRequired, async (req, res) => {
  const sessionId = Number(req.params.id)
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return res.status(400).json({ error: "Некорректная сессия" })
  }

  const revoked = await pool.query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW()
     WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
     RETURNING id`,
    [sessionId, req.user.id]
  )

  if (revoked.rows.length === 0) {
    return res.status(404).json({ error: "Сессия не найдена" })
  }

  await writeAudit(req.user.id, "account.session.revoked", "session", sessionId)
  return res.json({ success: true })
})

app.post("/api/account/logout-all", authRequired, async (req, res) => {
  const keepCurrentRefreshToken = String(req.body?.keepCurrentRefreshToken || "")
  let sql = `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`
  const params = [req.user.id]

  if (keepCurrentRefreshToken) {
    sql += ` AND token_hash <> $2`
    params.push(hashToken(keepCurrentRefreshToken))
  }

  await pool.query(sql, params)
  await writeAudit(req.user.id, "account.logout_all", "user", req.user.id)

  return res.json({ success: true })
})

app.post("/api/account/2fa/request-enable", authRequired, async (req, res) => {
  const user = await pool.query(`SELECT email, full_name FROM users WHERE id = $1 LIMIT 1`, [req.user.id])
  if (user.rows.length === 0) {
    return res.status(404).json({ error: "Пользователь не найден" })
  }

  const code = createResetCode()
  const codeHash = hashToken(code)
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
  await pool.query(
    `UPDATE account_profiles
     SET two_factor_temp_code_hash = $1, two_factor_temp_expires_at = $2, updated_at = NOW()
     WHERE user_id = $3`,
    [codeHash, expiresAt.toISOString(), req.user.id]
  )

  const transporter = createMailer()
  const subject = "Код включения 2FA Stepashka"
  const text = `Код для включения 2FA: ${code}. Срок действия 10 минут.`

  let devCode = null
  if (!transporter) {
    if (showDevResetCode) {
      devCode = code
    }
    console.log(`[2FA_ENABLE_DEV] user=${req.user.id} code=${code}`)
  } else {
    await transporter.sendMail({ from: smtpFrom, to: user.rows[0].email, subject, text })
  }

  return res.json({ success: true, message: "Код подтверждения отправлен", devCode })
})

app.post("/api/account/2fa/confirm-enable", authRequired, async (req, res) => {
  const parsed = zParse(twoFactorConfirmSchema, req.body, res)
  if (!parsed) return

  const profile = await getOrCreateAccountProfile(req.user.id)
  if (!profile.two_factor_temp_code_hash || !profile.two_factor_temp_expires_at) {
    return res.status(400).json({ error: "Нет активного запроса на включение 2FA" })
  }

  const isExpired = new Date(profile.two_factor_temp_expires_at).getTime() < Date.now()
  if (isExpired) {
    return res.status(400).json({ error: "Код истек" })
  }

  if (hashToken(parsed.code) !== profile.two_factor_temp_code_hash) {
    return res.status(400).json({ error: "Неверный код" })
  }

  await pool.query(
    `UPDATE account_profiles
     SET two_factor_enabled = TRUE, two_factor_temp_code_hash = NULL, two_factor_temp_expires_at = NULL, updated_at = NOW()
     WHERE user_id = $1`,
    [req.user.id]
  )

  await writeAudit(req.user.id, "account.2fa.enabled", "user", req.user.id)
  return res.json({ success: true, message: "2FA включена" })
})

app.post("/api/account/2fa/disable", authRequired, async (req, res) => {
  const parsed = zParse(twoFactorDisableSchema, req.body, res)
  if (!parsed) return

  const user = await pool.query(`SELECT password_hash FROM users WHERE id = $1 LIMIT 1`, [req.user.id])
  if (user.rows.length === 0) {
    return res.status(404).json({ error: "Пользователь не найден" })
  }

  const ok = await bcrypt.compare(parsed.password, user.rows[0].password_hash)
  if (!ok) {
    return res.status(400).json({ error: "Неверный пароль" })
  }

  await pool.query(
    `UPDATE account_profiles
     SET two_factor_enabled = FALSE, two_factor_temp_code_hash = NULL, two_factor_temp_expires_at = NULL, updated_at = NOW()
     WHERE user_id = $1`,
    [req.user.id]
  )
  await writeAudit(req.user.id, "account.2fa.disabled", "user", req.user.id)
  return res.json({ success: true, message: "2FA отключена" })
})

app.post("/api/ai/chat", aiLimiter, authRequired, requireRoles("student", "teacher", "admin"), async (req, res) => {
  const parsed = zParse(aiChatSchema, req.body, res)
  if (!parsed) return

  if (!openAiApiKey) {
    return res.status(503).json({
      error: "AI-сервис не настроен. Укажите OPENAI_API_KEY в backend/.env",
    })
  }

  const messages = [
    {
      role: "system",
      content: "Ты учебный AI-ассистент платформы Stepashka. Отвечай на русском, структурно и практично.",
    },
    ...(parsed.context || []).slice(-10),
    { role: "user", content: parsed.message },
  ]

  try {
    const response = await fetch(`${openAiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiApiKey}`,
      },
      body: JSON.stringify({
        model: openAiModel,
        messages,
        temperature: 0.3,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      return res.status(502).json({ error: `AI provider error: ${text.slice(0, 400)}` })
    }

    const data = await response.json()
    const answer = String(data?.choices?.[0]?.message?.content || "").trim()
    if (!answer) {
      return res.status(502).json({ error: "AI не вернул ответ" })
    }

    await writeAudit(req.user.id, "ai.chat.request", "user", req.user.id, {
      promptSize: parsed.message.length,
      model: openAiModel,
    })

    return res.json({
      reply: answer,
      model: openAiModel,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неизвестная ошибка AI"
    return res.status(500).json({ error: `Не удалось выполнить AI-запрос: ${message}` })
  }
})

app.post("/api/ai/chat/stream", aiLimiter, authRequired, requireRoles("student", "teacher", "admin"), async (req, res) => {
  const parsed = zParse(aiChatSchema, req.body, res)
  if (!parsed) return

  if (!openAiApiKey) {
    return res.status(503).json({
      error: "AI-сервис не настроен. Укажите OPENAI_API_KEY в backend/.env",
    })
  }

  const messages = [
    {
      role: "system",
      content: "Ты учебный AI-ассистент платформы Stepashka. Отвечай на русском, структурно и практично.",
    },
    ...(parsed.context || []).slice(-10),
    { role: "user", content: parsed.message },
  ]

  try {
    const response = await fetch(`${openAiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiApiKey}`,
      },
      body: JSON.stringify({
        model: openAiModel,
        messages,
        temperature: 0.3,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      return res.status(502).json({ error: `AI provider error: ${text.slice(0, 400)}` })
    }

    const data = await response.json()
    const answer = String(data?.choices?.[0]?.message?.content || "").trim()
    if (!answer) {
      return res.status(502).json({ error: "AI не вернул ответ" })
    }

    await writeAudit(req.user.id, "ai.chat.stream.request", "user", req.user.id, {
      promptSize: parsed.message.length,
      model: openAiModel,
    })

    res.setHeader("Content-Type", "text/plain; charset=utf-8")
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("Transfer-Encoding", "chunked")

    const chunkSize = 28
    for (let i = 0; i < answer.length; i += chunkSize) {
      const chunk = answer.slice(i, i + chunkSize)
      res.write(chunk)
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 18))
    }

    res.end()
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неизвестная ошибка AI"
    return res.status(500).json({ error: `Не удалось выполнить AI-запрос: ${message}` })
  }
})

app.get("/api/student/dashboard", authRequired, requireRoles("student", "teacher", "admin"), async (req, res) => {
  const enrollments = await pool.query(
    `SELECT e.course_id AS "courseId", c.title, e.progress_percent AS "progressPercent", e.status
     FROM enrollments e
     INNER JOIN courses c ON c.id = e.course_id
     WHERE e.user_id = $1
     ORDER BY e.created_at DESC`,
    [req.user.id]
  )

  const certs = await pool.query(
    `SELECT cert_code AS "certCode", course_id AS "courseId", issued_at AS "issuedAt"
     FROM certificates WHERE user_id = $1 ORDER BY issued_at DESC`,
    [req.user.id]
  )

  const submissionsWeek = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM submissions
     WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '7 days'`,
    [req.user.id]
  )

  const dailyActivity = await pool.query(
    `SELECT DISTINCT DATE(created_at) AS day
     FROM submissions
     WHERE user_id = $1
     ORDER BY day DESC
     LIMIT 60`,
    [req.user.id]
  )

  const daysSet = new Set(dailyActivity.rows.map((item) => String(item.day).slice(0, 10)))
  let streakDays = 0
  for (let i = 0; i < 365; i += 1) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const key = date.toISOString().slice(0, 10)
    if (daysSet.has(key)) {
      streakDays += 1
    } else {
      break
    }
  }

  const activeEnrollments = enrollments.rows.filter((item) => item.status === "active")
  const averageProgress = activeEnrollments.length
    ? Math.round(activeEnrollments.reduce((sum, item) => sum + Number(item.progressPercent || 0), 0) / activeEnrollments.length)
    : 0

  const recentAudits = await pool.query(
    `SELECT id, action, target_type AS "targetType", target_id AS "targetId", created_at AS "createdAt"
     FROM audit_logs
     WHERE actor_user_id = $1
     ORDER BY created_at DESC
     LIMIT 5`,
    [req.user.id]
  )

  const activities = recentAudits.rows.map((item) => ({
    id: item.id,
    text: `${item.action} (${item.targetType}:${item.targetId})`,
  }))

  const nextDeadline = await pool.query(
    `SELECT a.id, a.title, l.title AS "lessonTitle"
     FROM enrollments e
     INNER JOIN courses c ON c.id = e.course_id
     INNER JOIN course_modules cm ON cm.course_id = c.id
     INNER JOIN lessons l ON l.module_id = cm.id
     INNER JOIN assignments a ON a.lesson_id = l.id
     LEFT JOIN submissions s ON s.assignment_id = a.id AND s.user_id = e.user_id
     WHERE e.user_id = $1 AND e.status = 'active' AND s.id IS NULL
     ORDER BY a.created_at ASC
     LIMIT 1`,
    [req.user.id]
  )

  const deadline = nextDeadline.rows[0]
    ? {
      title: `Следующий дедлайн: ${nextDeadline.rows[0].title}`,
      text: `Урок: ${nextDeadline.rows[0].lessonTitle}`,
    }
    : {
      title: "Дедлайнов пока нет",
      text: "Вы завершили все назначенные задания в активных курсах.",
    }

  return res.json({
    user: req.user,
    enrollments: enrollments.rows,
    certificates: certs.rows,
    stats: {
      activeCourses: activeEnrollments.length,
      streakDays,
      averageScore: `${averageProgress}%`,
      tasksWeek: Number(submissionsWeek.rows[0]?.count || 0),
    },
    courses: activeEnrollments.slice(0, 6).map((item) => ({
      id: item.courseId,
      title: item.title,
      progress: Number(item.progressPercent || 0),
    })),
    activities,
    deadline,
  })
})

app.post("/api/student/enroll/:courseId", authRequired, requireRoles("student", "teacher", "admin"), async (req, res) => {
  const courseId = Number(req.params.courseId)
  if (!Number.isInteger(courseId) || courseId <= 0) {
    return res.status(400).json({ error: "Некорректный курс" })
  }

  const course = await pool.query(`SELECT id, title, status FROM courses WHERE id = $1 LIMIT 1`, [courseId])
  if (course.rows.length === 0 || course.rows[0].status !== "published") {
    return res.status(404).json({ error: "Курс недоступен для записи" })
  }

  await pool.query(
    `INSERT INTO enrollments (user_id, course_id, status, progress_percent)
     VALUES ($1, $2, 'active', 0)
     ON CONFLICT (user_id, course_id) DO NOTHING`,
    [req.user.id, courseId]
  )

  await pool.query(
    `INSERT INTO notifications (user_id, title, body) VALUES ($1, $2, $3)`,
    [req.user.id, "Вы успешно записаны на курс", course.rows[0].title]
  )

  await writeAudit(req.user.id, "enrollment.create", "course", courseId, { courseTitle: course.rows[0].title })

  return res.json({ success: true })
})

app.get("/api/student/courses/:courseId/steps", authRequired, requireRoles("student", "teacher", "admin"), async (req, res) => {
  const courseId = Number(req.params.courseId)
  if (!Number.isInteger(courseId) || courseId <= 0) {
    return res.status(400).json({ error: "Некорректный курс" })
  }

  const courseRow = await pool.query(
    `SELECT c.id, c.title, c.level, c.category, c.students_count AS "studentsCount", u.full_name AS "author"
     FROM courses c
     LEFT JOIN users u ON u.id = c.teacher_id
     WHERE c.id = $1 LIMIT 1`,
    [courseId]
  )
  if (courseRow.rows.length === 0) {
    return res.status(404).json({ error: "Курс не найден" })
  }

  const lessons = await pool.query(
    `SELECT l.id, l.title, l.content_text AS "contentText", l.lesson_order AS "lessonOrder", cm.module_order AS "moduleOrder"
     FROM lessons l
     INNER JOIN course_modules cm ON cm.id = l.module_id
     WHERE cm.course_id = $1
     ORDER BY cm.module_order ASC, l.lesson_order ASC`,
    [courseId]
  )

  const lessonIds = lessons.rows.map((item) => item.id)
  const assignments = lessonIds.length
    ? await pool.query(
      `SELECT id, lesson_id AS "lessonId", title
       FROM assignments
       WHERE lesson_id = ANY($1::int[])
       ORDER BY id ASC`,
      [lessonIds]
    )
    : { rows: [] }

  let order = 1
  const steps = []
  for (const lesson of lessons.rows) {
    steps.push({
      id: lesson.id * 10 + 1,
      title: `${lesson.title}: теория`,
      kind: "theory",
      theoryText: lesson.contentText || "Изучите материал урока и зафиксируйте ключевые идеи.",
      options: [],
      stepOrder: order++,
      xp: 10,
    })

    steps.push({
      id: lesson.id * 10 + 2,
      title: `${lesson.title}: мини-тест`,
      kind: "quiz",
      theoryText: "",
      options: ["Понял материал", "Нужно повторить", "Нужны примеры"],
      stepOrder: order++,
      xp: 12,
    })

    const assignment = assignments.rows.find((item) => item.lessonId === lesson.id)
    if (assignment) {
      steps.push({
        id: lesson.id * 10 + 3,
        title: `${assignment.title}: практика`,
        kind: "code",
        theoryText: "",
        options: [],
        stepOrder: order++,
        xp: 20,
      })
    }
  }

  const progressRows = await pool.query(
    `SELECT step_id AS "stepId", status, score, attempts, answer_text AS "answerText", completed_at AS "completedAt"
     FROM step_progress
     WHERE user_id = $1 AND course_id = $2`,
    [req.user.id, courseId]
  )

  const completed = progressRows.rows.filter((item) => item.status === "completed").length
  const total = steps.length
  const xp = progressRows.rows.reduce((sum, item) => sum + Number(item.score || 0), 0)
  const percent = total ? Math.round((completed / total) * 100) : 0

  return res.json({
    course: {
      id: courseRow.rows[0].id,
      title: courseRow.rows[0].title,
      lessons: total,
      progress: percent,
      type: String(courseRow.rows[0].category || "General"),
      level: String(courseRow.rows[0].level || "Beginner"),
      author: courseRow.rows[0].author || "Stepashka Team",
    },
    steps,
    progress: progressRows.rows,
    summary: {
      total,
      completed,
      xp,
      percent,
    },
  })
})

app.post("/api/student/steps/:stepId/check", authRequired, requireRoles("student", "teacher", "admin"), async (req, res) => {
  const stepId = Number(req.params.stepId)
  if (!Number.isInteger(stepId) || stepId <= 0) {
    return res.status(400).json({ error: "Некорректный шаг" })
  }

  const answer = String(req.body?.answer || "").trim()
  const lessonId = Math.floor(stepId / 10)
  const slot = stepId % 10

  const lessonRow = await pool.query(
    `SELECT l.id, l.title, cm.course_id AS "courseId"
     FROM lessons l
     INNER JOIN course_modules cm ON cm.id = l.module_id
     WHERE l.id = $1
     LIMIT 1`,
    [lessonId]
  )

  if (lessonRow.rows.length === 0) {
    return res.status(404).json({ error: "Шаг не найден" })
  }

  const courseId = lessonRow.rows[0].courseId
  let kind = "theory"
  let passed = false
  let feedback = ""
  let score = 0
  let assignmentId = null

  if (slot === 1) {
    kind = "theory"
    passed = true
    score = 10
    feedback = "Теоретический шаг отмечен как пройденный"
  } else if (slot === 2) {
    kind = "quiz"
    passed = answer.length > 0
    score = passed ? 12 : 0
    feedback = passed ? "Ответ принят" : "Выберите вариант ответа"
  } else if (slot === 3) {
    kind = "code"
    const assignment = await pool.query(
      `SELECT id FROM assignments WHERE lesson_id = $1 ORDER BY id ASC LIMIT 1`,
      [lessonId]
    )
    assignmentId = assignment.rows[0]?.id || null
    passed = answer.length >= 20
    score = passed ? 20 : 0
    feedback = passed ? "Кодовое решение принято" : "Добавьте более полное решение (минимум 20 символов)"
  } else {
    return res.status(400).json({ error: "Некорректный тип шага" })
  }

  const existing = await pool.query(
    `SELECT id, attempts FROM step_progress WHERE user_id = $1 AND step_id = $2 LIMIT 1`,
    [req.user.id, stepId]
  )

  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE step_progress
       SET status = $1, score = $2, answer_text = $3, attempts = $4, completed_at = $5, updated_at = NOW(),
           course_id = $6, step_kind = $7, lesson_id = $8, assignment_id = $9
       WHERE id = $10`,
      [
        passed ? "completed" : "started",
        score,
        answer,
        Number(existing.rows[0].attempts || 0) + 1,
        passed ? new Date().toISOString() : null,
        courseId,
        kind,
        lessonId,
        assignmentId,
        existing.rows[0].id,
      ]
    )
  } else {
    await pool.query(
      `INSERT INTO step_progress (user_id, course_id, step_id, step_kind, lesson_id, assignment_id, status, score, answer_text, attempts, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, $10)`,
      [
        req.user.id,
        courseId,
        stepId,
        kind,
        lessonId,
        assignmentId,
        passed ? "completed" : "started",
        score,
        answer,
        passed ? new Date().toISOString() : null,
      ]
    )
  }

  const totals = await pool.query(
    `SELECT
      COUNT(l.id)::int * 2 + COUNT(a.id)::int AS total
     FROM course_modules cm
     LEFT JOIN lessons l ON l.module_id = cm.id
     LEFT JOIN assignments a ON a.lesson_id = l.id
     WHERE cm.course_id = $1`,
    [courseId]
  )

  const completedRows = await pool.query(
    `SELECT COUNT(*)::int AS completed
     FROM step_progress
     WHERE user_id = $1 AND course_id = $2 AND status = 'completed'`,
    [req.user.id, courseId]
  )

  const total = Number(totals.rows[0]?.total || 0)
  const completed = Number(completedRows.rows[0]?.completed || 0)
  const percent = total ? Math.round((completed / total) * 100) : 0

  await pool.query(
    `UPDATE enrollments
     SET progress_percent = $1
     WHERE user_id = $2 AND course_id = $3`,
    [percent, req.user.id, courseId]
  )

  const currentProgress = await pool.query(
    `SELECT step_id AS "stepId", status, score, attempts, answer_text AS "answerText", completed_at AS "completedAt"
     FROM step_progress
     WHERE user_id = $1 AND step_id = $2 LIMIT 1`,
    [req.user.id, stepId]
  )

  return res.json({
    passed,
    feedback,
    progress: currentProgress.rows[0] || null,
    courseSummary: { total, completed, percent },
  })
})

app.get("/api/teacher/courses", authRequired, requireRoles("teacher", "admin"), async (req, res) => {
  const rows = await pool.query(
    `SELECT id, title, slug, description, level, category, price_cents AS "priceCents", status,
            students_count AS "studentsCount", rating
     FROM courses
     WHERE teacher_id = $1 OR $2 = 'admin'
     ORDER BY created_at DESC`,
    [req.user.id, req.user.role]
  )
  return res.json(rows.rows)
})

app.post("/api/teacher/courses", authRequired, requireRoles("teacher", "admin"), async (req, res) => {
  const parsed = zParse(courseSchema, req.body, res)
  if (!parsed) return

  const created = await pool.query(
    `INSERT INTO courses (title, slug, description, level, category, price_cents, teacher_id, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending_review')
     RETURNING id, title, slug, description, level, category, price_cents AS "priceCents", status`,
    [parsed.title, parsed.slug, parsed.description, parsed.level, parsed.category, parsed.priceCents, req.user.id]
  )

  await writeAudit(req.user.id, "course.create", "course", created.rows[0].id, { slug: parsed.slug })

  return res.status(201).json(created.rows[0])
})

app.post("/api/teacher/assignments", authRequired, requireRoles("teacher", "admin"), async (req, res) => {
  const parsed = zParse(assignmentSchema, req.body, res)
  if (!parsed) return

  const created = await pool.query(
    `INSERT INTO assignments (lesson_id, assignment_type, title, description, tests, rubric, max_score)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)
     RETURNING id, lesson_id AS "lessonId", assignment_type AS "assignmentType", title, description, tests, rubric, max_score AS "maxScore"`,
    [
      parsed.lessonId,
      parsed.assignmentType,
      parsed.title,
      parsed.description,
      JSON.stringify(parsed.tests || []),
      JSON.stringify(parsed.rubric || {}),
      parsed.maxScore || 100,
    ]
  )

  await writeAudit(req.user.id, "assignment.create", "assignment", created.rows[0].id, {
    lessonId: parsed.lessonId,
    assignmentType: parsed.assignmentType,
  })

  return res.status(201).json(created.rows[0])
})

app.get("/api/teacher/analytics", authRequired, requireRoles("teacher", "admin"), async (req, res) => {
  const row = await pool.query(
    `SELECT
      COUNT(DISTINCT c.id)::int AS "coursesTotal",
      COUNT(DISTINCT e.user_id)::int AS "studentsTotal",
      COALESCE(AVG(e.progress_percent), 0)::numeric(5,2) AS "avgProgress"
     FROM courses c
     LEFT JOIN enrollments e ON e.course_id = c.id
     WHERE c.teacher_id = $1 OR $2 = 'admin'`,
    [req.user.id, req.user.role]
  )

  const weakLessons = await pool.query(
    `SELECT l.id, l.title,
      COUNT(s.id) FILTER (WHERE s.status IN ('failed', 'manual_review'))::int AS "problemSubmissions"
     FROM lessons l
     LEFT JOIN assignments a ON a.lesson_id = l.id
     LEFT JOIN submissions s ON s.assignment_id = a.id
     GROUP BY l.id, l.title
     ORDER BY "problemSubmissions" DESC
     LIMIT 5`
  )

  return res.json({ summary: row.rows[0], weakLessons: weakLessons.rows })
})

app.post("/api/submissions/:assignmentId", authRequired, requireRoles("student", "teacher", "admin"), async (req, res) => {
  const assignmentId = Number(req.params.assignmentId)
  if (!Number.isInteger(assignmentId) || assignmentId <= 0) {
    return res.status(400).json({ error: "Некорректное задание" })
  }

  const parsed = zParse(submitSchema, req.body, res)
  if (!parsed) return

  const assignment = await pool.query(
    `SELECT id, assignment_type AS "assignmentType", title, rubric, tests, max_score AS "maxScore"
     FROM assignments WHERE id = $1 LIMIT 1`,
    [assignmentId]
  )

  if (assignment.rows.length === 0) {
    return res.status(404).json({ error: "Задание не найдено" })
  }

  const found = assignment.rows[0]
  let result

  if (found.assignmentType === "code") {
    const baseTests = Array.isArray(found.tests) ? Math.min(65, found.tests.length * 15) : 40
    result = estimateCodeQuality(parsed.codeText || "", baseTests)
  } else if (found.assignmentType === "essay") {
    result = estimateEssay(parsed.answerText || "", found.rubric)
  } else {
    const score = Math.min(100, (parsed.answerText || "").length > 0 ? 80 : 40)
    result = {
      score,
      metrics: { quiz: score, plagiarismScore: 0 },
      status: score >= 70 ? "passed" : "failed",
      feedback: score >= 70 ? "Ответ принят" : "Ответ неполный",
      hints: ["Проверьте формулировку ответа"],
    }
  }

  const saved = await pool.query(
    `INSERT INTO submissions (user_id, assignment_id, answer_text, code_text, score, status, ai_feedback, plagiarism_score, hints)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
     RETURNING id, user_id AS "userId", assignment_id AS "assignmentId", score, status,
               ai_feedback AS "aiFeedback", plagiarism_score AS "plagiarismScore", hints, created_at AS "createdAt"`,
    [
      req.user.id,
      assignmentId,
      parsed.answerText || "",
      parsed.codeText || "",
      result.score,
      result.status,
      result.feedback,
      result.metrics.plagiarismScore || 0,
      JSON.stringify(result.hints || []),
    ]
  )

  await writeAudit(req.user.id, "submission.create", "submission", saved.rows[0].id, {
    assignmentId,
    score: result.score,
    status: result.status,
  })

  return res.status(201).json({
    submission: saved.rows[0],
    evaluation: result,
  })
})

app.get("/api/submissions/history", authRequired, requireRoles("student", "teacher", "admin"), async (req, res) => {
  const rows = await pool.query(
    `SELECT s.id, s.assignment_id AS "assignmentId", a.title AS "assignmentTitle", s.score, s.status,
            s.ai_feedback AS "aiFeedback", s.plagiarism_score AS "plagiarismScore", s.created_at AS "createdAt"
     FROM submissions s
     INNER JOIN assignments a ON a.id = s.assignment_id
     WHERE s.user_id = $1 OR $2 = 'admin'
     ORDER BY s.created_at DESC
     LIMIT 100`,
    [req.user.id, req.user.role]
  )

  return res.json(rows.rows)
})

app.get("/api/admin/users", authRequired, requireRoles("admin"), async (_req, res) => {
  const rows = await pool.query(
    `SELECT id, email, full_name AS "fullName", role, status, created_at AS "createdAt"
     FROM users ORDER BY id ASC`
  )
  return res.json(rows.rows)
})

app.patch("/api/admin/users/:id/role", authRequired, requireRoles("admin"), async (req, res) => {
  const userId = Number(req.params.id)
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: "Некорректный пользователь" })
  }

  const parsed = zParse(roleSchema, req.body, res)
  if (!parsed) return

  const updated = await pool.query(
    `UPDATE users SET role = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id, email, full_name AS "fullName", role, status`,
    [parsed.role, userId]
  )

  if (updated.rows.length === 0) {
    return res.status(404).json({ error: "Пользователь не найден" })
  }

  await writeAudit(req.user.id, "admin.user.set_role", "user", userId, { newRole: parsed.role })

  return res.json(updated.rows[0])
})

app.patch("/api/admin/users/:id/ban", authRequired, requireRoles("admin"), async (req, res) => {
  const userId = Number(req.params.id)
  const banned = Boolean(req.body?.banned)

  const updated = await pool.query(
    `UPDATE users SET status = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id, email, full_name AS "fullName", role, status`,
    [banned ? "banned" : "active", userId]
  )

  if (updated.rows.length === 0) {
    return res.status(404).json({ error: "Пользователь не найден" })
  }

  await writeAudit(req.user.id, "admin.user.set_status", "user", userId, { banned })

  return res.json(updated.rows[0])
})

app.get("/api/admin/finance", authRequired, requireRoles("admin"), async (_req, res) => {
  const finance = await pool.query(
    `SELECT
      COALESCE(SUM(amount_cents) FILTER (WHERE status = 'paid'), 0)::int AS "revenuePaid",
      COALESCE(SUM(amount_cents) FILTER (WHERE status = 'refunded'), 0)::int AS "refunds",
      COUNT(*) FILTER (WHERE status = 'paid')::int AS "paidTransactions",
      COUNT(*) FILTER (WHERE status = 'failed')::int AS "failedTransactions"
     FROM payments`
  )

  const topCourses = await pool.query(
    `SELECT c.id, c.title,
      COALESCE(SUM(p.amount_cents) FILTER (WHERE p.status = 'paid'), 0)::int AS "revenue"
     FROM courses c
     LEFT JOIN payments p ON p.course_id = c.id
     GROUP BY c.id, c.title
     ORDER BY "revenue" DESC
     LIMIT 5`
  )

  return res.json({ summary: finance.rows[0], topCourses: topCourses.rows })
})

app.get("/api/admin/platform", authRequired, requireRoles("admin"), async (_req, res) => {
  const flags = await pool.query(`SELECT id, name, enabled, description FROM feature_flags ORDER BY id ASC`)
  const audits = await pool.query(
    `SELECT id, actor_user_id AS "actorUserId", action, target_type AS "targetType", target_id AS "targetId", details, created_at AS "createdAt"
     FROM audit_logs
     ORDER BY created_at DESC
     LIMIT 100`
  )

  return res.json({ flags: flags.rows, recentAudits: audits.rows })
})

app.patch("/api/admin/feature-flags/:name", authRequired, requireRoles("admin"), async (req, res) => {
  const name = String(req.params.name || "").trim()
  const enabled = Boolean(req.body?.enabled)

  const updated = await pool.query(
    `UPDATE feature_flags SET enabled = $1 WHERE name = $2 RETURNING id, name, enabled, description`,
    [enabled, name]
  )

  if (updated.rows.length === 0) {
    return res.status(404).json({ error: "Фича не найдена" })
  }

  await writeAudit(req.user.id, "admin.feature_flag.toggle", "feature_flag", name, { enabled })
  return res.json(updated.rows[0])
})

app.use((error, _req, res, _next) => {
  console.error("Unhandled API error", error)
  return res.status(500).json({ error: "Внутренняя ошибка сервера" })
})

async function warmupDb() {
  try {
    await initDb()
    dbReady = true
    console.log("PostgreSQL connected and initialized")
  } catch (error) {
    dbReady = false
    const message = error instanceof Error ? error.message : String(error)
    console.error("PostgreSQL is unavailable, retry in 5s:", message)
    setTimeout(warmupDb, 5000)
  }
}

async function start() {
  app.listen(port, () => {
    console.log(`API ready on http://localhost:${port}`)
  })

  await warmupDb()
}

start().catch((error) => {
  console.error("Failed to start server", error)
  process.exit(1)
})
