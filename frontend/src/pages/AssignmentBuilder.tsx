import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import MainLayout from "../layout/MainLayout"
import Card from "../components/ui/Card"
import Button from "../components/ui/Button"
import { fadeInUp } from "../lib/animations"
import { api } from "../lib/api"

type TestCase = {
  id: number
  input: string
  expected: string
}

type AssignmentListItem = {
  id: number
  title: string
  status: "draft" | "ready" | "published"
  difficulty: "junior" | "middle" | "senior"
  tags: string[]
  qualityScore: number
  testsCount: number
  createdAt: string
}

export default function AssignmentBuilder() {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [tests, setTests] = useState<TestCase[]>([{ id: 1, input: "2 2", expected: "4" }])
  const [status, setStatus] = useState<"draft" | "ready" | "published">("draft")
  const [difficulty, setDifficulty] = useState<"junior" | "middle" | "senior">("junior")
  const [tags, setTags] = useState("")
  const [savedAssignments, setSavedAssignments] = useState<AssignmentListItem[]>([])
  const [error, setError] = useState("")

  const qualityScore = useMemo(() => {
    let score = 0
    if (title.trim().length >= 8) {
      score += 25
    }
    if (description.trim().length >= 40) {
      score += 25
    }
    if (tests.filter((item) => item.input.trim() && item.expected.trim()).length >= 2) {
      score += 25
    }
    if (tags.split(",").map((item) => item.trim()).filter(Boolean).length >= 2) {
      score += 25
    }
    return score
  }, [description, tags, tests, title])

  const loadAssignments = async () => {
    try {
      const list = await api.get<AssignmentListItem[]>("/assignments")
      setSavedAssignments(list)
    } catch {
      setSavedAssignments([])
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadAssignments()
    }, 0)

    return () => clearTimeout(timer)
  }, [])

  const addTest = () => {
    setTests((prev) => [...prev, { id: Date.now(), input: "", expected: "" }])
  }

  const updateTest = (id: number, key: "input" | "expected", value: string) => {
    setTests((prev) => prev.map((item) => (item.id === id ? { ...item, [key]: value } : item)))
  }

  const removeTest = (id: number) => {
    setTests((prev) => prev.filter((item) => item.id !== id))
  }

  const saveAssignment = async () => {
    setError("")
    if (!title.trim() || !description.trim()) {
      setError("Заполните название и описание")
      return
    }

    try {
      await api.post("/assignments", {
        title,
        description,
        status,
        difficulty,
        qualityScore,
        tags: tags
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        tests: tests.map((item) => ({ input: item.input, expected: item.expected })),
      })
      setTitle("")
      setDescription("")
      setTests([{ id: 1, input: "", expected: "" }])
      setStatus("draft")
      setDifficulty("junior")
      setTags("")
      await loadAssignments()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить задание")
    }
  }

  return (
    <MainLayout>
      <motion.div variants={fadeInUp} initial="initial" animate="animate" className="space-y-5">
        <h2 className="text-2xl font-bold">Конструктор заданий</h2>

        <Card className="space-y-4">
          <label className="block">
            <span className="text-sm text-slate-600 dark:text-slate-300">Название задания</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Например: Сумма двух чисел"
              className="mt-1 w-full rounded-xl glass-panel px-3 py-2 outline-none"
            />
          </label>

          <label className="block">
            <span className="text-sm text-slate-600 dark:text-slate-300">Описание</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Опишите задачу"
              className="mt-1 w-full h-32 rounded-xl glass-panel px-3 py-2 outline-none"
            />
          </label>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="block">
              <span className="text-sm text-slate-600 dark:text-slate-300">Стадия</span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as "draft" | "ready" | "published")}
                className="mt-1 w-full rounded-xl glass-panel px-3 py-2 outline-none"
              >
                <option value="draft">Draft</option>
                <option value="ready">Ready for review</option>
                <option value="published">Published</option>
              </select>
            </label>

            <label className="block">
              <span className="text-sm text-slate-600 dark:text-slate-300">Сложность</span>
              <select
                value={difficulty}
                onChange={(event) => setDifficulty(event.target.value as "junior" | "middle" | "senior")}
                className="mt-1 w-full rounded-xl glass-panel px-3 py-2 outline-none"
              >
                <option value="junior">Junior</option>
                <option value="middle">Middle</option>
                <option value="senior">Senior</option>
              </select>
            </label>

            <label className="block">
              <span className="text-sm text-slate-600 dark:text-slate-300">Качество (auto-score)</span>
              <div className="mt-1 rounded-xl glass-panel px-3 py-2 font-semibold">{qualityScore}/100</div>
            </label>
          </div>

          <label className="block">
            <span className="text-sm text-slate-600 dark:text-slate-300">Теги (через запятую)</span>
            <input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="arrays, two-pointers, complexity"
              className="mt-1 w-full rounded-xl glass-panel px-3 py-2 outline-none"
            />
          </label>
        </Card>

        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Тест-кейсы</h3>
            <Button variant="outline" onClick={addTest}>Добавить тест</Button>
          </div>

          <div className="space-y-3">
            {tests.map((test, index) => (
              <div key={test.id} className="grid grid-cols-1 md:grid-cols-5 gap-2">
                <input
                  value={test.input}
                  onChange={(event) => updateTest(test.id, "input", event.target.value)}
                  placeholder={`Входные данные ${index + 1}`}
                  className="md:col-span-2 rounded-xl glass-panel px-3 py-2 outline-none"
                />
                <input
                  value={test.expected}
                  onChange={(event) => updateTest(test.id, "expected", event.target.value)}
                  placeholder={`Ожидаемый результат ${index + 1}`}
                  className="md:col-span-2 rounded-xl glass-panel px-3 py-2 outline-none"
                />
                <button
                  onClick={() => removeTest(test.id)}
                  className="rounded-xl px-3 py-2 text-white bg-gradient-to-r from-rose-700 via-red-700 to-red-900"
                >
                  Удалить
                </button>
              </div>
            ))}
          </div>

          {error && <p className="text-sm text-red-700 dark:text-rose-300">{error}</p>}

          <Button onClick={saveAssignment} className="w-full md:w-auto">Сохранить задание</Button>
        </Card>

        <Card className="space-y-3">
          <h3 className="font-semibold">Сохраненные задания</h3>
          {savedAssignments.map((item) => (
            <div key={item.id} className="rounded-xl glass-panel p-3 space-y-1">
              <p className="text-sm font-medium">#{item.id} {item.title}</p>
              <p className="text-xs text-slate-500">
                {item.difficulty.toUpperCase()} • {item.testsCount} тестов • score {item.qualityScore}/100
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded-lg ${item.status === "published" ? "bg-emerald-100 text-emerald-800" : item.status === "ready" ? "bg-sky-100 text-sky-800" : "bg-amber-100 text-amber-800"}`}>
                  {item.status}
                </span>
                {item.tags.slice(0, 4).map((tag) => (
                  <span key={`${item.id}-${tag}`} className="text-xs px-2 py-1 rounded-lg bg-slate-200/70 dark:bg-slate-700/70">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {savedAssignments.length === 0 && (
            <p className="text-sm text-slate-600 dark:text-slate-300">Пока нет сохраненных заданий.</p>
          )}
        </Card>
      </motion.div>
    </MainLayout>
  )
}
