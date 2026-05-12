import { BrowserRouter, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Router } from "./router";

const BASE_TITLE = "Gradus";

function getPageTitle(pathname: string) {
  if (pathname.startsWith("/course/")) {
    return "Прохождение курса";
  }

  const titles: Record<string, string> = {
    "/": "Главная",
    "/login": "Вход",
    "/register": "Регистрация",
    "/forgot-password": "Восстановление пароля",
    "/reset-password": "Сброс пароля",
    "/dashboard": "Панель",
    "/course": "Курсы",
    "/task": "AI Code Review",
    "/ai-review": "AI-проверка",
    "/analytics": "Аналитика",
    "/roles-access": "Роли и доступ",
    "/feedback": "Обратная связь",
    "/help-center": "Центр помощи",
    "/account": "Профиль и настройки",
    "/teacher": "Кабинет преподавателя",
    "/admin": "Админ-панель",
  };

  return titles[pathname] || "Платформа обучения";
}

function AppRoutes() {
  const location = useLocation();

  useEffect(() => {
    const pageTitle = getPageTitle(location.pathname);
    document.title = `${pageTitle} | ${BASE_TITLE}`;
  }, [location.pathname]);

  return <Router />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
