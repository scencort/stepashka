import { useMemo, useEffect, useRef, type ReactNode } from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "../../context/theme"

type Props = { children: ReactNode }

const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"

/* ============================================================
   Matrix rain — generic code chars fall down like in the movie
   ============================================================ */
const CODE_LINES = [
  // Python — generic algorithms
  "def quicksort(arr):", "  if len(arr) <= 1:", "    return arr", "  pivot = arr[0]",
  "  left = [x for x in arr", "    if x < pivot]", "  return left + [pivot] + right",
  "class BinaryTree:", "  def insert(self, val):", "    if val < self.data:", "      self.left = Node(val)",
  "import hashlib", "h = hashlib.sha256()", "h.update(b'secret')", "h.hexdigest()",
  "def gcd(a, b):", "  while b:", "    a, b = b, a % b", "  return a",
  "for p in range(2, n):", "  if sieve[p]:", "    primes.append(p)",
  "@cache", "def dp(i, j):", "  if i == 0: return j", "  return min(dp(i-1,j)+1)",
  // JavaScript — generic patterns
  "function debounce(fn, ms) {", "  let timer;", "  return (...args) => {",
  "    clearTimeout(timer);", "    timer = setTimeout(fn, ms);", "  };", "}",
  "class EventEmitter {", "  on(evt, cb) {", "    this.listeners[evt].push(cb)", "  }",
  "  emit(evt, data) {", "    for (const cb of this.listeners[evt])", "      cb(data)", "  }", "}",
  "const flatten = (arr) =>", "  arr.reduce((a, b) =>", "    a.concat(Array.isArray(b)", "    ? flatten(b) : b), [])",
  "function throttle(fn, ms) {", "  let last = 0;", "  return (...a) => {",
  "    if (Date.now()-last>ms)", "      { fn(...a); last=Date.now() }", "  }", "}",
  // SQL — generic queries
  "SELECT name, AVG(score)", "FROM exam_results", "GROUP BY name", "HAVING AVG(score)>85;",
  "WITH ranked AS (", "  SELECT *, ROW_NUMBER()", "  OVER(PARTITION BY dept", "  ORDER BY salary DESC) rn",
  ")", "SELECT * FROM ranked", "WHERE rn <= 3;",
  "CREATE INDEX idx_email", "ON accounts(email);",
  // Rust
  "fn binary_search(a: &[i32],", "  target: i32) -> Option<usize> {",
  "  let (mut lo, mut hi) =", "    (0, a.len());",
  "  while lo < hi {", "    let mid = (lo+hi)/2;", "    if a[mid]==target {", "      return Some(mid)", "    }", "  }",
  "impl Iterator for Fib {", "  type Item = u64;", "  fn next(&mut self)", "    -> Option<u64> {",
  // Go
  "func worker(ch <-chan Job) {", "  for job := range ch {", "    process(job)", "  }", "}",
  "func reverse(s string) string {", "  r := []rune(s)", "  for i, j := 0, len(r)-1;",
  "    i < j; i, j = i+1, j-1 {", "    r[i], r[j] = r[j], r[i]", "  }", "  return string(r)", "}",
  // C / C++
  "#include <stdlib.h>", "void* pool_alloc(size_t n) {", "  void* p = malloc(n);", "  return p;", "}",
  "template<typename T>", "T max(T a, T b) {", "  return a > b ? a : b;", "}",
  // DevOps / Infra
  "FROM alpine:3.19", "RUN apk add --no-cache", "  python3 py3-pip", "ENTRYPOINT [\"gunicorn\"]",
  "server {", "  listen 443 ssl;", "  location / {", "    proxy_pass http://app;", "  }", "}",
  "resource \"compute\" {", "  machine_type = \"e2-medium\"", "  zone = \"us-central1-a\"", "}",
  // Math / Science
  "T(n) = 2T(n/2)+O(n)", "O(n log n)", "Θ(1) amort.",
  "f(x) = ax² + bx + c", "∑(i=1..n) = n(n+1)/2",
  "∫₀¹ x² dx = 1/3", "lim(1+1/n)ⁿ = e",
  "E = mc²", "F = ma", "PV = nRT",
  "∇×E = -∂B/∂t", "det(A) = ad - bc",
  // CSS
  ":root {", "  --gap: 1rem;", "  --radius: 0.5rem;", "}",
  "@keyframes fade {", "  from { opacity: 0 }", "  to { opacity: 1 }", "}",
  // Languages
  "Hello World!", "Привет, мир!", "你好世界",
  "Bonjour!", "Hallo Welt!", "こんにちは",
  "¡Hola mundo!", "Ciao mondo!", "Olá mundo!",
]

