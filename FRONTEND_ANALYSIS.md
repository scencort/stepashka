# Комплексный анализ интерфейсного модуля образовательной платформы Gradus

## 1. АРХИТЕКТУРА И СТРУКТУРА ИНТЕРФЕЙСНОГО МОДУЛЯ

### 1.1 Иерархия папок и назначение каждого слоя

```
src/
├── pages/                    # Страницы приложения (компоненты верхнего уровня)
│   ├── Landing.tsx          # Главная страница платформы
│   ├── Login.tsx            # Авторизация
│   ├── Register.tsx         # Регистрация
│   ├── ForgotPassword.tsx   # Восстановление пароля
│   ├── ResetPassword.tsx    # Сброс пароля
│   ├── Dashboard.tsx        # Личный кабинет студента (статистика, прогресс)
│   ├── Course.tsx           # Каталог и деталь курса (роутер для подстраниц)
│   ├── CourseEditor.tsx     # Конструктор курса для преподавателей (CRUD шагов)
│   ├── Task.tsx             # AI Code Review интерфейс
│   ├── AiReview.tsx         # Чат с ассистентом AI для проверки эссе
│   ├── Analytics.tsx        # Аналитика для студентов (прогресс, рекомендации)
│   ├── TeacherStudio.tsx    # Кабинет преподавателя (управление курсами)
│   ├── AdminPanel.tsx       # Админ-панель (модерация, управление пользователями, поддержка)
│   ├── Feedback.tsx         # Форма обратной связи
│   ├── HelpCenter.tsx       # Справочный центр
│   ├── AccountSettings.tsx  # Настройки профиля
│   ├── RolesAccess.tsx      # Управление ролями и доступом (legacy, интегрировано в AdminPanel)
│   ├── Privacy.tsx          # Политика конфиденциальности
│   ├── Terms.tsx            # Условия использования
│   ├── NotFound.tsx         # Страница 404
│   └── course/              # Подкомпоненты для страницы Course
│       ├── CourseCatalog.tsx    # Сетка курсов с фильтрацией
│       ├── CourseDetail.tsx     # Информация о курсе
│       ├── CourseStep.tsx       # Интерфейс прохождения отдельного шага
│       └── CourseDiscussion.tsx # Обсуждение курса
│
├── components/              # Переиспользуемые компоненты
│   ├── ui/                  # Базовые UI компоненты (дизайн-система)
│   │   ├── Button.tsx       # Полиморфная кнопка (primary/outline/ghost)
│   │   ├── Card.tsx         # Карточка с тенью и границей
│   │   ├── Modal.tsx        # Модальное окно/диалог
│   │   ├── CodeEditor.tsx   # Редактор кода с подсветкой синтаксиса
│   │   ├── Skeleton.tsx     # Скелетон для загрузки
│   │   └── EmptyState.tsx   # Состояние пустого списка
│   ├── auth/
│   │   └── AuthScreenShell.tsx  # Оболочка для страниц аутентификации
│   ├── BrandLogo.tsx        # Логотип и текст Gradus
│   ├── BinaryGlobe.tsx      # Декоративная анимация глобуса
│   └── ParticleNetwork.tsx  # Декоративная сетка частиц
│
├── layout/                  # Макеты приложения
│   └── MainLayout.tsx       # Основной макет (сайдбар, топбар, уведомления, переключатель темы)
│
├── router/                  # Маршрутизация
│   └── index.tsx            # Конфигурация всех маршрутов с ленивой загрузкой
│
├── features/                # Функциональные модули
│   └── auth/
│       └── ProtectedRoute.tsx   # Компонент защиты маршрутов (RBAC)
│
├── hooks/                   # Custom React hooks
│   └── useToast.tsx         # Hook для уведомлений
│
├── context/                 # React Context (глобальное состояние)
│   ├── ThemeContext.tsx     # Провайдер темы (light/dark mode)
│   └── theme.ts             # Типы и hook для темы
│
├── store/                   # Глобальное состояние приложения
│   └── AppStore.tsx         # Хранилище пользователя, курсов, методов аутентификации
│
├── services/                # Бизнес-логика и API
│   └── api.ts               # Сервис API с маршрутизацией запросов и преобразованием данных
│
├── lib/                     # Утилиты и вспомогательные функции
│   └── api.ts               # Реэкспорт API сервиса (alias для services/api.ts)
│
├── main.tsx                 # Точка входа приложения
├── App.tsx                  # Корневой компонент с BrowserRouter
└── index.css                # Глобальные стили (Tailwind, CSS переменные)
```

### 1.2 Паттерны и подходы к организации

**1. Разделение по слоям ответственности:**
- **Pages** — комплексные экраны с логикой, управляемые маршрутизатором
- **Components** — переиспользуемые UI блоки и компоненты
- **Layout** — обёртки для структуры приложения (сайдбар, хедер)
- **Services/Store** — управление состоянием, API запросы, бизнес-логика
- **Hooks/Context** — реактивное управление состоянием

