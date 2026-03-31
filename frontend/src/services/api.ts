import { runMockAiCheck } from "./ai"

type Role = "student" | "teacher" | "admin"

type User = {
  id: number
  name: string
  email: string
  password: string
  role: Role
  avatarUrl?: string
}

type PublicUser = Omit<User, "password">

type NotificationItem = {
  id: number
  title: string
  time: string
}

type Course = {
  id: number
  title: string
  lessons: number
  progress: number
  type: string
  students: string
  rating: string
  duration: string
  author: string
  level: string
  price: string
  published?: boolean
  accessType?: string
  coverUrl?: string
  description?: string
  category?: string
}

type CourseStep = {
  id: number
  courseId: number
  title: string
  kind: "theory" | "quiz" | "code"
  theoryText: string
  options: string[]
  correctOption: string
  codeKeyword: string
  stepOrder: number
  xp: number
}

type StepProgress = {
  courseId: number
  stepId: number
  status: "started" | "completed"
  score: number
  answerText: string
  attempts: number
  completedAt: string | null
}

type AiReview = {
  id: number
  quality: number
  correctness: number
  style: number
  summary: string
  createdAt: string
}

type Assignment = {
  id: number
  title: string
  description: string
  tests: Array<{ input: string; expected: string }>
  status: "draft" | "ready" | "published"
  difficulty: "junior" | "middle" | "senior"
  tags: string[]
  qualityScore: number
  createdAt: string
}

type Member = { id: number; name: string; role: string }
type FeedbackItem = { id: number; message: string; status: string }
type AdminUser = { id: number; name: string; email: string; role: Role }
type AccountProfile = {
  userId: number
  phone: string
  bio: string
  timezone: string
  language: string
  emailNotifications: boolean
  marketingNotifications: boolean
  twoFactorEnabled?: boolean
  pendingEmail?: string | null
}

type MockDb = {
  users: User[]
  currentUserId: number | null
  notifications: NotificationItem[]
  courses: Course[]
  courseSteps: CourseStep[]
  progress: StepProgress[]
  aiReviews: AiReview[]
  assignments: Assignment[]
  tracks: Array<{ id: number; name: string; status: string; progress: number; lessons: number }>
  analyticsPoints: Record<"week" | "month", number[]>
  roleMembers: Member[]
  feedback: FeedbackItem[]
  faq: Array<{ id: number; question: string; answer: string }>
  accountProfiles: AccountProfile[]
}

const STORAGE_KEY = "stepashka_mock_api_v2"
const USERS_RESET_MARKER_KEY = "stepashka_mock_users_reset_v1"
const LEGACY_EN_NORMALIZE_MARKER_KEY = "stepashka_mock_en_normalized_v2"
const ACCESS_TOKEN_KEY = "stepashka_access_token"
const REFRESH_TOKEN_KEY = "stepashka_refresh_token"
const MOCK_RESET_CODE_KEY = "stepashka_mock_reset_code"
const MOCK_EMAIL_CHANGE_CODE_KEY = "stepashka_mock_email_change_code"
const MOCK_2FA_CODE_KEY = "stepashka_mock_2fa_code"
const MOCK_2FA_LOGIN_CHALLENGE_KEY = "stepashka_mock_2fa_login_challenge"
const API_BASE_URL = String(import.meta.env.VITE_API_URL || "").replace(/\/+$/, "")
const USE_MOCK_ONLY = String(import.meta.env.VITE_USE_MOCK_API || "false").toLowerCase() === "true"

const delay = (ms = 500) => new Promise((resolve) => setTimeout(resolve, ms))

function canUseBackend() {
  return Boolean(API_BASE_URL) && !USE_MOCK_ONLY
}

function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}

function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

type BackendUser = {
  id: number
  email: string
  fullName: string
  role: Role
  status: string
  avatarUrl?: string
}

type BackendAuthResponse = {
  user: BackendUser
  accessToken: string
  refreshToken: string
}

type BackendTwoFactorChallengeResponse = {
  requiresTwoFactor: true
  challengeId: string
  message: string
  devCode?: string | null
}

function toPublicUser(user: BackendUser): PublicUser {
  return {
    id: user.id,
    name: user.fullName,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl || "",
  }
}

function toCourse(catalogItem: {
  id: number
  title: string
  category: string
  description?: string
  studentsCount: number
  rating: string | number
  durationHours: number
  teacherName: string | null
  level: string
  priceCents: number
  accessType?: string
  coverUrl?: string
}): Course {
  const duration = Math.max(0, Number(catalogItem.durationHours || 0))
  const lessons = Math.max(1, Math.round(duration / 2) || 1)
  const priceCents = Math.max(0, Number(catalogItem.priceCents || 0))
  const price = priceCents === 0 ? "Бесплатно" : `$${Math.round(priceCents / 100)}`
  const category = (catalogItem.category || "").toLowerCase()
  const normalizedType = category.includes("front") ? "Frontend" : category.includes("back") ? "Backend" : "General"

  const levelMap: Record<string, string> = {
    beginner: "Начальный",
    intermediate: "Средний",
    advanced: "Продвинутый",
    начальный: "Начальный",
    средний: "Средний",
    продвинутый: "Продвинутый",
  }
  const normalizedLevel = levelMap[String(catalogItem.level || "").toLowerCase()] || "Начальный"

  return {
    id: catalogItem.id,
    title: catalogItem.title,
    lessons,
    progress: 0,
    type: normalizedType,
    students: String(catalogItem.studentsCount || 0),
    rating: String(catalogItem.rating || "0.0"),
    duration: `${duration}ч`,
    author: catalogItem.teacherName || "Команда Stepashka",
    level: normalizedLevel,
    price,
    published: true,
    accessType: catalogItem.accessType || "open",
    coverUrl: catalogItem.coverUrl || "",
    description: catalogItem.description || "",
    category: catalogItem.category || "",
  }
}

async function backendRequest<T>(
  path: string,
  init: RequestInit = {},
  allowRefresh = true
): Promise<T> {
  const headers = new Headers(init.headers || {})
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json")
  }

  const accessToken = getAccessToken()
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  })

  if (response.status === 401 && allowRefresh && path !== "/auth/refresh" && path !== "/auth/login" && path !== "/auth/register") {
    const refreshed = await tryRefreshToken()
    if (refreshed) {
      return backendRequest<T>(path, init, false)
    }
    // Refresh failed — redirect to login so user can re-authenticate
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = "/login"
    }
  }

  if (!response.ok) {
    let message = "Ошибка запроса"
    try {
      const data = (await response.json()) as { error?: string; detail?: string | unknown[] }
      if (data?.error) {
        message = data.error
      } else if (typeof data?.detail === "string") {
        message = data.detail
      } else if (Array.isArray(data?.detail) && data.detail.length > 0) {
        message = (data.detail[0] as { msg?: string }).msg || `Ошибка ${response.status}`
      }
    } catch {
      message = `Ошибка ${response.status}`
    }
    throw new Error(message)
  }

  if (response.status === 204) {
    return {} as T
  }

  return (await response.json()) as T
}

async function tryRefreshToken() {
  const refreshToken = getRefreshToken()
  if (!refreshToken) {
    clearTokens()
    return false
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ refreshToken }),
    })

    if (!response.ok) {
      clearTokens()
      return false
    }

    const data = (await response.json()) as BackendAuthResponse
    if (!data.accessToken || !data.refreshToken) {
      clearTokens()
      return false
    }
    setTokens(data.accessToken, data.refreshToken)
    return true
  } catch {
    clearTokens()
    return false
  }
}

function nowIso() {
  return new Date().toISOString()
}

function normalizeLegacyText(input: string) {
  return String(input || "")
    .replace(/Реакт/g, "React")
    .replace(/реакт/g, "React")
    .replace(/Вью/g, "Vue")
    .replace(/вью/g, "Vue")
    .replace(/Пайтон/g, "Python")
    .replace(/пайтон/g, "Python")
}

function normalizeLegacyMockDb(db: MockDb) {
  db.courses = db.courses.map((course) => {
    const level =
      course.level === "Beginner" ? "Начальный" :
      course.level === "Intermediate" ? "Средний" :
      course.level === "Advanced" ? "Продвинутый" :
      course.level

    const type =
      course.type === "Фронтенд" ? "Frontend" :
      course.type === "Бэкенд" ? "Backend" :
      course.type === "Общее" ? "General" :
      course.type

    const duration = String(course.duration || "").replace("h", "ч")
    const price = course.price === "Free" ? "Бесплатно" : String(course.price || "")

    return {
      ...course,
      title: normalizeLegacyText(course.title),
      author: normalizeLegacyText(course.author),
      level,
      type,
      duration,
      price,
    }
  })

  db.courseSteps = db.courseSteps.map((step) => ({
    ...step,
    title:
      step.kind === "code"
        ? normalizeLegacyText(step.title).replace(/^Тест:\s*/i, "Код: ")
        : normalizeLegacyText(step.title),
    theoryText: normalizeLegacyText(step.theoryText),
    options: step.options.map((option) => normalizeLegacyText(option)),
    correctOption: normalizeLegacyText(step.correctOption),
  }))

  db.tracks = db.tracks.map((track) => ({
    ...track,
    name: normalizeLegacyText(track.name),
    status:
      track.status === "в процессе" ? "in progress" :
      track.status === "план" ? "planned" :
      track.status === "завершен" ? "completed" :
      track.status,
  }))

  db.roleMembers = db.roleMembers.map((member) => ({
    ...member,
    role:
      member.role === "студент" ? "student" :
      member.role === "преподаватель" ? "instructor" :
      member.role === "администратор" ? "administrator" :
      member.role,
  }))

  db.feedback = db.feedback.map((item) => ({
    ...item,
    status:
      item.status === "новое" ? "new" :
      item.status === "в работе" ? "in progress" :
      item.status === "закрыто" ? "closed" :
      item.status,
  }))

  db.notifications = db.notifications.map((item) => ({
    ...item,
    title: normalizeLegacyText(item.title),
  }))

  db.analyticsPoints = {
    week: (db.analyticsPoints as Record<string, number[]>).week || (db.analyticsPoints as Record<string, number[]>)["неделя"] || [],
    month: (db.analyticsPoints as Record<string, number[]>).month || (db.analyticsPoints as Record<string, number[]>)["месяц"] || [],
  }
}

