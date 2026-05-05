import { useEffect, useState } from "react";
import MainLayout from "../layout/MainLayout";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Card from "../components/ui/Card";
import { Target, Flame, Award, CalendarDays, ArrowUpRight } from "lucide-react";
import { api } from "../lib/api";
import Skeleton from "../components/ui/Skeleton";
import EmptyState from "../components/ui/EmptyState";

import { fadeInUp, staggerContainer } from "../lib/animations";

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [weeklyGoal, setWeeklyGoal] = useState(10);
  const [payload, setPayload] = useState<{
    stats: {
      activeCourses: number;
      streakDays: number;
      averageScore: string;
      tasksWeek: number;
    };
    continue: {
      courseId: number;
      courseTitle: string;
      stepId: number;
      stepTitle: string;
      stepOrder: number;
    } | null;
    weeklyPlan: {
      goalSteps: number;
      completedSteps: number;
      remainingSteps: number;
      forecastDays: number;
    };
    courses: Array<{ id: number; title: string; progress: number }>;
    activities: Array<{ id: number; text: string; time: string }>;
    deadline: { title: string; text: string };
  } | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await api.get<{
          stats: {
            activeCourses: number;
            streakDays: number;
            averageScore: string;
            tasksWeek: number;
          };
          continue: {
            courseId: number;
            courseTitle: string;
            stepId: number;
            stepTitle: string;
            stepOrder: number;
          } | null;
          weeklyPlan: {
            goalSteps: number;
            completedSteps: number;
            remainingSteps: number;
            forecastDays: number;
          };
          courses: Array<{ id: number; title: string; progress: number }>;
          activities: Array<{ id: number; text: string; time: string }>;
          deadline: { title: string; text: string };
        }>("/dashboard");
        setPayload(data);
        setWeeklyGoal(data.weeklyPlan.goalSteps);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Не удалось загрузить данные панели",
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const updateWeeklyGoal = (nextGoal: number) => {
    const safeGoal = Math.max(3, Math.min(50, Math.round(nextGoal)));
    setWeeklyGoal(safeGoal);
    api
      .patch<{ goal: number }>("/student/weekly-goal", { goal: safeGoal })
      .catch(() => {});
  };

  const stats = [
    {
      label: "Активные курсы",
      value: String(payload?.stats.activeCourses ?? 0),
      icon: Target,
    },
    {
      label: "Серия",
      value: `${payload?.stats.streakDays ?? 0} дней`,
      icon: Flame,
    },
    {
      label: "Средний балл",
      value: payload?.stats.averageScore ?? "0%",
      icon: Award,
    },
    {
      label: "Задач за неделю",
      value: String(payload?.stats.tasksWeek ?? 0),
      icon: CalendarDays,
    },
  ];

  const completedWeeklySteps = payload?.weeklyPlan.completedSteps ?? 0;
  const weeklyPercent = weeklyGoal
    ? Math.min(100, Math.round((completedWeeklySteps / weeklyGoal) * 100))
    : 0;
  const continueStep = payload?.continue;
  const weeklyRemaining = Math.max(weeklyGoal - completedWeeklySteps, 0);

  // «Фокус на сегодня» — реальные данные из статистики, без AI
  const todayFocus: string[] = [];
  if (payload) {
    if (payload.continue) {
      todayFocus.push(
        `Продолжить: ${payload.continue.courseTitle} — шаг ${payload.continue.stepOrder}`,
      );
    }
    if (weeklyRemaining > 0) {
      todayFocus.push(
        `До недельной цели осталось ${weeklyRemaining} ${weeklyRemaining === 1 ? "шаг" : weeklyRemaining < 5 ? "шага" : "шагов"}`,
      );
    }
    if (payload.stats.streakDays > 0) {
      todayFocus.push(`Серия: ${payload.stats.streakDays} дн. — не потеряйте!`);
    } else {
      todayFocus.push("Начните серию — выполните хотя бы 1 шаг сегодня");
    }
    if (payload.stats.activeCourses === 0) {
      todayFocus.push("Запишитесь на курс из каталога");
    }
    if (payload.deadline.title.startsWith("Следующий")) {
      todayFocus.push(payload.deadline.title);
    }
  }

  return (
    <MainLayout>
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="space-y-6"
      >
        <motion.div
          variants={fadeInUp}
          className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-2"
        >
          <div>
            <h2 className="text-3xl md:text-5xl font-extrabold mb-2 tracking-tight">
              Обзор
            </h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              С возвращением! Вот ваш текущий прогресс.
            </p>
          </div>
        </motion.div>

        {loading && (
          <div className="space-y-6">
            <Skeleton className="h-32 w-full !rounded-[2rem]" />
            <Skeleton className="h-64 w-full !rounded-[2rem]" />
          </div>
        )}
        {!loading && error && (
          <Card>
            <p className="text-sm text-rose-600 dark:text-rose-400 font-medium">
              {error}
            </p>
          </Card>
        )}

        {!loading && !error && (
          <div className="grid grid-cols-1 gap-6 lg:gap-8">
            {/* Stats row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {stats.map((item) => {
                const Icon = item.icon;
                return (
                  <Card
                    key={item.label}
                    className="!p-6 relative overflow-hidden group border border-white/60 dark:border-slate-700/60"
                  >
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700 pointer-events-none" />
                    <div className="flex items-start justify-between mb-4 relative z-10">
                      <div className="w-10 h-10 rounded-2xl bg-white dark:bg-zinc-800 shadow-sm border border-slate-100 dark:border-zinc-700 flex items-center justify-center text-rose-600 dark:text-rose-400">
                        <Icon size={20} />
                      </div>
                    </div>
                    <div className="relative z-10">
                      <h3 className="text-3xl font-black bg-gradient-to-br from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent leading-none mb-1.5">
                        {item.value}
                      </h3>
                      <p className="text-slate-500 font-medium text-sm">
                        {item.label}
                      </p>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Bento Grid: Weekly Plan & Continue */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
              <Card className="xl:col-span-1 flex flex-col relative overflow-hidden bg-gradient-to-br from-rose-600 to-red-700 dark:from-rose-500/20 dark:to-red-600/20 border border-white/60 dark:border-slate-700/60 text-white dark:text-slate-100 shadow-lg shadow-rose-500/20 !p-8">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 dark:bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />
                <p className="text-sm font-bold text-rose-100 dark:text-rose-300/80 mb-8 uppercase tracking-wider relative z-10">
                  План на неделю
                </p>
                <div className="relative z-10 flex-1 flex flex-col justify-center">
                  <div className="flex items-baseline gap-3 mb-2">
                    <h3 className="text-6xl font-black">
                      {completedWeeklySteps}
                    </h3>
                    <span className="text-2xl font-bold text-rose-200 dark:text-slate-400">
                      / {weeklyGoal}
                    </span>
                  </div>
                  <p className="text-base text-rose-100 dark:text-slate-300 font-medium mb-8">
                    {weeklyPercent}% цели выполнено
                  </p>

                  <div className="h-3 bg-black/20 rounded-full overflow-hidden mb-8 p-0.5 shadow-inner">
                    <div
                      className="h-full bg-white rounded-full transition-all duration-1000 ease-out shadow-sm"
                      style={{ width: `${weeklyPercent}%` }}
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={3}
                      max={50}
                      value={weeklyGoal}
                      onChange={(event) =>
                        updateWeeklyGoal(Number(event.target.value || 10))
                      }
                      className="w-16 bg-white/20 dark:bg-black/20 border border-white/30 text-white rounded-xl px-2 py-1.5 text-center font-bold outline-none focus:bg-white/30 transition-colors shadow-inner"
                    />
                    <span className="text-xs font-medium text-rose-100 dark:text-slate-400">
                      Изменить цель
                    </span>
                  </div>
                </div>
              </Card>

              <Card className="xl:col-span-2 flex flex-col justify-between border border-white/60 dark:border-slate-700/60 bg-white/70 dark:bg-zinc-900/70 !p-8 relative overflow-hidden group">
                <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

                <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6 relative z-10">
                  В фокусе
                </p>

                {continueStep ? (
                  <div className="flex-1 flex flex-col lg:flex-row gap-8 lg:items-center justify-between relative z-10">
                    <div className="space-y-6 flex-1">
                      <div>
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold mb-4 border border-blue-100 dark:border-blue-900">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                          Продолжить
                        </div>
                        <h3 className="text-3xl font-bold mb-3 tracking-tight">
                          {continueStep.courseTitle}
                        </h3>
                        <p className="text-slate-500 font-medium text-lg">
                          Шаг {continueStep.stepOrder}: {continueStep.stepTitle}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {todayFocus.slice(0, 2).map((item) => (
                          <div
                            key={item}
                            className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 bg-white/50 dark:bg-zinc-800/50 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-zinc-700"
                          >
                            <Target
                              size={14}
                              className="text-rose-500 shrink-0"
                            />
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center lg:items-end justify-start lg:justify-center mt-4 lg:mt-0">
                      <button
                        onClick={() =>
                          navigate(
                            `/course/${continueStep.courseId}?step=${continueStep.stepId}`,
                          )
                        }
                        className="group/btn w-20 h-20 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl hover:shadow-2xl hover:shadow-slate-900/20 dark:hover:shadow-white/20"
                      >
                        <ArrowUpRight
                          size={32}
                          className="group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform"
                        />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center py-8 relative z-10">
                    <EmptyState
                      title="Все шаги пройдены"
                      description="Откройте каталог и добавьте новый курс, чтобы сохранить темп обучения."
                    />
                  </div>
                )}
              </Card>
            </div>

            {/* Courses and Activities */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between px-2">
                  <motion.h3
                    variants={fadeInUp}
                    className="text-2xl font-bold tracking-tight"
                  >
                    Мои курсы
                  </motion.h3>
                </div>

                <div className="grid gap-4">
                  {(payload?.courses ?? []).map((c) => (
                    <Card
                      key={c.id}
                      className="flex flex-col sm:flex-row gap-6 sm:items-center sm:justify-between border border-white/60 dark:border-slate-700/60 bg-white/60 dark:bg-zinc-900/60 group"
                    >
                      <div className="flex-1">
                        <h4 className="font-bold text-xl mb-1 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                          {c.title}
                        </h4>
                        <div className="flex items-center gap-4 mt-4">
                          <div className="flex-1 max-w-[240px] h-2.5 rounded-full bg-slate-200/50 dark:bg-zinc-800 overflow-hidden shadow-inner">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-sm transition-all duration-1000"
                              style={{ width: `${c.progress}%` }}
                            />
                          </div>
                          <span className="text-sm font-bold text-slate-500">
                            {c.progress}%
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => navigate(`/course/${c.id}`)}
                        className="sm:shrink-0 px-6 py-3 rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 shadow-sm hover:border-rose-300 dark:hover:border-rose-500/50 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:shadow-md text-sm font-bold text-slate-700 dark:text-slate-200 transition-all"
                      >
                        Перейти
                      </button>
                    </Card>
                  ))}

                  {(payload?.courses ?? []).length === 0 && (
                    <EmptyState
                      title="Нет активных курсов"
                      description="Вы еще не начали ни одного курса на этой неделе."
                    />
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <motion.h3
                  variants={fadeInUp}
                  className="text-2xl font-bold tracking-tight px-2"
                >
                  Активность
                </motion.h3>

                <div className="space-y-4">
                  {payload?.deadline.title &&
                    !payload.deadline.title.includes("Ожидание") && (
                      <Card className="border border-rose-200 dark:border-rose-500/30 bg-gradient-to-br from-rose-50 to-white dark:from-rose-500/10 dark:to-zinc-900/50">
                        <div className="flex items-start gap-4">
                          <div className="mt-1 w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center shrink-0 border border-rose-200 dark:border-rose-500/30">
                            <CalendarDays
                              size={18}
                              className="text-rose-600 dark:text-rose-400"
                            />
                          </div>
                          <div>
                            <h4 className="font-bold text-lg text-rose-900 dark:text-rose-200 leading-tight">
                              {payload.deadline.title}
                            </h4>
                            <p className="text-sm font-medium text-rose-600/80 dark:text-rose-400/80 mt-2">
                              {payload.deadline.text}
                            </p>
                          </div>
                        </div>
                      </Card>
                    )}

                  <Card className="space-y-8 border border-white/60 dark:border-slate-700/60 bg-white/60 dark:bg-zinc-900/60">
                    {(payload?.activities ?? []).map((a, i) => (
                      <div key={a.id} className="relative flex gap-5">
                        {i !== (payload?.activities?.length ?? 0) - 1 && (
                          <div className="absolute left-2.5 top-7 bottom-[-32px] w-[2px] bg-slate-100 dark:bg-zinc-800" />
                        )}
                        <div className="w-5 h-5 rounded-full border-[3px] border-white dark:border-zinc-900 bg-rose-400 dark:bg-rose-500 shrink-0 z-10 mt-1 shadow-sm" />
                        <div className="pb-1">
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-snug">
                            {a.text}
                          </p>
                          <p className="text-xs font-semibold text-slate-400 mt-1.5">
                            {a.time}
                          </p>
                        </div>
                      </div>
                    ))}
                    {(payload?.activities ?? []).length === 0 && (
                      <p className="text-sm font-medium text-slate-500 text-center py-6">
                        Пока нет недавней активности.
                      </p>
                    )}
                  </Card>
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </MainLayout>
  );
}