**2. Ленивая загрузка страниц:**
Все страницы загружаются через `React.lazy()` с `Suspense` для оптимизации бандла.

**3. Защита маршрутов:**
Компонент `ProtectedRoute` обеспечивает контроль доступа на основе ролей (RBAC):
- **student** — полный доступ к курсам и аналитике
- **teacher** — создание/редактирование курсов, управление студентами
- **admin** — модерация, управление пользователями, поддержка

---

## 2. ТЕХНОЛОГИЧЕСКИЙ СТЕК FRONTEND

### 2.1 Основные фреймворки и библиотеки

| Технология | Версия | Назначение |
|------------|--------|-----------|
| **React** | 19.2.4 | Основной фреймворк для UI |
| **React Router DOM** | 7.13.2 | Маршрутизация и навигация |
| **TypeScript** | 5.9.3 | Статическая типизация |
| **Vite** | 8.0.1 | Build tool и dev server |
| **Tailwind CSS** | 3.4.19 | Утилитарный CSS фреймворк |

### 2.2 Вспомогательные библиотеки

| Библиотека | Версия | Назначение |
|-----------|--------|-----------|
| **Lucide React** | 1.0.1 | SVG иконки |
| **Framer Motion** | 12.38.0 | Анимации и переходы |
| **Three.js** | 0.184.0 | 3D графика (декоративные элементы) |
| **Prism React Renderer** | 2.4.1 | Подсветка синтаксиса кода |
| **React Easy Crop** | 5.5.7 | Обрезка изображений |

### 2.3 Инструменты разработки и качества кода

| Инструмент | Версия | Назначение |
|-----------|--------|-----------|
| **ESLint** | 9.39.4 | Статический анализ кода |
| **PostCSS** | 8.5.8 | Обработка CSS (Tailwind, autoprefixer) |
| **Autoprefixer** | 10.4.27 | Добавление префиксов для браузеров |

### 2.4 Архитектурные решения

**State Management:**
- **React Context API** для глобального состояния (тема, аутентификация, курсы)
- **useState** для локального состояния компонентов
- Избегание избыточных библиотек (Redux) для простоты

**Styling:**
- **Tailwind CSS** с CSS переменными (`var(--color)`) для динамической смены темы
- **CSS Grid и Flexbox** для адаптивных макетов
- Цветовая палитра: `primary`, `primary-700`, `burgundy`, `success`, `warning`, `error`
- Поддержка `dark:` класса для тёмной темы

**API Management:**
- Собственный HTTP клиент с маршрутизацией
- Автоматический refresh токена при 401 ошибке
- Трансформация данных из бэка на фронт (e.g., `fullName` → `name`)
- Обработка ошибок с пользовательскими сообщениями

---

## 3. РЕАЛИЗОВАННЫЙ ИНТЕРФЕЙСНЫЙ ФУНКЦИОНАЛ

### 3.1 Модули и функции

#### **3.1.1 Аутентификация и авторизация**

**Страницы:**
- **Login.tsx** — вход по email/пароль с валидацией
- **Register.tsx** — регистрация новых пользователей
- **ForgotPassword.tsx** — запрос письма для сброса пароля
- **ResetPassword.tsx** — установка нового пароля по токену

**Механизм:**
- JWT токены (access + refresh) хранятся в localStorage
- Автоматический refresh при истечении доступа
- ProtectedRoute компонент блокирует неавторизованный доступ
- Редирект на /login при истечении сессии

---

#### **3.1.2 Функционал студента**

**Landing.tsx** — главная страница с:
- Информацией о платформе
- Статистикой платформы (кол-во пользователей, курсов)
- CTA кнопками для входа/регистрации
- Декоративной анимацией (Binary Globe, Particle Network)

**Dashboard.tsx** — личный кабинет со:
- Статистикой (активные курсы, серия дней, средний балл, задачи за неделю)
- Еженедельным планом с визуализацией прогресса и редактируемой целью
- Блоком "Я прохожу" для продолжения текущего курса
- Списком активных курсов с полосой прогресса
- Лентой активности (временная шкала событий)
- Оповещением о дедлайнах

**Course.tsx + подкомпоненты** — система курсов:
- **CourseCatalog.tsx** — каталог курсов с фильтрацией по категории/уровню/цене
- **CourseDetail.tsx** — информация о курсе (описание, модули, кол-во шагов)
- **CourseStep.tsx** — интерфейс прохождения шага:
  - **Теория** — текстовый контент
  - **Квиз** — вопрос с вариантами ответов (с автопроверкой)
  - **Код** — редактор кода с возможностью запуска через subprocess (stdin/stdout)
  - **Эссе** — текстовое поле для работ, проверяемых AI
- Система XP за выполненные задания
- Отслеживание прогресса (кол-во пройденных/всего шагов)

**Task.tsx** — AI Code Review:
- Загрузка Python кода для проверки
- Получение отзыва от AI через SSE streaming
- История проверок с оценками

