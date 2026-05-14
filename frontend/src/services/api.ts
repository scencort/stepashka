// центральный API-слой — вся работа с бэкендом только через этот файл
// поток запроса: api.get/post/patch/delete → request() → routeMappings → backendRequest → fetch
// routeMappings — таблица маршрутов: каждый перехватывает url по строке или regex,
//   может изменить путь, тело или нормализовать ответ перед отдачей компоненту
// backendRequest — низкоуровневый fetch: ставит Authorization заголовок из localStorage,
//   при 401 пробует обновить токен через /auth/refresh, при неудаче → редирект на /login
// нормализаторы toCourse и toPublicUser приводят формат бэкенда к формату фронтенда:
//   fullName→name, priceCents→строка "500 ₽", level:"beginner"→"Начальный" и т.д.
type Role = "student" | "teacher" | "admin";

type PublicUser = {
  id: number;
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string;
};

type NotificationItem = {
  id: number;
  title: string;
  time: string;
};

type Course = {
  id: number;
  title: string;
  lessons: number;
  progress: number;
  type: string;
  students: string;
  rating: string;
  duration: string;
  author: string;
  level: string;
  price: string;
  published?: boolean;
  accessType?: string;
  coverUrl?: string;
  description?: string;
  category?: string;
};

type CourseStep = {
  id: number;
  courseId: number;
  title: string;
  kind: "theory" | "quiz" | "code";
  theoryText: string;
  options: string[];
  correctOption: string;
  codeKeyword: string;
  stepOrder: number;
  xp: number;
};

type StepProgress = {
  courseId: number;
  stepId: number;
  status: "started" | "completed";
  score: number;
  answerText: string;
  attempts: number;
  completedAt: string | null;
};

type AiReview = {
  id: number;
  quality: number;
  correctness: number;
  style: number;
  summary: string;
  createdAt: string;
};

type LoginResult =
  | { kind: "authenticated"; user: PublicUser }
  | { kind: "twoFactorRequired"; pendingToken: string };

type TwoFactorSetup = {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
  issuer: string;
  accountEmail: string;
};

type TwoFactorStatus = {
  enabled: boolean;
  pending: boolean;
};

/* ── Token management — токены хранятся в localStorage ── */

// ключи хранения токенов — используем везде через эти константы, не хардкодим строки
const ACCESS_TOKEN_KEY = "gradus_access_token";
const REFRESH_TOKEN_KEY = "gradus_refresh_token";
// базовый url бэкенда берём из .env (VITE_API_URL), убираем trailing slash
const API_BASE_URL = String(import.meta.env.VITE_API_URL || "").replace(
  /\/+$/,
  "",
);

// возвращает access token из localStorage или null если не залогинен
// используется в backendRequest перед каждым запросом
function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

// возвращает refresh token из localStorage или null
// нужен только в tryRefreshToken() и logout чтобы передать на бэк
function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

// сохраняет оба токена в localStorage
// @param accessToken — короткоживущий JWT (обычно 15 минут), для авторизации запросов
// @param refreshToken — долгоживущий токен (30 дней), для обновления access
function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

// удаляет оба токена — вызывается при logout или если refresh не удался
// после этого пользователь считается незалогиненным
function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

/* ── Backend types ── */

type BackendUser = {
  id: number;
  email: string;
  fullName: string;
  role: Role;
  status: string;
  avatarUrl?: string;
};

type BackendAuthResponse = {
  user: BackendUser;
  accessToken: string;
  refreshToken: string;
};

// нормализует пользователя из бэкенда — fullName → name (фронт ждёт "name", бэк отдаёт "fullName")
// вызывается при логине, регистрации, /auth/me и 2fa-верификации
function toPublicUser(user: BackendUser): PublicUser {
  return {
    id: user.id,
    name: user.fullName,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl || "",
  };
}

