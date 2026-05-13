import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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
  Sparkles,
  Send,
  Flame,
} from "lucide-react";
import { api } from "../lib/api";
import BrandLogo from "../components/BrandLogo";
import BinaryGlobe from "../components/BinaryGlobe";
import ParticleNetwork from "../components/ParticleNetwork";
import { useTheme } from "../context/theme";
import { useAppStore } from "../store/AppStore";

export default function Landing() {
  const { theme, toggleTheme } = useTheme();
  const { user, loadingUser } = useAppStore();

  // Stable references per theme so re-renders (e.g. from the live
  // achievements ticker) don't tear down the BinaryGlobe animation loop.
  const globePalette = useMemo<string[]>(
    () =>
      theme === "dark"
        ? ["#FF6B6B", "#F83B3B", "#DC2626", "#7C1D1D", "#FFA3A3"]
        : ["#DC2626", "#B91C1C", "#7C1D1D", "#9A1B1B", "#F87171"],
    [theme]
  );
  const globePulseColor = theme === "dark" ? "#FFCECE" : "#F83B3B";

  const tracks = [
    { name: "Программирование", icon: <Terminal size={20} /> },
    { name: "Веб-разработка", icon: <Globe size={20} /> },
    { name: "Аналитика данных", icon: <Cpu size={20} /> },
    { name: "UI/UX Дизайн", icon: <Layers size={20} /> },
    { name: "Тестирование", icon: <Code size={20} /> },
    { name: "DevOps", icon: <Zap size={20} /> },
  ];

  const features = [
    { icon: <Code size={22} />, title: "Практика на платформе", desc: "Выполняйте задания прямо на платформе без лишних настроек и установок" },
    { icon: <Brain size={22} />, title: "AI-наставник", desc: "Получайте мгновенную обратную связь и подсказки от искусственного интеллекта" },
    { icon: <Shield size={22} />, title: "Авто-проверка заданий", desc: "Каждое задание проходит автоматическую проверку — результат сразу" },
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

  // ── Live activity feed (mock, decoupled from DB) ──
  type ActivityItem = {
    id: number;
    name: string;
    action: string;
    detail: string | null;
    icon: React.ReactNode;
    accentBg: string;
    accentText: string;
    createdAt: number;
  };
  const [feed, setFeed] = useState<ActivityItem[]>([]);
  const [, setFeedTick] = useState(0);

  useEffect(() => {
    const FEMALE = ["Анна","Мария","Ольга","София","Полина","Елена","Юлия","Алина","Виктория","Дарья","Ксения","Екатерина"];
    const MALE   = ["Дмитрий","Артём","Никита","Иван","Кирилл","Андрей","Денис","Максим","Тимур","Егор","Алексей","Павел"];
    const COURSE_NAMES = ["Основы Python","Веб-дизайн","Аналитика данных","Тестирование ПО","Управление проектами","UI/UX","DevOps","Machine Learning","SQL","Кибербезопасность","Веб-разработка","Soft Skills"];
    const XP_AMOUNTS = [50, 100, 150, 200, 250, 300, 500];
    const SCORES = ["95/100","98/100","100/100","92/100","100/100","100/100"];
    const LEVELS = ["до уровня Базовый","до уровня Средний","до уровня Продвинутый","до уровня Эксперт","до топ-10% платформы"];
    const LANGS = ["Python","SQL","Figma","Linux","TypeScript","Power BI"];
    const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

    type Variant = {
      action: (isF: boolean) => string;
      detail: () => string | null;
      icon: React.ReactNode;
      accentBg: string;
      accentText: string;
    };
    const VARIANTS: Variant[] = [
      { action: f => f ? "прошла курс" : "прошёл курс",                detail: () => pick(COURSE_NAMES),     icon: <Trophy size={18} />,        accentBg: "bg-amber-500/10",   accentText: "text-amber-600 dark:text-amber-400" },
      { action: f => f ? "получила" : "получил",                       detail: () => `+${pick(XP_AMOUNTS)} XP`, icon: <Zap size={18} />,        accentBg: "bg-primary/10",     accentText: "text-primary" },
      { action: f => f ? "решила задачу" : "решил задачу",             detail: () => null,                   icon: <CheckCircle2 size={18} />,  accentBg: "bg-emerald-500/10", accentText: "text-emerald-600 dark:text-emerald-400" },
      { action: f => f ? "выполнила задание" : "выполнил задание",     detail: () => null,                   icon: <CheckCircle2 size={18} />,  accentBg: "bg-emerald-500/10", accentText: "text-emerald-600 dark:text-emerald-400" },
      { action: f => f ? "сдала тест на" : "сдал тест на",             detail: () => pick(SCORES),           icon: <Star size={18} />,          accentBg: "bg-amber-500/10",   accentText: "text-amber-600 dark:text-amber-400" },
      { action: f => f ? "получила сертификат" : "получил сертификат", detail: () => null,                   icon: <Trophy size={18} />,        accentBg: "bg-amber-500/10",   accentText: "text-amber-600 dark:text-amber-400" },
      { action: f => f ? "поднялась" : "поднялся",                     detail: () => pick(LEVELS),           icon: <Sparkles size={18} />,      accentBg: "bg-burgundy/10",    accentText: "text-burgundy-600 dark:text-burgundy-400" },
      { action: f => f ? "присоединилась к сообществу" : "присоединился к сообществу", detail: () => null,   icon: <Users size={18} />,         accentBg: "bg-primary/10",     accentText: "text-primary" },
      { action: f => f ? "поработала с" : "поработал с",               detail: () => pick(LANGS),            icon: <Code size={18} />,          accentBg: "bg-sky-500/10",     accentText: "text-sky-600 dark:text-sky-400" },
      { action: f => f ? "вошла в" : "вошёл в",                        detail: () => `топ-${pick(["3","5","10","20","50"])} лидерборда`, icon: <Star size={18} />,        accentBg: "bg-amber-500/10",   accentText: "text-amber-600 dark:text-amber-400" },
    ];

    let counter = 0;
    let lastVariant = -1;
    const makeItem = (ageSec = 0): ActivityItem => {
      const isF = Math.random() > 0.5;
      const name = pick(isF ? FEMALE : MALE);
      let vi = Math.floor(Math.random() * VARIANTS.length);
      if (VARIANTS.length > 1 && vi === lastVariant) vi = (vi + 1) % VARIANTS.length;
      lastVariant = vi;
      const v = VARIANTS[vi];
      counter += 1;
      return {
        id: Date.now() + counter,
        name,
        action: v.action(isF),
        detail: v.detail(),
        icon: v.icon,
        accentBg: v.accentBg,
        accentText: v.accentText,
        createdAt: Date.now() - ageSec * 1000,
      };
    };

    setFeed([makeItem(3), makeItem(38), makeItem(120), makeItem(310)]);

    const addId = window.setInterval(() => {
      setFeed(prev => [makeItem(0), ...prev].slice(0, 4));
    }, 3600);

    const tickId = window.setInterval(() => setFeedTick(t => t + 1), 10000);

    return () => {
      window.clearInterval(addId);
      window.clearInterval(tickId);
    };
  }, []);

  const feedTimeLabel = (createdAt: number) => {
    const sec = Math.max(0, Math.floor((Date.now() - createdAt) / 1000));
    if (sec < 5) return "только что";
    if (sec < 60) return `${sec} с назад`;
    const min = Math.floor(sec / 60);
    return `${min} мин назад`;
  };


  const stats = [
    { label: "Курсов на платформе", value: landingStats.coursesTotal || "6+", sub: "и постоянно растёт", icon: <Layers size={20} /> },
    { label: "Студентов обучается", value: fmt(landingStats.studentsTotal) || "—", sub: "со всей страны", icon: <Users size={20} /> },
    { label: "Средний рейтинг", value: avgRating, sub: "по отзывам студентов", icon: <Star size={20} /> },
    { label: "Участников сообщества", value: fmt(landingStats.communityMembers) || "—", sub: "в нашем чате", icon: <Globe size={20} /> },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] overflow-x-hidden">

      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50 bg-[var(--bg)]/90 backdrop-blur-md border-b border-[var(--border)]">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <BrandLogo
            showText
            text="Gradus"
            iconClassName="h-8 w-8"
            textClassName="text-xl font-bold font-display text-[var(--text)]"
          />

          {/* Truly centered nav links — absolute so logo/buttons widths don't shift them */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-[var(--muted)] absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <a href="#features" className="hover:text-[var(--text)] transition-colors">Возможности</a>
            <a href="#tracks" className="hover:text-[var(--text)] transition-colors">Треки</a>
            <a href="#community" className="hover:text-[var(--text)] transition-colors">Сообщество</a>
            <a href="#courses" className="hover:text-[var(--text)] transition-colors">Каталог</a>
            <a href="#developers" className="hover:text-[var(--text)] transition-colors">Команда</a>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface)] border border-[var(--border)] transition-colors"
              aria-label="Сменить тему"
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            {!loadingUser && user ? (
              <Link to="/dashboard"
                className="btn-primary px-4 py-2 text-sm">
                Войти в кабинет
              </Link>
            ) : (
              <>
                <Link to="/login"
                  className="btn-ghost px-4 py-2 text-sm hidden sm:inline-flex">
                  Войти
                </Link>
                <Link to="/register"
                  className="btn-primary px-4 py-2 text-sm">
                  Начать бесплатно
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── HERO + MARQUEE wrapper ── */}
      <div className="flex flex-col min-h-[calc(100vh-64px)]">

      {/* ── HERO ── */}
      <section className="relative w-full flex-1 px-4 sm:px-6 lg:px-10 xl:px-16 flex flex-col items-center justify-center text-center py-20">
        {/* Background blob + interactive particle network */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/5 rounded-full blur-[120px]" />
          <ParticleNetwork
            color={theme === "dark" ? "#FF6B6B" : "#DC2626"}
            particleCount={95}
            maxLinkDistance={140}
            cursorRadius={170}
            intensity={theme === "dark" ? 1 : 0.85}
            className="[mask-image:radial-gradient(ellipse_at_center,black_55%,transparent_100%)] [-webkit-mask-image:radial-gradient(ellipse_at_center,black_55%,transparent_100%)]"
          />
        </div>


        <h1
          className="font-display font-bold text-3xl sm:text-5xl md:text-7xl lg:text-8xl tracking-tight mb-6 max-w-4xl"
        >
          Учись новому{" "}
          <span className="text-gradient-red">в своём темпе</span>
        </h1>

        <p
          className="text-lg md:text-xl text-[var(--muted)] max-w-2xl mb-10 leading-relaxed"
        >
          Интерактивные курсы, мгновенная AI-проверка заданий и сильное сообщество.
          Развивайте навыки и достигайте новых высот в выбранном направлении.
        </p>

        <div
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
        </div>

        {/* Floating cards — chaotically scattered around the hero */}
        {[
          { icon: <Flame size={20} />,        title: "Стрик 14 дней!",  desc: "Не сдавайся!",     iconBg: "bg-primary/10",     iconColor: "text-primary",                              pos: "top-[4%] left-[3%]",                       rotateDeg: -8, delay: 0.50 },
          { icon: <Trophy size={20} />,       title: "Сертификат",      desc: "Лучший студент",   iconBg: "bg-amber-500/10",   iconColor: "text-amber-600 dark:text-amber-400",        pos: "top-[14%] right-[7%]",                     rotateDeg:  5, delay: 0.55 },
          { icon: <CheckCircle2 size={20} />, title: "Тест пройден!",   desc: "100/100 баллов",   iconBg: "bg-primary/10",     iconColor: "text-primary",                              pos: "top-[44%] left-[9%]",                      rotateDeg: -4, delay: 0.60 },
          { icon: <Brain size={20} />,        title: "AI-ревью готово", desc: "+3 предложения",   iconBg: "bg-burgundy/10",    iconColor: "text-burgundy-600 dark:text-burgundy-400",  pos: "top-[30%] right-[1%]",                     rotateDeg:  7, delay: 0.65 },
          { icon: <Zap size={20} />,          title: "+250 XP",         desc: "Задача решена",    iconBg: "bg-primary/10",     iconColor: "text-primary",                              pos: "top-[74%] left-[2%]",                      rotateDeg:  6, delay: 0.70 },
          { icon: <Sparkles size={20} />,     title: "Уровень повышен", desc: "Эксперт курса",   iconBg: "bg-burgundy/10",    iconColor: "text-burgundy-600 dark:text-burgundy-400",  pos: "top-[60%] right-[9%]",                     rotateDeg: -6, delay: 0.75 },
          { icon: <CheckCircle2 size={20} />, title: "Курс завершён",   desc: "Аналитика данных", iconBg: "bg-emerald-500/10", iconColor: "text-emerald-600 dark:text-emerald-400",    pos: "bottom-[3%] left-[46%] -translate-x-1/2",  rotateDeg:  3, delay: 0.80 },
        ].map((card, i) => (
          <div
            key={i}
            className={`absolute ${card.pos} hidden xl:block pointer-events-none`}
            style={{ transform: `rotate(${card.rotateDeg}deg)` }}
          >
            <div className="card p-4 shadow-card-md flex items-center gap-3 whitespace-nowrap">
              <div className={`w-10 h-10 rounded-xl ${card.iconBg} flex items-center justify-center ${card.iconColor} shrink-0`}>
                {card.icon}
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold">{card.title}</p>
                <p className="text-xs text-[var(--muted)]">{card.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* ── STATS MARQUEE ── */}
      <section className="border-t border-[var(--border)] bg-[var(--surface)] overflow-hidden py-5 select-none">
        <div className="flex w-max animate-marquee gap-0">
          {[...stats, ...stats, ...stats].map((s, i) => (
            <div key={i} className="flex items-center gap-3 px-8 border-r border-[var(--border)] whitespace-nowrap">
              <div className="w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center text-primary shrink-0">
                {s.icon}
              </div>
              <span className="font-display font-bold text-2xl text-gradient-red">{s.value}</span>
              <span className="text-sm font-medium text-[var(--muted)]">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      </div>{/* конец hero+marquee wrapper */}

      {/* ── LIVE COMMUNITY GLOBE ── */}
      <section id="community" className="relative overflow-hidden border-b border-[var(--border)]">
        {/* matrix-grid background */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.04] dark:opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--text) 1px, transparent 1px), linear-gradient(to bottom, var(--text) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            maskImage: "radial-gradient(ellipse at center, black 50%, transparent 90%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 50%, transparent 90%)",
          }}
        />
        {/* red glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-primary/8 rounded-full blur-[160px]" />
        </div>

        <div className="relative w-full px-4 sm:px-6 lg:px-10 xl:px-16 py-24">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <h2 className="font-display font-bold text-2xl sm:text-4xl md:text-6xl tracking-tight mb-5">
              Сообщество в режиме{" "}
              <span className="text-gradient-red">реального времени</span>
            </h2>
            <p className="text-[var(--muted)] text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
              Прямо сейчас тысячи студентов решают задачи, проходят курсы и развиваются — со всех уголков мира
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] gap-12 items-center">
            {/* Globe */}
            <motion.div
              className="relative flex justify-center"
              initial={{ opacity: 0, x: -60 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="relative">
                <BinaryGlobe
                  size={520}
                  pointCount={1200}
                  palette={globePalette}
                  pulseColor={globePulseColor}
                  className="max-w-full h-auto"
                />
              </div>
            </motion.div>

            {/* Последние достижения — live feed */}
            <motion.div
              className="card p-6 md:p-7 backdrop-blur-sm bg-[var(--bg)]/80"
              initial={{ opacity: 0, x: 60 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex items-center justify-between mb-5 pb-4 border-b border-[var(--border)]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center text-primary">
                    <Trophy size={18} />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-0.5">Платформа</p>
                    <h3 className="font-display font-semibold text-base leading-none">Последние достижения</h3>
                  </div>
                </div>
                <span className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--muted)]">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inset-0 rounded-full bg-emerald-500 opacity-75 animate-ping" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  LIVE
                </span>
              </div>

              <div className="space-y-3 relative min-h-[19rem]">
                <AnimatePresence initial={false} mode="popLayout">
                  {feed.map((item) => (
                    <motion.div
                      key={item.id}
                      layout="position"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                      className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-soft)]"
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${item.accentBg} ${item.accentText}`}>
                        {item.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-snug truncate">
                          <span className="font-semibold text-[var(--text)]">{item.name}</span>
                          <span className="text-[var(--muted)]"> {item.action}</span>
                          {item.detail && (
                            <span className="font-semibold text-[var(--text)]"> {item.detail}</span>
                          )}
                        </p>
                        <p className="text-[11px] font-mono text-[var(--muted)] mt-0.5">{feedTimeLabel(item.createdAt)}</p>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>

        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="w-full px-4 sm:px-6 lg:px-10 xl:px-16 py-24">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Возможности платформы</p>
          <h2 className="font-display font-bold text-2xl sm:text-4xl md:text-5xl mb-4">Всё для вашего роста</h2>
          <p className="text-[var(--muted)] text-lg max-w-xl mx-auto">
            Инструменты, которые превращают обучение в удовольствие
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((f, i) => (
            <motion.div
              key={i}
              className="card p-6 hover:shadow-card-md transition-shadow group"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
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
        <div className="w-full px-4 sm:px-6 lg:px-10 xl:px-16">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Как это работает</p>
            <h2 className="font-display font-bold text-2xl sm:text-4xl md:text-5xl">Три шага до результата</h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "01", title: "Запишитесь на курс", desc: "Выберите подходящий трек и запишитесь на курс. Всё обучение проходит онлайн, в удобном темпе." },
              { step: "02", title: "Решайте задачи", desc: "Практикуйтесь в браузере с мгновенной проверкой. AI-наставник поможет разобраться со сложными моментами." },
              { step: "03", title: "Получите сертификат", desc: "Завершите все шаги курса и получите сертификат, подтверждающий ваши навыки." },
            ].map((item, i) => (
              <motion.div
                key={i}
                className="relative"
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.15, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="text-6xl font-display font-bold text-primary mb-4">{item.step}</div>
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
      <section id="tracks" className="w-full px-4 sm:px-6 lg:px-10 xl:px-16 py-24">
        <motion.div
          className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12"
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Направления</p>
            <h2 className="font-display font-bold text-2xl sm:text-4xl md:text-5xl">Выберите свой трек</h2>
          </div>
          <Link to="/register" className="btn-secondary px-5 py-2.5 text-sm w-fit gap-1.5">
            Все треки <ArrowRight size={15} />
          </Link>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {tracks.map((track, i) => (
            <motion.div
              key={i}
              className="card p-5 flex items-center gap-4 hover:shadow-card-md hover:border-primary/20 transition-all group cursor-pointer"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
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
        <div className="w-full px-4 sm:px-6 lg:px-10 xl:px-16">
          <motion.div
            className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12"
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Каталог</p>
              <h2 className="font-display font-bold text-2xl sm:text-4xl md:text-5xl">Популярные курсы</h2>
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
              {courses.map((course, _i) => (
                <motion.div
                  key={course.id}
                  className="card p-6 flex flex-col hover:shadow-card-md hover:border-primary/20 transition-all"
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.5, delay: _i * 0.1, ease: [0.22, 1, 0.36, 1] }}
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
            <div className="text-center py-12 text-[var(--muted)]">
              <p className="text-lg">Курсы пока не добавлены</p>
              <p className="text-sm mt-2">Скоро здесь появятся курсы — следите за обновлениями</p>
            </div>
          )}
        </div>
      </section>

      {/* ── DEVELOPERS ── */}
      <section id="developers" className="relative bg-[var(--surface)] border-t border-[var(--border)] py-28 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] bg-primary/5 rounded-full blur-[140px]" />
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-burgundy-500/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-primary/10 blur-3xl" />
        </div>

        <div className="relative w-full px-4 sm:px-6 lg:px-10 xl:px-16">
          <div className="text-center mb-20">
            <h2 className="font-display font-bold text-3xl sm:text-5xl md:text-6xl lg:text-7xl tracking-tight mb-6">
              Наша <span className="text-gradient-red">команда</span>
            </h2>
            <p className="text-[var(--muted)] text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
              Платформу создают увлечённые своим делом разработчики, которые верят в силу качественного образования
            </p>
          </div>

          {(() => {
            const members = [
              { name: "Радкевич Роман",    role: "Разработчик", photo: "/developers/radkevich-roman.jpg",      link: "https://t.me/liiiiiliiiiiliiiiiliiiiiliiiiil", objectPosition: "center 22%", scale: 1.18 },
              { name: "Виктория Кужелева", role: "Разработчик", photo: "",                                      link: "https://t.me/viktoriakuzheleva",                objectPosition: "center 50%", scale: 1.00 },
              { name: "Поляков Ярослав",   role: "Разработчик", photo: "/developers/polyakov-yaroslav.jpg",    link: "https://t.me/scencort",                        objectPosition: "center 22%", scale: 1.18 },
              { name: "Вероника Кужелева", role: "Разработчик", photo: "",                                      link: "https://t.me/veronika_vladislavovnaa",          objectPosition: "center 50%", scale: 1.00 },
              { name: "Чеха Иван",         role: "Разработчик", photo: "/developers/chekha-ivan.jpg",          link: "https://t.me/aaaaaqiwi",                       objectPosition: "center 5%",  scale: 1.00 },
              { name: "Вартанян Вячеслав", role: "Разработчик", photo: "/developers/vartanyan-vyacheslav.jpg", link: "https://t.me/A597MP97",                        objectPosition: "center 5%",  scale: 1.00 },
            ];

            const colStarts = ["lg:col-start-1","lg:col-start-3","lg:col-start-5","lg:col-start-2","lg:col-start-4","lg:col-start-6"];

            const cardJsx = (dev: typeof members[0], i: number, extraClass = "") => {
              const [firstName, ...rest] = dev.name.split(" ");
              const lastName = rest.join(" ");
              return (
                <motion.a
                  key={dev.name}
                  href={dev.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Telegram ${dev.name}`}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                  whileHover={{ y: -6 }}
                  className={`group relative card p-8 overflow-hidden flex flex-col items-center text-center transition-all duration-300 hover:shadow-card-lg hover:border-primary/30 cursor-pointer no-underline h-full ${extraClass}`}
                >
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-burgundy-500 to-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative mb-6">
                    <div className="absolute -inset-1.5 rounded-full bg-gradient-to-tr from-primary via-burgundy-500 to-primary-300 opacity-60 blur-md group-hover:opacity-90 group-hover:blur-lg transition-all" />
                    <div className="absolute -inset-0.5 rounded-full bg-gradient-to-tr from-primary to-burgundy-500" />
                    <div className="relative w-44 h-44 md:w-52 md:h-52 rounded-full overflow-hidden ring-4 ring-[var(--card)] bg-[var(--surface)]">
                      {dev.photo ? (
                        <div className="w-full h-full transition-transform duration-500 group-hover:scale-[1.08]">
                          <img
                            src={dev.photo}
                            alt={dev.name}
                            className="w-full h-full object-cover"
                            style={{ objectPosition: dev.objectPosition, transform: `scale(${dev.scale})`, transformOrigin: "center center" }}
                            loading="lazy"
                          />
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/30 dark:to-primary-900/10">
                          <svg viewBox="0 0 80 80" className="w-20 h-20 text-primary/25" fill="currentColor">
                            <circle cx="40" cy="28" r="16" />
                            <ellipse cx="40" cy="72" rx="26" ry="18" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                  <h3 className="font-display font-bold text-2xl md:text-3xl tracking-tight mb-2 text-[var(--text)] leading-tight min-h-[4.5rem] md:min-h-[5.25rem] flex flex-col justify-start">
                    <span>{firstName}</span>
                    {lastName && <span>{lastName}</span>}
                  </h3>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-50 dark:bg-primary-900/20 text-primary text-xs font-semibold uppercase tracking-wider mb-3">
                    <Code size={12} /> {dev.role}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--muted)] group-hover:text-primary transition-colors">
                    <Send size={14} /> Telegram
                  </span>
                </motion.a>
              );
            };

            return (
              <div className="max-w-5xl mx-auto">
                {/* Мобилка: 2 колонки */}
                <div className="grid grid-cols-2 gap-5 lg:hidden">
                  {members.map((dev, i) => cardJsx(dev, i))}
                </div>

                {/* Десктоп: шахматка — ряд 1 col 1,3,5 / ряд 2 col 2,4,6 */}
                <div className="hidden lg:grid lg:grid-cols-7 gap-y-5">
                  {members.map((dev, i) => (
                    <div key={dev.name} className={`col-span-2 ${colStarts[i]} px-2.5`}>
                      {cardJsx(dev, i)}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="w-full px-4 sm:px-6 lg:px-10 xl:px-16 py-24">
        <motion.div
          className="relative overflow-hidden rounded-3xl bg-primary p-12 md:p-20 text-center text-white"
          initial={{ opacity: 0, y: 40, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Background shapes */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-burgundy-700/40 rounded-full translate-y-1/2 -translate-x-1/4" />

          <div className="relative z-10">
            <p className="text-xs font-bold uppercase tracking-widest text-white/60 mb-4">Начните сегодня</p>
            <h2 className="font-display font-bold text-2xl sm:text-4xl md:text-5xl mb-6 text-white">
              Готовы начать обучение?
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
        <div className="w-full px-4 sm:px-6 lg:px-10 xl:px-16 py-10 flex flex-col items-center gap-4 text-center">
          <BrandLogo
            showText
            text="Gradus"
            iconClassName="h-7 w-7"
            textClassName="text-lg font-bold font-display text-[var(--text)]"
          />
          <p className="text-sm text-[var(--muted)]">© {new Date().getFullYear()} Gradus. Платформа для онлайн-обучения.</p>
          <div className="flex items-center gap-4 text-sm text-[var(--muted)]">
            <Link to="/privacy" className="hover:text-[var(--text)] transition-colors">Политика конфиденциальности</Link>
            <Link to="/terms" className="hover:text-[var(--text)] transition-colors">Условия использования</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