function useMatrixRain(canvasRef: React.RefObject<HTMLCanvasElement | null>, isDark: boolean) {
  const stateRef = useRef<{ cols: number[]; texts: string[]; dpr: number }>({ cols: [], texts: [], dpr: 1 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let raf = 0
    let last = 0
    const FONT = 10
    const COL_W = FONT * 3.5  // tighter columns = more code
    const ROW_H = FONT + 3
    const FPS = 1000 / 18

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const numCols = Math.floor(w / COL_W)
      stateRef.current = {
        cols: Array.from({ length: numCols }, () => Math.random() * h / ROW_H | 0),
        texts: Array.from({ length: numCols }, () => CODE_LINES[Math.random() * CODE_LINES.length | 0]),
        dpr,
      }
    }

    resize()
    window.addEventListener("resize", resize)

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      if (now - last < FPS) return
      last = now

      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      const { cols, texts } = stateRef.current

      // moderate fade → visible but not overwhelming
      ctx.fillStyle = isDark ? "rgba(2,6,23,0.08)" : "rgba(241,245,249,0.09)"
      ctx.fillRect(0, 0, w, h)

      ctx.font = `${FONT}px ${MONO}`

      for (let i = 0; i < cols.length; i++) {
        const x = i * COL_W + 2
        const y = cols[i] * ROW_H
        const line = texts[i]
        const ci = cols[i] % line.length

        // ─── head ───
        ctx.fillStyle = isDark ? "rgba(251,113,133,0.6)" : "rgba(190,18,60,0.45)"
        ctx.fillText(line.charAt(ci), x, y)

        // ─── trail: 3 chars with fade ───
        for (let t = 1; t <= 3; t++) {
          const a = isDark ? Math.max(0.35 - t * 0.1, 0.04) : Math.max(0.25 - t * 0.07, 0.03)
          ctx.fillStyle = isDark ? `rgba(148,163,184,${a})` : `rgba(51,65,85,${a})`
          ctx.fillText(line.charAt((ci - t + line.length) % line.length), x, y - t * ROW_H)
        }

        cols[i]++
        if (y > h && Math.random() > 0.94) {
          cols[i] = 0
          texts[i] = CODE_LINES[Math.random() * CODE_LINES.length | 0]
        }
      }
    }

    raf = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize) }
  }, [canvasRef, isDark])
}

/* ============================================================
   Chaotic code snippets — scattered across the screen
   ============================================================ */
type Snippet = { text: string; left: string; top: string; vis: "all" | "sm" | "md" | "lg"; rotate?: number }