function createSeed(): MockDb {
  return {
    users: [
      { id: 1, name: "Yaroslav", email: "admin@stepashka.dev", password: "admin123", role: "admin" },
      { id: 2, name: "Irina", email: "teacher@stepashka.dev", password: "teacher123", role: "teacher" },
      { id: 3, name: "Student", email: "student@stepashka.dev", password: "student123", role: "student" },
    ],
    currentUserId: null,
    notifications: [
      { id: 1, title: 'Новая задача в курсе "React Architecture"', time: "5 минут назад" },
      { id: 2, title: "Проверка решения завершена", time: "20 минут назад" },
      { id: 3, title: "Вы получили бейдж Fast Learner", time: "Вчера" },
    ],
    courses: [
      {
        id: 1,
        title: "Python: Большой практический курс",
        lessons: 36,
        progress: 0,
        type: "Backend",
        students: "980",
        rating: "4.9",
        duration: "52ч",
        author: "Stepashka Academy",
        level: "Начальный",
        price: "Бесплатно",
        published: true,
      },
    ],
    courseSteps: [
      { id: 1, courseId: 1, title: "Python и область применения", kind: "theory", theoryText: "Python используют для веба, автоматизации, анализа данных и ML. Ключевая идея языка - читаемость кода.", options: [], correctOption: "", codeKeyword: "", stepOrder: 1, xp: 8 },
      { id: 2, courseId: 1, title: "Типы данных: int, float, str, bool", kind: "theory", theoryText: "В Python переменные динамически типизированы. Один и тот же идентификатор может хранить значения разных типов.", options: [], correctOption: "", codeKeyword: "", stepOrder: 2, xp: 8 },
      { id: 3, courseId: 1, title: "Условные конструкции if/elif/else", kind: "theory", theoryText: "Ветвление позволяет выполнить разный код в зависимости от условия. Отступы в Python обязательны.", options: [], correctOption: "", codeKeyword: "", stepOrder: 3, xp: 8 },
      { id: 4, courseId: 1, title: "Циклы for и while", kind: "theory", theoryText: "for обычно используют с range() или коллекциями. while выполняется, пока условие истинно.", options: [], correctOption: "", codeKeyword: "", stepOrder: 4, xp: 8 },
      { id: 5, courseId: 1, title: "Функции и return", kind: "theory", theoryText: "Функции объявляются через def. Оператор return возвращает значение вызывающему коду.", options: [], correctOption: "", codeKeyword: "", stepOrder: 5, xp: 8 },
      { id: 6, courseId: 1, title: "Списки и словари", kind: "theory", theoryText: "list хранит упорядоченные элементы, dict хранит пары ключ-значение. Оба типа часто используются в реальных задачах.", options: [], correctOption: "", codeKeyword: "", stepOrder: 6, xp: 8 },
      { id: 7, courseId: 1, title: "Срезы и индексация", kind: "theory", theoryText: "Срезы позволяют получать подстроки и подсписки: s[1:4], s[::-1]. Индексация начинается с нуля.", options: [], correctOption: "", codeKeyword: "", stepOrder: 7, xp: 8 },
      { id: 8, courseId: 1, title: "Обработка исключений", kind: "theory", theoryText: "Конструкция try/except защищает код от аварийного завершения и позволяет корректно обработать ошибки.", options: [], correctOption: "", codeKeyword: "", stepOrder: 8, xp: 8 },
      { id: 9, courseId: 1, title: "Файлы и контекстный менеджер", kind: "theory", theoryText: "with open(...) as f: автоматически закрывает файл. Это безопаснее, чем manual close().", options: [], correctOption: "", codeKeyword: "", stepOrder: 9, xp: 8 },
      { id: 10, courseId: 1, title: "Генераторы и yield", kind: "theory", theoryText: "Генераторы экономят память и отдают значения по одному. Это полезно при больших наборах данных.", options: [], correctOption: "", codeKeyword: "", stepOrder: 10, xp: 8 },
      { id: 11, courseId: 1, title: "ООП: класс, объект, метод", kind: "theory", theoryText: "Классы описывают структуру и поведение объектов. self ссылается на текущий экземпляр.", options: [], correctOption: "", codeKeyword: "", stepOrder: 11, xp: 8 },
      { id: 12, courseId: 1, title: "Импорты и структура проекта", kind: "theory", theoryText: "Разбивайте код по модулям. Используйте явные импорты и понятные имена пакетов.", options: [], correctOption: "", codeKeyword: "", stepOrder: 12, xp: 8 },

      { id: 13, courseId: 1, title: "Какой тип хранит текст?", kind: "quiz", theoryText: "", options: ["str", "int", "float", "dict"], correctOption: "str", codeKeyword: "", stepOrder: 13, xp: 10 },
      { id: 14, courseId: 1, title: "Что вернет bool(0)?", kind: "quiz", theoryText: "", options: ["False", "True", "0", "None"], correctOption: "False", codeKeyword: "", stepOrder: 14, xp: 10 },
      { id: 15, courseId: 1, title: "Как объявить функцию в Python?", kind: "quiz", theoryText: "", options: ["def my_func():", "function my_func()", "func my_func()", "lambda my_func()"], correctOption: "def my_func():", codeKeyword: "", stepOrder: 15, xp: 10 },
      { id: 16, courseId: 1, title: "Что выведет 2 + 2 * 2?", kind: "quiz", theoryText: "", options: ["6", "8", "4", "2"], correctOption: "6", codeKeyword: "", stepOrder: 16, xp: 10 },
      { id: 17, courseId: 1, title: "Какой цикл подходит для range(10)?", kind: "quiz", theoryText: "", options: ["for", "while", "if", "try"], correctOption: "for", codeKeyword: "", stepOrder: 17, xp: 10 },
      { id: 18, courseId: 1, title: "Какой оператор сравнения равенства?", kind: "quiz", theoryText: "", options: ["==", "=", "!=", ">="], correctOption: "==", codeKeyword: "", stepOrder: 18, xp: 10 },
      { id: 19, courseId: 1, title: "Как создать пустой словарь?", kind: "quiz", theoryText: "", options: ["{}", "[]", "()", "set()"], correctOption: "{}", codeKeyword: "", stepOrder: 19, xp: 10 },
      { id: 20, courseId: 1, title: "Какой метод добавляет элемент в список?", kind: "quiz", theoryText: "", options: ["append", "add", "push", "insert_last"], correctOption: "append", codeKeyword: "", stepOrder: 20, xp: 10 },
      { id: 21, courseId: 1, title: "Что делает break в цикле?", kind: "quiz", theoryText: "", options: ["Прерывает цикл", "Пропускает итерацию", "Завершает программу", "Продолжает цикл"], correctOption: "Прерывает цикл", codeKeyword: "", stepOrder: 21, xp: 10 },
      { id: 22, courseId: 1, title: "Какой блок ловит исключения?", kind: "quiz", theoryText: "", options: ["except", "catch", "error", "finally"], correctOption: "except", codeKeyword: "", stepOrder: 22, xp: 10 },
      { id: 23, courseId: 1, title: "Как получить длину строки s?", kind: "quiz", theoryText: "", options: ["len(s)", "s.length", "size(s)", "count(s)"], correctOption: "len(s)", codeKeyword: "", stepOrder: 23, xp: 10 },
      { id: 24, courseId: 1, title: "Что такое list comprehension?", kind: "quiz", theoryText: "", options: ["Краткий синтаксис для создания списка", "Наследование списков", "Сортировка списка", "Тип списка"], correctOption: "Краткий синтаксис для создания списка", codeKeyword: "", stepOrder: 24, xp: 10 },

      { id: 25, courseId: 1, title: "Код: сумма двух чисел", kind: "code", theoryText: "Напишите функцию sum_two(a, b), возвращающую сумму двух чисел.", options: [], correctOption: "", codeKeyword: "sum_two", stepOrder: 25, xp: 20 },
      { id: 26, courseId: 1, title: "Код: чётное число", kind: "code", theoryText: "Напишите функцию is_even(n), которая возвращает True для четных чисел.", options: [], correctOption: "", codeKeyword: "is_even", stepOrder: 26, xp: 20 },
      { id: 27, courseId: 1, title: "Код: максимум в списке", kind: "code", theoryText: "Напишите функцию max_in_list(lst), которая возвращает максимум списка.", options: [], correctOption: "", codeKeyword: "max_in_list", stepOrder: 27, xp: 20 },
      { id: 28, courseId: 1, title: "Код: факториал", kind: "code", theoryText: "Напишите функцию factorial(n). 0! должно быть равно 1.", options: [], correctOption: "", codeKeyword: "factorial", stepOrder: 28, xp: 22 },
      { id: 29, courseId: 1, title: "Код: палиндром", kind: "code", theoryText: "Напишите функцию is_palindrome(s), которая проверяет строку на палиндром.", options: [], correctOption: "", codeKeyword: "is_palindrome", stepOrder: 29, xp: 22 },
      { id: 30, courseId: 1, title: "Код: количество гласных", kind: "code", theoryText: "Напишите функцию count_vowels(s), которая считает гласные в строке.", options: [], correctOption: "", codeKeyword: "count_vowels", stepOrder: 30, xp: 22 },
      { id: 31, courseId: 1, title: "Код: реверс строки", kind: "code", theoryText: "Напишите функцию reverse_string(s), которая переворачивает строку.", options: [], correctOption: "", codeKeyword: "reverse_string", stepOrder: 31, xp: 22 },
      { id: 32, courseId: 1, title: "Код: сумма списка", kind: "code", theoryText: "Напишите функцию sum_list(lst), возвращающую сумму элементов списка.", options: [], correctOption: "", codeKeyword: "sum_list", stepOrder: 32, xp: 22 },
      { id: 33, courseId: 1, title: "Код: проверка простого числа", kind: "code", theoryText: "Напишите функцию is_prime(n), проверяющую простое число.", options: [], correctOption: "", codeKeyword: "is_prime", stepOrder: 33, xp: 24 },
      { id: 34, courseId: 1, title: "Код: число Фибоначчи", kind: "code", theoryText: "Напишите функцию fibonacci(n), возвращающую n-е число Фибоначчи.", options: [], correctOption: "", codeKeyword: "fibonacci", stepOrder: 34, xp: 24 },
      { id: 35, courseId: 1, title: "Код: уникальные элементы", kind: "code", theoryText: "Напишите функцию unique_items(lst), которая убирает дубликаты.", options: [], correctOption: "", codeKeyword: "unique_items", stepOrder: 35, xp: 24 },
      { id: 36, courseId: 1, title: "Код: сортировка словаря по значению", kind: "code", theoryText: "Напишите функцию sort_dict_by_value(d), сортирующую пары словаря по значению.", options: [], correctOption: "", codeKeyword: "sort_dict_by_value", stepOrder: 36, xp: 26 },
    ],
    progress: [],
    aiReviews: [],
    assignments: [],
    tracks: [
      { id: 1, name: "Frontend: от основ до проекта", status: "in progress", progress: 62, lessons: 28 },
      { id: 2, name: "Подготовка к стажировке", status: "planned", progress: 0, lessons: 16 },
    ],
    analyticsPoints: {
      week: [48, 61, 58, 64, 73, 76, 82],
      month: [42, 48, 52, 57, 60, 63, 68, 70, 74, 77, 81, 84],
    },
    roleMembers: [
      { id: 1, name: "Yaroslav", role: "administrator" },
      { id: 2, name: "Veronika", role: "instructor" },
      { id: 3, name: "Roman", role: "methodologist" },
    ],
    feedback: [
      { id: 1, message: "Добавьте подсказки для заданий", status: "new" },
      { id: 2, message: "Показывайте историю попыток", status: "in progress" },
    ],
    faq: [
      { id: 1, question: "Как отправить решение на проверку?", answer: "Откройте страницу задачи и нажмите Проверить." },
      { id: 2, question: "Где отслеживать прогресс?", answer: "На Dashboard и на странице каждого курса." },
    ],
    accountProfiles: [
      {
        userId: 1,
        phone: "+7 999 111-22-33",
        bio: "Администратор платформы Stepashka.",
        timezone: "Europe/Moscow",
        language: "ru",
        emailNotifications: true,
        marketingNotifications: false,
      },
      {
        userId: 2,
        phone: "+7 999 222-33-44",
        bio: "Преподаватель Frontend-направления.",
        timezone: "Europe/Moscow",
        language: "ru",
        emailNotifications: true,
        marketingNotifications: true,
      },
      {
        userId: 3,
        phone: "",
        bio: "",
        timezone: "Europe/Moscow",
        language: "ru",
        emailNotifications: true,
        marketingNotifications: false,
      },
    ],
  }
}

