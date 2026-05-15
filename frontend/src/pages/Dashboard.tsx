// ─── ДАШБОРД (главная страница после входа) ───────────────────────────────────
//
// КАК РАБОТАЕТ:
//   при монтировании → GET /dashboard → бэк собирает из БД все данные одним запросом:
//     stats       — 4 ключевых метрики (активные курсы, стрик, средний балл, задачи за неделю)
//     continue    — последний незавершённый шаг курса (чтобы быстро продолжить)
//     weeklyPlan  — прогресс к недельной цели (выполнено / цель / прогноз)
//     courses     — список курсов студента с процентом прохождения
//     activities  — лента последних событий (прошёл шаг, получил XP, завершил курс)
//
// weeklyGoal хранится в локальном стейте, а не только в payload — это нужно чтобы
//   поле ввода цели отзывалось мгновенно без ожидания ответа сервера
//   обновление на сервере идёт в фоне через PATCH /student/weekly-goal
//
// структура страницы (сверху вниз):
//   1. Заголовок с именем ("Привет, Ярослав")
//   2. Скелетон / ошибка (пока грузится)
//   3. 4 карточки статистики в ряд
//   4. "План на неделю" (слева, 2 колонки) + "Я прохожу" (справа, 3 колонки)
//   5. "Мои курсы" (слева, 2 колонки) + "Активность" (справа, 1 колонка)

import { useEffect, useState } from "react";
import MainLayout from "../layout/MainLayout";
import { useNavigate } from "react-router-dom";
import { Flame, Award, ArrowRight, BookOpen, Clock, TrendingUp } from "lucide-react";
import { api } from "../lib/api";
import { useAppStore } from "../store/AppStore";