// нормализует курс из каталога бэкенда в формат Course для фронта
// priceCents=0 → "Бесплатно", иначе делим на 100 и добавляем знак рубля
// durationHours → количество уроков (грубо: 1 урок = 2 часа, минимум 1)
// level на английском ("beginner") или русском ("начальный") — оба поддерживаются
// вызывается при GET /courses (каталог) и GET /courses/:id
function toCourse(catalogItem: {
  id: number;
  title: string;
  category: string;
  description?: string;
  studentsCount: number;
  rating: string | number;
  durationHours: number;
  teacherName: string | null;
  level: string;
  priceCents: number;
  accessType?: string;
  coverUrl?: string;
}): Course {
  const duration = Math.max(0, Number(catalogItem.durationHours || 0));
  const lessons = Math.max(1, Math.round(duration / 2) || 1);
  const priceCents = Math.max(0, Number(catalogItem.priceCents || 0));
  const price =
    priceCents === 0 ? "Бесплатно" : `${Math.round(priceCents / 100)} ₽`;
  const category = (catalogItem.category || "").toLowerCase();
  const normalizedType = category.includes("front")
    ? "Frontend"
    : category.includes("back")
      ? "Backend"
      : "General";

  const levelMap: Record<string, string> = {
    beginner: "Начальный",
    intermediate: "Средний",
    advanced: "Продвинутый",
    начальный: "Начальный",
    средний: "Средний",
    продвинутый: "Продвинутый",
  };
  const normalizedLevel =
    levelMap[String(catalogItem.level || "").toLowerCase()] || "Начальный";

  return {
    id: catalogItem.id,
    title: catalogItem.title,
    lessons,
    progress: 0,
    type: normalizedType,
    students: String(catalogItem.studentsCount || 0),
    rating: String(catalogItem.rating || "0.0"),
    duration: `${duration}ч`,
    author: catalogItem.teacherName || "Команда Gradus",
    level: normalizedLevel,
    price,
    published: true,
    accessType: catalogItem.accessType || "open",
    coverUrl: catalogItem.coverUrl || "",
    description: catalogItem.description || "",
    category: catalogItem.category || "",
  };
}

/* ── HTTP client with token refresh ── */

// базовый fetch с авторизацией и автообновлением токена
// при 401 пробует refresh — если не вышло, редиректит на /login
// исключения: auth-маршруты и /auth/refresh не триггерят повторный refresh
// allowRefresh=false используется при повторном вызове после успешного refresh
//   чтобы не уйти в бесконечную рекурсию
async function backendRequest<T>(
  path: string,
  init: RequestInit = {},
  allowRefresh = true,
): Promise<T> {
  const headers = new Headers(init.headers || {});
  // Content-Type ставим автоматически если есть тело запроса
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  // берём access token из localStorage и добавляем в Authorization заголовок
  const accessToken = getAccessToken();
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  // credentials:"include" нужен для cookie-сессий (некоторые эндпоинты бэка их используют)
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  // 401 = токен протух → пробуем обновить через refresh token и повторить запрос
  if (
    response.status === 401 &&
    allowRefresh &&
    path !== "/auth/refresh" &&
    path !== "/auth/login" &&
    path !== "/auth/register"
  ) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      // повторяем исходный запрос с новым access token, allowRefresh=false
      return backendRequest<T>(path, init, false);
    }
    // refresh не помог — выкидываем на логин (но не если уже на нём)
    if (
      typeof window !== "undefined" &&
      !window.location.pathname.startsWith("/login")
    ) {
      window.location.href = "/login";
    }
  }

  if (!response.ok) {
    // пытаемся вытащить читабельное сообщение из тела ответа
    // бэк может вернуть { error: "..." } или { detail: "..." } или массив FastAPI-ошибок
    let message = "Ошибка запроса";
    try {
      const data = (await response.json()) as {
        error?: string;
        detail?: string | unknown[];
      };
      if (data?.error) {
        message = data.error;
      } else if (typeof data?.detail === "string") {
        message = data.detail;
      } else if (Array.isArray(data?.detail) && data.detail.length > 0) {
        message =
          (data.detail[0] as { msg?: string }).msg ||
          `Ошибка ${response.status}`;
      }
    } catch {
      message = `Ошибка ${response.status}`;
    }
    throw new Error(message);
  }

  // 204 No Content — бэк ничего не вернул, возвращаем пустой объект
  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