function getDb(): MockDb {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    const seed = createSeed()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed))
    return seed
  }

  try {
    const parsed = JSON.parse(raw) as MockDb

    if (!Array.isArray(parsed.accountProfiles)) {
      parsed.accountProfiles = parsed.users.map((user) => ({
        userId: user.id,
        phone: "",
        bio: "",
        timezone: "Europe/Moscow",
        language: "ru",
        emailNotifications: true,
        marketingNotifications: false,
      }))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
    }

    if (!localStorage.getItem(LEGACY_EN_NORMALIZE_MARKER_KEY)) {
      normalizeLegacyMockDb(parsed)
      localStorage.setItem(LEGACY_EN_NORMALIZE_MARKER_KEY, "1")
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
    }

    // One-time local cleanup: remove previously registered mock users,
    // preserving catalog/content entities (courses, steps, assignments).
    if (!localStorage.getItem(USERS_RESET_MARKER_KEY)) {
      parsed.users = []
      parsed.currentUserId = null
      parsed.progress = []
      parsed.aiReviews = []
      parsed.notifications = parsed.notifications.filter((item) => !item.title.toLowerCase().includes("welcome"))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
      localStorage.setItem(USERS_RESET_MARKER_KEY, "1")
    }

    return parsed
  } catch {
    const seed = createSeed()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed))
    return seed
  }
}

function setDb(db: MockDb) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
}

function sanitizeUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl || "",
  }
}

function getOrCreateAccountProfile(db: MockDb, userId: number): AccountProfile {
  const existing = db.accountProfiles.find((item) => item.userId === userId)
  if (existing) {
    return existing
  }

  const created: AccountProfile = {
    userId,
    phone: "",
    bio: "",
    timezone: "Europe/Moscow",
    language: "ru",
    emailNotifications: true,
    marketingNotifications: false,
    twoFactorEnabled: false,
    pendingEmail: null,
  }
  db.accountProfiles.push(created)
  return created
}

function getCurrentUser(db: MockDb): PublicUser | null {
  if (!db.currentUserId) {
    return null
  }

  const user = db.users.find((item) => item.id === db.currentUserId)
  return user ? sanitizeUser(user) : null
}

function requireAuth(db: MockDb): PublicUser {
  const user = getCurrentUser(db)
  if (!user) {
    throw new Error("Требуется авторизация")
  }
  return user
}

function requireRole(db: MockDb, roles: Role[]): PublicUser {
  const user = requireAuth(db)
  if (!roles.includes(user.role)) {
    throw new Error("Недостаточно прав")
  }
  return user
}

function withCourseProgress(db: MockDb): Course[] {
  return db.courses.map((course) => {
    const steps = db.courseSteps.filter((step) => step.courseId === course.id)
    const completed = db.progress.filter((p) => p.courseId === course.id && p.status === "completed").length
    const percent = steps.length ? Math.round((completed / steps.length) * 100) : course.progress
    return { ...course, progress: percent }
  })
}

function canAccessCourse(user: PublicUser | null, course: Course) {
  if (course.published !== false) {
    return true
  }
  return user?.role === "teacher" || user?.role === "admin"
}

