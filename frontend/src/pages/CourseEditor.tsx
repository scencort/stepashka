// редактор курсов — трёхшаговый wizard для создания и редактирования курсов
// шаг 1: основная информация (название, уровень, цена, обложка)
// шаг 2: структура курса (модули → уроки → шаги)
// шаг 3: публикация (черновик или отправить на модерацию)
// при редактировании загружает существующую структуру курса с бэкенда
//
// КАК РАБОТАЕТ WIZARD (многошаговая форма):
//   step: 1 | 2 | 3 — текущий шаг хранится в useState
//   "Далее" → setStep(s => s + 1), "Назад" → setStep(s => s - 1)
//   JSX рендерит только нужный шаг: {step === 1 && <ШагОсновнойИнформации />}
//   данные всех шагов хранятся в стейте одновременно — не сбрасываются при переходе
//
// ИЕРАРХИЯ ДАННЫХ КУРСА:
//   Course → Module[] → Lesson[] → Step[]
//   каждый уровень имеет свой порядок (moduleOrder, lessonOrder, stepOrder)
//   при сохранении вся структура отправляется одним большим объектом на сервер
//
// КАК РАБОТАЮТ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ:
//   slugify(title) — авто-генерация URL-слага из названия при наборе текста
//   emptyStep/emptyLesson/emptyModule — фабрики для создания пустых элементов структуры
//   virtualLesson() — UI-обёртка с id=-1 для шагов без явного урока
//
// КАСТОМНЫЙ SELECT (CustomSelect<T>):
//   дженерик T extends string — TypeScript гарантирует что value совпадает с типом опций
//   открывается/закрывается через useState(false), закрывается кликом вне через mousedown
//   заменяет нативный <select> для красивого отображения иконок и цветов
import { useEffect, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import MainLayout from "../layout/MainLayout"
import Card from "../components/ui/Card"
import Button from "../components/ui/Button"
import Skeleton from "../components/ui/Skeleton"

import { api } from "../lib/api"
import { useToast } from "../hooks/useToast"
import { ChevronRight, ChevronLeft, Plus, Trash2, GripVertical, BookOpen, FileQuestion, Code2, Check, PenLine, HelpCircle, ChevronDown, ImagePlus, X, Loader2, Sprout, Flame, Zap, Palette, Megaphone, Briefcase, BarChart2, Globe, Sparkles, Unlock, ClipboardList, Lock, Trophy } from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type CourseLevel = "beginner" | "intermediate" | "advanced"
type CourseCategory = "programming" | "design" | "marketing" | "business" | "data_science" | "languages" | "other"
type AccessType = "open" | "moderated" | "invite_only"

type BasicInfo = {
  title: string
  slug: string
  description: string
  level: CourseLevel
  category: CourseCategory
  priceCents: number
  accessType: AccessType
  coverUrl: string
}

type Module = {
  id?: number
  title: string
  moduleOrder: number
  lessons: Lesson[]
}

type Lesson = {
  id?: number
  title: string
  lessonOrder: number
  lessonType: "text" | "video"
  contentText: string
  steps: Step[]
}

type StepType = "theory" | "quiz" | "code" | "essay"

type QuizOption = { text: string; correct: boolean }

type TestCase =
  | { type: "io";               description: string; input: string; expectedOutput: string }
  | { type: "regex";            description: string; pattern: string }
  | { type: "includesAll";      description: string; tokens: string }
  | { type: "outputContainsLine"; description: string; pattern: string; input?: string }
  | { type: "outputLineCount";  description: string; min: number; input?: string }

type Step = {
  id?: number
  title: string
  stepOrder: number
  stepType: StepType
  xp: number
  content: {
    text?: string
    options?: QuizOption[]
    correctIndex?: number
    taskDescription?: string
    starterCode?: string
    tests?: TestCase[]
    essayKeywords?: string
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LEVELS: Array<{ value: CourseLevel; label: string; icon: React.ReactNode; color: string }> = [
  { value: "beginner",     label: "Начинающий",  icon: <Sprout size={16} />, color: "text-emerald-600 dark:text-emerald-400" },
  { value: "intermediate", label: "Средний",     icon: <Flame  size={16} />, color: "text-amber-600 dark:text-amber-400" },
  { value: "advanced",     label: "Продвинутый", icon: <Trophy size={16} />, color: "text-rose-600 dark:text-rose-400" },
]

const CATEGORIES: Array<{ value: CourseCategory; label: string; icon: React.ReactNode }> = [
  { value: "programming", label: "Программирование", icon: <Code2      size={16} /> },
  { value: "design",      label: "Дизайн",           icon: <Palette    size={16} /> },
  { value: "marketing",   label: "Маркетинг",        icon: <Megaphone  size={16} /> },
  { value: "business",    label: "Бизнес",           icon: <Briefcase  size={16} /> },
  { value: "data_science",label: "Data Science",     icon: <BarChart2  size={16} /> },
  { value: "languages",   label: "Языки",            icon: <Globe      size={16} /> },
  { value: "other",       label: "Другое",           icon: <Sparkles   size={16} /> },
]

const ACCESS_TYPES: Array<{ value: AccessType; label: string; desc: string; icon: React.ReactNode; color: string }> = [
  { value: "open",        label: "Открытый",       desc: "Любой желающий может записаться",      icon: <Unlock        size={20} />, color: "emerald" },
  { value: "moderated",   label: "По заявке",       desc: "Студент подает заявку, вы одобряете",  icon: <ClipboardList size={20} />, color: "amber"   },
  { value: "invite_only", label: "По приглашению",  desc: "Только по вашему приглашению",         icon: <Lock          size={20} />, color: "violet"  },
]

const STEP_ICONS: Record<StepType, React.ReactNode> = {
  theory: <BookOpen size={14} />,
  quiz: <FileQuestion size={14} />,
  code: <Code2 size={14} />,
  essay: <PenLine size={14} />,
}

const STEP_LABELS: Record<StepType, string> = {
  theory: "Теория",
  quiz: "Тест",
  code: "Код",
  essay: "Эссе (сочинение)",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// превращает произвольный заголовок в url-совместимый slug
// @param str — любая строка, например "Мой первый курс по Python!"
// @returns slug вида "moi-pervyi-kurs-po-python", максимум 64 символа
// шаги: toLowerCase → убрать спецсимволы → пробелы/подчёркивания → тире → trim тире
function slugify(str: string) {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")   // убираем всё кроме букв, цифр, пробелов, тире
    .replace(/[\s_]+/g, "-")    // пробелы и _ заменяем на тире
    .replace(/^-+|-+$/g, "")   // убираем тире в начале и конце
    .slice(0, 64)               // ограничиваем длину
}

// создаёт пустой шаг с дефолтными значениями
// @param order — порядковый номер шага в уроке (начиная с 1)
// @returns Step с типом "theory", 10 xp, пустым текстом
// вызывается при добавлении нового шага кнопкой "Добавить шаг"
function emptyStep(order: number): Step {
  return {
    title: `Шаг ${order}`,
    stepOrder: order,
    stepType: "theory",
    xp: 10,
    content: { text: "" },
  }
}

// создаёт пустой урок с одним пустым шагом внутри
// @param order — порядковый номер урока в модуле
// @returns Lesson типа "text" с одним emptyStep(1) внутри
function emptyLesson(order: number): Lesson {
  return {
    title: `Урок ${order}`,
    lessonOrder: order,
    lessonType: "text",
    contentText: "",
    steps: [emptyStep(1)],
  }
}

// виртуальный урок — контейнер для шагов без явного урока
// id: -1 означает что это не реальная запись в БД, а UI-обёртка
// используется когда преподаватель хочет добавить шаги напрямую в модуль без уроков
// @returns Lesson-подобный объект с id=-1 и пустым массивом шагов
function virtualLesson(): Lesson {
  return {
    id: -1,
    title: "Шаги",
    lessonOrder: 1,
    lessonType: "text",
    contentText: "",
    steps: [],
  }
}

// создаёт пустой модуль с одним виртуальным уроком внутри
// @param order — порядковый номер модуля в курсе
// @returns Module с одним virtualLesson() — готов к добавлению шагов
function emptyModule(order: number): Module {
  return {
    title: `Модуль ${order}`,
    moduleOrder: order,
    lessons: [virtualLesson()],
  }
}

// ─── Custom Select ────────────────────────────────────────────────────────────

// кастомный дропдаун с иконками — заменяет нативный <select>
// дженерик T extends string чтобы тип value и onChange совпадали с типом опций
// закрывается при клике вне компонента через mousedown на document
//
// @param value — текущее выбранное значение (например "beginner")
// @param onChange(v: T) — колбек вызывается когда пользователь выбирает опцию
// @param options — массив { value, label, icon?, desc?, color? }
// @param label — подпись над кнопкой (опционально)
function CustomSelect<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (v: T) => void
  options: Array<{ value: T; label: string; icon?: React.ReactNode; desc?: string; color?: string }>
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      {label && <label className="text-sm font-medium mb-1 block">{label}</label>}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all text-left text-sm
          bg-[var(--surface)] text-[var(--text)]
          ${open
            ? "border-primary ring-2 ring-primary/20"
            : "border-[var(--border)] hover:border-primary/50"
          }`}
      >
        {selected?.icon && (
          <span className={`shrink-0 flex items-center ${selected.color || "text-[var(--muted)]"}`}>
            {selected.icon}
          </span>
        )}
        <span className={`flex-1 font-medium ${selected?.color || ""}`}>{selected?.label ?? "Выберите..."}</span>
        <ChevronDown size={15} className={`shrink-0 text-[var(--muted)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] shadow-xl overflow-hidden">
          {options.map((opt) => {
            const isActive = opt.value === value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false) }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors
                  ${isActive
                    ? "bg-primary/10 text-primary"
                    : "text-[var(--text)] hover:bg-[var(--surface)]"
                  }`}
              >
                {opt.icon && (
                  <span className={`shrink-0 flex items-center ${isActive ? "text-primary" : opt.color || "text-[var(--muted)]"}`}>
                    {opt.icon}
                  </span>
                )}
                <span className="flex-1">
                  <span className={`font-medium block ${isActive ? "text-primary" : opt.color || ""}`}>{opt.label}</span>
                  {opt.desc && <span className="text-xs text-[var(--muted)]">{opt.desc}</span>}
                </span>
                {isActive && <Check size={14} className="shrink-0 text-primary" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Regex cheat sheet ────────────────────────────────────────────────────────

const REGEX_CHEAT = [
  {
    group: "Буквы и цифры",
    items: [
      { pat: "\\w",        desc: "Любая буква, цифра или _" },
      { pat: "\\d",        desc: "Любая цифра (0–9)" },
      { pat: "\\s",        desc: "Пробел, таб, перенос строки" },
      { pat: "[abc]",      desc: "Один из символов: a, b или c" },
      { pat: "[а-яё]",     desc: "Любая строчная русская буква" },
    ],
  },
  {
    group: "Количество",
    items: [
      { pat: "*",          desc: "0 или больше (любое кол-во)" },
      { pat: "+",          desc: "1 или больше (хотя бы один)" },
      { pat: "?",          desc: "0 или 1 (необязательный)" },
      { pat: "{3}",        desc: "Ровно 3 раза" },
      { pat: "{2,5}",      desc: "От 2 до 5 раз" },
    ],
  },
  {
    group: "Позиция",
    items: [
      { pat: "^",          desc: "Начало строки" },
      { pat: "$",          desc: "Конец строки" },
    ],
  },
  {
    group: "Спецсимволы",
    items: [
      { pat: ".",          desc: "Любой один символ" },
      { pat: "\\(",        desc: "Буквальная скобка ( — ставьте \\ перед (, ), [, ] и т.д." },
      { pat: "(A|B)",      desc: "A или B" },
    ],
  },
]

const REGEX_EXAMPLES = [
  { label: "Функция def",       pat: "def \\w+\\(.*\\):",    hint: "Определение любой функции" },
  { label: "Вызов print()",     pat: "print\\(",              hint: "Код вызывает print" },
  { label: "Импорт модуля",     pat: "import \\w+",           hint: "Любой import" },
  { label: "Класс",             pat: "class \\w+",            hint: "Объявление класса" },
  { label: "Цикл for",          pat: "for .+ in .+:",         hint: "Любой цикл for" },
  { label: "Цикл while",        pat: "while .+:",             hint: "Любой цикл while" },
  { label: "Условие if",        pat: "if .+:",                hint: "Любое условие if" },
  { label: "return",            pat: "return ",               hint: "Функция что-то возвращает" },
  { label: "try/except",        pat: "try:|except",           hint: "Обработка ошибок" },
  { label: "f-строка",          pat: 'f["\']',               hint: "Используется f-string" },
]

export function _RegexField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--muted)] shrink-0">Паттерн:</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={"def \\w+\\(.*\\):"}
          className="input-field text-xs py-1 font-mono flex-1"
        />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors shrink-0 ${
            open
              ? "border-violet-400 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300"
              : "border-[var(--border)] text-[var(--muted)] hover:border-violet-400 hover:text-violet-600"
          }`}
          title="Шпаргалка по регулярным выражениям"
        >
          <HelpCircle size={12} />
          Шпаргалка
          <ChevronDown size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open && (
        <div className="rounded-xl border border-violet-200 dark:border-violet-800/50 bg-violet-50/60 dark:bg-violet-900/20 overflow-hidden text-xs">
          {/* Header */}
          <div className="px-4 py-2.5 border-b border-violet-200 dark:border-violet-800/50 bg-violet-100/60 dark:bg-violet-900/40">
            <p className="font-semibold text-violet-800 dark:text-violet-200">🔬 Шпаргалка по Regex</p>
            <p className="text-violet-600 dark:text-violet-400 text-[11px] mt-0.5">Паттерн ищется в тексте кода студента. Нажмите на пример — он вставится в поле.</p>
          </div>

          {/* Quick examples */}
          <div className="px-4 py-3 border-b border-violet-200 dark:border-violet-800/50 space-y-1.5">
            <p className="font-semibold text-violet-700 dark:text-violet-300 mb-2">✨ Готовые примеры — кликните чтобы использовать</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {REGEX_EXAMPLES.map((ex) => (
                <button
                  key={ex.pat}
                  type="button"
                  onClick={() => onChange(ex.pat)}
                  className={`flex items-start gap-2 text-left px-2.5 py-1.5 rounded-lg border transition-colors ${
                    value === ex.pat
                      ? "border-violet-400 bg-violet-200/60 dark:bg-violet-800/50"
                      : "border-violet-200 dark:border-violet-700/50 hover:border-violet-400 hover:bg-violet-100 dark:hover:bg-violet-800/40"
                  }`}
                >
                  <code className="font-mono text-[11px] text-rose-600 dark:text-rose-400 shrink-0 mt-0.5">{ex.pat}</code>
                  <span className="text-violet-700 dark:text-violet-300 text-[11px] leading-tight">
                    <span className="font-medium">{ex.label}</span>
                    <span className="text-violet-500 dark:text-violet-400"> — {ex.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Reference table */}
          <div className="px-4 py-3 space-y-3">
            <p className="font-semibold text-violet-700 dark:text-violet-300">📖 Основные символы</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              {REGEX_CHEAT.map((group) => (
                <div key={group.group}>
                  <p className="text-[11px] font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide mb-1.5">{group.group}</p>
                  <div className="space-y-1">
                    {group.items.map((item) => (
                      <div key={item.pat} className="flex items-baseline gap-2">
                        <code
                          className="font-mono text-[11px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 px-1.5 py-0.5 rounded shrink-0 cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors"
                          title="Вставить"
                          onClick={() => onChange((value ? value + item.pat : item.pat))}
                        >
                          {item.pat}
                        </code>
                        <span className="text-violet-700 dark:text-violet-300 text-[11px]">{item.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tip */}
          <div className="px-4 py-2.5 border-t border-violet-200 dark:border-violet-800/50 bg-violet-100/40 dark:bg-violet-900/30">
            <p className="text-[11px] text-violet-600 dark:text-violet-400">
              💡 <strong>Совет:</strong> если не уверены — используйте готовые примеры выше. Для проверки наличия слова просто напишите его как есть: <code className="font-mono bg-violet-100 dark:bg-violet-800/50 px-1 rounded">return</code> найдёт любой код с return.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

// редактор одного шага — аккордеон с выбором типа и содержимым
// типы: theory (текст markdown), quiz (вопрос + варианты), code (задача + тесты), essay (сочинение)
function StepEditor({
  step,
  onChange,
  onDelete,
}: {
  step: Step
  onChange: (s: Step) => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  const updateContent = (patch: Partial<Step["content"]>) => {
    onChange({ ...step, content: { ...step.content, ...patch } })
  }

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div
        className="flex items-center gap-2 px-3 py-2.5 bg-white/60 dark:bg-zinc-800/60 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <GripVertical size={14} className="text-slate-400 shrink-0" />
        <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-slate-300">
          {STEP_ICONS[step.stepType]}
          {STEP_LABELS[step.stepType]}
        </span>
        <input
          value={step.title}
          onChange={(e) => onChange({ ...step, title: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 bg-white dark:bg-zinc-700/60 border border-slate-200 dark:border-zinc-600 rounded-lg px-2 py-0.5 text-sm font-medium outline-none focus:border-rose-400 dark:focus:border-rose-500 transition-colors min-w-0"
          placeholder="Название шага"
        />
        <span className="text-xs text-slate-400 shrink-0">{step.xp} XP</span>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="shrink-0 text-slate-400 hover:text-rose-500 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>


        {expanded && (
          <div



            className="overflow-hidden"
          >
            <div className="p-3 space-y-3 border-t border-slate-100 dark:border-slate-700">
              <div className="flex flex-wrap gap-2">
                {(["theory", "quiz", "code", "essay"] as StepType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => onChange({ ...step, stepType: t, content: {} })}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-all ${
                      step.stepType === t
                        ? "bg-rose-600 text-white border-rose-600"
                        : "border-slate-200 dark:border-slate-700 hover:border-rose-400"
                    }`}
                  >
                    {STEP_ICONS[t]} {STEP_LABELS[t]}
                  </button>
                ))}
                <div className="ml-auto flex items-center gap-1">
                  <span className="text-xs text-slate-500">XP:</span>
                  <input
                    type="number"
                    value={step.xp}
                    onChange={(e) => onChange({ ...step, xp: Number(e.target.value) })}
                    className="w-14 text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 bg-transparent"
                    min={0}
                    max={100}
                  />
                </div>
              </div>

              {step.stepType === "theory" && (
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">
                    Текст теории{" "}
                    <span className="text-slate-400 font-normal">(поддерживается Markdown: **жирный**, `код`, ## заголовок)</span>
                  </label>
                  <textarea
                    value={step.content.text || ""}
                    onChange={(e) => updateContent({ text: e.target.value })}
                    rows={8}
                    placeholder={"## Что такое список в Python?\n\nСписок — это упорядоченная коллекция элементов.\n\n```python\nmy_list = [1, 2, 3]\nmy_list.append(4)  # добавляем элемент\nprint(my_list)     # [1, 2, 3, 4]\n```\n\nСписки изменяемы и могут содержать элементы разных типов."}
                    className="input-field text-sm w-full resize-y font-mono"
                  />
                </div>
              )}

              {step.stepType === "quiz" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Вопрос</label>
                    <textarea
                      value={step.content.text || ""}
                      onChange={(e) => updateContent({ text: e.target.value })}
                      rows={2}
                      placeholder="Например: Какой метод используется для добавления элемента в конец списка в Python?"
                      className="input-field text-sm w-full"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-slate-500">
                        Варианты ответа —{" "}
                        <span className="text-emerald-600 font-medium">нажмите на кружок рядом с правильным</span>
                      </label>
                      {(step.content.options || []).length > 0 && !(step.content.options || []).some(o => o.correct) && (
                        <span className="text-xs font-semibold text-rose-500 bg-rose-50 dark:bg-rose-900/20 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-800/40">
                          ⚠ Правильный ответ не выбран
                        </span>
                      )}
                    </div>
                    <div className="space-y-2">
                      {(step.content.options && step.content.options.length > 0
                        ? step.content.options
                        : [{ text: "", correct: true }, { text: "", correct: false }]
                      ).map((opt, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <button
                              title={opt.correct ? "Правильный ответ" : "Отметить как правильный"}
                              onClick={() => {
                                // immutable update — create new objects so React re-renders
                                const opts = (step.content.options || []).map((o, i) => ({ ...o, correct: i === idx }))
                                updateContent({ options: opts, correctIndex: idx })
                              }}
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                                opt.correct
                                  ? "border-emerald-500 bg-emerald-500 text-white"
                                  : "border-slate-300 dark:border-slate-600 hover:border-emerald-400"
                              }`}
                            >
                              {opt.correct && <Check size={10} />}
                            </button>
                            <input
                              value={opt.text}
                              onChange={(e) => {
                                const opts = (step.content.options || []).map((o, i) =>
                                  i === idx ? { ...o, text: e.target.value } : o
                                )
                                updateContent({ options: opts })
                              }}
                              placeholder={`Вариант ${idx + 1}${idx === 0 ? " (например: append)" : idx === 1 ? " (например: push)" : ""}`}
                              className="flex-1 input-field text-sm py-1.5"
                            />
                            <button
                              onClick={() => {
                                const opts = (step.content.options || []).filter((_, i) => i !== idx)
                                updateContent({ options: opts })
                              }}
                              className="text-slate-400 hover:text-rose-500 transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )
                      )}
                      <Button
                        variant="outline"
                        onClick={() => {
                          const opts = [...(step.content.options || []), { text: "", correct: false }]
                          updateContent({ options: opts })
                        }}
                      >
                        <Plus size={12} className="mr-1" /> Добавить вариант
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {step.stepType === "code" && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Условие задачи</label>
                    <textarea
                      value={step.content.taskDescription || ""}
                      onChange={(e) => updateContent({ taskDescription: e.target.value })}
                      rows={3}
                      placeholder="Например: Создайте переменные name, age, height и выведите их через print()."
                      className="input-field text-sm w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Стартовый код (необязательно)</label>
                    <textarea
                      value={step.content.starterCode || ""}
                      onChange={(e) => updateContent({ starterCode: e.target.value })}
                      rows={3}
                      placeholder={"# Напишите ваш код здесь\n"}
                      className="input-field text-sm w-full font-mono"
                    />
                  </div>

                  {/* Checks */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-[var(--text)]">
                        Проверки
                        <span className="ml-1.5 font-normal text-[var(--muted)]">
                          {(step.content.tests || []).length === 0 ? "— нет" : `(${(step.content.tests || []).length})`}
                        </span>
                      </label>
                      <span className="flex items-center gap-1 text-[10px] font-medium text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 px-2 py-0.5 rounded-full border border-violet-200 dark:border-violet-800/40">
                        🤖 AI всегда проверяет код
                      </span>
                    </div>

                    {(step.content.tests || []).map((test, idx) => {
                      const setTest = (patch: Partial<TestCase>) => {
                        const tests = (step.content.tests || []).map((t, i) => i === idx ? { ...t, ...patch } as TestCase : t)
                        updateContent({ tests })
                      }
                      const removeTest = () => updateContent({ tests: (step.content.tests || []).filter((_, i) => i !== idx) })

                      // Labels shown to teacher
                      const META: Record<string, { color: string; label: string; hint: string }> = {
                        "var":        { color: "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300",  label: "Переменная",       hint: "Код содержит переменную с этим именем" },
                        "fn":         { color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",          label: "Вызов функции",    hint: "Код вызывает эту функцию" },
                        "outContains":{ color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",label: "Вывод содержит",  hint: "Запустит код и проверит что вывод содержит эту строку" },
                        "outLines":   { color: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",      label: "Строк в выводе",   hint: "Минимальное количество непустых строк вывода" },
                        "io":         { color: "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300",          label: "Ввод → Вывод",     hint: "Запустит код с вводом и сравнит вывод" },
                        "regex":      { color: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300",         label: "Regex (сложный)",  hint: "Регулярное выражение по тексту кода" },
                      }

                      // Determine UI kind from raw test
                      const uiKind: string = (test as Record<string, unknown>)._ui as string || (() => {
                        if (test.type === "io") return "io"
                        if (test.type === "outputLineCount") return "outLines"
                        if (test.type === "outputContainsLine") return "outContains"
                        if (test.type === "regex") return "regex"
                        if (test.type === "includesAll") {
                          return "var" // default
                        }
                        return "var"
                      })()

                      const meta = META[uiKind] || META["var"]

                      return (
                        <div key={idx} className="rounded-xl border border-[var(--border)] overflow-hidden">
                          {/* Row header */}
                          <div className="flex items-center gap-2 px-3 py-2 bg-[var(--surface)]">
                            {/* Kind picker */}
                            <select
                              value={uiKind}
                              onChange={(e) => {
                                const k = e.target.value
                                const desc = test.description || ""
                                const base = { _ui: k, description: desc }
                                const next: Record<string, TestCase> = {
                                  var:         { ...base, type: "includesAll", tokens: "" } as unknown as TestCase,
                                  fn:          { ...base, type: "includesAll", tokens: "" } as unknown as TestCase,
                                  outContains: { ...base, type: "outputContainsLine", pattern: "", input: "" } as unknown as TestCase,
                                  outLines:    { ...base, type: "outputLineCount", min: 1, input: "" } as unknown as TestCase,
                                  io:          { ...base, type: "io", input: "", expectedOutput: "" } as unknown as TestCase,
                                }
                                updateContent({ tests: (step.content.tests || []).map((t, i) => i === idx ? next[k] : t) })
                              }}
                              className="text-xs font-semibold border-none bg-transparent outline-none cursor-pointer text-[var(--text)] pr-4"
                            >
                              <option value="var">📦 Переменная</option>
                              <option value="fn">🔧 Вызов функции</option>
                              <option value="outContains">💬 Вывод содержит</option>
                              <option value="outLines">📊 Строк в выводе</option>
                              <option value="io">▶️ Ввод → Вывод</option>
                            </select>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${meta.color}`}>{meta.label}</span>
                            <button onClick={removeTest} className="ml-auto text-slate-400 hover:text-rose-500 shrink-0">
                              <Trash2 size={13} />
                            </button>
                          </div>

                          {/* Fields */}
                          <div className="px-3 pb-3 pt-2 bg-[var(--bg)] space-y-2">
                            {/* Name field always shown */}
                            <input
                              value={test.description || ""}
                              onChange={(e) => setTest({ description: e.target.value } as Partial<TestCase>)}
                              placeholder="Название проверки (видит студент)"
                              className="input-field text-xs py-1.5 w-full"
                            />

                            {/* Var: single name input */}
                            {uiKind === "var" && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-[var(--muted)] shrink-0">Имя переменной:</span>
                                <input
                                  value={test.type === "includesAll" ? (test.tokens || "").split(",")[0]?.trim() || "" : ""}
                                  onChange={(e) => setTest({ tokens: e.target.value.trim() } as Partial<TestCase>)}
                                  placeholder="name"
                                  className="input-field text-sm py-1 font-mono flex-1"
                                />
                              </div>
                            )}

                            {/* Fn: function name */}
                            {uiKind === "fn" && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-[var(--muted)] shrink-0">Имя функции:</span>
                                <input
                                  value={test.type === "includesAll" ? (test.tokens || "").split(",")[0]?.trim().replace(/\(\)$/, "") || "" : ""}
                                  onChange={(e) => {
                                    const fn = e.target.value.trim().replace(/\(\)$/, "")
                                    setTest({ tokens: `${fn}(` } as Partial<TestCase>)
                                  }}
                                  placeholder="print"
                                  className="input-field text-sm py-1 font-mono flex-1"
                                />
                                <span className="text-xs text-[var(--muted)] shrink-0">— ищет «имя(» в коде</span>
                              </div>
                            )}

                            {/* outContains */}
                            {uiKind === "outContains" && test.type === "outputContainsLine" && (
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-[var(--muted)] shrink-0 w-28">Вывод содержит:</span>
                                  <input value={test.pattern} onChange={(e) => setTest({ pattern: e.target.value } as Partial<TestCase>)} placeholder={"Привет, мир!"} className="input-field text-sm py-1 flex-1" />
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-[var(--muted)] shrink-0 w-28">Ввод (если нужен):</span>
                                  <input value={test.input || ""} onChange={(e) => setTest({ input: e.target.value } as Partial<TestCase>)} placeholder="Алексей" className="input-field text-xs py-1 font-mono flex-1" />
                                </div>
                              </div>
                            )}

                            {/* outLines */}
                            {uiKind === "outLines" && test.type === "outputLineCount" && (
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-[var(--muted)]">Минимум строк в выводе:</span>
                                <input type="number" min={1} value={test.min} onChange={(e) => setTest({ min: Number(e.target.value) } as Partial<TestCase>)} className="input-field text-sm py-1 w-20" />
                                <span className="text-xs text-[var(--muted)]">Ввод:</span>
                                <input value={test.input || ""} onChange={(e) => setTest({ input: e.target.value } as Partial<TestCase>)} placeholder="(пусто)" className="input-field text-xs py-1 font-mono w-28" />
                              </div>
                            )}

                            {/* IO */}
                            {uiKind === "io" && test.type === "io" && (
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <p className="text-[10px] text-[var(--muted)] mb-1">Ввод пользователя</p>
                                  <textarea rows={2} value={test.input} onChange={(e) => setTest({ input: e.target.value } as Partial<TestCase>)} placeholder={"Алексей\n2000"} className="input-field text-xs py-1 font-mono w-full resize-none" />
                                </div>
                                <div>
                                  <p className="text-[10px] text-[var(--muted)] mb-1">Ожидаемый вывод</p>
                                  <textarea rows={2} value={test.expectedOutput} onChange={(e) => setTest({ expectedOutput: e.target.value } as Partial<TestCase>)} placeholder={"Привет, Алексей!"} className="input-field text-xs py-1 font-mono w-full resize-none" />
                                </div>
                              </div>
                            )}

                            <p className="text-[10px] text-[var(--muted)] italic">{meta.hint}</p>
                          </div>
                        </div>
                      )
                    })}

                    {/* Add buttons — simple */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                      {([
                        ["var",         "📦 Переменная",        { _ui:"var",         type:"includesAll",      description:"", tokens:"" }],
                        ["fn",          "🔧 Вызов функции",     { _ui:"fn",          type:"includesAll",      description:"", tokens:"" }],
                        ["outContains", "💬 Вывод содержит",    { _ui:"outContains", type:"outputContainsLine",description:"", pattern:"", input:"" }],
                        ["outLines",    "📊 Строк в выводе",    { _ui:"outLines",    type:"outputLineCount",  description:"", min:1, input:"" }],
                        ["io",          "▶️ Ввод → Вывод",      { _ui:"io",          type:"io",               description:"", input:"", expectedOutput:"" }],
                      ] as const).map(([, label, def]) => (
                        <button
                          key={label}
                          onClick={() => updateContent({ tests: [...(step.content.tests || []), def as unknown as TestCase] })}
                          className="flex items-center justify-center gap-1 text-xs px-3 py-2 rounded-xl border border-[var(--border)] hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-colors text-[var(--muted)]"
                        >
                          <Plus size={11} /> {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step.stepType === "essay" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Задание для эссе</label>
                    <textarea
                      value={step.content.taskDescription || ""}
                      onChange={(e) => updateContent({ taskDescription: e.target.value })}
                      rows={4}
                      placeholder="Например: Опишите преимущества и недостатки объектно-ориентированного программирования. Приведите примеры из реальных проектов. Минимум 150 слов."
                      className="input-field text-sm w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">
                      Ключевые слова/фразы{" "}
                      <span className="text-slate-400 font-normal">(через запятую — AI снизит оценку, если они отсутствуют)</span>
                    </label>
                    <input
                      value={step.content.essayKeywords || ""}
                      onChange={(e) => updateContent({ essayKeywords: e.target.value })}
                      placeholder="Например: инкапсуляция, наследование, полиморфизм, пример"
                      className="input-field text-sm w-full"
                    />
                  </div>
                  <div className="rounded-xl border border-violet-200 dark:border-violet-800/40 bg-violet-50 dark:bg-violet-900/20 px-4 py-3 text-xs text-violet-700 dark:text-violet-300 space-y-1">
                    <p className="font-semibold flex items-center gap-1.5">🤖 AI всегда проверяет эссе</p>
                    <p>Оценка ставится автоматически по 4 критериям: содержание, творчество, ясность изложения, глубина анализа</p>
                    <p>🔑 Ключевые слова проверяются отдельно — каждое пропущенное снижает итоговый балл</p>
                    <p>💡 Оставьте поле ключевых слов пустым, если хотите полностью свободное эссе</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

// названия шагов визарда — отображаются в индикаторе прогресса сверху
const STEPS = ["Основная информация", "Структура курса", "Публикация"]

export default function CourseEditor() {
  const { courseId } = useParams<{ courseId?: string }>()
  const isEdit = Boolean(courseId)
  const navigate = useNavigate()
  const toast = useToast()

  const [activeStep, setActiveStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(isEdit)

  const [info, setInfo] = useState<BasicInfo>({
    title: "",
    slug: "",
    description: "",
    level: "beginner",
    category: "programming",
    priceCents: 0,
    accessType: "open",
    coverUrl: "",
  })

  const [modules, setModules] = useState<Module[]>([emptyModule(1)])
  const [savedCourseId, setSavedCourseId] = useState<number | null>(courseId ? Number(courseId) : null)
  const [publishStatus, setPublishStatus] = useState<"draft" | "pending_review">("draft")
  // Track IDs of steps that were in the DB when we loaded — used to diff and DELETE removed ones
  const [loadedStepIds, setLoadedStepIds] = useState<number[]>([])
  const [coverUploading, setCoverUploading] = useState(false)
  const coverInputRef = useRef<HTMLInputElement | null>(null)

  // загрузка обложки курса — отправляем файл на /api/upload/cover
  // максимальный размер 5 МБ, поддерживаются jpg/png/webp/svg/gif
  const onCoverFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error("Файл слишком большой (максимум 5 МБ)"); return }
    setCoverUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/upload/cover", {
        method: "POST",
        body: fd,
        credentials: "include",
        headers: { Authorization: `Bearer ${localStorage.getItem("gradus_access_token") || ""}` },
      })
      const json = await res.json() as { url?: string; error?: string }
      if (json.error) { toast.error(json.error); return }
      setInfo((prev) => ({ ...prev, coverUrl: json.url || "" }))
      toast.success("Обложка загружена")
    } catch {
      toast.error("Не удалось загрузить обложку")
    } finally {
      setCoverUploading(false)
      e.target.value = ""
    }
  }

  // Load existing course for edit mode
  useEffect(() => {
    if (!isEdit || !courseId) return
    const load = async () => {
      try {
        const [courseData, structure] = await Promise.all([
          api.get<Record<string, unknown>>(`/courses/${courseId}`),
          api.get<{
            modules: Array<{ id: number; title: string; moduleOrder: number }>
            lessons: Array<{ id: number; moduleId: number; title: string; lessonOrder: number; lessonType: string; contentText: string }>
            steps: Array<{ id: number; lessonId: number; title: string; stepOrder: number; stepType: string; content: Record<string, unknown>; xp: number }>
          }>(`/teacher/courses/${courseId}/structure`),
        ])

        setInfo({
          title: String(courseData.title || ""),
          slug: String(courseData.slug || ""),
          description: String(courseData.description || ""),
          level: (courseData.level as CourseLevel) || "beginner",
          category: (courseData.category as CourseCategory) || "programming",
          priceCents: Number(courseData.priceCents || 0),
          accessType: (courseData.accessType as AccessType) || "open",
          coverUrl: String(courseData.coverUrl || ""),
        })
        const st = courseData.status as string
        setPublishStatus(st === "pending_review" ? "pending_review" : "draft")

        // Each module gets ONE virtual lesson; steps from backend go into it
        const builtModules: Module[] = (structure.modules || []).map((m) => {
          const vLessonId = m.id * -1000  // same formula as backend
          const stepsForModule = (structure.steps || [])
            .filter((s: Record<string, unknown>) => s.lessonId === vLessonId)
            .map((s: Record<string, unknown>) => ({
              id: s.id as number,
              title: s.title as string,
              stepOrder: s.stepOrder as number,
              stepType: (s.stepType as StepType) || "theory",
              xp: (s.xp as number) || 10,
              content: (s.content as Step["content"]) || {},
            }))

          return {
            id: m.id,
            title: m.title,
            moduleOrder: m.moduleOrder,
            lessons: [{
              id: vLessonId,
              title: "Шаги",
              lessonOrder: 1,
              lessonType: "text" as const,
              contentText: "",
              steps: stepsForModule,
            }],
          }
        })

        setModules(builtModules.length > 0 ? builtModules : [emptyModule(1)])
        // Remember all DB step IDs so we can delete removed ones on save
        const allIds = (structure.steps || []).map((s) => s.id).filter((id) => id > 0)
        setLoadedStepIds(allIds)
      } catch {
        toast.error("Не удалось загрузить курс")
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [courseId])

  const autoSlug = (title: string) => {
    if (!info.slug || info.slug === slugify(info.title)) {
      setInfo((prev) => ({ ...prev, slug: slugify(title) }))
    }
  }

  // Save basic info (creates or updates course)
  const saveBasicInfo = async (): Promise<number | null> => {
    if (!info.title.trim()) {
      toast.error("Введите название курса")
      return null
    }
    if (!info.slug.trim()) {
      toast.error("Введите slug курса")
      return null
    }

    const payload = {
      title: info.title,
      slug: info.slug,
      description: info.description,
      level: info.level,
      category: info.category,
      priceCents: info.priceCents,
      accessType: info.accessType,
      coverUrl: info.coverUrl,
    }

    try {
      if (savedCourseId) {
        await api.patch(`/teacher/courses/${savedCourseId}`, payload)
        return savedCourseId
      } else {
        const result = await api.post<{ id: number }>("/teacher/courses", payload)
        setSavedCourseId(result.id)
        // Update URL so refresh doesn't lose the course
        navigate(`/teacher/courses/${result.id}/edit`, { replace: true })
        return result.id
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка сохранения")
      return null
    }
  }

  // сохраняем структуру курса — модули и шаги
  // удаляем шаги которые были в БД но сейчас удалены из редактора
  const saveStructure = async (cid: number) => {
    // Collect all step IDs currently in the editor
    const currentStepIds = new Set<number>()
    for (const mod of modules) {
      for (const lesson of mod.lessons) {
        for (const step of lesson.steps) {
          if (step.id && step.id > 0) currentStepIds.add(step.id)
        }
      }
    }

    // Delete steps that were in DB but removed from UI
    const toDelete = loadedStepIds.filter((id) => !currentStepIds.has(id))
    await Promise.all(toDelete.map((id) => api.delete(`/teacher/steps/${id}`)))

    for (const mod of modules) {
      let modId = mod.id
      const modPayload = { title: mod.title, moduleOrder: mod.moduleOrder }
      if (modId && modId > 0) {
        await api.patch(`/teacher/modules/${modId}`, modPayload)
      } else {
        const savedMod = await api.post<{ id: number }>(`/teacher/courses/${cid}/modules`, modPayload)
        modId = savedMod.id
      }

      for (const lesson of mod.lessons) {
        // Virtual lessons (id < 0) are just grouping containers — skip saving them.
        // Use real modId to compute the virtual lesson id so backend resolves the correct module.
        const virtualLessonId = (modId ?? 0) * -1000

        for (const step of lesson.steps) {
          const stepPayload = {
            lessonId: virtualLessonId,
            title: step.title,
            stepOrder: step.stepOrder,
            stepType: step.stepType,
            xp: step.xp,
            content: step.content,
          }
          if (step.id && step.id > 0) {
            await api.patch(`/teacher/steps/${step.id}`, stepPayload)
          } else {
            const created = await api.post<{ id: number }>(`/teacher/courses/${cid}/steps`, stepPayload)
            step.id = created.id  // update in-memory so repeated saves work
          }
        }
      }
    }

    // After save, re-collect all step IDs (including newly created ones whose id was mutated above)
    const savedIds: number[] = []
    for (const mod of modules) {
      for (const lesson of mod.lessons) {
        for (const step of lesson.steps) {
          if (step.id && step.id > 0) savedIds.push(step.id)
        }
      }
    }
    setLoadedStepIds(savedIds)
  }

  const handleNext = async () => {
    setSaving(true)
    try {
      if (activeStep === 0) {
        const cid = await saveBasicInfo()
        if (cid) setActiveStep(1)
      } else if (activeStep === 1) {
        if (!savedCourseId) {
          toast.error("Сначала сохраните основную информацию")
          return
        }
        await saveStructure(savedCourseId)
        toast.success("Структура курса сохранена")
        setActiveStep(2)
      }
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async () => {
    if (!savedCourseId) return
    setSaving(true)
    try {
      await api.patch(`/teacher/courses/${savedCourseId}/publish`, { status: publishStatus })
      toast.success(publishStatus === "pending_review" ? "Курс отправлен на модерацию" : "Курс сохранён как черновик")
      navigate("/teacher")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка публикации")
    } finally {
      setSaving(false)
    }
  }

  const addModule = () => {
    setModules((prev) => [...prev, emptyModule(prev.length + 1)])
  }

  const updateModule = (idx: number, mod: Module) => {
    setModules((prev) => prev.map((m, i) => (i === idx ? mod : m)))
  }

  const deleteModule = (idx: number) => {
    setModules((prev) => prev.filter((_, i) => i !== idx))
  }

  const addLesson = (modIdx: number) => {
    setModules((prev) =>
      prev.map((m, i) =>
        i === modIdx
          ? { ...m, lessons: [...m.lessons, emptyLesson(m.lessons.length + 1)] }
          : m
      )
    )
  }

  const updateLesson = (modIdx: number, lesIdx: number, lesson: Lesson) => {
    setModules((prev) =>
      prev.map((m, i) =>
        i === modIdx
          ? { ...m, lessons: m.lessons.map((l, j) => (j === lesIdx ? lesson : l)) }
          : m
      )
    )
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div>
          <h2 className="text-2xl md:text-3xl font-bold">
            {isEdit ? "Редактирование курса" : "Создание курса"}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {isEdit ? `Курс ID: ${courseId}` : "Заполните информацию шаг за шагом"}
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0">
          {STEPS.map((label, idx) => (
            <div key={label} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    idx < activeStep
                      ? "bg-emerald-500 text-white"
                      : idx === activeStep
                        ? "bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-md shadow-rose-500/30"
                        : "bg-slate-100 dark:bg-zinc-800 text-slate-400"
                  }`}
                >
                  {idx < activeStep ? <Check size={14} /> : idx + 1}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${idx === activeStep ? "text-rose-600" : "text-slate-400"}`}>
                  {label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 mb-4 transition-all ${idx < activeStep ? "bg-emerald-400" : "bg-slate-200 dark:bg-slate-700"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 0: Basic Info */}
        {activeStep === 0 && (
          <Card className="space-y-5">
            <h3 className="font-semibold text-lg">Основная информация</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Название курса *</label>
                <input
                  value={info.title}
                  onChange={(e) => {
                    setInfo((prev) => ({ ...prev, title: e.target.value }))
                    autoSlug(e.target.value)
                  }}
                  placeholder="Например: Python для начинающих"
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">URL-slug *</label>
                <input
                  value={info.slug}
                  onChange={(e) => setInfo((prev) => ({ ...prev, slug: slugify(e.target.value) }))}
                  placeholder="python-dlya-nachinayushih"
                  className="input-field w-full font-mono text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Описание</label>
              <textarea
                value={info.description}
                onChange={(e) => setInfo((prev) => ({ ...prev, description: e.target.value }))}
                rows={4}
                placeholder="Расскажите, что студент узнает, кому подходит курс, чем он уникален..."
                className="input-field w-full resize-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CustomSelect
                label="Уровень сложности"
                value={info.level}
                onChange={(v) => setInfo((prev) => ({ ...prev, level: v }))}
                options={LEVELS}
              />
              <CustomSelect
                label="Категория"
                value={info.category}
                onChange={(v) => setInfo((prev) => ({ ...prev, category: v }))}
                options={CATEGORIES}
              />
            </div>

            {/* Price */}
            <div>
              <label className="text-sm font-medium mb-2 block">Цена курса</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {[
                  { label: "Бесплатно", value: 0,     free: true },
                  { label: "490 ₽",     value: 49000  },
                  { label: "990 ₽",     value: 99000  },
                  { label: "1 990 ₽",   value: 199000 },
                  { label: "4 990 ₽",   value: 499000 },
                ].map((preset) => {
                  const active = info.priceCents === preset.value
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setInfo((prev) => ({ ...prev, priceCents: preset.value }))}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-[var(--border)] text-[var(--muted)] hover:border-primary/40 hover:text-[var(--text)]"
                      }`}
                    >
                      {preset.free
                        ? <Unlock size={14} className={active ? "text-primary" : "text-[var(--muted)]"} />
                        : <Zap    size={14} className={active ? "text-primary" : "text-[var(--muted)]"} />
                      }
                      {preset.label}
                      {active && <Check size={13} />}
                    </button>
                  )
                })}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--muted)] shrink-0">Своя цена:</span>
                <div className="relative flex-1 max-w-[180px]">
                  <input
                    type="number"
                    value={info.priceCents === 0 ? "" : info.priceCents / 100}
                    onChange={(e) => {
                      const val = e.target.value === "" ? 0 : Math.round(Number(e.target.value) * 100)
                      setInfo((prev) => ({ ...prev, priceCents: val }))
                    }}
                    placeholder="0"
                    min={0}
                    step={1}
                    className="input-field w-full pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--muted)]">₽</span>
                </div>
                {info.priceCents > 0 && (
                  <span className="text-xs text-[var(--muted)]">
                    = {(info.priceCents / 100).toLocaleString("ru-RU")} ₽
                  </span>
                )}
              </div>
            </div>

            {/* Cover */}
            <div>
              <label className="text-sm font-medium mb-2 block">Обложка курса</label>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml,image/gif"
                onChange={onCoverFileSelected}
                className="hidden"
              />
              {info.coverUrl ? (
                <div className="relative group rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--surface)]">
                  <img
                    src={info.coverUrl}
                    alt="Обложка"
                    className="w-full h-48 object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => coverInputRef.current?.click()}
                      disabled={coverUploading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/90 text-xs font-medium text-slate-800 hover:bg-white transition-colors"
                    >
                      {coverUploading ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
                      Заменить
                    </button>
                    <button
                      type="button"
                      onClick={() => setInfo((prev) => ({ ...prev, coverUrl: "" }))}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/90 text-xs font-medium text-rose-600 hover:bg-white transition-colors"
                    >
                      <X size={13} /> Удалить
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  disabled={coverUploading}
                  className="w-full h-48 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--border)] hover:border-primary/50 hover:bg-primary/5 transition-colors text-[var(--muted)] hover:text-primary group"
                >
                  {coverUploading
                    ? <Loader2 size={32} className="animate-spin text-primary" />
                    : <ImagePlus size={32} className="text-[var(--muted)]" />
                  }
                  <span className="text-sm font-medium">
                    {coverUploading ? "Загружаю..." : "Выбрать изображение"}
                  </span>
                  <span className="text-xs">JPG, PNG, WEBP, SVG · до 5 МБ</span>
                </button>
              )}
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Тип доступа</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {ACCESS_TYPES.map((at) => {
                  const active = info.accessType === at.value
                  const colorMap: Record<string, string> = {
                    emerald: active ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 ring-2 ring-emerald-500/20" : "border-[var(--border)] hover:border-emerald-400/60 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10",
                    amber:   active ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20 ring-2 ring-amber-500/20"         : "border-[var(--border)] hover:border-amber-400/60 hover:bg-amber-50/50 dark:hover:bg-amber-900/10",
                    violet:  active ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20 ring-2 ring-violet-500/20"     : "border-[var(--border)] hover:border-violet-400/60 hover:bg-violet-50/50 dark:hover:bg-violet-900/10",
                  }
                  const labelColorMap: Record<string, string> = {
                    emerald: active ? "text-emerald-700 dark:text-emerald-300" : "text-[var(--text)]",
                    amber:   active ? "text-amber-700 dark:text-amber-300"     : "text-[var(--text)]",
                    violet:  active ? "text-violet-700 dark:text-violet-300"   : "text-[var(--text)]",
                  }
                  return (
                    <button
                      key={at.value}
                      type="button"
                      onClick={() => setInfo((prev) => ({ ...prev, accessType: at.value }))}
                      className={`text-left p-4 rounded-xl border-2 transition-all ${colorMap[at.color]}`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={labelColorMap[at.color]}>{at.icon}</span>
                        <p className={`font-semibold text-sm ${labelColorMap[at.color]}`}>{at.label}</p>
                      </div>
                      <p className="text-xs text-[var(--muted)] leading-snug">{at.desc}</p>
                    </button>
                  )
                })}
              </div>
            </div>
          </Card>
        )}

        {/* Step 1: Structure */}
        {activeStep === 1 && (
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Структура курса</h3>
              <Button onClick={addModule} variant="outline">
                <Plus size={14} className="mr-1" /> Модуль
              </Button>
            </div>

            <p className="text-sm text-slate-500">
              Организуйте контент: создайте модули, уроки и шаги. Нажмите на элемент, чтобы раскрыть его.
            </p>

            <div className="space-y-4">
              {modules.map((mod, modIdx) => {
                // Flatten all steps across all virtual lessons in this module
                const allSteps = mod.lessons.flatMap((l) => l.steps)
                const virtualLesson = mod.lessons[0] // single virtual lesson per module

                return (
                <div key={modIdx} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 dark:bg-zinc-800/80">
                    <GripVertical size={16} className="text-slate-400 shrink-0" />
                    <span className="text-xs bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded font-semibold shrink-0">
                      Модуль {modIdx + 1}
                    </span>
                    <input
                      value={mod.title}
                      onChange={(e) => updateModule(modIdx, { ...mod, title: e.target.value })}
                      className="flex-1 bg-white dark:bg-zinc-700/60 border border-slate-200 dark:border-zinc-600 rounded-lg px-2.5 py-1 font-semibold text-sm outline-none focus:border-rose-400 dark:focus:border-rose-500 transition-colors min-w-0"
                      placeholder="Название модуля"
                    />
                    <span className="text-xs text-slate-400 shrink-0">{allSteps.length} шагов</span>
                    <button
                      onClick={() => deleteModule(modIdx)}
                      className="text-slate-400 hover:text-rose-500 transition-colors shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="p-3 space-y-2">
                    {allSteps.map((step, stepIdx) => (
                      <StepEditor
                        key={stepIdx}
                        step={step}
                        onChange={(s) => {
                          if (!virtualLesson) return
                          const newSteps = allSteps.map((st, i) => i === stepIdx ? s : st)
                          updateLesson(modIdx, 0, { ...virtualLesson, steps: newSteps })
                        }}
                        onDelete={() => {
                          if (!virtualLesson) return
                          const newSteps = allSteps.filter((_, i) => i !== stepIdx)
                          updateLesson(modIdx, 0, { ...virtualLesson, steps: newSteps })
                        }}
                      />
                    ))}
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (!virtualLesson) {
                          addLesson(modIdx)
                          return
                        }
                        const newStep = emptyStep(allSteps.length + 1)
                        updateLesson(modIdx, 0, { ...virtualLesson, steps: [...allSteps, newStep] })
                      }}
                    >
                      <Plus size={12} className="mr-1" /> Добавить шаг
                    </Button>
                  </div>
                </div>
                )
              })}

              {modules.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  <BookOpen size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Добавьте первый модуль</p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Step 2: Publish */}
        {activeStep === 2 && (
          <Card className="space-y-6">
            <h3 className="font-semibold text-lg">Настройки публикации</h3>

            <div className="rounded-xl bg-slate-50 dark:bg-zinc-800/60 p-4 space-y-2">
              <p className="font-medium">{info.title}</p>
              <p className="text-sm text-slate-500">{info.description || "Без описания"}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="text-xs px-2 py-1 rounded-lg bg-slate-200 dark:bg-zinc-700">
                  {LEVELS.find((l) => l.value === info.level)?.label}
                </span>
                <span className="text-xs px-2 py-1 rounded-lg bg-slate-200 dark:bg-zinc-700">
                  {CATEGORIES.find((c) => c.value === info.category)?.label}
                </span>
                <span className="text-xs px-2 py-1 rounded-lg bg-slate-200 dark:bg-zinc-700">
                  {info.priceCents === 0 ? "Бесплатно" : `${info.priceCents / 100} ₽`}
                </span>
                <span className="text-xs px-2 py-1 rounded-lg bg-slate-200 dark:bg-zinc-700">
                  {modules.length} модулей · {modules.reduce((a, m) => a + m.lessons.length, 0)} уроков
                </span>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-3">Статус публикации</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => setPublishStatus("draft")}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${
                    publishStatus === "draft"
                      ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20"
                      : "border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <p className="font-semibold">Черновик</p>
                  <p className="text-xs text-slate-500 mt-1">Курс виден только вам. Можно редактировать без ограничений.</p>
                </button>
                <button
                  onClick={() => setPublishStatus("pending_review")}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${
                    publishStatus === "pending_review"
                      ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20"
                      : "border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <p className="font-semibold">Отправить на модерацию</p>
                  <p className="text-xs text-slate-500 mt-1">Курс уйдёт администратору на проверку. После одобрения появится в каталоге.</p>
                </button>
              </div>
            </div>

            <Button onClick={handlePublish} disabled={saving} className="w-full">
              {saving ? "Сохранение..." : publishStatus === "pending_review" ? "Отправить на модерацию" : "Сохранить черновик"}
            </Button>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => activeStep > 0 ? setActiveStep((v) => v - 1) : navigate("/teacher")}
          >
            <ChevronLeft size={16} className="mr-1" />
            {activeStep === 0 ? "Отмена" : "Назад"}
          </Button>

          {activeStep < 2 && (
            <Button onClick={handleNext} disabled={saving}>
              {saving ? "Сохранение..." : "Далее"}
              <ChevronRight size={16} className="ml-1" />
            </Button>
          )}
        </div>
      </div>
    </MainLayout>
  )
}
