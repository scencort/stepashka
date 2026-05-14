// страница конкретного курса — шаги, прогресс, боковое меню, оценки
// этот компонент рендерит саму страницу обучения, Course.tsx только управляет данными
import { useMemo, useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Check,
  BookOpen,
  ArrowLeft,
  MessageSquare,
  ListOrdered,
  Star,
} from "lucide-react";
import CourseStep from "./CourseStep";
import CourseDiscussion from "./CourseDiscussion";

// шаг курса — один элемент в боковом меню и в содержимом
type CourseStepType = {
  id: number;
  title: string;
  kind: "theory" | "quiz" | "code" | "essay";
  taskTypeLabel?: string;
  theoryText: string;
  checks?: string[];
  checkCount?: number;
  options: string[];
  stepOrder: number;
  xp: number;
};

// прогресс по шагу — сколько попыток, что ответил, выполнен ли
type StepProgress = {
  stepId: number;
  status: "started" | "completed";
  score: number;
  attempts: number;
  answerText: string;
  completedAt: string | null;
};

// всё что приходит с /courses/:id/steps
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

// детальная инфа о курсе — рейтинг, категория и всё такое
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

// статус записи текущего юзера на курс
type EnrollmentStatus = {
  enrolled: boolean;
  status?: string;
  progress?: number;
  requestStatus?: string | null;
  teacherComment?: string | null;
};

// одна попытка сдачи шага
type AttemptEntry = {
  id: number;
  stepId: number;
  answer: string;
  passed: boolean;
  feedback: string;
  createdAt: string;
  checkResults?: Array<{ name: string; passed: boolean; expected?: string; actual?: string; error?: string }> | null;
};