async function handleGet<T>(path: string): Promise<T> {
  const db = getDb()

  if (path === "/landing/stats") {
    const courses = withCourseProgress(db)
    const studentsTotal = courses.reduce((sum, course) => {
      const raw = String(course.students || "0").trim().toLowerCase().replace(/,/g, ".")
      const numeric = Number(raw.replace(/[^\d.]/g, ""))
      if (!Number.isFinite(numeric)) {
        return sum
      }
      const multiplier = raw.includes("m") ? 1_000_000 : raw.includes("k") ? 1_000 : 1
      return sum + Math.round(numeric * multiplier)
    }, 0)

    const averageRating =
      courses.length > 0
        ? courses.reduce((sum, course) => sum + Number(course.rating || 0), 0) / courses.length
        : 0

    return {
      coursesTotal: courses.length,
      studentsTotal,
      averageRating,
      communityMembers: db.users.length,
    } as T
  }

  if (path === "/auth/me") {
    return getCurrentUser(db) as T
  }

  if (path === "/account/profile") {
    const current = requireAuth(db)
    const profile = getOrCreateAccountProfile(db, current.id)
    const user = db.users.find((item) => item.id === current.id)
    if (!user) {
      throw new Error("Пользователь не найден")
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl || "",
      phone: profile.phone,
      bio: profile.bio,
      timezone: profile.timezone,
      language: profile.language,
      emailNotifications: profile.emailNotifications,
      marketingNotifications: profile.marketingNotifications,
      twoFactorEnabled: Boolean(profile.twoFactorEnabled),
      pendingEmail: profile.pendingEmail || null,
    } as T
  }

  if (path === "/account/sessions") {
    requireAuth(db)
    return [
      {
        id: 1,
        userAgent: navigator.userAgent,
        ipAddress: "127.0.0.1",
        lastUsedAt: nowIso(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: nowIso(),
      },
    ] as T
  }

  if (path === "/notifications") {
    return db.notifications as T
  }

  if (path === "/courses") {
    const current = getCurrentUser(db)
    return withCourseProgress(db).filter((item) => canAccessCourse(current, item)) as T
  }

  if (path.startsWith("/courses/") && path.endsWith("/steps")) {
    const current = requireAuth(db)
    const parts = path.split("/")
    const courseId = Number(parts[2])

    const course = withCourseProgress(db).find((item) => item.id === courseId)
    if (!course) {
      throw new Error("Курс не найден")
    }
    if (!canAccessCourse(current, course)) {
      throw new Error("Курс недоступен")
    }

    const steps = db.courseSteps
      .filter((item) => item.courseId === courseId)
      .sort((a, b) => a.stepOrder - b.stepOrder)
      .map((item) => ({
        id: item.id,
        title: item.title,
        kind: item.kind,
        theoryText: item.theoryText,
        options: item.options,
        stepOrder: item.stepOrder,
        xp: item.xp,
      }))

    const progress = db.progress.filter((item) => item.courseId === courseId)
    const completed = progress.filter((item) => item.status === "completed").length
    const xp = progress.reduce((sum, item) => sum + item.score, 0)

    return {
      course,
      steps,
      progress,
      summary: {
        total: steps.length,
        completed,
        xp,
        percent: steps.length ? Math.round((completed / steps.length) * 100) : 0,
      },
    } as T
  }

  if (path === "/dashboard") {
    const current = requireAuth(db)
    const courses = withCourseProgress(db).filter((item) => canAccessCourse(current, item))
    const activeCourses = courses.slice(0, 6)
    const average = courses.length
      ? Math.round(courses.reduce((sum, item) => sum + item.progress, 0) / courses.length)
      : 0

    const toDateKey = (value: string | Date) => {
      const date = value instanceof Date ? value : new Date(value)
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, "0")
      const d = String(date.getDate()).padStart(2, "0")
      return `${y}-${m}-${d}`
    }

    const activeDays = new Set(
      db.progress
        .filter((item) => item.status === "completed" && item.completedAt)
        .map((item) => toDateKey(String(item.completedAt)))
    )

    const today = new Date()
    const todayKey = toDateKey(today)
    const startOffset = activeDays.has(todayKey) ? 0 : 1

    let streakDays = 0
    for (let i = startOffset; i < 365; i += 1) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      if (activeDays.has(toDateKey(date))) {
        streakDays += 1
      } else {
        break
      }
    }

    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)

    const tasksWeek = db.progress.filter(
      (item) => item.status === "completed" && item.completedAt && new Date(item.completedAt) >= weekAgo
    ).length

    const unfinishedStep = db.courseSteps
      .slice()
      .sort((a, b) => a.courseId - b.courseId || a.stepOrder - b.stepOrder)
      .find((step) => {
        const enrolledCourse = courses.some((course) => course.id === step.courseId)
        const completed = db.progress.some((item) => item.courseId === step.courseId && item.stepId === step.id && item.status === "completed")
        return enrolledCourse && !completed
      })

    const weeklyGoalSteps = 10
    const remainingCourseSteps = db.courseSteps.filter((step) => {
      const enrolledCourse = courses.some((course) => course.id === step.courseId)
      const completed = db.progress.some((item) => item.courseId === step.courseId && item.stepId === step.id && item.status === "completed")
      return enrolledCourse && !completed
    }).length

    const stepsPerDay = tasksWeek / 7
    const forecastDays = remainingCourseSteps > 0 ? Math.ceil(remainingCourseSteps / Math.max(stepsPerDay, 0.5)) : 0

    const continueCourse = unfinishedStep ? courses.find((course) => course.id === unfinishedStep.courseId) : null

    return {
      stats: {
        activeCourses: activeCourses.length,
        streakDays,
        averageScore: `${average}%`,
        tasksWeek,
      },
      continue: unfinishedStep
        ? {
          courseId: unfinishedStep.courseId,
          courseTitle: continueCourse?.title || `Курс #${unfinishedStep.courseId}`,
          stepId: unfinishedStep.id,
          stepTitle: unfinishedStep.title,
          stepOrder: unfinishedStep.stepOrder,
        }
        : null,
      weeklyPlan: {
        goalSteps: weeklyGoalSteps,
        completedSteps: tasksWeek,
        remainingSteps: Math.max(weeklyGoalSteps - tasksWeek, 0),
        forecastDays,
      },
      courses: activeCourses.map((item) => ({ id: item.id, title: item.title, progress: item.progress })),
      activities: db.notifications.slice(0, 5).map((item, index) => ({ id: index + 1, text: item.title })),
      deadline: {
        title: unfinishedStep ? `Следующий шаг: ${unfinishedStep.title}` : "Дедлайнов нет",
        text: unfinishedStep ? `Курс #${unfinishedStep.courseId}, шаг ${unfinishedStep.stepOrder}` : "Вы прошли все доступные шаги.",
      },
    } as T
  }

  if (path === "/tracks") {
    return db.tracks as T
  }

  if (path === "/ai-review/history") {
    return db.aiReviews.slice().reverse().slice(0, 20) as T
  }

  if (path.startsWith("/analytics")) {
    const current = requireAuth(db)
    const params = new URLSearchParams(path.split("?")[1] || "")
    const rawPeriod = (params.get("period") || "week").toLowerCase()
    const period = rawPeriod === "month" || rawPeriod === "месяц" ? "month" : "week"
    const points = db.analyticsPoints[period]
    const courses = withCourseProgress(db).filter((item) => canAccessCourse(current, item))
    const completedCourses = courses.filter((item) => item.progress >= 100).length
    const averageScore = courses.length
      ? Math.round(courses.reduce((sum, item) => sum + item.progress, 0) / courses.length)
      : 0

    return {
      period,
      values: points,
      stats: {
        averageScore: `${averageScore}%`,
        solvedTasks: db.aiReviews.length,
        completedCourses,
      },
    } as T
  }

  if (path === "/assignments") {
    return db.assignments.slice().reverse().map((item) => ({
      id: item.id,
      title: item.title,
      status: item.status || "draft",
      difficulty: item.difficulty || "junior",
      tags: Array.isArray(item.tags) ? item.tags : [],
      qualityScore: Number(item.qualityScore) || 0,
      testsCount: Array.isArray(item.tests) ? item.tests.length : 0,
      createdAt: item.createdAt,
    })) as T
  }

  if (path === "/roles-members") {
    requireRole(db, ["admin"])
    return db.roleMembers as T
  }

  if (path === "/feedback") {
    return db.feedback as T
  }

  if (path === "/admin/overview") {
    requireRole(db, ["admin"])
    const users = db.users.length
    const students = db.users.filter((item) => item.role === "student").length
    const teachers = db.users.filter((item) => item.role === "teacher").length
    const admins = db.users.filter((item) => item.role === "admin").length
    const paidCourses = db.courses.filter((item) => item.price !== "Бесплатно")
    const publishedCourses = db.courses.filter((item) => item.published !== false).length
    const moderationQueue = db.courses.filter((item) => item.published === false).length

    return {
      users,
      students,
      teachers,
      admins,
      courses: db.courses.length,
      publishedCourses,
      estimatedRevenue: paidCourses.length * 159000,
      moderationQueue,
    } as T
  }

  if (path === "/admin/courses") {
    requireRole(db, ["admin"])
    return db.courses
      .slice()
      .sort((a, b) => b.id - a.id)
      .map((item) => ({
        id: item.id,
        title: item.title,
        author: item.author,
        students: item.students,
        level: item.level,
        type: item.type,
        price: item.price,
        published: item.published !== false,
      })) as T
  }

  if (path === "/admin/users") {
    requireRole(db, ["admin"])
    return db.users
      .slice()
      .sort((a, b) => b.id - a.id)
      .map((item) => ({
        id: item.id,
        name: item.name,
        email: item.email,
        role: item.role,
      })) as T
  }

  if (path === "/teacher/overview") {
    requireRole(db, ["teacher", "admin"])
    const assignments = db.assignments.length
    const reviews = db.aiReviews.length
    const publishedCount = db.courses.filter((item) => item.published !== false).length
    const draftCount = db.courses.filter((item) => item.published === false).length
    return {
      courses: db.courses.slice(0, 6),
      stats: {
        assignments,
        reviews,
        publishedCount,
        draftCount,
        avgProgress: db.courses.length
          ? Math.round(db.courses.reduce((sum, item) => sum + item.progress, 0) / db.courses.length)
          : 0,
      },
    } as T
  }

  if (path === "/teacher/courses") {
    requireRole(db, ["teacher", "admin"])
    return db.courses
      .slice()
      .sort((a, b) => b.id - a.id)
      .map((item) => ({
        id: item.id,
        title: item.title,
        type: item.type,
        level: item.level,
        students: item.students,
        progress: item.progress,
        published: item.published !== false,
      })) as T
  }

  if (path === "/admin/analytics") {
    requireRole(db, ["admin"])

    const courses = withCourseProgress(db)
    const users = db.users.length
    const activeUsers = Math.max(0, Math.round(users * 0.72))
    const conversionRate = users > 0 ? Math.round((courses.filter((item) => item.progress > 0).length / users) * 100) : 0
    const paidCourses = courses.filter((item) => item.price !== "Бесплатно")
    const mrr = paidCourses.reduce((sum, item) => {
      const priceNumber = Number(String(item.price).replace(/[^0-9.]/g, "")) || 0
      const studentsNumber = Number(String(item.students).replace(/[^0-9.]/g, "")) || 0
      return sum + Math.round(priceNumber * studentsNumber * 10)
    }, 0)

    const topCourses = courses
      .slice()
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        title: item.title,
        progress: item.progress,
        students: item.students,
      }))

    return {
      kpi: {
        users,
        activeUsers,
        conversionRate,
        mrr,
      },
      funnel: [
        { stage: "Visit", value: 1000 },
        { stage: "Sign up", value: 620 },
        { stage: "Enroll", value: 360 },
        { stage: "Complete", value: 180 },
      ],
      retention: [72, 68, 64, 60, 58, 57],
      topCourses,
    } as T
  }

  if (path === "/help-faq") {
    return db.faq as T
  }

  throw new Error("Unknown GET endpoint")
}