**AiReview.tsx** — чат с AI ассистентом:
- Отправка эссе на проверку
- Потоковое получение оценки и обратной связи
- Парсинг SSE с `data: ` префиксом

**Analytics.tsx** — аналитика для студента:
- Статистика по курсам (прогресс, время обучения)
- Тренды производительности
- Рекомендации от AI

**HelpCenter.tsx** — справочный центр с FAQ

**Feedback.tsx** — форма обратной связи для отправки вопросов поддержке

**AccountSettings.tsx** — настройки профиля:
- Редактирование имени, email, телефона
- Смена пароля
- Управление сессиями
- Настройки уведомлений

---

#### **3.1.3 Функционал преподавателя**

**TeacherStudio.tsx** — кабинет преподавателя со:
- Статистикой (опубликованные, черновики, прогресс студентов, назначенные работы)
- Сеткой курсов с фильтрацией (все, опубликованные, черновики)
- Статусом каждого курса (зелёный — опубликован, жёлтый — на модерации, серый — черновик)
- Возможностью редактирования, публикации, удаления курса

**CourseEditor.tsx** — конструктор курсов для создания/редактирования:
- Многошаговый интерфейс для структуры курса:
  1. **Информация** — название, описание, уровень, категория, цена
  2. **Модули и уроки** — организация структуры (модуль → урок → шаг)
  3. **Шаги** — создание шагов разных типов:
     - **Теория** — текстовое содержимое с подсказкой
     - **Квиз** — вопрос, варианты ответов (с радиокнопками и валидацией корректного ответа)
     - **Код** — задача на кодирование с заранее заполненным кодом, тестовыми случаями (stdin/stdout)
     - **Эссе** — текстовое задание с требованиями
  4. **Публикация** — отправка на модерацию/публикация

- Интерактивное управление шагами (добавление, редактирование, удаление)
- Визуальное отображение структуры (древо модулей → уроков → шагов)
- Подсказки и примеры для каждого типа шага
- Предупреждение при отсутствии корректного ответа в квизе
- Отображение количества тестов для задач на код

---

#### **3.1.4 Функционал администратора**

**AdminPanel.tsx** — центр управления платформой с тремя вкладками:

**1. Вкладка "Курсы":**
- Таблица всех курсов
- Фильтрация по статусу (черновик, на модерации, опубликован)
- Кнопки действий: одобрить, отклонить, удалить
- Статус модерации с обновлением в реальном времени

**2. Вкладка "Пользователи":**
- Список всех пользователей
- Выбор роли из дропдауна (student, teacher, admin)
- Управление статусом пользователя (активный, заблокирован)
- Удаление пользователя
- Статистика: количество студентов, преподавателей, администраторов

**3. Вкладка "Поддержка":**
- Список тикетов обратной связи от пользователей
- Расширяемые карточки с полным текстом вопроса
- Форма ответа со статусом (новое, в работе, решено)
- Возможность менять статус кликом (циклирование)
- Удаление тикетов
- История ответов с датой

---

#### **3.1.5 Дополнительный функционал**

**RolesAccess.tsx** (Legacy, интегрировано в AdminPanel):
- Управление ролями и доступом пользователей
- Визуализация инициалов аватаров цветом по ролям
- Фильтрация и поиск пользователей

**Privacy.tsx** и **Terms.tsx**:
- Статические страницы политики и условий

**NotFound.tsx**:
- Страница 404 с опцией вернуться на главную

---

### 3.2 Интегрированные системы

#### **Система оценок и прогресса**

1. **XP система** — студенты получают очки за выполнение шагов
2. **Прогресс курса** — процентное отображение выполненных шагов
3. **Прогресс еженедельно** — отслеживание выполнения целей на неделю
4. **Прогресс по модулям** — отслеживание выполнения каждого модуля

#### **Система оценивания заданий**

1. **Квизы** — автоматическая проверка (правильный ответ выбран)
2. **Код** — две стратегии:
   - Тестовые случаи (stdin/stdout): автоматическое сравнение выхода
   - AI оценка: использование LLM для анализа качества кода
3. **Эссе** — оценка через AI с анализом ключевых слов

#### **AI интеграция**

- **Chat API** — потоковое получение ответов от LLM через SSE
- **Code Review** — автоматическое анализ качества Python кода
- **Essay Evaluation** — интеллектуальная оценка текстовых работ
- **Daily Plan** — рекомендации по планированию обучения
- **FAQ** — ответы на вопросы студентов

---

## 4. UX/UI РЕШЕНИЯ

### 4.1 Дизайн-система и визуальная иерархия

#### **Цветовая палитра**

