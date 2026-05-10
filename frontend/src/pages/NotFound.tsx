import { useNavigate } from "react-router-dom"

const NotFound = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="glass-panel rounded-2xl p-10 text-center max-w-md w-full">
        <h1 className="text-8xl font-bold text-indigo-500 dark:text-indigo-400">404</h1>
        <p className="mt-4 text-xl text-slate-600 dark:text-slate-300">Страница не найдена</p>
        <button
          onClick={() => navigate("/")}
          className="mt-8 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white shadow hover:bg-indigo-700 transition-colors"
        >
          На главную
        </button>
      </div>
    </div>
  )
}

export default NotFound
