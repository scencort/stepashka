// главная страница курсов — работает как каталог и как страница конкретного курса
// если в урле есть courseId — показываем CourseDetail, иначе CourseCatalog
import MainLayout from "../layout/MainLayout";

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { useToast } from "../hooks/useToast";
import { useAppStore } from "../store/AppStore";
import CourseCatalog from "./course/CourseCatalog";
import CourseDetail from "./course/CourseDetail";

// карточка курса в каталоге — это то что видно в списке
type CourseItem = {
  id: number;
  title: string;
  lessons: number;
  progress: number;
  enrolled?: boolean;     // записался ли текущий юзер
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

// детальная инфа о курсе — приходит с отдельного endpoint'а
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
  requestStatus?: string | null;  // null если ещё не подавал заявку
  teacherComment?: string | null;
};

// один шаг курса — теория, тест или код
type CourseStep = {
  id: number;
  title: string;
  kind: "theory" | "quiz" | "code";
  taskTypeLabel?: string;
  theoryText: string;
  checks?: string[];         // требования для code-шагов
  checkCount?: number;
  options: string[];         // варианты ответа для quiz
  stepOrder: number;
  xp: number;                // сколько очков за этот шаг
};

// прогресс по одному шагу — хранит последний ответ и статус
type StepProgress = {
  stepId: number;
  status: "started" | "completed";
  score: number;
  attempts: number;
  answerText: string;
  completedAt: string | null;
};

// всё что приходит при загрузке содержимого курса
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
  progress: StepProgress[];   // прогресс по каждому шагу
  summary: {
    total: number;
    completed: number;
    xp: number;
    percent: number;
  };
};

// одна попытка сдачи шага — сохраняем историю для отображения
type AttemptEntry = {
  id: number;
  stepId: number;
  answer: string;
  passed: boolean;
  feedback: string;
  createdAt: string;
  checkResults?: Array<{ name: string; passed: boolean; expected?: string; actual?: string; error?: string }> | null;
  aiComment?: string | null;
};

// ключ в localStorage для хранения последнего открытого шага курса
const STEP_KEY = (cId: number) => `gradus_last_step_${cId}`;