```css
/* Светлая тема */
--text: #1a1a1a;           /* Основной текст */
--text-2: #666666;         /* Вторичный текст */
--muted: #999999;          /* Неактивный текст */
--border: #e5e5e5;         /* Границы элементов */
--surface: #f5f5f5;        /* Фоны элементов */

/* Цвета брендирования */
--primary: #7c3aed;        /* Фиолетовый */
--primary-700: #6d28d9;    /* Тёмный фиолетовый */
--burgundy: #c1121f;       /* Бордовый (акцент) */
--success: #22c55e;        /* Зелёный */
--warning: #f59e0b;        /* Оранжевый */
--error: #ef4444;          /* Красный */
```

#### **Компоненты дизайн-системы**

| Компонент | Использование | Особенности |
|-----------|---------------|-------------|
| **btn-primary** | Основные действия | Градиент фиолетовый, hover эффект (translate-y) |
| **btn-outline** | Вторичные действия | Граница, лёгкий фон при наведении |
| **btn-ghost** | Третичные действия | Прозрачный фон, текст изменяется при наведении |
| **btn-secondary** | Нейтральные действия | Серый фон |
| **card** | Контейнеры контента | Тень, граница, скруглённые углы (rounded-2xl) |
| **input-field** | Поля ввода | Граница, фон, 8px паддинг |
| **glass-panel** | Стеклянные эффекты | Полупрозрачный фон, backdrop blur |

#### **Типография**

```
Display font: Inter Display (для заголовков)
  - h1: font-bold text-3xl md:text-4xl
  - h2: font-semibold text-lg md:text-2xl

Body font: Inter (для основного текста)
  - Paragraph: text-sm md:text-base
  - Label: text-xs font-semibold
```

#### **Интервалы и сетка**

- Базовая единица: 4px (реализуется через Tailwind классы)
- Макет: Grid для 2/3/4-колонных разделений
- Отступы: space-y-4, gap-4 (16px)
- Скругление: rounded-xl (12px), rounded-2xl (16px)

### 4.2 Адаптивный дизайн

**Breakpoints (Tailwind):**
```
sm: 640px
md: 768px
lg: 1024px
xl: 1280px
```

**Примеры адаптивности:**
- Сетка статистики: `grid-cols-2 lg:grid-cols-4` (2 колонны на мобильном, 4 на десктопе)
- Макеты: `grid lg:grid-cols-3` для 1-колонного на мобильном, 3-колонного на десктопе
- Текст: `text-2xl md:text-3xl lg:text-4xl`

### 4.3 Система уведомлений

**Toast компонент** (через `useToast()` hook):
- `toast.success(message)` — зелёное уведомление
- `toast.error(message)` — красное уведомление
- `toast.info(message)` — синее уведомление
- Автоматическое скрытие через 3 сек

### 4.4 Состояния загрузки

1. **Skeleton** компонент — плейсхолдер анимированная полоса
2. **Spinning loader** — анимированный круг при отправке формы
3. **Loading состояния** — отключение кнопок при загрузке

### 4.5 Обработка пустых состояний

**EmptyState компонент:**
- Иконка (часто из Lucide)
- Заголовок ("Нет данных")
- Описание
- Опциональная кнопка действия

---

## 5. ОРГАНИЗАЦИЯ МАРШРУТИЗАЦИИ

### 5.1 Структура маршрутов

**Файл:** `src/router/index.tsx`

#### **Публичные маршруты (без авторизации):**

```typescript
GET  /                    → Landing
GET  /login              → Login (email/пароль)
GET  /register           → Register (создание аккаунта)
GET  /forgot-password    → ForgotPassword (запрос письма)
GET  /reset-password     → ResetPassword (установка нового пароля)
GET  /privacy            → Privacy (политика конфиденциальности)
GET  /terms              → Terms (условия использования)
GET  *                   → NotFound (404)
```

#### **Защищённые маршруты студента:**

```typescript
GET  /dashboard                        → Dashboard (личный кабинет)
GET  /course                           → Course (каталог)
GET  /course/:courseId                 → Course (деталь курса + шаги)
GET  /task                             → Task (Code Review)
GET  /ai-review                        → AiReview (чат с AI)
GET  /analytics                        → Analytics (аналитика)
GET  /feedback                         → Feedback (обратная связь)
GET  /help-center                      → HelpCenter (справка)
GET  /account                          → AccountSettings (профиль)
```

#### **Защищённые маршруты преподавателя:**

```typescript
GET  /teacher                          → TeacherStudio (кабинет)
GET  /teacher/courses/new              → CourseEditor (создание)
GET  /teacher/courses/:courseId/edit   → CourseEditor (редактирование)
(Требуют role: "teacher" или "admin")
```

#### **Защищённые маршруты администратора:**

```typescript
GET  /admin                            → AdminPanel (администрирование)
(Требует role: "admin")
```

### 5.2 Механизм защиты маршрутов (RBAC)

**ProtectedRoute компонент:**

```typescript
type Props = {
  children: React.ReactNode
  allowedRoles?: Role[]  // optional: ["teacher", "admin"]
}
```

**Логика:**
1. Если `loadingUser` — показать скелетон
2. Если нет пользователя — редирект на `/login`
3. Если указаны `allowedRoles` и роль пользователя не в списке → редирект на `/dashboard`
4. Иначе — показать контент