async function handlePost<T>(path: string, body: unknown): Promise<T> {
  const db = getDb()

  if (path === "/auth/register") {
    const payload = body as { name?: string; email?: string; password?: string }
    const name = String(payload?.name || "").trim()
    const email = String(payload?.email || "").trim().toLowerCase()
    const password = String(payload?.password || "")

    if (!name || !email || password.length < 6) {
      throw new Error("Проверьте данные регистрации")
    }

    if (db.users.some((item) => item.email === email)) {
      throw new Error("Пользователь с таким email уже существует")
    }

    const nextId = Math.max(...db.users.map((item) => item.id), 0) + 1
    const user: User = { id: nextId, name, email, password, role: "student" }
    db.users.push(user)
    db.accountProfiles.push({
      userId: user.id,
      phone: "",
      bio: "",
      timezone: "Europe/Moscow",
      language: "ru",
      emailNotifications: true,
      marketingNotifications: false,
    })
    db.currentUserId = user.id
    db.notifications.unshift({ id: Date.now(), title: `Добро пожаловать, ${name}`, time: "Только что" })
    setDb(db)
    return sanitizeUser(user) as T
  }

  if (path === "/auth/login") {
    const payload = body as { email?: string; password?: string }
    const email = String(payload?.email || "").trim().toLowerCase()
    const password = String(payload?.password || "")

    const user = db.users.find((item) => item.email === email && item.password === password)
    if (!user) {
      throw new Error("Неверный email или пароль")
    }

    const profile = getOrCreateAccountProfile(db, user.id)
    if (profile.twoFactorEnabled) {
      const challengeId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
      const code = String(Math.floor(100000 + Math.random() * 900000))
      localStorage.setItem(MOCK_2FA_LOGIN_CHALLENGE_KEY, JSON.stringify({ challengeId, userId: user.id, code }))
      return {
        requiresTwoFactor: true,
        challengeId,
        message: "Требуется подтверждение 2FA",
        devCode: code,
      } as T
    }

    db.currentUserId = user.id
    setDb(db)
    return sanitizeUser(user) as T
  }

  if (path === "/auth/2fa/verify") {
    const payload = body as { challengeId?: string; code?: string }
    const challengeId = String(payload?.challengeId || "")
    const code = String(payload?.code || "")
    const rawChallenge = localStorage.getItem(MOCK_2FA_LOGIN_CHALLENGE_KEY)
    if (!rawChallenge) {
      throw new Error("Challenge истек")
    }

    const challenge = JSON.parse(rawChallenge) as { challengeId: string; userId: number; code: string }
    if (challenge.challengeId !== challengeId || challenge.code !== code) {
      throw new Error("Неверный код 2FA")
    }

    const user = db.users.find((item) => item.id === challenge.userId)
    if (!user) {
      throw new Error("Пользователь не найден")
    }

    db.currentUserId = user.id
    localStorage.removeItem(MOCK_2FA_LOGIN_CHALLENGE_KEY)
    setDb(db)
    return sanitizeUser(user) as T
  }

  if (path === "/auth/logout") {
    db.currentUserId = null
    setDb(db)
    return { success: true } as T
  }

  if (path === "/auth/forgot-password") {
    const payload = body as { email?: string }
    const email = String(payload?.email || "").trim().toLowerCase()

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Введите корректный email")
    }

    const user = db.users.find((item) => item.email === email)
    if (user) {
      const code = String(Math.floor(100000 + Math.random() * 900000))
      localStorage.setItem(MOCK_RESET_CODE_KEY, code)
      db.notifications.unshift({
        id: Date.now(),
        title: `Password reset code (${code}) was sent to ${email}`,
        time: "Только что",
      })
      setDb(db)
    }

    return {
      success: true,
      message: "Если аккаунт с таким email существует, мы отправили код для сброса пароля.",
    } as T
  }

  if (path === "/auth/reset-password") {
    const payload = body as { email?: string; code?: string; password?: string }
    const email = String(payload?.email || "").trim().toLowerCase()
    const code = String(payload?.code || "").trim()
    const password = String(payload?.password || "")

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Введите корректный email")
    }

    if (!/^\d{6}$/.test(code)) {
      throw new Error("Введите 6-значный код")
    }

    if (password.trim().length < 8) {
      throw new Error("Пароль должен содержать минимум 8 символов")
    }

    const user = db.users.find((item) => item.email === email)
    if (!user) {
      throw new Error("Неверный код или email")
    }

    const expectedCode = localStorage.getItem(MOCK_RESET_CODE_KEY)
    if (!expectedCode || expectedCode !== code) {
      throw new Error("Неверный код или email")
    }

    user.password = password
    localStorage.removeItem(MOCK_RESET_CODE_KEY)
    setDb(db)

    return {
      success: true,
      message: "Пароль обновлен",
    } as T
  }

  if (path === "/account/change-password") {
    const current = requireAuth(db)
    const payload = body as { currentPassword?: string; newPassword?: string; confirmPassword?: string }
    const currentPassword = String(payload.currentPassword || "")
    const newPassword = String(payload.newPassword || "")
    const confirmPassword = String(payload.confirmPassword || "")

    const user = db.users.find((item) => item.id === current.id)
    if (!user) {
      throw new Error("Пользователь не найден")
    }

    if (user.password !== currentPassword) {
      throw new Error("Текущий пароль указан неверно")
    }

    if (newPassword.trim().length < 8) {
      throw new Error("Новый пароль должен содержать минимум 8 символов")
    }

    if (newPassword !== confirmPassword) {
      throw new Error("Подтверждение пароля не совпадает")
    }

    user.password = newPassword
    setDb(db)

    return {
      success: true,
      message: "Пароль успешно изменен",
    } as T
  }

  if (path === "/account/confirm-email-change") {
    const current = requireAuth(db)
    const payload = body as { code?: string }
    const code = String(payload?.code || "").trim()
    const profile = getOrCreateAccountProfile(db, current.id)

    if (!profile.pendingEmail) {
      throw new Error("Нет ожидающей смены email")
    }

    const expectedCode = localStorage.getItem(MOCK_EMAIL_CHANGE_CODE_KEY)
    if (!expectedCode || expectedCode !== code) {
      throw new Error("Неверный код подтверждения")
    }

    const occupied = db.users.some((item) => item.id !== current.id && item.email === profile.pendingEmail)
    if (occupied) {
      throw new Error("Пользователь с таким email уже существует")
    }

    const user = db.users.find((item) => item.id === current.id)
    if (!user) {
      throw new Error("Пользователь не найден")
    }

    user.email = profile.pendingEmail
    profile.pendingEmail = null
    localStorage.removeItem(MOCK_EMAIL_CHANGE_CODE_KEY)
    setDb(db)

    return {
      success: true,
      message: "Email успешно обновлен",
    } as T
  }

  if (path === "/account/logout-all") {
    requireAuth(db)
    return { success: true } as T
  }

  if (path === "/account/2fa/request-enable") {
    const current = requireAuth(db)
    const code = String(Math.floor(100000 + Math.random() * 900000))
    localStorage.setItem(MOCK_2FA_CODE_KEY, code)
    const profile = getOrCreateAccountProfile(db, current.id)
    profile.twoFactorEnabled = false
    setDb(db)

    return {
      success: true,
      message: "Код подтверждения отправлен",
      devCode: code,
    } as T
  }

  if (path === "/account/2fa/confirm-enable") {
    const current = requireAuth(db)
    const payload = body as { code?: string }
    const code = String(payload?.code || "").trim()
    const expectedCode = localStorage.getItem(MOCK_2FA_CODE_KEY)
    if (!expectedCode || expectedCode !== code) {
      throw new Error("Неверный код")
    }

    const profile = getOrCreateAccountProfile(db, current.id)
    profile.twoFactorEnabled = true
    localStorage.removeItem(MOCK_2FA_CODE_KEY)
    setDb(db)

    return { success: true, message: "2FA включена" } as T
  }

  if (path === "/account/2fa/disable") {
    const current = requireAuth(db)
    const payload = body as { password?: string }
    const password = String(payload?.password || "")
    const user = db.users.find((item) => item.id === current.id)
    if (!user || user.password !== password) {
      throw new Error("Неверный пароль")
    }

    const profile = getOrCreateAccountProfile(db, current.id)
    profile.twoFactorEnabled = false
    setDb(db)
    return { success: true, message: "2FA отключена" } as T
  }

  if (path === "/courses") {
    requireRole(db, ["teacher", "admin"])
    const payload = body as { title?: string; level?: string; type?: string }
    const title = String(payload?.title || "").trim()

    if (!title) {
      throw new Error("Название курса обязательно")
    }

    const nextId = Math.max(...db.courses.map((item) => item.id), 0) + 1
    const created: Course = {
      id: nextId,
      title,
      lessons: 3,
      progress: 0,
      type: String(payload?.type || "Frontend"),
      students: "0",
      rating: "0.0",
      duration: "0h",
      author: "Новый преподаватель",
      level: String(payload?.level || "Начальный"),
      price: "Бесплатно",
      published: false,
    }

    db.courses.unshift(created)
    db.notifications.unshift({ id: Date.now(), title: `Курс ${title} успешно добавлен`, time: "Только что" })
    setDb(db)
    return created as T
  }

  if (path.startsWith("/courses/") && path.endsWith("/enroll")) {
    const user = requireAuth(db)
    const courseId = Number(path.split("/")[2])
    const course = withCourseProgress(db).find((item) => item.id === courseId)
    if (!course) {
      throw new Error("Курс не найден")
    }
    if (!canAccessCourse(user, course)) {
      throw new Error("Нельзя записаться на неопубликованный курс")
    }

    const firstStep = db.courseSteps
      .filter((item) => item.courseId === courseId)
      .sort((a, b) => a.stepOrder - b.stepOrder)[0]

    if (firstStep) {
      const existing = db.progress.find((item) => item.courseId === courseId && item.stepId === firstStep.id)
      if (!existing) {
        db.progress.push({
          courseId,
          stepId: firstStep.id,
          status: "started",
          score: 0,
          answerText: "",
          attempts: 1,
          completedAt: null,
        })
      }
    }

    db.notifications.unshift({ id: Date.now(), title: `${user.name} записался на курс`, time: "Только что" })
    setDb(db)
    return { success: true } as T
  }

  if (path.startsWith("/steps/") && path.endsWith("/check")) {
    requireAuth(db)
    const stepId = Number(path.split("/")[2])
    const payload = body as { answer?: string }
    const answer = String(payload?.answer || "").trim()

    const step = db.courseSteps.find((item) => item.id === stepId)
    if (!step) {
      throw new Error("Шаг не найден")
    }

    let passed = false
    let checkResults: Array<{ name: string; passed: boolean }> | null = null
    if (step.kind === "theory") {
      passed = true
    } else if (step.kind === "quiz") {
      passed = answer.toLowerCase() === step.correctOption.toLowerCase()
    } else {
      const keywordPassed = step.codeKeyword ? answer.toLowerCase().includes(step.codeKeyword.toLowerCase()) : answer.length > 10
      const nonEmptyPassed = answer.trim().length > 0
      checkResults = [
        {
          name: step.codeKeyword
            ? `Содержит ключевую конструкцию: ${step.codeKeyword}`
            : "Базовая проверка условия",
          passed: keywordPassed,
        },
        {
          name: "Ответ не пустой",
          passed: nonEmptyPassed,
        },
      ]
      passed = keywordPassed && nonEmptyPassed
    }

    const existing = db.progress.find((item) => item.courseId === step.courseId && item.stepId === step.id)
    if (existing) {
      existing.attempts += 1
      existing.answerText = answer
      existing.status = passed ? "completed" : "started"
      existing.score = passed ? Math.max(existing.score, step.xp) : existing.score
      existing.completedAt = passed ? existing.completedAt || nowIso() : existing.completedAt
    } else {
      db.progress.push({
        courseId: step.courseId,
        stepId: step.id,
        status: passed ? "completed" : "started",
        score: passed ? step.xp : 0,
        answerText: answer,
        attempts: 1,
        completedAt: passed ? nowIso() : null,
      })
    }

    const progress = db.progress.filter((item) => item.courseId === step.courseId)
    const total = db.courseSteps.filter((item) => item.courseId === step.courseId).length
    const completed = progress.filter((item) => item.status === "completed").length
    const percent = total ? Math.round((completed / total) * 100) : 0

    const course = db.courses.find((item) => item.id === step.courseId)
    if (course) {
      course.progress = percent
    }

    if (passed) {
      db.notifications.unshift({ id: Date.now(), title: `Шаг ${step.title} пройден`, time: "Только что" })
    }

    setDb(db)

    const saved = db.progress.find((item) => item.courseId === step.courseId && item.stepId === step.id)

    return {
      passed,
      feedback: passed ? "Решение принято" : "Пока не принято. Попробуйте еще раз.",
      checkResults,
      progress: saved,
      courseSummary: { total, completed, percent },
    } as T
  }

  if (path === "/ai-review/check") {
    requireAuth(db)
    const payload = body as { sourceCode?: string }
    const sourceCode = String(payload?.sourceCode || "")
    const result = runMockAiCheck(sourceCode)

    const review: AiReview = {
      id: Date.now(),
      quality: result.quality,
      correctness: result.correctness,
      style: result.style,
      summary: result.summary,
      createdAt: nowIso(),
    }

    db.aiReviews.push(review)
    db.notifications.unshift({ id: Date.now() + 1, title: "AI-проверка завершена", time: "Только что" })
    setDb(db)

    return result as T
  }

  if (path === "/ai/chat") {
    requireAuth(db)
    const payload = body as { message?: string }
    const message = String(payload?.message || "").trim()
    if (!message) {
      throw new Error("Введите сообщение для AI")
    }

    const lower = message.toLowerCase()
    let reply = "Сформулируйте задачу подробнее: цель, текущий код и ожидаемый результат."
    if (lower.includes("react") || lower.includes("frontend")) {
      reply = "Рекомендую начать с decomposition: выделите UI-компоненты, затем состояния по feature-slice, после чего добавьте валидацию и optimistic updates для UX."
    } else if (lower.includes("sql") || lower.includes("backend") || lower.includes("api")) {
      reply = "Для backend сначала зафиксируйте контракт endpoint, затем добавьте индексы на поля фильтрации и проверьте edge-case ошибки через integration tests."
    } else if (lower.includes("алгоритм") || lower.includes("leetcode")) {
      reply = "Опишите ограничения задачи, затем сравните brute-force и оптимальный подход по сложности, после чего добавьте тесты на крайние случаи."
    }

    db.notifications.unshift({ id: Date.now(), title: "AI-ассистент ответил на ваш запрос", time: "Только что" })
    setDb(db)

    return {
      reply,
      model: "stepashka-mock-ai",
    } as T
  }

  if (path === "/assignments") {
    requireRole(db, ["teacher", "admin"])
    const payload = body as {
      title?: string
      description?: string
      tests?: Array<{ input: string; expected?: string; output?: string }>
      status?: "draft" | "ready" | "published"
      difficulty?: "junior" | "middle" | "senior"
      tags?: string[]
      qualityScore?: number
    }
    const title = String(payload?.title || "").trim()
    const description = String(payload?.description || "").trim()
    if (!title || !description) {
      throw new Error("Название и описание обязательны")
    }

    const tests = Array.isArray(payload?.tests)
      ? payload.tests
        .map((item) => ({
          input: String(item?.input || "").trim(),
          expected: String(item?.expected ?? item?.output ?? "").trim(),
        }))
        .filter((item) => item.input && item.expected)
      : []

    const assignment: Assignment = {
      id: Date.now(),
      title,
      description,
      tests,
      status: payload?.status || "draft",
      difficulty: payload?.difficulty || "junior",
      tags: Array.isArray(payload?.tags) ? payload.tags.filter((item) => item.trim()).slice(0, 8) : [],
      qualityScore: Number(payload?.qualityScore) || 0,
      createdAt: nowIso(),
    }

    db.assignments.push(assignment)
    setDb(db)
    return assignment as T
  }

  if (path === "/roles-members") {
    requireRole(db, ["admin"])
    const payload = body as { name?: string }
    const name = String(payload?.name || "").trim()
    if (!name) {
      throw new Error("Имя обязательно")
    }

    const member: Member = { id: Date.now(), name, role: "student" }
    db.roleMembers.push(member)
    setDb(db)
    return member as T
  }

  if (path === "/feedback") {
    requireAuth(db)
    const payload = body as { message?: string }
    const message = String(payload?.message || "").trim()
    if (!message) {
      throw new Error("Сообщение обязательно")
    }

    const next: FeedbackItem = { id: Date.now(), message, status: "new" }
    db.feedback.unshift(next)
    setDb(db)
    return next as T
  }

  throw new Error("Неизвестный POST endpoint")
}

