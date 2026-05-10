import MainLayout from "../layout/MainLayout";


import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Users,
  Star,
  Clock3,
  Search,
  Code2,
  GraduationCap,
  Palette,
  FlaskConical,
  Container,
  BarChart3,
  ShieldCheck,
  X,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  BookOpen,
  Zap,
  ArrowLeft,
  ArrowRight,
  MessageSquare,
  ListOrdered,
  Check,
} from "lucide-react";
import { api } from "../lib/api";
import Modal from "../components/ui/Modal";
import { useToast } from "../hooks/useToast";
import { useAppStore } from "../store/AppStore";

type CourseItem = {
  id: number;
  title: string;
  lessons: number;
  progress: number;
  type: string;
  students: string;
  rating: string;
  duration: string;
  level: string;
  author: string;
  price: string;
  published?: boolean;
  accessType?: string;
  coverUrl?: string;
  description?: string;
  category?: string;
};

type CourseDetail = {
  id: number;
  title: string;
  slug: string;
  description: string;
  level: string;
  category: string;
  status: string;
  rating: number;
  studentsCount: number;
  durationHours: number;
  priceCents: number;
  currency: string;
  accessType: string;
  coverUrl: string;
  teacherName: string;
  teacherId: number;
  modules: Array<{ id: number; title: string; moduleOrder: number }>;
  lessonsCount: number;
  stepsCount: number;
};

type EnrollmentStatus = {
  enrolled: boolean;
  status?: string;
  progress?: number;
  requestStatus?: string | null;
  teacherComment?: string | null;
};

type CourseStep = {
  id: number;
  title: string;
  kind: "theory" | "quiz" | "code";
  taskTypeLabel?: string;
  theoryText: string;
  checks?: string[];
  checkCount?: number;
  options: string[];
  stepOrder: number;
  xp: number;
};

type StepProgress = {
  stepId: number;
  status: "started" | "completed";
  score: number;
  attempts: number;
  answerText: string;
  completedAt: string | null;
};

type CourseContentResponse = {
  course: {
    id: number;
    title: string;
    lessons: number;
    progress: number;
    type: string;
    level: string;
    author: string;
  };
  steps: CourseStep[];
  progress: StepProgress[];
  summary: {
    total: number;
    completed: number;
    xp: number;
    percent: number;
  };
};

type AttemptEntry = {
  id: number;
  stepId: number;
  answer: string;
  passed: boolean;
  feedback: string;
  createdAt: string;
};

type DiscussionMessage = {
  id: number;
  author: string;
  text: string;
  createdAt: string;
};

const CATEGORY_META: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  Programming: {
    label: "Программирование",
    icon: <Code2 size={14} />,
    color: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20",
  },
  Design: {
    label: "Дизайн",
    icon: <Palette size={14} />,
    color: "text-pink-600 bg-pink-50 dark:text-pink-400 dark:bg-pink-900/20",
  },
  "Data Science": {
    label: "Data Science",
    icon: <FlaskConical size={14} />,
    color:
      "text-violet-600 bg-violet-50 dark:text-violet-400 dark:bg-violet-900/20",
  },
  DevOps: {
    label: "DevOps",
    icon: <Container size={14} />,
    color:
      "text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-900/20",
  },
  QA: {
    label: "Тестирование",
    icon: <ShieldCheck size={14} />,
    color:
      "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20",
  },
  Analytics: {
    label: "Аналитика",
    icon: <BarChart3 size={14} />,
    color: "text-cyan-600 bg-cyan-50 dark:text-cyan-400 dark:bg-cyan-900/20",
  },
};

const DEFAULT_CAT = {
  label: "Другое",
  icon: <GraduationCap size={14} />,
  color: "text-[var(--muted)] bg-[var(--surface)]",
};
const getCatMeta = (cat: string) => CATEGORY_META[cat] ?? DEFAULT_CAT;