export default function Course() {
  const navigate = useNavigate();
  // courseId из урла — если есть, значит открыт конкретный курс
  const { courseId } = useParams<{ courseId?: string }>();
  const [searchParams] = useSearchParams();
  const selectedCourseId = courseId ? Number(courseId) : null;
  // проверяем что id валидный — не NaN и положительный
  const isCoursePage =
    selectedCourseId !== null &&
    Number.isInteger(selectedCourseId) &&
    selectedCourseId > 0;

  const [active] = useState("Все");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // список курсов для каталога
  const [courses, setCourses] = useState<CourseItem[]>([]);
  // содержимое открытого курса — шаги и прогресс
  const [courseContent, setCourseContent] =
    useState<CourseContentResponse | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState("");
  // id текущего выбранного шага
  const [selectedStepId, setSelectedStepId] = useState<number | null>(null);
  // текст ответа который юзер вводит
  const [stepAnswer, setStepAnswer] = useState("");
  const [stepLoading, setStepLoading] = useState(false);
  const [stepError, setStepError] = useState("");
  const [stepMessage, setStepMessage] = useState("");
  // результаты тест-кейсов для code-шагов
  const [stepCheckResults, setStepCheckResults] = useState<Array<{
    name: string;
    passed: boolean;
  }> | null>(null);
  // комментарий ИИ-наставника после проверки
  const [stepAiComment, setStepAiComment] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // история попыток текущего шага
  const [attemptHistory, setAttemptHistory] = useState<AttemptEntry[]>([]);
  const [_autoAdvance] = useState(false);
  // какие модули открыты/закрыты в боковом меню
  const [openModules, setOpenModules] = useState<Record<number, boolean>>({});
  // записан ли юзер на этот курс
  const [enrollmentStatus, setEnrollmentStatus] =
    useState<EnrollmentStatus | null>(null);
  // детальная инфа о курсе (рейтинг, описание и тд)
  const [courseDetail, setCourseDetail] = useState<CourseDetailType | null>(null);
  // рейтинг курса от текущего юзера
  const [myRating, setMyRating] = useState<{
    myScore: number | null;
    myComment: string;
    avgRating: number;
    ratingCount: number;
    progress: number;
    canRate: boolean;
  } | null>(null);
  // сообщение при запросе доступа к курсу
  const [enrollRequestMessage, setEnrollRequestMessage] = useState("");
  const [enrollRequestLoading, setEnrollRequestLoading] = useState(false);
  // множество id курсов в процессе записи — чтобы не кликали дважды
  const [enrollingIds, setEnrollingIds] = useState<Set<number>>(new Set());
  // активная вкладка внутри курса: содержание или обсуждение
  const [activeTab, setActiveTab] = useState<"content" | "discussion">(
    "content",
  );
  // фильтры каталога
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [viewTab, setViewTab] = useState<"all" | "my">("all");
  const toast = useToast();
  const { user } = useAppStore();
  // могут ли создавать курсы — только учителя и администраторы
  const canCreateCourse = user?.role === "teacher" || user?.role === "admin";

  // возвращает url обложки курса — своя или дефолтная от picsum
  const courseCoverUrl = (course: { id: number; title: string; coverUrl?: string }) => {
    return (course.coverUrl && course.coverUrl.trim()) ? course.coverUrl : "";
  };

  // вытаскиваем id шага из query-параметра ?step=123
  const requestedStepId = useMemo(() => {
    const value = Number(searchParams.get("step") || 0);
    return Number.isInteger(value) && value > 0 ? value : null;
  }, [searchParams]);

  // грузим список всех курсов, потом пробуем подтянуть прогресс если залогинен
  const loadCourses = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.get<CourseItem[]>("/courses");
      try {
        // прогресс грузим отдельно — может упасть если не залогинен, это нормально
        const progressMap =
          await api.get<Record<number, number>>("/my-progress");
        for (const course of data) {
          if (progressMap[course.id] !== undefined) {
            course.progress = progressMap[course.id];
            course.enrolled = true;
          }
        }
      } catch {
        /* не залогинен — пропускаем */
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

  // грузим шаги и прогресс конкретного курса
  const loadCourseContent = async (cId: number) => {
    setContentLoading(true);
    setContentError("");
    try {
      const data = await api.get<CourseContentResponse & { error?: string }>(
        `/courses/${cId}/steps`,
      );
      if (data.error) {
        setContentError(data.error);
        setContentLoading(false);
        return;
      }
      setCourseContent(data);
      const firstStepId = data.steps[0]?.id ?? null;

      // восстанавливаем последний открытый шаг из localStorage
      const savedStepId = Number(localStorage.getItem(STEP_KEY(cId)) || 0);
      const savedStepExists = savedStepId > 0 && data.steps.some(s => s.id === savedStepId);

      // если в урле есть ?step= — открываем именно его
      const requestStepExists =
        requestedStepId && data.steps.some((s) => s.id === requestedStepId);

      if (requestStepExists) {
        setSelectedStepId(requestedStepId);
      } else if (savedStepExists) {
        // иначе восстанавливаем последний посещённый шаг
        const savedProgress = data.progress.find(p => p.stepId === savedStepId);
        setSelectedStepId(savedStepId);
        setStepAnswer(savedProgress?.answerText || "");
      } else {
        // по умолчанию открываем первый шаг
        setSelectedStepId(firstStepId);
        setStepAnswer("");
      }

      // восстанавливаем историю попыток из прогресса с сервера
      // реальные попытки сессии (с id от Date.now()) важнее восстановленных
      setAttemptHistory((prev) => {
        const restoredHistory: AttemptEntry[] = data.progress
          .filter((p) => p.answerText || p.score > 0)
          .map((p) => ({
            id: p.stepId * 1000, // стабильный синтетический id для восстановленных попыток
            stepId: p.stepId,
            answer: p.answerText || "",
            passed: p.status === "completed",
            feedback: p.status === "completed" ? "Принято" : "Не засчитано",
            createdAt: p.completedAt || new Date().toISOString(),
            checkResults: null,
          }));
        // реальные попытки — те что с id от Date.now(), они большие числа
        const realAttempts = prev.filter((a) => a.id > 1_000_000);
        const realStepIds = new Set(realAttempts.map((a) => a.stepId));
        // добавляем восстановленные только там где нет реальных
        const fillIns = restoredHistory.filter((r) => !realStepIds.has(r.stepId));
        return [...realAttempts, ...fillIns];
      });
    } catch (err) {
      setContentError(
        err instanceof Error ? err.message : "Не удалось загрузить шаги курса",
      );
    } finally {
      setContentLoading(false);
    }
  };

  // проверяем записан ли юзер на этот курс — нужно для отображения кнопок
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

  // грузим детальную инфу о курсе — описание, рейтинг, модули
  const loadCourseDetail = async (cId: number) => {
    try {
      const data = await api.get<CourseDetailType>(`/courses/${cId}/detail`);
      setCourseDetail(data);
    } catch {
      setCourseDetail(null);
    }
  };

  // грузим рейтинг который поставил текущий юзер
  const loadMyRating = async (cId: number) => {
    try {
      const data = await api.get<{
        myScore: number | null;
        myComment: string;
        avgRating: number;
        ratingCount: number;
        progress: number;
        canRate: boolean;
      }>(`/student/courses/${cId}/my-rating`);
      setMyRating(data);
    } catch {
      setMyRating(null);
    }
  };

  // отправляем оценку курса на сервер
  const submitRating = async (score: number, comment: string) => {
    if (!selectedCourseId) return;
    try {
      await api.post(`/student/courses/${selectedCourseId}/rate`, { score, comment });
      await loadMyRating(selectedCourseId);
      toast.success("Оценка сохранена!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить оценку");
    }
  };

  // при монтировании сразу грузим курсы
  useEffect(() => {
    void loadCourses();
  }, []);

  // когда меняется открытый курс — грузим всё связанное с ним
  useEffect(() => {
    if (!isCoursePage || !selectedCourseId) {
      // вышли из курса — чистим все данные
      setCourseContent(null);
      setSelectedStepId(null);
      setEnrollmentStatus(null);
      setCourseDetail(null);
      setContentLoading(false);
      return;
    }
    setContentLoading(true);
    // параллельно грузим контент, статус записи, детали и рейтинг
    void loadCourseContent(selectedCourseId);
    void loadEnrollmentStatus(selectedCourseId);
    void loadCourseDetail(selectedCourseId);
    void loadMyRating(selectedCourseId);
  }, [isCoursePage, selectedCourseId, requestedStepId]);

  // запрос доступа к курсу — для курсов с модерируемым доступом
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

  // записываемся на курс — защищаем от двойного клика через enrollingIds
  const enrollCourse = async (cId: number) => {
    if (enrollingIds.has(cId)) return;
    setEnrollingIds(prev => new Set(prev).add(cId));
    try {
      const result = await api.post<{ success?: boolean; error?: string }>(
        `/courses/${cId}/enroll`,
        {},
      );
      if (result.error) toast.error(result.error);
      else {
        const courseName = courses.find(c => c.id === cId)?.title;
        toast.success(courseName ? `Вы записались на «${courseName}»` : "Запись на курс выполнена");
        // обновляем уведомления в шапке
        window.dispatchEvent(new Event("gradus:notifications:refresh"));
        await loadCourses();
        if (isCoursePage && selectedCourseId === cId) {
          await loadCourseContent(cId);
          await loadEnrollmentStatus(cId);
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось записаться");
    } finally {
      // убираем курс из множества загружающихся
      setEnrollingIds(prev => { const s = new Set(prev); s.delete(cId); return s; });
    }
  };

  // отправляем ответ на проверку — работает для теории, теста, кода и эссе
  const submitStep = async () => {
    if (!selectedStepId || !selectedCourseId) return;
    setStepLoading(true);
    setStepError("");
    setStepMessage("");
    setStepCheckResults(null);
    try {
      const response = await api.post<{
        passed: boolean;
        feedback: string;
        checkResults?: Array<{ name: string; passed: boolean }> | null;
        aiComment?: string | null;
      }>(`/steps/${selectedStepId}/check`, { answer: stepAnswer });
      // зелёный если прошёл, красный если нет
      if (response.passed) {
        setStepMessage(response.feedback);
        setStepError("");
      } else {
        setStepError(response.feedback);
        setStepMessage("");
      }
      setStepCheckResults(response.checkResults ?? null);
      setStepAiComment(response.aiComment ?? null);
      // добавляем эту попытку в начало истории
      setAttemptHistory((prev) => [
        {
          id: Date.now(),
          stepId: selectedStepId!,
          answer: stepAnswer,
          passed: response.passed,
          feedback: response.feedback,
          createdAt: new Date().toISOString(),
          checkResults: response.checkResults ?? null,
          aiComment: response.aiComment ?? null,
        },
        ...prev,
      ]);
      if (response.passed) toast.success("Шаг принят");
      // обновляем прогресс в курсе и в каталоге
      await Promise.all([loadCourseContent(selectedCourseId), loadCourses()]);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Не удалось проверить шаг";
      setStepError(message);
      toast.error(message);
    } finally {
      setStepLoading(false);
    }
  };

  // выбираем шаг — сбрасываем старые ответы и сохраняем в localStorage
  const selectStep = (stepId: number, answerText = "") => {
    setSelectedStepId(stepId);
    setStepAnswer(answerText);
    setStepError("");
    setStepMessage("");
    setStepCheckResults(null);
    setStepAiComment(null);
    // запоминаем чтобы восстановить при следующем заходе
    if (selectedCourseId) {
      localStorage.setItem(STEP_KEY(selectedCourseId), String(stepId));
    }
  };

  // открываем/закрываем модуль в боковом меню
  const toggleModule = (moduleId: number) => {
    setOpenModules((prev) => ({ ...prev, [moduleId]: !prev[moduleId] }));
  };

  // если открыт конкретный курс — рендерим страницу курса
  if (isCoursePage) {
    return (
      <MainLayout>
        <CourseDetail
          selectedCourseId={selectedCourseId!}
          courseContent={courseContent}
          courseDetail={courseDetail}
          contentLoading={contentLoading}
          contentError={contentError}
          enrollmentStatus={enrollmentStatus}
          selectedStepId={selectedStepId}
          stepAnswer={stepAnswer}
          setStepAnswer={setStepAnswer}
          stepLoading={stepLoading}
          stepError={stepError}
          stepMessage={stepMessage}
          stepCheckResults={stepCheckResults}
          stepAiComment={stepAiComment}
          attemptHistory={attemptHistory}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          enrollRequestMessage={enrollRequestMessage}
          setEnrollRequestMessage={setEnrollRequestMessage}
          enrollRequestLoading={enrollRequestLoading}
          openModules={openModules}
          setOpenModules={setOpenModules}
          onNavigateBack={() => navigate("/course")}
          onEnroll={enrollCourse}
          onRequestEnrollment={requestEnrollment}
          onSubmitStep={submitStep}
          onSelectStep={selectStep}
          onToggleModule={toggleModule}
          myRating={myRating}
          onSubmitRating={submitRating}
        />
      </MainLayout>
    );
  }

  // иначе показываем каталог курсов
  return (
    <MainLayout>
      <CourseCatalog
        courses={courses}
        loading={loading}
        error={error}
        search={search}
        setSearch={setSearch}
        active={active}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        selectedLevel={selectedLevel}
        setSelectedLevel={setSelectedLevel}
        viewTab={viewTab}
        setViewTab={setViewTab}
        canCreateCourse={canCreateCourse}
        onNavigateToCreate={() => navigate("/teacher/courses/new")}
        onNavigateToCourse={(id) => navigate(`/course/${id}`)}
        onEnroll={enrollCourse}
        enrollingIds={enrollingIds}
        courseCoverUrl={courseCoverUrl}
      />
    </MainLayout>
  );
}
