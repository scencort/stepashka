import MainLayout from "../layout/MainLayout"
import { motion } from "framer-motion"
import Card from "../components/ui/Card"

import {
  fadeInUp,
  staggerContainer,
} from "../lib/animations"

export default function Dashboard() {
  return (
    <MainLayout>

      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="space-y-6"
      >

        {/* Title */}
        <motion.h2
          variants={fadeInUp}
          className="text-2xl font-bold"
        >
          Dashboard
        </motion.h2>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-6">

          <Card>
            <p className="text-gray-500 text-sm">Курсы</p>
            <h3 className="text-2xl font-bold mt-2">12</h3>
          </Card>

          <Card>
            <p className="text-gray-500 text-sm">Задания</p>
            <h3 className="text-2xl font-bold mt-2">48</h3>
          </Card>

          <Card>
            <p className="text-gray-500 text-sm">Средний балл</p>
            <h3 className="text-2xl font-bold mt-2 text-red-600">87%</h3>
          </Card>

          <Card>
            <p className="text-gray-500 text-sm">Активность</p>
            <h3 className="text-2xl font-bold mt-2">5 дн.</h3>
          </Card>

        </div>

        {/* Main grid */}
        <div className="grid grid-cols-3 gap-6">

          {/* Courses */}
          <div className="col-span-2 space-y-4">

            <motion.h3 variants={fadeInUp} className="font-semibold">
              Мои курсы
            </motion.h3>

            {[
              { title: "React", progress: 70 },
              { title: "Python", progress: 40 },
            ].map((c, i) => (
              <Card key={i} className="flex justify-between items-center">

                <div>
                  <h4 className="font-semibold">{c.title}</h4>
                  <p className="text-sm text-gray-500">
                    Прогресс: {c.progress}%
                  </p>
                </div>

                <div className="w-1/3">
                  <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full">
                    <div
                      className="h-2 bg-red-600 rounded-full"
                      style={{ width: `${c.progress}%` }}
                    />
                  </div>
                </div>

              </Card>
            ))}

          </div>

          {/* Activity */}
          <div className="space-y-4">

            <motion.h3 variants={fadeInUp} className="font-semibold">
              Последние действия
            </motion.h3>

            <Card>
              <p className="text-sm">
                ✔ Решено задание по React
              </p>
            </Card>

            <Card>
              <p className="text-sm">
                ✔ Пройден урок Python
              </p>
            </Card>

            <Card>
              <p className="text-sm">
                ✔ Добавлен новый курс
              </p>
            </Card>

          </div>

        </div>

      </motion.div>

    </MainLayout>
  )
}