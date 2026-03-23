import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import Button from "../components/ui/Button"
import Card from "../components/ui/Card"

import {
  fadeInUp,
  staggerContainer,
} from "../lib/animations"

export default function Landing() {
  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="min-h-screen bg-gray-50 dark:bg-gray-900"
    >

      {/* Header */}
      <motion.header
        variants={fadeInUp}
        className="flex justify-between items-center px-10 py-6 bg-white dark:bg-gray-950 border-b dark:border-gray-800"
      >
        <h1 className="text-xl font-bold text-red-600">
          Stepashka
        </h1>

        <div className="flex gap-3">
          <Link to="/login">
            <Button>Войти</Button>
          </Link>

          <Link to="/register">
            <Button>Регистрация</Button>
          </Link>
        </div>
      </motion.header>

      {/* Hero */}
      <section className="flex flex-col items-center text-center px-6 py-24">

        <motion.h2
          variants={fadeInUp}
          className="text-5xl font-bold mb-6 max-w-3xl"
        >
          Stepashka — платформа обучения нового поколения
        </motion.h2>

        <motion.p
          variants={fadeInUp}
          className="text-gray-600 dark:text-gray-400 mb-8 max-w-xl"
        >
          Интерактивное обучение, современный интерфейс и интеллектуальная проверка заданий
        </motion.p>

        <motion.div variants={fadeInUp}>
          <Link to="/dashboard">
            <Button className="px-6 py-3 text-lg rounded-xl">
              Начать обучение
            </Button>
          </Link>
        </motion.div>

      </section>

      {/* Features */}
      <section className="px-6 py-16 max-w-6xl mx-auto">

        <motion.h3
          variants={fadeInUp}
          className="text-2xl font-bold mb-8 text-center"
        >
          Возможности платформы
        </motion.h3>

        <div className="grid grid-cols-3 gap-6">

          <Card>
            <h4 className="font-semibold mb-2">📚 Курсы</h4>
            <p className="text-sm text-gray-500">
              Удобная система прохождения курсов и отслеживания прогресса
            </p>
          </Card>

          <Card>
            <h4 className="font-semibold mb-2">🤖 AI проверка</h4>
            <p className="text-sm text-gray-500">
              Интеллектуальная оценка заданий и рекомендации по улучшению
            </p>
          </Card>

          <Card>
            <h4 className="font-semibold mb-2">⚡ UI/UX</h4>
            <p className="text-sm text-gray-500">
              Современный интерфейс с плавными анимациями
            </p>
          </Card>

        </div>

      </section>

      {/* About */}
      <section className="px-6 py-16 max-w-4xl mx-auto text-center">

        <motion.h3
          variants={fadeInUp}
          className="text-2xl font-bold mb-4"
        >
          О проекте
        </motion.h3>

        <motion.p
          variants={fadeInUp}
          className="text-gray-600 dark:text-gray-400"
        >
          Платформа разрабатывается командой из шести студентов РАНХиГС.
          Проект находится в активной стадии разработки и направлен на создание
          современной образовательной среды.
        </motion.p>

      </section>

      {/* Team */}
      <section className="px-6 py-16 max-w-6xl mx-auto text-center">

        <motion.h3
          variants={fadeInUp}
          className="text-2xl font-bold mb-10"
        >
          Команда проекта
        </motion.h3>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">

          <Card>
            <p className="font-semibold mb-1">Модуль управления курсами</p>
            <p className="text-sm text-gray-500 mb-2">Иван Чеха</p>
            <a href="https://t.me/aaaaaqiwi" target="_blank" className="text-red-600 text-sm">
              @aaaaaqiwi
            </a>
          </Card>

          <Card>
            <p className="font-semibold mb-1">Интеллектуальная проверка</p>
            <p className="text-sm text-gray-500 mb-2">Радкевич Роман</p>
            <a href="https://t.me/liiiiiliiiiiliiiiiliiiiiliiiiil" target="_blank" className="text-red-600 text-sm">
              @liiiiiliiiiiliiiiiliiiiiliiiiil
            </a>
          </Card>

          <Card>
            <p className="font-semibold mb-1">Аутентификация и роли</p>
            <p className="text-sm text-gray-500 mb-2">Кужелева Вероника</p>
            <a href="https://t.me/veronika_vladislavovnaa" target="_blank" className="text-red-600 text-sm">
              @veronika_vladislavovnaa
            </a>
          </Card>

          <Card>
            <p className="font-semibold mb-1">Задания и проверки</p>
            <p className="text-sm text-gray-500 mb-2">Вартанян Вячеслав</p>
            <a href="https://t.me/A597MP97" target="_blank" className="text-red-600 text-sm">
              @A597MP97
            </a>
          </Card>

          <Card>
            <p className="font-semibold mb-1">Аналитика</p>
            <p className="text-sm text-gray-500 mb-2">Кужелева Виктория</p>
            <a href="https://t.me/viktoriakuzheleva" target="_blank" className="text-red-600 text-sm">
              @viktoriakuzheleva
            </a>
          </Card>

        <Card>
            <p className="font-semibold mb-1">Интерфейс (Frontend)</p>
            <p className="text-sm text-gray-500 mb-2">Поляков Ярослав</p>
            <a href="https://t.me/scencort" target="_blank" className="text-red-600 text-sm">
                @scencort
            </a>
        </Card>

        </div>

      </section>

      {/* Location */}
      <section className="px-6 py-16 max-w-5xl mx-auto">

        <motion.h3
          variants={fadeInUp}
          className="text-2xl font-bold mb-6 text-center"
        >
          Где мы находимся
        </motion.h3>

        <motion.div
          variants={fadeInUp}
          className="rounded-xl overflow-hidden border dark:border-gray-800"
        >
          <iframe
            src="https://www.google.com/maps?q=Волгоградский+пр-т+43+строение+В+Москва&output=embed"
            width="100%"
            height="350"
            loading="lazy"
            className="border-0"
          ></iframe>
        </motion.div>

        <p className="text-center text-sm text-gray-500 mt-3">
          Волгоградский пр-т., 43 строение В, Москва, Россия, 109316
        </p>

        <div className="flex justify-center mt-4">
          <a
            href="https://www.google.com/maps?q=Волгоградский+пр-т+43+строение+В+Москва"
            target="_blank"
            rel="noreferrer"
          >
            <Button variant="outline">
              Открыть в Google Maps
            </Button>
          </a>
        </div>

      </section>

      {/* Footer */}
      <footer className="text-center py-8 text-sm text-gray-500">
        © 2026 Stepashka • Учебный проект РАНХиГС
      </footer>

    </motion.div>
  )
}