async function handlePatch<T>(path: string, body: unknown): Promise<T> {
  const db = getDb()
  const current = requireAuth(db)

  if (path === "/account/profile") {
    const payload = body as {
      name?: string
      email?: string
      phone?: string
      bio?: string
      timezone?: string
      language?: string
      emailNotifications?: boolean
      marketingNotifications?: boolean
      avatarUrl?: string
    }

    const user = db.users.find((item) => item.id === current.id)
    if (!user) {
      throw new Error("Пользователь не найден")
    }

    const profile = getOrCreateAccountProfile(db, current.id)

    if (typeof payload.name === "string") {
      const name = payload.name.trim()
      if (name.length < 2) {
        throw new Error("Имя должно содержать минимум 2 символа")
      }
      user.name = name
    }

    if (typeof payload.email === "string") {
      const email = payload.email.trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("Введите корректный email")
      }
      if (email !== user.email) {
        const emailBusy = db.users.some((item) => item.id !== user.id && item.email === email)
        if (emailBusy) {
          throw new Error("Пользователь с таким email уже существует")
        }
        const code = String(Math.floor(100000 + Math.random() * 900000))
        localStorage.setItem(MOCK_EMAIL_CHANGE_CODE_KEY, code)
        profile.pendingEmail = email
        db.notifications.unshift({
          id: Date.now(),
          title: `Код подтверждения email (${code})`,
          time: "Только что",
        })
      }
    }

    if (typeof payload.avatarUrl === "string") {
      user.avatarUrl = payload.avatarUrl.trim().slice(0, 2_000_000)
    }

    if (typeof payload.phone === "string") {
      profile.phone = payload.phone.trim()
    }
    if (typeof payload.bio === "string") {
      profile.bio = payload.bio.trim().slice(0, 280)
    }
    if (typeof payload.timezone === "string") {
      profile.timezone = payload.timezone.trim() || "Europe/Moscow"
    }
    if (typeof payload.language === "string") {
      profile.language = payload.language.trim() || "ru"
    }
    if (typeof payload.emailNotifications === "boolean") {
      profile.emailNotifications = payload.emailNotifications
    }
    if (typeof payload.marketingNotifications === "boolean") {
      profile.marketingNotifications = payload.marketingNotifications
    }

    setDb(db)

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl || "",
      phone: profile.phone,
      bio: profile.bio,
      timezone: profile.timezone,
      language: profile.language,
      emailNotifications: profile.emailNotifications,
      marketingNotifications: profile.marketingNotifications,
      twoFactorEnabled: Boolean(profile.twoFactorEnabled),
      pendingEmail: profile.pendingEmail || null,
      emailChangeRequired: Boolean(profile.pendingEmail),
      devEmailCode: localStorage.getItem(MOCK_EMAIL_CHANGE_CODE_KEY),
    } as T
  }

  if (path.startsWith("/roles-members/")) {
    requireRole(db, ["admin"])
    const id = Number(path.split("/")[2])
    const payload = body as { role?: string }
    const role = String(payload?.role || "").trim()
    const member = db.roleMembers.find((item) => item.id === id)
    if (!member) {
      throw new Error("Участник не найден")
    }

    member.role = role || member.role
    setDb(db)
    return member as T
  }

  if (path.startsWith("/feedback/") && path.endsWith("/status")) {
    const id = Number(path.split("/")[2])
    const item = db.feedback.find((value) => value.id === id)
    if (!item) {
      throw new Error("Обращение не найдено")
    }

    item.status = item.status === "new" ? "in progress" : "closed"
    setDb(db)
    return item as T
  }

  if (path.startsWith("/admin/courses/")) {
    requireRole(db, ["admin"])
    const id = Number(path.split("/")[3])
    const payload = body as { published?: boolean }
    const course = db.courses.find((item) => item.id === id)
    if (!course) {
      throw new Error("Курс не найден")
    }

    if (typeof payload.published === "boolean") {
      course.published = payload.published
    }

    setDb(db)
    return {
      id: course.id,
      published: course.published !== false,
    } as T
  }

  if (path.startsWith("/admin/users/")) {
    requireRole(db, ["admin"])
    const id = Number(path.split("/")[3])
    const payload = body as { role?: Role }
    const user = db.users.find((item) => item.id === id)
    if (!user) {
      throw new Error("Пользователь не найден")
    }

    const role = payload.role
    if (!role || !["student", "teacher", "admin"].includes(role)) {
      throw new Error("Некорректная роль")
    }

    user.role = role
    setDb(db)

    const result: AdminUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    }

    return result as T
  }

  if (path.startsWith("/teacher/courses/")) {
    requireRole(db, ["teacher", "admin"])
    const id = Number(path.split("/")[3])
    const payload = body as { published?: boolean }
    const course = db.courses.find((item) => item.id === id)
    if (!course) {
      throw new Error("Курс не найден")
    }

    if (typeof payload.published === "boolean") {
      course.published = payload.published
    }

    setDb(db)
    return {
      id: course.id,
      published: course.published !== false,
    } as T
  }

  throw new Error("Неизвестный PATCH endpoint")
}

