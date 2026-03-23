import MainLayout from "../layout/MainLayout"
import { motion } from "framer-motion"
import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import Card from "../components/ui/Card"
import Button from "../components/ui/Button"
import { Users, Star, Clock3, CheckCircle2, Circle } from "lucide-react"
import { api } from "../lib/api"
import Modal from "../components/ui/Modal"
import Skeleton from "../components/ui/Skeleton"
import EmptyState from "../components/ui/EmptyState"
import { useToast } from "../hooks/useToast"

import {
  fadeInUp,
  staggerContainer,
} from "../lib/animations"

type CourseItem = {
  id: number
  title: string
  lessons: number
  progress: number
  type: string
  students: string
  rating: string
  duration: string
  level: string
  author: string
  price: string
  published?: boolean
}

type CourseStep = {
  id: number
  title: string
  kind: "theory" | "quiz" | "code"
  theoryText: string
  options: string[]
  stepOrder: number
  xp: number
}

type StepProgress = {
  stepId: number
  status: "started" | "completed"
  score: number
  attempts: number
  answerText: string
  completedAt: string | null
}

type CourseContentResponse = {
  course: {
    id: number
    title: string
    lessons: number
    progress: number
    type: string
    level: string
    author: string
  }
  steps: CourseStep[]
  progress: StepProgress[]
  summary: {
    total: number
    completed: number
    xp: number
    percent: number
  }
}

type AttemptEntry = {
  id: number
  stepId: number
  answer: string
  passed: boolean
  feedback: string
  createdAt: string
}

type DiscussionMessage = {
  id: number
  author: string
  text: string
  createdAt: string
}

