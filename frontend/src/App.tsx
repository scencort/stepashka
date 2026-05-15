// ─── КОРНЕВОЙ КОМПОНЕНТ ПРИЛОЖЕНИЯ ─────────────────────────────────────────
// App.tsx — единственный компонент между провайдерами (main.tsx) и роутером (router/index.tsx)
// его задача: обернуть Router в BrowserRouter и менять document.title при переходах
//
// ЗАЧЕМ ОТДЕЛЬНЫЙ AppRoutes ВНУТРИ BrowserRouter:
//   useLocation() работает только ВНУТРИ BrowserRouter
//   нельзя вызвать useLocation() в том же компоненте, где рендерится <BrowserRouter>
//   поэтому создаём вложенный компонент AppRoutes который имеет доступ к контексту роутера
//
// КАК ОБНОВЛЯЕТСЯ TITLE:
//   useLocation() возвращает { pathname, search, hash, state, key }
//   useEffect зависит от [pathname] — срабатывает при каждом переходе
//   getPageTitle(pathname) — простой lookup по статическому словарю routes→titles
//   document.title = "Панель | Gradus" — браузер показывает это во вкладке и в истории
//   динамические маршруты (напр. /course/42) обрабатываются отдельно через startsWith
//
// ВЫНОС getPageTitle ЗА КОМПОНЕНТ:
//   это чистая функция — не зависит от стейта и рефов, всегда возвращает одно и то же
//   вынос за компонент означает что она не пересоздаётся при каждом рендере (не нужен useCallback)
import { BrowserRouter, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Router } from "./router";

// базовый заголовок — добавляется через | к каждому тайтлу
const BASE_TITLE = "Gradus";

// возвращает читабельный заголовок по pathname
// отдельная обработка для /course/... — там путь динамический
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

  // если маршрут не найден — показываем дефолтный заголовок
  return titles[pathname] || "Платформа обучения";
}

// внутренний компонент — нужен чтобы использовать useLocation внутри BrowserRouter
function AppRoutes() {
  const location = useLocation();

  // каждый раз при смене pathname обновляем title документа
  useEffect(() => {
    const pageTitle = getPageTitle(location.pathname);
    document.title = `${pageTitle} | ${BASE_TITLE}`;
  }, [location.pathname]);

  return <Router />;
}

export default function App() {
  return (
    // BrowserRouter обязательно снаружи — иначе useLocation не работает
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
