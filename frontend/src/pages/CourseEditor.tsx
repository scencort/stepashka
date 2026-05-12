import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import MainLayout from "../layout/MainLayout"
import Card from "../components/ui/Card"
import Button from "../components/ui/Button"
import Skeleton from "../components/ui/Skeleton"

import { api } from "../lib/api"
import { useToast } from "../hooks/useToast"
import { ChevronRight, ChevronLeft, Plus, Trash2, GripVertical, BookOpen, FileQuestion, Code2, Check, PenLine } from "lucide-react"

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
    tests?: Array<{ input: string; expectedOutput: string }>
    essayKeywords?: string
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LEVELS: Array<{ value: CourseLevel; label: string }> = [
  { value: "beginner", label: "Начинающий" },
  { value: "intermediate", label: "Средний" },
  { value: "advanced", label: "Продвинутый" },
]

const CATEGORIES: Array<{ value: CourseCategory; label: string }> = [
  { value: "programming", label: "Программирование" },
  { value: "design", label: "Дизайн" },
  { value: "marketing", label: "Маркетинг" },
  { value: "business", label: "Бизнес" },
  { value: "data_science", label: "Data Science" },
  { value: "languages", label: "Языки" },
  { value: "other", label: "Другое" },
]

const ACCESS_TYPES: Array<{ value: AccessType; label: string; desc: string }> = [
  { value: "open", label: "Открытый", desc: "Любой желающий может записаться" },
  { value: "moderated", label: "По заявке", desc: "Студент подает заявку, вы одобряете" },
  { value: "invite_only", label: "По приглашению", desc: "Только по вашему приглашению" },
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
  essay: "Эссе",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(str: string) {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
}

function emptyStep(order: number): Step {
  return {
    title: `Шаг ${order}`,
    stepOrder: order,
    stepType: "theory",
    xp: 10,
    content: { text: "" },
  }
}

function emptyLesson(order: number): Lesson {
  return {
    title: `Урок ${order}`,
    lessonOrder: order,
    lessonType: "text",
    contentText: "",
    steps: [emptyStep(1)],
  }
}

// Virtual lesson is just a container; id < 0 = virtual (not saved to DB)
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

function emptyModule(order: number): Module {
  return {
    title: `Модуль ${order}`,
    moduleOrder: order,
    lessons: [virtualLesson()],
  }
}

// ─── Sub-components ────────────────────────────────────────────────────────────

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
          className="flex-1 bg-transparent text-sm font-medium outline-none"
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
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Условие задачи</label>
                    <textarea
                      value={step.content.taskDescription || ""}
                      onChange={(e) => updateContent({ taskDescription: e.target.value })}
                      rows={3}
                      placeholder="Например: Напишите функцию sum_list(lst), которая принимает список чисел и возвращает их сумму."
                      className="input-field text-sm w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Стартовый код (необязательно)</label>
                    <textarea
                      value={step.content.starterCode || ""}
                      onChange={(e) => updateContent({ starterCode: e.target.value })}
                      rows={4}
                      placeholder={"def sum_list(lst):\n    # ваш код здесь\n    pass"}
                      className="input-field text-sm w-full font-mono"
                    />
                  </div>

                  {/* Hint box about evaluation logic */}
                  <div className="rounded-xl border border-blue-200 dark:border-blue-800/40 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 space-y-1.5 text-xs text-blue-700 dark:text-blue-300">
                    <p className="font-semibold">Как проверяется код студента:</p>
                    <p>📝 <b>Без тест-кейсов</b> — нейронка оценивает качество, стиль и логику кода (творческое задание)</p>
                    <p>⚙️ <b>С тест-кейсами</b> — код студента реально запускается на Python, stdin подаётся как «Ввод», stdout сравнивается с «Ожидаемым выводом». Все тесты должны пройти.</p>
                    <p className="text-blue-500 dark:text-blue-400">Пример: ввод <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">3 5</code> → программа читает два числа через пробел, ожидаемый вывод <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">8</code></p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-slate-500">
                        Тест-кейсы{" "}
                        <span className="text-slate-400 font-normal">
                          ({(step.content.tests || []).length === 0 ? "нет → AI-оценка" : `${(step.content.tests || []).length} шт → запуск кода`})
                        </span>
                      </label>
                    </div>
                    <div className="space-y-2">
                      {(step.content.tests || []).map((test, idx) => (
                        <div key={idx} className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-start">
                          <div>
                            <p className="text-[10px] text-slate-400 mb-0.5">Ввод (stdin)</p>
                            <input
                              value={test.input}
                              onChange={(e) => {
                                const tests = (step.content.tests || []).map((t, i) =>
                                  i === idx ? { ...t, input: e.target.value } : t
                                )
                                updateContent({ tests })
                              }}
                              placeholder="Например: 3 5"
                              className="input-field text-sm py-1.5 font-mono w-full"
                            />
                          </div>
                          <div className="flex gap-1 items-end">
                            <div className="flex-1">
                              <p className="text-[10px] text-slate-400 mb-0.5">Ожидаемый вывод (stdout)</p>
                              <input
                                value={test.expectedOutput}
                                onChange={(e) => {
                                  const tests = (step.content.tests || []).map((t, i) =>
                                    i === idx ? { ...t, expectedOutput: e.target.value } : t
                                  )
                                  updateContent({ tests })
                                }}
                                placeholder="Например: 8"
                                className="input-field text-sm py-1.5 font-mono w-full"
                              />
                            </div>
                            <button
                              onClick={() => {
                                const tests = (step.content.tests || []).filter((_, i) => i !== idx)
                                updateContent({ tests })
                              }}
                              className="text-slate-400 hover:text-rose-500 mb-0.5"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        onClick={() => {
                          const tests = [...(step.content.tests || []), { input: "", expectedOutput: "" }]
                          updateContent({ tests })
                        }}
                      >
                        <Plus size={12} className="mr-1" /> Добавить тест-кейс
                      </Button>
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
                  <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-xs text-amber-700 dark:text-amber-300 space-y-1">
                    <p className="font-semibold">Как оценивается эссе:</p>
                    <p>🤖 AI выставляет оценки по 4 критериям: содержание, творчество, ясность изложения, глубина анализа</p>
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

function LessonEditor({
  lesson,
  onChange,
  onDelete,
}: {
  lesson: Lesson
  onChange: (l: Lesson) => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  const addStep = () => {
    const next = emptyStep(lesson.steps.length + 1)
    onChange({ ...lesson, steps: [...lesson.steps, next] })
  }

  const updateStep = (idx: number, step: Step) => {
    const steps = lesson.steps.map((s, i) => (i === idx ? step : s))
    onChange({ ...lesson, steps })
  }

  const deleteStep = (idx: number) => {
    onChange({ ...lesson, steps: lesson.steps.filter((_, i) => i !== idx) })
  }

  return (
    <div className="ml-4 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div
        className="flex items-center gap-2 px-3 py-2.5 bg-white/40 dark:bg-zinc-800/40 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <GripVertical size={14} className="text-slate-400 shrink-0" />
        <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">
          Урок
        </span>
        <input
          value={lesson.title}
          onChange={(e) => onChange({ ...lesson, title: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 bg-transparent text-sm font-medium outline-none"
          placeholder="Название урока"
        />
        <span className="text-xs text-slate-400">{lesson.steps.length} шагов</span>
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
            <div className="p-3 space-y-2 border-t border-slate-100 dark:border-slate-700">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Вводный текст урока</label>
                <textarea
                  value={lesson.contentText}
                  onChange={(e) => onChange({ ...lesson, contentText: e.target.value })}
                  rows={3}
                  placeholder="Краткое введение или аннотация урока..."
                  className="input-field text-sm w-full"
                />
              </div>
              <p className="text-xs text-slate-500 font-medium mt-2">Шаги урока</p>
              {lesson.steps.map((step, idx) => (
                <StepEditor
                  key={idx}
                  step={step}
                  onChange={(s) => updateStep(idx, s)}
                  onDelete={() => deleteStep(idx)}
                />
              ))}
              <Button variant="outline" onClick={addStep}>
                <Plus size={12} className="mr-1" /> Добавить шаг
              </Button>
            </div>
          </div>
        )}

    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

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
        return result.id
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка сохранения")
      return null
    }
  }

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
      toast.success(publishStatus === "published" ? "Курс отправлен на публикацию" : "Курс сохранён как черновик")
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

  const deleteLesson = (modIdx: number, lesIdx: number) => {
    setModules((prev) =>
      prev.map((m, i) =>
        i === modIdx
          ? { ...m, lessons: m.lessons.filter((_, j) => j !== lesIdx) }
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
              <div>
                <label className="text-sm font-medium mb-1 block">Уровень сложности</label>
                <select
                  value={info.level}
                  onChange={(e) => setInfo((prev) => ({ ...prev, level: e.target.value as CourseLevel }))}
                  className="input-field w-full"
                >
                  {LEVELS.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Категория</label>
                <select
                  value={info.category}
                  onChange={(e) => setInfo((prev) => ({ ...prev, category: e.target.value as CourseCategory }))}
                  className="input-field w-full"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Цена (₽, 0 = бесплатно)</label>
                <input
                  type="number"
                  value={info.priceCents / 100}
                  onChange={(e) => setInfo((prev) => ({ ...prev, priceCents: Math.round(Number(e.target.value) * 100) }))}
                  min={0}
                  step={1}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">URL обложки (необязательно)</label>
                <input
                  value={info.coverUrl}
                  onChange={(e) => setInfo((prev) => ({ ...prev, coverUrl: e.target.value }))}
                  placeholder="https://..."
                  className="input-field w-full"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Тип доступа</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {ACCESS_TYPES.map((at) => (
                  <button
                    key={at.value}
                    onClick={() => setInfo((prev) => ({ ...prev, accessType: at.value }))}
                    className={`text-left p-3 rounded-xl border-2 transition-all ${
                      info.accessType === at.value
                        ? "border-rose-500 bg-rose-50 dark:bg-rose-900/20"
                        : "border-slate-200 dark:border-slate-700 hover:border-rose-300"
                    }`}
                  >
                    <p className="font-medium text-sm">{at.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{at.desc}</p>
                  </button>
                ))}
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
                    <GripVertical size={16} className="text-slate-400" />
                    <span className="text-xs bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded font-semibold">
                      Модуль {modIdx + 1}
                    </span>
                    <input
                      value={mod.title}
                      onChange={(e) => updateModule(modIdx, { ...mod, title: e.target.value })}
                      className="flex-1 bg-transparent font-semibold text-sm outline-none"
                      placeholder="Название модуля"
                    />
                    <span className="text-xs text-slate-400">{allSteps.length} шагов</span>
                    <button
                      onClick={() => deleteModule(modIdx)}
                      className="text-slate-400 hover:text-rose-500 transition-colors"
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
