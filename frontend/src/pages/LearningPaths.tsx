import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import MainLayout from "../layout/MainLayout"
import Card from "../components/ui/Card"
import Button from "../components/ui/Button"
import { fadeInUp, staggerContainer } from "../lib/animations"
import { api } from "../lib/api"

type Track = {
  id: number
  name: string
  status: "in progress" | "completed" | "planned"
  progress: number
  lessons: number
}

export default function LearningPaths() {
  const [filter, setFilter] = useState<"all" | Track["status"]>("all")
  const [trackData, setTrackData] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError("")
      try {
        const data = await api.get<Track[]>("/tracks")
        setTrackData(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить треки")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const tracks = useMemo(() => {
    if (filter === "all") {
      return trackData
    }
    return trackData.filter((item) => item.status === filter)
  }, [filter, trackData])

  return (
    <MainLayout>
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="space-y-6"
      >
        <motion.div variants={fadeInUp} className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-2xl md:text-3xl font-bold">Траектории обучения</h2>
          <div className="flex flex-wrap gap-2">
            {(["all", "in progress", "planned", "completed"] as const).map((item) => (
              <Button
                key={item}
                variant={filter === item ? "primary" : "outline"}
                onClick={() => setFilter(item)}
                className="capitalize"
              >
                {item === "all" ? "все" : item === "in progress" ? "в процессе" : item === "planned" ? "план" : "завершено"}
              </Button>
            ))}
          </div>
        </motion.div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {loading && <Card><p className="text-sm">Загрузка...</p></Card>}
          {!loading && error && <Card><p className="text-sm text-red-700 dark:text-red-300">{error}</p></Card>}

          {!loading && !error && tracks.map((track) => (
            <Card key={track.id} className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-bold text-lg">{track.name}</h3>
                <span className="text-xs px-2 py-1 rounded-lg glass-panel">
                  {track.status === "in progress" ? "в процессе" : track.status === "planned" ? "план" : "завершено"}
                </span>
              </div>

              <p className="text-sm text-slate-600 dark:text-slate-300">Уроков: {track.lessons}</p>

              <div>
                <div className="h-2 rounded-full bg-slate-200/70 dark:bg-slate-700/70">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-rose-700 via-red-700 to-red-900"
                    style={{ width: `${track.progress}%` }}
                  />
                </div>
                <p className="text-sm mt-2 text-slate-600 dark:text-slate-300">Прогресс: {track.progress}%</p>
              </div>

              <div className="flex gap-2">
                <Button className="w-full">Открыть</Button>
                <Button variant="outline" className="w-full">План обучения</Button>
              </div>
            </Card>
          ))}
        </div>
      </motion.div>
    </MainLayout>
  )
}