**Примеры использования:**
```jsx
// Студент, но может быть и преподаватель/админ
<Route path="/dashboard" element={<ProtectedRoute><Dashboard/></ProtectedRoute>} />

// Только преподаватель и админ
<Route path="/teacher" element={<ProtectedRoute allowedRoles={["teacher", "admin"]}><TeacherStudio/></ProtectedRoute>} />

// Только админ
<Route path="/admin" element={<ProtectedRoute allowedRoles={["admin"]}><AdminPanel/></ProtectedRoute>} />
```

### 5.3 Ленивая загрузка (Code Splitting)

**Все страницы импортируются через `React.lazy()`:**

```typescript
const Landing = lazy(() => import("../pages/Landing"))
const Dashboard = lazy(() => import("../pages/Dashboard"))
const CourseEditor = lazy(() => import("../pages/CourseEditor"))
// ...
```

**Обёрнуты в Suspense с fallback:**

```jsx
const pageFallback = (
  <div className="min-h-[40vh] flex items-center justify-center px-4">
    <div className="glass-panel rounded-xl px-4 py-3 text-sm">Загрузка страницы...</div>
  </div>
)

const withSuspense = (element) => <Suspense fallback={pageFallback}>{element}</Suspense>
```

**Преимущества:**
- Меньший размер начального бандла
- Быстрее загружается главная страница
- Страницы загружаются при первом открытии

### 5.4 История навигации и сохранение контекста

- Использование `useNavigate()` для программной навигации
- Использование `useLocation()` для получения текущего пути
- Использование `useSearchParams()` для параметров в URL (e.g., `?step=5`)

---

## 6. ИНТЕГРАЦИЯ С BACKEND

### 6.1 API сервис и маршрутизация запросов

**Файл:** `src/services/api.ts`

Собственный HTTP клиент с маршрутизацией запросов — каждый маршрут фронта маппится на соответствующий endpoint бэка.

#### **Структура API запроса:**

```typescript
async function backendRequest<T>(
  path: string,
  init: RequestInit = {},
  allowRefresh = true,
): Promise<T>
```

**Особенности:**
- Автоматическое добавление `Authorization: Bearer {token}` заголовка
- Автоматический refresh токена при 401 ошибке
- Парсинг ошибок с извлечением сообщений
- Поддержка повторного запроса при истечении access токена

#### **Маршруты и преобразования**

| Frontend Запрос | HTTP Method | Backend Endpoint | Преобразование |
|-----------------|------------|------------------|---|
| `/auth/login` | POST | `/auth/login` | Сохранение access/refresh токенов |
| `/auth/register` | POST | `/auth/register` | fullName ← name |
| `/auth/me` | GET | `/auth/me` | Преобразование BackendUser → PublicUser |
| `/courses` | GET | `/catalog` | Трансформация каталога + маппинг цен |
| `/dashboard` | GET | `/student/dashboard` | Структурирование статистики |
| `/teacher/courses` | GET | `/teacher/courses` | Получение курсов преподавателя |
| `/teacher/courses/:id/structure` | GET | `/teacher/courses/:id/structure` | Получение модулей, уроков, шагов |
| `/admin/courses` | GET | `/admin/courses` | Получение всех курсов для модерации |
| `/ai/chat` | POST | `/ai/chat` | Отправка сообщения AI (потоковый ответ SSE) |
| `/ai-review/check` | POST | `/ai/review/check` | Проверка эссе через AI |

### 6.2 Трансформация данных

**Пример:** Трансформация Course объекта

```typescript
function toCourse(catalogItem: BackendCourse): Course {
  return {
    id: catalogItem.id,
    title: catalogItem.title,
    lessons: Math.round(catalogItem.durationHours / 2),
    progress: 0,
    type: categorizeType(catalogItem.category),  // Frontend → Backend
    students: String(catalogItem.studentsCount),
    rating: String(catalogItem.rating),
    duration: `${catalogItem.durationHours}ч`,
    // ... другие поля
  }
}
```

**Пример:** Трансформация User объекта

```typescript
function toPublicUser(user: BackendUser): PublicUser {
  return {
    id: user.id,
    name: user.fullName,      // fullName → name
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl || "",
  }
}
```

### 6.3 Обработка ошибок

**Стратегия:**
1. При 401 → попытка refresh токена
2. При успешном refresh → повтор исходного запроса
3. При неудачном refresh → редирект на `/login`
4. Для других ошибок → парсинг JSON с полем `error` или `detail`
5. Отображение ошибки пользователю через toast

```typescript
try {
  const data = await api.get<SomeType>("/some-endpoint")
} catch (err) {
  const message = err instanceof Error ? err.message : "Неизвестная ошибка"
  toast.error(message)
}
```

---

## 7. ГЛОБАЛЬНОЕ СОСТОЯНИЕ ПРИЛОЖЕНИЯ

### 7.1 AppStore (управление пользователем и курсами)