const SNIPPETS: Snippet[] = [
  { left: "1%", top: "2%", vis: "all", rotate: -2, text: `def quicksort(arr):\n  if len(arr) <= 1:\n    return arr\n  pivot = arr[0]\n  left = [x for x in arr\n    if x < pivot]\n  return left+[pivot]+right` },
  { left: "24%", top: "5%", vis: "md", rotate: 1.5, text: `class EventEmitter {\n  listeners = {}\n  on(evt, cb) {\n    this.listeners[evt]\n      .push(cb)\n  }\n  emit(evt, data) {\n    for (const cb of\n      this.listeners[evt])\n      cb(data)\n  }\n}` },
  { left: "48%", top: "1%", vis: "sm", rotate: -1, text: `# Алгоритмы\n## Сложность\n- O(1) — константа\n- O(log n) — логарифм\n- O(n) — линейная\n- O(n²) — квадратичная` },
  { left: "66%", top: "6%", vis: "md", rotate: 2, text: `fn binary_search(\n  a: &[i32], t: i32\n) -> Option<usize> {\n  let (lo, hi) = (0, a.len());\n  while lo < hi {\n    let mid = (lo+hi)/2;\n    if a[mid]==t {\n      return Some(mid)\n    }\n  }\n  None\n}` },
  { left: "82%", top: "2%", vis: "all", rotate: -1.5, text: `WITH ranked AS (\n  SELECT *,\n    ROW_NUMBER() OVER(\n    PARTITION BY dept\n    ORDER BY salary DESC\n  ) AS rn\n)\nSELECT * FROM ranked\nWHERE rn <= 3;` },

  { left: "3%", top: "22%", vis: "md", rotate: 1, text: `:root {\n  --bg: #0f172a;\n  --text: #e2e8f0;\n  --radius: 0.5rem;\n}\n@keyframes fade {\n  from { opacity: 0 }\n  to { opacity: 1 }\n}` },
  { left: "18%", top: "26%", vis: "lg", rotate: -2.5, text: `server {\n  listen 443 ssl;\n  server_name api.example.com;\n  location / {\n    proxy_pass\n      http://127.0.0.1:8000;\n    proxy_set_header\n      X-Real-IP $remote_addr;\n  }\n}` },
  { left: "42%", top: "20%", vis: "all", rotate: 0.5, text: `∫₀¹ x² dx = 1/3\nlim(1+1/n)ⁿ = e\n∇×E = -∂B/∂t\ndet(A) = ad - bc\nΔx·Δp ≥ ℏ/2` },
  { left: "61%", top: "24%", vis: "lg", rotate: -1, text: `func worker(\n  ch <-chan Job,\n) {\n  for job := range ch {\n    result := process(job)\n    out <- result\n  }\n}\n\nfor i := 0; i < 4; i++ {\n  go worker(jobs)\n}` },
  { left: "80%", top: "19%", vis: "md", rotate: 2.5, text: `impl Iterator for Fib {\n  type Item = u64;\n  fn next(&mut self)\n    -> Option<u64> {\n    let val = self.a;\n    self.a = self.b;\n    self.b = val + self.b;\n    Some(val)\n  }\n}` },

  { left: "1%", top: "42%", vis: "all", rotate: -1.5, text: `function debounce(fn, ms) {\n  let timer;\n  return (...args) => {\n    clearTimeout(timer);\n    timer = setTimeout(\n      () => fn(...args), ms\n    );\n  };\n}` },
  { left: "20%", top: "46%", vis: "lg", rotate: 1, text: `resource "aws_instance" {\n  ami = "ami-0c55b159"\n  instance_type = "t3.micro"\n  tags = {\n    Name = "web-server"\n    Env  = "production"\n  }\n}` },
  { left: "45%", top: "40%", vis: "md", rotate: -2, text: `FROM alpine:3.19\nRUN apk add --no-cache \\\\\n  python3 py3-pip\nCOPY . /app\nWORKDIR /app\nRUN pip install -r req.txt\nEXPOSE 8000\nENTRYPOINT ["gunicorn"]` },
  { left: "65%", top: "44%", vis: "lg", rotate: 2, text: `public class BFS {\n  void search(Node root) {\n    Queue<Node> q =\n      new LinkedList<>();\n    q.add(root);\n    while (!q.isEmpty()) {\n      Node n = q.poll();\n      visit(n);\n      for (Node c : n.adj)\n        q.add(c);\n    }\n  }\n}` },
  { left: "83%", top: "41%", vis: "all", rotate: -0.5, text: `def gcd(a, b):\n  while b:\n    a, b = b, a % b\n  return a\n\ndef lcm(a, b):\n  return a * b // gcd(a, b)` },

  { left: "2%", top: "62%", vis: "md", rotate: 2, text: `template<typename T>\nclass Stack {\n  vector<T> data;\npublic:\n  void push(T val) {\n    data.push_back(val);\n  }\n  T pop() {\n    T v = data.back();\n    data.pop_back();\n    return v;\n  }\n};` },
  { left: "22%", top: "66%", vis: "lg", rotate: -1.5, text: `SELECT name,\n  AVG(score) AS avg_s,\n  COUNT(*) AS total\nFROM exam_results\nGROUP BY name\nHAVING AVG(score) > 85\nORDER BY avg_s DESC\nLIMIT 10;` },
  { left: "46%", top: "60%", vis: "all", rotate: 1, text: `Hello World!\nПривет, мир!\n你好世界\nBonjour le monde!\nHallo Welt!\nこんにちは世界\n¡Hola mundo!\nOlá mundo!` },
  { left: "68%", top: "64%", vis: "lg", rotate: -2, text: `@cache\ndef dp(i, w):\n  if i == 0 or w == 0:\n    return 0\n  if wt[i] > w:\n    return dp(i-1, w)\n  return max(\n    dp(i-1, w),\n    val[i] + dp(i-1, w-wt[i])\n  )` },
  { left: "84%", top: "61%", vis: "md", rotate: 1.5, text: `func reverse(s string) string {\n  r := []rune(s)\n  for i, j := 0,\n    len(r)-1; i < j;\n    i, j = i+1, j-1 {\n    r[i], r[j] = r[j], r[i]\n  }\n  return string(r)\n}` },

  { left: "1%", top: "82%", vis: "all", rotate: -1, text: `git log --graph --oneline\n* a3f21b8 refactor\n* 9c1e4d2 add tests\n* d7b03a1 initial\n\ngit rebase -i HEAD~3` },
  { left: "19%", top: "85%", vis: "md", rotate: 2, text: `class LRUCache:\n  def __init__(self, cap):\n    self.cap = cap\n    self.cache = OrderedDict()\n  def get(self, key):\n    self.cache.move_to_end(key)\n    return self.cache[key]` },
  { left: "44%", top: "81%", vis: "sm", rotate: -0.5, text: `E = mc²\nF = ma\nPV = nRT\nv = v₀ + at\ns = v₀t + ½at²\nω = 2πf` },
  { left: "63%", top: "84%", vis: "md", rotate: 1.5, text: `const flatten = (arr) =>\n  arr.reduce((acc, val) =>\n    acc.concat(\n      Array.isArray(val)\n        ? flatten(val)\n        : val\n    ), []);\n\nflatten([1,[2,[3]]])\n// => [1, 2, 3]` },
  { left: "82%", top: "82%", vis: "all", rotate: -2, text: `apiVersion: apps/v1\nkind: Deployment\nspec:\n  replicas: 3\n  template:\n    containers:\n    - name: web\n      image: app:1.2\n      ports:\n      - 8080` },
]

