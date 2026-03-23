import { Link, useLocation } from "react-router-dom"
import { useTheme } from "../context/ThemeContext"
import { useState } from "react"
import { motion } from "framer-motion"

import {
  fadeInUp,
  smooth,
} from "../lib/animations"

import {
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  Sun,
  Moon,
  Bell,
  Plus,
} from "lucide-react"

export default function MainLayout({ children }: any) {
  const { pathname } = useLocation()
  const { theme, toggleTheme } = useTheme()
  const [collapsed, setCollapsed] = useState(false)

  const navItem = (path: string, label: string, icon: any) => {
    const Icon = icon

    return (
      <Link
        to={path}
        className={`flex items-center gap-3 px-4 py-2 rounded-lg transition ${
          pathname === path
            ? "bg-red-600 text-white"
            : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
        }`}
      >
        <Icon size={18} />
        {!collapsed && <span>{label}</span>}
      </Link>
    )
  }

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">

      {/* Sidebar */}
      <motion.aside
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className={`${
          collapsed ? "w-20" : "w-64"
        } bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 p-4 flex flex-col transition-all`}
      >

        {/* Top */}
        <div className="flex items-center justify-between mb-6">

          {!collapsed && (
            <h1 className="text-lg font-bold text-red-600">
              Stepashka
            </h1>
          )}

          <button onClick={() => setCollapsed(!collapsed)}>
            ☰
          </button>

        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-2">
          {navItem("/dashboard", "Dashboard", LayoutDashboard)}
          {navItem("/course", "Courses", BookOpen)}
          {navItem("/task", "Tasks", ClipboardList)}
        </nav>

        {/* Bottom */}
        <div className="mt-auto space-y-3">

          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 border rounded-lg dark:border-gray-700 hover:scale-105 active:scale-95 transition"
          >
            {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
            {!collapsed && (theme === "light" ? "Тёмная" : "Светлая")}
          </button>

          <button className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:scale-105 active:scale-95 transition">
            Upgrade
          </button>

        </div>

      </motion.aside>

      {/* Main */}
      <div className="flex-1 flex flex-col">

        {/* Header */}
        <motion.header
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          {...smooth}
          className="h-16 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6"
        >

          <input
            placeholder="Поиск..."
            className="px-4 py-2 border rounded-lg w-72 bg-white dark:bg-gray-900 dark:border-gray-700"
          />

          <div className="flex items-center gap-4">

            <button className="p-2 border rounded-lg dark:border-gray-700 hover:scale-105 transition">
              <Bell size={18} />
            </button>

            <button className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:scale-105 active:scale-95 transition">
              <Plus size={16} />
              Новый
            </button>

            <div className="w-9 h-9 bg-gray-300 dark:bg-gray-700 rounded-full"></div>

          </div>

        </motion.header>

        {/* Content */}
        <main className="p-8 text-gray-900 dark:text-white">
          {children}
        </main>

      </div>
    </div>
  )
}