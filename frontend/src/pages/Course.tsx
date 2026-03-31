import MainLayout from "../layout/MainLayout"
import { motion } from "framer-motion"
import { useEffect, useMemo, useRef, useState, cloneElement } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import Card from "../components/ui/Card"
import Button from "../components/ui/Button"
import { Users, Star, Clock3, Search, Code2, GraduationCap, Palette, FlaskConical, Container, BarChart3, ShieldCheck, Sparkles, X, SlidersHorizontal } from "lucide-react"
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
  accessType?: string
  coverUrl?: string
  description?: string
  category?: string
}

type CourseDetail = {
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
}

type EnrollmentStatus = {
  enrolled: boolean
  status?: string
  progress?: number
  requestStatus?: string | null
  teacherComment?: string | null
}

type CourseStep = {
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
  const [searchParams] = useSearchParams()
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
  const [stepCheckResults, setStepCheckResults] = useState<Array<{ name: string; passed: boolean }> | null>(null)
  const [actionMessage, setActionMessage] = useState("")
  const [search, setSearch] = useState("")
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [newCourseTitle, setNewCourseTitle] = useState("")
  const [newCourseType, setNewCourseType] = useState("Frontend")
  const [newCourseLevel, setNewCourseLevel] = useState("Начальный")
  const [attemptHistory, setAttemptHistory] = useState<AttemptEntry[]>([])
  const [attemptFilter, setAttemptFilter] = useState<"all" | "passed" | "failed">("all")
  const [autoAdvance, setAutoAdvance] = useState(true)
  const [discussionText, setDiscussionText] = useState("")
  const [openModules, setOpenModules] = useState<Record<number, boolean>>({})
  const [enrollmentStatus, setEnrollmentStatus] = useState<EnrollmentStatus | null>(null)
  const [courseDetail, setCourseDetail] = useState<CourseDetail | null>(null)
  const [enrollRequestMessage, setEnrollRequestMessage] = useState("")
  const [enrollRequestLoading, setEnrollRequestLoading] = useState(false)
  const [discussionMessages, setDiscussionMessages] = useState<DiscussionMessage[]>([
    {
      id: 1,
      author: "Куратор",
      text: "Пишите вопросы по шагу: по теории, тесту или коду. Отвечаем по существу и с примерами.",
      createdAt: new Date().toISOString(),
    },
  ])
  const toast = useToast()

  const requestedStepId = useMemo(() => {
    const value = Number(searchParams.get("step") || 0)
    return Number.isInteger(value) && value > 0 ? value : null
  }, [searchParams])

  const loadCourses = async () => {
    setLoading(true)
    setError("")
    try {
      const data = await api.get<CourseItem[]>("/courses")

      // Try to merge real user progress from enrollments
      try {
        const progressMap = await api.get<Record<number, number>>("/my-progress")
        for (const course of data) {
          if (progressMap[course.id] !== undefined) {
            course.progress = progressMap[course.id]
          }
        }
      } catch {
        // Not logged in or endpoint unavailable — keep progress at 0
      }

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

    try {
      const data = await api.get<CourseContentResponse>(`/courses/${courseId}/steps`)
      setCourseContent(data)

      const firstStepId = data.steps[0]?.id ?? null
      const selectedStillExists = data.steps.some((step) => step.id === selectedStepId)
      const requestStepExists = requestedStepId && data.steps.some((step) => step.id === requestedStepId)

      if (requestStepExists) {
        setSelectedStepId(requestedStepId)
      } else {
        setSelectedStepId(selectedStillExists ? selectedStepId : firstStepId)
      }

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
      setEnrollmentStatus(null)
      setCourseDetail(null)
      setContentLoading(false)
      return
    }

    setContentLoading(true)
    void loadCourseContent(selectedCourseId)
    void loadEnrollmentStatus(selectedCourseId)
    void loadCourseDetail(selectedCourseId)
  }, [isCoursePage, selectedCourseId, requestedStepId])

  const loadEnrollmentStatus = async (courseId: number) => {
    try {
      const data = await api.get<EnrollmentStatus>(`/courses/${courseId}/enrollment-status`)
      setEnrollmentStatus(data)
    } catch {
      setEnrollmentStatus(null)
    }
  }

  const loadCourseDetail = async (courseId: number) => {
    try {
      const data = await api.get<CourseDetail>(`/courses/${courseId}/detail`)
      setCourseDetail(data)
    } catch {
      setCourseDetail(null)
    }
  }

  const requestEnrollment = async () => {
    if (!selectedCourseId) return
    setEnrollRequestLoading(true)
    try {
      const result = await api.post<{ success?: boolean; message?: string; error?: string }>(
        `/courses/${selectedCourseId}/request-enrollment`,
        { message: enrollRequestMessage }
      )
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(result.message || "Заявка отправлена")
        setEnrollRequestMessage("")
        await loadEnrollmentStatus(selectedCourseId)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось отправить заявку")
    } finally {
      setEnrollRequestLoading(false)
    }
  }

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
      const result = await api.post<{ success?: boolean; error?: string }>(`/courses/${courseId}/enroll`, {})
      if (result.error) {
        setActionMessage(result.error)
        toast.error(result.error)
      } else {
        setActionMessage("Вы успешно записались на курс")
        toast.success("Запись на курс выполнена")
        await loadCourses()
        if (isCoursePage && selectedCourseId === courseId) {
          await loadCourseContent(courseId)
          await loadEnrollmentStatus(courseId)
        }
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
    setStepCheckResults(null)

    const currentStepIndex = courseContent?.steps.findIndex((step) => step.id === selectedStepId) ?? -1
    const nextStepCandidateId =
      currentStepIndex >= 0 && courseContent && currentStepIndex < courseContent.steps.length - 1
        ? courseContent.steps[currentStepIndex + 1].id
        : null

    try {
      const response = await api.post<{
        passed: boolean
        feedback: string
        checkResults?: Array<{
          name: string
          passed: boolean
        }> | null
      }>(`/steps/${selectedStepId}/check`, { answer: stepAnswer })

      const failedChecks = (response.checkResults ?? []).filter((item) => !item.passed)
      const readableFailure = !response.passed && failedChecks.length > 0
        ? `Не пройдено ${failedChecks.length} тест(ов): ${failedChecks.map((item) => item.name).join(", ")}. Проверьте граничные случаи и формат возвращаемого значения.`
        : ""

      setStepMessage(response.feedback)
      setStepError(readableFailure)
      setStepCheckResults(response.checkResults ?? null)
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

      if (response.passed && autoAdvance && nextStepCandidateId) {
        selectStep(nextStepCandidateId, "")
        setStepMessage("Шаг принят. Перешли к следующему шагу автоматически.")
      }
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
  const selectedAttempts = attemptHistory.filter((item) => item.stepId === selectedStepId)
  const visibleAttempts = selectedAttempts.filter((item) => {
    if (attemptFilter === "passed") {
      return item.passed
    }
    if (attemptFilter === "failed") {
      return !item.passed
    }
    return true
  })

  const latestAttemptAnswer = selectedAttempts[0]?.answer || ""
  const currentAnswer = stepAnswer || ""
  const diffPreview = useMemo(() => {
    if (!latestAttemptAnswer) {
      return null
    }

    const previousLines = latestAttemptAnswer.split("\n")
    const currentLines = currentAnswer.split("\n")
    const max = Math.max(previousLines.length, currentLines.length)
    let changed = 0
    let added = 0
    let removed = 0

    for (let i = 0; i < max; i += 1) {
      const before = previousLines[i] ?? ""
      const after = currentLines[i] ?? ""
      if (before !== after) {
        changed += 1
      }
      if (!before && after) {
        added += 1
      }
      if (before && !after) {
        removed += 1
      }
    }

    return { changed, added, removed }
  }, [currentAnswer, latestAttemptAnswer])

  const remainingStepsCount = Math.max((courseContent?.summary.total ?? 0) - (courseContent?.summary.completed ?? 0), 0)
  const averageStepXp = courseContent?.steps.length
    ? Math.round(courseContent.steps.reduce((sum, step) => sum + step.xp, 0) / courseContent.steps.length)
    : 0
  const estimatedRemainingXp = remainingStepsCount * averageStepXp

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

  const syllabusSectionRef = useRef<HTMLDivElement | null>(null)
  const discussionSectionRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (syllabusModules.length === 0) {
      setOpenModules({})
      return
    }

    setOpenModules((prev) => {
      const next: Record<number, boolean> = {}
      for (const module of syllabusModules) {
        next[module.id] = prev[module.id] ?? true
      }
      return next
    })
  }, [syllabusModules])

  const selectStep = (stepId: number, answerText = "") => {
    setSelectedStepId(stepId)
    setStepAnswer(answerText)
    setStepError("")
    setStepMessage("")
    setStepCheckResults(null)

    if (window.innerWidth < 1280) {
      setTimeout(() => {
        document.getElementById("active-step-container")?.scrollIntoView({ behavior: "smooth", block: "start" })
      }, 50)
    }
  }

  const scrollToSection = (section: "syllabus" | "discussion") => {
    const target = section === "syllabus" ? syllabusSectionRef.current : discussionSectionRef.current
    if (!target) {
      toast.error("Раздел сейчас недоступен")
      return
    }
    target.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const toggleModule = (moduleId: number) => {
    setOpenModules((prev) => ({
      ...prev,
      [moduleId]: !prev[moduleId],
    }))
  }

  const setAllModulesExpanded = (expanded: boolean) => {
    const next: Record<number, boolean> = {}
    for (const module of syllabusModules) {
      next[module.id] = expanded
    }
    setOpenModules(next)
  }

  const postDiscussionMessage = () => {
    const text = discussionText.trim()
    if (!text) {
      toast.error("Введите текст сообщения")
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
    if (contentLoading && !courseContent) {
      return (
        <MainLayout>
          <div className="px-4 md:px-0 space-y-5 animate-pulse">
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/90 dark:bg-slate-900/70 p-4 md:p-5">
              <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded mb-3" />
              <div className="h-7 w-64 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
              <div className="h-4 w-96 bg-slate-100 dark:bg-slate-800 rounded" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-slate-200/80 dark:border-slate-700/70 p-3 bg-slate-50/70 dark:bg-slate-800/50">
                    <div className="h-3 w-12 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
                    <div className="h-6 w-8 bg-slate-200 dark:bg-slate-700 rounded" />
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_330px] gap-4">
              <div className="h-64 rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
              <div className="h-64 rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
            </div>
          </div>
        </MainLayout>
      )
    }

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

            <div className="mt-3 rounded-xl border border-slate-200/80 dark:border-slate-700/70 p-3 bg-slate-50/70 dark:bg-slate-800/45">
              <p className="text-xs text-slate-500">До завершения курса</p>
              <p className="text-sm mt-1">
                Осталось шагов: <span className="font-semibold">{remainingStepsCount}</span>
                {estimatedRemainingXp > 0 ? <span className="text-slate-500"> • примерно {estimatedRemainingXp} XP</span> : null}
              </p>
            </div>

            {courseDetail && courseDetail.accessType !== "open" && (
              <div className="mt-3 rounded-xl border border-amber-200/80 dark:border-amber-700/40 p-3 bg-amber-50/70 dark:bg-amber-900/20">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                  {courseDetail.accessType === "invite_only" ? "Курс по приглашению" : "Модерируемый курс"}
                </p>
                <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                  {courseDetail.accessType === "invite_only"
                    ? "Доступ к курсу возможен только после одобрения преподавателем."
                    : "Для записи необходимо отправить заявку и получить одобрение."}
                </p>
              </div>
            )}

            {enrollmentStatus && !enrollmentStatus.enrolled && enrollmentStatus.requestStatus === "pending" && (
              <div className="mt-3 rounded-xl border border-blue-200/80 dark:border-blue-700/40 p-3 bg-blue-50/70 dark:bg-blue-900/20">
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Ваша заявка на рассмотрении</p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Преподаватель рассмотрит вашу заявку и примет решение.</p>
              </div>
            )}

            {enrollmentStatus && !enrollmentStatus.enrolled && enrollmentStatus.requestStatus === "rejected" && (
              <div className="mt-3 rounded-xl border border-red-200/80 dark:border-red-700/40 p-3 bg-red-50/70 dark:bg-red-900/20">
                <p className="text-sm font-medium text-red-700 dark:text-red-300">Заявка отклонена</p>
                {enrollmentStatus.teacherComment && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">Комментарий: {enrollmentStatus.teacherComment}</p>
                )}
                <p className="text-xs text-slate-500 mt-2">Вы можете отправить заявку повторно.</p>
              </div>
            )}

            {courseDetail && courseDetail.accessType !== "open" && enrollmentStatus && !enrollmentStatus.enrolled && enrollmentStatus.requestStatus !== "pending" && (
              <div className="mt-3 rounded-xl border border-slate-200/80 dark:border-slate-700/70 p-4 bg-white/70 dark:bg-slate-800/40 space-y-3">
                <p className="text-sm font-medium">Запросить доступ к курсу</p>
                <textarea
                  value={enrollRequestMessage}
                  onChange={(e) => setEnrollRequestMessage(e.target.value)}
                  placeholder="Расскажите о себе и вашей мотивации (необязательно)..."
                  className="w-full h-20 rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-white/90 dark:bg-slate-900/60 p-3 text-sm outline-none"
                />
                <Button onClick={requestEnrollment} disabled={enrollRequestLoading}>
                  {enrollRequestLoading ? "Отправка..." : "Отправить заявку"}
                </Button>
              </div>
            )}
          </motion.div>

          <motion.div variants={fadeInUp} className="sticky top-2 z-20 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/95 dark:bg-slate-900/95 px-3 py-2">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div className="text-sm text-slate-600 dark:text-slate-300">
                <span className="font-medium">Курсы</span> / <span>{courseContent?.course.title || "Курс"}</span> / <span className="text-slate-900 dark:text-slate-100">{activeStep?.title || "Шаг"}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => scrollToSection("syllabus")}>Оглавление</Button>
                <Button variant="outline" onClick={() => scrollToSection("discussion")}>Обсуждение</Button>
                <Button onClick={submitStep} disabled={stepLoading || !activeStep}>{stepLoading ? "Проверка..." : "Проверить шаг"}</Button>
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_330px] gap-4">
            <div id="active-step-container" className="space-y-4 scroll-mt-24">
              <Card className="p-5 border border-slate-200/80 dark:border-slate-700/80">
                {contentLoading && <p className="text-sm text-slate-500">Загрузка структуры курса...</p>}

                {!contentLoading && contentError && (
                  <p className="text-sm text-red-700 dark:text-red-300">{contentError}</p>
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
                          <p className="text-sm mt-2 text-slate-700 dark:text-slate-200">
                            Тип задания: <span className="font-semibold">{activeStep.taskTypeLabel || stepKindLabel}</span>
                          </p>
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
                                type="button"
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
                          <div className="space-y-3">
                            <div className="rounded-lg border border-slate-200/80 dark:border-slate-700/80 p-3 bg-slate-50/70 dark:bg-slate-800/40">
                              <p className="text-sm font-semibold">Что нужно реализовать</p>
                              <p className="text-sm text-slate-700 dark:text-slate-200 mt-1">{activeStep.theoryText || "Реализуйте решение согласно условию задания."}</p>
                              <p className="text-xs text-slate-500 mt-2">Проверка выполняется по {activeStep.checkCount || activeStep.checks?.length || 1} тестам.</p>
                              {activeStep.checks && activeStep.checks.length > 0 && (
                                <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200 list-disc pl-5">
                                  {activeStep.checks.map((check) => (
                                    <li key={check}>{check}</li>
                                  ))}
                                </ul>
                              )}
                            </div>

                            <textarea
                              value={stepAnswer}
                              onChange={(event) => setStepAnswer(event.target.value)}
                              className="w-full h-64 bg-[#0f172a] text-emerald-100 outline-none resize-none text-sm p-4 font-mono rounded-lg"
                              placeholder="Введите код решения..."
                            />
                          </div>
                        )}

                        <div className="flex flex-col md:flex-row md:items-center gap-3">
                          <Button onClick={submitStep} disabled={stepLoading}>
                            {stepLoading ? "Проверка..." : submitLabel}
                          </Button>
                          <label className="inline-flex items-center gap-2 text-xs text-slate-500">
                            <input
                              type="checkbox"
                              checked={autoAdvance}
                              onChange={(event) => setAutoAdvance(event.target.checked)}
                            />
                            Автопереход к следующему шагу
                          </label>
                          {stepMessage && <p className="text-sm text-emerald-700 dark:text-emerald-300">{stepMessage}</p>}
                          {stepError && <p className="text-sm text-red-700 dark:text-red-300">{stepError}</p>}
                        </div>

                        {diffPreview && (
                          <div className="rounded-lg border border-slate-200/80 dark:border-slate-700/80 p-3 bg-slate-50/70 dark:bg-slate-800/35">
                            <p className="text-sm font-semibold">Изменения относительно последней попытки</p>
                            <p className="text-xs text-slate-500 mt-1">Изменено строк: {diffPreview.changed} • Добавлено: {diffPreview.added} • Удалено: {diffPreview.removed}</p>
                          </div>
                        )}

                        {activeStep.kind === "code" && stepCheckResults && stepCheckResults.length > 0 && (
                          <div className="rounded-lg border border-slate-200/80 dark:border-slate-700/80 p-3 space-y-2">
                            <p className="text-sm font-semibold">Результат проверки по тестам</p>
                            {stepCheckResults.map((check) => (
                              <div key={check.name} className="flex items-center justify-between gap-3 text-sm">
                                <span className="text-slate-700 dark:text-slate-200">{check.name}</span>
                                <span className={check.passed ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}>
                                  {check.passed ? "Пройден" : "Провален"}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="pt-3 border-t border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-2">
                          <Button
                            variant="outline"
                            disabled={!previousStep}
                            onClick={() => {
                              if (!previousStep) {
                                return
                              }
                              const progress = courseContent.progress.find((item) => item.stepId === previousStep.id)
                              selectStep(previousStep.id, progress?.answerText || "")
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
                              selectStep(nextStep.id, progress?.answerText || "")
                            }}
                          >
                            Следующий шаг
                          </Button>
                        </div>

                        <div className="pt-3 border-t border-slate-200/80 dark:border-slate-700/80 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold">История попыток по шагу</p>
                            <div className="flex gap-1">
                              {(["all", "passed", "failed"] as const).map((filter) => (
                                <button
                                  key={filter}
                                  type="button"
                                  onClick={() => setAttemptFilter(filter)}
                                  className={`text-xs px-2 py-1 rounded-md border ${attemptFilter === filter
                                    ? "border-red-500 text-red-700 dark:text-red-300"
                                    : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300"}`}
                                >
                                  {filter === "all" ? "Все" : filter === "passed" ? "Успешные" : "Ошибки"}
                                </button>
                              ))}
                            </div>
                          </div>
                          {visibleAttempts.length === 0 && (
                            <p className="text-sm text-slate-500">Пока нет попыток по этому шагу.</p>
                          )}
                          {visibleAttempts.slice(0, 6).map((attempt) => (
                            <div key={attempt.id} className="rounded-lg border border-slate-200/80 dark:border-slate-700/80 p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className={`text-xs px-2 py-1 rounded ${attempt.passed ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"}`}>
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

              <div id="course-discussion" ref={discussionSectionRef} className="scroll-mt-24">
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
                  <Button className="md:self-end" onClick={postDiscussionMessage} disabled={!discussionText.trim()}>Отправить</Button>
                </div>

                <div className="space-y-2">
                  {discussionMessages.map((message) => (
                    <div key={message.id} className="rounded-lg border border-slate-200/80 dark:border-slate-700/80 p-3">
                      <div className="flex items-start gap-3">
                        <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-rose-500 to-red-700 flex items-center justify-center text-white text-xs font-bold">
                          {message.author.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium">{message.author}</p>
                            <p className="text-xs text-slate-500 shrink-0">{new Date(message.createdAt).toLocaleString()}</p>
                          </div>
                          <p className="text-sm text-slate-700 dark:text-slate-200 mt-1">{message.text}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
              </div>
            </div>

            <div id="course-syllabus" ref={syllabusSectionRef} className="scroll-mt-24">
            <Card className="p-4 border border-slate-200/80 dark:border-slate-700/80 xl:sticky xl:top-24 h-fit">
              <div className="mb-3 flex items-center justify-between gap-2 min-w-0">
                <p className="text-sm font-semibold truncate">Содержание</p>
                <div className="flex gap-1 shrink-0">
                  <button type="button" onClick={() => setAllModulesExpanded(true)} className="px-2 py-1 text-xs rounded-lg border border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    Развернуть
                  </button>
                  <button type="button" onClick={() => setAllModulesExpanded(false)} className="px-2 py-1 text-xs rounded-lg border border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    Свернуть
                  </button>
                </div>
              </div>
              <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
                {syllabusModules.map((module) => (
                  <div key={module.id} className="rounded-lg border border-slate-200/80 dark:border-slate-700/80 p-2">
                    <button
                      type="button"
                      onClick={() => toggleModule(module.id)}
                      className="w-full text-left cursor-pointer select-none text-sm font-medium"
                    >
                      {module.title}
                    </button>

                    {openModules[module.id] && (
                      <div className="mt-2 space-y-2">
                      {module.lessons.map((lesson) => (
                        <div key={lesson.id} className="rounded-md bg-slate-50/80 dark:bg-slate-800/40 p-2">
                          <p className="text-xs uppercase tracking-wide text-slate-500">{lesson.title}</p>
                          <div className="mt-1 space-y-1">
                            {lesson.steps.map((step) => {
                              const progress = courseContent?.progress.find((item) => item.stepId === step.id)
                              return (
                                <button
                                  type="button"
                                  key={step.id}
                                  onClick={() => {
                                    selectStep(step.id, progress?.answerText || "")
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
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                      </div>
                    )}
                  </div>
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

  const CATEGORY_META: Record<string, { label: string; icon: React.ReactNode; gradient: string; color: string }> = {
    Programming:  { label: "Программирование", icon: <Code2 size={18} />,          gradient: "from-sky-500 to-blue-600",     color: "text-sky-600 bg-sky-50 dark:text-sky-400 dark:bg-sky-900/30" },
    Design:       { label: "Дизайн",           icon: <Palette size={18} />,         gradient: "from-pink-500 to-rose-600",    color: "text-pink-600 bg-pink-50 dark:text-pink-400 dark:bg-pink-900/30" },
    "Data Science": { label: "Data Science",   icon: <FlaskConical size={18} />,    gradient: "from-violet-500 to-purple-600", color: "text-violet-600 bg-violet-50 dark:text-violet-400 dark:bg-violet-900/30" },
    DevOps:       { label: "DevOps",           icon: <Container size={18} />,       gradient: "from-orange-500 to-amber-600", color: "text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-900/30" },
    QA:           { label: "Тестирование",     icon: <ShieldCheck size={18} />,     gradient: "from-emerald-500 to-teal-600", color: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30" },
    Analytics:    { label: "Аналитика",        icon: <BarChart3 size={18} />,       gradient: "from-cyan-500 to-blue-600",    color: "text-cyan-600 bg-cyan-50 dark:text-cyan-400 dark:bg-cyan-900/30" },
  }

  const DEFAULT_CATEGORY_META = { label: "Другое", icon: <GraduationCap size={18} />, gradient: "from-slate-500 to-slate-600", color: "text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-800" }

  const getCatMeta = (cat: string) => CATEGORY_META[cat] ?? DEFAULT_CATEGORY_META

  // Unique categories from actual data
  const allCategories = useMemo(() => {
    const set = new Set(courses.map((c) => c.category || "").filter(Boolean))
    return Array.from(set).sort()
  }, [courses])

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const LEVELS = ["Начальный", "Средний", "Продвинутый"]

  const catalogFiltered = useMemo(() => {
    let result = courses
    if (selectedCategory) {
      result = result.filter((c) => c.category === selectedCategory)
    }
    if (selectedLevel) {
      result = result.filter((c) => c.level === selectedLevel)
    }
    if (active !== "Все") {
      result = result.filter((c) => c.type === active)
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((c) =>
        c.title.toLowerCase().includes(q) ||
        (c.description || "").toLowerCase().includes(q) ||
        c.author.toLowerCase().includes(q) ||
        (c.category || "").toLowerCase().includes(q)
      )
    }
    return result
  }, [courses, selectedCategory, selectedLevel, active, search])

  const activeFiltersCount = [selectedCategory, selectedLevel, active !== "Все" ? active : null].filter(Boolean).length

  const clearFilters = () => {
    setSelectedCategory(null)
    setSelectedLevel(null)
    setActive("Все")
    setSearch("")
  }

  return (
    <MainLayout>

      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="px-4 md:px-0 space-y-6 pb-10"
      >

        {/* Hero header */}
        <motion.div variants={fadeInUp} className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-900 via-red-800 to-slate-900 dark:from-red-950 dark:via-slate-900 dark:to-black p-6 md:p-10">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvc3ZnPg==')] opacity-60" />
          <div className="relative">
            <h1 className="text-2xl md:text-4xl font-bold text-white">Каталог курсов</h1>
            <p className="text-slate-300 mt-2 text-sm md:text-base max-w-xl">
              {publishedCoursesCount} курсов по программированию, дизайну, аналитике и другим направлениям
            </p>

            {/* Search bar */}
            <div className="mt-5 relative max-w-2xl">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Поиск по названию, описанию, автору..."
                className="w-full pl-11 pr-4 py-3 md:py-3.5 rounded-xl bg-white/15 border border-white/20 text-white placeholder-white/60 outline-none focus:border-red-400/40 transition text-sm"
              />
            </div>
          </div>
        </motion.div>

        {/* Category chips (horizontal scroll) */}
        <motion.div variants={fadeInUp}>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={14} className="text-red-600" />
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Направления</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                !selectedCategory
                  ? "bg-gradient-to-r from-red-600 to-red-700 text-white shadow-md dark:from-red-600 dark:to-red-700"
                  : "bg-white border border-slate-200 text-slate-600 hover:border-red-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
              }`}
            >
              Все направления
            </button>
            {allCategories.map((cat) => {
              const meta = getCatMeta(cat)
              const isSelected = selectedCategory === cat
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(isSelected ? null : cat)}
                  className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    isSelected
                      ? "bg-gradient-to-r from-red-600 to-red-700 text-white shadow-md dark:from-red-600 dark:to-red-700"
                      : "bg-white border border-slate-200 text-slate-600 hover:border-red-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
                  }`}
                >
                  {meta.icon}
                  {meta.label}
                  <span className="text-xs opacity-60">
                    {courses.filter((c) => c.category === cat).length}
                  </span>
                </button>
              )
            })}
          </div>
        </motion.div>

        {/* Filters row */}
        <motion.div variants={fadeInUp} className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
          >
            <SlidersHorizontal size={13} />
            Фильтры
            {activeFiltersCount > 0 && (
              <span className="ml-1 bg-red-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </button>

          {/* Level pills */}
          {showFilters && (
            <>
              <span className="text-xs text-slate-400 ml-1">Уровень:</span>
              {LEVELS.map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setSelectedLevel(selectedLevel === lvl ? null : lvl)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    selectedLevel === lvl
                      ? "bg-gradient-to-r from-red-600 to-red-700 text-white dark:from-red-600 dark:to-red-700"
                      : "bg-white border border-slate-200 text-slate-500 hover:border-red-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400"
                  }`}
                >
                  {lvl}
                </button>
              ))}

              <span className="text-xs text-slate-400 ml-2">Тип:</span>
              {["Frontend", "Backend"].map((t) => (
                <button
                  key={t}
                  onClick={() => setActive(active === t ? "Все" : t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    active === t
                      ? "bg-gradient-to-r from-red-600 to-red-700 text-white dark:from-red-600 dark:to-red-700"
                      : "bg-white border border-slate-200 text-slate-500 hover:border-red-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400"
                  }`}
                >
                  {t}
                </button>
              ))}
            </>
          )}

          {activeFiltersCount > 0 && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
            >
              <X size={12} />
              Сбросить
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-slate-400">
              {catalogFiltered.length} из {courses.length} курсов
            </span>
            <Button onClick={() => setCreateModalOpen(true)} className="text-xs">+ Добавить курс</Button>
          </div>
        </motion.div>

        {/* Course grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">

          {loading && Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-80 w-full rounded-2xl" />
          ))}

          {!loading && error && (
            <Card className="col-span-full"><p className="text-sm text-red-700 dark:text-red-300">{error}</p></Card>
          )}

          {!loading && !error && catalogFiltered.map((course) => {
            const catMeta = getCatMeta(course.category || "")
            return (
              <motion.div
                key={course.id}
                variants={fadeInUp}
                whileHover={{ y: -4 }}
                className="group cursor-pointer"
                onClick={() => openCourse(course.id)}
              >
                <div className="rounded-2xl overflow-hidden border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-slate-900 shadow-sm hover:shadow-xl transition-all h-full flex flex-col">

                  {/* Cover */}
                  {course.coverUrl ? (
                    <div className="h-36 overflow-hidden relative">
                      <img
                        src={course.coverUrl}
                        alt={course.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute top-2 left-2">
                        <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg font-medium backdrop-blur-sm bg-white/80 dark:bg-slate-900/80 ${catMeta.color}`}>
                          {catMeta.icon} {catMeta.label}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className={`h-36 bg-gradient-to-br ${catMeta.gradient} flex flex-col items-center justify-center gap-2 relative`}>
                      <div className="text-white/70">{cloneElement(catMeta.icon as React.ReactElement<{ size?: number }>, { size: 36 })}</div>
                      <span className="text-white/60 text-[10px] font-medium uppercase tracking-wider">{catMeta.label}</span>
                    </div>
                  )}

                  {/* Content */}
                  <div className="p-4 flex-1 flex flex-col">
                    <h3 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-red-700 dark:group-hover:text-red-400 transition-colors">
                      {course.title}
                    </h3>

                    {course.description && (
                      <p className="text-[11px] text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">{course.description}</p>
                    )}

                    <p className="text-[11px] text-slate-400 mt-2">{course.author}</p>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">{course.level}</span>
                      {course.category && !course.coverUrl && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${catMeta.color}`}>{catMeta.label}</span>
                      )}
                    </div>

                    {/* Meta row */}
                    <div className="mt-auto pt-3 flex items-center gap-2 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-0.5 text-amber-500 font-semibold">
                        <Star size={11} fill="currentColor" /> {course.rating}
                      </span>
                      <span className="inline-flex items-center gap-0.5">
                        <Users size={11} /> {course.students}
                      </span>
                      <span className="inline-flex items-center gap-0.5">
                        <Clock3 size={11} /> {course.duration}
                      </span>
                    </div>

                    {/* Progress */}
                    {course.progress > 0 && (
                      <div className="mt-2">
                        <div className="w-full h-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${course.progress}%` }} />
                        </div>
                        <p className="text-[9px] text-slate-400 mt-0.5">{course.progress}% пройдено</p>
                      </div>
                    )}

                    {/* Footer: price + enroll */}
                    <div className="mt-2 flex items-center justify-between">
                      <span className={`text-sm font-bold ${course.price === "Бесплатно" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-800 dark:text-slate-200"}`}>
                        {course.price}
                      </span>
                      {course.progress === 0 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); enrollCourse(course.id) }}
                          className="text-[10px] px-3 py-1 rounded-full bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800 transition-all font-medium"
                        >
                          Записаться
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}

          {!loading && !error && catalogFiltered.length === 0 && (
            <div className="col-span-full">
              <EmptyState
                title="Курсы не найдены"
                description={search ? "Попробуйте изменить запрос или сбросить фильтры." : "Пока нет курсов в выбранной категории."}
              />
            </div>
          )}

        </div>

        {actionMessage && (
          <Card>
            <p className="text-sm text-red-700 dark:text-red-300">{actionMessage}</p>
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