async function handleDelete<T>(path: string): Promise<T> {
  const db = getDb()
  requireAuth(db)

  if (path.startsWith("/account/sessions/")) {
    return { success: true } as T
  }

  if (path.startsWith("/roles-members/")) {
    requireRole(db, ["admin"])
    const id = Number(path.split("/")[2])
    const exists = db.roleMembers.some((item) => item.id === id)
    if (!exists) {
      throw new Error("Участник не найден")
    }

    db.roleMembers = db.roleMembers.filter((item) => item.id !== id)
    setDb(db)
    return { success: true } as T
  }

  if (path.startsWith("/feedback/")) {
    const id = Number(path.split("/")[2])
    const exists = db.feedback.some((item) => item.id === id)
    if (!exists) {
      throw new Error("Обращение не найдено")
    }

    db.feedback = db.feedback.filter((item) => item.id !== id)
    setDb(db)
    return { success: true } as T
  }

  if (path.startsWith("/admin/courses/")) {
    requireRole(db, ["admin"])
    const id = Number(path.split("/")[3])
    const exists = db.courses.some((item) => item.id === id)
    if (!exists) {
      throw new Error("Курс не найден")
    }

    db.courses = db.courses.filter((item) => item.id !== id)
    const deletedStepIds = db.courseSteps.filter((item) => item.courseId === id).map((item) => item.id)
    db.courseSteps = db.courseSteps.filter((item) => item.courseId !== id)
    db.progress = db.progress.filter((item) => item.courseId !== id && !deletedStepIds.includes(item.stepId))

    setDb(db)
    return { success: true } as T
  }

  if (path.startsWith("/admin/users/")) {
    requireRole(db, ["admin"])
    const id = Number(path.split("/")[3])
    const exists = db.users.some((item) => item.id === id)
    if (!exists) {
      throw new Error("Пользователь не найден")
    }

    if (db.currentUserId === id) {
      throw new Error("Нельзя удалить текущий аккаунт")
    }

    db.users = db.users.filter((item) => item.id !== id)
    db.accountProfiles = db.accountProfiles.filter((item) => item.userId !== id)
    setDb(db)
    return { success: true } as T
  }

  throw new Error("Неизвестный DELETE endpoint")
}

