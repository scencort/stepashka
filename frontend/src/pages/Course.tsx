import MainLayout from "../layout/MainLayout";

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { useToast } from "../hooks/useToast";
import { useAppStore } from "../store/AppStore";
import CourseCatalog from "./course/CourseCatalog";
import CourseDetail from "./course/CourseDetail";

type CourseItem = {
  id: number;
  title: string;
  lessons: number;
  progress: number;
  enrolled?: boolean;
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
  const [openModules, setOpenModules] = useState<Record<number, boolean>>({});
  const [enrollmentStatus, setEnrollmentStatus] =
    useState<EnrollmentStatus | null>(null);
  const [courseDetail, setCourseDetail] = useState<CourseDetailType | null>(null);
  const [enrollRequestMessage, setEnrollRequestMessage] = useState("");
  const [enrollRequestLoading, setEnrollRequestLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"content" | "discussion">(
    "content",
  );
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [viewTab, setViewTab] = useState<"all" | "my">("all");
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
          if (progressMap[course.id] !== undefined) {
            course.progress = progressMap[course.id];
            course.enrolled = true;
          }
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
      const data = await api.get<CourseDetailType>(`/courses/${cId}/detail`);
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

  // ─── Course detail view ───────────────────────────────────────────────────────
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
          autoAdvance={autoAdvance}
          setAutoAdvance={setAutoAdvance}
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
        />
      </MainLayout>
    );
  }

  // ─── Catalog view ─────────────────────────────────────────────────────────────
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
        onCreateModalOpen={() => setCreateModalOpen(true)}
        onNavigateToCourse={(id) => navigate(`/course/${id}`)}
        onEnroll={enrollCourse}
        courseCoverUrl={courseCoverUrl}
        createModalOpen={createModalOpen}
        onCreateModalClose={() => setCreateModalOpen(false)}
        newCourseTitle={newCourseTitle}
        setNewCourseTitle={setNewCourseTitle}
        newCourseType={newCourseType}
        setNewCourseType={setNewCourseType}
        newCourseLevel={newCourseLevel}
        setNewCourseLevel={setNewCourseLevel}
        onCreateCourse={createCourse}
      />
    </MainLayout>
  );
}
