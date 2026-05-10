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
  Sparkles,
  Send,
  MapPin,
  Wifi,
  Activity,
  Flame,
} from "lucide-react";
import { api } from "../lib/api";
import BrandLogo from "../components/BrandLogo";
import BinaryGlobe from "../components/BinaryGlobe";
import ParticleNetwork from "../components/ParticleNetwork";
import { useTheme } from "../context/theme";
import { useAppStore } from "../store/AppStore";

// ── Live community feed data ──
const FEED_NAMES = [
  "Аня", "Иван", "Мария", "Дмитрий", "Никита", "Софья", "Артём", "Полина",
  "Антон", "Вера", "Тимур", "Камилла", "Олег", "Лиза", "Гриша", "Регина",
  "Денис", "Алина", "Сергей", "Юля", "Богдан", "Лера", "Максим", "Кира",
];
const FEED_CITIES = [
  "Минск", "Москва", "СПб", "Алматы", "Астана", "Киев", "Ташкент", "Бишкек",
  "Тбилиси", "Ереван", "Душанбе", "Баку", "Кишинёв", "Рига", "Вильнюс",
  "Варшава", "Прага", "Берлин", "Львов", "Гомель",
];
type FeedTemplate = { kind: "task" | "course" | "cert" | "ai" | "rating"; subjects: string[] };
const FEED_TEMPLATES: FeedTemplate[] = [
  { kind: "task",   subjects: ["Python · for", "JavaScript · async", "TypeScript · generics", "Алгоритмы · DFS", "React · hooks", "SQL · JOIN"] },
  { kind: "course", subjects: ["Python Backend", "React + TS", "DevOps основы", "Data Science", "UI/UX Design"] },
  { kind: "cert",   subjects: ["Junior Developer", "Mid-level", "Frontend Pro", "Algorithms"] },
  { kind: "ai",     subjects: ["+12 советов", "+5 правок", "оптимизация", "рефактор-подсказки"] },
  { kind: "rating", subjects: ["★★★★★", "★★★★★ • «Огонь!»", "★★★★★ • «Лучший курс»"] },
];
const FEED_VERBS: Record<FeedTemplate["kind"], string> = {
  task:   "решил задачу",
  course: "завершил курс",
  cert:   "получил сертификат",
  ai:     "получил AI-ревью",
  rating: "оценил курс",
};

type FeedItem = {
  id: number;
  name: string;
  city: string;
  kind: FeedTemplate["kind"];
  subject: string;
};

const pickRandom = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

const makeFeedItem = (id: number): FeedItem => {
  const tpl = pickRandom(FEED_TEMPLATES);
  return {
    id,
    name: pickRandom(FEED_NAMES),
    city: pickRandom(FEED_CITIES),
    kind: tpl.kind,
    subject: pickRandom(tpl.subjects),
  };
};

