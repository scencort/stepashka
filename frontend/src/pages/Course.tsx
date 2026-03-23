import MainLayout from "../layout/MainLayout"
import { motion } from "framer-motion"
import { useState } from "react"
import Card from "../components/ui/Card"
import Button from "../components/ui/Button"

import {
  fadeInUp,
  staggerContainer,
} from "../lib/animations"

export default function Course() {
  const [active, setActive] = useState("Все")

  const courses = [
    { title: "React", lessons: 12, progress: 70, type: "Frontend" },
    { title: "Vue", lessons: 8, progress: 40, type: "Frontend" },
    { title: "Python", lessons: 15, progress: 30, type: "Backend" },
  ]

  const filtered =
    active === "Все"
      ? courses
      : courses.filter((c) => c.type === active)

  return (
    <MainLayout>

      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >

        {/* Header */}
        <motion.div
          variants={fadeInUp}
          className="flex justify-between items-center mb-6"
        >
          <h2 className="text-2xl font-bold">
            Курсы
          </h2>

          <Button>
            + Создать курс
          </Button>
        </motion.div>

        {/* Filters */}
        <motion.div
          variants={fadeInUp}
          className="flex gap-3 mb-6"
        >
          {["Все", "Frontend", "Backend"].map((f) => (
            <Button
              key={f}
              variant={active === f ? "primary" : "outline"}
              onClick={() => setActive(f)}
            >
              {f}
            </Button>
          ))}
        </motion.div>

        {/* LIST */}
        <div className="space-y-4">

          {filtered.map((course, i) => (
            <Card
              key={i}
              className="flex items-center justify-between"
            >

              {/* Left */}
              <div>
                <h3 className="font-semibold text-lg">
                  {course.title}
                </h3>

                <p className="text-sm text-gray-500">
                  {course.lessons} уроков • {course.type}
                </p>
              </div>

              {/* Center */}
              <div className="w-1/3">

                <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full">
                  <div
                    className="h-2 bg-red-600 rounded-full"
                    style={{ width: `${course.progress}%` }}
                  />
                </div>

                <p className="text-xs text-gray-500 mt-1">
                  {course.progress}%
                </p>

              </div>

              {/* Right */}
              <Button variant="outline">
                Открыть
              </Button>

            </Card>
          ))}

        </div>

      </motion.div>

    </MainLayout>
  )
}