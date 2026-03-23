import MainLayout from "../layout/MainLayout"
import { useState } from "react"
import Button from "../components/ui/Button"
import Card from "../components/ui/Card"
import { motion } from "framer-motion"

import { fadeInUp } from "../lib/animations"

export default function Task() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handleCheck = () => {
    setLoading(true)
    setResult(null)

    setTimeout(() => {
      setLoading(false)
      setResult({
        score: 92,
        feedback: [
          "✔ Отличный код",
          "✔ Чистая структура",
          "💡 Можно оптимизировать useEffect",
        ],
      })
    }, 1500)
  }

  return (
    <MainLayout>

      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        className="h-[calc(100vh-64px)] flex"
      >

        {/* LEFT — EDITOR */}
        <div className="w-2/3 bg-black text-green-400 p-6 font-mono">

          <h3 className="text-white mb-4">
            solution.tsx
          </h3>

          <textarea
            className="w-full h-full bg-black outline-none resize-none"
            placeholder="// пишите код..."
          />

        </div>

        {/* RIGHT — PANEL */}
        <div className="w-1/3 p-6 flex flex-col gap-4">

          <Button onClick={handleCheck}>
            Проверить
          </Button>

          {loading && (
            <p className="text-gray-500">
              🤖 Анализируем код...
            </p>
          )}

          {result && (
            <Card>

              <p className="text-red-600 font-bold text-xl mb-2">
                {result.score}%
              </p>

              <div className="space-y-2">
                {result.feedback.map((f: string, i: number) => (
                  <p key={i} className="text-sm">
                    {f}
                  </p>
                ))}
              </div>

            </Card>
          )}

        </div>

      </motion.div>

    </MainLayout>
  )
}