**Файл:** `src/store/AppStore.tsx`

```typescript
type AppStoreContextValue = {
  user: PublicUser | null              // Текущий пользователь
  courses: Course[]                    // Доступные курсы (каталог)
  loadingUser: boolean                 // Загрузка пользователя
  loadingCourses: boolean              // Загрузка курсов
  refreshUser: () => Promise<void>     // Обновить данные пользователя
  login: (email, password) => Promise<void>
  register: (name, email, password) => Promise<void>
  logout: () => Promise<void>
  refreshCourses: () => Promise<void>  // Обновить список курсов
}
```

**Инициализация:**
- При монтировании приложения загружаются данные пользователя и курсы
- Пользователь использует `useAppStore()` hook для доступа к состоянию

### 7.2 ThemeContext (управление темой)

**Файл:** `src/context/ThemeContext.tsx` + `src/context/theme.ts`

```typescript
type ThemeContextType = {
  theme: "light" | "dark"
  toggleTheme: () => void
}
```

**Особенности:**
- Сохранение выбранной темы в localStorage
- Применение класса `dark` к корневому элементу
- Использование CSS переменных для изменения цветов
- При первой загрузке проверяется `prefers-color-scheme` системы

### 7.3 ToastProvider (система уведомлений)

**Файл:** `src/hooks/useToast.tsx`

```typescript
const toast = useToast()
toast.success("Успешно сохранено")
toast.error("Ошибка при сохранении")
toast.info("Информационное сообщение")
```

---

## 8. ХУКИ И УТИЛИТЫ

### 8.1 useToast

```typescript
hook useToast(): {
  success: (msg: string) => void
  error: (msg: string) => void
  info: (msg: string) => void
}
```

Используется для показа уведомлений при действиях пользователя.

### 8.2 useAppStore

```typescript
const { user, courses, loading, login, logout, refreshCourses } = useAppStore()
```

Доступ к глобальному состоянию приложения.

### 8.3 useTheme

```typescript
const { theme, toggleTheme } = useTheme()
```

Доступ к текущей теме и функция переключения.

### 8.4 Стандартные React хуки

- **useEffect** — побочные эффекты (загрузка данных, подписки)
- **useState** — локальное состояние компонента
- **useNavigate** — программная навигация
- **useParams** — параметры маршрута (`:courseId`)
- **useSearchParams** — параметры в URL (`?step=5`)
- **useLocation** — текущий маршрут

---

## 9. КЛЮЧЕВЫЕ ПАТТЕРНЫ И BEST PRACTICES

### 9.1 Паттерны разработки

**1. Компоненты-контейнеры vs Presentational:**
- Контейнеры (страницы) управляют состоянием и логикой
- Presentational (UI компоненты) только отображают данные

**2. Подъём состояния (Lifting State Up):**
- Состояние хранится на уровне, необходимом для нескольких компонентов
- Используется Context API для глобального состояния

**3. Условный рендеринг:**
```jsx
{loading && <Skeleton />}
{error && <ErrorAlert>{error}</ErrorAlert>}
{!loading && !error && <Content />}
```

**4. Полиморфные компоненты:**
```jsx
<Button variant="primary" | "outline" | "ghost" />
```

### 9.2 Производительность

**1. Ленивая загрузка:**
- Все страницы загружаются через `React.lazy()`
- Code splitting по маршрутам

**2. Оптимизация рендеров:**
- Минимизация ненужных рендеров через правильное разделение состояния
- Мемоизация функций обратного вызова (где необходимо)

**3. Кэширование запросов:**
- API ответы не кэшируются явно (refresh на каждый запрос)
- Возможность оптимизации через добавление React Query/SWR

### 9.3 Типизация и безопасность

**1. Полная типизация TypeScript:**
- Все функции типизированы
- Все данные из API типизированы
- Использование `type` для определения структур

**2. Валидация входных данных:**
```typescript
const validate = () => {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Некорректный email"
  if (password.length < 8) return "Пароль короче 8 символов"
  return ""
}
```

**3. Обработка ошибок:**
- Try-catch для асинхронных операций
- Отображение ошибок пользователю через toast

### 9.4 Доступность (Accessibility)

- Семантический HTML (`<button>`, `<form>`, `<label>`)
- Цветовые контрасты соответствуют WCAG
- ARIA атрибуты для интерактивных элементов (где необходимо)
- Клавиатурная навигация (например, Enter для отправки формы)

---

## 10. ИНТЕГРАЦИЯ С BACKEND ФУНКЦИОНАЛЬНОСТЬЮ

### 10.1 Student Routes

| Функция | Frontend Компонент | API Endpoint | Описание |
|---------|-------------------|-------------|---------|
| Просмотр курсов | Course.tsx | GET /catalog | Получение каталога курсов |
| Просмотр шагов курса | CourseStep.tsx | GET /student/courses/:id/steps | Получение шагов для прохождения |
| Отправка ответа | CourseStep.tsx | POST /student/steps/:id/check | Проверка ответа (квиз/код/эссе) |
| Просмотр прогресса | Dashboard.tsx | GET /student/dashboard | Статистика и прогресс |
| Запись на курс | CourseDetail.tsx | POST /student/enroll/:id | Запись на курс |
| Установка цели | Dashboard.tsx | PATCH /student/weekly-goal | Установка еженедельной цели |