function TypewriterCell({ text, left, top, vis, rotate, delay }: Snippet & { delay: number }) {
  const ref = useRef<HTMLPreElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.textContent = ""
    let i = 0
    let timeout: ReturnType<typeof setTimeout>
    const type = () => {
      if (i < text.length) {
        el.textContent = text.slice(0, i + 1)
        i++
        timeout = setTimeout(type, 12 + Math.random() * 20)
      }
    }
    timeout = setTimeout(type, delay)
    return () => clearTimeout(timeout)
  }, [text, delay])

  const visCls =
    vis === "all" ? "" :
    vis === "sm" ? "hidden sm:block" :
    vis === "md" ? "hidden md:block" :
    "hidden lg:block"

  return (
    <pre
      ref={ref}
      className={`absolute font-mono select-none whitespace-pre leading-[1.55] text-[8px] sm:text-[9px] md:text-[10px] text-slate-700/70 dark:text-slate-300/40 ${visCls}`}
      style={{ left, top, maxWidth: "18%", transform: rotate ? `rotate(${rotate}deg)` : undefined }}
    />
  )
}

export default function AuthScreenShell({ children }: Props) {
  const { theme, toggleTheme } = useTheme()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDark = theme === "dark"

  useMatrixRain(canvasRef, isDark)

  const tint = useMemo(() => {
    const tints = [
      { a: "rgba(244,63,94,0.18)", b: "rgba(59,130,246,0.14)", da: "rgba(244,63,94,0.24)", db: "rgba(59,130,246,0.20)", stroke: ["text-rose-500/20","text-sky-500/20"] },
      { a: "rgba(16,185,129,0.15)", b: "rgba(244,114,182,0.13)", da: "rgba(16,185,129,0.22)", db: "rgba(244,114,182,0.20)", stroke: ["text-emerald-500/20","text-pink-500/20"] },
      { a: "rgba(14,165,233,0.16)", b: "rgba(251,146,60,0.13)", da: "rgba(14,165,233,0.22)", db: "rgba(251,146,60,0.20)", stroke: ["text-sky-500/20","text-orange-500/20"] },
    ]
    return tints[Math.floor(Math.random() * tints.length)]
  }, [])

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden bg-slate-100/70 dark:bg-slate-950">
      {/* ---------- background layer ---------- */}
      <div className="pointer-events-none absolute inset-0">

        {/* matrix rain canvas */}
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

        {/* radial colour overlay */}
        <div
          className="absolute inset-0"
          style={{ background: `radial-gradient(circle at 12% 20%,${tint.a},transparent 34%),radial-gradient(circle at 83% 78%,${tint.b},transparent 36%)` }}
        />
        <div
          className="absolute inset-0 hidden dark:block"
          style={{ background: `radial-gradient(circle at 12% 20%,${tint.da},transparent 36%),radial-gradient(circle at 83% 78%,${tint.db},transparent 36%),linear-gradient(120deg,rgba(2,6,23,0.35),rgba(15,23,42,0.3))` }}
        />

        {/* chaotic typewriter snippets */}
        {SNIPPETS.map((s, i) => (
          <TypewriterCell key={i} {...s} delay={i * 180 + 50} />
        ))}

        {/* dot grid */}
        <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.035]" style={{ backgroundImage: "radial-gradient(circle,currentColor 1px,transparent 1px)", backgroundSize: "24px 24px" }} />

        {/* SVG curves */}
        <svg className="absolute inset-0 h-full w-full opacity-15 dark:opacity-10" viewBox="0 0 1200 800" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 165 C180 120,290 285,470 238 C680 185,790 88,1200 205" fill="none" stroke="currentColor" className={tint.stroke[0]} strokeWidth="1.2" />
          <path d="M0 540 C180 620,360 450,560 525 C760 598,930 445,1200 548" fill="none" stroke="currentColor" className={tint.stroke[1]} strokeWidth="1.2" />
        </svg>
      </div>

      {/* ---------- theme toggle ---------- */}
      <button
        type="button"
        onClick={toggleTheme}
        className="absolute right-4 top-4 md:right-6 md:top-6 z-20 inline-flex items-center gap-2 rounded-xl border border-slate-300/70 dark:border-slate-700/80 bg-white/90 dark:bg-slate-900/85 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm"
        aria-label="Сменить тему"
      >
        {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        {theme === "dark" ? "Светлая тема" : "Тёмная тема"}
      </button>

      {children}
    </div>
  )
}
