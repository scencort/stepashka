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

/* ── Token management ── */

const ACCESS_TOKEN_KEY = "gradus_access_token";
const REFRESH_TOKEN_KEY = "gradus_refresh_token";
const API_BASE_URL = String(import.meta.env.VITE_API_URL || "").replace(
  /\/+$/,
  "",
);

function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

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

type BackendTwoFactorChallengeResponse = {
  requiresTwoFactor: true;
  challengeId: string;
  message: string;
  devCode?: string | null;
};

function toPublicUser(user: BackendUser): PublicUser {
  return {
    id: user.id,
    name: user.fullName,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl || "",
  };
}

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

async function backendRequest<T>(
  path: string,
  init: RequestInit = {},
  allowRefresh = true,
): Promise<T> {
  const headers = new Headers(init.headers || {});
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  const accessToken = getAccessToken();
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  if (
    response.status === 401 &&
    allowRefresh &&
    path !== "/auth/refresh" &&
    path !== "/auth/login" &&
    path !== "/auth/register"
  ) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      return backendRequest<T>(path, init, false);
    }
    if (
      typeof window !== "undefined" &&
      !window.location.pathname.startsWith("/login")
    ) {
      window.location.href = "/login";
    }
  }

  if (!response.ok) {
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

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

async function tryRefreshToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearTokens();
    return false;
  }

  try {
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
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

/* ── Request router ── */

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const method = (options?.method || "GET").toUpperCase();
  const rawBody = options?.body ? JSON.parse(String(options.body)) : undefined;

  // ── Auth ──

  if (path === "/auth/login" && method === "POST") {
    const payload = rawBody as { email: string; password: string };
    const auth = await backendRequest<
      BackendAuthResponse | BackendTwoFactorChallengeResponse
    >("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if ((auth as BackendTwoFactorChallengeResponse).requiresTwoFactor) {
      return auth as T;
    }

    const success = auth as BackendAuthResponse;
    setTokens(success.accessToken, success.refreshToken);
    return toPublicUser(success.user) as T;
  }

  if (path === "/auth/2fa/verify" && method === "POST") {
    const payload = rawBody as { challengeId: string; code: string };
    const auth = await backendRequest<BackendAuthResponse>(
      "/auth/2fa/verify",
      { method: "POST", body: JSON.stringify(payload) },
    );
    setTokens(auth.accessToken, auth.refreshToken);
    return toPublicUser(auth.user) as T;
  }

  if (path === "/auth/register" && method === "POST") {
    const payload = rawBody as {
      name: string;
      email: string;
      password: string;
    };
    const auth = await backendRequest<BackendAuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        fullName: payload.name,
        email: payload.email,
        password: payload.password,
      }),
    });
    setTokens(auth.accessToken, auth.refreshToken);
    return toPublicUser(auth.user) as T;
  }

  if (path === "/auth/logout" && method === "POST") {
    const refreshToken = getRefreshToken();
    const data = await backendRequest<{ success: boolean }>("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
    clearTokens();
    return data as T;
  }

  if (path === "/auth/forgot-password" && method === "POST") {
    return await backendRequest<T>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(rawBody),
    });
  }

  if (path === "/auth/reset-password" && method === "POST") {
    return await backendRequest<T>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(rawBody),
    });
  }

  if (path === "/auth/me" && method === "GET") {
    if (!getAccessToken() && !getRefreshToken()) {
      return null as T;
    }
    const user = await backendRequest<BackendUser>("/auth/me");
    return toPublicUser(user) as T;
  }

  // ── Dashboard ──

  if (path === "/dashboard" && method === "GET") {
    return await backendRequest<T>("/student/dashboard");
  }

  if (path === "/student/weekly-goal" && method === "PATCH") {
    return await backendRequest<T>("/student/weekly-goal", {
      method: "PATCH",
      body: JSON.stringify(rawBody),
    });
  }

  // ── Courses / Catalog ──

  if (path === "/courses" && method === "GET") {
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
  }

  if (path === "/my-progress" && method === "GET") {
    return await backendRequest<T>("/student/my-progress");
  }

  if (path === "/landing/stats" && method === "GET") {
    return await backendRequest<T>("/public/stats");
  }

  if (/^\/courses\/\d+\/enroll$/.test(path) && method === "POST") {
    const courseId = path.split("/")[2];
    return await backendRequest<T>(`/student/enroll/${courseId}`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  }

  if (/^\/courses\/\d+\/steps$/.test(path) && method === "GET") {
    const courseId = path.split("/")[2];
    return await backendRequest<T>(`/student/courses/${courseId}/steps`);
  }

  if (/^\/steps\/\d+\/check$/.test(path) && method === "POST") {
    const stepId = path.split("/")[2];
    return await backendRequest<T>(`/student/steps/${stepId}/check`, {
      method: "POST",
      body: JSON.stringify(rawBody),
    });
  }

  if (/^\/courses\/\d+\/detail$/.test(path) && method === "GET") {
    const courseId = path.split("/")[2];
    return await backendRequest<T>(`/courses/${courseId}`);
  }

  if (/^\/courses\/\d+\/enrollment-status$/.test(path) && method === "GET") {
    const courseId = path.split("/")[2];
    return await backendRequest<T>(
      `/student/courses/${courseId}/enrollment-status`,
    );
  }

  if (/^\/courses\/\d+\/request-enrollment$/.test(path) && method === "POST") {
    const courseId = path.split("/")[2];
    return await backendRequest<T>(
      `/student/courses/${courseId}/request-enrollment`,
      { method: "POST", body: JSON.stringify(rawBody) },
    );
  }

  if (/^\/courses\/\d+$/.test(path) && method === "GET") {
    const courseId = path.split("/")[2];
    return await backendRequest<T>(`/courses/${courseId}`);
  }

  // ── Account ──

  if (path === "/account/profile" && method === "GET") {
    return await backendRequest<T>("/account/profile");
  }

  if (path === "/account/profile" && method === "PATCH") {
    const payload = rawBody as Record<string, unknown>;
    return await backendRequest<T>("/account/profile", {
      method: "PATCH",
      body: JSON.stringify({
        fullName: payload.name,
        email: payload.email,
        phone: payload.phone,
        bio: payload.bio,
        timezone: payload.timezone,
        language: payload.language,
        emailNotifications: payload.emailNotifications,
        marketingNotifications: payload.marketingNotifications,
        avatarUrl: payload.avatarUrl,
      }),
    });
  }

  if (path === "/account/change-password" && method === "POST") {
    return await backendRequest<T>("/account/change-password", {
      method: "POST",
      body: JSON.stringify(rawBody),
    });
  }

  if (path === "/account/confirm-email-change" && method === "POST") {
    return await backendRequest<T>("/account/confirm-email-change", {
      method: "POST",
      body: JSON.stringify(rawBody),
    });
  }

  if (path === "/account/sessions" && method === "GET") {
    return await backendRequest<T>("/account/sessions");
  }

  if (path.startsWith("/account/sessions/") && method === "DELETE") {
    const id = path.split("/")[3];
    return await backendRequest<T>(`/account/sessions/${id}`, {
      method: "DELETE",
    });
  }

  if (path === "/account/logout-all" && method === "POST") {
    const refreshToken = getRefreshToken();
    return await backendRequest<T>("/account/logout-all", {
      method: "POST",
      body: JSON.stringify({ keepCurrentRefreshToken: refreshToken }),
    });
  }

  if (path === "/account/2fa/request-enable" && method === "POST") {
    return await backendRequest<T>("/account/2fa/request-enable", {
      method: "POST",
      body: JSON.stringify({}),
    });
  }

  if (path === "/account/2fa/confirm-enable" && method === "POST") {
    return await backendRequest<T>("/account/2fa/confirm-enable", {
      method: "POST",
      body: JSON.stringify(rawBody),
    });
  }

  if (path === "/account/2fa/disable" && method === "POST") {
    return await backendRequest<T>("/account/2fa/disable", {
      method: "POST",
      body: JSON.stringify(rawBody),
    });
  }

  // ── AI ──

  if (path === "/ai/chat" && method === "POST") {
    return await backendRequest<T>("/ai/chat", {
      method: "POST",
      body: JSON.stringify(rawBody),
    });
  }

  if (
    (path === "/ai-review/check" || path === "/ai/review/check") &&
    method === "POST"
  ) {
    return await backendRequest<T>("/ai/review/check", {
      method: "POST",
      body: JSON.stringify(rawBody),
    });
  }

  if (
    (path === "/ai-review/history" || path === "/ai/review/history") &&
    method === "GET"
  ) {
    return await backendRequest<T>("/ai/review/history");
  }

  if (path === "/ai/insights" && method === "POST") {
    return await backendRequest<T>("/ai/insights", {
      method: "POST",
      body: JSON.stringify(rawBody),
    });
  }

  if (path === "/ai/daily-plan" && method === "POST") {
    return await backendRequest<T>("/ai/daily-plan", {
      method: "POST",
      body: JSON.stringify(rawBody),
    });
  }

  if (path === "/ai/faq" && method === "POST") {
    return await backendRequest<T>("/ai/faq", {
      method: "POST",
      body: JSON.stringify(rawBody),
    });
  }

  // ── Teacher ──

  if (path === "/teacher/overview" && method === "GET") {
    return await backendRequest<T>("/teacher/overview");
  }

  if (path === "/teacher/courses" && method === "GET") {
    return await backendRequest<T>("/teacher/courses");
  }

  if (path === "/teacher/courses" && method === "POST") {
    return await backendRequest<T>("/teacher/courses", {
      method: "POST",
      body: JSON.stringify(rawBody),
    });
  }

  if (/^\/teacher\/courses\/\d+$/.test(path) && method === "PATCH") {
    const courseId = path.split("/")[3];
    return await backendRequest<T>(`/teacher/courses/${courseId}`, {
      method: "PATCH",
      body: JSON.stringify(rawBody),
    });
  }

  if (/^\/teacher\/courses\/\d+\/publish$/.test(path) && method === "PATCH") {
    const courseId = path.split("/")[3];
    return await backendRequest<T>(`/teacher/courses/${courseId}/publish`, {
      method: "PATCH",
      body: JSON.stringify(rawBody),
    });
  }

  if (/^\/teacher\/courses\/\d+\/structure$/.test(path) && method === "GET") {
    const courseId = path.split("/")[3];
    return await backendRequest<T>(`/teacher/courses/${courseId}/structure`);
  }

  if (
    /^\/teacher\/courses\/\d+\/enrollment-requests$/.test(path) &&
    method === "GET"
  ) {
    const courseId = path.split("/")[3];
    return await backendRequest<T>(
      `/teacher/courses/${courseId}/enrollment-requests`,
    );
  }

  if (/^\/teacher\/enrollment-requests\/\d+$/.test(path) && method === "PATCH") {
    const requestId = path.split("/")[3];
    return await backendRequest<T>(`/teacher/enrollment-requests/${requestId}`, {
      method: "PATCH",
      body: JSON.stringify(rawBody),
    });
  }

  if (/^\/teacher\/courses\/\d+\/modules$/.test(path) && method === "POST") {
    const courseId = path.split("/")[3];
    return await backendRequest<T>(`/teacher/courses/${courseId}/modules`, {
      method: "POST",
      body: JSON.stringify(rawBody),
    });
  }

  if (/^\/teacher\/courses\/\d+\/lessons$/.test(path) && method === "POST") {
    const courseId = path.split("/")[3];
    return await backendRequest<T>(`/teacher/courses/${courseId}/lessons`, {
      method: "POST",
      body: JSON.stringify(rawBody),
    });
  }

  if (/^\/teacher\/courses\/\d+\/steps$/.test(path) && method === "POST") {
    const courseId = path.split("/")[3];
    return await backendRequest<T>(`/teacher/courses/${courseId}/steps`, {
      method: "POST",
      body: JSON.stringify(rawBody),
    });
  }

  if (/^\/teacher\/steps\/\d+$/.test(path) && method === "PATCH") {
    const stepId = path.split("/")[3];
    return await backendRequest<T>(`/teacher/steps/${stepId}`, {
      method: "PATCH",
      body: JSON.stringify(rawBody),
    });
  }

  if (/^\/teacher\/steps\/\d+$/.test(path) && method === "DELETE") {
    const stepId = path.split("/")[3];
    return await backendRequest<T>(`/teacher/steps/${stepId}`, {
      method: "DELETE",
    });
  }

  if (path === "/teacher/assignments" && method === "POST") {
    return await backendRequest<T>("/teacher/assignments", {
      method: "POST",
      body: JSON.stringify(rawBody),
    });
  }

  if (path === "/teacher/analytics" && method === "GET") {
    return await backendRequest<T>("/teacher/analytics");
  }

  if (path === "/assignments" && method === "GET") {
    return await backendRequest<T>("/assignments");
  }

  // ── Admin ──

  if (path === "/admin/overview" && method === "GET") {
    return await backendRequest<T>("/admin/overview");
  }

  if (path === "/admin/courses" && method === "GET") {
    return await backendRequest<T>("/admin/courses");
  }

  if (/^\/admin\/courses\/\d+$/.test(path) && method === "PATCH") {
    const courseId = path.split("/")[3];
    return await backendRequest<T>(`/admin/courses/${courseId}`, {
      method: "PATCH",
      body: JSON.stringify(rawBody),
    });
  }

  if (/^\/admin\/courses\/\d+$/.test(path) && method === "DELETE") {
    const courseId = path.split("/")[3];
    return await backendRequest<T>(`/admin/courses/${courseId}`, {
      method: "DELETE",
    });
  }

  if (path === "/admin/users" && method === "GET") {
    return await backendRequest<T>("/admin/users");
  }

  if (/^\/admin\/users\/\d+\/role$/.test(path) && method === "PATCH") {
    const userId = path.split("/")[3];
    return await backendRequest<T>(`/admin/users/${userId}/role`, {
      method: "PATCH",
      body: JSON.stringify(rawBody),
    });
  }

  if (/^\/admin\/users\/\d+\/ban$/.test(path) && method === "PATCH") {
    const userId = path.split("/")[3];
    return await backendRequest<T>(`/admin/users/${userId}/ban`, {
      method: "PATCH",
      body: JSON.stringify(rawBody),
    });
  }

  if (/^\/admin\/users\/\d+$/.test(path) && method === "DELETE") {
    const userId = path.split("/")[3];
    return await backendRequest<T>(`/admin/users/${userId}`, {
      method: "DELETE",
    });
  }

  if (path === "/admin/analytics" && method === "GET") {
    return await backendRequest<T>("/admin/analytics");
  }

  if (path === "/admin/finance" && method === "GET") {
    return await backendRequest<T>("/admin/finance");
  }

  if (path === "/admin/platform" && method === "GET") {
    return await backendRequest<T>("/admin/platform");
  }

  if (/^\/admin\/feature-flags\//.test(path) && method === "PATCH") {
    return await backendRequest<T>(path, {
      method: "PATCH",
      body: JSON.stringify(rawBody),
    });
  }

  // ── Roles ──

  if (path === "/roles-members" && method === "GET") {
    return await backendRequest<T>("/roles-members");
  }

  if (/^\/roles-members\/\d+$/.test(path) && method === "PATCH") {
    const userId = path.split("/")[2];
    return await backendRequest<T>(`/roles-members/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(rawBody),
    });
  }

  if (/^\/roles-members\/\d+$/.test(path) && method === "DELETE") {
    const userId = path.split("/")[2];
    return await backendRequest<T>(`/roles-members/${userId}`, {
      method: "DELETE",
    });
  }

  // ── Analytics ──

  if (path.startsWith("/analytics") && method === "GET") {
    return await backendRequest<T>(path);
  }

  // ── Feedback ──

  if (path === "/feedback" && method === "GET") {
    return await backendRequest<T>("/feedback");
  }

  if (path === "/feedback" && method === "POST") {
    return await backendRequest<T>("/feedback", {
      method: "POST",
      body: JSON.stringify(rawBody),
    });
  }

  if (/^\/feedback\/\d+\/status$/.test(path) && method === "PATCH") {
    const ticketId = path.split("/")[2];
    return await backendRequest<T>(`/feedback/${ticketId}/status`, {
      method: "PATCH",
      body: JSON.stringify(rawBody || {}),
    });
  }

  if (/^\/feedback\/\d+\/reply$/.test(path) && method === "POST") {
    const ticketId = path.split("/")[2];
    return await backendRequest<T>(`/feedback/${ticketId}/reply`, {
      method: "POST",
      body: JSON.stringify(rawBody),
    });
  }

  if (/^\/feedback\/\d+$/.test(path) && method === "DELETE") {
    const ticketId = path.split("/")[2];
    return await backendRequest<T>(`/feedback/${ticketId}`, {
      method: "DELETE",
    });
  }

  // ── Notifications ──

  if (path === "/notifications" && method === "GET") {
    return await backendRequest<T>("/notifications");
  }

  // ── Fallback: pass through to backend directly ──
  return await backendRequest<T>(path, {
    method,
    ...(rawBody ? { body: JSON.stringify(rawBody) } : {}),
  });
}

/* ── Public API ── */

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
};
