// главная страница после входа — показывает статистику, прогресс и активность
import { useEffect, useState } from "react";
import MainLayout from "../layout/MainLayout";
import { useNavigate } from "react-router-dom";
import { Flame, Award, CalendarDays, ArrowRight, BookOpen, Clock, TrendingUp } from "lucide-react";
import { api } from "../lib/api";
import { useAppStore } from "../store/AppStore";

// всё что приходит с сервера для дашборда
type DashboardPayload = {
  stats: { activeCourses: number; streakDays: number; averageScore: string; tasksWeek: number };
  continue: { courseId: number; courseTitle: string; stepId: number; stepTitle: string; stepOrder: number } | null;
  weeklyPlan: { goalSteps: number; completedSteps: number; remainingSteps: number; forecastDays: number };
  courses: Array<{ id: number; title: string; progress: number }>;
  activities: Array<{ id: number; text: string; time: string }>;
  deadline: { title: string; text: string };
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // недельная цель — можно менять прямо на странице, синхронизируется с сервером
  const [weeklyGoal, setWeeklyGoal] = useState(10);
  const [payload, setPayload] = useState<DashboardPayload | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await api.get<DashboardPayload>("/dashboard");
        setPayload(data);
        setWeeklyGoal(data.weeklyPlan.goalSteps);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить данные");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  // сохраняем новую цель на сервере — clamp чтобы не поставили 0 или 9999
  const updateWeeklyGoal = (next: number) => {
    const safe = Math.max(3, Math.min(50, Math.round(next)));
    setWeeklyGoal(safe);
    api.patch<{ goal: number }>("/student/weekly-goal", { goal: safe }).catch(() => {});
  };

  const completedSteps = payload?.weeklyPlan.completedSteps ?? 0;
  const weeklyPercent = weeklyGoal ? Math.min(100, Math.round((completedSteps / weeklyGoal) * 100)) : 0;
  // шаг с которого можно продолжить обучение
  const continueStep = payload?.continue;

  // карточки статистики — каждая с иконкой и цветом
  const statCards = [
    { label: "Активные курсы", value: String(payload?.stats.activeCourses ?? 0), icon: BookOpen, color: "text-primary", bg: "bg-primary-50 dark:bg-primary-900/20" },
    { label: "Серия дней", value: `${payload?.stats.streakDays ?? 0}`, icon: Flame, color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-900/20" },
    { label: "Средний балл", value: payload?.stats.averageScore ?? "—", icon: Award, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/20" },
    { label: "Задач за неделю", value: String(payload?.stats.tasksWeek ?? 0), icon: TrendingUp, color: "text-green-500", bg: "bg-green-50 dark:bg-green-900/20" },
  ];

  // берём только имя чтобы обращаться "Привет, Иван" вместо "Привет, Иван Петров"
  const firstName = user?.name?.split(" ")[0] || "студент";

  return (
    <MainLayout>
      <div className="space-y-6 max-w-7xl">
        {/* приветствие с именем */}
        <div>
          <h1 className="font-display font-bold text-3xl md:text-4xl text-[var(--text)] mb-1">
            Привет, {firstName}
          </h1>
          <p className="text-[var(--muted)]">Вот ваш прогресс на сегодня</p>
        </div>

        {/* скелетон во время загрузки */}
        {loading && (
          <div className="space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className="h-24 rounded-2xl bg-[var(--surface)] animate-pulse" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="card p-5 border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10">
            <p className="text-sm text-red-500 font-medium">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-5">
            {/* ряд карточек со статистикой */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {statCards.map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="card p-5">
                    <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center ${s.color} mb-3`}>
                      <Icon size={18} />
                    </div>
                    <p className="font-display font-bold text-3xl text-[var(--text)] leading-none mb-1">{s.value}</p>
                    <p className="text-xs text-[var(--muted)] font-medium">{s.label}</p>
                  </div>
                );
              })}
            </div>

            {/* большой блок: план на неделю + кнопка продолжить */}
            <div className="grid lg:grid-cols-5 gap-4">
              {/* план на неделю — цветной блок с прогресс-баром */}
              <div className="lg:col-span-2 relative overflow-hidden rounded-2xl bg-primary p-6 text-white">
                {/* декоративный круг в углу */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4" />
                <div className="relative z-10">
                  <p className="text-xs font-semibold uppercase tracking-widest text-white/60 mb-4">План на неделю</p>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-display font-bold text-5xl">{completedSteps}</span>
                    <span className="text-xl font-semibold text-white/50">/ {weeklyGoal}</span>
                  </div>
                  <p className="text-sm text-white/70 mb-5">{weeklyPercent}% цели выполнено</p>
                  <div className="h-2 rounded-full bg-white/20 overflow-hidden mb-5">
                    <div
                      className="h-full rounded-full bg-white transition-all duration-700"
                      style={{ width: `${weeklyPercent}%` }}
                    />
                  </div>
                  {/* инпут для изменения цели — сразу сохраняет на сервере */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/60">Цель:</span>
                    <input
                      type="number"
                      min={3} max={50}
                      value={weeklyGoal}
                      onChange={(e) => updateWeeklyGoal(Number(e.target.value || 10))}
                      className="w-14 bg-white/20 border border-white/30 text-white text-center rounded-lg px-2 py-1 text-sm font-bold outline-none focus:bg-white/30 transition-colors"
                    />
                    <span className="text-xs text-white/60">шагов</span>
                  </div>
                </div>
              </div>

              {/* блок "продолжить обучение" — показывает последний незавершённый шаг */}
              <div className="lg:col-span-3 card p-6 flex flex-col">
                <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)] mb-4">Я прохожу</p>

                {continueStep ? (
                  <div className="flex flex-col flex-1">
                    <div className="min-w-0">
                      <h3 className="font-display font-bold text-xl text-[var(--text)] mb-1">{continueStep.courseTitle}</h3>
                      <p className="text-sm text-[var(--muted)]">Шаг {continueStep.stepOrder}: {continueStep.stepTitle}</p>
                    </div>
                    <div className="flex justify-end mt-4">
                      <button
                        onClick={() => navigate(`/course/${continueStep.courseId}?step=${continueStep.stepId}`)}
                        className="btn-primary px-5 py-2.5 text-sm gap-1.5"
                      >
                        Перейти <ArrowRight size={15} />
                      </button>
                    </div>
                  </div>
                ) : (
                  // заглушка если всё пройдено или курсов нет
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-[var(--surface)] flex items-center justify-center text-[var(--muted)] mb-3">
                      <BookOpen size={22} />
                    </div>
                    <p className="font-semibold text-[var(--text)] mb-1">Все шаги пройдены</p>
                    <p className="text-sm text-[var(--muted)] mb-4">Откройте каталог и запишитесь на новый курс</p>
                    <button onClick={() => navigate("/course")} className="btn-secondary px-4 py-2 text-sm">
                      Каталог курсов
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* нижняя строка: список курсов + лента активности */}
            <div className="grid lg:grid-cols-3 gap-4">
              {/* мои курсы с прогрессом */}
              <div className="lg:col-span-2 card p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-display font-semibold text-lg text-[var(--text)]">Мои курсы</h2>
                  <button onClick={() => navigate("/course")} className="text-xs font-semibold text-primary hover:text-primary-700 transition-colors flex items-center gap-1">
                    Все <ArrowRight size={13} />
                  </button>
                </div>

                {(payload?.courses ?? []).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <BookOpen size={32} className="text-[var(--border)] mb-3" />
                    <p className="text-sm text-[var(--muted)]">Вы ещё не записались ни на один курс</p>
                    <button onClick={() => navigate("/course")} className="btn-primary px-4 py-2 text-sm mt-4">
                      Найти курс
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(payload?.courses ?? []).map((c) => (
                      <div key={c.id}
                        className="flex items-center gap-4 p-4 rounded-xl bg-[var(--surface)] hover:border-primary/20 border border-transparent cursor-pointer group transition-all"
                        onClick={() => navigate(`/course/${c.id}`)}
                      >
                        <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center text-primary shrink-0">
                          <BookOpen size={17} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-[var(--text)] truncate group-hover:text-primary transition-colors">{c.title}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <div className="flex-1 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary transition-all duration-700"
                                style={{ width: `${c.progress}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-[var(--muted)] shrink-0">{c.progress}%</span>
                          </div>
                        </div>
                        <ArrowRight size={15} className="text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* лента последних действий на платформе */}
              <div className="card p-6">
                <h2 className="font-display font-semibold text-lg text-[var(--text)] mb-5">Активность</h2>

                {/* дедлайн если есть — выводим отдельным блоком наверху */}
                {payload?.deadline.title && !payload.deadline.title.includes("Ожидание") && (
                  <div className="mb-4 p-3 rounded-xl border border-primary/20 bg-primary-50 dark:bg-primary-900/10 flex items-start gap-3">
                    <CalendarDays size={16} className="text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-primary">{payload.deadline.title}</p>
                      <p className="text-xs text-[var(--muted)] mt-0.5">{payload.deadline.text}</p>
                    </div>
                  </div>
                )}

                {(payload?.activities ?? []).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Clock size={28} className="text-[var(--border)] mb-3" />
                    <p className="text-xs text-[var(--muted)]">Активность появится после первых шагов</p>
                  </div>
                ) : (
                  // timeline с вертикальной линией между точками
                  <div className="space-y-3">
                    {(payload?.activities ?? []).map((a, i) => (
                      <div key={a.id} className="flex gap-3">
                        <div className="relative flex flex-col items-center">
                          <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                          {/* вертикальная линия — только не у последнего элемента */}
                          {i < (payload?.activities?.length ?? 0) - 1 && (
                            <div className="w-px flex-1 bg-[var(--border)] mt-1" />
                          )}
                        </div>
                        <div className="pb-3 min-w-0">
                          <p className="text-sm text-[var(--text)] leading-snug">{a.text}</p>
                          <p className="text-xs text-[var(--muted)] mt-0.5">{a.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
