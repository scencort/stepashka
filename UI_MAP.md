# 🗺️ UI Map — Где в коде каждый элемент интерфейса

> Памятка: что видно на экране → где это лежит в коде.  
> Фронтенд: `frontend/src/`  
> Бэкенд: `backend/app/`

---

## 📑 Содержание

- [Глобальные элементы (на всех страницах)](#-глобальные-элементы-на-всех-страницах)
- [Лендинг `/`](#-лендинг-)
- [Вход `/login`](#-вход-login)
- [Регистрация `/register`](#-регистрация-register)
- [Сброс пароля `/forgot-password` и `/reset-password`](#-сброс-пароля)
- [Дашборд `/dashboard`](#-дашборд-dashboard)
- [Каталог курсов `/course`](#-каталог-курсов-course)
- [Страница курса `/course/:id`](#-страница-курса-courseid)
- [AI Code Review `/ai-review`](#-ai-code-review-ai-review)
- [AI-чат `/ai-chat`](#-ai-чат-ai-chat)
- [Аналитика `/analytics`](#-аналитика-analytics)
- [Настройки аккаунта `/account`](#-настройки-аккаунта-account)
- [Кабинет преподавателя `/teacher`](#-кабинет-преподавателя-teacher)
- [Редактор курса `/teacher/courses/new` и `/teacher/courses/:id/edit`](#-редактор-курса)
- [Панель администратора `/admin`](#-панель-администратора-admin)
- [Обратная связь `/feedback`](#-обратная-связь-feedback)
- [Центр помощи `/help-center`](#-центр-помощи-help-center)
- [Роутер и защита маршрутов](#-роутер-и-защита-маршрутов)
- [Глобальный стор и API](#-глобальный-стор-и-api)

---

## 🌐 Глобальные элементы (на всех страницах)

Всё что видно на каждой защищённой странице живёт в **`layout/MainLayout.tsx`**

### Сайдбар (левая панель)

| Что видно | Где в коде |
|---|---|
| Логотип «Gradus» в сайдбаре | `MainLayout.tsx` → `<BrandLogo>` внутри `<aside>` |
| Кнопка `‹` / `›` свернуть/развернуть сайдбар | `MainLayout.tsx` → `<button onClick={() => setCollapsed(!collapsed)}>` |
| Блок «Прогресс недели» (X%) + прогресс-бар + «X / Y шагов» | `MainLayout.tsx` → `{!collapsed && <div className="...bg-[var(--bg-tint)]">}` |
| Секция **ГЛАВНОЕ** — ссылки Панель / Курсы / AI Code Review / AI-чат | `MainLayout.tsx` → `<NavLink>` компоненты внутри `<nav>` |
| Секция **ПРЕПОДАВАНИЕ** — Кабинет преподавателя / Аналитика | `MainLayout.tsx` → `{isTeacherOrAdmin && <>...</>}` |
| Секция **УПРАВЛЕНИЕ** — Панель администратора | `MainLayout.tsx` → `{isAdmin && <>...</>}` |
| Обратная связь / Справка в нижней части навигации | `MainLayout.tsx` → `<NavLink to="/feedback">` и `<NavLink to="/help-center">` |
| Кнопка переключения темы (Тёмная/Светлая тема) | `MainLayout.tsx` → `<button onClick={toggleTheme}>` в нижней секции `<aside>` |
| Аватар/инициалы пользователя в низу сайдбара | `MainLayout.tsx` → `<button onClick={() => navigate("/account")}>` в нижней секции |
| CSS-класс активной ссылки `nav-item-active` | Глобальные стили → `index.css` |

### Хедер (шапка сверху)

| Что видно | Где в коде |
|---|---|
| Бейдж «🔥 N дней» (стрик) | `MainLayout.tsx` → `<button onClick={toggleStreakPanel}>` с `<Flame>` иконкой |
| Кнопка «+ Новый курс» (только teacher/admin) | `MainLayout.tsx` → `{isTeacherOrAdmin && <Link to="/teacher/courses/new">}` |
| Колокольчик уведомлений 🔔 с красной точкой | `MainLayout.tsx` → `<button onClick={toggleNotifications}>` с `<Bell>` |
| Аватар/инициалы в правом углу (открывает профиль) | `MainLayout.tsx` → `<button onClick={toggleProfile}>` с аватаром/инициалами |
| Гамбургер-меню (только мобильные) | `MainLayout.tsx` → `<button onClick={() => setMobileMenuOpen(true)}>` с SVG |

### Дропдаун уведомлений

| Что видно | Где в коде |
|---|---|
| Панель со списком уведомлений | `MainLayout.tsx` → `{showNotifications && <div className="absolute right-0 top-12 w-80...">}` |
| Кнопка «Прочитать всё» | `MainLayout.tsx` → `<button onClick={markAllNotificationsRead}>` |
| Кнопка с корзиной (очистить уведомления) | `MainLayout.tsx` → `<button onClick={async () => { await api.delete("/notifications")...}}>` с `<Trash2>` |
| Красная точка у непрочитанного | `MainLayout.tsx` → `<span className="...bg-red-500">` когда `isUnread` |
| «Нет уведомлений» пустое состояние | `MainLayout.tsx` → `notifications.length === 0 && <p>Нет уведомлений</p>` |
| **API**: загрузка уведомлений | `GET /notifications` → `backend/app/routes/notifications.py` |
| Прочитанные ID хранятся в | `localStorage` ключ `gradus_read_notifications_v1` |

### Дропдаун профиля

| Что видно | Где в коде |
|---|---|
| Имя + роль пользователя | `MainLayout.tsx` → `{showProfile && <div>}` → `user.name`, `roleLabel` |
| Кнопка «Профиль» → `/account?tab=profile` | `MainLayout.tsx` → `navigate("/account?tab=profile")` |
| Кнопка «Настройки» → `/account?tab=settings` | `MainLayout.tsx` → `navigate("/account?tab=settings")` |
| Кнопка «Выйти» | `MainLayout.tsx` → `handleLogout()` → `store.logout()` → `POST /auth/logout` |

### Панель стрика (календарь активности)

| Что видно | Где в коде |
|---|---|
| «N дней подряд» + иконка пламени | `MainLayout.tsx` → `{showStreakPanel && <div>}` |
| Сетка текущей недели (7 ячеек с датами) | `MainLayout.tsx` → `Array.from({ length: 7 }).map(...)` внутри панели |
| Зелёная ячейка = день с активностью | `MainLayout.tsx` → `d.isActive ? "btn-gradient text-white" : "bg-[var(--surface)]"` |
| Тепловая карта 9 недель (маленькие квадратики) | `MainLayout.tsx` → `Array.from({ length: 9 }).map(...)` тепловая карта |
| **API**: данные для стрика | `GET /dashboard` → поле `activeDays[]` и `stats.streakDays` |

### Мобильная навигация (нижняя панель)

| Что видно | Где в коде |
|---|---|
| 4 иконки внизу экрана: Панель / Курсы / Review / AI-чат | `MainLayout.tsx` → `<div className="fixed bottom-0...grid grid-cols-4">` |
| Активная иконка подсвечивается красным | `MainLayout.tsx` → `active ? "text-primary" : "text-[var(--muted)]"` |

---

## 🏠 Лендинг `/`

**Файл:** `pages/Landing.tsx`

| Что видно | Где в коде |
|---|---|
| Навбар: лого + ссылки «Возможности / Сообщество / Команда» + кнопка «Войти в кабинет» | `Landing.tsx` → `<nav>` вверху, `<a href="#features">`, `<Link to="/login">` |
| Переключатель темы (иконка луны/солнца) в навбаре | `Landing.tsx` → `<button onClick={toggleTheme}>` в `<nav>` |
| Hero: «Учись новому в своём темпе» | `Landing.tsx` → `<section id="hero">` → `<h1>` |
| Подзаголовок hero | `Landing.tsx` → `<p>` под `<h1>` в hero |
| Кнопка «Начать бесплатно →» | `Landing.tsx` → `<Link to="/register" className="btn-primary...">` |
| Плавающие карточки (Стрик 14 дней / Тест пройден / +250XP...) | `Landing.tsx` → массив `floatingCards` → рендерится в `<div className="absolute...">` |
| Тикер со статистикой (студенты / курсы / рейтинг) | `Landing.tsx` → `<div className="ticker-wrap">` → `stats` из `GET /landing/stats` |
| Секция «Возможности» (#features) | `Landing.tsx` → `<section id="features">` → массив `features[]` |
| Секция «Сообщество» (#community) с 3D-глобусом | `Landing.tsx` → `<section id="community">` → `<BinaryGlobe>` |
| Секция «Команда» (#team) | `Landing.tsx` → `<section id="team">` → массив `team[]` |
| Секция «FAQ» (вопрос-ответ, аккордеон) | `Landing.tsx` → `<section id="faq">` → `faqItems[]` + `openFaq` state |
| Футер | `Landing.tsx` → `<footer>` в самом низу |
| 3D-глобус из единиц и нулей | **`components/BinaryGlobe.tsx`** → canvas2D анимация |
| **API**: счётчики в тикере | `GET /landing/stats` → `backend/app/routes/landing.py` |

---

## 🔐 Вход `/login`

**Файл:** `pages/Login.tsx`  
**Оболочка:** `components/auth/AuthScreenShell.tsx` (анимированный фон с точками)

| Что видно | Где в коде |
|---|---|
| Анимированный фон с точками/сетью | `AuthScreenShell.tsx` → canvas анимация |
| Лого «Gradus» на форме | `Login.tsx` → `<BrandLogo>` |
| «Добро пожаловать» + «Войдите в свой аккаунт» | `Login.tsx` → `<h1>` и `<p>` |
| Поле Email с иконкой конверта | `Login.tsx` → `<input type="email">` + `<Mail>` иконка |
| Поле Пароль + кнопка показать/скрыть | `Login.tsx` → `<input type={passwordVisible ? "text" : "password"}>` + `<Eye>/<EyeOff>` |
| Ссылка «Забыли пароль?» | `Login.tsx` → `<Link to="/forgot-password">` |
| Кнопка «Войти →» | `Login.tsx` → `<button onClick={handleLogin}>` → `store.login(email, password)` |
| «Нет аккаунта? Зарегистрироваться» | `Login.tsx` → `<Link to="/register">` |
| Кнопка «← На главную» | `Login.tsx` → `<Link to="/">` вверху формы |
| Переключатель темы вверху-справа | `Login.tsx` → `<button onClick={toggleTheme}>` |
| **API**: авторизация | `POST /auth/login` → `backend/app/routes/auth.py` |
| Токены после входа | `services/api.ts` → `setTokens(access, refresh)` → `localStorage` |

---

## 📝 Регистрация `/register`

**Файл:** `pages/Register.tsx`

| Что видно | Где в коде |
|---|---|
| Поле «Имя» | `Register.tsx` → `<input>` + `<User>` иконка, state `name` |
| Поле «Email» | `Register.tsx` → `<input type="email">` + `<Mail>` иконка |
| Поле «Пароль» + показать/скрыть | `Register.tsx` → `<input>` + `<Eye>/<EyeOff>` |
| Валидация (минимум 2 символа, email формат, 8 символов пароль) | `Register.tsx` → функция `validate()` |
| Кнопка «Создать аккаунт →» | `Register.tsx` → `<button onClick={handleRegister}>` → `store.register()` |
| «Уже есть аккаунт? Войти» | `Register.tsx` → `<Link to="/login">` |
| **API**: регистрация | `POST /auth/register` → `backend/app/routes/auth.py` |

---

## 🔑 Сброс пароля

**Файлы:** `pages/ForgotPassword.tsx` и `pages/ResetPassword.tsx`

| Что видно | Где в коде |
|---|---|
| Форма «Введите email» (шаг 1) | `ForgotPassword.tsx` |
| Форма «Новый пароль» по ссылке из письма (шаг 2) | `ResetPassword.tsx` → читает `?token=` из URL |
| **API**: отправка письма | `POST /auth/forgot-password` |
| **API**: применение нового пароля | `POST /auth/reset-password` |

---

## 📊 Дашборд `/dashboard`

**Файл:** `pages/Dashboard.tsx`  
**API:** `GET /dashboard` → поля: `stats`, `continueStep`, `weeklyPlan`, `courses`, `activities`

| Что видно | Где в коде |
|---|---|
| «Привет, [Имя]» + «Вот ваш прогресс на сегодня» | `Dashboard.tsx` → `<h1>Привет, {user?.name.split(" ")[0]}</h1>` |
| 4 карточки статистики (Активные курсы / Серия дней / Средний балл / Задач за неделю) | `Dashboard.tsx` → массив `statCards[]` → `.map()` |
| Иконки в карточках статистики | `Dashboard.tsx` → `statCards` → поля `icon`, `color`, `bg` |
| Скелетон-заглушки пока данные грузятся | `Dashboard.tsx` → `{loading && <Skeleton>}` → компонент `components/ui/Skeleton.tsx` |
| Карточка «ПЛАН НА НЕДЕЛЮ» (красная) | `Dashboard.tsx` → `<div className="...bg-gradient-to-br from-primary...">` |
| Прогресс-бар плана (X из Y шагов) | `Dashboard.tsx` → `weeklyCompleted / weeklyGoal * 100` |
| Поле ввода цели (число шагов) | `Dashboard.tsx` → `<input type="number">` → `weeklyGoal` state + `PATCH /dashboard/goal` |
| Карточка «Я ПРОХОЖУ» (продолжить курс) | `Dashboard.tsx` → `continueStep` из `/dashboard` → `<Link to={...}>Перейти →</Link>` |
| Блок «Мои курсы» со списком + прогресс-барами | `Dashboard.tsx` → `courses[]` → `.map()` с `<Link to="/course/:id">` |
| Ссылка «Все →» рядом с «Мои курсы» | `Dashboard.tsx` → `<Link to="/course">Все →</Link>` |
| Блок «Активность» (лента событий) | `Dashboard.tsx` → `activities[]` → `.map()` с точками и временем |
| **API**: все данные дашборда | `GET /dashboard` → `backend/app/routes/student.py` → функция `get_dashboard()` |
| **API**: изменить недельную цель | `PATCH /dashboard/goal` → `backend/app/routes/student.py` |

---

## 📚 Каталог курсов `/course`

**Файл:** `pages/Course.tsx` → рендерит `pages/course/CourseCatalog.tsx`  
**API:** `GET /courses` (список) + `GET /courses/:id` (детали)

| Что видно | Где в коде |
|---|---|
| «Каталог курсов» заголовок + счётчик | `CourseCatalog.tsx` → `<h1>Каталог курсов</h1>` |
| Поле поиска «Поиск по названию, автору...» | `CourseCatalog.tsx` → `<input>` с `<Search>` иконкой → state `query` |
| Фильтры по уровню (Начальный / Средний / Продвинутый) | `CourseCatalog.tsx` → кнопки `levelFilter` |
| Вкладки «Все курсы» / «Мои курсы (N)» | `CourseCatalog.tsx` → state `tab: "all" | "mine"` |
| Фильтр категорий (Все / Программирование / ...) | `CourseCatalog.tsx` → `categories[]` + state `categoryFilter` |
| Счётчик «N из M курсов» | `CourseCatalog.tsx` → `visibleCourses.length` |
| Карточка курса (обложка / теги / название / автор / рейтинг / цена) | `CourseCatalog.tsx` → `<div className="card...">` в `.map()` |
| Прогресс-бар «X% пройдено» на карточке | `CourseCatalog.tsx` → `course.progress > 0` → полоска |
| Бейдж «Бесплатно» / «N ₽» | `CourseCatalog.tsx` → `course.price` |
| Кнопка «+ Создать курс» (только teacher/admin) | `CourseCatalog.tsx` → `{isTeacherOrAdmin && <Link to="/teacher/courses/new">}` |

---

## 🎓 Страница курса `/course/:id`

**Файл:** `pages/Course.tsx` → рендерит `pages/course/CourseDetail.tsx`  
**API:** `GET /courses/:id`, `GET /courses/:id/steps`, `POST /courses/:id/enroll`

| Что видно | Где в коде |
|---|---|
| Название курса + прогресс «X/Y шагов X%» | `CourseDetail.tsx` → `<h1>` + счётчики из `courseDetail` |
| Вкладки «Шаг» / «Обсуждение» | `CourseDetail.tsx` → state `activeTab: "step" | "discussion"` |
| Бейдж типа шага (Эссе/Тест/Теория/Код) | `CourseDetail.tsx` → `step.kind` → `taskTypeLabel` |
| «Шаг N · ⚡ N XP» | `CourseDetail.tsx` → `step.stepOrder`, `step.xp` |
| Заголовок шага | `CourseDetail.tsx` → `<h2>{step.title}</h2>` |
| **Теория**: HTML/Markdown контент | `CourseDetail.tsx` → `step.kind === "theory"` → `dangerouslySetInnerHTML` |
| **Эссе**: textarea «Ваш ответ» + счётчик символов | `CourseDetail.tsx` → `step.kind === "essay"` → `<textarea>` + `answer.length` |
| Подсказка «Ответ оценит AI по критериям: ...» | `CourseDetail.tsx` → синяя плашка с критериями |
| Кнопка «Отправить эссе на проверку» | `CourseDetail.tsx` → `<button onClick={submitEssay}>` → `POST /courses/:id/steps/:sid/submit` |
| **Тест**: варианты ответа | `CourseDetail.tsx` → `step.kind === "quiz"` → `step.options.map()` |
| **Код**: редактор с macOS-точками + кнопка «Запустить» | `CourseDetail.tsx` → `step.kind === "code"` → `<CodeEditor>` |
| Панель результатов теста (чекбоксы ✓/✗) | `CourseDetail.tsx` → `testResults[]` из ответа сервера |
| Правая панель «Содержание» (список шагов по модулям) | `CourseDetail.tsx` → `courseDetail.modules` → аккордеон |
| Активный шаг подсвечен в содержании | `CourseDetail.tsx` → `selectedStep?.id === step.id` |
| Кружок прогресса у шага (серый/красный/галочка) | `CourseDetail.tsx` → `stepProgress[step.id]?.passed` |
| **API**: отправка ответа | `POST /courses/:id/steps/:sid/submit` → `backend/app/routes/student.py` |
| **API**: AI-оценка эссе | `services.py` → `estimate_essay()` → ключевые слова + Groq |
| **API**: проверка кода тестами | `services.py` → `evaluate_code_by_tests()` |

---

## 🤖 AI Code Review `/ai-review`

**Файл:** `pages/Task.tsx`  
**API:** `POST /ai/review`

| Что видно | Где в коде |
|---|---|
| «AI Code Review» заголовок | `Task.tsx` → `<h1>AI Code Review</h1>` |
| Селект языка «Авто-определение» | `Task.tsx` → `<select>` → state `language` → массив `LANGUAGES` |
| Редактор кода с macOS-точками (красный/жёлтый/зелёный) | `Task.tsx` → `<div className="px-4 py-2...">` + `<CodeEditor>` |
| Название языка рядом с точками | `Task.tsx` → `LANGUAGES.find(l => l.value === language)?.label` |
| Компонент редактора кода | **`components/ui/CodeEditor.tsx`** — два слоя: `<textarea>` + `<pre>` с Prism |
| Кнопка «Запустить ревью» | `Task.tsx` → `<button onClick={handleReview}>` |
| Правая панель «История ревью» | `Task.tsx` → `reviews[]` state |
| Пустое состояние «Пока пусто» | `Task.tsx` → `reviews.length === 0 && ...` |
| Результат ревью (markdown с кодом) | `Task.tsx` → `<AiMarkdown text={review.result}>` |
| **AI рендеринг**: `AiMarkdown`, `AiCodeBlock`, `AiTextBlock` | **`pages/AiReview.tsx`** (переиспользуется) |
| **API**: запрос ревью | `POST /ai/review` → `backend/app/routes/ai.py` → Groq/aitunnel |

---

## 💬 AI-чат `/ai-chat`

**Файл:** `pages/AiReview.tsx`  
**API:** `POST /ai/chat`

| Что видно | Где в коде |
|---|---|
| «AI-ассистент» заголовок | `AiReview.tsx` → `<h1>AI-ассистент</h1>` |
| Карточка «Gradus AI · Online» + «GPT-4 / Llama 3» | `AiReview.tsx` → хедер чата |
| Приветственное сообщение от AI | `AiReview.tsx` → начальный `messages[]` state |
| Пузырь сообщения пользователя (справа) | `AiReview.tsx` → `msg.role === "user"` → `justify-end` |
| Пузырь сообщения AI (слева) | `AiReview.tsx` → `msg.role === "assistant"` → `<AiMarkdown>` |
| Блок кода в ответе AI (тёмный фон + кнопка копировать) | `AiReview.tsx` → `AiCodeBlock` компонент |
| Жирный/курсив/`код` в тексте | `AiReview.tsx` → `renderInline()` функция |
| Поле ввода «Спросите AI про код...» | `AiReview.tsx` → `<textarea>` → state `input` |
| Кнопка отправки (стрелка) | `AiReview.tsx` → `<button onClick={send}>` с `<Send>` иконкой |
| «AI может допускать ошибки» | `AiReview.tsx` → `<p className="text-xs...">` под полем ввода |
| Анимация «печатает...» (три точки) | `AiReview.tsx` → `loading && <div className="typing-dots">` |
| **API**: отправка сообщения | `POST /ai/chat` → `backend/app/routes/ai.py` → `ai_chat()` |
| **Fallback провайдеры** | `ai.py` → Groq → aitunnel → Gemini (по порядку при ошибке) |

---

## 📈 Аналитика `/analytics`

**Файл:** `pages/Analytics.tsx`  
**API:** `GET /analytics?period=week|month`, `POST /ai/insights`

| Что видно | Где в коде |
|---|---|
| «Аналитика» заголовок | `Analytics.tsx` → `<h1>Аналитика</h1>` |
| Переключатель «Неделя / Месяц» | `Analytics.tsx` → `["week", "month"].map()` → state `period` |
| 3 карточки: Средний балл / Решено задач / Пройдено курсов | `Analytics.tsx` → массив `statCards[]` → `.map()` |
| График «Динамика прогресса» (горизонтальные полоски) | `Analytics.tsx` → `values[]` → `.map()` → ширина `(v/max)*100%` |
| «День 1 / День 2...» или «Нед. 1 / Нед. 2...» | `Analytics.tsx` → `period === "week" ? "День" : "Нед."` |
| Бейдж «+X% за период» или «-X%» | `Analytics.tsx` → `delta = last - first` → `<TrendingUp>/<TrendingDown>` |
| Блок «AI-рекомендации» (3 карточки) | `Analytics.tsx` → `insights[]` из `POST /ai/insights` |
| Скелетон пока грузятся данные | `Analytics.tsx` → `{loading && <Skeleton>}` |
| **API**: данные аналитики | `GET /analytics` → `backend/app/routes/student.py` |
| **API**: AI-инсайты | `POST /ai/insights` → `backend/app/routes/ai.py` |

---

## ⚙️ Настройки аккаунта `/account`

**Файл:** `pages/AccountSettings.tsx`  
**API:** `GET /account`, `PATCH /account`, `POST /account/avatar`

### Левая панель (вкладки)

| Что видно | Где в коде |
|---|---|
| Аватар + имя + роль + email | `AccountSettings.tsx` → левая колонка `<div>` с `profile.name`, `profile.role` |
| Вкладки: Профиль / Безопасность / Уведомления / Сессии | `AccountSettings.tsx` → массив `TABS` → `activeTab` из `?tab=` URL параметра |
| Счётчик «Сессии 23» | `AccountSettings.tsx` → `sessions.length` на кнопке вкладки |

### Вкладка «Профиль»

| Что видно | Где в коде |
|---|---|
| Загрузка фото «Выбрать» | `AccountSettings.tsx` → `<input type="file">` + FileReader → base64 |
| Модалка кропа аватара | `AccountSettings.tsx` → `pendingAvatarSrc` state → `<Cropper>` из `react-easy-crop` |
| Поля: Имя / Email / Телефон / Часовой пояс | `AccountSettings.tsx` → `profile` state → `updateProfileField()` |
| Поле «О себе» | `AccountSettings.tsx` → `<textarea>` → `profile.bio` |
| Селект «Язык» | `AccountSettings.tsx` → `<select>` → `profile.language` |
| Поле «Роль» (только чтение) | `AccountSettings.tsx` → `<input disabled>` |
| «Есть несохранённые изменения» | `AccountSettings.tsx` → `isDirty` → `useMemo` сравнивает с `initialSnapshot` |
| Кнопка «Сохранить» | `AccountSettings.tsx` → `<button onClick={saveProfile}>` → `PATCH /account` |

### Вкладка «Безопасность»

| Что видно | Где в коде |
|---|---|
| Форма смены пароля | `AccountSettings.tsx` → `tab === "security"` → старый/новый/подтверждение |
| Блок 2FA (двухфакторная аутентификация) | `AccountSettings.tsx` → `twoFaSetup` state → `POST /account/2fa/setup` |
| QR-код для Google Authenticator | `AccountSettings.tsx` → `<img src={twoFaSetup.qr}>` |

### Вкладка «Сессии»

| Что видно | Где в коде |
|---|---|
| Список активных сессий | `AccountSettings.tsx` → `sessions[]` → `GET /account/sessions` |
| Кнопка «Завершить» сессию | `AccountSettings.tsx` → `DELETE /account/sessions/:id` |

---

## 👨‍🏫 Кабинет преподавателя `/teacher`

**Файл:** `pages/TeacherStudio.tsx`  
**API:** `GET /teacher/overview`, `GET /teacher/courses`, `GET /teacher/courses/:id/enrollment-requests`

| Что видно | Где в коде |
|---|---|
| «Кабинет преподавателя» заголовок | `TeacherStudio.tsx` → `<h1>` |
| Кнопка «+ Создать курс» | `TeacherStudio.tsx` → `<Link to="/teacher/courses/new">` |
| 4 карточки: Опубликовано / Черновики / Ср. прогресс / Заданий | `TeacherStudio.tsx` → `overview.stats` |
| Список «Мои курсы» с фильтром Все/Опубликованы/Черновики | `TeacherStudio.tsx` → `courses[]` + state `filter` |
| Бейдж «Опубликован» / «На модерации» / «Черновик» | `TeacherStudio.tsx` → `course.status` → цвет бейджа |
| Кнопка «Редактировать» | `TeacherStudio.tsx` → `<Link to="/teacher/courses/:id/edit">` |
| Аккордеон «Заявки на запись» | `TeacherStudio.tsx` → `courseRequests[]` → `expandedCourse` state |
| Кнопки «Одобрить / Отклонить» заявку | `TeacherStudio.tsx` → `decide(requestId, "approved"/"rejected")` → `PATCH /teacher/enrollment-requests/:id` |
| Поле комментария к решению | `TeacherStudio.tsx` → `commentDrafts[requestId]` state |

---

## 🛠️ Редактор курса

**Маршруты:** `/teacher/courses/new` и `/teacher/courses/:id/edit`  
**Файл:** `pages/CourseEditor.tsx`  
**API:** `POST /teacher/courses`, `PUT /teacher/courses/:id`

### Шаг 1 — Основная информация

| Что видно | Где в коде |
|---|---|
| Прогресс-индикатор «1 → 2 → 3» вверху | `CourseEditor.tsx` → `step` state → три кружка |
| Поле «Название курса» | `CourseEditor.tsx` → `title` + авто-генерация `slug` через `slugify()` |
| Поле «URL-slug» | `CourseEditor.tsx` → `slug` state |
| Поле «Описание» | `CourseEditor.tsx` → `<textarea>` → `description` |
| Кастомный селект «Уровень сложности» | `CourseEditor.tsx` → `CustomSelect` дженерик компонент |
| Кастомный селект «Категория» | `CourseEditor.tsx` → `CustomSelect` |
| Кнопки цены (Бесплатно / 490₽ / 990₽ / 1990₽ / 4990₽ / своя) | `CourseEditor.tsx` → `PRICE_OPTIONS[]` → state `priceCents` |
| Загрузка обложки (drag & drop) | `CourseEditor.tsx` → `<input type="file">` + preview |
| Карточки «Тип доступа» (Открытый / По заявке / По приглашению) | `CourseEditor.tsx` → `ACCESS_TYPES[]` → state `accessType` |

### Шаг 2 — Структура курса

| Что видно | Где в коде |
|---|---|
| Кнопка «+ Добавить модуль» | `CourseEditor.tsx` → `addModule()` → `emptyModule()` фабрика |
| Поле названия модуля | `CourseEditor.tsx` → `module.title` |
| Кнопка «+ Добавить урок» | `CourseEditor.tsx` → `addLesson(moduleIdx)` → `emptyLesson()` |
| Кнопка «+ Добавить шаг» | `CourseEditor.tsx` → `addStep(moduleIdx, lessonIdx)` → `emptyStep()` |
| Селект типа шага (Теория / Тест / Код / Эссе) | `CourseEditor.tsx` → `step.kind` |
| Редактор контента шага (textarea) | `CourseEditor.tsx` → `step.theoryText` / `step.options[]` |

### Шаг 3 — Публикация

| Что видно | Где в коде |
|---|---|
| Кнопки «Сохранить черновик» / «Отправить на модерацию» | `CourseEditor.tsx` → `handleSave("draft"/"pending")` |

---

## 🛡️ Панель администратора `/admin`

**Файл:** `pages/AdminPanel.tsx`  
**API:** `GET /admin/stats`, `GET /admin/courses`, `GET /admin/users`, `GET /admin/feedback`

| Что видно | Где в коде |
|---|---|
| «Панель администратора» заголовок | `AdminPanel.tsx` → `<h1>` |
| 4 карточки: Пользователей / Всего курсов / Опубликовано / Обращений | `AdminPanel.tsx` → `stats` из `GET /admin/stats` |
| Жёлтая плашка «На модерации · N» | `AdminPanel.tsx` → `pending[]` → `courses.filter(c => c.status === "pending")` |
| Кнопки «Опубликовать / Отклонить» у курса на модерации | `AdminPanel.tsx` → `PATCH /admin/courses/:id` с `{status: "published"/"rejected"}` |
| Вкладки: Курсы (N) / Пользователи (N) / Обращения | `AdminPanel.tsx` → state `activeTab` |
| Поиск по курсам/пользователям | `AdminPanel.tsx` → state `query` → `useMemo` фильтрация |
| Фильтр курсов (Все / Модерация / Опубликованы / Черновики) | `AdminPanel.tsx` → state `filter` |
| Кнопки у курса: Принять / Отклонить / Удалить | `AdminPanel.tsx` → `actionId` state блокирует кнопки пока идёт запрос |
| Список пользователей с ролями | `AdminPanel.tsx` → `users[]` → `GET /admin/users` |
| Смена роли пользователя | `AdminPanel.tsx` → `PATCH /admin/users/:id` |
| Обращения (форма обратной связи) | `AdminPanel.tsx` → `feedbacks[]` → `GET /admin/feedback` |
| Кнопка «Ответить» на обращение | `AdminPanel.tsx` → `POST /admin/feedback/:id/reply` |

---

## 📬 Обратная связь `/feedback`

**Файл:** `pages/Feedback.tsx`  
**API:** `POST /feedback`

| Что видно | Где в коде |
|---|---|
| Форма с темой и текстом | `Feedback.tsx` → `<form>` с `<input>` и `<textarea>` |
| Кнопка «Отправить» | `Feedback.tsx` → `<button type="submit">` → `POST /feedback` |

---

## ❓ Центр помощи `/help-center`

**Файл:** `pages/HelpCenter.tsx`

| Что видно | Где в коде |
|---|---|
| FAQ-аккордеон с вопросами | `HelpCenter.tsx` → `faqItems[]` + `openItem` state |
| Ссылка «Написать нам» | `HelpCenter.tsx` → `<Link to="/feedback">` |

---

## 🔀 Роутер и защита маршрутов

**Файл:** `router/index.tsx`

| Что происходит | Где в коде |
|---|---|
| Все маршруты приложения | `router/index.tsx` → `<Routes>` с `<Route>` |
| Ленивая загрузка страниц | `router/index.tsx` → `lazy(() => import(...))` для каждой страницы |
| Заглушка «Загрузка страницы...» | `router/index.tsx` → `pageFallback` константа |
| Защита маршрутов (редирект на /login) | **`features/auth/ProtectedRoute.tsx`** → проверяет `user` из стора |
| Проверка роли (teacher/admin) | `ProtectedRoute.tsx` → `allowedRoles.includes(user.role)` |
| Скелетон пока определяется авторизация | `ProtectedRoute.tsx` → `loadingUser && <Skeleton>` |
| Страница 404 | `pages/NotFound.tsx` → маршрут `path="*"` |

---

## 🗃️ Глобальный стор и API

### AppStore

**Файл:** `store/AppStore.tsx`

| Что делает | Где в коде |
|---|---|
| Глобальный стейт: `user`, `courses`, `loadingUser` | `AppStore.tsx` → `AppStoreProvider` + React Context |
| `useAppStore()` — хук для любого компонента | `AppStore.tsx` → `export const useAppStore` |
| `store.login(email, password)` | `AppStore.tsx` → `POST /auth/login` → сохраняет токены |
| `store.logout()` | `AppStore.tsx` → `POST /auth/logout` → чистит localStorage |
| `store.refreshUser()` | `AppStore.tsx` → `GET /auth/me` → обновляет `user` |
| Автоматический `refreshUser()` при старте | `AppStore.tsx` → `useEffect([], [])` при монтировании |

### API-слой

**Файл:** `services/api.ts` (реэкспортируется из `lib/api.ts`)

| Что делает | Где в коде |
|---|---|
| `api.get("/endpoint")` | `services/api.ts` → `request()` → `fetch(API_BASE_URL + path)` |
| `api.post("/endpoint", body)` | `services/api.ts` → `request()` с `method: "POST"` |
| `api.patch()`, `api.delete()` | `services/api.ts` → аналогично |
| Автоматическое добавление `Authorization: Bearer` | `services/api.ts` → `getAccessToken()` добавляется в headers |
| Авто-рефреш токена при 401 | `services/api.ts` → `tryRefreshToken()` → `POST /auth/refresh` |
| `VITE_API_URL` — базовый URL API | `.env` файл → в продакшене `https://gradus-edtech.ru/api` |
| Маппинг URL (фронт ↔ бэк) | `services/api.ts` → `routeMappings[]` |
| Нормализация данных (snake_case → camelCase) | `services/api.ts` → `toCourse()`, `toUser()` функции |

### Темизация

**Файл:** `context/theme.tsx`

| Что делает | Где в коде |
|---|---|
| `useTheme()` → `theme`, `toggleTheme()` | `context/theme.tsx` → ThemeContext |
| Тема сохраняется в `localStorage` | `context/theme.tsx` → ключ `gradus_theme` |
| CSS-переменные темы (`--bg`, `--text`, `--border`...) | `index.css` → `:root` (светлая) и `[data-theme="dark"]` |

### Toast-уведомления

**Файл:** `hooks/useToast.ts` + `context/ToastProvider.tsx`

| Что делает | Где в коде |
|---|---|
| `toast.success("...")` | `useToast.ts` → добавляет в очередь → показывает снизу-справа |
| `toast.error("...")` | `useToast.ts` → красное уведомление |

---

## 🎨 UI-компоненты

| Компонент | Файл | Где используется |
|---|---|---|
| `<Card>` | `components/ui/Card.tsx` | Везде как контейнер с фоном/рамкой |
| `<Skeleton>` | `components/ui/Skeleton.tsx` | Заглушки при загрузке данных |
| `<CodeEditor>` | `components/ui/CodeEditor.tsx` | Task.tsx, CourseDetail.tsx (code-шаги) |
| `<BrandLogo>` | `components/BrandLogo.tsx` | MainLayout, Login, Register, Landing |
| `<BinaryGlobe>` | `components/BinaryGlobe.tsx` | Landing.tsx (секция сообщество) |
| `<AuthScreenShell>` | `components/auth/AuthScreenShell.tsx` | Login, Register, ForgotPassword |
| `<AiMarkdown>` | `pages/AiReview.tsx` | Task.tsx и AiReview.tsx |

---

## 🖥️ Бэкенд — ключевые файлы

| Что делает | Файл |
|---|---|
| Авторизация (login/register/refresh/logout) | `backend/app/routes/auth.py` |
| Дашборд студента, прогресс, цель недели | `backend/app/routes/student.py` |
| Курсы, шаги, запись, отправка ответов | `backend/app/routes/student.py` |
| AI-ревью кода, AI-чат, AI-инсайты | `backend/app/routes/ai.py` |
| Оценка эссе, проверка кода тестами | `backend/app/services.py` |
| Кабинет преподавателя | `backend/app/routes/teacher.py` |
| Административные функции | `backend/app/routes/admin.py` |
| Уведомления | `backend/app/routes/notifications.py` |
| Настройки аккаунта | `backend/app/routes/account.py` |
| Статистика для лендинга | `backend/app/routes/landing.py` |
| Модели базы данных | `backend/app/models.py` |
| Подключение роутов в приложение | `backend/app/main.py` |

---

## 🚀 Деплой

| Что | Как |
|---|---|
| Задеплоить на сервер | `ssh user@144.31.228.68` → `cd /opt/gradus` → `bash deploy.sh` |
| `deploy.sh` делает | `git pull` → `npm run build` (с VITE_API_URL) → `pip install` → рестарт бэкенда |
| Перезапуск бэкенда вручную | `sudo systemctl restart gradus-backend` |
| Логи бэкенда | `sudo journalctl -u gradus-backend -f` |
| Переменные окружения бэкенда | `/opt/gradus/backend/.env` |
| ⚠️ Если фронт шлёт на `http://IP` | Удалить `/opt/gradus/frontend/.env` — он переопределяет VITE_API_URL |
| nginx конфиг | `/etc/nginx/sites-available/gradus` |
| SSL сертификат | Let's Encrypt, домен `gradus-edtech.ru` |