export default function Course() {
  const navigate = useNavigate();
  const { courseId } = useParams<{ courseId?: string }>();
  const [searchParams] = useSearchParams();
  const selectedCourseId = courseId ? Number(courseId) : null;
  const isCoursePage =
    selectedCourseId !== null &&
    Number.isInteger(selectedCourseId) &&
    selectedCourseId > 0;

  const [active, setActive] = useState("Все");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [courseContent, setCourseContent] =
    useState<CourseContentResponse | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState("");
  const [selectedStepId, setSelectedStepId] = useState<number | null>(null);
  const [stepAnswer, setStepAnswer] = useState("");
  const [stepLoading, setStepLoading] = useState(false);
  const [stepError, setStepError] = useState("");
  const [stepMessage, setStepMessage] = useState("");
  const [stepCheckResults, setStepCheckResults] = useState<Array<{
    name: string;
    passed: boolean;
  }> | null>(null);
  const [search, setSearch] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newCourseTitle, setNewCourseTitle] = useState("");
  const [newCourseType, setNewCourseType] = useState("Frontend");
  const [newCourseLevel, setNewCourseLevel] = useState("Начальный");
  const [attemptHistory, setAttemptHistory] = useState<AttemptEntry[]>([]);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [discussionText, setDiscussionText] = useState("");
  const [openModules, setOpenModules] = useState<Record<number, boolean>>({});
  const [enrollmentStatus, setEnrollmentStatus] =
    useState<EnrollmentStatus | null>(null);
  const [courseDetail, setCourseDetail] = useState<CourseDetail | null>(null);
  const [enrollRequestMessage, setEnrollRequestMessage] = useState("");
  const [enrollRequestLoading, setEnrollRequestLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"content" | "discussion">(
    "content",
  );
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [viewTab, setViewTab] = useState<"all" | "my">("all");
  const [discussionMessages, setDiscussionMessages] = useState<
    DiscussionMessage[]
  >([
    {
      id: 1,
      author: "Куратор",
      text: "Пишите вопросы по шагу: по теории, тесту или коду.",
      createdAt: new Date().toISOString(),
    },
  ]);
  const toast = useToast();
  const { user } = useAppStore();
  const canCreateCourse = user?.role === "teacher" || user?.role === "admin";

  const courseCoverUrl = (course: { id: number; title: string; coverUrl?: string }) => {
    if (course.coverUrl && course.coverUrl.trim()) return course.coverUrl;
    const seed = `course-${course.id}-${(course.title || "").slice(0, 24)}`
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-");
    return `https://picsum.photos/seed/${encodeURIComponent(seed)}/960/540`;
  };

  const requestedStepId = useMemo(() => {
    const value = Number(searchParams.get("step") || 0);
    return Number.isInteger(value) && value > 0 ? value : null;
  }, [searchParams]);

  const loadCourses = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.get<CourseItem[]>("/courses");
      try {
        const progressMap =
          await api.get<Record<number, number>>("/my-progress");
        for (const course of data) {
          if (progressMap[course.id] !== undefined)
            course.progress = progressMap[course.id];
        }
      } catch {
        /* not logged in */
      }
      setCourses(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось загрузить курсы",
      );
    } finally {
      setLoading(false);
    }
  };

  const loadCourseContent = async (cId: number) => {
    setContentLoading(true);
    setContentError("");
    setStepError("");
    try {
      const data = await api.get<CourseContentResponse>(
        `/courses/${cId}/steps`,
      );
      setCourseContent(data);
      const firstStepId = data.steps[0]?.id ?? null;
      const selectedStillExists = data.steps.some(
        (s) => s.id === selectedStepId,
      );
      const requestStepExists =
        requestedStepId && data.steps.some((s) => s.id === requestedStepId);
      if (requestStepExists) setSelectedStepId(requestedStepId);
      else
        setSelectedStepId(selectedStillExists ? selectedStepId : firstStepId);
      if (!selectedStillExists) setStepAnswer("");
      setAttemptHistory((prev) =>
        prev.filter((a) => data.steps.some((s) => s.id === a.stepId)),
      );
    } catch (err) {
      setContentError(
        err instanceof Error ? err.message : "Не удалось загрузить шаги курса",
      );
    } finally {
      setContentLoading(false);
    }
  };

  const loadEnrollmentStatus = async (cId: number) => {
    try {
      const data = await api.get<EnrollmentStatus>(
        `/courses/${cId}/enrollment-status`,
      );
      setEnrollmentStatus(data);
    } catch {
      setEnrollmentStatus(null);
    }
  };

  const loadCourseDetail = async (cId: number) => {
    try {
      const data = await api.get<CourseDetail>(`/courses/${cId}/detail`);
      setCourseDetail(data);
    } catch {
      setCourseDetail(null);
    }
  };

  useEffect(() => {
    void loadCourses();
  }, []);

  useEffect(() => {
    if (!isCoursePage || !selectedCourseId) {
      setCourseContent(null);
      setSelectedStepId(null);
      setEnrollmentStatus(null);
      setCourseDetail(null);
      setContentLoading(false);
      return;
    }
    setContentLoading(true);
    void loadCourseContent(selectedCourseId);
    void loadEnrollmentStatus(selectedCourseId);
    void loadCourseDetail(selectedCourseId);
  }, [isCoursePage, selectedCourseId, requestedStepId]);

  const requestEnrollment = async () => {
    if (!selectedCourseId) return;
    setEnrollRequestLoading(true);
    try {
      const result = await api.post<{
        success?: boolean;
        message?: string;
        error?: string;
      }>(`/courses/${selectedCourseId}/request-enrollment`, {
        message: enrollRequestMessage,
      });
      if (result.error) toast.error(result.error);
      else {
        toast.success(result.message || "Заявка отправлена");
        setEnrollRequestMessage("");
        await loadEnrollmentStatus(selectedCourseId);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Не удалось отправить заявку",
      );
    } finally {
      setEnrollRequestLoading(false);
    }
  };

  const createCourse = async () => {
    if (!newCourseTitle.trim()) {
      setError("Введите название курса");
      return;
    }
    try {
      await api.post("/courses", {
        title: newCourseTitle.trim(),
        type: newCourseType,
        level: newCourseLevel,
      });
      await loadCourses();
      setCreateModalOpen(false);
      setNewCourseTitle("");
      toast.success("Курс создан");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Не удалось создать курс";
      setError(message);
      toast.error(message);
    }
  };

  const enrollCourse = async (cId: number) => {
    try {
      const result = await api.post<{ success?: boolean; error?: string }>(
        `/courses/${cId}/enroll`,
        {},
      );
      if (result.error) toast.error(result.error);
      else {
        toast.success("Запись на курс выполнена");
        await loadCourses();
        if (isCoursePage && selectedCourseId === cId) {
          await loadCourseContent(cId);
          await loadEnrollmentStatus(cId);
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось записаться");
    }
  };

  const submitStep = async () => {
    if (!selectedStepId || !selectedCourseId) return;
    setStepLoading(true);
    setStepError("");
    setStepMessage("");
    setStepCheckResults(null);
    const currentStepIndex =
      courseContent?.steps.findIndex((s) => s.id === selectedStepId) ?? -1;
    const nextStepCandidateId =
      currentStepIndex >= 0 &&
      courseContent &&
      currentStepIndex < courseContent.steps.length - 1
        ? courseContent.steps[currentStepIndex + 1].id
        : null;
    try {
      const response = await api.post<{
        passed: boolean;
        feedback: string;
        checkResults?: Array<{ name: string; passed: boolean }> | null;
      }>(`/steps/${selectedStepId}/check`, { answer: stepAnswer });
      const failedChecks = (response.checkResults ?? []).filter(
        (c) => !c.passed,
      );
      const readableFailure =
        !response.passed && failedChecks.length > 0
          ? `Не пройдено ${failedChecks.length} тест(ов): ${failedChecks.map((c) => c.name).join(", ")}.`
          : "";
      setStepMessage(response.feedback);
      setStepError(readableFailure);
      setStepCheckResults(response.checkResults ?? null);
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
      ]);
      if (response.passed) toast.success("Шаг принят");
      await Promise.all([loadCourseContent(selectedCourseId), loadCourses()]);
      if (response.passed && autoAdvance && nextStepCandidateId) {
        selectStep(nextStepCandidateId, "");
        setStepMessage("Шаг принят. Перешли к следующему.");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Не удалось проверить шаг";
      setStepError(message);
      toast.error(message);
    } finally {
      setStepLoading(false);
    }
  };

  const selectStep = (stepId: number, answerText = "") => {
    setSelectedStepId(stepId);
    setStepAnswer(answerText);
    setStepError("");
    setStepMessage("");
    setStepCheckResults(null);
  };

  const toggleModule = (moduleId: number) => {
    setOpenModules((prev) => ({ ...prev, [moduleId]: !prev[moduleId] }));
  };

  const postDiscussionMessage = () => {
    const text = discussionText.trim();
    if (!text) {
      toast.error("Введите текст сообщения");
      return;
    }
    setDiscussionMessages((prev) => [
      {
        id: Date.now(),
        author: "Вы",
        text,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    setDiscussionText("");
  };

  const activeStep =
    courseContent?.steps.find((s) => s.id === selectedStepId) ?? null;
  const activeProgress =
    courseContent?.progress.find((p) => p.stepId === selectedStepId) ?? null;
  const activeStepIndex =
    courseContent?.steps.findIndex((s) => s.id === selectedStepId) ?? -1;
  const previousStep =
    activeStepIndex > 0 && courseContent
      ? courseContent.steps[activeStepIndex - 1]
      : null;
  const nextStep =
    activeStepIndex >= 0 &&
    courseContent &&
    activeStepIndex < courseContent.steps.length - 1
      ? courseContent.steps[activeStepIndex + 1]
      : null;

  const submitLabel = activeStep
    ? activeStep.kind === "theory"
      ? "Отметить как изученный"
      : activeStep.kind === "quiz"
        ? "Проверить ответ"
        : "Отправить код"
    : "Проверить";

  const syllabusModules = useMemo(() => {
    if (!courseContent)
      return [] as Array<{
        id: number;
        title: string;
        lessons: Array<{ id: number; title: string; steps: CourseStep[] }>;
      }>;
    const lessons = new Map<
      number,
      { id: number; title: string; steps: CourseStep[] }
    >();
    for (const step of courseContent.steps) {
      const lessonIndex = Math.floor((step.stepOrder - 1) / 3) + 1;
      if (!lessons.has(lessonIndex))
        lessons.set(lessonIndex, {
          id: lessonIndex,
          title: `Урок ${lessonIndex}`,
          steps: [],
        });
      lessons.get(lessonIndex)?.steps.push(step);
    }
    const modulesMap = new Map<
      number,
      {
        id: number;
        title: string;
        lessons: Array<{ id: number; title: string; steps: CourseStep[] }>;
      }
    >();
    for (const lesson of Array.from(lessons.values())) {
      const moduleIndex = Math.floor((lesson.id - 1) / 2) + 1;
      if (!modulesMap.has(moduleIndex))
        modulesMap.set(moduleIndex, {
          id: moduleIndex,
          title: `Модуль ${moduleIndex}`,
          lessons: [],
        });
      modulesMap.get(moduleIndex)?.lessons.push(lesson);
    }
    return Array.from(modulesMap.values());
  }, [courseContent]);

  useEffect(() => {
    if (syllabusModules.length === 0) {
      setOpenModules({});
      return;
    }
    setOpenModules((prev) => {
      const next: Record<number, boolean> = {};
      for (const m of syllabusModules) next[m.id] = prev[m.id] ?? true;
      return next;
    });
  }, [syllabusModules]);

  // ─── Course detail view ───────────────────────────────────────────────────────
  if (isCoursePage) {
    if (contentLoading && !courseContent) {
      return (
        <MainLayout>
          <div className="space-y-4 max-w-5xl">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 rounded-2xl bg-[var(--surface)] animate-pulse"
              />
            ))}
          </div>
        </MainLayout>
      );
    }

    if (contentError && !courseContent) {
      return (
        <MainLayout>
          <div className="card p-6 max-w-lg">
            <p className="text-sm text-red-500 font-medium mb-4">
              {contentError}
            </p>
            <button
              onClick={() => navigate("/course")}
              className="btn-secondary text-sm px-4 py-2"
            >
              ← Назад к каталогу
            </button>
          </div>
        </MainLayout>
      );
    }

    const percent = courseContent?.summary.percent ?? 0;
    const completed = courseContent?.summary.completed ?? 0;
    const total = courseContent?.summary.total ?? 0;

    return (
      <MainLayout>
        <div className="max-w-6xl space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => navigate("/course")}
                className="w-9 h-9 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--text)] transition-colors shrink-0"
              >
                <ArrowLeft size={16} />
              </button>
              <div className="min-w-0">
                <h1 className="font-display font-bold text-xl text-[var(--text)] truncate">
                  {courseContent?.course.title ?? courseDetail?.title ?? "Курс"}
                </h1>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-[var(--muted)]">
                  <span>
                    {completed}/{total} шагов
                  </span>
                  <span className="text-primary font-semibold">{percent}%</span>
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="flex-1 max-w-xs">
              <div className="h-2 rounded-full bg-[var(--border)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-700"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Not enrolled */}
          {enrollmentStatus && !enrollmentStatus.enrolled && (
            <div className="card p-5 border-primary/20 bg-primary-50 dark:bg-primary-900/10">
              {enrollmentStatus.requestStatus === "pending" ? (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary shrink-0">
                    <BookOpen size={16} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-[var(--text)]">
                      Заявка на рассмотрении
                    </p>
                    <p className="text-xs text-[var(--muted)] mt-0.5">
                      Преподаватель рассмотрит вашу заявку
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="font-semibold text-sm text-[var(--text)]">
                    Запишитесь на курс, чтобы начать обучение
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => enrollCourse(selectedCourseId!)}
                      className="btn-primary px-4 py-2 text-sm"
                    >
                      Записаться
                    </button>
                    <div className="flex gap-2 flex-1 min-w-0">
                      <input
                        value={enrollRequestMessage}
                        onChange={(e) =>
                          setEnrollRequestMessage(e.target.value)
                        }
                        placeholder="Сообщение (необязательно)"
                        className="input-field px-3 py-2 text-sm flex-1 min-w-0"
                      />
                      <button
                        onClick={requestEnrollment}
                        disabled={enrollRequestLoading}
                        className="btn-secondary px-4 py-2 text-sm shrink-0"
                      >
                        {enrollRequestLoading ? "..." : "Запросить доступ"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Main layout: content + sidebar */}
          <div className="grid xl:grid-cols-[1fr_300px] gap-4">
            {/* Left: Step content */}
            <div className="space-y-4 min-w-0">
              {/* Step selector tabs */}
              <div className="flex gap-2 border-b border-[var(--border)] pb-1">
                <button
                  onClick={() => setActiveTab("content")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-t-lg transition-colors ${
                    activeTab === "content"
                      ? "text-primary border-b-2 border-primary -mb-[1px]"
                      : "text-[var(--muted)] hover:text-[var(--text)]"
                  }`}
                >
                  <BookOpen size={14} />
                  Шаг
                </button>
                <button
                  onClick={() => setActiveTab("discussion")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-t-lg transition-colors ${
                    activeTab === "discussion"
                      ? "text-primary border-b-2 border-primary -mb-[1px]"
                      : "text-[var(--muted)] hover:text-[var(--text)]"
                  }`}
                >
                  <MessageSquare size={14} />
                  Обсуждение
                </button>
              </div>

              {activeTab === "content" && (
                <>
                  {!activeStep && !contentLoading && (
                    <div className="card p-10 flex flex-col items-center justify-center text-center">
                      <BookOpen
                        size={32}
                        className="text-[var(--border)] mb-3"
                      />
                      <p className="font-semibold text-[var(--text)] mb-1">
                        Выберите шаг
                      </p>
                      <p className="text-sm text-[var(--muted)]">
                        Нажмите на шаг в содержании курса справа
                      </p>
                    </div>
                  )}

                  {activeStep && (
                    <div
                      className="card p-6 space-y-5"
                      id="active-step-container"
                    >
                      {/* Step header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span
                              className={`badge ${
                                activeStep.kind === "theory"
                                  ? "badge-neutral"
                                  : activeStep.kind === "quiz"
                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                    : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                              } text-[11px] px-2 py-0.5 rounded-md font-semibold`}
                            >
                              {activeStep.kind === "theory"
                                ? "Теория"
                                : activeStep.kind === "quiz"
                                  ? "Тест"
                                  : "Практика"}
                            </span>
                            <span className="text-xs text-[var(--muted)]">
                              Шаг {activeStep.stepOrder}
                            </span>
                            {activeStep.xp > 0 && (
                              <span className="flex items-center gap-0.5 text-xs font-semibold text-amber-500">
                                <Zap size={11} />
                                {activeStep.xp} XP
                              </span>
                            )}
                          </div>
                          <h2 className="font-display font-bold text-lg text-[var(--text)]">
                            {activeStep.title}
                          </h2>
                        </div>
                        {activeProgress?.status === "completed" && (
                          <CheckCircle2
                            size={20}
                            className="text-green-500 shrink-0 mt-1"
                          />
                        )}
                      </div>

                      {/* Theory */}
                      {activeStep.kind === "theory" && (
                        <div className="prose prose-sm dark:prose-invert max-w-none text-[var(--text)] leading-relaxed text-sm whitespace-pre-wrap">
                          {activeStep.theoryText || (
                            <span className="text-[var(--muted)] italic">
                              Теоретический материал будет добавлен.
                            </span>
                          )}
                        </div>
                      )}

                      {/* Quiz */}
                      {activeStep.kind === "quiz" && (
                        <div className="space-y-2">
                          {activeStep.options.map((option, idx) => (
                            <button
                              key={idx}
                              onClick={() => setStepAnswer(option)}
                              className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                                stepAnswer === option
                                  ? "border-primary bg-primary-50 dark:bg-primary-900/20 text-primary font-medium"
                                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:border-primary/40"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                                    stepAnswer === option
                                      ? "border-primary bg-primary"
                                      : "border-[var(--border)]"
                                  }`}
                                >
                                  {stepAnswer === option && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                  )}
                                </div>
                                {option}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Code */}
                      {activeStep.kind === "code" && (
                        <div className="space-y-3">
                          {activeStep.theoryText && (
                            <div className="text-sm text-[var(--text)] leading-relaxed p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] whitespace-pre-wrap">
                              {activeStep.theoryText}
                            </div>
                          )}
                          {activeStep.checks &&
                            activeStep.checks.length > 0 && (
                              <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-1.5">
                                <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">
                                  Требования
                                </p>
                                {activeStep.checks.map((check, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-2 text-sm text-[var(--text)]"
                                  >
                                    <div className="w-4 h-4 rounded border border-[var(--border)] bg-[var(--bg)] flex items-center justify-center shrink-0">
                                      <span className="text-[9px] text-[var(--muted)]">
                                        {idx + 1}
                                      </span>
                                    </div>
                                    {check}
                                  </div>
                                ))}
                              </div>
                            )}
                          <textarea
                            value={stepAnswer}
                            onChange={(e) => setStepAnswer(e.target.value)}
                            placeholder="// Напишите код здесь..."
                            className="w-full h-52 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] p-4 text-sm font-mono outline-none focus:border-primary/50 transition-colors resize-none"
                          />
                        </div>
                      )}

                      {/* Check results */}
                      {stepCheckResults && (
                        <div className="space-y-1.5">
                          {stepCheckResults.map((result, idx) => (
                            <div
                              key={idx}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                                result.passed
                                  ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                                  : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                              }`}
                            >
                              {result.passed ? (
                                <Check size={14} />
                              ) : (
                                <X size={14} />
                              )}
                              {result.name}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Feedback */}
                      {(stepMessage || stepError) && (
                        <div
                          className={`px-4 py-3 rounded-xl text-sm font-medium ${
                            stepError
                              ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400"
                              : "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 text-green-700 dark:text-green-400"
                          }`}
                        >
                          {stepError || stepMessage}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center justify-between gap-3 pt-2 border-t border-[var(--border)]">
                        <div className="flex items-center gap-2">
                          {previousStep && (
                            <button
                              onClick={() => selectStep(previousStep.id, "")}
                              className="flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--text)] transition-colors"
                            >
                              <ArrowLeft size={14} /> Назад
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 text-xs text-[var(--muted)] cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={autoAdvance}
                              onChange={(e) => setAutoAdvance(e.target.checked)}
                              className="w-3.5 h-3.5 rounded accent-primary"
                            />
                            Авто-переход
                          </label>
                          <button
                            onClick={submitStep}
                            disabled={
                              stepLoading ||
                              (activeStep.kind !== "theory" &&
                                !stepAnswer.trim())
                            }
                            className="btn-primary px-5 py-2.5 text-sm gap-2"
                          >
                            {stepLoading ? (
                              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <>
                                <span>{submitLabel}</span>
                                {nextStep && <ArrowRight size={14} />}
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Attempt history */}
                  {attemptHistory.filter((a) => a.stepId === selectedStepId)
                    .length > 0 && (
                    <div className="card p-5 space-y-3">
                      <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                        История попыток
                      </p>
                      <div className="space-y-2 max-h-48 overflow-auto">
                        {attemptHistory
                          .filter((a) => a.stepId === selectedStepId)
                          .map((attempt) => (
                            <div
                              key={attempt.id}
                              className={`flex items-start gap-3 px-3 py-2.5 rounded-xl text-sm ${
                                attempt.passed
                                  ? "bg-green-50 dark:bg-green-900/10"
                                  : "bg-[var(--surface)]"
                              }`}
                            >
                              {attempt.passed ? (
                                <CheckCircle2
                                  size={15}
                                  className="text-green-500 mt-0.5 shrink-0"
                                />
                              ) : (
                                <Circle
                                  size={15}
                                  className="text-[var(--muted)] mt-0.5 shrink-0"
                                />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-[var(--text)] truncate">
                                  {attempt.feedback}
                                </p>
                                <p className="text-xs text-[var(--muted)] mt-0.5">
                                  {new Date(
                                    attempt.createdAt,
                                  ).toLocaleTimeString()}
                                </p>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {activeTab === "discussion" && (
                <div className="card p-5 space-y-4">
                  <div>
                    <p className="font-semibold text-sm text-[var(--text)]">
                      Обсуждение шага
                    </p>
                    <p className="text-xs text-[var(--muted)] mt-0.5">
                      Задавайте вопросы по теории и решениям
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <textarea
                      value={discussionText}
                      onChange={(e) => setDiscussionText(e.target.value)}
                      placeholder="Напишите вопрос по текущему шагу..."
                      className="flex-1 h-20 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] p-3 text-sm outline-none focus:border-primary/50 transition-colors resize-none"
                    />
                    <button
                      onClick={postDiscussionMessage}
                      disabled={!discussionText.trim()}
                      className="btn-primary px-4 py-2 text-sm self-end shrink-0"
                    >
                      Отправить
                    </button>
                  </div>

                  <div className="space-y-3">
                    {discussionMessages.map((msg) => (
                      <div key={msg.id} className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {msg.author.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-[var(--text)]">
                              {msg.author}
                            </span>
                            <span className="text-xs text-[var(--muted)]">
                              {new Date(msg.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-sm text-[var(--text)] leading-relaxed">
                            {msg.text}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Syllabus sidebar */}
            <div className="xl:sticky xl:top-4 h-fit">
              <div className="card p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <ListOrdered size={15} className="text-[var(--muted)]" />
                  <p className="font-semibold text-sm text-[var(--text)]">
                    Содержание
                  </p>
                </div>

                <div className="space-y-1.5 max-h-[calc(100vh-200px)] overflow-auto pr-1">
                  {syllabusModules.map((module) => (
                    <div key={module.id}>
                      <button
                        onClick={() => toggleModule(module.id)}
                        className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--surface)] transition-colors text-left"
                      >
                        <span className="text-xs font-semibold text-[var(--text)]">
                          {module.title}
                        </span>
                        {openModules[module.id] ? (
                          <ChevronDown
                            size={13}
                            className="text-[var(--muted)] shrink-0"
                          />
                        ) : (
                          <ChevronRight
                            size={13}
                            className="text-[var(--muted)] shrink-0"
                          />
                        )}
                      </button>

                      {openModules[module.id] && (
                        <div className="ml-2 space-y-0.5 mt-0.5">
                          {module.lessons.flatMap((lesson) =>
                            lesson.steps.map((step) => {
                              const prog = courseContent?.progress.find(
                                (p) => p.stepId === step.id,
                              );
                              const isActive = selectedStepId === step.id;
                              const isDone = prog?.status === "completed";
                              return (
                                <button
                                  key={step.id}
                                  onClick={() =>
                                    selectStep(step.id, prog?.answerText || "")
                                  }
                                  className={`w-full text-left flex items-center gap-2.5 px-2 py-2 rounded-lg transition-all text-xs ${
                                    isActive
                                      ? "bg-primary-50 dark:bg-primary-900/20 text-primary border border-primary/20"
                                      : "text-[var(--text)] hover:bg-[var(--surface)]"
                                  }`}
                                >
                                  <div
                                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                                      isDone
                                        ? "bg-green-500 border-green-500"
                                        : isActive
                                          ? "border-primary bg-primary-50 dark:bg-primary-900/20"
                                          : "border-[var(--border)]"
                                    }`}
                                  >
                                    {isDone && (
                                      <Check size={9} className="text-white" />
                                    )}
                                    {!isDone && isActive && (
                                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                    )}
                                  </div>
                                  <span className="truncate leading-snug">
                                    {step.title}
                                  </span>
                                </button>
                              );
                            }),
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {!courseContent?.steps.length && !contentLoading && (
                    <p className="text-xs text-[var(--muted)] px-2">
                      Шаги ещё не добавлены.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  // ─── Catalog view ─────────────────────────────────────────────────────────────
  const allCategories = useMemo(() => {
    const set = new Set(courses.map((c) => c.category || "").filter(Boolean));
    return Array.from(set).sort();
  }, [courses]);

  const LEVELS = ["Начальный", "Средний", "Продвинутый"];

  const myCourses = useMemo(
    () => courses.filter((c) => c.progress > 0),
    [courses],
  );

  const displayCourses = viewTab === "my" ? myCourses : courses;

  const catalogFiltered = useMemo(() => {
    let result = displayCourses;
    if (selectedCategory)
      result = result.filter((c) => c.category === selectedCategory);
    if (selectedLevel) result = result.filter((c) => c.level === selectedLevel);
    if (active !== "Все") result = result.filter((c) => c.type === active);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          (c.description || "").toLowerCase().includes(q) ||
          c.author.toLowerCase().includes(q),
      );
    }
    return result;
  }, [displayCourses, selectedCategory, selectedLevel, active, search]);

  const clearFilters = () => {
    setSelectedCategory(null);
    setSelectedLevel(null);
    setActive("Все");
    setSearch("");
  };
  const activeFiltersCount = [
    selectedCategory,
    selectedLevel,
    active !== "Все" ? active : null,
  ].filter(Boolean).length;

  return (
    <MainLayout>
      <div



        className="space-y-6 max-w-7xl"
      >
        {/* Header */}
        <div>
          <h1 className="font-display font-bold text-3xl text-[var(--text)] mb-1">
            Каталог курсов
          </h1>
          <p className="text-[var(--muted)] text-sm">
            {courses.filter((c) => c.published !== false).length} курсов по
            разным направлениям
          </p>
        </div>

        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-lg">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по названию, автору..."
              className="input-field pl-10 pr-4 py-2.5 text-sm w-full"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {LEVELS.map((lvl) => (
              <button
                key={lvl}
                onClick={() =>
                  setSelectedLevel(selectedLevel === lvl ? null : lvl)
                }
                className={`px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
                  selectedLevel === lvl
                    ? "btn-gradient text-white border-transparent"
                    : "border-[var(--border)] text-[var(--muted)] hover:border-primary/40"
                }`}
              >
                {lvl}
              </button>
            ))}
            {activeFiltersCount > 0 && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors border border-red-200 dark:border-red-800/30"
              >
                <X size={11} /> Сбросить
              </button>
            )}
          </div>
          {canCreateCourse && (
            <button
              onClick={() => setCreateModalOpen(true)}
              className="btn-primary px-4 py-2 text-sm shrink-0"
            >
              + Добавить курс
            </button>
          )}
        </div>

        {/* Tab: Все курсы / Мои курсы */}
        <div className="flex gap-2 mb-4">
          {(["all", "my"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setViewTab(tab)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                viewTab === tab
                  ? "btn-gradient text-white"
                  : "bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)]"
              }`}
            >
              {tab === "all"
                ? "Все курсы"
                : `Мои курсы ${myCourses.length > 0 ? `(${myCourses.length})` : ""}`}
            </button>
          ))}
        </div>

        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
              !selectedCategory
                ? "btn-gradient text-white border-transparent"
                : "border-[var(--border)] text-[var(--muted)] hover:border-primary/40"
            }`}
          >
            Все
          </button>
          {allCategories.map((cat) => {
            const meta = getCatMeta(cat);
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(isSelected ? null : cat)}
                className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  isSelected
                    ? "btn-gradient text-white border-transparent"
                    : "border-[var(--border)] text-[var(--muted)] hover:border-primary/40"
                }`}
              >
                {meta.icon}
                {meta.label}
                <span className="text-[10px] opacity-60">
                  {courses.filter((c) => c.category === cat).length}
                </span>
              </button>
            );
          })}
        </div>

        {/* Results count */}
        <p className="text-xs text-[var(--muted)]">
          {catalogFiltered.length} из {courses.length} курсов
        </p>

        {/* Grid */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-64 rounded-2xl bg-[var(--surface)] animate-pulse"
              />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="card p-5">
            <p className="text-sm text-red-500 font-medium">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {catalogFiltered.map((course) => {
              const catMeta = getCatMeta(course.category || "");
              return (
                <div
                  key={course.id}

          

                  className="card p-0 overflow-hidden cursor-pointer group flex flex-col"
                  onClick={() => navigate(`/course/${course.id}`)}
                >
                  {/* Cover */}
                  <div className="h-32 overflow-hidden relative shrink-0 bg-gradient-to-br from-primary to-burgundy">
                    <img
                      src={courseCoverUrl(course)}
                      alt={course.title}
                      loading="lazy"
                      onError={(event) => {
                        const target =
                          event.currentTarget as HTMLImageElement & {
                            dataset: DOMStringMap;
                          };
                        if (target.dataset.fallback === "1") return;
                        target.dataset.fallback = "1";
                        const seed = `c${course.id}`;
                        target.src = `https://picsum.photos/seed/${encodeURIComponent(seed)}/960/540`;
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>

                  {/* Content */}
                  <div className="p-4 flex-1 flex flex-col">
                    <div
                      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md mb-2 self-start ${catMeta.color}`}
                    >
                      {catMeta.icon}
                      {catMeta.label}
                    </div>

                    <h3 className="font-semibold text-sm text-[var(--text)] line-clamp-2 group-hover:text-primary transition-colors leading-snug">
                      {course.title}
                    </h3>
                    <p className="text-xs text-[var(--muted)] mt-1">
                      {course.author}
                    </p>

                    <div className="mt-auto pt-3 space-y-2">
                      {/* Meta */}
                      <div className="flex items-center gap-3 text-[11px] text-[var(--muted)]">
                        <span className="flex items-center gap-0.5 text-amber-500 font-semibold">
                          <Star size={10} fill="currentColor" />
                          {course.rating}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Users size={10} />
                          {course.students}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Clock3 size={10} />
                          {course.duration}
                        </span>
                      </div>

                      {/* Progress */}
                      {course.progress > 0 && (
                        <div>
                          <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${course.progress}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-[var(--muted)] mt-0.5">
                            {course.progress}% пройдено
                          </p>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <span
                          className={`text-sm font-bold ${course.price === "Бесплатно" ? "text-green-600 dark:text-green-400" : "text-[var(--text)]"}`}
                        >
                          {course.price}
                        </span>
                        {course.progress === 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              enrollCourse(course.id);
                            }}
                            className="text-[10px] px-3 py-1.5 rounded-lg btn-gradient text-white transition-colors font-semibold"
                          >
                            Записаться
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {viewTab === "my" && myCourses.length === 0 && (
              <div className="col-span-full card p-10 flex flex-col items-center justify-center text-center">
                <BookOpen size={32} className="text-[var(--border)] mb-3" />
                <p className="font-semibold text-[var(--text)] mb-1">
                  Вы ещё не записались ни на один курс
                </p>
                <p className="text-sm text-[var(--muted)] mb-4">
                  Начните обучение — запишитесь на курс из каталога
                </p>
                <button
                  onClick={() => setViewTab("all")}
                  className="btn-primary px-4 py-2 text-sm"
                >
                  Перейти в каталог
                </button>
              </div>
            )}

            {viewTab !== "my" && catalogFiltered.length === 0 && (
              <div className="col-span-full card p-10 flex flex-col items-center justify-center text-center">
                <Search size={32} className="text-[var(--border)] mb-3" />
                <p className="font-semibold text-[var(--text)] mb-1">
                  Курсы не найдены
                </p>
                <p className="text-sm text-[var(--muted)] mb-4">
                  {search
                    ? "Попробуйте изменить запрос или сбросить фильтры."
                    : "Нет курсов в выбранной категории."}
                </p>
                {activeFiltersCount > 0 && (
                  <button
                    onClick={clearFilters}
                    className="btn-secondary px-4 py-2 text-sm"
                  >
                    Сбросить фильтры
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <Modal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          title="Создать курс"
        >
          <div className="space-y-4">
            <input
              value={newCourseTitle}
              onChange={(e) => setNewCourseTitle(e.target.value)}
              placeholder="Название курса"
              className="input-field w-full px-4 py-3 text-sm"
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                value={newCourseType}
                onChange={(e) => setNewCourseType(e.target.value)}
                className="input-field px-4 py-3 text-sm"
              >
                <option>Frontend</option>
                <option>Backend</option>
              </select>
              <select
                value={newCourseLevel}
                onChange={(e) => setNewCourseLevel(e.target.value)}
                className="input-field px-4 py-3 text-sm"
              >
                <option>Начальный</option>
                <option>Средний</option>
                <option>Продвинутый</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setCreateModalOpen(false)}
                className="btn-ghost px-4 py-2 text-sm"
              >
                Отмена
              </button>
              <button
                onClick={createCourse}
                className="btn-primary px-4 py-2 text-sm"
              >
                Создать
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </MainLayout>
  );
}