// все пропсы которые принимает компонент — Course.tsx передаёт всё это
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
  stepAiComment: string | null;
  attemptHistory: AttemptEntry[];
  activeTab: "content" | "discussion";
  setActiveTab: (v: "content" | "discussion") => void;
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
  myRating?: {
    myScore: number | null;
    myComment: string;
    avgRating: number;
    ratingCount: number;
    progress: number;
    canRate: boolean;
  } | null;
  onSubmitRating?: (score: number, comment: string) => Promise<void>;
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
    stepAiComment,
    attemptHistory,
    activeTab,
    setActiveTab,
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
    myRating,
    onSubmitRating,
  } = props;

  // локальный стейт для звёздочек рейтинга
  const [hoverStar, setHoverStar] = useState(0);
  const [selectedStar, setSelectedStar] = useState(myRating?.myScore ?? 0);
  const [ratingComment, setRatingComment] = useState(myRating?.myComment ?? "");
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

  // когда с сервера пришёл рейтинг — обновляем поля формы
  useEffect(() => {
    setSelectedStar(myRating?.myScore ?? 0);
    setRatingComment(myRating?.myComment ?? "");
  }, [myRating?.myScore, myRating?.myComment]);

  // находим текущий активный шаг и его прогресс
  const activeStep =
    courseContent?.steps.find((s) => s.id === selectedStepId) ?? null;
  const activeProgress =
    courseContent?.progress.find((p) => p.stepId === selectedStepId) ?? null;
  const activeStepIndex =
    courseContent?.steps.findIndex((s) => s.id === selectedStepId) ?? -1;
  // соседние шаги для навигации вперёд/назад
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

  // текст кнопки зависит от типа шага
  const submitLabel = activeStep
    ? activeStep.kind === "theory"
      ? "Отметить как изученный"
      : activeStep.kind === "quiz"
        ? "Проверить ответ"
        : activeStep.kind === "essay"
          ? "Отправить эссе на проверку"
          : "Отправить код"
    : "Проверить";

  // собираем модули из шагов — бэк отдаёт плоский массив шагов,
  // а нам нужна группировка по урокам и модулям для бокового меню
  const syllabusModules = useMemo(() => {
    if (!courseContent)
      return [] as Array<{
        id: number;
        title: string;
        lessons: Array<{ id: number; title: string; steps: CourseStepType[] }>;
      }>;
    // каждые 3 шага — один урок
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
    // каждые 2 урока — один модуль
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

  // при первой загрузке открываем все модули, при смене курса сбрасываем
  useEffect(() => {
    if (syllabusModules.length === 0) {
      setOpenModules({});
      return;
    }
    setOpenModules((prev) => {
      const next: Record<number, boolean> = {};
      // по умолчанию открываем новые модули, сохраняем состояние старых
      for (const m of syllabusModules) next[m.id] = prev[m.id] ?? true;
      return next;
    });
  }, [syllabusModules]);

  // пока грузится контент и ещё ничего нет — скелетон
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

  // если ошибка и нет данных — показываем сообщение
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

  // общий прогресс по курсу для отображения в заголовке
  const percent = courseContent?.summary.percent ?? 0;
  const completed = courseContent?.summary.completed ?? 0;
  const total = courseContent?.summary.total ?? 0;

  return (
    <div className="max-w-6xl space-y-4">
      {/* шапка курса — название, прогресс, кнопка назад */}
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

        {/* прогресс-бар в заголовке */}
        <div className="flex-1 max-w-xs">
          <div className="h-2 rounded-full bg-[var(--border)] overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>

      {/* баннер для незаписанных — предлагаем записаться или запросить доступ */}
      {enrollmentStatus && !enrollmentStatus.enrolled && (
        <div className="card p-5 border-primary/20 bg-primary-50 dark:bg-primary-900/10">
          {enrollmentStatus.requestStatus === "pending" ? (
            // заявка уже отправлена — ждём одобрения
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
            // ещё не записан — показываем кнопки записи
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

      {/* основная сетка: контент слева, содержание справа */}
      <div className="grid xl:grid-cols-[1fr_380px] gap-4">
        {/* левая часть — активный шаг */}
        <div className="space-y-4 min-w-0">
          {/* переключатель вкладок шаг/обсуждение */}
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

          {/* контент шага — теория, тест или код */}
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
              stepAiComment={stepAiComment}
              attemptHistory={attemptHistory}
              selectedStepId={selectedStepId}
              submitLabel={submitLabel}
              onSubmitStep={onSubmitStep}
              onSelectStep={onSelectStep}
            />
          )}

          {/* вкладка обсуждения — показываем только если есть детали курса */}
          {activeTab === "discussion" && courseDetail && (
            <CourseDiscussion
              courseId={courseDetail.id}
              stepId={selectedStepId}
              stepTitle={activeStep?.title}
            />
          )}

          {/* виджет оценки — появляется только когда юзер может оценить */}
          {myRating?.canRate && (
            <div className="card p-5 space-y-4 border-amber-200/50 dark:border-amber-800/30 bg-gradient-to-br from-amber-50/50 to-orange-50/30 dark:from-amber-900/10 dark:to-orange-900/5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Star size={16} className="text-amber-500" fill="currentColor" />
                </div>
                <div>
                  <p className="font-bold text-sm text-[var(--text)]">
                    {myRating.myScore ? "Ваша оценка курса" : "Оцените курс"}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {myRating.ratingCount > 0
                      ? `Средняя оценка: ${myRating.avgRating.toFixed(1)} ★ · ${myRating.ratingCount} отзывов`
                      : "Будьте первым, кто оценит курс!"}
                  </p>
                </div>
              </div>

              {/* кликабельные звёздочки для выбора оценки */}
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onMouseEnter={() => setHoverStar(star)}
                    onMouseLeave={() => setHoverStar(0)}
                    onClick={() => setSelectedStar(star)}
                    className="transition-transform hover:scale-110 active:scale-95"
                  >
                    <Star
                      size={32}
                      className={`transition-colors ${
                        star <= (hoverStar || selectedStar)
                          ? "text-amber-400"
                          : "text-[var(--border)]"
                      }`}
                      fill={star <= (hoverStar || selectedStar) ? "currentColor" : "none"}
                    />
                  </button>
                ))}
                {/* текстовая подпись к выбранной оценке */}
                {selectedStar > 0 && (
                  <span className="ml-2 text-sm font-semibold text-amber-600 dark:text-amber-400">
                    {["", "Плохо", "Так себе", "Нормально", "Хорошо", "Отлично!"][selectedStar]}
                  </span>
                )}
              </div>

              {/* поле для текстового отзыва */}
              <textarea
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                placeholder="Напишите отзыв (необязательно)..."
                rows={3}
                className="input-field w-full px-3 py-2.5 text-sm resize-none"
              />

              <button
                disabled={selectedStar === 0 || ratingSubmitting}
                onClick={async () => {
                  if (!onSubmitRating || selectedStar === 0) return;
                  setRatingSubmitting(true);
                  try { await onSubmitRating(selectedStar, ratingComment); }
                  finally { setRatingSubmitting(false); }
                }}
                className="btn-primary px-5 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {ratingSubmitting ? "Сохраняю..." : myRating.myScore ? "Обновить оценку" : "Оставить оценку"}
              </button>
            </div>
          )}
        </div>

        {/* правая колонка — содержание курса, прилипает при скролле */}
        <div className="xl:sticky xl:top-4 h-fit xl:pl-4">
          <div className="card p-5 space-y-4">
            {/* заголовок содержания с счётчиком прогресса */}
            <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--border)]">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <ListOrdered size={14} className="text-primary" />
              </div>
              <p className="font-bold text-sm text-[var(--text)]">Содержание</p>
              {courseContent && (
                <span className="ml-auto text-xs text-[var(--muted)] font-medium">
                  {courseContent.summary.completed}/{courseContent.summary.total}
                </span>
              )}
            </div>

            {/* список модулей с уроками и шагами */}
            <div className="space-y-2 max-h-[calc(100vh-220px)] overflow-auto pr-1 -mr-1">
              {syllabusModules.map((module) => {
                // считаем сколько шагов в модуле выполнено
                const moduleSteps = module.lessons.flatMap(l => l.steps);
                const moduleDone = moduleSteps.filter(s =>
                  courseContent?.progress.find(p => p.stepId === s.id)?.status === "completed"
                ).length;
                return (
                  <div key={module.id} className="rounded-xl overflow-hidden border border-[var(--border)]">
                    {/* кнопка модуля — открывает/закрывает его шаги */}
                    <button
                      onClick={() => onToggleModule(module.id)}
                      className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-[var(--surface)] hover:bg-[var(--border)]/30 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-bold text-[var(--text)] truncate">
                          {module.title}
                        </span>
                        <span className="text-[11px] text-[var(--muted)] shrink-0">
                          {moduleDone}/{moduleSteps.length}
                        </span>
                      </div>
                      {openModules[module.id]
                        ? <ChevronDown size={14} className="text-[var(--muted)] shrink-0" />
                        : <ChevronRight size={14} className="text-[var(--muted)] shrink-0" />
                      }
                    </button>

                    {/* раскрытый список шагов */}
                    {openModules[module.id] && (
                      <div className="divide-y divide-[var(--border)]">
                        {module.lessons.flatMap((lesson) =>
                          lesson.steps.map((step) => {
                            const prog = courseContent?.progress.find(p => p.stepId === step.id);
                            const isActive = selectedStepId === step.id;
                            const isDone = prog?.status === "completed";
                            return (
                              <button
                                key={step.id}
                                onClick={() => onSelectStep(step.id, prog?.answerText || "")}
                                className={`w-full text-left flex items-center gap-3 px-4 py-3 transition-all ${
                                  isActive
                                    ? "bg-primary-50 dark:bg-primary-900/20"
                                    : "bg-[var(--bg)] hover:bg-[var(--surface)]"
                                }`}
                              >
                                {/* иконка статуса шага — галочка, точка или круг */}
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                                  isDone
                                    ? "bg-green-500 border-green-500"
                                    : isActive
                                      ? "border-primary bg-primary/10"
                                      : "border-[var(--border)] bg-[var(--surface)]"
                                }`}>
                                  {isDone && <Check size={10} className="text-white" strokeWidth={3} />}
                                  {!isDone && isActive && <div className="w-2 h-2 rounded-full bg-primary" />}
                                </div>
                                {/* название шага и XP */}
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm leading-snug truncate font-medium ${
                                    isActive ? "text-primary" : isDone ? "text-[var(--muted)]" : "text-[var(--text)]"
                                  }`}>
                                    {step.title}
                                  </p>
                                  {step.xp > 0 && (
                                    <p className="text-[11px] text-[var(--muted)] mt-0.5 flex items-center gap-0.5">
                                      ⚡ {step.xp} XP
                                    </p>
                                  )}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {/* пустое состояние — шагов нет */}
              {!courseContent?.steps.length && !contentLoading && (
                <p className="text-xs text-[var(--muted)] px-2">Шаги ещё не добавлены.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
