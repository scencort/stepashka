# Руководство по фронтенду Gradus

> Этот гайд написан для тех, кто только начинает разбираться в React и TypeScript.
> Здесь нет "умных" слов без объяснения. Каждая концепция сначала объясняется простыми словами, потом — показывается на реальном коде из этого проекта.

---

## Содержание

1. [Что такое .tsx файл](#1-что-такое-tsx-файл)
2. [Ключевые хуки React](#2-ключевые-хуки-react)
3. [Как данные приходят с бэкенда](#3-как-данные-приходят-с-бэкенда)
4. [Структура папок проекта](#4-структура-папок-проекта)
5. [Шаблон типичной страницы](#5-шаблон-типичной-страницы)
6. [CSS и Tailwind](#6-css-и-tailwind)
7. [Роутинг](#7-роутинг)
8. [AppStore — глобальный стейт](#8-appstore--глобальный-стейт)
9. [Реальные примеры из проекта](#9-реальные-примеры-из-проекта)
10. [Типичные паттерны](#10-типичные-паттерны)
11. [TypeScript в этом проекте](#11-typescript-в-этом-проекте)
12. [Частые ошибки и как их читать](#12-частые-ошибки-и-как-их-читать)

---

## 1. Что такое .tsx файл

### Аналогия из жизни

Представь рецепт блюда. В рецепте смешаны два вида информации: **ингредиенты** (данные) и **инструкции по приготовлению** (логика). `.tsx` файл — это то же самое: в нём смешаны **JavaScript/TypeScript** (логика) и **HTML-подобная разметка** (интерфейс).

### Что такое JSX

Обычный JavaScript выглядит так:
```js
const element = document.createElement("div")
element.textContent = "Привет, мир"
```

Это громоздко. Поэтому придумали JSX — специальный синтаксис, который выглядит как HTML, но на самом деле является JavaScript:
```tsx
const element = <div>Привет, мир</div>
```

Браузер не понимает JSX напрямую. Специальный инструмент (Vite/Babel) автоматически превращает JSX обратно в обычный JavaScript при сборке проекта.

### Почему .tsx а не .js

- `.js` — обычный JavaScript (без типов)
- `.ts` — TypeScript (JavaScript + типы), но без JSX
- `.tsx` — TypeScript + JSX (то, что нам нужно для React компонентов)

Расширение `.tsx` говорит инструментам сборки: "в этом файле есть и TypeScript и JSX, обрабатывай их правильно".

### Структура React компонента с нуля

Каждый `.tsx` файл со страницей или компонентом выглядит так:

```tsx
// ── 1. СЕКЦИЯ ИМПОРТОВ ─────────────────────────────────────────────────────
// Всё что нужно компоненту — хуки, другие компоненты, утилиты — импортируется сверху
import { useState, useEffect } from "react"   // встроенные хуки React
import MainLayout from "../layout/MainLayout"  // другой компонент из проекта
import { api } from "../lib/api"               // функция для запросов к серверу

// ── 2. ОПИСАНИЕ ТИПОВ ДАННЫХ (TypeScript) ─────────────────────────────────
// Описываем "форму" данных — что мы ожидаем получить от сервера
// Это как договор: если сервер вернёт что-то другое, TypeScript сразу предупредит
type Course = {
  id: number       // уникальный номер курса
  title: string    // название
  lessons: number  // количество уроков
}

// ── 3. ОБЪЯВЛЕНИЕ КОМПОНЕНТА ───────────────────────────────────────────────
// Компонент — это просто функция, которая возвращает JSX
// export default означает "экспортировать эту функцию как главное из файла"
export default function MyPage() {

  // ── 4. ХУКИ (внутреннее состояние компонента) ─────────────────────────
  // useState хранит данные, которые могут меняться со временем
  const [courses, setCourses] = useState<Course[]>([])  // список курсов
  const [loading, setLoading] = useState(true)           // идёт ли загрузка?

  // ── 5. ЭФФЕКТЫ (побочные действия) ────────────────────────────────────
  // useEffect запускает код когда что-то происходит (компонент появился, данные изменились)
  useEffect(() => {
    // загружаем данные при появлении страницы
    api.get<Course[]>("/courses").then(setCourses).finally(() => setLoading(false))
  }, []) // [] = запустить только один раз при появлении компонента

  // ── 6. JSX — то что будет видно на экране ─────────────────────────────
  // return возвращает разметку. Всё что в фигурных скобках {} — это JavaScript выражение
  return (
    <MainLayout>
      {loading && <p>Загрузка...</p>}
      {courses.map(course => (
        <div key={course.id}>
          <h2>{course.title}</h2>
        </div>
      ))}
    </MainLayout>
  )
}
```

### Ключевые правила JSX

**1. Всё должно быть обёрнуто в один корневой элемент:**
```tsx
// ПЛОХО — два корневых элемента, React не знает что возвращать
return (
  <div>Первый</div>
  <div>Второй</div>
)

// ХОРОШО — обернуто в один div
return (
  <div>
    <div>Первый</div>
    <div>Второй</div>
  </div>
)

// ТОЖЕ ХОРОШО — пустые теги <> </> (фрагменты), не добавляют лишний div в HTML
return (
  <>
    <div>Первый</div>
    <div>Второй</div>
  </>
)
```

**2. Атрибуты пишутся в camelCase:**
```tsx
// В HTML: class="card"    onclick="..."
// В JSX:
<div className="card" onClick={handleClick}>...</div>
//   ↑ class → className  ↑ onclick → onClick (с большой буквы)
```

**3. Фигурные скобки — это "окно в JavaScript":**
```tsx
const name = "Иван"
const count = 42

return (
  <div>
    <p>Привет, {name}!</p>         {/* выводит: Привет, Иван! */}
    <p>Курсов: {count}</p>         {/* выводит: Курсов: 42 */}
    <p>Сумма: {count + 8}</p>      {/* выводит: Сумма: 50 */}
    <p>{count > 10 ? "много" : "мало"}</p> {/* выводит: много */}
  </div>
)
```

**4. Компоненты начинаются с большой буквы:**
```tsx
<div>      — это HTML тег
<MainLayout> — это React компонент (большая буква M)
```

---

## 2. Ключевые хуки React

### Что такое хук вообще

Хук — это специальная функция в React, которая начинается с `use`. Хуки дают компонентам "суперспособности": хранить данные, реагировать на события, запоминать результаты вычислений.

**Важное правило:** хуки нельзя вызывать внутри `if`, `for` или вложенных функций. Только на верхнем уровне компонента.

---

### 2.1 useState — хранилище данных компонента

#### Что такое стейт?

**Аналогия:** Представь электронное табло на стадионе. На нём показывается счёт: 2:1. Когда забивают гол, счёт меняется на 3:1, и табло автоматически обновляется. Стейт — это и есть такое табло. Когда данные в стейте меняются, React автоматически обновляет интерфейс.

Обычная переменная `let x = 5` не работает так: если ты её изменишь, React не узнает об этом и не перерисует экран. Поэтому нужен `useState`.

#### Синтаксис

```tsx
const [значение, функцияОбновления] = useState(начальноеЗначение)
```

Это деструктуризация массива. `useState` возвращает два элемента:
1. Текущее значение (читаем его)
2. Функцию для изменения значения (вызываем чтобы обновить)

#### Примеры из проекта

**Analytics.tsx** — переключатель периода (неделя / месяц):

```tsx
// Analytics.tsx
const [period, setPeriod] = useState<"week" | "month">("week")
//     ↑ текущий период    ↑ функция смены   ↑ начальное значение — "week"
```

Тип `<"week" | "month">` говорит: "в этой переменной может быть только строка 'week' или 'month'". Если попытаться записать туда что-то другое — TypeScript выдаст ошибку ещё до запуска.

Как это используется в JSX:
```tsx
// кнопки переключения периода
{(["week", "month"] as const).map(p => (
  <button
    key={p}
    onClick={() => setPeriod(p)}   // ← вот здесь вызывается функция обновления
    className={period === p ? "btn-gradient" : "text-[var(--muted)]"}
    //                 ↑ сравниваем текущий период с кнопкой чтобы подсветить активную
  >
    {p === "week" ? "Неделя" : "Месяц"}
  </button>
))}
```

**Analytics.tsx** — несколько стейтов для одной страницы:

```tsx
const [period, setPeriod] = useState<"week" | "month">("week")
// ↑ какой период показываем: неделю или месяц

const [values, setValues] = useState<number[]>([])
// ↑ массив чисел с данными графика: [2, 5, 0, 3, ...]
// начинаем с пустого массива [], потому что данных ещё нет

const [loading, setLoading] = useState(true)
// ↑ true = данные ещё загружаются (показываем скелетоны)
// false = данные загружены (показываем настоящие данные)

const [stats, setStats] = useState({
  averageScore: "0%",
  solvedTasks: 0,
  completedCourses: 0
})
// ↑ объект с тремя полями статистики
// начальные значения — "заглушки" до прихода данных с сервера

const [error, setError] = useState("")
// ↑ строка с текстом ошибки, если что-то пошло не так
// "" (пустая строка) = нет ошибки
```

**Login.tsx** — стейт для формы входа:

```tsx
const [email, setEmail] = useState("")
const [password, setPassword] = useState("")
const [error, setError] = useState("")
const [loading, setLoading] = useState(false)
const [passwordVisible, setPasswordVisible] = useState(false)
// ↑ показывать ли пароль открытым текстом или звёздочками

const [twoFactorPending, setTwoFactorPending] = useState<string | null>(null)
// ↑ null = обычный режим входа
// "токен..." = сервер попросил двухфакторный код, храним pendingToken

const [twoFactorCode, setTwoFactorCode] = useState("")
// ↑ 6-значный код из Google Authenticator который вводит пользователь
```

Обрати внимание: поле пароля связано со стейтом через два атрибута:
```tsx
<input
  value={password}                             // ← читаем стейт (что показывать)
  onChange={(e) => setPassword(e.target.value)} // ← записываем в стейт (что пользователь набрал)
/>
```
Это называется "контролируемый input" (controlled input) — React всегда знает что в поле.

---

### 2.2 useEffect — реакция на события

#### Что такое эффект?

**Аналогия:** Когда ты открываешь страницу в интернет-магазине, сайт автоматически загружает список товаров. Никто не нажимал кнопку "загрузить" — это произошло само потому что страница "появилась". Такую автоматическую реакцию и описывает `useEffect`.

#### Три режима useEffect

```tsx
// РЕЖИМ 1: запустить один раз при появлении компонента
useEffect(() => {
  // этот код выполнится один раз — когда компонент впервые появился на экране
}, [])  // ← пустой массив зависимостей

// РЕЖИМ 2: запускать каждый раз когда меняется period
useEffect(() => {
  // этот код выполнится когда компонент появился И каждый раз когда period изменится
}, [period])  // ← period в массиве зависимостей

// РЕЖИМ 3: запускать при каждом рендере (редко нужно)
useEffect(() => {
  // этот код выполнится при каждой перерисовке компонента
})  // ← без массива зависимостей вообще
```

#### Пример из Analytics.tsx

```tsx
useEffect(() => {
  // ─── Функция загрузки данных ───────────────────────────────────
  const load = async () => {
    setError("")      // сбрасываем предыдущую ошибку
    setLoading(true)  // показываем скелетоны пока грузим

    try {
      // делаем запрос к серверу: GET /analytics?period=week (или month)
      const data = await api.get<{
        values: number[]
        stats: { averageScore: string; solvedTasks: number; completedCourses: number }
      }>(`/analytics?period=${period}`)
      //                           ↑ подставляем текущий период в URL

      setValues(data.values)  // сохраняем данные графика
      setStats(data.stats)    // сохраняем статистику
    } catch (err) {
      // если запрос упал с ошибкой — показываем её пользователю
      setError(err instanceof Error ? err.message : "Ошибка загрузки")
    } finally {
      setLoading(false)  // убираем скелетоны в любом случае (и успех, и ошибка)
    }
  }

  void load()  // вызываем функцию. void = "нас не интересует возвращаемый Promise"

}, [period])
//  ↑ Этот эффект зависит от period.
//    Значит он запустится:
//    1) При первом появлении страницы (period = "week")
//    2) Когда пользователь нажмёт "Месяц" (period изменится на "month")
//    3) Если нажмёт "Неделя" снова (period вернётся на "week")
```

**Почему `void load()` а не просто `load()`?**

`useEffect` не может принять `async` функцию напрямую. Поэтому мы:
1. Создаём асинхронную функцию `load` внутри эффекта
2. Вызываем её через `void load()` — `void` говорит TypeScript "я знаю что это Promise, я намеренно его игнорирую"

#### Пример очистки в MainLayout.tsx

Иногда при "исчезновении" компонента нужно что-то отменить (таймер, подписку). Для этого эффект возвращает функцию очистки:

```tsx
useEffect(() => {
  void loadNotifications()  // загружаем уведомления при старте

  // подписываемся на кастомное событие обновления уведомлений
  const handler = () => void loadNotifications()
  window.addEventListener("gradus:notifications:refresh", handler)

  // ← возвращаемая функция вызывается когда компонент "исчезает" с экрана
  return () => window.removeEventListener("gradus:notifications:refresh", handler)
  //           ↑ отписываемся от события — иначе после удаления компонента
  //             обработчик останется "висеть" и будет вызываться вхолостую
}, [])
```

---

### 2.3 useMemo — запоминание результата вычисления

#### Что это такое?

**Аналогия:** Представь калькулятор который каждый раз заново считает одно и то же выражение. Если ты нажал 2+2=4 и ничего не менялось, зачем считать снова? `useMemo` запоминает результат и пересчитывает только когда данные реально изменились.

#### Когда использовать useMemo?

Когда у тебя есть "тяжёлое" вычисление (фильтрация большого массива, сложные расчёты) которое не нужно повторять при каждой перерисовке.

```tsx
const result = useMemo(() => {
  // это вычисление запустится только когда изменятся данные в [зависимости]
  return тяжёлоеВычисление(данные)
}, [данные])  // ← пересчитать только если данные изменились
```

#### Пример из RolesAccess.tsx — фильтрация таблицы пользователей:

```tsx
// members — массив всех пользователей платформы (может быть сотни)
// filter  — выбранная роль: "all" / "student" / "teacher" / "admin"
// query   — текст поиска по имени

const visible = useMemo(() => {
  // шаг 1: фильтруем по роли
  const base = filter === "all"
    ? members                                    // все пользователи
    : members.filter(m => m.role === filter)     // только с нужной ролью

  // шаг 2: фильтруем по поисковому запросу
  if (!query.trim()) return base  // если поиск пуст — возвращаем как есть

  const q = query.toLowerCase()
  return base.filter(m => m.name.toLowerCase().includes(q))

}, [members, filter, query])
// ↑ пересчитываем только когда изменился список, фильтр или строка поиска
// Если пользователь просто прокрутил страницу или открыл другое меню — НЕ пересчитываем
```

Без `useMemo` этот `.filter()` запускался бы при КАЖДОЙ перерисовке компонента, даже если `members`, `filter` и `query` не менялись.

#### Пример из MainLayout.tsx — счётчик непрочитанных уведомлений:

```tsx
// notifications — массив всех уведомлений с сервера
// readNotificationIds — Set<number> с id уже прочитанных уведомлений

const unreadNotificationsCount = useMemo(
  () => notifications.filter((n) => !readNotificationIds.has(n.id)).length,
  [notifications, readNotificationIds],
)
// ↑ этот счётчик используется в трёх местах JSX:
//   - красная точка на колокольчике
//   - число в бейдже внутри дропдауна
//   - условие показа кнопки "Прочитать всё"
// Без useMemo одно и то же .filter() выполнялось бы три раза при каждом рендере
```

---

### 2.4 useCallback — запоминание функции

#### В чём отличие от useMemo?

- `useMemo` запоминает **результат** вычисления (число, массив, объект)
- `useCallback` запоминает саму **функцию** (чтобы не создавать её заново при каждом рендере)

**Аналогия:** `useMemo` — это как записать ответ на листочке чтобы не считать снова. `useCallback` — это как создать ярлык на функцию, а не копировать всю функцию заново каждый раз.

#### Когда нужен useCallback?

Когда ты передаёшь функцию дочернему компоненту или используешь её в зависимостях другого хука. Без `useCallback` каждый рендер создаёт "новую" функцию (даже если код одинаковый), и дочерние компоненты перерисовываются без нужды.

#### Пример из useToast.tsx:

```tsx
// push — функция добавления тоста
// Она создаётся один раз и не пересоздаётся при каждом рендере ToastProvider
const push = useCallback((type: ToastType, message: string) => {
  const id = Date.now() + Math.floor(Math.random() * 1000)
  setToasts(prev => [...prev, { id, type, message }])

  // таймер на анимацию исчезновения
  setTimeout(() => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, dying: true } : t))
  }, 2800)

  // таймер на удаление из DOM
  setTimeout(() => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, 3200)
}, [])  // ← пустые зависимости = функция создаётся один раз навсегда

// useMemo использует push как зависимость
// Поскольку push мемоизирован — value тоже создаётся только один раз
const value = useMemo<ToastContextValue>(
  () => ({
    success: (message: string) => push("success", message),
    error:   (message: string) => push("error",   message),
  }),
  [push]  // ← пересоздать объект только если push изменился (а он не изменится)
)
```

---

### 2.5 useRef — прямой доступ к DOM элементу

#### Что такое ref?

**Аналогия:** Стейт — это как белая доска. Когда пишешь на ней — все видят изменения (компонент перерисовывается). Ref — это как блокнот в кармане. Ты записываешь туда что-то, но никто не перерисовывает доску. Плюс ref даёт доступ к реальному HTML элементу — как указатель мышью прямо на элемент в браузере.

#### Два применения useRef

**1. Прямой доступ к DOM элементу** (например, canvas, input):

```tsx
// AuthScreenShell.tsx — ref на canvas для анимации матричного дождя
const canvasRef = useRef<HTMLCanvasElement>(null)
//                       ↑ тип элемента    ↑ начальное значение (null пока элемент не появился)

// в JSX привязываем ref к элементу:
<canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

// теперь внутри useEffect можем получить реальный canvas и рисовать на нём:
useEffect(() => {
  const canvas = canvasRef.current  // ← .current это сам DOM элемент
  if (!canvas) return               // null если элемент ещё не появился
  const ctx = canvas.getContext("2d")
  // ... рисуем матричный дождь
}, [canvasRef, isDark])
```

Без ref нельзя рисовать на canvas. У React нет способа передать в JSX инструкции "получи 2D контекст и нарисуй линию" — для этого нужен прямой доступ к элементу.

**2. Хранилище значений без перерисовки:**

```tsx
// MainLayout.tsx — ссылка на div со списком уведомлений
const notificationsListRef = useRef<HTMLDivElement | null>(null)

// в JSX:
<div ref={notificationsListRef} onScroll={handleNotificationsScroll}>
  {/* список уведомлений */}
</div>

// в обработчике скролла:
const handleNotificationsScroll = (event: React.UIEvent<HTMLDivElement>) => {
  const el = event.currentTarget
  // проверяем долистал ли пользователь до конца списка
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 4) {
    markAllNotificationsRead()  // помечаем всё прочитанным
  }
}
```

```tsx
// useToast.tsx — хранение таймеров без перерисовки
// Map хранит соответствие id → таймер
// Если бы это был useState, каждое добавление таймера перерисовывало бы компонент
const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())
```

---

### 2.6 useContext / useTheme / useAppStore / useToast — глобальные данные

#### Проблема которую решает Context

Представь дерево компонентов: `App → MainLayout → Header → UserAvatar`. Каждому нужно знать имя пользователя. Без контекста пришлось бы передавать его через props на каждом уровне:

```tsx
// БЕЗ КОНТЕКСТА — "prop drilling" (протаскивание пропсов)
<App user={user}>
  <MainLayout user={user}>
    <Header user={user}>
      <UserAvatar user={user} />  // ← наконец-то до него добрались
    </Header>
  </MainLayout>
</App>
```

Это называется "prop drilling" и это больно. Контекст решает эту проблему — он как радиосигнал: передаётся "по воздуху" напрямую к любому компоненту без посредников.

#### Как контекст устроен в Gradus

В этом проекте три контекста:

**1. ThemeContext** — тема оформления (светлая/тёмная):
```tsx
// context/theme.ts — определение
export const ThemeContext = createContext<ThemeContextType | null>(null)

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) throw new Error("useTheme must be used within ThemeProvider")
  return context
}

// Как использовать в любом компоненте:
const { theme, toggleTheme } = useTheme()
// theme = "light" или "dark"
// toggleTheme() = переключить тему
```

**2. AppStoreContext** — пользователь, курсы, аутентификация:
```tsx
// store/AppStore.tsx
export function useAppStore() {
  const context = useContext(AppStoreContext)
  if (!context) throw new Error("useAppStore must be used inside AppStoreProvider")
  return context
}

// Как использовать:
const { user, login, logout } = useAppStore()
// user = { id, name, email, role } или null
// login(email, password) = войти в аккаунт
// logout() = выйти
```

**3. ToastContext** — всплывающие уведомления:
```tsx
// hooks/useToast.tsx
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used inside ToastProvider")
  return ctx
}

// Как использовать:
const toast = useToast()
toast.success("Сохранено!")   // зелёное уведомление
toast.error("Ошибка сети")   // красное уведомление
```

#### Как провайдеры обёртывают приложение

Посмотри на `main.tsx` — там все провайдеры вложены один в другой как матрёшки:

```tsx
// main.tsx (упрощённо)
<ThemeProvider>          // ← тема доступна всем
  <AppStoreProvider>     // ← пользователь и курсы доступны всем
    <ToastProvider>      // ← тосты доступны всем
      <App />            // ← само приложение
    </ToastProvider>
  </AppStoreProvider>
</ThemeProvider>
```

Теперь любой компонент в приложении может просто написать `const { user } = useAppStore()` и получить данные без каких-либо props.

---

## 3. Как данные приходят с бэкенда

### Полный путь запроса

```
Пользователь нажимает "Месяц"
    ↓
setPeriod("month") — React обновляет стейт
    ↓
useEffect([period]) запускается снова
    ↓
api.get("/analytics?period=month") — вызов из компонента
    ↓
services/api.ts — ищет подходящий маппинг в routeMappings
    ↓
routeMappings: pattern=/^\/analytics/ → passthrough → backendRequest("/analytics?period=month")
    ↓
fetch("https://api.gradus.ru/analytics?period=month", {
  headers: { Authorization: "Bearer eyJhbGc..." }
})
    ↓
nginx (на сервере) → FastAPI приложение
    ↓
FastAPI возвращает: { "values": [2,5,0,3,...], "stats": {...} }
    ↓
backendRequest разбирает JSON
    ↓
api.get возвращает данные в компонент
    ↓
setValues(data.values) → setStats(data.stats)
    ↓
React видит изменение стейта → перерисовывает компонент
    ↓
Пользователь видит обновлённый график
```

### Файл services/api.ts — сердце всех запросов

Этот файл один обслуживает ВСЕ запросы к серверу. Компоненты никогда не делают `fetch()` напрямую — только через `api.get`, `api.post`, `api.patch`, `api.delete`.

```tsx
// services/api.ts — публичный интерфейс
export const api = {
  // GET запрос — получить данные
  get: <T>(path: string) => request<T>(path),

  // POST запрос — отправить данные (создать что-то)
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),

  // PATCH запрос — обновить существующие данные
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),

  // DELETE запрос — удалить данные
  delete: <T>(path: string) =>
    request<T>(path, { method: "DELETE" }),
}
```

### Что такое `<T>` в api.get`<T>`?

`T` — это "дженерик" (обобщённый тип). Он говорит TypeScript: "функция вернёт данные типа T, но мы пока не знаем какого именно — укажем при вызове".

```tsx
// Без дженерика TypeScript не знает что вернёт api.get — получили бы unknown
const data = await api.get("/analytics?period=week")  // data = unknown, неудобно

// С дженериком TypeScript знает точную форму данных
const data = await api.get<{
  values: number[]
  stats: { averageScore: string; solvedTasks: number }
}>("/analytics?period=week")
// Теперь data.values — это number[], data.stats.averageScore — это string
// TypeScript подскажет ошибку если обратиться к data.values[0].title — у number нет title
```

### Зачем routeMappings?

Фронтенд и бэкенд могут говорить на разных "языках":

| Фронт вызывает | Реальный URL на бэке | Что трансформируется |
|---|---|---|
| `api.get("/courses")` | `GET /catalog` | `toCourse()` нормализует данные |
| `api.post("/auth/login", ...)` | `POST /auth/login` | сохраняются токены |
| `api.get("/dashboard")` | `GET /student/dashboard` | прямой проброс |

Компонент просто пишет `api.get("/courses")` и не знает что бэк на самом деле называет это `/catalog`. Вся магия трансляции — в `routeMappings`.

### Токены — как хранится авторизация

```
Пользователь вошёл через Login:
  POST /auth/login → { accessToken, refreshToken, user }
      ↓
  setTokens() → localStorage.setItem("gradus_access_token", "eyJ...")
               localStorage.setItem("gradus_refresh_token", "eyJ...")

При следующем запросе (например GET /analytics):
  backendRequest() вызывает getAccessToken()
      ↓
  localStorage.getItem("gradus_access_token") → "eyJ..."
      ↓
  headers: { Authorization: "Bearer eyJ..." }

Если access token истёк (через 15 минут):
  Сервер отвечает 401 Unauthorized
      ↓
  tryRefreshToken() → POST /auth/refresh с refreshToken
      ↓
  Сервер выдаёт новую пару токенов
      ↓
  setTokens() сохраняет новые токены
      ↓
  Исходный запрос повторяется с новым токеном
```

---

## 4. Структура папок проекта

```
frontend/
└── src/
    ├── pages/          Страницы приложения — каждый файл = отдельная страница
    │   ├── Analytics.tsx      /analytics — аналитика прогресса
    │   ├── Login.tsx          /login — вход в аккаунт
    │   ├── Dashboard.tsx      /dashboard — главная панель
    │   ├── Course.tsx         /course, /course/:id — список и страница курса
    │   ├── Task.tsx           /ai-review — задание с кодом
    │   ├── AiReview.tsx       /ai-chat — AI-чат ассистент
    │   ├── Register.tsx       /register — регистрация
    │   ├── AdminPanel.tsx     /admin — панель администратора
    │   ├── TeacherStudio.tsx  /teacher — кабинет преподавателя
    │   ├── AccountSettings.tsx /account — настройки аккаунта
    │   ├── RolesAccess.tsx    /roles-access — управление ролями
    │   └── ...
    │
    ├── components/     Переиспользуемые компоненты — используются на нескольких страницах
    │   ├── ui/
    │   │   └── Skeleton.tsx   — серая заглушка во время загрузки
    │   ├── auth/
    │   │   └── AuthScreenShell.tsx — обёртка для страниц входа/регистрации
    │   ├── BrandLogo.tsx      — логотип Gradus
    │   └── ParticleNetwork.tsx — анимированный фон
    │
    ├── layout/         Обёртки страниц — структура с сайдбаром и шапкой
    │   └── MainLayout.tsx     — главный лейаут: сайдбар + хедер + контент
    │
    ├── router/         Маршрутизация URL → компонент
    │   └── index.tsx          — таблица всех маршрутов приложения
    │
    ├── store/          Глобальное состояние — данные доступные всему приложению
    │   └── AppStore.tsx       — пользователь, курсы, методы входа/выхода
    │
    ├── context/        React контексты
    │   └── theme.ts           — переключение темы (светлая/тёмная)
    │
    ├── hooks/          Кастомные хуки — переиспользуемая логика
    │   └── useToast.tsx       — система всплывающих уведомлений
    │
    ├── lib/            Реэкспорт библиотек
    │   └── api.ts             — реэкспортирует { api } из services/api.ts
    │
    ├── services/       Сервисы — сложная логика работы с API
    │   └── api.ts             — весь HTTP слой: fetch, токены, маппинги
    │
    ├── features/       Фичи — самодостаточные части приложения
    │   └── auth/
    │       └── ProtectedRoute.tsx — компонент-охранник для защищённых маршрутов
    │
    ├── index.css       Глобальные стили: CSS переменные, .card, .btn-primary, ...
    ├── main.tsx        Точка входа: ReactDOM.render, провайдеры, BrowserRouter
    └── App.tsx         Корневой компонент: подключает Router
```

### Как это всё связано

```
main.tsx
  └── ThemeProvider
        └── AppStoreProvider
              └── ToastProvider
                    └── App.tsx
                          └── Router (router/index.tsx)
                                ├── / → Landing.tsx
                                ├── /login → Login.tsx
                                ├── /dashboard → ProtectedRoute → Dashboard.tsx
                                │                                    └── MainLayout
                                │                                          └── [контент]
                                └── ...
```

---

## 5. Шаблон типичной страницы

Разберём каждую строчку шаблона подробно:

```tsx
// ─── БЛОК 1: ИМПОРТЫ ──────────────────────────────────────────────────────
// React не нужно импортировать явно в современных версиях.
// useEffect — для загрузки данных при появлении страницы
// useState — для хранения данных, статуса загрузки и ошибок
import { useEffect, useState } from "react"

// MainLayout — компонент-обёртка: добавляет сайдбар, хедер, навигацию
// Без неё страница будет просто пустым экраном без интерфейса
import MainLayout from "../layout/MainLayout"

// api — объект с методами для запросов к серверу
// "../lib/api" это просто реэкспорт из services/api.ts
import { api } from "../lib/api"

// ─── БЛОК 2: ТИП ДАННЫХ ───────────────────────────────────────────────────
// Описываем ЧТО именно нам вернёт сервер.
// Это "договор" между фронтом и бэком.
// Если бэк вернёт поле name вместо title — TypeScript укажет на ошибку.
type Course = {
  id: number       // number = целое или дробное число: 1, 42, 3.14
  title: string    // string = текст: "Введение в Python"
  lessons: number  // тоже число
}

// ─── БЛОК 3: ОБЪЯВЛЕНИЕ КОМПОНЕНТА ────────────────────────────────────────
// export default — экспортируем как "главное" из файла
// function MyPage() — компонент это просто функция
// Имя с большой буквы обязательно — иначе React не поймёт что это компонент
export default function MyPage() {

  // ─── БЛОК 4: СТЕЙТ ──────────────────────────────────────────────────────
  // Три "стандартных" стейта которые есть почти на каждой странице:

  // courses — массив курсов которые придут с сервера
  // Course[] означает "массив объектов типа Course"
  // [] — начальное значение (пустой массив, пока данные не загружены)
  const [courses, setCourses] = useState<Course[]>([])

  // loading — показывает скелетоны или спиннер пока грузим данные
  // true — данные ещё не пришли, показываем индикатор загрузки
  // false — данные пришли, показываем настоящий контент
  const [loading, setLoading] = useState(true)

  // error — текст ошибки если запрос упал
  // "" — нет ошибки (пустая строка = falsy = условие {error && ...} не сработает)
  const [error, setError] = useState("")

  // ─── БЛОК 5: ЗАГРУЗКА ДАННЫХ ────────────────────────────────────────────
  // useEffect с [] запускается один раз — сразу когда страница появляется на экране
  useEffect(() => {
    // нельзя сделать useEffect async напрямую, поэтому создаём async функцию внутри
    const load = async () => {
      setLoading(true)   // начинаем загрузку → показываем индикатор

      try {
        // api.get<Course[]>("/courses") означает:
        //   сделай GET запрос на /courses
        //   ожидай что ответ будет Course[] (массив курсов)
        // await означает: подожди пока запрос завершится, потом продолжи
        const data = await api.get<Course[]>("/courses")
        setCourses(data)   // сохраняем данные в стейт → React перерисует компонент

      } catch (err) {
        // err instanceof Error — проверяем что это объект ошибки (а не строка или число)
        // err.message — текст ошибки от сервера ("Нет доступа", "Сервер недоступен")
        setError(err instanceof Error ? err.message : "Ошибка")

      } finally {
        // finally выполняется ВСЕГДА — и при успехе и при ошибке
        // это гарантирует что loading всегда вернётся в false
        // без finally: если catch не выполнился а try закинул ошибку → loading завис бы на true
        setLoading(false)
      }
    }

    // void — говорим TypeScript что мы намеренно не обрабатываем возвращаемый Promise
    // без void TS предупреждает: "Promises must be awaited..."
    void load()

  }, []) // пустой массив = запустить только один раз при первом рендере

  // ─── БЛОК 6: JSX — что показываем на экране ─────────────────────────────
  return (
    <MainLayout>  {/* оборачиваем в лейаут чтобы получить сайдбар и хедер */}

      {/* Паттерн 1: показываем текст пока грузим */}
      {/* {loading && <p>Загрузка...</p>} означает: ЕСЛИ loading равен true — показать <p> */}
      {loading && <p>Загрузка...</p>}

      {/* Паттерн 2: показываем ошибку если она есть */}
      {/* error — это строка, пустая строка "" это false, поэтому если ошибки нет — не показываем */}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {/* Паттерн 3: перебираем массив и рисуем по элементу для каждого */}
      {courses.map(course => (
        // key обязателен при .map() — React использует его чтобы понять
        // какой элемент изменился при обновлении массива
        // используем уникальный id из данных
        <div key={course.id}>
          <h2>{course.title}</h2>
          <p>{course.lessons} уроков</p>
        </div>
      ))}

    </MainLayout>
  )
}
```

---

## 6. CSS и Tailwind

### Что такое className?

В HTML атрибут называется `class`. В JSX (из-за того что `class` — зарезервированное слово JavaScript) он переименован в `className`:

```tsx
// HTML
<div class="card">...</div>

// JSX — всегда className, никогда class!
<div className="card">...</div>
```

### Что такое Tailwind?

Tailwind — библиотека маленьких утилитарных CSS классов. Вместо того чтобы писать CSS отдельно, ты пишешь классы прямо в JSX:

```tsx
// ОБЫЧНЫЙ CSS (два файла)
// styles.css:
// .my-button {
//   display: flex;
//   padding: 8px 16px;
//   border-radius: 8px;
//   background: blue;
//   color: white;
// }
// component.tsx:
<button className="my-button">Нажми меня</button>

// TAILWIND (один файл, всё в JSX)
<button className="flex px-4 py-2 rounded-lg bg-blue-500 text-white">
  Нажми меня
</button>
```

Tailwind-классы это просто очень короткие записи CSS:
- `flex` = `display: flex`
- `px-4` = `padding-left: 1rem; padding-right: 1rem`
- `py-2` = `padding-top: 0.5rem; padding-bottom: 0.5rem`
- `rounded-lg` = `border-radius: 0.5rem`
- `text-sm` = `font-size: 0.875rem`
- `font-bold` = `font-weight: 700`
- `space-y-6` = добавляет `margin-top: 1.5rem` между дочерними элементами
- `grid grid-cols-3 gap-4` = сетка из 3 колонок с отступом 1rem

### CSS переменные в этом проекте

В `src/index.css` определены переменные цветов:

```css
:root {
  --bg:      #FFFFFF;   /* основной фон */
  --surface: #F9F6F6;   /* фон карточек */
  --border:  #EDE8E8;   /* цвет рамок */
  --text:    #1A0A0A;   /* основной текст */
  --text-2:  #4A3030;   /* второстепенный текст */
  --muted:   #8A7070;   /* приглушённый текст (подписи, плейсхолдеры) */
  --primary: #DC2626;   /* акцентный красный */
}

.dark {
  --bg:      #100808;   /* те же переменные, но тёмные значения */
  --surface: #231212;
  --text:    #FAF5F5;
  /* ... */
}
```

В JSX обращаемся к ним через `var()`:
```tsx
<p className="text-[var(--muted)]">Подпись</p>
// ↑ это Tailwind-синтаксис для произвольного значения: text-[любое-значение]
// var(--muted) = #8A7070 в светлой теме, то же значение в тёмной (переопределено в .dark)
```

### Как работает тёмная тема

```
Пользователь нажимает "Тёмная тема"
    ↓
toggleTheme() в ThemeContext
    ↓
document.documentElement.classList.add("dark")
// или classList.remove("dark")
    ↓
CSS класс .dark применяется к <html> элементу
    ↓
CSS переменные в .dark { ... } перекрывают :root { ... }
    ↓
var(--bg) теперь возвращает #100808 вместо #FFFFFF
    ↓
Весь интерфейс автоматически становится тёмным
```

Дополнительно Tailwind поддерживает префикс `dark:`:
```tsx
<div className="bg-white dark:bg-gray-900">
  {/* светлая тема: bg-white, тёмная тема: bg-gray-900 */}
</div>
```

Когда на `<html>` есть класс `dark` — все `dark:` классы активируются.

### Кастомные CSS классы из index.css

В этом проекте определены несколько удобных классов:

```css
/* Карточка — белый фон, рамка, скруглённые углы, тень */
.card {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 1.25rem;
  box-shadow: var(--card-shadow);
}
```

```tsx
// Использование в JSX:
<div className="card p-6">  {/* card — стиль карточки, p-6 — Tailwind padding */}
  <h2>Заголовок карточки</h2>
</div>
```

```css
/* Основная кнопка — красный градиент с тенью */
.btn-primary {
  display: inline-flex;
  align-items: center;
  /* красный градиент из CSS переменных */
  background-image: linear-gradient(135deg, var(--btn-grad-from) 0%, var(--btn-grad-to) 100%);
}
```

```css
/* Поле ввода — рамка, скруглённые углы, подсветка при фокусе */
.input-field {
  width: 100%;
  border-radius: 0.75rem;
  border: 1px solid var(--border);
  /* при фокусе: красная обводка */
  /* focus:ring-2 focus:ring-primary/25 — Tailwind классы */
}
```

```tsx
// Использование в Login.tsx:
<input
  className="input-field pl-10 pr-4 py-3 text-sm"
  //          ↑ базовые стили  ↑ padding ↑ размер шрифта (дополнительные Tailwind классы)
/>
```

---

## 7. Роутинг

### Что такое маршрут?

**Аналогия:** В обычном сайте каждый URL — это отдельная HTML страница на сервере. В React приложении есть ОДНА HTML страница, но JavaScript меняет то что показывается в зависимости от URL. Это называется "одностраничное приложение" (SPA — Single Page Application).

React Router — библиотека которая читает текущий URL и показывает нужный компонент.

### Основные компоненты React Router

```tsx
// router/index.tsx — главный файл маршрутов

// Routes — контейнер всех маршрутов
// Route — один маршрут: URL → компонент
<Routes>
  <Route path="/" element={<Landing />} />
  //     ↑ URL    ↑ что показать
  
  <Route path="/login" element={<Login />} />
  <Route path="/dashboard" element={<Dashboard />} />
  
  {/* :courseId — динамический параметр, может быть любым числом */}
  <Route path="/course/:courseId" element={<Course />} />
  
  {/* * — "поймать всё остальное" — показываем 404 */}
  <Route path="*" element={<NotFound />} />
</Routes>
```

### Ленивая загрузка (lazy loading)

В этом проекте все страницы загружаются лениво — только когда пользователь переходит на них:

```tsx
// router/index.tsx
const Analytics = lazy(() => import("../pages/Analytics"))
//    ↑ переменная   ↑ загрузить только когда понадобится

// Оборачиваем в Suspense — показывает заглушку пока страница загружается
<Suspense fallback={<div>Загрузка страницы...</div>}>
  <Analytics />
</Suspense>
```

**Зачем это нужно?** Без ленивой загрузки весь JS всех страниц скачивается сразу при первом открытии сайта — это медленно. С ленивой загрузкой — только нужная страница.

### Навигация между страницами

```tsx
// 1. Link — ссылка (как <a href=...>), не перезагружает страницу
import { Link } from "react-router-dom"
<Link to="/dashboard">Перейти на дашборд</Link>

// 2. useNavigate — программный переход (после кнопки "Войти", "Сохранить")
import { useNavigate } from "react-router-dom"
const navigate = useNavigate()
navigate("/dashboard")        // перейти
navigate("/login")            // перейти на логин
navigate(-1)                  // назад как кнопка браузера

// 3. useParams — получить параметры из URL
import { useParams } from "react-router-dom"
// URL: /course/42
const { courseId } = useParams()
// courseId = "42" (всегда строка!)
const id = Number(courseId)  // преобразуем в число если нужно

// 4. useLocation — текущий URL
import { useLocation } from "react-router-dom"
const { pathname } = useLocation()
// pathname = "/course/42"
```

### ProtectedRoute — охранник маршрутов

```tsx
// features/auth/ProtectedRoute.tsx (упрощённо)
function ProtectedRoute({ children, allowedRoles }) {
  const { user, loadingUser } = useAppStore()

  // пока проверяем авторизацию — ничего не показываем
  if (loadingUser) return <div>Проверка доступа...</div>

  // не залогинен → на страницу входа
  if (!user) return <Navigate to="/login" />

  // залогинен но нет нужной роли → на дашборд
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" />
  }

  // всё ок → показываем страницу
  return children
}

// Использование в router/index.tsx:
<Route
  path="/admin"
  element={
    <ProtectedRoute allowedRoles={["admin"]}>
      <AdminPanel />  // ← покажется только если user.role === "admin"
    </ProtectedRoute>
  }
/>
```

---

## 8. AppStore — глобальный стейт

### Что хранится в AppStore

```tsx
// store/AppStore.tsx
type AppStoreContextValue = {
  user: PublicUser | null   // кто залогинен, null = никто
  courses: Course[]         // каталог курсов (загружается при старте)
  loadingUser: boolean      // true пока проверяем /auth/me при старте
  loadingCourses: boolean   // true пока грузятся курсы

  // методы:
  refreshUser: () => Promise<void>    // обновить данные пользователя
  login: (email, password) => Promise<LoginResult>  // войти
  verifyTwoFactor: (pendingToken, code) => Promise<PublicUser>  // 2FA
  register: (name, email, password) => Promise<void>  // зарегистрироваться
  logout: () => Promise<void>         // выйти
  refreshCourses: () => Promise<void> // обновить список курсов
}
```

### Как получить пользователя в любом компоненте

```tsx
import { useAppStore } from "../store/AppStore"

function MyComponent() {
  const { user } = useAppStore()

  if (!user) {
    return <p>Вы не залогинены</p>
  }

  return (
    <div>
      <p>Привет, {user.name}!</p>
      <p>Email: {user.email}</p>
      <p>Роль: {user.role}</p>    {/* "student" | "teacher" | "admin" */}
    </div>
  )
}
```

### Как работает login

```tsx
// AppStore.tsx — функция login
const login = async (email: string, password: string) => {
  // POST /auth/login → { kind: "authenticated", user } ИЛИ { kind: "twoFactorRequired", pendingToken }
  const result = await api.post<LoginResult>("/auth/login", { email, password })

  if (result.kind === "authenticated") {
    setUser(result.user)    // ← записываем пользователя в глобальный стейт
    await refreshCourses()  // ← параллельно обновляем курсы
  }

  return result  // ← возвращаем в компонент чтобы он решил что делать дальше
}

// Login.tsx — использует login
const { login } = useAppStore()
const result = await login(email, password)

if (result.kind === "authenticated") {
  navigate("/dashboard")  // переходим на дашборд
} else if (result.kind === "twoFactorRequired") {
  setTwoFactorPending(result.pendingToken)  // показываем форму 2FA
}
```

### Как работает logout

```tsx
// AppStore.tsx
const logout = async () => {
  // 1. Уведомляем сервер — бэк инвалидирует refresh token в базе
  await api.post<{ success: boolean }>("/auth/logout", {})
  // ↑ api.ts автоматически вызывает clearTokens() в маппинге /auth/logout
  //   clearTokens() удаляет оба токена из localStorage

  // 2. Обнуляем пользователя в стейте — React перерисует все компоненты
  setUser(null)
  // ProtectedRoute увидит user === null и перенаправит на /login
}
```

---

## 9. Реальные примеры из проекта

### Пример 1: Analytics.tsx — переключатель периода и график

Полный поток данных:

```
Пользователь открывает /analytics
    ↓
Analytics() рендерится, useState инициализирует:
  period = "week"
  values = []
  loading = true
  stats = { averageScore: "0%", ... }
    ↓
useEffect([period]) запускается (period = "week")
    ↓
api.get("/analytics?period=week")
    ↓
Сервер возвращает:
{
  "values": [5, 3, 0, 8, 2, 0, 4],   // 7 дней: пн-вс
  "stats": {
    "averageScore": "42%",
    "solvedTasks": 22,
    "completedCourses": 1
  }
}
    ↓
setValues([5, 3, 0, 8, 2, 0, 4])
setStats({ averageScore: "42%", solvedTasks: 22, completedCourses: 1 })
setLoading(false)
    ↓
React перерисовывает компонент
```

**Как рисуется график:**
```tsx
// max — максимальное значение в периоде (бар с этим значением = 100% ширина)
const max = Math.max(...values, 1)
// Math.max(5, 3, 0, 8, 2, 0, 4, 1) = 8
// ,1 — защита от деления на ноль если все values = 0

{values.map((v, i) => (
  <div key={i} className="flex items-center gap-3">
    <span>{period === "week" ? `День ${i + 1}` : `Нед. ${i + 1}`}</span>

    {/* полоска бара */}
    <div className="flex-1 h-2 rounded-full bg-[var(--border)]">
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${(v / max) * 100}%` }}
        // для дня 4 (v=8): (8/8)*100 = 100%
        // для дня 1 (v=5): (5/8)*100 = 62.5%
        // для дня 3 (v=0): (0/8)*100 = 0%
      />
    </div>

    {/* число со склонением */}
    <span>{v} {v === 1 ? "шаг" : v < 5 ? "шага" : "шагов"}</span>
    // 1 → "шаг", 2,3,4 → "шага", 5+ → "шагов", 0 → "шагов"
  </div>
))}
```

**Что происходит при нажатии "Месяц":**
```
setPeriod("month")
    ↓
React обновляет стейт, period = "month"
    ↓
useEffect([period]) видит что period изменился → запускается снова
    ↓
api.get("/analytics?period=month")
    ↓
Сервер возвращает 4 числа (по неделям)
    ↓
setValues([12, 8, 15, 5])
    ↓
График перерисовывается с новыми данными
    ↓
Кнопка "Месяц" подсвечивается: period === "month" → className="btn-gradient"
```

---

### Пример 2: Login.tsx — двухфакторная аутентификация

**Шаг 1 — обычный вход:**
```
Пользователь вводит email и password
    ↓
handleLogin() вызывается (клик или Enter)
    ↓
validate() проверяет email регуляркой и длину пароля
    ↓
store.login("ivan@example.com", "mypassword123")
    ↓
POST /auth/login { email, password }
```

**Сценарий А — 2FA не включена:**
```
Сервер возвращает: { kind: "authenticated", user: { id: 1, name: "Иван", ... } }
    ↓
AppStore: setUser(user) — пользователь записан в глобальный стейт
    ↓
Login: toast.success("Вход выполнен")
    ↓
navigate("/dashboard") — переходим на главную
```

**Сценарий Б — 2FA включена:**
```
Сервер возвращает: { kind: "twoFactorRequired", pendingToken: "eyJ..." }
    ↓
Login: setTwoFactorPending("eyJ...")  // стейт изменился
    ↓
React перерисовывает форму:
  - email/password поля СКРЫВАЮТСЯ: {!twoFactorPending && (...)}
  - поле для 6-значного кода ПОКАЗЫВАЕТСЯ: {twoFactorPending && (...)}
    ↓
Пользователь открывает Google Authenticator и вводит 6 цифр
    ↓
handleTwoFactorVerify()
    ↓
store.verifyTwoFactor(twoFactorPending, "123456")
    ↓
POST /auth/2fa/verify { pendingToken: "eyJ...", code: "123456" }
    ↓
Сервер проверяет TOTP код → выдаёт полноценные accessToken и refreshToken
    ↓
AppStore: setUser(user)
    ↓
navigate("/dashboard")
```

**Как ограничивается ввод кода (только цифры, максимум 6):**
```tsx
<input
  type="text"
  inputMode="numeric"           // ← мобильная клавиатура с цифрами
  maxLength={6}                 // ← HTML ограничение
  value={twoFactorCode}
  onChange={(e) => setTwoFactorCode(
    e.target.value
      .replace(/\D/g, "")       // ← удаляем всё кроме цифр (\D = не цифра)
      .slice(0, 6)              // ← обрезаем до 6 символов
  )}
/>
```

---

### Пример 3: MainLayout — уведомления и localStorage

**Зачем localStorage?**

Когда пользователь читает уведомление, мы хотим запомнить это. Но хранить это на сервере — лишняя нагрузка. Вместо этого сохраняем id прочитанных уведомлений прямо в браузере:

```
Загрузка уведомлений с сервера:
  GET /notifications → [{ id: 1, title: "...", time: "..." }, { id: 2, ... }]
      ↓
  setNotifications([...])

Загрузка прочитанных id из localStorage:
  localStorage.getItem("gradus_read_notifications_v1")
  → "[1, 3, 5]"  (JSON строка)
      ↓
  JSON.parse → [1, 3, 5]  (массив)
      ↓
  new Set([1, 3, 5])  (Set для быстрой проверки .has(id))
      ↓
  readNotificationIds = Set{1, 3, 5}

В JSX:
  const isUnread = !readNotificationIds.has(item.id)
  // id=1: Set.has(1) = true → isUnread = false → нет красной точки
  // id=2: Set.has(2) = false → isUnread = true → показываем красную точку
```

**Что происходит при клике на уведомление:**
```tsx
onClick={() => {
  if (!isUnread) return  // уже прочитано — ничего не делаем

  const next = new Set(readNotificationIds)  // копируем Set (не мутируем оригинал!)
  next.add(item.id)                          // добавляем прочитанный id

  setReadNotificationIds(next)               // обновляем стейт → React перерисует
  persistReadIds(next)                       // сохраняем в localStorage
  //                                            (JSON.stringify(Array.from(next)))
}}
```

---

### Пример 4: ThemeContext — переключение темы

```
Пользователь нажимает "Тёмная тема" в сайдбаре MainLayout
    ↓
toggleTheme() из useTheme()
    ↓
ThemeProvider (в App.tsx):
  setTheme(prev => prev === "light" ? "dark" : "light")
    ↓
useEffect([theme]) в ThemeProvider:
  if (theme === "dark") {
    document.documentElement.classList.add("dark")
    localStorage.setItem("theme", "dark")
  } else {
    document.documentElement.classList.remove("dark")
    localStorage.setItem("theme", "light")
  }
    ↓
CSS: .dark { --bg: #100808; ... }
  var(--bg) теперь возвращает тёмное значение
    ↓
Весь интерфейс становится тёмным мгновенно
    ↓
При следующем открытии страницы:
  localStorage.getItem("theme") → "dark"
  useState(localStorage.getItem("theme") || "light") → начинаем с тёмной темы
```

В компонентах:
```tsx
// MainLayout.tsx — кнопка переключения в нижней части сайдбара
const { theme, toggleTheme } = useTheme()

<button onClick={toggleTheme}>
  {/* показываем иконку противоположной темы (подсказка что нажать) */}
  {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
  {theme === "light" ? "Тёмная тема" : "Светлая тема"}
</button>
```

---

### Пример 5: useToast — всплывающие уведомления

**Полный жизненный цикл тоста:**

```
Любой компонент: toast.success("Курс сохранён!")
    ↓
push("success", "Курс сохранён!")
    ↓
id = Date.now() + random  (например 1716800000123)

setToasts(prev => [...prev, { id, type: "success", message: "Курс сохранён!", dying: false }])
    ↓
React перерисовывает контейнер тостов
    ↓
Новый <div> появляется с анимацией toast-in (CSS: opacity 0→1, translateX вправо→0)
    ↓
── 2800 миллисекунд проходит ──
    ↓
setTimeout: setToasts(prev => prev.map(t =>
  t.id === id ? { ...t, dying: true } : t
))
    ↓
React: dying = true → animation: "toast-out 0.3s" → тост начинает исчезать
    ↓
── ещё 400 миллисекунд (анимация исчезновения) ──
    ↓
setTimeout: setToasts(prev => prev.filter(t => t.id !== id))
    ↓
React: тост удалён из массива → исчезает из DOM
```

**Почему два таймера а не один?**
Нельзя удалить элемент из DOM в момент когда на нём играет CSS анимация исчезновения — анимация оборвётся и исчезновение будет резким. Поэтому сначала запускаем анимацию (2800ms), ждём пока она закончится (400ms), потом удаляем (3200ms итого).

```tsx
// Использование во всех компонентах проекта:
const toast = useToast()

// При успешном сохранении:
toast.success("Настройки сохранены")

// При ошибке сети:
toast.error("Не удалось подключиться к серверу")

// В Login.tsx — двойное уведомление (в форме + тост):
setError(msg)        // показываем ошибку внутри формы (красный текст)
toast.error(msg)     // показываем тост в правом верхнем углу
```

---

## 10. Типичные паттерны

### Паттерн 1: Загрузка данных (loading / error / data)

Этот паттерн встречается абсолютно на каждой странице:

```tsx
const [data, setData] = useState<SomeType[]>([])
const [loading, setLoading] = useState(true)
const [error, setError] = useState("")

useEffect(() => {
  const load = async () => {
    setLoading(true)
    setError("")
    try {
      const result = await api.get<SomeType[]>("/endpoint")
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка")
    } finally {
      setLoading(false)
    }
  }
  void load()
}, [])

// В JSX:
{loading && <Skeleton />}                     // показываем пока грузим
{error && <p className="text-red-500">{error}</p>}  // показываем ошибку
{!loading && !error && data.map(...)}         // показываем данные
```

### Паттерн 2: Оптимистичное обновление

Иногда не нужно ждать ответа от сервера — можно сразу обновить UI и если сервер вернёт ошибку — откатить:

```tsx
// RolesAccess.tsx — смена роли пользователя
const changeRole = async (member: Member, newRole: Member["role"]) => {
  // ШАГ 1: ОПТИМИСТИЧНО обновляем UI (не ждём сервер)
  setMembers(prev =>
    prev.map(m => m.id === member.id ? { ...m, role: newRole } : m)
    // {...m, role: newRole} = копия объекта с изменённым полем role
  )

  try {
    // ШАГ 2: Отправляем запрос на сервер
    await api.patch(`/roles-members/${member.id}`, { role: newRole })
    toast.success(`Роль изменена на ${ROLE_LABELS[newRole]}`)
  } catch (err) {
    // ШАГ 3: Если ошибка — откатываем изменение
    setMembers(prev =>
      prev.map(m => m.id === member.id ? { ...m, role: member.role } : m)
      // возвращаем прежнюю роль (member.role — старое значение из замыкания)
    )
    toast.error(err instanceof Error ? err.message : "Ошибка")
  }
}
```

Плюс: интерфейс реагирует мгновенно, не нужно ждать сервер.
Минус: если сервер вернёт ошибку — нужно откатить изменения.

### Паттерн 3: Фильтрация через useMemo

```tsx
// Вместо того чтобы фильтровать в render-функции каждый раз:
const filtered = useMemo(() => {
  return items.filter(item => {
    if (filterRole !== "all" && item.role !== filterRole) return false
    if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })
}, [items, filterRole, searchQuery])
// пересчитывается только когда реально что-то изменилось
```

### Паттерн 4: Контролируемая форма с валидацией

```tsx
// Стейт для каждого поля
const [email, setEmail] = useState("")
const [password, setPassword] = useState("")
const [error, setError] = useState("")

// Функция валидации — возвращает строку ошибки или ""
const validate = () => {
  if (!email.includes("@")) return "Введите корректный email"
  if (password.length < 8)  return "Пароль минимум 8 символов"
  return ""  // всё ок
}

const handleSubmit = async () => {
  const err = validate()
  if (err) { setError(err); return }  // ← ранний выход при ошибке валидации

  // ... отправляем запрос
}

// В JSX:
<input
  value={email}
  onChange={(e) => {
    setEmail(e.target.value)
    if (error) setError("")  // сбрасываем ошибку когда пользователь начинает исправлять
  }}
/>
{error && <p className="text-red-500 text-sm">{error}</p>}
```

### Паттерн 5: Условный рендер

```tsx
// Способ 1: && (и) — показать если условие истинно
{loading && <p>Загрузка...</p>}
// Если loading = true → рендерит <p>
// Если loading = false → рендерит false (ничего)
// ВАЖНО: не используй числа: {count && <p>...} — если count=0, React рендерит "0"

// Способ 2: тернарный оператор — показать одно из двух
{loading ? <Skeleton /> : <RealContent />}
// loading = true → Skeleton
// loading = false → RealContent

// Способ 3: сложное условие для состояний
{!loading && !error && data.length === 0 && (
  <p>Данных нет</p>
)}
{!loading && !error && data.length > 0 && (
  <ul>...</ul>
)}

// Способ 4: явный null — ничего не рендерим
if (someCondition) return null
```

### Паттерн 6: Иммутабельное обновление стейта

React не увидит изменения если мутировать объект напрямую. Всегда нужно создавать новый объект/массив:

```tsx
// ПЛОХО — мутируем оригинал, React не заметит
const arr = [...courses]
arr[0].title = "Новое название"  // мутация!
setCourses(arr)  // React видит тот же массив и не перерисовывает

// ХОРОШО — создаём новый объект
setCourses(prev =>
  prev.map(course =>
    course.id === targetId
      ? { ...course, title: "Новое название" }  // новый объект с изменённым полем
      : course  // остальные без изменений
  )
)

// ХОРОШО — добавляем элемент
setCourses(prev => [...prev, newCourse])

// ХОРОШО — удаляем элемент
setCourses(prev => prev.filter(course => course.id !== targetId))
```

---

## 11. TypeScript в этом проекте

### Зачем вообще TypeScript?

JavaScript позволяет писать вот такое:
```js
function greet(user) {
  return "Привет, " + user.nme  // опечатка: nme вместо name
}
// Ошибку увидишь только когда запустишь программу и дойдёшь до этого кода
```

TypeScript ловит такие ошибки ещё при написании кода:
```ts
type User = { name: string }

function greet(user: User) {
  return "Привет, " + user.nme
  //                       ^^^
  // Ошибка TypeScript: Property 'nme' does not exist on type 'User'
  // Это написано ещё до запуска!
}
```

### type — описание формы данных

```tsx
// Простой тип
type Course = {
  id: number        // только числа: 1, 42, -5
  title: string     // только строки: "Python", "JavaScript"
  lessons: number
  published?: boolean  // ← ? означает "необязательное поле" (может быть undefined)
  price: string
}

// Тип-объединение — значение может быть одним из перечисленных
type Role = "student" | "teacher" | "admin"
// Только эти три строки, ничего другого TypeScript не пропустит

// Другой пример из Login.tsx:
const [period, setPeriod] = useState<"week" | "month">("week")
// TypeScript не позволит: setPeriod("year") — ошибка компиляции
// Только "week" или "month"
```

### Дженерики — `<T>` в функциях

```tsx
// api.get<T> — T это "переменная типа"
// Ты говоришь: "эта функция вернёт данные типа T, тип подставим при вызове"
get: <T>(path: string) => request<T>(path)

// При вызове указываем конкретный тип:
const courses = await api.get<Course[]>("/courses")
//                              ↑ T = Course[] (массив курсов)
// Теперь TypeScript знает: courses это Course[]
// Можно писать courses[0].title без ошибок

const user = await api.get<PublicUser>("/auth/me")
//                           ↑ T = PublicUser
// user.name — ок
// user.xxx — ошибка TS
```

### Почему `useState<Course[]>([])` а не просто `useState([])`

```tsx
// БЕЗ типа — TypeScript выводит тип из начального значения
const [courses, setCourses] = useState([])
// TypeScript видит []: это never[] — массив из nothing
// setCourses([...]) — ошибка, потому что тип был выведен как never[]

// С типом — явно говорим что будет в массиве
const [courses, setCourses] = useState<Course[]>([])
// [] — начальное значение (пустой массив)
// Course[] — ожидаемый тип элементов
// setCourses([{ id: 1, title: "Python", lessons: 10, ... }]) — ок
```

### Полезные TypeScript операторы

```tsx
// Опциональная цепочка ?.
// Безопасно обращаемся к свойству которое может быть null/undefined
user?.name        // если user = null → undefined (не ошибка!)
user?.role === "admin"  // если user = null → false (не ошибка!)

// В противовес небезопасному обращению:
user.name  // если user = null → TypeError: Cannot read property 'name' of null

// Оператор ?? (nullish coalescing)
const name = user?.name ?? "Гость"
// если user?.name = undefined или null → "Гость"
// если user?.name = "" (пустая строка) → ""  (в отличие от ||)

// Non-null assertion ! (используй осторожно)
const canvas = canvasRef.current!  // говоришь TS: "я уверен что это не null"
// если ошибся и там всё-таки null → runtime ошибка, TS не предупредит
```

---

## 12. Частые ошибки и как их читать

### Как открыть консоль браузера

Нажми `F12` (или `Cmd+Option+I` на Mac) → вкладка **Console**. Там будут все ошибки красным цветом.

### Ошибка 1: Cannot read property 'X' of null / undefined

```
TypeError: Cannot read properties of null (reading 'name')
```

**Что это значит:** Ты пытаешься обратиться к свойству `name` у объекта который равен `null`.

**Где искать:**
```tsx
// Скорее всего у тебя что-то вроде:
const user = useAppStore().user  // user может быть null!
return <p>{user.name}</p>        // Ошибка если user = null

// Исправление:
return <p>{user?.name}</p>       // опциональная цепочка
// или:
if (!user) return null
return <p>{user.name}</p>        // теперь безопасно
```

### Ошибка 2: Each child in a list should have a unique "key" prop

```
Warning: Each child in a list should have a unique "key" prop.
```

**Что это значит:** При использовании `.map()` каждый элемент должен иметь уникальный `key`.

```tsx
// ПЛОХО — нет key
{courses.map(course => (
  <div>{course.title}</div>
))}

// ХОРОШО — уникальный key из данных
{courses.map(course => (
  <div key={course.id}>{course.title}</div>
))}

// ПЛОХО — key это индекс (работает но может вызвать баги при удалении/перестановке)
{courses.map((course, index) => (
  <div key={index}>{course.title}</div>
))}
```

### Ошибка 3: Too many re-renders

```
Error: Too many re-renders. React limits the number of renders to prevent an infinite loop.
```

**Что это значит:** Компонент рендерится бесконечно. Обычно причина — вызов setState прямо в теле компонента (не в обработчике и не в useEffect):

```tsx
// ПЛОХО — вызываем setState при каждом рендере → снова рендеримся → снова setState → ...
function MyComponent() {
  const [count, setCount] = useState(0)
  setCount(1)   // ← ЭТО ВЫЗЫВАЕТ БЕСКОНЕЧНЫЙ ЦИКЛ!
  return <div>{count}</div>
}

// ХОРОШО — setState только в обработчиках событий или useEffect
function MyComponent() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(1)}>{count}</button>
}
```

### Ошибка 4: 401 Unauthorized в Network

Открой `F12 → Network → XHR`. Если видишь запрос с красным статусом 401:

```
GET /analytics → 401 Unauthorized
```

**Значит:** токен истёк или не был передан. Обычно api.ts сам обновляет токен — но если `refreshToken` тоже истёк, пользователь будет перенаправлен на `/login`.

### Ошибка 5: 404 Not Found

```
GET /cources → 404 Not Found  (опечатка в URL)
```

Проверь URL запроса. Часто опечатка в строке пути: `/cources` вместо `/courses`.

### Ошибка 6: Objects are not valid as a React child

```
Error: Objects are not valid as a React child (found: object with keys {id, name}).
```

**Что это значит:** Ты пытаешься рендерить объект напрямую. React умеет рендерить строки, числа, JSX. Объекты — нет.

```tsx
// ПЛОХО
const user = { id: 1, name: "Иван" }
return <p>{user}</p>  // Ошибка! Объект нельзя рендерить

// ХОРОШО — достаём нужное поле
return <p>{user.name}</p>  // рендерим строку "Иван"
```

### Ошибка 7: useEffect бесконечный цикл

```tsx
// ПЛОХО — объект/массив в зависимостях пересоздаётся каждый рендер
useEffect(() => {
  fetchData(filters)
}, [filters])  // filters = { role: "admin" } — новый объект при каждом рендере!

// Каждый рендер создаёт новый объект filters
// useEffect видит "новую" зависимость → запускается → setState → ре-рендер → новый объект → ...

// ИСПРАВЛЕНИЕ — примитивные значения не пересоздаются
useEffect(() => {
  fetchData(filterRole)
}, [filterRole])  // filterRole = "admin" — строка, не пересоздаётся
```

### Ошибка 8: Не обновляется UI после изменения данных

```tsx
// ПЛОХО — мутируем массив, React не видит изменений
const newCourses = courses
newCourses.push(newCourse)  // ← мутация существующего массива!
setCourses(newCourses)      // React видит тот же массив → не перерисовывает

// ХОРОШО — создаём новый массив
setCourses([...courses, newCourse])
// или через функцию обновления:
setCourses(prev => [...prev, newCourse])
```

### Где ещё смотреть ошибки

- **Console** (F12) — JavaScript ошибки и предупреждения React
- **Network** (F12) — все HTTP запросы, их статусы и ответы
- **Elements** (F12) — HTML структура, можно проверить CSS
- Терминал где запущен `npm run dev` — ошибки TypeScript при сборке

---

## Итог

Ты прочитал весь гайд. Вот краткий чеклист для понимания любого файла в этом проекте:

1. **Смотри на импорты** — они скажут от чего зависит компонент
2. **Найди `useState`** — это данные которые может показывать или менять компонент
3. **Найди `useEffect`** — это когда и как грузятся данные с сервера
4. **Найди `api.get/post/patch/delete`** — это все запросы к бэкенду
5. **Смотри на `return`** — это то что видит пользователь
6. **Фигурные скобки `{}`** в JSX — это JavaScript выражения (условия, циклы, переменные)
7. **`className`** — это CSS классы (Tailwind или кастомные из index.css)

Для большинства страниц цикл один: появилась страница → `useEffect` грузит данные → `setState` сохраняет их → React рисует интерфейс → пользователь нажимает кнопку → снова запрос → снова `setState` → снова рисует.

Удачи в изучении!
