// каталог курсов — основная страница со списком всех курсов
// принимает данные сверху (из Course.tsx) и просто отображает карточки
import React, { useMemo } from "react";
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
  BookOpen,
  Database,
  Globe,
  Calculator,
  Smartphone,
  Lock,
  Briefcase,
  Sparkles,
  Sprout,
  Flame,
  Trophy,
} from "lucide-react";

// тип одного курса — всё что нужно для карточки
type CourseItem = {
  id: number;
  title: string;
  lessons: number;
  progress: number;
  enrolled?: boolean; // записан ли студент на курс
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

// маппинг категорий к иконкам и цветам — поддерживает и старые и новые ключи из бд
const CATEGORY_META: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  // новые ключи маленькими буквами — так пишет CourseEditor
  programming: {
    label: "Программирование",
    icon: <Code2 size={14} />,
    color: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50",
  },
  design: {
    label: "Дизайн",
    icon: <Palette size={14} />,
    color: "text-pink-600 bg-pink-50 dark:text-pink-400 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800/50",
  },
  data_science: {
    label: "Data Science",
    icon: <FlaskConical size={14} />,
    color: "text-violet-600 bg-violet-50 dark:text-violet-400 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800/50",
  },
  marketing: {
    label: "Маркетинг",
    icon: <BarChart3 size={14} />,
    color: "text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/50",
  },
  business: {
    label: "Бизнес",
    icon: <Briefcase size={14} />,
    color: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50",
  },
  languages: {
    label: "Языки",
    icon: <Globe size={14} />,
    color: "text-teal-600 bg-teal-50 dark:text-teal-400 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800/50",
  },
  other: {
    label: "Другое",
    icon: <Sparkles size={14} />,
    color: "text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50",
  },
  // старые ключи с большой буквы — для данных которые уже есть в бд
  Programming: {
    label: "Программирование",
    icon: <Code2 size={14} />,
    color: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50",
  },
  Design: {
    label: "Дизайн",
    icon: <Palette size={14} />,
    color: "text-pink-600 bg-pink-50 dark:text-pink-400 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800/50",
  },
  "Data Science": {
    label: "Data Science",
    icon: <FlaskConical size={14} />,
    color: "text-violet-600 bg-violet-50 dark:text-violet-400 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800/50",
  },
  DevOps: {
    label: "DevOps",
    icon: <Container size={14} />,
    color: "text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/50",
  },
  QA: {
    label: "Тестирование",
    icon: <ShieldCheck size={14} />,
    color: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50",
  },
  Analytics: {
    label: "Аналитика",
    icon: <BarChart3 size={14} />,
    color: "text-cyan-600 bg-cyan-50 dark:text-cyan-400 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800/50",
  },
  Databases: {
    label: "Базы данных",
    icon: <Database size={14} />,
    color: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20",
  },
  Languages: {
    label: "Языки",
    icon: <Globe size={14} />,
    color: "text-teal-600 bg-teal-50 dark:text-teal-400 dark:bg-teal-900/20",
  },
  Math: {
    label: "Математика",
    icon: <Calculator size={14} />,
    color: "text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-900/20",
  },
  Mobile: {
    label: "Мобильная разработка",
    icon: <Smartphone size={14} />,
    color: "text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/50",
  },
  Security: {
    label: "Безопасность",
    icon: <Lock size={14} />,
    color: "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50",
  },
};

// фолбек если категория вообще не найдена в словаре
const DEFAULT_CAT = {
  label: "Другое",
  icon: <GraduationCap size={14} />,
  color: "text-[var(--muted)] bg-[var(--surface)] border border-[var(--border)]",
};
const getCatMeta = (cat: string) => CATEGORY_META[cat] ?? DEFAULT_CAT;

// метаданные уровней — иконка и цвет для бейджа на карточке
const _BEGINNER  = { label: "Начинающий",  icon: <Sprout size={11} />, color: "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800/50" }
const _INTERMEDIATE = { label: "Средний",   icon: <Flame  size={11} />, color: "text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800/50" }
const _ADVANCED  = { label: "Продвинутый", icon: <Trophy size={11} />, color: "text-rose-700 bg-rose-50 dark:text-rose-300 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800/50" }