export default function Landing() {
  const { theme, toggleTheme } = useTheme();
  const { user, loadingUser } = useAppStore();


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

  // ── Live community feed (фейковый, чисто визуальный) ──
  const [feed, setFeed] = useState<FeedItem[]>(() => {
    const seed: FeedItem[] = [];
    for (let i = 0; i < 5; i++) seed.push(makeFeedItem(i));
    return seed;
  });
  const [onlineCount, setOnlineCount] = useState(12480);

  useEffect(() => {
    let nextId = 1000;
    const tick = setInterval(() => {
      setFeed(prev => [makeFeedItem(nextId++), ...prev].slice(0, 5));
      setOnlineCount(c => c + Math.floor(Math.random() * 7) - 2);
    }, 2400);
    return () => clearInterval(tick);
  }, []);

  const feedIcon = (kind: FeedTemplate["kind"]) => {
    switch (kind) {
      case "task":   return <Code size={14} />;
      case "course": return <CheckCircle2 size={14} />;
      case "cert":   return <Trophy size={14} />;
      case "ai":     return <Brain size={14} />;
      case "rating": return <Star size={14} />;
    }
  };

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

      {/* ── HERO ── */}
      <section className="relative w-full px-4 sm:px-6 lg:px-10 xl:px-16 pt-20 pb-24 md:pt-28 md:pb-32 flex flex-col items-center text-center">
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

        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary-50 dark:bg-primary-900/20 text-primary text-xs font-semibold mb-6"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Образование нового уровня
        </div>

        <h1
          className="font-display font-bold text-5xl md:text-7xl lg:text-8xl tracking-tight mb-6 max-w-4xl"
        >
          Стань разработчиком{" "}
          <span className="text-gradient-red">через практику</span>
        </h1>

        <p
          className="text-lg md:text-xl text-[var(--muted)] max-w-2xl mb-10 leading-relaxed"
        >
          Интерактивные курсы, мгновенная AI-проверка кода и сильное сообщество.
          Постройте карьеру в IT от нуля до первого оффера.
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

        {/* Floating cards — 7 around the hero */}
        {[
          { icon: <Flame size={20} />,        title: "Стрик 14 дней!",  desc: "Не сдавайся!",     iconBg: "bg-primary/10",     iconColor: "text-primary",                              pos: "top-12 left-4",                       rotateDeg: -6, fromX: -40, delay: 0.50 },
          { icon: <Trophy size={20} />,       title: "Сертификат",      desc: "Junior Developer", iconBg: "bg-amber-500/10",   iconColor: "text-amber-600 dark:text-amber-400",        pos: "top-12 right-4",                      rotateDeg:  6, fromX:  40, delay: 0.55 },
          { icon: <CheckCircle2 size={20} />, title: "Тест пройден!",   desc: "100/100 баллов",   iconBg: "bg-primary/10",     iconColor: "text-primary",                              pos: "top-1/3 left-2",                      rotateDeg: -3, fromX: -40, delay: 0.60 },
          { icon: <Brain size={20} />,        title: "AI-ревью готово", desc: "+3 предложения",   iconBg: "bg-burgundy/10",    iconColor: "text-burgundy-600 dark:text-burgundy-400",  pos: "top-1/3 right-2",                     rotateDeg:  3, fromX:  40, delay: 0.65 },
          { icon: <Zap size={20} />,          title: "+250 XP",         desc: "Задача решена",    iconBg: "bg-primary/10",     iconColor: "text-primary",                              pos: "bottom-12 left-4",                    rotateDeg:  3, fromX: -40, delay: 0.70 },
          { icon: <Sparkles size={20} />,     title: "Уровень повышен", desc: "Mid-level Dev",    iconBg: "bg-burgundy/10",    iconColor: "text-burgundy-600 dark:text-burgundy-400",  pos: "bottom-12 right-4",                   rotateDeg: -3, fromX:  40, delay: 0.75 },
          { icon: <CheckCircle2 size={20} />, title: "Курс завершён",   desc: "React + TS",       iconBg: "bg-emerald-500/10", iconColor: "text-emerald-600 dark:text-emerald-400",    pos: "bottom-2 left-1/2 -translate-x-1/2", rotateDeg:  1, fromX:   0, delay: 0.80 },
        ].map((card, i) => (
          <div key={i} className={`absolute ${card.pos} hidden xl:block pointer-events-none`}>
            <div
              className="card p-4 shadow-card-md flex items-center gap-3 whitespace-nowrap"
            >
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

      {/* ── STATS ── */}
      <section className="border-y border-[var(--border)] bg-[var(--surface)]">
        <div className="w-full px-4 sm:px-6 lg:px-10 xl:px-16 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <div
              key={i}
              className="text-center"
            >
              <p className="font-display font-bold text-4xl md:text-5xl text-gradient-red mb-1">{s.value}</p>
              <p className="text-sm font-medium text-[var(--muted)]">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

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
          <div
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-primary/30 bg-primary-50 dark:bg-primary-900/20 text-primary text-xs font-bold uppercase tracking-widest mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              LIVE · сообщество онлайн
            </div>
            <h2 className="font-display font-bold text-4xl md:text-6xl tracking-tight mb-5">
              Сообщество в режиме{" "}
              <span className="text-gradient-red">реального времени</span>
            </h2>
            <p className="text-[var(--muted)] text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
              Прямо сейчас тысячи студентов решают задачи, проходят курсы и пишут код — со всех уголков мира
            </p>
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] gap-12 items-center">
            {/* Globe */}
            <div
              className="relative flex justify-center"
            >
              <div className="relative">
                <BinaryGlobe
                  size={520}
                  pointCount={1200}
                  palette={
                    theme === "dark"
                      ? ["#FF6B6B", "#F83B3B", "#DC2626", "#7C1D1D", "#FFA3A3"]
                      : ["#DC2626", "#B91C1C", "#7C1D1D", "#9A1B1B", "#F87171"]
                  }
                  pulseColor={theme === "dark" ? "#FFCECE" : "#F83B3B"}
                  className="max-w-full h-auto"
                />
                {/* Telemetry corner labels */}
                <div className="absolute top-2 left-2 hidden md:flex items-center gap-2 text-[11px] font-mono text-[var(--muted)] bg-[var(--bg)]/60 backdrop-blur-sm px-2 py-1 rounded">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  NODES: {fmt(onlineCount)}
                </div>
                <div className="absolute top-2 right-2 hidden md:flex items-center gap-2 text-[11px] font-mono text-[var(--muted)] bg-[var(--bg)]/60 backdrop-blur-sm px-2 py-1 rounded">
                  <Wifi size={11} /> 23ms
                </div>
                <div className="absolute bottom-2 left-2 hidden md:flex items-center gap-2 text-[11px] font-mono text-[var(--muted)] bg-[var(--bg)]/60 backdrop-blur-sm px-2 py-1 rounded">
                  <MapPin size={11} /> 47 COUNTRIES
                </div>
                <div className="absolute bottom-2 right-2 hidden md:flex items-center gap-2 text-[11px] font-mono text-[var(--muted)] bg-[var(--bg)]/60 backdrop-blur-sm px-2 py-1 rounded">
                  STREAM: 0x{(onlineCount % 0xffff).toString(16).toUpperCase().padStart(4, "0")}
                </div>
              </div>
            </div>

            {/* Live activity feed */}
            <div
              className="card p-6 md:p-7 backdrop-blur-sm bg-[var(--bg)]/80"
            >
              <div className="flex items-center justify-between mb-5 pb-4 border-b border-[var(--border)]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center text-primary">
                    <Activity size={18} />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-0.5">Активность</p>
                    <h3 className="font-display font-semibold text-base leading-none">Прямо сейчас</h3>
                  </div>
                </div>
                <span className="font-mono text-[11px] text-[var(--muted)] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  LIVE
                </span>
              </div>

              {/* Fixed-height container so adding/removing items never reflows the page */}
              <ul className="space-y-2.5 relative h-[376px] overflow-hidden">
                  {feed.map(item => (
                    <li
                      key={item.id}
                      className="flex items-start gap-3 p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-soft)] h-[68px]"
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                        {feedIcon(item.kind)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-snug">
                          <span className="font-semibold text-[var(--text)]">{item.name}</span>
                          <span className="text-[var(--muted)]"> из </span>
                          <span className="font-medium text-[var(--text-2)]">{item.city}</span>
                          <span className="text-[var(--muted)]"> · {FEED_VERBS[item.kind]}</span>
                        </p>
                        <p className="text-xs text-[var(--muted)] mt-0.5 truncate font-mono">{item.subject}</p>
                      </div>
                      <span className="text-[10px] font-mono text-[var(--muted)] uppercase shrink-0 mt-1">
                        сейчас
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          </div>

          {/* Bottom telemetry tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-14">
            {[
              { label: "Студентов онлайн", value: fmt(onlineCount), mono: false },
              { label: "Стран",            value: "47",             mono: true  },
              { label: "Часовых поясов",   value: "12",             mono: true  },
              { label: "Время отклика",    value: "23ms",           mono: true  },
            ].map((tile, i) => (
              <div
                key={i}
                className="card p-5 text-center bg-[var(--bg)]/80 backdrop-blur-sm"
              >
                <p className={`font-bold text-3xl md:text-4xl text-gradient-red mb-1 ${tile.mono ? "font-mono" : "font-display"}`}>
                  {tile.value}
                </p>
                <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">{tile.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="w-full px-4 sm:px-6 lg:px-10 xl:px-16 py-24">
        <div
          className="text-center mb-16"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Возможности платформы</p>
          <h2 className="font-display font-bold text-4xl md:text-5xl mb-4">Всё для вашего роста</h2>
          <p className="text-[var(--muted)] text-lg max-w-xl mx-auto">
            Инструменты, которые превращают обучение в удовольствие
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((f, i) => (
            <div
              key={i}
              className="card p-6 hover:shadow-card-md transition-shadow group"
            >
              <div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                {f.icon}
              </div>
              <h3 className="font-display font-semibold text-base mb-2">{f.title}</h3>
              <p className="text-sm text-[var(--muted)] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="bg-[var(--surface)] border-y border-[var(--border)] py-24">
        <div className="w-full px-4 sm:px-6 lg:px-10 xl:px-16">
          <div
            className="text-center mb-16"
          >
            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Как это работает</p>
            <h2 className="font-display font-bold text-4xl md:text-5xl">Три шага до результата</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "01", title: "Запишитесь на курс", desc: "Выберите подходящий трек и запишитесь на курс. Всё обучение проходит онлайн, в удобном темпе." },
              { step: "02", title: "Решайте задачи", desc: "Практикуйтесь в браузере с мгновенной проверкой. AI-наставник поможет разобраться со сложными моментами." },
              { step: "03", title: "Получите сертификат", desc: "Завершите все шаги курса и получите сертификат, подтверждающий ваши навыки." },
            ].map((item, i) => (
              <div
                key={i}
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
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRACKS ── */}
      <section id="tracks" className="w-full px-4 sm:px-6 lg:px-10 xl:px-16 py-24">
        <div
          className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Направления</p>
            <h2 className="font-display font-bold text-4xl md:text-5xl">Выберите свой трек</h2>
          </div>
          <Link to="/register" className="btn-secondary px-5 py-2.5 text-sm w-fit gap-1.5">
            Все треки <ArrowRight size={15} />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {tracks.map((track, i) => (
            <div
              key={i}
              className="card p-5 flex items-center gap-4 hover:shadow-card-md hover:border-primary/20 transition-all group cursor-pointer"
            >
              <div className="w-11 h-11 rounded-xl bg-[var(--surface)] flex items-center justify-center text-[var(--muted)] group-hover:bg-primary-50 group-hover:text-primary dark:group-hover:bg-primary-900/20 transition-colors shrink-0">
                {track.icon}
              </div>
              <span className="font-semibold text-sm">{track.name}</span>
              <ChevronRight size={16} className="ml-auto text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          ))}
        </div>
      </section>

      {/* ── COURSES ── */}
      <section id="courses" className="bg-[var(--surface)] border-t border-[var(--border)] py-24">
        <div className="w-full px-4 sm:px-6 lg:px-10 xl:px-16">
          <div
            className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Каталог</p>
              <h2 className="font-display font-bold text-4xl md:text-5xl">Популярные курсы</h2>
            </div>
            <Link to="/register" className="btn-primary px-5 py-2.5 text-sm w-fit gap-1.5">
              Все курсы <ArrowRight size={15} />
            </Link>
          </div>

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
                <div
                  key={course.id}
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
                </div>
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-5">
              {[
                { title: "Python Backend", author: "Сергей Ким", level: "Начальный", duration: "40 часов" },
                { title: "React + TypeScript", author: "Анна Соколова", level: "Средний", duration: "55 часов" },
                { title: "DevOps основы", author: "Алексей Морозов", level: "Продвинутый", duration: "65 часов" },
              ].map((c, i) => (
                <div
                  key={i}
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
                </div>
              ))}
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
          <div
            className="text-center mb-20"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary-50 dark:bg-primary-900/20 text-primary text-xs font-bold uppercase tracking-widest mb-6">
              <Sparkles size={14} /> Команда проекта
            </div>
            <h2 className="font-display font-bold text-5xl md:text-6xl lg:text-7xl tracking-tight mb-6">
              Наша <span className="text-gradient-red">команда</span>
            </h2>
            <p className="text-[var(--muted)] text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
              Платформу создают увлечённые своим делом разработчики, которые верят в силу качественного образования
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {[
              { name: "Радкевич Роман", role: "Разработчик", photo: "/developers/radkevich-roman.jpg", link: "https://t.me/liiiiiliiiiiliiiiiliiiiiliiiiil" },
              { name: "Поляков Ярослав", role: "Разработчик", photo: "/developers/polyakov-yaroslav.jpg", link: "https://t.me/scencort" },
            ].map((dev, _i) => (
              <motion.a
                key={dev.name}
                href={dev.link}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Telegram ${dev.name}`}
                whileHover={{ y: -6 }}
                className="group relative card p-8 flex flex-col items-center text-center transition-all duration-300 hover:shadow-card-lg hover:border-primary/30 cursor-pointer no-underline"
              >
                <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-primary via-burgundy-500 to-primary opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="relative mb-6">
                  <div className="absolute -inset-1.5 rounded-full bg-gradient-to-tr from-primary via-burgundy-500 to-primary-300 opacity-60 blur-md group-hover:opacity-90 group-hover:blur-lg transition-all" />
                  <div className="absolute -inset-0.5 rounded-full bg-gradient-to-tr from-primary to-burgundy-500" />
                  <div className="relative w-44 h-44 md:w-52 md:h-52 rounded-full overflow-hidden ring-4 ring-[var(--card)] bg-[var(--surface)]">
                    <img
                      src={dev.photo}
                      alt={dev.name}
                      className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  </div>
                </div>

                <h3 className="font-display font-bold text-2xl md:text-3xl tracking-tight mb-2 text-[var(--text)]">{dev.name}</h3>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-50 dark:bg-primary-900/20 text-primary text-xs font-semibold uppercase tracking-wider mb-3">
                  <Code size={12} /> {dev.role}
                </span>
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--muted)] group-hover:text-primary transition-colors">
                  <Send size={14} /> Telegram
                </span>
              </motion.a>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="w-full px-4 sm:px-6 lg:px-10 xl:px-16 py-24">
        <div
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
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-[var(--border)] bg-[var(--surface)]">
        <div className="w-full px-4 sm:px-6 lg:px-10 xl:px-16 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
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
