import { Routes, Route } from "react-router-dom"

import Landing from "../pages/Landing"
import Dashboard from "../pages/Dashboard"
import Course from "../pages/Course"
import Task from "../pages/Task"
import Login from "../pages/Login"
import Register from "../pages/Register"

export const Router = () => {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/course" element={<Course />} />
      <Route path="/task" element={<Task />} />
    </Routes>
  )
}