### 10.2 Teacher Routes

| Функция | Frontend Компонент | API Endpoint | Описание |
|---------|-------------------|-------------|---------|
| Просмотр курсов | TeacherStudio.tsx | GET /teacher/courses | Список курсов преподавателя |
| Структура курса | CourseEditor.tsx | GET /teacher/courses/:id/structure | Модули, уроки, шаги |
| Создание курса | CourseEditor.tsx | POST /teacher/courses | Создание нового курса |
| Редактирование курса | CourseEditor.tsx | PATCH /teacher/courses/:id | Обновление курса |
| Добавление модуля | CourseEditor.tsx | POST /teacher/courses/:id/modules | Создание модуля |
| Добавление урока | CourseEditor.tsx | POST /teacher/courses/:id/lessons | Создание урока |
| Добавление шага | CourseEditor.tsx | POST /teacher/courses/:id/steps | Создание шага |
| Редактирование шага | CourseEditor.tsx | PATCH /teacher/steps/:id | Обновление шага |
| Удаление шага | CourseEditor.tsx | DELETE /teacher/steps/:id | Удаление шага |
| Публикация курса | TeacherStudio.tsx | PATCH /teacher/courses/:id/publish | Отправка на модерацию/публикация |
| Аналитика | TeacherStudio.tsx | GET /teacher/analytics | Статистика по курсам и студентам |

### 10.3 Admin Routes

| Функция | Frontend Компонент | API Endpoint | Описание |
|---------|-------------------|-------------|---------|
| Просмотр курсов | AdminPanel.tsx | GET /admin/courses | Все курсы с статусом модерации |
| Одобрение курса | AdminPanel.tsx | PATCH /admin/courses/:id | Одобрение/отклонение курса |
| Удаление курса | AdminPanel.tsx | DELETE /admin/courses/:id | Удаление курса с модерацией |
| Просмотр пользователей | AdminPanel.tsx | GET /admin/users | Список пользователей |
| Смена роли | AdminPanel.tsx | PATCH /admin/users/:id/role | Изменение роли пользователя |
| Блокировка пользователя | AdminPanel.tsx | PATCH /admin/users/:id/ban | Блокировка/разблокировка |
| Удаление пользователя | AdminPanel.tsx | DELETE /admin/users/:id | Удаление пользователя |
| Просмотр обратной связи | AdminPanel.tsx | GET /feedback | Список тикетов поддержки |
| Ответ на обратную связь | AdminPanel.tsx | POST /feedback/:id/reply | Отправка ответа пользователю |
| Изменение статуса | AdminPanel.tsx | PATCH /feedback/:id/status | Смена статуса тикета |
| Удаление обратной связи | AdminPanel.tsx | DELETE /feedback/:id | Удаление тикета |

### 10.4 AI Routes

| Функция | Frontend Компонент | API Endpoint | Описание |
|---------|-------------------|-------------|---------|
| Чат с AI | AiReview.tsx | POST /ai/chat | Отправка сообщения, получение SSE ответа |
| Проверка эссе | AiReview.tsx | POST /ai/review/check | Отправка эссе для оценки |
| История проверок | Task.tsx | GET /ai/review/history | История код-ревью |
| Код-ревью | Task.tsx | POST /ai-review/check | Отправка кода на проверку |
| Рекомендации | Analytics.tsx | POST /ai/insights | Получение персональных рекомендаций |
| Дневной план | Dashboard.tsx | POST /ai/daily-plan | Генерация дневного плана обучения |

---

## 11. ТЕХНИЧЕСКИЕ РЕШЕНИЯ И ОПТИМИЗАЦИИ

### 11.1 SSE (Server-Sent Events) для потокового ответа AI

**Проблема:** При запросе к AI, ответ может быть очень большим и долгим.

**Решение:** Использование SSE для потокового получения ответа.

**Реализация в AiReview.tsx:**
```typescript
const response = await fetch(`${API_BASE_URL}/ai/chat`, {
  method: "POST",
  headers: { "Authorization": `Bearer ${token}` },
  body: JSON.stringify({ message })
})

const reader = response.body?.getReader()
while (true) {
  const { done, value } = await reader?.read()
  if (done) break
  
  const chunk = new TextDecoder().decode(value)
  const lines = chunk.split('\n')
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const json = JSON.parse(line.slice(6))
      setResponse(prev => prev + json.content)
    }
  }
}
```

### 11.2 Quiz Options Normalization

**Проблема:** Два формата квиз-опций в базе:
- Старый: `string[]` с `correct_text` полем
- Новый: `{text: string, correct: boolean}[]`