// полный тип ответа от GET /dashboard — бэк возвращает именно этот объект
// null в continue означает что студент завершил все шаги всех курсов
type DashboardPayload = {
  stats: {
    activeCourses: number;  // курсы на которые записан и ещё не завершил
    streakDays: number;     // сколько дней подряд заходил и делал хоть что-то
    averageScore: string;   // средний балл за все сданные задания, например "78%"
    tasksWeek: number;      // количество выполненных шагов за текущую неделю
  };
  // последний незавершённый шаг — для кнопки "Продолжить"
  // null если всё пройдено или нет активных курсов
  continue: {
    courseId: number;
    courseTitle: string;
    stepId: number;
    stepTitle: string;
    stepOrder: number; // порядковый номер шага в курсе (для отображения "Шаг 5")
  } | null;
  weeklyPlan: {
    goalSteps: number;      // цель пользователя (он сам её устанавливает)
    completedSteps: number; // сколько шагов пройдено за текущую неделю
    remainingSteps: number; // сколько осталось до цели
    forecastDays: number;   // прогноз: за сколько дней достигнет цели при текущем темпе
  };
  // только курсы на которые записан студент, с прогрессом 0-100%
  courses: Array<{ id: number; title: string; progress: number }>;
  // лента событий: "Завершил шаг «Переменные»", "+50 XP", "Записался на курс"
  activities: Array<{ id: number; text: string; time: string }>;
  deadline: { title: string; text: string };
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAppStore(); // берём пользователя из глобального стора для приветствия
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // weeklyGoal отдельно от payload — чтобы поле цели сразу отражало ввод пользователя
  // null пока данные ещё не загрузились (показываем пустое поле а не 0)
  const [weeklyGoal, setWeeklyGoal] = useState<number | null>(null);
  const [payload, setPayload] = useState<DashboardPayload | null>(null);

  // загружаем все данные дашборда одним запросом при монтировании страницы
  // [] в зависимостях — выполняется только один раз, при первом рендере
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await api.get<DashboardPayload>("/dashboard");
        setPayload(data);
        // синхронизируем локальную цель с сохранённой на сервере
        setWeeklyGoal(data.weeklyPlan.goalSteps);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить данные");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  // обновляет недельную цель: сразу в локальный стейт (UI реагирует мгновенно)
  // и в фоне отправляет на сервер — если запрос упадёт, пользователь не заметит
  // Math.max(3, Math.min(50, ...)) — ограничиваем диапазон: минимум 3, максимум 50 шагов
  const updateWeeklyGoal = (next: number) => {
    const safe = Math.max(3, Math.min(50, Math.round(next)));
    setWeeklyGoal(safe);
    // .catch(() => {}) — явно игнорируем ошибку, не хотим показывать тост за фоновую синхронизацию
    api.patch<{ goal: number }>("/student/weekly-goal", { goal: safe }).catch(() => {});
  };

  // вычисляем прогресс к недельной цели в процентах (0-100)
  const completedSteps = payload?.weeklyPlan.completedSteps ?? 0;
  // resolvedGoal: берём из локального стейта (если пользователь уже редактировал),
  //   иначе из пришедших с сервера данных, иначе дефолт 10
  const resolvedGoal = weeklyGoal ?? payload?.weeklyPlan.goalSteps ?? 10;
  // Math.min(100, ...) — прогресс не может быть больше 100% даже если перевыполнили план
  const weeklyPercent = resolvedGoal ? Math.min(100, Math.round((completedSteps / resolvedGoal) * 100)) : 0;
  // шаг для продолжения — null если всё пройдено
  const continueStep = payload?.continue;

  // данные для 4 карточек статистики — вынесены в массив чтобы не дублировать JSX
  // ?? 0 и ?? "—" — значения по умолчанию пока payload ещё null
  const statCards = [
    { label: "Активные курсы", value: String(payload?.stats.activeCourses ?? 0), icon: BookOpen, color: "text-primary", bg: "bg-primary-50 dark:bg-primary-900/20" },
    { label: "Серия дней", value: `${payload?.stats.streakDays ?? 0}`, icon: Flame, color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-900/20" },
    { label: "Средний балл", value: payload?.stats.averageScore ?? "—", icon: Award, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/20" },
    { label: "Задач за неделю", value: String(payload?.stats.tasksWeek ?? 0), icon: TrendingUp, color: "text-green-500", bg: "bg-green-50 dark:bg-green-900/20" },
  ];

  // берём только имя из полного имени "Ярослав Поляков" → "Ярослав"
  // || "студент" — запасной вариант если имя не заполнено
  const firstName = user?.name?.split(" ")[0] || "студент";

  return (
    <MainLayout>
      {/* max-w-7xl ограничивает ширину на очень широких мониторах */}
      <div className="space-y-6 max-w-7xl">

        {/* ── Заголовок страницы ── */}
        <div>
          <h1 className="font-display font-bold text-3xl md:text-4xl text-[var(--text)] mb-1">
            Привет, {firstName}
          </h1>
          <p className="text-[var(--muted)]">Вот ваш прогресс на сегодня</p>
        </div>

        {/* ── Скелетон загрузки ── */}
        {/* animate-pulse — Tailwind анимация мигания, имитирует загрузку карточек */}
        {loading && (
          <div className="space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className="h-24 rounded-2xl bg-[var(--surface)] animate-pulse" />
            ))}
          </div>
        )}

        {/* ── Ошибка загрузки ── */}
        {!loading && error && (
          <div className="card p-5 border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10">
            <p className="text-sm text-red-500 font-medium">{error}</p>
          </div>
        )}

        {/* ── Основной контент (только когда загрузилось и нет ошибки) ── */}
        {!loading && !error && (
          <div className="space-y-5">

            {/* ── Блок 1: 4 карточки статистики ── */}
            {/* grid-cols-2 на мобиле (2 в ряд), grid-cols-4 на десктопе (4 в ряд) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {statCards.map((s) => {
                const Icon = s.icon; // иконка из lucide-react, передаём как компонент
                return (
                  <div key={s.label} className="card p-5">
                    {/* цветной кружок с иконкой — цвет зависит от типа метрики */}
                    <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center ${s.color} mb-3`}>
                      <Icon size={18} />
                    </div>
                    {/* крупное число — главное значение карточки */}
                    <p className="font-display font-bold text-3xl text-[var(--text)] leading-none mb-1">{s.value}</p>
                    {/* подпись под числом */}
                    <p className="text-xs text-[var(--muted)] font-medium">{s.label}</p>
                  </div>
                );
              })}
            </div>

            {/* ── Блок 2: недельный план + текущий курс ── */}
            {/* lg:grid-cols-5: план занимает 2 колонки, "я прохожу" — 3 колонки */}
            <div className="grid lg:grid-cols-5 gap-4">

              {/* Карточка "План на неделю" — красный фон, белый текст */}
              <div className="lg:col-span-2 relative overflow-hidden rounded-2xl bg-primary p-6 text-white">
                {/* декоративный круг в правом верхнем углу — чисто визуальный элемент */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4" />
                {/* z-10 — контент поверх декоративного круга */}
                <div className="relative z-10">
                  <p className="text-xs font-semibold uppercase tracking-widest text-white/60 mb-4">План на неделю</p>
                  {/* большие цифры: выполнено / цель */}
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-display font-bold text-5xl">{loading ? "—" : completedSteps}</span>
                    <span className="text-xl font-semibold text-white/50">/ {loading ? "—" : resolvedGoal}</span>
                  </div>
                  <p className="text-sm text-white/70 mb-5">{loading ? "Загрузка..." : `${weeklyPercent}% цели выполнено`}</p>
                  {/* прогресс-бар: белая полоска на белом/прозрачном фоне */}
                  <div className="h-2 rounded-full bg-white/20 overflow-hidden mb-5">
                    <div
                      className="h-full rounded-full bg-white transition-all duration-300"
                      style={{ width: loading ? "0%" : `${weeklyPercent}%` }}
                    />
                  </div>
                  {/* поле ввода недельной цели — пользователь меняет прямо здесь */}
                  {/* min={3} max={50} — ограничения на уровне HTML input, дублируем в updateWeeklyGoal */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/60">Цель:</span>
                    <input
                      type="number"
                      min={3} max={50}
                      value={loading ? "" : resolvedGoal}
                      onChange={(e) => updateWeeklyGoal(Number(e.target.value || 10))}
                      className="w-14 bg-white/20 border border-white/30 text-white text-center rounded-lg px-2 py-1 text-sm font-bold outline-none focus:bg-white/30 transition-colors"
                    />
                    <span className="text-xs text-white/60">шагов</span>
                  </div>
                </div>
              </div>

              {/* Карточка "Я прохожу" — последний незавершённый шаг */}
              <div className="lg:col-span-3 card p-6 flex flex-col">
                <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)] mb-4">Я прохожу</p>

                {/* если есть незавершённый шаг — показываем название курса и кнопку "Перейти" */}
                {continueStep ? (
                  <div className="flex flex-col flex-1">
                    <div className="min-w-0">
                      <h3 className="font-display font-bold text-xl text-[var(--text)] mb-1">{continueStep.courseTitle}</h3>
                      <p className="text-sm text-[var(--muted)]">Шаг {continueStep.stepOrder}: {continueStep.stepTitle}</p>
                    </div>
                    <div className="flex justify-end mt-4">
                      {/* navigate с query-параметром ?step=ID — CourseStep.tsx читает его и открывает нужный шаг */}
                      <button
                        onClick={() => navigate(`/course/${continueStep.courseId}?step=${continueStep.stepId}`)}
                        className="btn-primary px-5 py-2.5 text-sm gap-1.5"
                      >
                        Перейти <ArrowRight size={15} />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* если шагов нет — заглушка с предложением открыть каталог */
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

            {/* ── Блок 3: мои курсы + лента активности ── */}
            {/* lg:grid-cols-3: курсы занимают 2 колонки, активность — 1 колонку */}
            <div className="grid lg:grid-cols-3 gap-4">

              {/* Список курсов студента */}
              <div className="lg:col-span-2 card p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-display font-semibold text-lg text-[var(--text)]">Мои курсы</h2>
                  <button onClick={() => navigate("/course")} className="text-xs font-semibold text-primary hover:text-primary-700 transition-colors flex items-center gap-1">
                    Все <ArrowRight size={13} />
                  </button>
                </div>

                {/* заглушка если курсов нет */}
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
                      /* клик по строке курса → переход на страницу курса */
                      <div key={c.id}
                        className="flex items-center gap-4 p-4 rounded-xl bg-[var(--surface)] hover:border-primary/20 border border-transparent cursor-pointer group transition-all"
                        onClick={() => navigate(`/course/${c.id}`)}
                      >
                        <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center text-primary shrink-0">
                          <BookOpen size={17} />
                        </div>
                        <div className="flex-1 min-w-0">
                          {/* truncate — обрезает длинное название с "..." */}
                          <p className="font-semibold text-sm text-[var(--text)] truncate group-hover:text-primary transition-colors">{c.title}</p>
                          {/* прогресс-бар: процент пройденных шагов */}
                          <div className="flex items-center gap-2 mt-1.5">
                            <div className="flex-1 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary transition-all duration-300"
                                style={{ width: `${c.progress}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-[var(--muted)] shrink-0">{c.progress}%</span>
                          </div>
                        </div>
                        {/* стрелка появляется только при hover через opacity-0 → opacity-100 */}
                        <ArrowRight size={15} className="text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Лента активности — вертикальная timeline */}
              <div className="card p-6">
                <h2 className="font-display font-semibold text-lg text-[var(--text)] mb-5">Активность</h2>

                {/* заглушка если активности ещё нет */}
                {(payload?.activities ?? []).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Clock size={28} className="text-[var(--border)] mb-3" />
                    <p className="text-xs text-[var(--muted)]">Активность появится после первых шагов</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(payload?.activities ?? []).map((a, i) => (
                      <div key={a.id} className="flex gap-3">
                        {/* вертикальная линия timeline: точка + линия вниз (кроме последнего элемента) */}
                        <div className="relative flex flex-col items-center">
                          <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                          {/* линия соединяет точки между элементами, у последнего её нет */}
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
