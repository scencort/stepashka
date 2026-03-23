import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import Button from "../components/ui/Button"
import Card from "../components/ui/Card"
import { Search, Star, Users, Clock3, ArrowRight } from "lucide-react"
import { api } from "../lib/api"
import BrandLogo from "../components/BrandLogo"

import {
  fadeInUp,
  staggerContainer,
} from "../lib/animations"

export default function Landing() {
  const tracks = ["Python", "Web Development", "Data", "Testing", "DevOps", "Design"]
  const partners = ["Google", "IBM", "Microsoft", "Yandex", "VK", "MIPT"]
  const [courses, setCourses] = useState<Array<{
    id: number
    title: string
    author: string
    level: string
    rating: string
    students: string
    duration: string
    price: string
  }>>([])
  const [coursesLoading, setCoursesLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setCoursesLoading(true)
      try {
        const data = await api.get<Array<{
          id: number
          title: string
          author: string
          level: string
          rating: string
          students: string
          duration: string
          price: string
        }>>("/courses")
        setCourses(data.slice(0, 3))
      } finally {
        setCoursesLoading(false)
      }
    }

    load()
  }, [])

  const averageRating = useMemo(() => {
    if (courses.length === 0) {
      return "0.0"
    }
    const total = courses.reduce((sum, item) => sum + Number(item.rating), 0)
    return (total / courses.length).toFixed(1)
  }, [courses])

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="min-h-screen"
    >

      {/* Header */}
      <motion.header
        variants={fadeInUp}
        className="mx-3 mt-3 px-4 md:px-8 py-4 rounded-2xl glass-panel flex flex-col md:flex-row gap-4 md:gap-0 justify-between items-center"
      >
        <BrandLogo
          text="Stepashka"
          iconClassName="h-10 w-10"
          textClassName="text-2xl font-extrabold bg-gradient-to-r from-red-600 to-rose-800 bg-clip-text text-transparent"
        />

        <div className="hidden md:flex items-center gap-6 text-sm text-slate-600 dark:text-slate-300">
          <a href="#catalog">Каталог</a>
          <a href="#tracks">Треки</a>
          <a href="#about">О нас</a>
        </div>

        <div className="flex gap-2 md:gap-3 w-full md:w-auto">
          <Link to="/login">
            <Button variant="outline" className="w-full md:w-auto">Войти</Button>
          </Link>

          <Link to="/register">
            <Button className="w-full md:w-auto">Регистрация</Button>
          </Link>
        </div>
      </motion.header>

      {/* Hero */}
      <section className="hero-grid mx-3 mt-4 rounded-3xl px-4 md:px-10 py-14 md:py-20 overflow-hidden relative min-h-[560px] flex items-center justify-center">

        <div className="w-full max-w-5xl mx-auto">

        <div className="absolute -right-14 -top-10 h-44 w-44 rounded-full bg-rose-400/20 blur-2xl" />
        <div className="absolute -left-10 bottom-0 h-36 w-36 rounded-full bg-red-400/20 blur-2xl" />

        <motion.h2
          variants={fadeInUp}
          className="text-3xl md:text-6xl font-extrabold mb-5 max-w-4xl leading-tight mx-auto text-center"
        >
          Учитесь быстрее.
          <br />
          Развивайте навыки по понятному маршруту.
        </motion.h2>

        <motion.p
          variants={fadeInUp}
          className="text-slate-600 dark:text-slate-300 mb-8 max-w-2xl text-sm md:text-lg mx-auto text-center"
        >
          Практическая учебная платформа с интерактивными курсами,
          отслеживанием прогресса и проверкой качества решений.
        </motion.p>

        <motion.div variants={fadeInUp} className="w-full max-w-2xl mx-auto glass-panel rounded-2xl p-2 md:p-3 flex flex-col md:flex-row gap-2 md:items-center">
          <div className="flex items-center gap-2 px-3">
            <Search size={18} className="text-slate-500" />
            <input
              placeholder="Например: JavaScript, базы данных, UI design"
              className="bg-transparent w-full py-2 outline-none"
            />
          </div>

          <Link to="/dashboard" className="md:ml-auto">
            <Button className="w-full md:w-auto px-6">Начать</Button>
          </Link>
        </motion.div>

        <motion.div variants={fadeInUp} className="mt-8 grid grid-cols-3 gap-3 md:gap-6 max-w-2xl w-full mx-auto">
          <Card className="text-center">
            <p className="text-2xl font-bold">{courses.length}</p>
            <p className="text-xs text-slate-500">курсов</p>
          </Card>
          <Card className="text-center">
            <p className="text-2xl font-bold">48k</p>
            <p className="text-xs text-slate-500">студентов</p>
          </Card>
          <Card className="text-center">
            <p className="text-2xl font-bold">{averageRating}</p>
            <p className="text-xs text-slate-500">средний рейтинг</p>
          </Card>
        </motion.div>

        </div>

      </section>

      {/* Partners */}
      <section className="px-4 md:px-6 py-8 md:py-10 max-w-6xl mx-auto">
        <Card className="p-4 md:p-5">
          <p className="text-sm text-slate-500 mb-3">Учитесь на курсах от ведущих компаний и университетов</p>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {partners.map((item) => (
              <div
                key={item}
                className="rounded-xl py-3 text-center font-semibold bg-white/70 dark:bg-slate-900/50 border border-rose-200/70 dark:border-rose-900/50"
              >
                {item}
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* Tracks */}
      <section id="tracks" className="px-4 md:px-6 py-12 md:py-16 max-w-6xl mx-auto">

        <motion.h3
          variants={fadeInUp}
          className="text-xl md:text-3xl font-bold mb-7"
        >
          Популярные треки
        </motion.h3>

        <div className="flex flex-wrap gap-3">
          {tracks.map((item) => (
            <button
              key={item}
              className="px-4 py-2 rounded-full text-sm font-semibold glass-panel hover:bg-white/80 dark:hover:bg-slate-900/70"
            >
              {item}
            </button>
          ))}
        </div>

      </section>

      {/* Catalog */}
      <section id="catalog" className="px-4 md:px-6 py-8 md:py-12 max-w-6xl mx-auto">

        <div className="flex items-center justify-between mb-6">
          <motion.h3 variants={fadeInUp} className="text-xl md:text-3xl font-bold">
            Рекомендуемые курсы
          </motion.h3>
          <button className="hidden md:flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-rose-300">
            Смотреть все <ArrowRight size={16} />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {coursesLoading && <Card><p className="text-sm">Загрузка курсов...</p></Card>}
          {!coursesLoading && courses.map((course) => (
            <Card key={course.title} className="p-0 overflow-hidden">
              <div className="h-36 bg-gradient-to-br from-red-600/95 via-rose-700/95 to-red-900/95" />

              <div className="p-5">
                <p className="text-xs text-slate-500 mb-2">{course.level}</p>
                <h4 className="text-lg font-bold leading-snug">{course.title}</h4>
                <p className="text-sm text-slate-500 mt-2">{course.author}</p>

                <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-300">
                  <span className="inline-flex items-center gap-1"><Star size={13} /> {course.rating}</span>
                  <span className="inline-flex items-center gap-1"><Users size={13} /> {course.students}</span>
                  <span className="inline-flex items-center gap-1"><Clock3 size={13} /> {course.duration}</span>
                </div>

                <div className="mt-5 flex items-center justify-between">
                  <p className="text-lg font-bold">{course.price}</p>
                  <Button variant="outline">Подробнее</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

      </section>

      {/* About */}
      <section id="about" className="px-4 md:px-6 py-10 md:py-12 max-w-6xl mx-auto">
        <Card className="grid md:grid-cols-2 gap-6 items-center">
          <div>
            <h3 className="text-xl md:text-3xl font-bold mb-4">Платформа, ориентированная на результат</h3>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              Мы создали интерфейс, где удобно находить нужные курсы,
              отслеживать прогресс и сохранять мотивацию. Продукт делает акцент на
              практике: меньше теории ради теории, больше решений и обратной связи.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <p className="text-sm text-slate-500">Практика</p>
              <p className="text-2xl font-bold mt-1">80%</p>
            </Card>
            <Card>
              <p className="text-sm text-slate-500">Поддержка</p>
              <p className="text-2xl font-bold mt-1">24/7</p>
            </Card>
            <Card>
              <p className="text-sm text-slate-500">Достижения</p>
              <p className="text-2xl font-bold mt-1">+42</p>
            </Card>
            <Card>
              <p className="text-sm text-slate-500">Сообщество</p>
              <p className="text-2xl font-bold mt-1">18k</p>
            </Card>
          </div>
        </Card>

      </section>

      {/* Footer */}
      <footer className="text-center py-8 text-sm text-slate-500">
        © 2026 Stepashka • Учебный проект
      </footer>

    </motion.div>
  )
}