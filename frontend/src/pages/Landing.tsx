import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Sun,
  Moon,
  Terminal,
  Globe,
  Cpu,
  Layers,
  Code,
  Zap,
  Star,
  Users,
  Clock3,
  CheckCircle2,
  Brain,
  Shield,
  Trophy,
  Play,
  ChevronRight,
} from "lucide-react";
import { api } from "../lib/api";
import BrandLogo from "../components/BrandLogo";
import { useTheme } from "../context/theme";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.08, ease: "easeOut" as const } }),
};

export default function Landing() {
  const { theme, toggleTheme } = useTheme();

  const tracks = [
    { name: "Python Backend", icon: <Terminal size={20} /> },
    { name: "Web Development", icon: <Globe size={20} /> },
    { name: "Data Science", icon: <Cpu size={20} /> },
    { name: "UI/UX Design", icon: <Layers size={20} /> },
    { name: "Тестирование", icon: <Code size={20} /> },
    { name: "DevOps", icon: <Zap size={20} /> },
  ];

  const features = [
    { icon: <Code size={22} />, title: "Практика в браузере", desc: "Пишите и запускайте код прямо в браузере без установки инструментов" },
    { icon: <Brain size={22} />, title: "AI-наставник", desc: "Получайте мгновенную обратную связь и подсказки от искусственного интеллекта" },
    { icon: <Shield size={22} />, title: "Авто-проверка кода", desc: "Каждое решение проходит автоматическую проверку на тестах и качество" },
    { icon: <Trophy size={22} />, title: "Сертификаты", desc: "Подтвердите свои навыки официальным сертификатом после завершения курса" },
  ];

  const [courses, setCourses] = useState<Array<{
    id: number; title: string; author: string; level: string;
    rating: string; students: string; duration: string; price: string;
  }>>([]);

  const [landingStats, setLandingStats] = useState({
    coursesTotal: 0, studentsTotal: 0, averageRating: 0, communityMembers: 0,
  });

  const [coursesLoading, setCoursesLoading] = useState(true);

  const fmt = (v: number) =>
    new Intl.NumberFormat("ru-RU", { notation: "compact", compactDisplay: "short", maximumFractionDigits: 1 }).format(Math.max(0, Math.round(v)));

  useEffect(() => {
    const load = async () => {
      setCoursesLoading(true);
      try {
        const [cr, sr] = await Promise.allSettled([
          api.get<typeof courses>("/courses"),
          api.get<typeof landingStats>("/landing/stats"),
        ]);
        if (cr.status === "fulfilled") setCourses(cr.value.slice(0, 3));
        if (sr.status === "fulfilled") {
          const s = sr.value;
          setLandingStats({
            coursesTotal:     Number(s.coursesTotal     || 0),
            studentsTotal:    Number(s.studentsTotal    || 0),
            averageRating:    Number(s.averageRating    || 0),
            communityMembers: Number(s.communityMembers || 0),
          });
        }
      } finally { setCoursesLoading(false); }
    };
    void load();
  }, []);

  const avgRating = useMemo(
    () => landingStats.averageRating > 0 ? landingStats.averageRating.toFixed(1) : "—",
    [landingStats.averageRating]
  );

  const stats = [
    { label: "Курсов", value: landingStats.coursesTotal || "6+" },
    { label: "Студентов", value: fmt(landingStats.studentsTotal) || "—" },
    { label: "Средний рейтинг", value: avgRating },
    { label: "Сообщество", value: fmt(landingStats.communityMembers) || "—" },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] overflow-x-hidden">

      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50 bg-[var(--bg)]/90 backdrop-blur-md border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <BrandLogo
            showText
            text="Gradus"
            iconClassName="h-8 w-8"
            textClassName="text-xl font-bold font-display text-[var(--text)]"
          />

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-[var(--muted)]">
            <a href="#features" className="hover:text-[var(--text)] transition-colors">Возможности</a>
            <a href="#tracks" className="hover:text-[var(--text)] transition-colors">Треки</a>
            <a href="#courses" className="hover:text-[var(--text)] transition-colors">Каталог</a>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface)] border border-[var(--border)] transition-colors"
              aria-label="Сменить тему"
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <Link to="/login"
              className="btn-ghost px-4 py-2 text-sm hidden sm:inline-flex">
              Войти
            </Link>
            <Link to="/register"
              className="btn-primary px-4 py-2 text-sm">
              Начать бесплатно
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-24 md:pt-28 md:pb-32 flex flex-col items-center text-center">
        {/* Background blob */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/5 rounded-full blur-[120px]" />
        </div>

        <motion.div
          variants={fadeUp} initial="hidden" animate="show" custom={0}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary-50 dark:bg-primary-900/20 text-primary text-xs font-semibold mb-6"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Образование нового уровня
        </motion.div>

        <motion.h1
          variants={fadeUp} initial="hidden" animate="show" custom={1}
          className="font-display font-bold text-5xl md:text-7xl lg:text-8xl tracking-tight mb-6 max-w-4xl"
        >
          Стань разработчиком{" "}
          <span className="text-gradient-red">через практику</span>
        </motion.h1>

        <motion.p
          variants={fadeUp} initial="hidden" animate="show" custom={2}
          className="text-lg md:text-xl text-[var(--muted)] max-w-2xl mb-10 leading-relaxed"
        >
          Интерактивные курсы, мгновенная AI-проверка кода и сильное сообщество.
          Постройте карьеру в IT от нуля до первого оффера.
        </motion.p>

        <motion.div
          variants={fadeUp} initial="hidden" animate="show" custom={3}
          className="flex flex-col sm:flex-row gap-3"
        >
          <Link to="/register"
            className="btn-primary px-7 py-3.5 text-base gap-2">
            Начать бесплатно
            <ArrowRight size={18} />
          </Link>
          <a href="#courses"
            className="btn-ghost px-7 py-3.5 text-base gap-2">
            <Play size={16} className="fill-current" />
            Смотреть курсы
          </a>
        </motion.div>

        {/* Floating cards */}
        <motion.div
          initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="absolute left-4 top-1/3 hidden xl:block"
        >
          <div className="card p-4 shadow-card-md flex items-center gap-3 -rotate-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <CheckCircle2 size={20} />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold">Тест пройден!</p>
              <p className="text-xs text-[var(--muted)]">100/100 баллов</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="absolute right-4 top-1/3 hidden xl:block"
        >
          <div className="card p-4 shadow-card-md flex items-center gap-3 rotate-3">
            <div className="w-10 h-10 rounded-xl bg-burgundy/10 flex items-center justify-center text-burgundy-600 dark:text-burgundy-400 shrink-0">
              <Brain size={20} />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold">AI-ревью готово</p>
              <p className="text-xs text-[var(--muted)]">+3 предложения</p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── STATS ── */}
      <section className="border-y border-[var(--border)] bg-[var(--surface)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <motion.div
              key={i}
              variants={fadeUp} initial="hidden" whileInView="show" custom={i} viewport={{ once: true }}
              className="text-center"
            >
              <p className="font-display font-bold text-4xl md:text-5xl text-gradient-red mb-1">{s.value}</p>
              <p className="text-sm font-medium text-[var(--muted)]">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 py-24">
        <motion.div
          variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Возможности платформы</p>
          <h2 className="font-display font-bold text-4xl md:text-5xl mb-4">Всё для вашего роста</h2>
          <p className="text-[var(--muted)] text-lg max-w-xl mx-auto">
            Инструменты, которые превращают обучение в удовольствие
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((f, i) => (
            <motion.div
              key={i}
              variants={fadeUp} initial="hidden" whileInView="show" custom={i} viewport={{ once: true }}
              className="card p-6 hover:shadow-card-md transition-shadow group"
            >
              <div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                {f.icon}
              </div>
              <h3 className="font-display font-semibold text-base mb-2">{f.title}</h3>
              <p className="text-sm text-[var(--muted)] leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="bg-[var(--surface)] border-y border-[var(--border)] py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div
            variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Как это работает</p>
            <h2 className="font-display font-bold text-4xl md:text-5xl">Три шага до результата</h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "01", title: "Запишитесь на курс", desc: "Выберите подходящий трек и запишитесь на курс. Всё обучение проходит онлайн, в удобном темпе." },
              { step: "02", title: "Решайте задачи", desc: "Практикуйтесь в браузере с мгновенной проверкой. AI-наставник поможет разобраться со сложными моментами." },
              { step: "03", title: "Получите сертификат", desc: "Завершите все шаги курса и получите сертификат, подтверждающий ваши навыки." },
            ].map((item, i) => (
              <motion.div
                key={i}
                variants={fadeUp} initial="hidden" whileInView="show" custom={i} viewport={{ once: true }}
                className="relative"
              >
                <div className="text-6xl font-display font-bold text-primary/10 mb-4">{item.step}</div>
                <h3 className="font-display font-semibold text-xl mb-3">{item.title}</h3>
                <p className="text-[var(--muted)] leading-relaxed">{item.desc}</p>
                {i < 2 && (
                  <div className="absolute top-8 right-0 hidden md:flex items-center text-[var(--border)]">
                    <ChevronRight size={32} />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRACKS ── */}
      <section id="tracks" className="max-w-7xl mx-auto px-4 sm:px-6 py-24">
        <motion.div
          variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
          className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Направления</p>
            <h2 className="font-display font-bold text-4xl md:text-5xl">Выберите свой трек</h2>
          </div>
          <Link to="/register" className="btn-secondary px-5 py-2.5 text-sm w-fit gap-1.5">
            Все треки <ArrowRight size={15} />
          </Link>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {tracks.map((track, i) => (
            <motion.div
              key={i}
              variants={fadeUp} initial="hidden" whileInView="show" custom={i} viewport={{ once: true }}
              className="card p-5 flex items-center gap-4 hover:shadow-card-md hover:border-primary/20 transition-all group cursor-pointer"
            >
              <div className="w-11 h-11 rounded-xl bg-[var(--surface)] flex items-center justify-center text-[var(--muted)] group-hover:bg-primary-50 group-hover:text-primary dark:group-hover:bg-primary-900/20 transition-colors shrink-0">
                {track.icon}
              </div>
              <span className="font-semibold text-sm">{track.name}</span>
              <ChevronRight size={16} className="ml-auto text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── COURSES ── */}
      <section id="courses" className="bg-[var(--surface)] border-t border-[var(--border)] py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div
            variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
            className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Каталог</p>
              <h2 className="font-display font-bold text-4xl md:text-5xl">Популярные курсы</h2>
            </div>
            <Link to="/register" className="btn-primary px-5 py-2.5 text-sm w-fit gap-1.5">
              Все курсы <ArrowRight size={15} />
            </Link>
          </motion.div>

          {coursesLoading ? (
            <div className="grid md:grid-cols-3 gap-5">
              {[1,2,3].map(i => (
                <div key={i} className="card p-6 animate-pulse space-y-3">
                  <div className="h-4 bg-[var(--border)] rounded w-3/4" />
                  <div className="h-3 bg-[var(--border)] rounded w-1/2" />
                  <div className="h-3 bg-[var(--border)] rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : courses.length > 0 ? (
            <div className="grid md:grid-cols-3 gap-5">
              {courses.map((course, i) => (
                <motion.div
                  key={course.id}
                  variants={fadeUp} initial="hidden" whileInView="show" custom={i} viewport={{ once: true }}
                  className="card p-6 flex flex-col hover:shadow-card-md hover:border-primary/20 transition-all"
                >
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center text-primary shrink-0">
                      <Code size={18} />
                    </div>
                    <span className="badge-neutral text-xs">{course.level}</span>
                  </div>
                  <h3 className="font-display font-semibold text-base mb-1">{course.title}</h3>
                  <p className="text-sm text-[var(--muted)] mb-4">{course.author}</p>
                  <div className="mt-auto pt-4 border-t border-[var(--border)] flex items-center gap-4 text-xs text-[var(--muted)]">
                    <span className="flex items-center gap-1">
                      <Star size={12} className="text-amber-400 fill-amber-400" />
                      {course.rating}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={12} />
                      {course.students}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock3 size={12} />
                      {course.duration}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-5">
              {[
                { title: "Python Backend", author: "Сергей Ким", level: "Начальный", duration: "40 часов" },
                { title: "React + TypeScript", author: "Анна Соколова", level: "Средний", duration: "55 часов" },
                { title: "DevOps основы", author: "Алексей Морозов", level: "Продвинутый", duration: "65 часов" },
              ].map((c, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp} initial="hidden" whileInView="show" custom={i} viewport={{ once: true }}
                  className="card p-6 flex flex-col hover:shadow-card-md hover:border-primary/20 transition-all"
                >
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center text-primary shrink-0">
                      <Code size={18} />
                    </div>
                    <span className="badge-neutral text-xs">{c.level}</span>
                  </div>
                  <h3 className="font-display font-semibold text-base mb-1">{c.title}</h3>
                  <p className="text-sm text-[var(--muted)] mb-4">{c.author}</p>
                  <div className="mt-auto pt-4 border-t border-[var(--border)] flex items-center gap-4 text-xs text-[var(--muted)]">
                    <span className="flex items-center gap-1">
                      <Star size={12} className="text-amber-400 fill-amber-400" />
                      4.9
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock3 size={12} />
                      {c.duration}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-24">
        <motion.div
          variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
          className="relative overflow-hidden rounded-3xl bg-primary p-12 md:p-20 text-center text-white"
        >
          {/* Background shapes */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-burgundy-700/40 rounded-full translate-y-1/2 -translate-x-1/4" />

          <div className="relative z-10">
            <p className="text-xs font-bold uppercase tracking-widest text-white/60 mb-4">Начните сегодня</p>
            <h2 className="font-display font-bold text-4xl md:text-5xl mb-6 text-white">
              Готовы изменить карьеру?
            </h2>
            <p className="text-white/80 text-lg mb-10 max-w-xl mx-auto">
              Зарегистрируйтесь бесплатно и начните первый урок прямо сейчас
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/register"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white text-primary font-semibold rounded-xl hover:bg-primary-50 transition-colors shadow-lg">
                Зарегистрироваться
                <ArrowRight size={18} />
              </Link>
              <Link to="/login"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 border border-white/20 transition-colors">
                У меня уже есть аккаунт
              </Link>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-[var(--border)] bg-[var(--surface)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <BrandLogo
            showText
            text="Gradus"
            iconClassName="h-7 w-7"
            textClassName="text-lg font-bold font-display text-[var(--text)]"
          />
          <p className="text-sm text-[var(--muted)]">© 2025 Gradus. Платформа для обучения IT-профессиям.</p>
          <div className="flex items-center gap-4 text-sm text-[var(--muted)]">
            <a href="#" className="hover:text-[var(--text)] transition-colors">Политика</a>
            <a href="#" className="hover:text-[var(--text)] transition-colors">Условия</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