// нормализуем разные написания уровня — в бд могут быть и английские и русские
const getLevelMeta = (level: string) => {
  const l = (level || "").toLowerCase().trim()
  if (["beginner", "начинающий", "начальный", "junior"].includes(l)) return _BEGINNER
  if (["intermediate", "средний", "средний уровень", "middle"].includes(l)) return _INTERMEDIATE
  if (["advanced", "продвинутый", "senior", "expert"].includes(l)) return _ADVANCED
  return null // уровень неизвестен — просто не показываем бейдж
}

// пропсы — всё состояние и колбэки приходят сверху из Course.tsx
type Props = {
  courses: CourseItem[];
  loading: boolean;
  error: string;
  search: string;
  setSearch: (v: string) => void;
  active: string;
  selectedCategory: string | null;
  setSelectedCategory: (v: string | null) => void;
  selectedLevel: string | null;
  setSelectedLevel: (v: string | null) => void;
  viewTab: "all" | "my"; // все курсы или только мои
  setViewTab: (v: "all" | "my") => void;
  canCreateCourse: boolean; // true если препод или админ
  onNavigateToCourse: (id: number) => void;
  onNavigateToCreate: () => void; // переход на страницу создания
  onEnroll: (id: number) => void;
  enrollingIds: Set<number>; // какие курсы сейчас в процессе записи
  courseCoverUrl: (course: { id: number; title: string; coverUrl?: string }) => string;
};

// названия уровней для фильтров — должны совпадать с тем что хранится в бд
const LEVELS = ["Начальный", "Средний", "Продвинутый"];