export default function Course() {
  const navigate = useNavigate()
  const { courseId } = useParams<{ courseId?: string }>()
  const selectedCourseId = courseId ? Number(courseId) : null
  const isCoursePage = selectedCourseId !== null && Number.isInteger(selectedCourseId) && selectedCourseId > 0

  const [active, setActive] = useState("Все")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [courses, setCourses] = useState<CourseItem[]>([])
  const [courseContent, setCourseContent] = useState<CourseContentResponse | null>(null)
  const [contentLoading, setContentLoading] = useState(false)
  const [contentError, setContentError] = useState("")
  const [selectedStepId, setSelectedStepId] = useState<number | null>(null)
  const [stepAnswer, setStepAnswer] = useState("")
  const [stepLoading, setStepLoading] = useState(false)
  const [stepError, setStepError] = useState("")
  const [stepMessage, setStepMessage] = useState("")
  const [actionMessage, setActionMessage] = useState("")
  const [search, setSearch] = useState("")
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [newCourseTitle, setNewCourseTitle] = useState("")
  const [newCourseType, setNewCourseType] = useState("Frontend")
  const [newCourseLevel, setNewCourseLevel] = useState("Начальный")
  const [attemptHistory, setAttemptHistory] = useState<AttemptEntry[]>([])
  const [discussionText, setDiscussionText] = useState("")
  const [discussionMessages, setDiscussionMessages] = useState<DiscussionMessage[]>([
    {
      id: 1,
      author: "Куратор",
      text: "Пишите вопросы по шагу: по теории, тесту или коду. Отвечаем по существу и с примерами.",
      createdAt: new Date().toISOString(),
    },
  ])
  const toast = useToast()

  const loadCourses = async () => {
    setLoading(true)
    setError("")
    try {
      const data = await api.get<CourseItem[]>("/courses")
      setCourses(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить курсы")
    } finally {
      setLoading(false)
    }
  }

  const loadCourseContent = async (courseId: number) => {
    setContentLoading(true)
    setContentError("")
    setStepError("")
    setStepMessage("")

    try {
      const data = await api.get<CourseContentResponse>(`/courses/${courseId}/steps`)
      setCourseContent(data)

      const firstStepId = data.steps[0]?.id ?? null
      const selectedStillExists = data.steps.some((step) => step.id === selectedStepId)
      setSelectedStepId(selectedStillExists ? selectedStepId : firstStepId)
      if (!selectedStillExists) {
        setStepAnswer("")
      }

      setAttemptHistory((prev) => prev.filter((item) => data.steps.some((step) => step.id === item.stepId)))
    } catch (err) {
      setContentError(err instanceof Error ? err.message : "Не удалось загрузить шаги курса")
    } finally {
      setContentLoading(false)
    }
  }

  useEffect(() => {
    void loadCourses()
  }, [])

  useEffect(() => {
    if (!isCoursePage || !selectedCourseId) {
      setCourseContent(null)
      setSelectedStepId(null)
      return
    }

    void loadCourseContent(selectedCourseId)
  }, [isCoursePage, selectedCourseId])

  const createCourse = async () => {
    if (!newCourseTitle.trim()) {
      setError("Введите название курса")
      return
    }

    try {
      await api.post("/courses", {
        title: newCourseTitle.trim(),
        type: newCourseType,
        level: newCourseLevel,
      })
      await loadCourses()
      setCreateModalOpen(false)
      setNewCourseTitle("")
      toast.success("Курс создан")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось создать курс"
      setError(message)
      toast.error(message)
    }
  }

  const openCourse = (courseItemId: number) => {
    navigate(`/course/${courseItemId}`)
  }

  const enrollCourse = async (courseId: number) => {
    setActionMessage("")
    try {
      await api.post(`/courses/${courseId}/enroll`, {})
      setActionMessage("Вы успешно записались на курс")
      toast.success("Запись на курс выполнена")
      await loadCourses()
      if (isCoursePage && selectedCourseId === courseId) {
        await loadCourseContent(courseId)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось записаться на курс"
      setActionMessage(message)
      toast.error(message)
    }
  }

  const submitStep = async () => {
    if (!selectedStepId || !selectedCourseId) {
      return
    }

    setStepLoading(true)
    setStepError("")
    setStepMessage("")

    try {
      const response = await api.post<{
        passed: boolean
        feedback: string
      }>(`/steps/${selectedStepId}/check`, { answer: stepAnswer })

      setStepMessage(response.feedback)
      setAttemptHistory((prev) => [
        {
          id: Date.now(),
          stepId: selectedStepId,
          answer: stepAnswer,
          passed: response.passed,
          feedback: response.feedback,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ])
      if (response.passed) {
        toast.success("Шаг принят")
      }
      await Promise.all([loadCourseContent(selectedCourseId), loadCourses()])
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось проверить шаг"
      setStepError(message)
      toast.error(message)
    } finally {
      setStepLoading(false)
    }
  }

  const activeStep = courseContent?.steps.find((step) => step.id === selectedStepId) ?? null
  const activeProgress = courseContent?.progress.find((item) => item.stepId === selectedStepId) ?? null
  const activeStepIndex = courseContent?.steps.findIndex((step) => step.id === selectedStepId) ?? -1
  const previousStep = activeStepIndex > 0 && courseContent ? courseContent.steps[activeStepIndex - 1] : null
  const nextStep = activeStepIndex >= 0 && courseContent && activeStepIndex < courseContent.steps.length - 1
    ? courseContent.steps[activeStepIndex + 1]
    : null

  const filtered =
    active === "Все"
      ? courses
      : courses.filter((c) => c.type === active)

  const searched = filtered.filter((course) =>
    course.title.toLowerCase().includes(search.trim().toLowerCase())
  )

  const stepKindLabel = activeStep
    ? activeStep.kind === "theory"
      ? "Теория"
      : activeStep.kind === "quiz"
        ? "Тест"
        : "Практика"
    : ""

  const submitLabel = activeStep
    ? activeStep.kind === "theory"
      ? "Отметить как изученный"
      : activeStep.kind === "quiz"
        ? "Проверить ответ"
        : "Отправить код"
    : "Проверить"

  const publishedCoursesCount = courses.filter((item) => item.published !== false).length
  const paidCoursesCount = courses.filter((item) => item.price !== "Бесплатно").length
  const selectedAttempts = attemptHistory.filter((item) => item.stepId === selectedStepId)

  const syllabusModules = useMemo(() => {
    if (!courseContent) {
      return [] as Array<{
        id: number
        title: string
        lessons: Array<{
          id: number
          title: string
          steps: CourseStep[]
        }>
      }>
    }

    const lessons = new Map<number, { id: number; title: string; steps: CourseStep[] }>()
    for (const step of courseContent.steps) {
      const lessonIndex = Math.floor((step.stepOrder - 1) / 3) + 1
      if (!lessons.has(lessonIndex)) {
        lessons.set(lessonIndex, {
          id: lessonIndex,
          title: `Урок ${lessonIndex}`,
          steps: [],
        })
      }
      lessons.get(lessonIndex)?.steps.push(step)
    }

    const modulesMap = new Map<number, {
      id: number
      title: string
      lessons: Array<{
        id: number
        title: string
        steps: CourseStep[]
      }>
    }>()

    for (const lesson of Array.from(lessons.values())) {
      const moduleIndex = Math.floor((lesson.id - 1) / 2) + 1
      if (!modulesMap.has(moduleIndex)) {
        modulesMap.set(moduleIndex, {
          id: moduleIndex,
          title: `Модуль ${moduleIndex}`,
          lessons: [],
        })
      }
      modulesMap.get(moduleIndex)?.lessons.push(lesson)
    }

    return Array.from(modulesMap.values())
  }, [courseContent])

  const postDiscussionMessage = () => {
    const text = discussionText.trim()
    if (!text) {
      return
    }

    setDiscussionMessages((prev) => [
      {
        id: Date.now(),
        author: "Вы",
        text,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ])
    setDiscussionText("")
  }

  if (isCoursePage) {
    return (
      <MainLayout>
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="px-4 md:px-0 space-y-5"
        >
          <motion.div variants={fadeInUp} className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/90 dark:bg-slate-900/70 p-4 md:p-5">
            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Курс и практика</p>
                <h2 className="text-xl md:text-2xl font-bold mt-1">{courseContent?.course.title || "Прохождение курса"}</h2>
                <p className="text-sm text-slate-500 mt-1">Формат: теория, мини-тесты и практические задания в одном потоке.</p>
              </div>
              <Button variant="outline" onClick={() => navigate("/course")}>Назад в каталог</Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
              <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/70 p-3 bg-slate-50/70 dark:bg-slate-800/50">
                <p className="text-xs text-slate-500">Шаги</p>
                <p className="text-lg font-semibold">{courseContent?.summary.total ?? 0}</p>
              </div>
              <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/70 p-3 bg-slate-50/70 dark:bg-slate-800/50">
                <p className="text-xs text-slate-500">Пройдено</p>
                <p className="text-lg font-semibold">{courseContent?.summary.completed ?? 0}</p>
              </div>
              <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/70 p-3 bg-slate-50/70 dark:bg-slate-800/50">
                <p className="text-xs text-slate-500">Опыт</p>
                <p className="text-lg font-semibold">{courseContent?.summary.xp ?? 0} XP</p>
              </div>
              <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/70 p-3 bg-slate-50/70 dark:bg-slate-800/50">
                <p className="text-xs text-slate-500">Прогресс</p>
                <p className="text-lg font-semibold">{courseContent?.summary.percent ?? 0}%</p>
              </div>
            </div>
          </motion.div>

          <motion.div variants={fadeInUp} className="sticky top-2 z-20 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/95 dark:bg-slate-900/95 px-3 py-2">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div className="text-sm text-slate-600 dark:text-slate-300">
                <span className="font-medium">Курсы</span> / <span>{courseContent?.course.title || "Курс"}</span> / <span className="text-slate-900 dark:text-slate-100">{activeStep?.title || "Шаг"}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => document.getElementById("course-syllabus")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Оглавление</Button>
                <Button variant="outline" onClick={() => document.getElementById("course-discussion")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Обсуждение</Button>
                <Button onClick={submitStep} disabled={stepLoading || !activeStep}>{stepLoading ? "Проверка..." : "Проверить шаг"}</Button>
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_330px] gap-4">
            <div className="space-y-4">
              <Card className="p-5 border border-slate-200/80 dark:border-slate-700/80">
                {contentLoading && <p className="text-sm text-slate-500">Загрузка структуры курса...</p>}

                {!contentLoading && contentError && (
                  <p className="text-sm text-red-700 dark:text-rose-300">{contentError}</p>
                )}

                {!contentLoading && !contentError && !courseContent && (
                  <p className="text-sm text-slate-500">Курс не найден или недоступен.</p>
                )}

                {!contentLoading && !contentError && courseContent && (
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Текущий материал</p>
                      <progress
                        value={courseContent.summary.percent}
                        max={100}
                        className="w-full h-2 rounded-full overflow-hidden [&::-webkit-progress-bar]:bg-slate-200/80 dark:[&::-webkit-progress-bar]:bg-slate-700/80 [&::-webkit-progress-value]:bg-emerald-500"
                      />
                    </div>

                    {!activeStep && (
                      <p className="text-sm text-slate-500">Выберите шаг из оглавления справа.</p>
                    )}

                    {activeStep && (
                      <>
                        <div className="pb-3 border-b border-slate-200/80 dark:border-slate-700/80">
                          <p className="text-xs uppercase tracking-wide text-slate-500">
                            Шаг {activeStep.stepOrder} • {stepKindLabel} • {activeStep.xp} XP
                          </p>
                          <h3 className="text-xl font-semibold mt-1">{activeStep.title}</h3>
                          {activeProgress && (
                            <p className="text-xs text-slate-500 mt-2">
                              Попыток: {activeProgress.attempts} • Статус: {activeProgress.status === "completed" ? "пройден" : "в работе"}
                            </p>
                          )}
                        </div>

                        {activeStep.kind === "theory" && (
                          <div className="prose prose-slate dark:prose-invert max-w-none">
                            <p className="text-sm leading-7 text-slate-700 dark:text-slate-200">{activeStep.theoryText}</p>
                          </div>
                        )}

                        {activeStep.kind === "quiz" && (
                          <div className="space-y-2">
                            {activeStep.options.map((option) => (
                              <button
                                key={option}
                                onClick={() => setStepAnswer(option)}
                                className={`w-full text-left rounded-lg p-3 border transition ${stepAnswer === option
                                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                                  : "border-slate-200 dark:border-slate-700 hover:border-slate-400"}`}
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                        )}

                        {activeStep.kind === "code" && (
                          <textarea
                            value={stepAnswer}
                            onChange={(event) => setStepAnswer(event.target.value)}
                            className="w-full h-64 bg-[#0f172a] text-emerald-100 outline-none resize-none text-sm p-4 font-mono rounded-lg"
                            placeholder="Введите решение шага..."
                          />
                        )}

                        <div className="flex flex-col md:flex-row md:items-center gap-3">
                          <Button onClick={submitStep} disabled={stepLoading}>
                            {stepLoading ? "Проверка..." : submitLabel}
                          </Button>
                          {stepMessage && <p className="text-sm text-emerald-700 dark:text-emerald-300">{stepMessage}</p>}
                          {stepError && <p className="text-sm text-red-700 dark:text-rose-300">{stepError}</p>}
                        </div>

                        <div className="pt-3 border-t border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-2">
                          <Button
                            variant="outline"
                            disabled={!previousStep}
                            onClick={() => {
                              if (!previousStep) {
                                return
                              }
                              const progress = courseContent.progress.find((item) => item.stepId === previousStep.id)
                              setSelectedStepId(previousStep.id)
                              setStepAnswer(progress?.answerText || "")
                              setStepError("")
                              setStepMessage("")
                            }}
                          >
                            Предыдущий шаг
                          </Button>
                          <Button
                            variant="outline"
                            disabled={!nextStep}
                            onClick={() => {
                              if (!nextStep) {
                                return
                              }
                              const progress = courseContent.progress.find((item) => item.stepId === nextStep.id)
                              setSelectedStepId(nextStep.id)
                              setStepAnswer(progress?.answerText || "")
                              setStepError("")
                              setStepMessage("")
                            }}
                          >
                            Следующий шаг
                          </Button>
                        </div>

                        <div className="pt-3 border-t border-slate-200/80 dark:border-slate-700/80 space-y-2">
                          <p className="text-sm font-semibold">История попыток по шагу</p>
                          {selectedAttempts.length === 0 && (
                            <p className="text-sm text-slate-500">Пока нет попыток по этому шагу.</p>
                          )}
                          {selectedAttempts.slice(0, 6).map((attempt) => (
                            <div key={attempt.id} className="rounded-lg border border-slate-200/80 dark:border-slate-700/80 p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className={`text-xs px-2 py-1 rounded ${attempt.passed ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                                  {attempt.passed ? "Принято" : "Не принято"}
                                </span>
                                <span className="text-xs text-slate-500">{new Date(attempt.createdAt).toLocaleString()}</span>
                              </div>
                              <p className="text-sm mt-2 text-slate-700 dark:text-slate-200">{attempt.feedback}</p>
                              {attempt.answer && (
                                <p className="text-xs mt-2 text-slate-500 line-clamp-2">Ответ: {attempt.answer}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </Card>

              <div id="course-discussion">
              <Card className="p-5 border border-slate-200/80 dark:border-slate-700/80 space-y-3">
                <div>
                  <p className="text-sm font-semibold">Обсуждение шага</p>
                  <p className="text-xs text-slate-500 mt-1">Задавайте вопросы по материалу и решениям. Формулируйте проблему и ожидаемое поведение.</p>
                </div>

                <div className="flex flex-col md:flex-row gap-2">
                  <textarea
                    value={discussionText}
                    onChange={(event) => setDiscussionText(event.target.value)}
                    placeholder="Напишите вопрос по текущему шагу..."
                    className="w-full h-24 rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-white/90 dark:bg-slate-900/60 p-3 outline-none"
                  />
                  <Button className="md:self-end" onClick={postDiscussionMessage}>Отправить</Button>
                </div>

                <div className="space-y-2">
                  {discussionMessages.map((message) => (
                    <div key={message.id} className="rounded-lg border border-slate-200/80 dark:border-slate-700/80 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{message.author}</p>
                        <p className="text-xs text-slate-500">{new Date(message.createdAt).toLocaleString()}</p>
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-200 mt-2">{message.text}</p>
                    </div>
                  ))}
                </div>
              </Card>
              </div>
            </div>

            <div id="course-syllabus">
            <Card className="p-4 border border-slate-200/80 dark:border-slate-700/80 xl:sticky xl:top-24 h-fit">
              <p className="text-sm font-semibold mb-3">Содержание курса</p>
              <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
                {syllabusModules.map((module) => (
                  <details key={module.id} open className="rounded-lg border border-slate-200/80 dark:border-slate-700/80 p-2">
                    <summary className="cursor-pointer select-none text-sm font-medium">{module.title}</summary>
                    <div className="mt-2 space-y-2">
                      {module.lessons.map((lesson) => (
                        <div key={lesson.id} className="rounded-md bg-slate-50/80 dark:bg-slate-800/40 p-2">
                          <p className="text-xs uppercase tracking-wide text-slate-500">{lesson.title}</p>
                          <div className="mt-1 space-y-1">
                            {lesson.steps.map((step) => {
                              const progress = courseContent?.progress.find((item) => item.stepId === step.id)
                              const done = progress?.status === "completed"
                              return (
                                <button
                                  key={step.id}
                                  onClick={() => {
                                    setSelectedStepId(step.id)
                                    setStepAnswer(progress?.answerText || "")
                                    setStepError("")
                                    setStepMessage("")
                                  }}
                                  className={`w-full text-left rounded-md p-2 border text-sm transition ${selectedStepId === step.id
                                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                                    : "border-slate-200/80 dark:border-slate-700/80 hover:border-slate-400"}`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <p className="text-xs text-slate-500">Шаг {step.stepOrder}</p>
                                      <p className="mt-0.5">{step.title}</p>
                                    </div>
                                    {done ? <CheckCircle2 size={14} className="text-emerald-600 mt-0.5" /> : <Circle size={14} className="text-slate-400 mt-0.5" />}
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
                {!courseContent?.steps.length && !contentLoading && !contentError && (
                  <p className="text-sm text-slate-500">Для курса пока нет шагов.</p>
                )}
              </div>
            </Card>
            </div>
          </div>
        </motion.div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>

      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="px-4 md:px-0 space-y-6"
      >

        <motion.div
          variants={fadeInUp}
          className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between"
        >
          <h2 className="text-xl md:text-2xl font-bold">
            Каталог курсов
          </h2>

          <Button onClick={() => setCreateModalOpen(true)}>
            + Добавить в мои
          </Button>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card className="mb-4 space-y-3 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-red-600/10 via-rose-500/10 to-orange-500/10 pointer-events-none" />
            <div className="relative space-y-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Stepashka Learning Commerce</p>
              <h3 className="text-xl font-bold">Курсы, которые приводят к трудоустройству и росту дохода</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Продаваемая витрина для клиента: четкий learning path, практические задания и метрики прогресса, которые легко объяснить бизнесу.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="rounded-xl glass-panel p-3">
                  <p className="text-xs text-slate-500">Опубликованные программы</p>
                  <p className="text-lg font-bold">{publishedCoursesCount}</p>
                </div>
                <div className="rounded-xl glass-panel p-3">
                  <p className="text-xs text-slate-500">Платные курсы</p>
                  <p className="text-lg font-bold">{paidCoursesCount}</p>
                </div>
                <div className="rounded-xl glass-panel p-3">
                  <p className="text-xs text-slate-500">Средний рейтинг</p>
                  <p className="text-lg font-bold">4.8/5</p>
                </div>
              </div>
            </div>
          </Card>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск курса по названию"
            className="w-full md:max-w-md px-4 py-3 rounded-xl glass-panel outline-none"
          />
        </motion.div>

        <motion.div
          variants={fadeInUp}
          className="flex flex-wrap gap-2 md:gap-3"
        >
          {["Все", "Frontend", "Backend"].map((f) => (
            <Button
              key={f}
              variant={active === f ? "primary" : "outline"}
              onClick={() => setActive(f)}
            >
              {f}
            </Button>
          ))}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {loading && (
            <>
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-64 w-full" />
            </>
          )}

          {!loading && error && (
            <Card><p className="text-sm text-red-700 dark:text-rose-300">{error}</p></Card>
          )}

          {!loading && !error && searched.map((course) => (
            <Card
              key={course.id}
              className="p-0 overflow-hidden border border-slate-200/80 dark:border-slate-700/80"
            >
              <div className="h-24 bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 border-b border-slate-200/80 dark:border-slate-700/80" />

              <div className="p-5">
                <div>
                  <h3 className="font-semibold text-lg leading-6">
                    {course.title}
                  </h3>

                  <p className="text-sm text-slate-500 mt-1">
                    {course.lessons} уроков • {course.type} • {course.level} • автор: {course.author}
                  </p>
                  {typeof course.published === "boolean" && (
                    <span className={`inline-flex mt-2 text-xs px-2 py-1 rounded-lg ${course.published ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                      {course.published ? "опубликован" : "черновик"}
                    </span>
                  )}
                  <p className="text-xs text-slate-500 mt-2">
                    Для кого: {course.level === "Начальный" ? "новички и смена профессии" : course.level === "Средний" ? "разработчики с базой" : "инженеры для senior-трека"}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Результат: {course.type === "Frontend" ? "коммерческий UI-проект в портфолио" : "production-ready API и архитектурный кейс"}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-300">
                  <span className="inline-flex items-center gap-1"><Star size={13} /> {course.rating}</span>
                  <span className="inline-flex items-center gap-1"><Users size={13} /> {course.students}</span>
                  <span className="inline-flex items-center gap-1"><Clock3 size={13} /> {course.duration}</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200">{course.price}</span>
                </div>

                <div className="w-full mt-5">

                  <progress
                    value={course.progress}
                    max={100}
                    className="w-full h-2 rounded-full overflow-hidden [&::-webkit-progress-bar]:bg-slate-200/70 dark:[&::-webkit-progress-bar]:bg-slate-700/70 [&::-webkit-progress-value]:bg-emerald-500"
                  />

                  <p className="text-xs text-slate-500 mt-1">
                    Прогресс: {course.progress}%
                  </p>

                </div>

                <div className="w-full md:w-auto mt-4 flex flex-col md:flex-row gap-2">
                  <Button variant="outline" className="w-full md:w-auto" onClick={() => openCourse(course.id)}>
                    Перейти к урокам
                  </Button>
                  <Button className="w-full md:w-auto" onClick={() => enrollCourse(course.id)}>
                    Записаться
                  </Button>
                </div>

              </div>

            </Card>
          ))}

          {!loading && !error && searched.length === 0 && (
            <EmptyState
              title="Курсы не найдены"
              description="Измените запрос поиска или добавьте новый курс."
            />
          )}

        </div>

        {actionMessage && (
          <Card>
            <p className="text-sm text-red-700 dark:text-rose-300">{actionMessage}</p>
          </Card>
        )}

        <Modal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Создать курс">
          <div className="space-y-4">
            <input
              value={newCourseTitle}
              onChange={(event) => setNewCourseTitle(event.target.value)}
              placeholder="Название курса"
              className="w-full px-4 py-3 rounded-xl glass-panel outline-none"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                value={newCourseType}
                onChange={(event) => setNewCourseType(event.target.value)}
                aria-label="Course type"
                className="px-4 py-3 rounded-xl glass-panel outline-none"
              >
                <option>Frontend</option>
                <option>Backend</option>
              </select>

              <select
                value={newCourseLevel}
                onChange={(event) => setNewCourseLevel(event.target.value)}
                aria-label="Course level"
                className="px-4 py-3 rounded-xl glass-panel outline-none"
              >
                <option>Начальный</option>
                <option>Средний</option>
                <option>Продвинутый</option>
              </select>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateModalOpen(false)}>Отмена</Button>
              <Button onClick={createCourse}>Создать</Button>
            </div>
          </div>
        </Modal>

      </motion.div>

    </MainLayout>
  )
}