**Решение:** Нормализация на фронте при загрузке и на бэке при сохранении.

**На фронте (CourseEditor.tsx):**
```typescript
const options = (step.options || []).map(opt => {
  if (typeof opt === "string") {
    return { text: opt, correct: false }
  }
  return opt
})
```

**На бэке (teacher_admin.py):**
```python
is_correct = False
if isinstance(opt.get("correct"), bool):
    is_correct = bool(opt["correct"])
elif opt.get("text") == step.correct_text:
    is_correct = True
```

### 11.3 Иммутабельное обновление состояния

**Проблема:** React не определяет изменения объектов (только ссылку).

**Неправильно:**
```javascript
options.forEach((o, i) => { o.correct = i === idx })  // Direct mutation
```

**Правильно:**
```javascript
setOptions(options.map((o, i) => ({ ...o, correct: i === idx })))
```

### 11.4 Code Execution через Subprocess

**Механизм на бэке:**
```python
def _run_code_with_input(code: str, stdin: str) -> tuple[str, str]:
    result = subprocess.run(
        ["python", "-c", code],
        input=stdin,
        capture_output=True,
        text=True,
        timeout=5
    )
    return result.stdout, result.stderr

def evaluate_code_by_tests(code, tests):
    for test in tests:
        actual_output, _ = _run_code_with_input(code, test["input"])
        if actual_output.strip() != test["expected_output"].strip():
            return False
    return True
```

**Тестовые случаи хранятся как:** `[{"input": "...", "expected_output": "..."}, ...]`

---

## 12. ВЫВОДЫ И АРХИТЕКТУРНЫЕ ДОСТИЖЕНИЯ

### Положительные аспекты:

1. **Модульность** — разделение по слоям ответственности (pages, components, services)
2. **Типизированность** — полное использование TypeScript для безопасности типов
3. **Масштабируемость** — простота добавления новых функций и страниц
4. **Адаптивность** — поддержка мобильных устройств через Tailwind CSS
5. **Тематизация** — лёгкое переключение между light/dark режимами
6. **Безопасность** — защита маршрутов через RBAC, обработка ошибок аутентификации
7. **Производительность** — ленивая загрузка страниц, оптимизация бандла
8. **User Experience** — интуитивный интерфейс, уведомления, состояния загрузки

### Возможности улучшения:

1. **State Management** — добавить Redux/Zustand для сложного состояния
2. **Кэширование** — использовать React Query/SWR для оптимизации API запросов
3. **Testing** — добавить Unit/Integration/E2E тесты (Jest, Vitest, Cypress)
4. **Documentation** — Storybook для документации компонентов
5. **Performance** — использовать React.memo, useCallback для оптимизации рендеров
6. **Accessibility** — расширенные ARIA атрибуты для скринридеров
7. **Internationalization (i18n)** — поддержка нескольких языков через i18next

---

## ПРИЛОЖЕНИЕ: ОРГАНИЗАЦИЯ ФАЙЛОВ

### структура.txt
```
frontend/src/
├── index.css
├── main.tsx
├── App.tsx
│
├── pages/
│   ├── Landing.tsx
│   ├── Login.tsx
│   ├── Register.tsx
│   ├── ForgotPassword.tsx
│   ├── ResetPassword.tsx
│   ├── Dashboard.tsx
│   ├── Course.tsx
│   ├── CourseEditor.tsx
│   ├── Task.tsx
│   ├── AiReview.tsx
│   ├── Analytics.tsx
│   ├── TeacherStudio.tsx
│   ├── AdminPanel.tsx
│   ├── RolesAccess.tsx
│   ├── Feedback.tsx
│   ├── HelpCenter.tsx
│   ├── AccountSettings.tsx
│   ├── Privacy.tsx
│   ├── Terms.tsx
│   ├── NotFound.tsx
│   └── course/
│       ├── CourseCatalog.tsx
│       ├── CourseDetail.tsx
│       ├── CourseStep.tsx
│       └── CourseDiscussion.tsx
│
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Modal.tsx
│   │   ├── CodeEditor.tsx
│   │   ├── Skeleton.tsx
│   │   └── EmptyState.tsx
│   ├── auth/
│   │   └── AuthScreenShell.tsx
│   ├── BrandLogo.tsx
│   ├── BinaryGlobe.tsx
│   └── ParticleNetwork.tsx
│
├── layout/
│   └── MainLayout.tsx
│
├── router/
│   └── index.tsx
│
├── features/
│   └── auth/
│       └── ProtectedRoute.tsx
│
├── hooks/
│   └── useToast.tsx
│
├── context/
│   ├── ThemeContext.tsx
│   └── theme.ts
│
├── store/
│   └── AppStore.tsx
│
├── services/
│   └── api.ts
│
└── lib/
    └── api.ts
```

---

**Документ составлен для дипломной защиты проекта "Разработка модуля интерфейса образовательной веб-платформы Gradus"**

Дата: май 2026
Версия: 1.0