export default function CourseCatalog(props: Props) {
  const {
    courses,
    loading,
    error,
    search,
    setSearch,
    active,
    selectedCategory,
    setSelectedCategory,
    selectedLevel,
    setSelectedLevel,
    viewTab,
    setViewTab,
    canCreateCourse,
    onNavigateToCourse,
    onNavigateToCreate,
    onEnroll,
    enrollingIds,
    courseCoverUrl,
  } = props;

  // уникальные категории из текущего списка курсов — динамически строим фильтры
  const allCategories = useMemo(() => {
    const set = new Set(courses.map((c) => c.category || "").filter(Boolean));
    return Array.from(set).sort();
  }, [courses]);

  // курсы на которые записан текущий пользователь
  const myCourses = useMemo(
    () => courses.filter((c) => c.enrolled),
    [courses],
  );

  // в зависимости от вкладки показываем либо все курсы либо только свои
  const displayCourses = viewTab === "my" ? myCourses : courses;

  // применяем все фильтры последовательно — категория, уровень, тип, поисковая строка
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

  // сбросить все фильтры разом
  const clearFilters = () => {
    setSelectedCategory(null);
    setSelectedLevel(null);
    setSearch("");
  };
  // считаем сколько фильтров активно — чтобы показать кнопку сброса
  const activeFiltersCount = [
    selectedCategory,
    selectedLevel,
    active !== "Все" ? active : null,
  ].filter(Boolean).length;

  return (
    <div className="space-y-6 max-w-7xl">
      {/* заголовок страницы с общим количеством курсов */}
      <div>
        <h1 className="font-display font-bold text-3xl text-[var(--text)] mb-1">
          Каталог курсов
        </h1>
        <p className="text-[var(--muted)] text-sm">
          {courses.filter((c) => c.published !== false).length} курсов по
          разным направлениям
        </p>
      </div>

      {/* строка поиска + кнопки фильтров по уровню + сброс + кнопка создания */}
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
          {/* кнопка сброса фильтров — появляется только если что-то выбрано */}
          {activeFiltersCount > 0 && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors border border-red-200 dark:border-red-800/30"
            >
              <X size={11} /> Сбросить
            </button>
          )}
        </div>
        {/* кнопка создания — только преподы и админы видят */}
        {canCreateCourse && (
          <button
            onClick={onNavigateToCreate}
            className="btn-primary px-4 py-2 text-sm shrink-0"
          >
            + Создать курс
          </button>
        )}
      </div>

      {/* вкладки "Все курсы" / "Мои курсы" */}
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

      {/* фильтры по категории — динамически из существующих курсов */}
      <div className="flex gap-2 flex-wrap">
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
              {/* показываем количество курсов в категории */}
              <span className="text-[10px] opacity-60">
                {courses.filter((c) => c.category === cat).length}
              </span>
            </button>
          );
        })}
      </div>

      {/* счётчик результатов */}
      <p className="text-xs text-[var(--muted)]">
        {catalogFiltered.length} из {courses.length} курсов
      </p>

      {/* скелетон пока грузятся данные */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {catalogFiltered.map((course) => {
            const catMeta = getCatMeta(course.category || "");
            const levelMeta = getLevelMeta(course.level || "");
            return (
              <div
                key={course.id}
                className="card p-0 overflow-hidden cursor-pointer group flex flex-col"
                onClick={() => onNavigateToCourse(course.id)}
              >
                {/* обложка курса — с ленивой загрузкой и фолбеком на picsum */}
                <div className="h-48 overflow-hidden relative shrink-0 bg-gradient-to-br from-primary to-burgundy">
                  <img
                    src={courseCoverUrl(course)}
                    alt={course.title}
                    loading="lazy"
                    onError={(event) => {
                      // если обложка не загрузилась — подставляем случайную картинку с picsum
                      // dataset.fallback чтобы не попасть в бесконечный цикл onError
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

                {/* основной контент карточки */}
                <div className="p-4 flex-1 flex flex-col">
                  {/* бейджи категории и уровня */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <div
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md ${catMeta.color}`}
                    >
                      {catMeta.icon}
                      {catMeta.label}
                    </div>
                    {levelMeta && (
                      <div className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md ${levelMeta.color}`}>
                        {levelMeta.icon}
                        {levelMeta.label}
                      </div>
                    )}
                  </div>

                  <h3 className="font-semibold text-base text-[var(--text)] line-clamp-2 group-hover:text-primary transition-colors leading-snug">
                    {course.title}
                  </h3>
                  <p className="text-xs text-[var(--muted)] mt-1">
                    {course.author}
                  </p>

                  <div className="mt-auto pt-3 space-y-2">
                    {/* мета-информация: рейтинг, количество студентов, длительность */}
                    <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
                      {course.rating && course.rating !== "—" && course.rating !== "0" ? (
                        <span className="flex items-center gap-1 text-amber-500 font-semibold">
                          <Star size={12} fill="currentColor" />
                          {course.rating}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[var(--muted)] italic">
                          нет оценок
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users size={12} />
                        {course.students === "0" ? "нет студентов" : `${course.students} уч.`}
                      </span>
                      {course.duration && course.duration !== "—" && (
                        <span className="flex items-center gap-1">
                          <Clock3 size={12} />
                          {course.duration}
                        </span>
                      )}
                    </div>

                    {/* прогресс прохождения — показываем только если есть */}
                    {course.progress > 0 && (
                      <div>
                        <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${course.progress}%` }}
                          />
                        </div>
                        <p className="text-xs text-[var(--muted)] mt-0.5">
                          {course.progress}% пройдено
                        </p>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span
                        className={`text-base font-bold ${course.price === "Бесплатно" ? "text-green-600 dark:text-green-400" : "text-[var(--text)]"}`}
                      >
                        {course.price}
                      </span>
                      {/* кнопка "Записаться" — скрываем если пользователь уже записан */}
                      {!course.enrolled && (
                        <button
                          onClick={(e) => {
                            // stopPropagation чтобы не открывался курс при клике на кнопку
                            e.stopPropagation();
                            onEnroll(course.id);
                          }}
                          disabled={enrollingIds.has(course.id)}
                          className="text-sm px-4 py-2 rounded-xl btn-gradient text-white transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {enrollingIds.has(course.id) ? "Запись..." : "Записаться"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* заглушка если на "Мои курсы" нет ни одного курса */}
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

          {/* заглушка если фильтры ничего не нашли */}
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

    </div>
  );
}