async function requestMock<T>(path: string, options?: RequestInit): Promise<T> {
  await delay(400 + Math.floor(Math.random() * 350))

  const method = (options?.method || "GET").toUpperCase()
  const rawBody = options?.body ? JSON.parse(String(options.body)) : undefined

  try {
    if (method === "GET") {
      return await handleGet<T>(path)
    }

    if (method === "POST") {
      return await handlePost<T>(path, rawBody)
    }

    if (method === "PATCH") {
      return await handlePatch<T>(path, rawBody)
    }

    if (method === "DELETE") {
      return await handleDelete<T>(path)
    }

    throw new Error("Метод не поддерживается")
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка запроса"
    throw new Error(message)
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const method = (options?.method || "GET").toUpperCase()
  const rawBody = options?.body ? JSON.parse(String(options.body)) : undefined

  if (canUseBackend()) {
    try {
      if (path === "/auth/login" && method === "POST") {
        const payload = rawBody as { email: string; password: string }
        const auth = await backendRequest<BackendAuthResponse | BackendTwoFactorChallengeResponse>("/auth/login", {
          method: "POST",
          body: JSON.stringify(payload),
        })

        if ((auth as BackendTwoFactorChallengeResponse).requiresTwoFactor) {
          return auth as T
        }

        const success = auth as BackendAuthResponse
        setTokens(success.accessToken, success.refreshToken)
        return toPublicUser(success.user) as T
      }

      if (path === "/auth/2fa/verify" && method === "POST") {
        const payload = rawBody as { challengeId: string; code: string }
        const auth = await backendRequest<BackendAuthResponse>("/auth/2fa/verify", {
          method: "POST",
          body: JSON.stringify(payload),
        })
        setTokens(auth.accessToken, auth.refreshToken)
        return toPublicUser(auth.user) as T
      }

      if (path === "/auth/register" && method === "POST") {
        const payload = rawBody as { name: string; email: string; password: string }
        const auth = await backendRequest<BackendAuthResponse>("/auth/register", {
          method: "POST",
          body: JSON.stringify({
            fullName: payload.name,
            email: payload.email,
            password: payload.password,
          }),
        })
        setTokens(auth.accessToken, auth.refreshToken)
        return toPublicUser(auth.user) as T
      }

      if (path === "/auth/logout" && method === "POST") {
        const refreshToken = getRefreshToken()
        const data = await backendRequest<{ success: boolean }>("/auth/logout", {
          method: "POST",
          body: JSON.stringify({ refreshToken }),
        })
        clearTokens()
        return data as T
      }

      if (path === "/auth/forgot-password" && method === "POST") {
        const payload = rawBody as { email: string }
        const data = await backendRequest<{ success: boolean; message: string }>("/auth/forgot-password", {
          method: "POST",
          body: JSON.stringify(payload),
        })
        return data as T
      }

      if (path === "/auth/reset-password" && method === "POST") {
        const payload = rawBody as { email: string; code: string; password: string }
        const data = await backendRequest<{ success: boolean; message: string }>("/auth/reset-password", {
          method: "POST",
          body: JSON.stringify(payload),
        })
        return data as T
      }

      if (path === "/auth/me" && method === "GET") {
        if (!getAccessToken() && !getRefreshToken()) {
          return null as T
        }
        const user = await backendRequest<BackendUser>("/auth/me", { method: "GET" })
        return toPublicUser(user) as T
      }

      if (path === "/dashboard" && method === "GET") {
        const data = await backendRequest<{
          stats: {
            activeCourses: number
            streakDays: number
            averageScore: string
            tasksWeek: number
          }
          continue: {
            courseId: number
            courseTitle: string
            stepId: number
            stepTitle: string
            stepOrder: number
          } | null
          weeklyPlan: {
            goalSteps: number
            completedSteps: number
            remainingSteps: number
            forecastDays: number
          }
          courses: Array<{ id: number; title: string; progress: number }>
          activities: Array<{ id: number; text: string }>
          deadline: { title: string; text: string }
        }>("/student/dashboard", { method: "GET" })
        return data as T
      }

      if (path === "/student/weekly-goal" && method === "PATCH") {
        const data = await backendRequest<{ goal: number }>("/student/weekly-goal", {
          method: "PATCH",
          body: JSON.stringify(rawBody),
        })
        return data as T
      }

      if (path === "/ai/chat" && method === "POST") {
        const payload = rawBody as { message: string; context?: Array<{ role: string; content: string }> }
        const data = await backendRequest<{ reply: string; model: string }>("/ai/chat", {
          method: "POST",
          body: JSON.stringify(payload),
        })
        return data as T
      }

      if (path === "/account/profile" && method === "GET") {
        const data = await backendRequest<{
          id: number
          name: string
          email: string
          role: Role
          avatarUrl: string
          phone: string
          bio: string
          timezone: string
          language: string
          emailNotifications: boolean
          marketingNotifications: boolean
          twoFactorEnabled?: boolean
          pendingEmail?: string | null
        }>("/account/profile", { method: "GET" })
        return data as T
      }

      if (path === "/account/profile" && method === "PATCH") {
        const payload = rawBody as Record<string, unknown>
        const data = await backendRequest<{
          id: number
          name: string
          email: string
          role: Role
          avatarUrl: string
          phone: string
          bio: string
          timezone: string
          language: string
          emailNotifications: boolean
          marketingNotifications: boolean
          twoFactorEnabled?: boolean
          pendingEmail?: string | null
          emailChangeRequired?: boolean
          devEmailCode?: string | null
        }>("/account/profile", {
          method: "PATCH",
          body: JSON.stringify({
            fullName: payload.name,
            email: payload.email,
            phone: payload.phone,
            bio: payload.bio,
            timezone: payload.timezone,
            language: payload.language,
            emailNotifications: payload.emailNotifications,
            marketingNotifications: payload.marketingNotifications,
            avatarUrl: payload.avatarUrl,
          }),
        })
        return data as T
      }

      if (path === "/account/change-password" && method === "POST") {
        const payload = rawBody as { currentPassword: string; newPassword: string; confirmPassword: string }
        const data = await backendRequest<{ success: boolean; message: string }>("/account/change-password", {
          method: "POST",
          body: JSON.stringify(payload),
        })
        return data as T
      }

      if (path === "/account/confirm-email-change" && method === "POST") {
        const payload = rawBody as { code: string }
        const data = await backendRequest<{ success: boolean; message: string }>("/account/confirm-email-change", {
          method: "POST",
          body: JSON.stringify(payload),
        })
        return data as T
      }

      if (path === "/account/sessions" && method === "GET") {
        const data = await backendRequest<Array<{
          id: number
          userAgent: string
          ipAddress: string
          lastUsedAt: string
          expiresAt: string
          createdAt: string
        }>>("/account/sessions", { method: "GET" })
        return data as T
      }

      if (path.startsWith("/account/sessions/") && method === "DELETE") {
        const id = path.split("/")[3]
        const data = await backendRequest<{ success: boolean }>(`/account/sessions/${id}`, { method: "DELETE" })
        return data as T
      }

      if (path === "/account/logout-all" && method === "POST") {
        const refreshToken = getRefreshToken()
        const data = await backendRequest<{ success: boolean }>("/account/logout-all", {
          method: "POST",
          body: JSON.stringify({ keepCurrentRefreshToken: refreshToken }),
        })
        return data as T
      }

      if (path === "/account/2fa/request-enable" && method === "POST") {
        const data = await backendRequest<{ success: boolean; message: string; devCode?: string | null }>("/account/2fa/request-enable", {
          method: "POST",
          body: JSON.stringify({}),
        })
        return data as T
      }

      if (path === "/account/2fa/confirm-enable" && method === "POST") {
        const payload = rawBody as { code: string }
        const data = await backendRequest<{ success: boolean; message: string }>("/account/2fa/confirm-enable", {
          method: "POST",
          body: JSON.stringify(payload),
        })
        return data as T
      }

      if (path === "/account/2fa/disable" && method === "POST") {
        const payload = rawBody as { password: string }
        const data = await backendRequest<{ success: boolean; message: string }>("/account/2fa/disable", {
          method: "POST",
          body: JSON.stringify(payload),
        })
        return data as T
      }

      if (path === "/courses" && method === "GET") {
        const data = await backendRequest<Array<{
          id: number
          title: string
          category: string
          studentsCount: number
          rating: string | number
          durationHours: number
          teacherName: string | null
          level: string
          priceCents: number
          accessType?: string
        }>>("/catalog", { method: "GET" })

        return data.map(toCourse) as T
      }

      if (path === "/my-progress" && method === "GET") {
        return await backendRequest<T>("/student/my-progress", { method: "GET" })
      }

      if (path === "/landing/stats" && method === "GET") {
        const data = await backendRequest<{
          coursesTotal: number
          studentsTotal: number
          averageRating: number
          communityMembers: number
        }>("/public/stats", { method: "GET" })
        return data as T
      }

      if (/^\/courses\/\d+\/enroll$/.test(path) && method === "POST") {
        const courseId = path.split("/")[2]
        const data = await backendRequest<{ success: boolean }>(`/student/enroll/${courseId}`, {
          method: "POST",
          body: JSON.stringify({}),
        })
        return data as T
      }

      if (/^\/courses\/\d+\/steps$/.test(path) && method === "GET") {
        const courseId = path.split("/")[2]
        const data = await backendRequest<{
          course: {
            id: number
            title: string
            lessons: number
            progress: number
            type: string
            level: string
            author: string
          }
          steps: Array<{
            id: number
            title: string
            kind: "theory" | "quiz" | "code"
            taskTypeLabel?: string
            theoryText: string
            checks?: string[]
            checkCount?: number
            options: string[]
            stepOrder: number
            xp: number
          }>
          progress: Array<{
            stepId: number
            status: "started" | "completed"
            score: number
            attempts: number
            answerText: string
            completedAt: string | null
          }>
          summary: {
            total: number
            completed: number
            xp: number
            percent: number
          }
        }>(`/student/courses/${courseId}/steps`, { method: "GET" })
        return data as T
      }

      if (/^\/steps\/\d+\/check$/.test(path) && method === "POST") {
        const stepId = path.split("/")[2]
        const payload = rawBody as { answer?: string }
        const data = await backendRequest<{
          passed: boolean
          feedback: string
          checkResults?: Array<{
            name: string
            passed: boolean
          }> | null
          progress: {
            stepId: number
            status: "started" | "completed"
            score: number
            attempts: number
            answerText: string
            completedAt: string | null
          } | null
          courseSummary: {
            total: number
            completed: number
            percent: number
          }
        }>(`/student/steps/${stepId}/check`, {
          method: "POST",
          body: JSON.stringify(payload),
        })
        return data as T
      }

      if (/^\/courses\/\d+\/detail$/.test(path) && method === "GET") {
        const courseId = path.split("/")[2]
        const data = await backendRequest<{
          id: number
          title: string
          slug: string
          description: string
          level: string
          category: string
          status: string
          rating: number
          studentsCount: number
          durationHours: number
          priceCents: number
          currency: string
          accessType: string
          coverUrl: string
          teacherName: string
          teacherId: number
          modules: Array<{ id: number; title: string; moduleOrder: number }>
          lessonsCount: number
          stepsCount: number
        }>(`/courses/${courseId}`, { method: "GET" })
        return data as T
      }

      if (/^\/courses\/\d+\/enrollment-status$/.test(path) && method === "GET") {
        const courseId = path.split("/")[2]
        const data = await backendRequest<{
          enrolled: boolean
          status?: string
          progress?: number
          requestStatus?: string | null
          teacherComment?: string | null
        }>(`/student/courses/${courseId}/enrollment-status`, { method: "GET" })
        return data as T
      }

      if (/^\/courses\/\d+\/request-enrollment$/.test(path) && method === "POST") {
        const courseId = path.split("/")[2]
        const payload = rawBody as { message?: string }
        const data = await backendRequest<{
          success: boolean
          message: string
          error?: string
        }>(`/student/courses/${courseId}/request-enrollment`, {
          method: "POST",
          body: JSON.stringify(payload),
        })
        return data as T
      }

      if (/^\/teacher\/courses\/\d+\/enrollment-requests$/.test(path) && method === "GET") {
        const courseId = path.split("/")[3]
        const data = await backendRequest<Array<{
          id: number
          userId: number
          userName: string
          userEmail: string
          status: string
          message: string
          teacherComment: string | null
          createdAt: string
          updatedAt: string
        }>>(`/teacher/courses/${courseId}/enrollment-requests`, { method: "GET" })
        return data as T
      }

      if (/^\/teacher\/enrollment-requests\/\d+$/.test(path) && method === "PATCH") {
        const requestId = path.split("/")[3]
        const payload = rawBody as { status: string; teacherComment?: string }
        const data = await backendRequest<{
          success: boolean
          status: string
        }>(`/teacher/enrollment-requests/${requestId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        })
        return data as T
      }

      if (/^\/teacher\/courses\/\d+\/structure$/.test(path) && method === "GET") {
        const courseId = path.split("/")[3]
        const data = await backendRequest<{
          course: { id: number; title: string }
          modules: Array<{ id: number; title: string; moduleOrder: number }>
          lessons: Array<{ id: number; moduleId: number; title: string; lessonOrder: number; lessonType: string; contentText: string }>
          steps: Array<{ id: number; lessonId: number; title: string; stepOrder: number; stepType: string; content: unknown; xp: number }>
        }>(`/teacher/courses/${courseId}/structure`, { method: "GET" })
        return data as T
      }

      if (path === "/ai-review/check" && method === "POST") {
        const payload = rawBody as { sourceCode: string; language?: string }
        const data = await backendRequest<{
          id: number
          quality: number
          correctness: number
          style: number
          summary: string
          issues: string[]
          improvements: string[]
          goodParts: string[]
          language: string
        }>("/ai/review/check", {
          method: "POST",
          body: JSON.stringify(payload),
        })
        return data as T
      }

      if (path === "/ai-review/history" && method === "GET") {
        const data = await backendRequest<Array<{
          id: number
          quality: number
          correctness: number
          style: number
          summary: string
          createdAt: string
        }>>("/ai/review/history", { method: "GET" })
        return data as T
      }

      if (path === "/ai/insights" && method === "POST") {
        const data = await backendRequest<{
          insights: Array<{ label: string; text: string }>
        }>("/ai/insights", { method: "POST", body: JSON.stringify(rawBody) })
        return data as T
      }

      if (path === "/ai/daily-plan" && method === "POST") {
        const data = await backendRequest<{
          today: string[]
          tomorrow: string[]
        }>("/ai/daily-plan", { method: "POST", body: JSON.stringify(rawBody) })
        return data as T
      }

      if (path === "/ai/faq" && method === "POST") {
        const data = await backendRequest<{ answer: string }>("/ai/faq", {
          method: "POST",
          body: JSON.stringify(rawBody),
        })
        return data as T
      }
    } catch (error) {
      if (path.startsWith("/auth") || path === "/courses" || /^\/courses\/\d+\/(enroll|steps|detail|enrollment-status|request-enrollment)$/.test(path) || /^\/steps\/\d+\/check$/.test(path) || path.startsWith("/account") || path === "/dashboard" || path === "/ai/chat" || path.startsWith("/teacher/") || path.startsWith("/ai-review/") || path.startsWith("/ai/") || path.startsWith("/student/")) {
        throw error
      }
    }
  }

  return requestMock<T>(path, options)
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
}

export type {
  PublicUser,
  Role,
  Course,
  CourseStep,
  StepProgress,
  NotificationItem,
  AiReview,
}
