import { useMemo, useEffect } from "react";
import {
  ChevronDown,
  ChevronRight,
  Check,
  BookOpen,
  ArrowLeft,
  MessageSquare,
  ListOrdered,
} from "lucide-react";
import CourseStep from "./CourseStep";
import CourseDiscussion from "./CourseDiscussion";

type CourseStepType = {
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
  steps: CourseStepType[];
  progress: StepProgress[];
  summary: {
    total: number;
    completed: number;
    xp: number;
    percent: number;
  };
};

type CourseDetailType = {
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

type Props = {
  selectedCourseId: number;
  courseContent: CourseContentResponse | null;
  courseDetail: CourseDetailType | null;
  contentLoading: boolean;
  contentError: string;
  enrollmentStatus: EnrollmentStatus | null;
  selectedStepId: number | null;
  stepAnswer: string;
  setStepAnswer: (v: string) => void;
  stepLoading: boolean;
  stepError: string;
  stepMessage: string;
  stepCheckResults: Array<{ name: string; passed: boolean }> | null;
  autoAdvance: boolean;
  setAutoAdvance: (v: boolean) => void;
  attemptHistory: AttemptEntry[];
  activeTab: "content" | "discussion";
  setActiveTab: (v: "content" | "discussion") => void;
  discussionMessages: DiscussionMessage[];
  discussionText: string;
  setDiscussionText: (v: string) => void;
  enrollRequestMessage: string;
  setEnrollRequestMessage: (v: string) => void;
  enrollRequestLoading: boolean;
  openModules: Record<number, boolean>;
  setOpenModules: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  onNavigateBack: () => void;
  onEnroll: (id: number) => void;
  onRequestEnrollment: () => void;
  onSubmitStep: () => void;
  onSelectStep: (stepId: number, answerText: string) => void;
  onToggleModule: (moduleId: number) => void;
  onPostDiscussionMessage: () => void;
};

export default function CourseDetail(props: Props) {
  const {
    selectedCourseId,
    courseContent,
    courseDetail,
    contentLoading,
    contentError,
    enrollmentStatus,
    selectedStepId,
    stepAnswer,
    setStepAnswer,
    stepLoading,
    stepError,
    stepMessage,
    stepCheckResults,
    autoAdvance,
    setAutoAdvance,
    attemptHistory,
    activeTab,
    setActiveTab,
    discussionMessages,
    discussionText,
    setDiscussionText,
    enrollRequestMessage,
    setEnrollRequestMessage,
    enrollRequestLoading,
    openModules,
    setOpenModules,
    onNavigateBack,
    onEnroll,
    onRequestEnrollment,
    onSubmitStep,
    onSelectStep,
    onToggleModule,
    onPostDiscussionMessage,
  } = props;

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
        lessons: Array<{ id: number; title: string; steps: CourseStepType[] }>;
      }>;
    const lessons = new Map<
      number,
      { id: number; title: string; steps: CourseStepType[] }
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
        lessons: Array<{ id: number; title: string; steps: CourseStepType[] }>;
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

  // Loading state
  if (contentLoading && !courseContent) {
    return (
      <div className="space-y-4 max-w-5xl">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 rounded-2xl bg-[var(--surface)] animate-pulse"
          />
        ))}
      </div>
    );
  }

  // Error state
  if (contentError && !courseContent) {
    return (
      <div className="card p-6 max-w-lg">
        <p className="text-sm text-red-500 font-medium mb-4">
          {contentError}
        </p>
        <button
          onClick={onNavigateBack}
          className="btn-secondary text-sm px-4 py-2"
        >
          ← Назад к каталогу
        </button>
      </div>
    );
  }

  const percent = courseContent?.summary.percent ?? 0;
  const completed = courseContent?.summary.completed ?? 0;
  const total = courseContent?.summary.total ?? 0;

  return (
    <div className="max-w-6xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onNavigateBack}
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
                  onClick={() => onEnroll(selectedCourseId)}
                  className="btn-primary px-4 py-2 text-sm"
                >
                  Записаться
                </button>
                <div className="flex gap-2 flex-1 min-w-0">
                  <input
                    value={enrollRequestMessage}
                    onChange={(e) => setEnrollRequestMessage(e.target.value)}
                    placeholder="Сообщение (необязательно)"
                    className="input-field px-3 py-2 text-sm flex-1 min-w-0"
                  />
                  <button
                    onClick={onRequestEnrollment}
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
            <CourseStep
              activeStep={activeStep}
              activeProgress={activeProgress}
              previousStep={previousStep}
              nextStep={nextStep}
              contentLoading={contentLoading}
              stepAnswer={stepAnswer}
              setStepAnswer={setStepAnswer}
              stepLoading={stepLoading}
              stepError={stepError}
              stepMessage={stepMessage}
              stepCheckResults={stepCheckResults}
              autoAdvance={autoAdvance}
              setAutoAdvance={setAutoAdvance}
              attemptHistory={attemptHistory}
              selectedStepId={selectedStepId}
              submitLabel={submitLabel}
              onSubmitStep={onSubmitStep}
              onSelectStep={onSelectStep}
            />
          )}

          {activeTab === "discussion" && (
            <CourseDiscussion
              discussionMessages={discussionMessages}
              discussionText={discussionText}
              setDiscussionText={setDiscussionText}
              onPostMessage={onPostDiscussionMessage}
            />
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
                    onClick={() => onToggleModule(module.id)}
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
                                onSelectStep(step.id, prog?.answerText || "")
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
  );
}