// пробует обновить пару токенов через /auth/refresh
// если refresh token тоже протух или его нет — чистим localStorage и возвращаем false
// вызывается автоматически из backendRequest при получении 401
async function tryRefreshToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    // нет refresh токена — нечего обновлять, чистим хранилище
    clearTokens();
    return false;
  }

  try {
    // используем прямой fetch, а не backendRequest — чтобы не зациклиться
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      clearTokens();
      return false;
    }

    const data = (await response.json()) as BackendAuthResponse;
    if (!data.accessToken || !data.refreshToken) {
      clearTokens();
      return false;
    }
    // успешно обновили — сохраняем оба новых токена в localStorage
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

/* ── Route mapping table — таблица маршрутов с трансформациями ──
   каждый маппинг перехватывает запрос по pattern+method и может:
   - переадресовать на другой URL бэкенда
   - нормализовать данные (toCourse, toPublicUser)
   - реализовать особую логику (например авторизация возвращает LoginResult)
*/

type RouteMapping = {
  pattern: string | RegExp;
  method?: string;
  transform: <T>(
    path: string,
    method: string,
    rawBody?: unknown,
  ) => Promise<T>;
};

// прокидывает запрос напрямую на бэкенд без трансформации данных
// @param backendPath — путь на бэкенде (может отличаться от фронтового)
// @param method — HTTP метод: "GET", "POST", "PATCH", "DELETE"
// @param rawBody — тело запроса в виде объекта, будет сериализовано в JSON
// @returns промис с данными типа T
function passthrough<T>(
  backendPath: string,
  method: string,
  rawBody?: unknown,
): Promise<T> {
  const init: RequestInit = { method };
  if (rawBody !== undefined) {
    init.body = JSON.stringify(rawBody);
  }
  return backendRequest<T>(backendPath, init);
}

// извлекает сегмент пути по индексу — используется для вытаскивания id из url
// пример: pathId("/teacher/courses/42/steps", 3) → "42"
// @param path — полный url путь, например "/admin/users/5/role"
// @param index — индекс сегмента (после split по "/"), считая с 0
function pathId(path: string, index: number): string {
  return path.split("/")[index];
}

