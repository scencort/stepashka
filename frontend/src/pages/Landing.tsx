import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import {
  Search,
  Star,
  Users,
  Clock3,
  ArrowRight,
  Sun,
  Moon,
  Sparkles,
  Terminal,
  Globe,
  Cpu,
  Layers,
  Code,
  Zap,
  CheckCircle2,
  Play,
} from "lucide-react";
import { api } from "../lib/api";
import BrandLogo from "../components/BrandLogo";
import { useTheme } from "../context/theme";

import { fadeInUp, staggerContainer } from "../lib/animations";

export default function Landing() {
  const { theme, toggleTheme } = useTheme();
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 1000], [0, 200]);
  const y2 = useTransform(scrollY, [0, 1000], [0, -200]);

  const tracks = [
    { name: "Python", icon: <Terminal size={18} /> },
    { name: "Web Development", icon: <Globe size={18} /> },
    { name: "Data Science", icon: <Cpu size={18} /> },
    { name: "UI/UX Design", icon: <Layers size={18} /> },
    { name: "Testing", icon: <Code size={18} /> },
    { name: "DevOps", icon: <Zap size={18} /> },
  ];

  const partners = ["Google", "IBM", "Microsoft", "Yandex", "VK", "MIPT"];

  const [courses, setCourses] = useState<
    Array<{
      id: number;
      title: string;
      author: string;
      level: string;
      rating: string;
      students: string;
      duration: string;
      price: string;
    }>
  >([]);

  const [landingStats, setLandingStats] = useState({
    coursesTotal: 0,
    studentsTotal: 0,
    averageRating: 0,
    communityMembers: 0,
  });

  const [coursesLoading, setCoursesLoading] = useState(true);

  const formatCompact = (value: number) =>
    new Intl.NumberFormat("ru-RU", {
      notation: "compact",
      compactDisplay: "short",
      maximumFractionDigits: 1,
    }).format(Math.max(0, Math.round(value)));

  useEffect(() => {
    const load = async () => {
      setCoursesLoading(true);
      try {
        const [coursesResult, statsResult] = await Promise.allSettled([
          api.get<
            Array<{
              id: number;
              title: string;
              author: string;
              level: string;
              rating: string;
              students: string;
              duration: string;
              price: string;
            }>
          >("/courses"),
          api.get<{
            coursesTotal: number;
            studentsTotal: number;
            averageRating: number;
            communityMembers: number;
          }>("/landing/stats"),
        ]);

        if (coursesResult.status === "fulfilled") {
          setCourses(coursesResult.value.slice(0, 3));
        }
        if (statsResult.status === "fulfilled") {
          const s = statsResult.value;
          setLandingStats({
            coursesTotal: Number(s.coursesTotal || 0),
            studentsTotal: Number(s.studentsTotal || 0),
            averageRating: Number(s.averageRating || 0),
            communityMembers: Number(s.communityMembers || 0),
          });
        }
      } finally {
        setCoursesLoading(false);
      }
    };

    load();
  }, []);

  const averageRating = useMemo(() => {
    if (landingStats.averageRating <= 0) {
      return "0.0";
    }
    return landingStats.averageRating.toFixed(1);
  }, [landingStats.averageRating]);

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="min-h-screen selection:bg-rose-500/30 font-sans overflow-hidden relative"
    >
      {/* Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none z-[-1]">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-rose-500/10 dark:bg-rose-600/10 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 dark:bg-blue-600/10 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-screen" />
        <div className="absolute inset-0 hero-grid opacity-40 dark:opacity-20" />
      </div>

      {/* Floating Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="sticky top-4 z-50 mx-4 md:mx-auto max-w-7xl px-6 py-4 rounded-3xl glass-panel flex flex-col md:flex-row justify-between items-center shadow-lg shadow-slate-200/20 dark:shadow-black/20 border border-white/40 dark:border-white/10 backdrop-blur-xl"
      >
        <BrandLogo
          text="Gradus"
          iconClassName="h-8 w-8 text-rose-600 dark:text-rose-500"
          textClassName="text-2xl font-extrabold bg-gradient-to-r from-rose-600 to-red-800 dark:from-rose-400 dark:to-red-600 bg-clip-text text-transparent"
        />

        <nav className="hidden md:flex items-center gap-8 font-medium text-sm text-slate-600 dark:text-slate-300">
          <a
            href="#catalog"
            className="hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
          >
            Каталог
          </a>
          <a
            href="#tracks"
            className="hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
          >
            Треки
          </a>
          <a
            href="#about"
            className="hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
          >
            О нас
          </a>
        </nav>

        <div className="flex gap-3 w-full md:w-auto items-center mt-4 md:mt-0">
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-all shadow-sm"
            aria-label="Переключить тему"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <Link to="/login" className="flex-1 md:flex-none">
            <Button variant="outline" className="w-full !rounded-full px-6">
              Войти
            </Button>
          </Link>

          <Link to="/register" className="flex-1 md:flex-none">
            <Button className="w-full !rounded-full px-6 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-rose-500/25">
              Начать
            </Button>
          </Link>
        </div>
      </motion.header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-16 md:pt-32 md:pb-24 px-4 flex flex-col items-center justify-center min-h-[85vh]">
        <motion.div
          style={{ y: y1 }}
          className="absolute left-[10%] top-[20%] hidden lg:block"
        >
          <Card className="p-4 !rounded-2xl bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border-white/50 dark:border-white/10 flex items-center gap-3 shadow-2xl shadow-rose-500/10 rotate-[-6deg]">
            <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center">
              <Code size={20} className="text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <p className="text-sm font-bold">Практика</p>
              <p className="text-xs text-slate-500">Пиши код сразу</p>
            </div>
          </Card>
        </motion.div>

        <motion.div
          style={{ y: y2 }}
          className="absolute right-[10%] bottom-[30%] hidden lg:block"
        >
          <Card className="p-4 !rounded-2xl bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border-white/50 dark:border-white/10 flex items-center gap-3 shadow-2xl shadow-blue-500/10 rotate-[6deg]">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
              <CheckCircle2
                size={20}
                className="text-blue-600 dark:text-blue-400"
              />
            </div>
            <div>
              <p className="text-sm font-bold">Проверка</p>
              <p className="text-xs text-slate-500">Авто-тесты 24/7</p>
            </div>
          </Card>
        </motion.div>

        <div className="max-w-4xl mx-auto text-center z-10">
          <motion.div
            variants={fadeInUp}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-rose-200/80 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/30 text-xs font-semibold text-rose-700 dark:text-rose-300 mx-auto mb-8 backdrop-blur-md"
          >
            <Sparkles size={14} />
            Платформа нового поколения
          </motion.div>

          <motion.h1
            variants={fadeInUp}
            className="text-4xl md:text-7xl font-extrabold mb-6 tracking-tight leading-[1.1]"
          >
            Освойте IT-профессии через <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-600 via-red-500 to-orange-500">
              реальную практику
            </span>
          </motion.h1>

          <motion.p
            variants={fadeInUp}
            className="text-lg md:text-xl text-slate-600 dark:text-slate-400 mb-10 max-w-2xl mx-auto"
          >
            Интерактивные курсы, мгновенная проверка кода и поддержка
            сообщества. Постройте карьеру мечты шаг за шагом.
          </motion.p>

          <motion.div
            variants={fadeInUp}
            className="w-full max-w-2xl mx-auto p-2 glass-panel !rounded-full flex flex-col md:flex-row gap-2 items-center border border-white/60 dark:border-slate-700/60 shadow-xl shadow-slate-200/20 dark:shadow-black/40"
          >
            <div className="flex-1 flex items-center gap-3 px-4 py-2 w-full">
              <Search size={20} className="text-slate-400" />
              <input
                placeholder="Что вы хотите изучить? (напр. React)"
                className="bg-transparent w-full outline-none text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
              />
            </div>
            <Link to="/dashboard" className="w-full md:w-auto">
              <Button className="w-full md:w-auto !rounded-full px-8 py-3 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 text-white shadow-none">
                Начать обучение
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="px-4 max-w-6xl mx-auto relative z-10 -mt-10 mb-20">
        <motion.div
          variants={fadeInUp}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {[
            { label: "Курсов", value: landingStats.coursesTotal },
            {
              label: "Студентов",
              value: formatCompact(landingStats.studentsTotal),
            },
            { label: "Рейтинг", value: averageRating },
            {
              label: "Сообщество",
              value: formatCompact(landingStats.communityMembers),
            },
          ].map((stat, i) => (
            <Card
              key={i}
              className="text-center p-6 !rounded-3xl border border-white/40 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl"
            >
              <div className="text-3xl md:text-4xl font-bold bg-gradient-to-br from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent mb-1">
                {stat.value}
              </div>
              <div className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                {stat.label}
              </div>
            </Card>
          ))}
        </motion.div>
      </section>

      {/* Partners Marquee style */}
      <section className="py-12 border-y border-slate-200/50 dark:border-slate-800/50 bg-white/30 dark:bg-slate-900/30 backdrop-blur-sm overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-8">
            Нам доверяют профессионалы из
          </p>
          <div className="flex flex-wrap justify-center items-center gap-10 md:gap-20 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
            {partners.map((partner) => (
              <span
                key={partner}
                className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-200 tracking-tight"
              >
                {partner}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Tracks Section */}
      <section id="tracks" className="py-24 px-4 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <motion.h2
            variants={fadeInUp}
            className="text-3xl md:text-5xl font-bold mb-4"
          >
            Выберите свой путь
          </motion.h2>
          <motion.p
            variants={fadeInUp}
            className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto"
          >
            Освойте востребованные технологии по нашим структурированным трекам
            обучения.
          </motion.p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          {tracks.map((track) => (
            <motion.div
              key={track.name}
              variants={fadeInUp}
              whileHover={{ y: -5, scale: 1.02 }}
              className="group cursor-pointer p-6 rounded-3xl glass-panel border border-white/50 dark:border-slate-700/50 bg-white/40 dark:bg-slate-800/40 hover:bg-white/80 dark:hover:bg-slate-800/80 transition-all duration-300 flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 group-hover:bg-rose-100 dark:group-hover:bg-rose-900/50 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                {track.icon}
              </div>
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                {track.name}
              </span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Catalog Section */}
      <section
        id="catalog"
        className="py-24 px-4 bg-slate-50/50 dark:bg-slate-900/20 border-t border-slate-200/50 dark:border-slate-800/50"
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
            <div>
              <motion.h2
                variants={fadeInUp}
                className="text-3xl md:text-5xl font-bold mb-4"
              >
                Популярные курсы
              </motion.h2>
              <motion.p
                variants={fadeInUp}
                className="text-lg text-slate-600 dark:text-slate-400 max-w-xl"
              >
                Начните обучение с самых высокооцененных программ на платформе.
              </motion.p>
            </div>
            <Button
              variant="outline"
              className="!rounded-full px-6 flex items-center gap-2 w-fit"
            >
              Все курсы <ArrowRight size={16} />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {coursesLoading
              ? [1, 2, 3].map((i) => (
                  <Card
                    key={i}
                    className="h-96 animate-pulse bg-slate-200/50 dark:bg-slate-800/50 !rounded-[2rem]"
                  >
                    <span className="sr-only">Загрузка...</span>
                  </Card>
                ))
              : courses.map((course) => (
                  <motion.div
                    key={course.id}
                    variants={fadeInUp}
                    whileHover={{ y: -10 }}
                    className="group relative flex flex-col !rounded-[2rem] glass-panel bg-white/70 dark:bg-slate-900/70 border border-white/60 dark:border-slate-700/60 overflow-hidden shadow-lg shadow-slate-200/20 dark:shadow-black/20"
                  >
                    <div className="h-48 relative overflow-hidden bg-slate-100 dark:bg-slate-800">
                      <div className="absolute inset-0 bg-gradient-to-br from-rose-500/20 to-orange-500/20 group-hover:scale-110 transition-transform duration-700" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Play
                          size={48}
                          className="text-white/50 backdrop-blur-sm rounded-full p-2 bg-black/20"
                        />
                      </div>
                      <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md text-xs font-bold text-slate-800 dark:text-slate-200">
                        {course.level}
                      </div>
                    </div>

                    <div className="p-6 md:p-8 flex flex-col flex-1">
                      <h3 className="text-xl font-bold mb-2 line-clamp-2 leading-tight group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                        {course.title}
                      </h3>
                      <p className="text-sm text-slate-500 mb-6 font-medium">
                        {course.author}
                      </p>

                      <div className="mt-auto grid grid-cols-3 gap-2 py-4 border-y border-slate-100 dark:border-slate-800 mb-6">
                        <div className="flex flex-col gap-1 items-center justify-center text-center">
                          <Star size={16} className="text-amber-500" />
                          <span className="text-xs font-semibold">
                            {course.rating}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1 items-center justify-center text-center border-x border-slate-100 dark:border-slate-800">
                          <Users size={16} className="text-blue-500" />
                          <span className="text-xs font-semibold">
                            {course.students}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1 items-center justify-center text-center">
                          <Clock3 size={16} className="text-emerald-500" />
                          <span className="text-xs font-semibold">
                            {course.duration}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-black text-slate-900 dark:text-white">
                          {course.price}
                        </span>
                        <Link to={`/course/${course.id}`}>
                          <Button className="!rounded-xl px-5 py-2">
                            Начать
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 px-4 max-w-7xl mx-auto">
        <Card className="!rounded-[3rem] p-8 md:p-16 border-white/60 dark:border-slate-700/60 bg-gradient-to-br from-white/80 to-slate-50/80 dark:from-slate-900/80 dark:to-slate-800/80 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-96 h-96 bg-rose-500/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="grid md:grid-cols-2 gap-12 items-center relative z-10">
            <div>
              <motion.div
                variants={fadeInUp}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-sm font-semibold mb-6"
              >
                О платформе
              </motion.div>
              <motion.h2
                variants={fadeInUp}
                className="text-3xl md:text-5xl font-bold mb-6 leading-tight"
              >
                Создано для тех, кто ценит{" "}
                <span className="text-rose-600 dark:text-rose-500">
                  результат
                </span>
              </motion.h2>
              <motion.p
                variants={fadeInUp}
                className="text-lg text-slate-600 dark:text-slate-400 mb-8 leading-relaxed"
              >
                Мы отказались от скучных многочасовых лекций в пользу
                интерактивной практики. Пишите код прямо в браузере, получайте
                мгновенный фидбэк от авто-тестов и обсуждайте решения с
                сообществом.
              </motion.p>
              <Link to="/register">
                <Button className="!rounded-full px-8 py-3 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 text-white shadow-none text-lg">
                  Присоединиться бесплатно
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                {
                  title: "Практика",
                  desc: "80% времени курса",
                  icon: <Terminal className="text-rose-500 mb-4" size={32} />,
                },
                {
                  title: "Поддержка",
                  desc: "24/7 ответы на вопросы",
                  icon: <Users className="text-blue-500 mb-4" size={32} />,
                },
                {
                  title: "Трудоустройство",
                  desc: "Помощь с резюме",
                  icon: (
                    <CheckCircle2 className="text-emerald-500 mb-4" size={32} />
                  ),
                },
                {
                  title: "Доступность",
                  desc: "Учись в любом темпе",
                  icon: <Clock3 className="text-amber-500 mb-4" size={32} />,
                },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  variants={fadeInUp}
                  className="p-6 rounded-3xl bg-white dark:bg-slate-800 shadow-xl shadow-slate-200/20 dark:shadow-black/20 border border-slate-100 dark:border-slate-700"
                >
                  {item.icon}
                  <h4 className="font-bold text-lg mb-1">{item.title}</h4>
                  <p className="text-sm text-slate-500">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200/60 dark:border-slate-800/60 py-12 px-4 mt-10 text-center relative z-10 bg-white/50 dark:bg-slate-950/50 backdrop-blur-md">
        <BrandLogo
          text="Gradus"
          iconClassName="h-6 w-6 text-slate-400"
          textClassName="text-xl font-bold text-slate-400"
          className="justify-center mb-6 grayscale opacity-50"
        />
        <p className="text-sm text-slate-500 font-medium">
          © {new Date().getFullYear()} Gradus • Учебный проект
        </p>
      </footer>
    </motion.div>
  );
}