const routeMappings: RouteMapping[] = [
  // ── Auth ──
  {
    pattern: "/auth/login",
    method: "POST",
    transform: async <T>(_p: string, _m: string, rawBody?: unknown) => {
      const payload = rawBody as { email: string; password: string };
      const raw = await backendRequest<
        BackendAuthResponse | { twoFactorRequired: true; pendingToken: string }
      >("/auth/login", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if ("twoFactorRequired" in raw && raw.twoFactorRequired) {
        return {
          kind: "twoFactorRequired",
          pendingToken: raw.pendingToken,
        } as T;
      }
      const auth = raw as BackendAuthResponse;
      setTokens(auth.accessToken, auth.refreshToken);
      return {
        kind: "authenticated",
        user: toPublicUser(auth.user),
      } as T;
    },
  },
  {
    pattern: "/auth/2fa/verify",
    method: "POST",
    transform: async <T>(_p: string, _m: string, rawBody?: unknown) => {
      const payload = rawBody as { pendingToken: string; code: string };
      const auth = await backendRequest<BackendAuthResponse>(
        "/auth/2fa/verify",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );
      setTokens(auth.accessToken, auth.refreshToken);
      return toPublicUser(auth.user) as T;
    },
  },
  {
    pattern: "/auth/register",
    method: "POST",
    transform: async <T>(_p: string, _m: string, rawBody?: unknown) => {
      const payload = rawBody as {
        name: string;
        email: string;
        password: string;
      };
      const auth = await backendRequest<BackendAuthResponse>(
        "/auth/register",
        {
          method: "POST",
          body: JSON.stringify({
            fullName: payload.name,
            email: payload.email,
            password: payload.password,
          }),
        },
      );
      setTokens(auth.accessToken, auth.refreshToken);
      return toPublicUser(auth.user) as T;
    },
  },
  {
    pattern: "/auth/logout",
    method: "POST",
    transform: async <T>() => {
      const refreshToken = getRefreshToken();
      const data = await backendRequest<{ success: boolean }>("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      });
      clearTokens();
      return data as T;
    },
  },
  {
    pattern: "/auth/forgot-password",
    method: "POST",
    transform: <T>(_p: string, m: string, rawBody?: unknown) =>
      passthrough<T>("/auth/forgot-password", m, rawBody),
  },
  {
    pattern: "/auth/reset-password",
    method: "POST",
    transform: <T>(_p: string, m: string, rawBody?: unknown) =>
      passthrough<T>("/auth/reset-password", m, rawBody),
  },
  {
    pattern: "/auth/me",
    method: "GET",
    transform: async <T>() => {
      if (!getAccessToken() && !getRefreshToken()) {
        return null as T;
      }
      const user = await backendRequest<BackendUser>("/auth/me");
      return toPublicUser(user) as T;
    },
  },

  // ── Dashboard ──
  {
    pattern: "/dashboard",
    method: "GET",
    transform: <T>() => backendRequest<T>("/student/dashboard"),
  },
  {
    pattern: "/student/weekly-goal",
    method: "PATCH",
    transform: <T>(_p: string, m: string, rawBody?: unknown) =>
      passthrough<T>("/student/weekly-goal", m, rawBody),
  },

  // ── Courses / Catalog ──
  {
    pattern: "/courses",
    method: "GET",
    transform: async <T>() => {
      const data = await backendRequest<
        Array<{
          id: number;
          title: string;
          category: string;
          studentsCount: number;
          rating: string | number;
          durationHours: number;
          teacherName: string | null;
          level: string;
          priceCents: number;
          accessType?: string;
        }>
      >("/catalog");
      return data.map(toCourse) as T;
    },
  },
  {
    pattern: "/my-progress",
    method: "GET",
    transform: <T>() => backendRequest<T>("/student/my-progress"),
  },
  {
    pattern: "/landing/stats",
    method: "GET",
    transform: <T>() => backendRequest<T>("/public/stats"),
  },
  {
    pattern: /^\/courses\/\d+\/enroll$/,
    method: "POST",
    transform: <T>(p: string) =>
      passthrough<T>(`/student/enroll/${pathId(p, 2)}`, "POST", {}),
  },
  {
    pattern: /^\/courses\/\d+\/steps$/,
    method: "GET",
    transform: <T>(p: string) =>
      backendRequest<T>(`/student/courses/${pathId(p, 2)}/steps`),
  },
  {
    pattern: /^\/steps\/\d+\/check$/,
    method: "POST",
    transform: <T>(p: string, m: string, rawBody?: unknown) =>
      passthrough<T>(`/student/steps/${pathId(p, 2)}/check`, m, rawBody),
  },
  {
    pattern: /^\/courses\/\d+\/detail$/,
    method: "GET",
    transform: <T>(p: string) =>
      backendRequest<T>(`/courses/${pathId(p, 2)}`),
  },
  {
    pattern: /^\/courses\/\d+\/enrollment-status$/,
    method: "GET",
    transform: <T>(p: string) =>
      backendRequest<T>(
        `/student/courses/${pathId(p, 2)}/enrollment-status`,
      ),
  },
  {
    pattern: /^\/courses\/\d+\/request-enrollment$/,
    method: "POST",
    transform: <T>(p: string, m: string, rawBody?: unknown) =>
      passthrough<T>(
        `/student/courses/${pathId(p, 2)}/request-enrollment`,
        m,
        rawBody,
      ),
  },
  {
    pattern: /^\/courses\/\d+$/,
    method: "GET",
    transform: <T>(p: string) =>
      backendRequest<T>(`/courses/${pathId(p, 2)}`),
  },

  // ── Account ──
  {
    pattern: "/account/profile",
    method: "GET",
    transform: <T>() => backendRequest<T>("/account/profile"),
  },
  {
    pattern: "/account/profile",
    method: "PATCH",
    transform: <T>(_p: string, m: string, rawBody?: unknown) => {
      const payload = rawBody as Record<string, unknown>;
      return passthrough<T>("/account/profile", m, {
        fullName: payload.name,
        email: payload.email,
        phone: payload.phone,
        bio: payload.bio,
        timezone: payload.timezone,
        language: payload.language,
        emailNotifications: payload.emailNotifications,
        marketingNotifications: payload.marketingNotifications,
        avatarUrl: payload.avatarUrl,
      });
    },
  },
  {
    pattern: "/account/change-password",
    method: "POST",
    transform: <T>(_p: string, m: string, rawBody?: unknown) =>
      passthrough<T>("/account/change-password", m, rawBody),
  },
  {
    pattern: "/account/confirm-email-change",
    method: "POST",
    transform: <T>(_p: string, m: string, rawBody?: unknown) =>
      passthrough<T>("/account/confirm-email-change", m, rawBody),
  },
  {
    pattern: "/account/sessions",
    method: "GET",
    transform: <T>() => backendRequest<T>("/account/sessions"),
  },
  {
    pattern: /^\/account\/sessions\/\d+$/,
    method: "DELETE",
    transform: <T>(p: string) =>
      passthrough<T>(`/account/sessions/${pathId(p, 3)}`, "DELETE"),
  },
  {
    pattern: "/account/logout-all",
    method: "POST",
    transform: <T>() => {
      const refreshToken = getRefreshToken();
      return passthrough<T>("/account/logout-all", "POST", {
        keepCurrentRefreshToken: refreshToken,
      });
    },
  },
  {
    pattern: "/account/2fa/status",
    method: "GET",
    transform: <T>() => backendRequest<T>("/account/2fa/status"),
  },
  {
    pattern: "/account/2fa/setup",
    method: "POST",
    transform: <T>() => passthrough<T>("/account/2fa/setup", "POST", {}),
  },
  {
    pattern: "/account/2fa/verify",
    method: "POST",
    transform: <T>(_p: string, m: string, rawBody?: unknown) =>
      passthrough<T>("/account/2fa/verify", m, rawBody),
  },
  {
    pattern: "/account/2fa/disable",
    method: "POST",
    transform: <T>(_p: string, m: string, rawBody?: unknown) =>
      passthrough<T>("/account/2fa/disable", m, rawBody),
  },
  {
    pattern: "/account/2fa/cancel",
    method: "POST",
    transform: <T>() => passthrough<T>("/account/2fa/cancel", "POST", {}),
  },
  // ── AI ──
  {
    pattern: "/ai/chat",
    method: "POST",
    transform: <T>(_p: string, m: string, rawBody?: unknown) =>
      passthrough<T>("/ai/chat", m, rawBody),
  },
  {
    pattern: "/ai-review/check",
    method: "POST",
    transform: <T>(_p: string, m: string, rawBody?: unknown) =>
      passthrough<T>("/ai/review/check", m, rawBody),
  },
  {
    pattern: "/ai/review/check",
    method: "POST",
    transform: <T>(_p: string, m: string, rawBody?: unknown) =>
      passthrough<T>("/ai/review/check", m, rawBody),
  },
  {
    pattern: "/ai-review/history",
    method: "GET",
    transform: <T>() => backendRequest<T>("/ai/review/history"),
  },
  {
    pattern: "/ai/review/history",
    method: "GET",
    transform: <T>() => backendRequest<T>("/ai/review/history"),
  },
  {
    pattern: "/ai/insights",
    method: "POST",
    transform: <T>(_p: string, m: string, rawBody?: unknown) =>
      passthrough<T>("/ai/insights", m, rawBody),
  },
  {
    pattern: "/ai/daily-plan",
    method: "POST",
    transform: <T>(_p: string, m: string, rawBody?: unknown) =>
      passthrough<T>("/ai/daily-plan", m, rawBody),
  },
  {
    pattern: "/ai/faq",
    method: "POST",
    transform: <T>(_p: string, m: string, rawBody?: unknown) =>
      passthrough<T>("/ai/faq", m, rawBody),
  },

  // ── Teacher ──
  {
    pattern: "/teacher/overview",
    method: "GET",
    transform: <T>() => backendRequest<T>("/teacher/overview"),
  },
  {
    pattern: "/teacher/courses",
    method: "GET",
    transform: <T>() => backendRequest<T>("/teacher/courses"),
  },
  {
    pattern: "/teacher/courses",
    method: "POST",
    transform: <T>(_p: string, m: string, rawBody?: unknown) =>
      passthrough<T>("/teacher/courses", m, rawBody),
  },
  {
    pattern: /^\/teacher\/courses\/\d+$/,
    method: "PATCH",
    transform: <T>(p: string, m: string, rawBody?: unknown) =>
      passthrough<T>(`/teacher/courses/${pathId(p, 3)}`, m, rawBody),
  },
  {
    pattern: /^\/teacher\/courses\/\d+\/publish$/,
    method: "PATCH",
    transform: <T>(p: string, m: string, rawBody?: unknown) =>
      passthrough<T>(
        `/teacher/courses/${pathId(p, 3)}/publish`,
        m,
        rawBody,
      ),
  },
  {
    pattern: /^\/teacher\/courses\/\d+\/structure$/,
    method: "GET",
    transform: <T>(p: string) =>
      backendRequest<T>(`/teacher/courses/${pathId(p, 3)}/structure`),
  },
  {
    pattern: /^\/teacher\/courses\/\d+\/enrollment-requests$/,
    method: "GET",
    transform: <T>(p: string) =>
      backendRequest<T>(
        `/teacher/courses/${pathId(p, 3)}/enrollment-requests`,
      ),
  },
  {
    pattern: /^\/teacher\/enrollment-requests\/\d+$/,
    method: "PATCH",
    transform: <T>(p: string, m: string, rawBody?: unknown) =>
      passthrough<T>(
        `/teacher/enrollment-requests/${pathId(p, 3)}`,
        m,
        rawBody,
      ),
  },
  {
    pattern: /^\/teacher\/courses\/\d+\/modules$/,
    method: "POST",
    transform: <T>(p: string, m: string, rawBody?: unknown) =>
      passthrough<T>(
        `/teacher/courses/${pathId(p, 3)}/modules`,
        m,
        rawBody,
      ),
  },
  {
    pattern: /^\/teacher\/courses\/\d+\/lessons$/,
    method: "POST",
    transform: <T>(p: string, m: string, rawBody?: unknown) =>
      passthrough<T>(
        `/teacher/courses/${pathId(p, 3)}/lessons`,
        m,
        rawBody,
      ),
  },
  {
    pattern: /^\/teacher\/courses\/\d+\/steps$/,
    method: "POST",
    transform: <T>(p: string, m: string, rawBody?: unknown) =>
      passthrough<T>(
        `/teacher/courses/${pathId(p, 3)}/steps`,
        m,
        rawBody,
      ),
  },
  {
    pattern: /^\/teacher\/modules\/\d+$/,
    method: "PATCH",
    transform: <T>(p: string, m: string, rawBody?: unknown) =>
      passthrough<T>(`/teacher/modules/${pathId(p, 3)}`, m, rawBody),
  },
  {
    pattern: /^\/teacher\/lessons\/\d+$/,
    method: "PATCH",
    transform: <T>(p: string, m: string, rawBody?: unknown) =>
      passthrough<T>(`/teacher/lessons/${pathId(p, 3)}`, m, rawBody),
  },
  {
    pattern: /^\/teacher\/steps\/\d+$/,
    method: "PATCH",
    transform: <T>(p: string, m: string, rawBody?: unknown) =>
      passthrough<T>(`/teacher/steps/${pathId(p, 3)}`, m, rawBody),
  },
  {
    pattern: /^\/teacher\/steps\/\d+$/,
    method: "DELETE",
    transform: <T>(p: string) =>
      passthrough<T>(`/teacher/steps/${pathId(p, 3)}`, "DELETE"),
  },
  {
    pattern: "/teacher/analytics",
    method: "GET",
    transform: <T>() => backendRequest<T>("/teacher/analytics"),
  },
  {
    pattern: "/assignments",
    method: "GET",
    transform: <T>() => backendRequest<T>("/assignments"),
  },

  // ── Admin ──
  {
    pattern: "/admin/overview",
    method: "GET",
    transform: <T>() => backendRequest<T>("/admin/overview"),
  },
  {
    pattern: "/admin/courses",
    method: "GET",
    transform: <T>() => backendRequest<T>("/admin/courses"),
  },
  {
    pattern: /^\/admin\/courses\/\d+$/,
    method: "PATCH",
    transform: <T>(p: string, m: string, rawBody?: unknown) =>
      passthrough<T>(`/admin/courses/${pathId(p, 3)}`, m, rawBody),
  },
  {
    pattern: /^\/admin\/courses\/\d+$/,
    method: "DELETE",
    transform: <T>(p: string) =>
      passthrough<T>(`/admin/courses/${pathId(p, 3)}`, "DELETE"),
  },
  {
    pattern: "/admin/users",
    method: "GET",
    transform: <T>() => backendRequest<T>("/admin/users"),
  },
  {
    pattern: /^\/admin\/users\/\d+\/role$/,
    method: "PATCH",
    transform: <T>(p: string, m: string, rawBody?: unknown) =>
      passthrough<T>(`/admin/users/${pathId(p, 3)}/role`, m, rawBody),
  },
  {
    pattern: /^\/admin\/users\/\d+\/ban$/,
    method: "PATCH",
    transform: <T>(p: string, m: string, rawBody?: unknown) =>
      passthrough<T>(`/admin/users/${pathId(p, 3)}/ban`, m, rawBody),
  },
  {
    pattern: /^\/admin\/users\/\d+$/,
    method: "DELETE",
    transform: <T>(p: string) =>
      passthrough<T>(`/admin/users/${pathId(p, 3)}`, "DELETE"),
  },
  {
    pattern: "/admin/analytics",
    method: "GET",
    transform: <T>() => backendRequest<T>("/admin/analytics"),
  },
  {
    pattern: "/admin/finance",
    method: "GET",
    transform: <T>() => backendRequest<T>("/admin/finance"),
  },
  {
    pattern: "/admin/platform",
    method: "GET",
    transform: <T>() => backendRequest<T>("/admin/platform"),
  },
  {
    pattern: /^\/admin\/feature-flags\//,
    method: "PATCH",
    transform: <T>(p: string, m: string, rawBody?: unknown) =>
      passthrough<T>(p, m, rawBody),
  },

  // ── Roles ──
  {
    pattern: "/roles-members",
    method: "GET",
    transform: <T>() => backendRequest<T>("/roles-members"),
  },
  {
    pattern: /^\/roles-members\/\d+$/,
    method: "PATCH",
    transform: <T>(p: string, m: string, rawBody?: unknown) =>
      passthrough<T>(`/roles-members/${pathId(p, 2)}`, m, rawBody),
  },
  {
    pattern: /^\/roles-members\/\d+$/,
    method: "DELETE",
    transform: <T>(p: string) =>
      passthrough<T>(`/roles-members/${pathId(p, 2)}`, "DELETE"),
  },

  // ── Analytics (prefix match) ──
  {
    pattern: /^\/analytics/,
    method: "GET",
    transform: <T>(p: string) => backendRequest<T>(p),
  },

  // ── Feedback ──
  {
    pattern: "/feedback",
    method: "GET",
    transform: <T>() => backendRequest<T>("/feedback"),
  },
  {
    pattern: "/feedback",
    method: "POST",
    transform: <T>(_p: string, m: string, rawBody?: unknown) =>
      passthrough<T>("/feedback", m, rawBody),
  },
  {
    pattern: /^\/feedback\/\d+\/status$/,
    method: "PATCH",
    transform: <T>(p: string, m: string, rawBody?: unknown) =>
      passthrough<T>(`/feedback/${pathId(p, 2)}/status`, m, rawBody || {}),
  },
  {
    pattern: /^\/feedback\/\d+\/reply$/,
    method: "POST",
    transform: <T>(p: string, m: string, rawBody?: unknown) =>
      passthrough<T>(`/feedback/${pathId(p, 2)}/reply`, m, rawBody),
  },
  {
    pattern: /^\/feedback\/\d+$/,
    method: "DELETE",
    transform: <T>(p: string) =>
      passthrough<T>(`/feedback/${pathId(p, 2)}`, "DELETE"),
  },

  // ── Notifications ──
  {
    pattern: "/notifications",
    method: "GET",
    transform: <T>() => backendRequest<T>("/notifications"),
  },
  {
    pattern: "/notifications",
    method: "DELETE",
    transform: <T>() => passthrough<T>("/notifications", "DELETE"),
  },
];

/* ── Request router ── */

// главный роутер запросов — ищет подходящий маппинг и вызывает его трансформер
// если маппинг не найден — пропускает запрос напрямую на бэкенд (fallback)
// тело десериализуем из JSON обратно в объект чтобы передать в transform()
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const method = (options?.method || "GET").toUpperCase();
  // body приходит уже сериализованным (JSON.stringify), распаковываем обратно
  const rawBody = options?.body ? JSON.parse(String(options.body)) : undefined;

  // перебираем маппинги в порядке объявления — первый подходящий выигрывает
  for (const route of routeMappings) {
    // если у маппинга задан метод — проверяем совпадение
    if (route.method && route.method !== method) continue;

    // паттерн может быть строкой (точное совпадение) или RegExp (гибкий матч)
    if (typeof route.pattern === "string") {
      if (route.pattern !== path) continue;
    } else {
      if (!route.pattern.test(path)) continue;
    }

    // нашли маппинг — отдаём ему управление
    return route.transform<T>(path, method, rawBody);
  }

  // ── Fallback: маппинг не нашёлся — идём напрямую на бэкенд ──
  return await backendRequest<T>(path, {
    method,
    ...(rawBody ? { body: JSON.stringify(rawBody) } : {}),
  });
}

/* ── Public API — публичный интерфейс который используется во всех компонентах ── */
// все 4 метода сериализуют тело в JSON и вызывают request() → routeMappings → backendRequest
// типовой вызов: api.post<LoginResult>("/auth/login", { email, password })
export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export { getAccessToken, API_BASE_URL, clearTokens };

export type {
  PublicUser,
  Role,
  Course,
  CourseStep,
  StepProgress,
  NotificationItem,
  AiReview,
  LoginResult,
  TwoFactorSetup,
  TwoFactorStatus,
};
