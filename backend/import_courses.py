"""
Import realistic IT courses into Gradus database.
Courses inspired by Stepik-style educational content with
real theory, quizzes with correct answers, and code tasks with automated tests.

Usage:
    cd backend
    python import_courses.py
"""
from __future__ import annotations

import asyncio
import json
import random
import re

import asyncpg

from app.config import settings


COURSES = [
    {
        "title": "Основы Python: от нуля до первого проекта",
        "slug": "python-basics-zero-to-project",
        "description": "Научитесь программировать на Python с нуля. Переменные, типы данных, условия, циклы, функции, работа с файлами и создание первого консольного проекта.",
        "level": "Beginner",
        "category": "Programming",
        "duration_hours": 40,
        "rating": 4.7,
        "students_count": random.randint(800, 2500),
        "modules": [
            {
                "title": "Введение в Python",
                "lessons": [
                    {
                        "title": "Что такое Python и где он используется",
                        "theory": (
                            "Python — это высокоуровневый интерпретируемый язык программирования, созданный Гвидо ван Россумом в 1991 году. "
                            "Он используется в веб-разработке (Django, FastAPI), Data Science (pandas, NumPy), машинном обучении (TensorFlow, PyTorch), "
                            "автоматизации, DevOps и многих других областях.\n\n"
                            "Основные преимущества Python:\n"
                            "• Простой и читаемый синтаксис\n"
                            "• Огромная экосистема библиотек\n"
                            "• Кроссплатформенность\n"
                            "• Большое сообщество разработчиков\n\n"
                            "Python — один из самых популярных языков программирования в мире по индексу TIOBE."
                        ),
                        "quiz_question": "Кто создал Python?",
                        "quiz_options": ["Джеймс Гослинг", "Гвидо ван Россум", "Брендан Эйх", "Деннис Ритчи"],
                        "quiz_correct": 1,
                        "assignment": {
                            "title": "Первая программа на Python",
                            "description": "Напишите программу, которая выводит 'Hello, World!' и ваше имя на отдельной строке. Используйте функцию print().",
                            "tests": [
                                {"name": "Используется print()", "type": "regex", "pattern": "print\\s*\\("},
                                {"name": "Есть Hello, World!", "type": "includesAny", "tokens": ["hello, world", "hello world"]},
                                {"name": "Два вызова print или перенос строки", "type": "regex", "pattern": "(print.*\\n.*print)|(\\\\n)"},
                            ],
                        },
                    },
                    {
                        "title": "Переменные и типы данных",
                        "theory": (
                            "В Python переменные создаются при первом присваивании значения. Тип определяется автоматически.\n\n"
                            "Основные типы данных:\n"
                            "• int — целые числа: age = 25\n"
                            "• float — дробные числа: price = 19.99\n"
                            "• str — строки: name = 'Alice'\n"
                            "• bool — логические значения: is_active = True\n"
                            "• list — списки: items = [1, 2, 3]\n"
                            "• dict — словари: user = {'name': 'Bob', 'age': 30}\n\n"
                            "Для проверки типа используйте функцию type():\n"
                            ">>> type(42)\n"
                            "<class 'int'>\n\n"
                            "Преобразование типов: int('42') → 42, str(42) → '42', float('3.14') → 3.14"
                        ),
                        "quiz_question": "Какой тип данных у значения 3.14?",
                        "quiz_options": ["int", "float", "str", "decimal"],
                        "quiz_correct": 1,
                        "assignment": {
                            "title": "Работа с переменными",
                            "description": "Создайте переменные name (строка), age (целое число), height (дробное число). Выведите их с помощью print() и f-string: f'Имя: {name}, Возраст: {age}, Рост: {height}'",
                            "tests": [
                                {"name": "Есть переменная name", "type": "regex", "pattern": "name\\s*=\\s*['\"]"},
                                {"name": "Есть переменная age", "type": "regex", "pattern": "age\\s*=\\s*\\d+"},
                                {"name": "Есть переменная height", "type": "regex", "pattern": "height\\s*=\\s*\\d+\\.\\d+"},
                                {"name": "Используется f-string или format", "type": "includesAny", "tokens": ["f'", 'f"', ".format("]},
                            ],
                        },
                    },
                ],
            },
            {
                "title": "Управляющие конструкции",
                "lessons": [
                    {
                        "title": "Условные операторы if/elif/else",
                        "theory": (
                            "Условные операторы позволяют выполнять разные блоки кода в зависимости от условия.\n\n"
                            "Синтаксис:\n"
                            "```python\n"
                            "if условие:\n"
                            "    # блок кода\n"
                            "elif другое_условие:\n"
                            "    # блок кода\n"
                            "else:\n"
                            "    # блок кода\n"
                            "```\n\n"
                            "Операторы сравнения: == (равно), != (не равно), > (больше), < (меньше), >= (больше или равно), <= (меньше или равно).\n\n"
                            "Логические операторы: and, or, not.\n\n"
                            "Пример:\n"
                            "```python\n"
                            "age = 18\n"
                            "if age >= 18:\n"
                            "    print('Совершеннолетний')\n"
                            "else:\n"
                            "    print('Несовершеннолетний')\n"
                            "```"
                        ),
                        "quiz_question": "Какой оператор используется для проверки равенства в Python?",
                        "quiz_options": ["=", "==", "===", "equals()"],
                        "quiz_correct": 1,
                        "assignment": {
                            "title": "Определение времени суток",
                            "description": "Напишите программу, которая по переменной hour (0-23) определяет время суток: 'Утро' (6-11), 'День' (12-17), 'Вечер' (18-22), 'Ночь' (23-5). Используйте if/elif/else.",
                            "tests": [
                                {"name": "Есть if", "type": "regex", "pattern": "\\bif\\b"},
                                {"name": "Есть elif", "type": "regex", "pattern": "\\belif\\b"},
                                {"name": "Есть else", "type": "regex", "pattern": "\\belse\\b"},
                                {"name": "Проверка hour", "type": "includesAny", "tokens": ["hour", "час"]},
                                {"name": "Есть print", "type": "regex", "pattern": "print\\s*\\("},
                            ],
                        },
                    },
                    {
                        "title": "Циклы for и while",
                        "theory": (
                            "Циклы позволяют повторять блок кода несколько раз.\n\n"
                            "Цикл for — для перебора элементов:\n"
                            "```python\n"
                            "for i in range(5):\n"
                            "    print(i)  # 0, 1, 2, 3, 4\n\n"
                            "fruits = ['яблоко', 'банан', 'вишня']\n"
                            "for fruit in fruits:\n"
                            "    print(fruit)\n"
                            "```\n\n"
                            "Цикл while — пока условие истинно:\n"
                            "```python\n"
                            "count = 0\n"
                            "while count < 5:\n"
                            "    print(count)\n"
                            "    count += 1\n"
                            "```\n\n"
                            "Управление циклом:\n"
                            "• break — прервать цикл\n"
                            "• continue — перейти к следующей итерации\n"
                            "• else — выполняется, если цикл завершился без break"
                        ),
                        "quiz_question": "Что выведет range(3)?",
                        "quiz_options": ["1, 2, 3", "0, 1, 2", "0, 1, 2, 3", "1, 2"],
                        "quiz_correct": 1,
                        "assignment": {
                            "title": "Таблица умножения",
                            "description": "Напишите программу, которая выводит таблицу умножения для числа n (от 1 до 10). Каждая строка в формате: 'n x i = результат'. Используйте цикл for и range().",
                            "tests": [
                                {"name": "Есть цикл for", "type": "regex", "pattern": "\\bfor\\b"},
                                {"name": "Используется range", "type": "regex", "pattern": "range\\s*\\("},
                                {"name": "Есть умножение", "type": "includesAny", "tokens": ["*"]},
                                {"name": "Есть print", "type": "regex", "pattern": "print\\s*\\("},
                            ],
                        },
                    },
                ],
            },
            {
                "title": "Функции и модули",
                "lessons": [
                    {
                        "title": "Создание и вызов функций",
                        "theory": (
                            "Функции — это именованные блоки кода, которые можно вызывать многократно.\n\n"
                            "Определение функции:\n"
                            "```python\n"
                            "def greet(name):\n"
                            "    return f'Привет, {name}!'\n\n"
                            "result = greet('Мир')\n"
                            "print(result)  # Привет, Мир!\n"
                            "```\n\n"
                            "Параметры по умолчанию:\n"
                            "```python\n"
                            "def power(base, exp=2):\n"
                            "    return base ** exp\n\n"
                            "print(power(3))     # 9\n"
                            "print(power(3, 3))  # 27\n"
                            "```\n\n"
                            "Функция может возвращать несколько значений через tuple:\n"
                            "```python\n"
                            "def min_max(lst):\n"
                            "    return min(lst), max(lst)\n\n"
                            "lo, hi = min_max([3, 1, 4, 1, 5])\n"
                            "```"
                        ),
                        "quiz_question": "Какое ключевое слово используется для определения функции в Python?",
                        "quiz_options": ["function", "func", "def", "define"],
                        "quiz_correct": 2,
                        "assignment": {
                            "title": "Калькулятор функций",
                            "description": "Создайте функции add(a, b), subtract(a, b), multiply(a, b), divide(a, b). Функция divide должна проверять деление на ноль и возвращать 'Ошибка: деление на ноль'.",
                            "tests": [
                                {"name": "Есть def add", "type": "regex", "pattern": "def\\s+add\\s*\\("},
                                {"name": "Есть def subtract", "type": "regex", "pattern": "def\\s+subtract\\s*\\("},
                                {"name": "Есть def multiply", "type": "regex", "pattern": "def\\s+multiply\\s*\\("},
                                {"name": "Есть def divide", "type": "regex", "pattern": "def\\s+divide\\s*\\("},
                                {"name": "Проверка деления на ноль", "type": "includesAny", "tokens": ["== 0", "!= 0", "ZeroDivision", "деление на ноль"]},
                                {"name": "Используется return", "type": "regex", "pattern": "\\breturn\\b"},
                            ],
                        },
                    },
                ],
            },
            {
                "title": "Работа со строками и коллекциями",
                "lessons": [
                    {
                        "title": "Строковые методы и форматирование",
                        "theory": (
                            "Строки в Python — это неизменяемые последовательности символов.\n\n"
                            "Основные методы строк:\n"
                            "• upper() / lower() — регистр\n"
                            "• strip() — удаление пробелов по краям\n"
                            "• split(sep) — разбиение на список\n"
                            "• join(iterable) — объединение списка в строку\n"
                            "• replace(old, new) — замена подстроки\n"
                            "• find(sub) / index(sub) — поиск подстроки\n"
                            "• startswith() / endswith() — проверка начала/конца\n"
                            "• count(sub) — подсчёт вхождений\n\n"
                            "Форматирование:\n"
                            "```python\n"
                            "name = 'Python'\n"
                            "version = 3.12\n"
                            "# f-string (рекомендуется)\n"
                            "print(f'{name} {version}')\n"
                            "# .format()\n"
                            "print('{} {}'.format(name, version))\n"
                            "```\n\n"
                            "Срезы:\n"
                            "```python\n"
                            "s = 'Hello, World'\n"
                            "s[0:5]   # 'Hello'\n"
                            "s[::-1]  # 'dlroW ,olleH'\n"
                            "```"
                        ),
                        "quiz_question": "Какой метод разбивает строку на список?",
                        "quiz_options": ["join()", "split()", "slice()", "break()"],
                        "quiz_correct": 1,
                        "assignment": {
                            "title": "Анализ текста",
                            "description": "Напишите функцию analyze_text(text), которая принимает строку и возвращает словарь с ключами: 'words' (количество слов), 'chars' (количество символов без пробелов), 'upper' (текст в верхнем регистре). Используйте методы split(), replace(), upper(), len().",
                            "tests": [
                                {"name": "Есть функция analyze_text", "type": "regex", "pattern": "def\\s+analyze_text\\s*\\("},
                                {"name": "Используется split()", "type": "includesAny", "tokens": [".split("]},
                                {"name": "Используется upper()", "type": "includesAny", "tokens": [".upper("]},
                                {"name": "Используется len()", "type": "regex", "pattern": "\\blen\\s*\\("},
                                {"name": "Возвращается словарь", "type": "includesAny", "tokens": ["return {", "return{"]},
                            ],
                        },
                    },
                    {
                        "title": "Списки и словари",
                        "theory": (
                            "Списки — упорядоченные изменяемые коллекции:\n"
                            "```python\n"
                            "nums = [1, 2, 3]\n"
                            "nums.append(4)     # [1, 2, 3, 4]\n"
                            "nums.insert(0, 0)  # [0, 1, 2, 3, 4]\n"
                            "nums.pop()         # [0, 1, 2, 3]\n"
                            "nums.sort()        # сортировка на месте\n"
                            "```\n\n"
                            "List comprehension:\n"
                            "```python\n"
                            "squares = [x**2 for x in range(10)]\n"
                            "evens = [x for x in range(20) if x % 2 == 0]\n"
                            "```\n\n"
                            "Словари — пары ключ-значение:\n"
                            "```python\n"
                            "user = {'name': 'Alice', 'age': 30}\n"
                            "user['email'] = 'alice@example.com'  # добавление\n"
                            "name = user.get('name', 'Unknown')   # безопасное чтение\n"
                            "for key, value in user.items():\n"
                            "    print(f'{key}: {value}')\n"
                            "```"
                        ),
                        "quiz_question": "Какой метод добавляет элемент в конец списка?",
                        "quiz_options": ["add()", "push()", "append()", "insert()"],
                        "quiz_correct": 2,
                        "assignment": {
                            "title": "Подсчёт слов в тексте",
                            "description": "Напишите функцию word_count(text), которая принимает строку и возвращает словарь, где ключ — слово (в нижнем регистре), значение — количество повторений. Пример: word_count('Кот и кот') → {'кот': 2, 'и': 1}",
                            "tests": [
                                {"name": "Есть функция word_count", "type": "regex", "pattern": "def\\s+word_count\\s*\\("},
                                {"name": "Используется split()", "type": "includesAny", "tokens": [".split("]},
                                {"name": "Используется lower()", "type": "includesAny", "tokens": [".lower("]},
                                {"name": "Используется словарь", "type": "includesAny", "tokens": ["{}", "dict("]},
                                {"name": "Возвращается результат", "type": "regex", "pattern": "\\breturn\\b"},
                            ],
                        },
                    },
                ],
            },
        ],
    },
    {
        "title": "JavaScript: современный язык для веба",
        "slug": "javascript-modern-web",
        "description": "Полный курс по JavaScript ES6+. Основы языка, DOM, async/await, Fetch API, модули и создание интерактивных веб-приложений.",
        "level": "Beginner",
        "category": "Programming",
        "duration_hours": 35,
        "rating": 4.5,
        "students_count": random.randint(600, 1800),
        "modules": [
            {
                "title": "Основы JavaScript",
                "lessons": [
                    {
                        "title": "Переменные: let, const и var",
                        "theory": (
                            "В современном JavaScript используются три способа объявления переменных:\n\n"
                            "• const — константа, нельзя переприсвоить (рекомендуется по умолчанию)\n"
                            "• let — переменная с блочной областью видимости\n"
                            "• var — устаревший способ, функциональная область видимости\n\n"
                            "```javascript\n"
                            "const PI = 3.14159;        // нельзя изменить\n"
                            "let counter = 0;           // можно менять\n"
                            "counter++;                 // 1\n\n"
                            "// const для объектов — можно менять свойства\n"
                            "const user = { name: 'Alice' };\n"
                            "user.name = 'Bob'; // ОК\n"
                            "// user = {};       // Ошибка!\n"
                            "```\n\n"
                            "Типы данных: number, string, boolean, null, undefined, object, symbol, bigint."
                        ),
                        "quiz_question": "Какой способ объявления переменных рекомендуется по умолчанию в ES6+?",
                        "quiz_options": ["var", "let", "const", "define"],
                        "quiz_correct": 2,
                        "assignment": {
                            "title": "Работа с переменными JS",
                            "description": "Объявите переменные: const для PI и имени приложения, let для счётчика. Используйте template literal для вывода строки: `Приложение: ${appName}, PI = ${PI}, счётчик: ${counter}`",
                            "tests": [
                                {"name": "Есть const", "type": "regex", "pattern": "\\bconst\\b"},
                                {"name": "Есть let", "type": "regex", "pattern": "\\blet\\b"},
                                {"name": "Используется template literal", "type": "regex", "pattern": "`.*\\$\\{"},
                                {"name": "Нет var", "type": "regex", "pattern": "^(?!.*\\bvar\\b)"},
                            ],
                        },
                    },
                    {
                        "title": "Функции и стрелочные функции",
                        "theory": (
                            "Способы объявления функций в JavaScript:\n\n"
                            "Function Declaration:\n"
                            "```javascript\n"
                            "function greet(name) {\n"
                            "  return `Привет, ${name}!`;\n"
                            "}\n"
                            "```\n\n"
                            "Arrow Function (стрелочная):\n"
                            "```javascript\n"
                            "const greet = (name) => `Привет, ${name}!`;\n\n"
                            "// Многострочная:\n"
                            "const sum = (a, b) => {\n"
                            "  const result = a + b;\n"
                            "  return result;\n"
                            "};\n"
                            "```\n\n"
                            "Деструктуризация параметров:\n"
                            "```javascript\n"
                            "const getFullName = ({ firstName, lastName }) =>\n"
                            "  `${firstName} ${lastName}`;\n\n"
                            "getFullName({ firstName: 'John', lastName: 'Doe' });\n"
                            "```\n\n"
                            "Параметры по умолчанию:\n"
                            "```javascript\n"
                            "const greet = (name = 'Мир') => `Привет, ${name}!`;\n"
                            "```"
                        ),
                        "quiz_question": "Какой символ используется в стрелочных функциях?",
                        "quiz_options": ["->", "=>", ">>", "~>"],
                        "quiz_correct": 1,
                        "assignment": {
                            "title": "Стрелочные функции",
                            "description": "Создайте стрелочные функции: square (возведение в квадрат), isEven (проверка чётности), filterPositive (фильтрация положительных чисел из массива через .filter()).",
                            "tests": [
                                {"name": "Есть стрелочная функция", "type": "regex", "pattern": "=>"},
                                {"name": "Есть square", "type": "includesAny", "tokens": ["square"]},
                                {"name": "Есть isEven", "type": "includesAny", "tokens": ["iseven", "is_even"]},
                                {"name": "Используется filter", "type": "includesAny", "tokens": [".filter("]},
                                {"name": "Проверка чётности", "type": "includesAny", "tokens": ["% 2"]},
                            ],
                        },
                    },
                ],
            },
            {
                "title": "Работа с DOM и событиями",
                "lessons": [
                    {
                        "title": "Поиск и изменение элементов DOM",
                        "theory": (
                            "DOM (Document Object Model) — программный интерфейс для HTML-документов.\n\n"
                            "Поиск элементов:\n"
                            "```javascript\n"
                            "const el = document.getElementById('myId');\n"
                            "const el = document.querySelector('.myClass');\n"
                            "const els = document.querySelectorAll('p');\n"
                            "```\n\n"
                            "Изменение содержимого:\n"
                            "```javascript\n"
                            "el.textContent = 'Новый текст';     // только текст\n"
                            "el.innerHTML = '<b>Жирный</b>';     // HTML\n"
                            "```\n\n"
                            "Работа с классами:\n"
                            "```javascript\n"
                            "el.classList.add('active');\n"
                            "el.classList.remove('active');\n"
                            "el.classList.toggle('active');\n"
                            "```\n\n"
                            "Создание элементов:\n"
                            "```javascript\n"
                            "const div = document.createElement('div');\n"
                            "div.textContent = 'Привет';\n"
                            "document.body.appendChild(div);\n"
                            "```"
                        ),
                        "quiz_question": "Какой метод ищет первый элемент по CSS-селектору?",
                        "quiz_options": ["getElementById()", "querySelector()", "getElementsByClassName()", "find()"],
                        "quiz_correct": 1,
                        "assignment": {
                            "title": "Управление DOM",
                            "description": "Напишите код, который: 1) Находит элемент с id='output', 2) Создаёт новый <p> элемент, 3) Добавляет ему класс 'highlight', 4) Задаёт текст 'Динамический контент', 5) Вставляет в #output.",
                            "tests": [
                                {"name": "Используется querySelector или getElementById", "type": "includesAny", "tokens": ["queryselector", "getelementbyid"]},
                                {"name": "Создаётся элемент", "type": "includesAny", "tokens": ["createelement"]},
                                {"name": "Добавляется класс", "type": "includesAny", "tokens": ["classlist.add"]},
                                {"name": "Задаётся текст", "type": "includesAny", "tokens": ["textcontent", "innerhtml", "innertext"]},
                                {"name": "Элемент вставляется", "type": "includesAny", "tokens": ["appendchild", "append"]},
                            ],
                        },
                    },
                ],
            },
            {
                "title": "Асинхронный JavaScript",
                "lessons": [
                    {
                        "title": "Promise и async/await",
                        "theory": (
                            "Promise — объект, представляющий результат асинхронной операции.\n\n"
                            "Состояния Promise:\n"
                            "• pending — ожидание\n"
                            "• fulfilled — выполнен успешно\n"
                            "• rejected — выполнен с ошибкой\n\n"
                            "```javascript\n"
                            "const promise = new Promise((resolve, reject) => {\n"
                            "  setTimeout(() => resolve('Данные'), 1000);\n"
                            "});\n\n"
                            "promise.then(data => console.log(data));\n"
                            "```\n\n"
                            "async/await — синтаксический сахар над Promise:\n"
                            "```javascript\n"
                            "async function fetchUser(id) {\n"
                            "  try {\n"
                            "    const response = await fetch(`/api/users/${id}`);\n"
                            "    const user = await response.json();\n"
                            "    return user;\n"
                            "  } catch (error) {\n"
                            "    console.error('Ошибка:', error);\n"
                            "  }\n"
                            "}\n"
                            "```"
                        ),
                        "quiz_question": "Какое ключевое слово приостанавливает выполнение async-функции до завершения Promise?",
                        "quiz_options": ["yield", "wait", "await", "pause"],
                        "quiz_correct": 2,
                        "assignment": {
                            "title": "Fetch API",
                            "description": "Напишите async-функцию fetchData(url), которая использует fetch() для получения данных, парсит JSON и возвращает результат. Обработайте ошибки через try/catch. Проверяйте response.ok.",
                            "tests": [
                                {"name": "Есть async function", "type": "regex", "pattern": "async\\s+(function|\\()"},
                                {"name": "Используется await", "type": "includesAny", "tokens": ["await"]},
                                {"name": "Используется fetch", "type": "includesAny", "tokens": ["fetch("]},
                                {"name": "Парсинг JSON", "type": "includesAny", "tokens": [".json()"]},
                                {"name": "Обработка ошибок", "type": "includesAny", "tokens": ["try", "catch"]},
                            ],
                        },
                    },
                ],
            },
        ],
    },
    {
        "title": "SQL и базы данных: PostgreSQL",
        "slug": "sql-postgresql-mastery",
        "description": "Изучите SQL от простых запросов до сложных аналитических: SELECT, JOIN, подзапросы, оконные функции, индексы и оптимизация.",
        "level": "Intermediate",
        "category": "Databases",
        "duration_hours": 30,
        "rating": 4.8,
        "students_count": random.randint(500, 1500),
        "modules": [
            {
                "title": "Основы SQL",
                "lessons": [
                    {
                        "title": "SELECT, WHERE, ORDER BY",
                        "theory": (
                            "SQL (Structured Query Language) — язык для работы с реляционными базами данных.\n\n"
                            "Базовый запрос:\n"
                            "```sql\n"
                            "SELECT column1, column2\n"
                            "FROM table_name\n"
                            "WHERE условие\n"
                            "ORDER BY column1 ASC;\n"
                            "```\n\n"
                            "Фильтрация:\n"
                            "• WHERE age > 18\n"
                            "• WHERE name LIKE '%ов%'\n"
                            "• WHERE status IN ('active', 'pending')\n"
                            "• WHERE created_at BETWEEN '2024-01-01' AND '2024-12-31'\n"
                            "• WHERE email IS NOT NULL\n\n"
                            "Сортировка: ORDER BY column ASC|DESC\n"
                            "Ограничение: LIMIT 10 OFFSET 20\n\n"
                            "Агрегатные функции: COUNT(), SUM(), AVG(), MIN(), MAX()"
                        ),
                        "quiz_question": "Какой оператор используется для фильтрации строк в SQL?",
                        "quiz_options": ["FILTER", "WHERE", "HAVING", "WHEN"],
                        "quiz_correct": 1,
                        "assignment": {
                            "title": "Запросы SELECT",
                            "description": "Напишите SQL-запрос, который выбирает из таблицы users поля name и email, где role='student', age > 18, отсортирует по name и ограничит результат 10 записями.",
                            "tests": [
                                {"name": "Есть SELECT", "type": "includesAny", "tokens": ["select"]},
                                {"name": "Есть FROM users", "type": "includesAny", "tokens": ["from users"]},
                                {"name": "Есть WHERE", "type": "includesAny", "tokens": ["where"]},
                                {"name": "Фильтр по role", "type": "includesAny", "tokens": ["role"]},
                                {"name": "Есть ORDER BY", "type": "includesAny", "tokens": ["order by"]},
                                {"name": "Есть LIMIT", "type": "includesAny", "tokens": ["limit"]},
                            ],
                        },
                    },
                    {
                        "title": "JOIN — объединение таблиц",
                        "theory": (
                            "JOIN позволяет объединять данные из нескольких таблиц.\n\n"
                            "Типы JOIN:\n"
                            "• INNER JOIN — только совпадающие строки\n"
                            "• LEFT JOIN — все из левой + совпадения из правой\n"
                            "• RIGHT JOIN — все из правой + совпадения из левой\n"
                            "• FULL OUTER JOIN — все строки из обеих таблиц\n"
                            "• CROSS JOIN — декартово произведение\n\n"
                            "```sql\n"
                            "SELECT u.name, o.total\n"
                            "FROM users u\n"
                            "INNER JOIN orders o ON o.user_id = u.id\n"
                            "WHERE o.total > 1000;\n"
                            "```\n\n"
                            "Множественные JOIN:\n"
                            "```sql\n"
                            "SELECT u.name, c.title, e.progress\n"
                            "FROM users u\n"
                            "JOIN enrollments e ON e.user_id = u.id\n"
                            "JOIN courses c ON c.id = e.course_id;\n"
                            "```"
                        ),
                        "quiz_question": "Какой JOIN возвращает все строки из левой таблицы?",
                        "quiz_options": ["INNER JOIN", "LEFT JOIN", "RIGHT JOIN", "CROSS JOIN"],
                        "quiz_correct": 1,
                        "assignment": {
                            "title": "Запросы с JOIN",
                            "description": "Напишите запрос, который выводит имя студента, название курса и прогресс, объединяя таблицы users, enrollments и courses. Отфильтруйте только активные записи (status='active').",
                            "tests": [
                                {"name": "Есть SELECT", "type": "includesAny", "tokens": ["select"]},
                                {"name": "Есть JOIN", "type": "includesAny", "tokens": ["join"]},
                                {"name": "Объединение с users", "type": "includesAny", "tokens": ["users"]},
                                {"name": "Объединение с courses", "type": "includesAny", "tokens": ["courses"]},
                                {"name": "Объединение с enrollments", "type": "includesAny", "tokens": ["enrollments"]},
                                {"name": "Фильтр по status", "type": "includesAny", "tokens": ["status"]},
                            ],
                        },
                    },
                ],
            },
            {
                "title": "Продвинутый SQL",
                "lessons": [
                    {
                        "title": "Подзапросы и CTE",
                        "theory": (
                            "Подзапросы — запросы внутри других запросов:\n\n"
                            "```sql\n"
                            "-- Скалярный подзапрос\n"
                            "SELECT name, salary,\n"
                            "  (SELECT AVG(salary) FROM employees) AS avg_salary\n"
                            "FROM employees;\n\n"
                            "-- В WHERE\n"
                            "SELECT * FROM employees\n"
                            "WHERE salary > (SELECT AVG(salary) FROM employees);\n\n"
                            "-- EXISTS\n"
                            "SELECT * FROM users u\n"
                            "WHERE EXISTS (\n"
                            "  SELECT 1 FROM orders o WHERE o.user_id = u.id\n"
                            ");\n"
                            "```\n\n"
                            "CTE (Common Table Expressions):\n"
                            "```sql\n"
                            "WITH active_students AS (\n"
                            "  SELECT user_id, COUNT(*) as course_count\n"
                            "  FROM enrollments\n"
                            "  WHERE status = 'active'\n"
                            "  GROUP BY user_id\n"
                            ")\n"
                            "SELECT u.name, a.course_count\n"
                            "FROM users u\n"
                            "JOIN active_students a ON a.user_id = u.id\n"
                            "ORDER BY a.course_count DESC;\n"
                            "```"
                        ),
                        "quiz_question": "Как расшифровывается CTE?",
                        "quiz_options": ["Common Table Expression", "Create Table Expression", "Computed Table Entity", "Common Temporary Entity"],
                        "quiz_correct": 0,
                        "assignment": {
                            "title": "CTE и подзапросы",
                            "description": "Напишите запрос с CTE, который: 1) В CTE находит топ-5 студентов по количеству завершённых курсов, 2) В основном запросе выводит их имена и количество курсов, объединяя с таблицей users.",
                            "tests": [
                                {"name": "Используется WITH (CTE)", "type": "includesAny", "tokens": ["with "]},
                                {"name": "Есть SELECT", "type": "includesAny", "tokens": ["select"]},
                                {"name": "Есть COUNT", "type": "includesAny", "tokens": ["count("]},
                                {"name": "Есть GROUP BY", "type": "includesAny", "tokens": ["group by"]},
                                {"name": "Есть JOIN", "type": "includesAny", "tokens": ["join"]},
                                {"name": "Есть LIMIT или TOP", "type": "includesAny", "tokens": ["limit", "top "]},
                            ],
                        },
                    },
                ],
            },
        ],
    },
    {
        "title": "Git и GitHub: система контроля версий",
        "slug": "git-github-version-control",
        "description": "Освойте Git от init до rebase. Ветвление, слияние, конфликты, pull requests, GitHub Actions и работа в команде.",
        "level": "Beginner",
        "category": "DevOps",
        "duration_hours": 15,
        "rating": 4.6,
        "students_count": random.randint(1000, 3000),
        "modules": [
            {
                "title": "Основы Git",
                "lessons": [
                    {
                        "title": "Инициализация и первые коммиты",
                        "theory": (
                            "Git — распределённая система контроля версий, созданная Линусом Торвальдсом.\n\n"
                            "Основные команды:\n"
                            "```bash\n"
                            "git init                    # Инициализация репозитория\n"
                            "git add file.txt            # Добавить файл в индекс\n"
                            "git add .                   # Добавить все файлы\n"
                            "git commit -m 'Сообщение'   # Создать коммит\n"
                            "git status                  # Статус файлов\n"
                            "git log --oneline           # История коммитов\n"
                            "git diff                    # Показать изменения\n"
                            "```\n\n"
                            "Области Git:\n"
                            "• Working directory — рабочая папка\n"
                            "• Staging area (index) — подготовка к коммиту\n"
                            "• Repository — история коммитов\n\n"
                            "Файл .gitignore — список файлов и папок, которые Git должен игнорировать:\n"
                            "```\n"
                            "node_modules/\n"
                            ".env\n"
                            "*.pyc\n"
                            "__pycache__/\n"
                            "```"
                        ),
                        "quiz_question": "Какая команда добавляет файл в staging area?",
                        "quiz_options": ["git commit", "git add", "git push", "git stage"],
                        "quiz_correct": 1,
                        "assignment": {
                            "title": "Базовые команды Git",
                            "description": "Опишите последовательность Git-команд для: 1) Инициализации репозитория, 2) Создания файла .gitignore с правилом для node_modules, 3) Добавления всех файлов, 4) Создания коммита с сообщением 'Initial commit'.",
                            "tests": [
                                {"name": "Есть git init", "type": "includesAny", "tokens": ["git init"]},
                                {"name": "Есть .gitignore", "type": "includesAny", "tokens": [".gitignore"]},
                                {"name": "Есть node_modules", "type": "includesAny", "tokens": ["node_modules"]},
                                {"name": "Есть git add", "type": "includesAny", "tokens": ["git add"]},
                                {"name": "Есть git commit", "type": "includesAny", "tokens": ["git commit"]},
                            ],
                        },
                    },
                    {
                        "title": "Ветвление и слияние",
                        "theory": (
                            "Ветки позволяют разрабатывать функциональность изолированно.\n\n"
                            "```bash\n"
                            "git branch feature          # Создать ветку\n"
                            "git checkout feature        # Переключиться\n"
                            "git checkout -b feature     # Создать и переключиться\n"
                            "git switch -c feature       # Современный аналог\n"
                            "```\n\n"
                            "Слияние:\n"
                            "```bash\n"
                            "git checkout main\n"
                            "git merge feature           # Слить feature в main\n"
                            "```\n\n"
                            "При конфликте Git помечает файлы:\n"
                            "```\n"
                            "<<<<<<< HEAD\n"
                            "ваши изменения\n"
                            "=======\n"
                            "чужие изменения\n"
                            ">>>>>>> feature\n"
                            "```\n\n"
                            "Стратегии слияния:\n"
                            "• Merge — сохраняет историю ветвления\n"
                            "• Rebase — линейная история\n"
                            "• Squash merge — один коммит из ветки"
                        ),
                        "quiz_question": "Какая команда создаёт новую ветку и сразу переключается на неё?",
                        "quiz_options": ["git branch -b new", "git checkout -b new", "git switch new", "git create new"],
                        "quiz_correct": 1,
                        "assignment": {
                            "title": "Сценарий ветвления",
                            "description": "Опишите полный workflow: 1) Создание ветки feature/auth, 2) Работа в ветке (коммиты), 3) Переключение на main, 4) Слияние feature/auth в main, 5) Удаление ветки feature/auth.",
                            "tests": [
                                {"name": "Создание ветки", "type": "includesAny", "tokens": ["checkout -b", "switch -c", "branch "]},
                                {"name": "Есть коммит", "type": "includesAny", "tokens": ["git commit"]},
                                {"name": "Переключение на main", "type": "includesAny", "tokens": ["checkout main", "switch main"]},
                                {"name": "Слияние", "type": "includesAny", "tokens": ["git merge"]},
                                {"name": "Удаление ветки", "type": "includesAny", "tokens": ["branch -d", "branch -D"]},
                            ],
                        },
                    },
                ],
            },
        ],
    },
    {
        "title": "HTML и CSS: вёрстка с нуля",
        "slug": "html-css-from-scratch",
        "description": "Научитесь создавать адаптивные веб-страницы. HTML5 семантика, CSS Flexbox, Grid, анимации, адаптивный дизайн и BEM-методология.",
        "level": "Beginner",
        "category": "Web",
        "duration_hours": 25,
        "rating": 4.4,
        "students_count": random.randint(700, 2000),
        "modules": [
            {
                "title": "HTML5 основы",
                "lessons": [
                    {
                        "title": "Семантическая вёрстка",
                        "theory": (
                            "Семантические теги HTML5 придают смысл структуре страницы:\n\n"
                            "• <header> — шапка сайта или секции\n"
                            "• <nav> — навигация\n"
                            "• <main> — основное содержимое (один на страницу)\n"
                            "• <article> — самостоятельная статья\n"
                            "• <section> — тематическая группировка\n"
                            "• <aside> — боковая панель\n"
                            "• <footer> — подвал\n"
                            "• <figure> / <figcaption> — иллюстрации с подписью\n\n"
                            "Пример структуры:\n"
                            "```html\n"
                            "<body>\n"
                            "  <header>\n"
                            "    <nav>...</nav>\n"
                            "  </header>\n"
                            "  <main>\n"
                            "    <article>\n"
                            "      <h1>Заголовок</h1>\n"
                            "      <section>...</section>\n"
                            "    </article>\n"
                            "    <aside>...</aside>\n"
                            "  </main>\n"
                            "  <footer>...</footer>\n"
                            "</body>\n"
                            "```\n\n"
                            "Преимущества: SEO, доступность, читаемость кода."
                        ),
                        "quiz_question": "Какой тег должен быть на странице только один раз?",
                        "quiz_options": ["<header>", "<section>", "<main>", "<article>"],
                        "quiz_correct": 2,
                        "assignment": {
                            "title": "Семантическая структура",
                            "description": "Создайте HTML-разметку блога с использованием семантических тегов: header с nav, main с article и aside, footer. В article добавьте h1, два параграфа и figure с figcaption.",
                            "tests": [
                                {"name": "Есть <header>", "type": "includesAny", "tokens": ["<header"]},
                                {"name": "Есть <nav>", "type": "includesAny", "tokens": ["<nav"]},
                                {"name": "Есть <main>", "type": "includesAny", "tokens": ["<main"]},
                                {"name": "Есть <article>", "type": "includesAny", "tokens": ["<article"]},
                                {"name": "Есть <aside>", "type": "includesAny", "tokens": ["<aside"]},
                                {"name": "Есть <footer>", "type": "includesAny", "tokens": ["<footer"]},
                                {"name": "Есть <figure>", "type": "includesAny", "tokens": ["<figure"]},
                            ],
                        },
                    },
                ],
            },
            {
                "title": "CSS Flexbox и Grid",
                "lessons": [
                    {
                        "title": "Flexbox: гибкие раскладки",
                        "theory": (
                            "Flexbox — одномерная модель раскладки (строка или столбец).\n\n"
                            "Контейнер:\n"
                            "```css\n"
                            ".container {\n"
                            "  display: flex;\n"
                            "  flex-direction: row | column;\n"
                            "  justify-content: center;      /* ось X */\n"
                            "  align-items: center;           /* ось Y */\n"
                            "  flex-wrap: wrap;               /* перенос */\n"
                            "  gap: 16px;                     /* отступы */\n"
                            "}\n"
                            "```\n\n"
                            "Элементы:\n"
                            "```css\n"
                            ".item {\n"
                            "  flex-grow: 1;    /* растягивается */\n"
                            "  flex-shrink: 0;  /* не сжимается */\n"
                            "  flex-basis: 200px; /* базовый размер */\n"
                            "  /* Сокращённая запись: */\n"
                            "  flex: 1 0 200px;\n"
                            "}\n"
                            "```\n\n"
                            "justify-content: flex-start | flex-end | center | space-between | space-around | space-evenly\n"
                            "align-items: stretch | flex-start | flex-end | center | baseline"
                        ),
                        "quiz_question": "Какое свойство задаёт выравнивание по главной оси во Flexbox?",
                        "quiz_options": ["align-items", "justify-content", "flex-direction", "align-content"],
                        "quiz_correct": 1,
                        "assignment": {
                            "title": "Flexbox навигация",
                            "description": "Создайте CSS для навигационной панели: горизонтальное расположение ссылок, логотип слева, ссылки по центру, кнопка справа. Используйте display: flex, justify-content, align-items, gap.",
                            "tests": [
                                {"name": "Используется display: flex", "type": "includesAny", "tokens": ["display: flex", "display:flex"]},
                                {"name": "Используется justify-content", "type": "includesAny", "tokens": ["justify-content"]},
                                {"name": "Используется align-items", "type": "includesAny", "tokens": ["align-items"]},
                                {"name": "Используется gap", "type": "includesAny", "tokens": ["gap:"]},
                            ],
                        },
                    },
                ],
            },
        ],
    },
    {
        "title": "React: создание SPA-приложений",
        "slug": "react-spa-applications",
        "description": "Разработка современных веб-приложений на React. Компоненты, хуки, маршрутизация, управление состоянием и взаимодействие с API.",
        "level": "Intermediate",
        "category": "Web",
        "duration_hours": 45,
        "rating": 4.6,
        "students_count": random.randint(500, 1500),
        "modules": [
            {
                "title": "Компоненты и JSX",
                "lessons": [
                    {
                        "title": "Функциональные компоненты и пропсы",
                        "theory": (
                            "React-компоненты — это функции, возвращающие JSX.\n\n"
                            "```jsx\n"
                            "function Greeting({ name, age }) {\n"
                            "  return (\n"
                            "    <div className=\"greeting\">\n"
                            "      <h1>Привет, {name}!</h1>\n"
                            "      <p>Тебе {age} лет</p>\n"
                            "    </div>\n"
                            "  );\n"
                            "}\n\n"
                            "// Использование:\n"
                            "<Greeting name=\"Алиса\" age={25} />\n"
                            "```\n\n"
                            "Правила JSX:\n"
                            "• Всегда один корневой элемент (или <>...</>)\n"
                            "• className вместо class\n"
                            "• htmlFor вместо for\n"
                            "• CamelCase для событий: onClick, onChange\n"
                            "• Выражения в {фигурных скобках}\n\n"
                            "Деструктуризация пропсов:\n"
                            "```jsx\n"
                            "function Card({ title, description, children }) {\n"
                            "  return (\n"
                            "    <div className=\"card\">\n"
                            "      <h2>{title}</h2>\n"
                            "      <p>{description}</p>\n"
                            "      {children}\n"
                            "    </div>\n"
                            "  );\n"
                            "}\n"
                            "```"
                        ),
                        "quiz_question": "Как передать CSS-класс элементу в JSX?",
                        "quiz_options": ["class=\"name\"", "className=\"name\"", "cssClass=\"name\"", "style=\"name\""],
                        "quiz_correct": 1,
                        "assignment": {
                            "title": "React компонент UserCard",
                            "description": "Создайте компонент UserCard, который принимает пропсы name, email, role и avatarUrl. Выведите аватар (<img>), имя (<h3>), email (<p>), роль в badge (<span>). Используйте деструктуризацию пропсов.",
                            "tests": [
                                {"name": "Есть function или const компонент", "type": "regex", "pattern": "(function\\s+UserCard|const\\s+UserCard)"},
                                {"name": "Деструктуризация пропсов", "type": "regex", "pattern": "\\{\\s*(name|email|role)"},
                                {"name": "Есть return с JSX", "type": "includesAny", "tokens": ["return (", "return("]},
                                {"name": "Есть img", "type": "includesAny", "tokens": ["<img"]},
                                {"name": "Используется className", "type": "includesAny", "tokens": ["classname"]},
                            ],
                        },
                    },
                ],
            },
            {
                "title": "Хуки React",
                "lessons": [
                    {
                        "title": "useState и useEffect",
                        "theory": (
                            "Хуки позволяют использовать состояние и побочные эффекты в функциональных компонентах.\n\n"
                            "useState:\n"
                            "```jsx\n"
                            "import { useState } from 'react';\n\n"
                            "function Counter() {\n"
                            "  const [count, setCount] = useState(0);\n\n"
                            "  return (\n"
                            "    <button onClick={() => setCount(count + 1)}>\n"
                            "      Клики: {count}\n"
                            "    </button>\n"
                            "  );\n"
                            "}\n"
                            "```\n\n"
                            "useEffect:\n"
                            "```jsx\n"
                            "import { useState, useEffect } from 'react';\n\n"
                            "function UserProfile({ userId }) {\n"
                            "  const [user, setUser] = useState(null);\n\n"
                            "  useEffect(() => {\n"
                            "    fetch(`/api/users/${userId}`)\n"
                            "      .then(res => res.json())\n"
                            "      .then(data => setUser(data));\n"
                            "  }, [userId]); // зависимость\n\n"
                            "  if (!user) return <p>Загрузка...</p>;\n"
                            "  return <h1>{user.name}</h1>;\n"
                            "}\n"
                            "```\n\n"
                            "Массив зависимостей:\n"
                            "• [] — один раз при монтировании\n"
                            "• [dep] — при изменении dep\n"
                            "• без массива — при каждом рендере"
                        ),
                        "quiz_question": "Когда выполняется useEffect с пустым массивом зависимостей []?",
                        "quiz_options": ["При каждом рендере", "Только при монтировании", "При размонтировании", "Никогда"],
                        "quiz_correct": 1,
                        "assignment": {
                            "title": "Компонент с состоянием",
                            "description": "Создайте компонент TodoList: 1) useState для списка задач и поля ввода, 2) Функция добавления задачи, 3) Функция удаления задачи, 4) Отображение списка через .map() с key.",
                            "tests": [
                                {"name": "Используется useState", "type": "includesAny", "tokens": ["usestate"]},
                                {"name": "Есть map()", "type": "includesAny", "tokens": [".map("]},
                                {"name": "Есть key", "type": "includesAny", "tokens": ["key="]},
                                {"name": "Есть onClick или обработчик", "type": "includesAny", "tokens": ["onclick", "onsubmit"]},
                                {"name": "Есть onChange для input", "type": "includesAny", "tokens": ["onchange"]},
                            ],
                        },
                    },
                ],
            },
        ],
    },
    {
        "title": "Docker: контейнеризация приложений",
        "slug": "docker-containerization",
        "description": "Научитесь упаковывать приложения в контейнеры. Dockerfile, docker-compose, volumes, networks и деплой.",
        "level": "Intermediate",
        "category": "DevOps",
        "duration_hours": 20,
        "rating": 4.5,
        "students_count": random.randint(400, 1200),
        "modules": [
            {
                "title": "Основы Docker",
                "lessons": [
                    {
                        "title": "Dockerfile и образы",
                        "theory": (
                            "Docker — платформа контейнеризации, позволяющая запускать приложения в изолированных средах.\n\n"
                            "Основные понятия:\n"
                            "• Image (образ) — шаблон для создания контейнера\n"
                            "• Container (контейнер) — запущенный экземпляр образа\n"
                            "• Dockerfile — инструкция для сборки образа\n"
                            "• Registry — хранилище образов (Docker Hub)\n\n"
                            "Пример Dockerfile для Python:\n"
                            "```dockerfile\n"
                            "FROM python:3.12-slim\n"
                            "WORKDIR /app\n"
                            "COPY requirements.txt .\n"
                            "RUN pip install --no-cache-dir -r requirements.txt\n"
                            "COPY . .\n"
                            "EXPOSE 8000\n"
                            "CMD [\"uvicorn\", \"app.main:app\", \"--host\", \"0.0.0.0\"]\n"
                            "```\n\n"
                            "Команды:\n"
                            "```bash\n"
                            "docker build -t myapp .          # Сборка\n"
                            "docker run -p 8000:8000 myapp     # Запуск\n"
                            "docker ps                         # Список контейнеров\n"
                            "docker stop <id>                  # Остановка\n"
                            "```"
                        ),
                        "quiz_question": "Какая инструкция Dockerfile задаёт базовый образ?",
                        "quiz_options": ["BASE", "IMAGE", "FROM", "USE"],
                        "quiz_correct": 2,
                        "assignment": {
                            "title": "Dockerfile для Node.js",
                            "description": "Напишите Dockerfile для Node.js-приложения: базовый образ node:20-alpine, рабочая директория /app, копирование package.json, установка зависимостей, копирование исходников, expose порт 3000, команда запуска npm start.",
                            "tests": [
                                {"name": "Есть FROM", "type": "includesAny", "tokens": ["from node"]},
                                {"name": "Есть WORKDIR", "type": "includesAny", "tokens": ["workdir"]},
                                {"name": "Есть COPY package.json", "type": "includesAny", "tokens": ["copy package"]},
                                {"name": "Есть RUN npm install", "type": "includesAny", "tokens": ["run npm install", "run npm ci"]},
                                {"name": "Есть EXPOSE", "type": "includesAny", "tokens": ["expose"]},
                                {"name": "Есть CMD", "type": "includesAny", "tokens": ["cmd"]},
                            ],
                        },
                    },
                    {
                        "title": "Docker Compose: мультиконтейнерные приложения",
                        "theory": (
                            "Docker Compose позволяет описывать и запускать несколько контейнеров.\n\n"
                            "docker-compose.yml:\n"
                            "```yaml\n"
                            "version: '3.8'\n"
                            "services:\n"
                            "  web:\n"
                            "    build: .\n"
                            "    ports:\n"
                            "      - '3000:3000'\n"
                            "    environment:\n"
                            "      - DATABASE_URL=postgresql://user:pass@db:5432/mydb\n"
                            "    depends_on:\n"
                            "      - db\n\n"
                            "  db:\n"
                            "    image: postgres:16\n"
                            "    environment:\n"
                            "      POSTGRES_USER: user\n"
                            "      POSTGRES_PASSWORD: pass\n"
                            "      POSTGRES_DB: mydb\n"
                            "    volumes:\n"
                            "      - pgdata:/var/lib/postgresql/data\n\n"
                            "volumes:\n"
                            "  pgdata:\n"
                            "```\n\n"
                            "Команды:\n"
                            "```bash\n"
                            "docker compose up -d        # Запуск в фоне\n"
                            "docker compose down          # Остановка\n"
                            "docker compose logs -f web   # Логи\n"
                            "docker compose exec web sh   # Вход в контейнер\n"
                            "```"
                        ),
                        "quiz_question": "Какой ключ в docker-compose.yml определяет порядок запуска сервисов?",
                        "quiz_options": ["requires", "links", "depends_on", "after"],
                        "quiz_correct": 2,
                        "assignment": {
                            "title": "Docker Compose стек",
                            "description": "Напишите docker-compose.yml для стека: 1) Frontend (nginx, порт 80), 2) Backend (Python, порт 8000, зависит от db), 3) Database (PostgreSQL с volume для данных). Настройте environment и volumes.",
                            "tests": [
                                {"name": "Есть services", "type": "includesAny", "tokens": ["services:"]},
                                {"name": "Есть nginx или frontend", "type": "includesAny", "tokens": ["nginx", "frontend"]},
                                {"name": "Есть postgres или db", "type": "includesAny", "tokens": ["postgres", "database"]},
                                {"name": "Есть volumes", "type": "includesAny", "tokens": ["volumes:"]},
                                {"name": "Есть depends_on", "type": "includesAny", "tokens": ["depends_on"]},
                                {"name": "Есть ports", "type": "includesAny", "tokens": ["ports:"]},
                            ],
                        },
                    },
                ],
            },
        ],
    },
    {
        "title": "Алгоритмы и структуры данных",
        "slug": "algorithms-data-structures",
        "description": "Массивы, связные списки, деревья, графы, сортировки, поиск, динамическое программирование. Подготовка к техническим собеседованиям.",
        "level": "Advanced",
        "category": "Math",
        "duration_hours": 50,
        "rating": 4.9,
        "students_count": random.randint(300, 1000),
        "modules": [
            {
                "title": "Сложность алгоритмов",
                "lessons": [
                    {
                        "title": "Big O нотация",
                        "theory": (
                            "Big O описывает верхнюю границу роста времени выполнения алгоритма.\n\n"
                            "Основные классы сложности:\n"
                            "• O(1) — константная: доступ по индексу, хеш-таблица\n"
                            "• O(log n) — логарифмическая: бинарный поиск\n"
                            "• O(n) — линейная: перебор массива\n"
                            "• O(n log n) — линейно-логарифмическая: сортировка слиянием\n"
                            "• O(n²) — квадратичная: вложенные циклы, сортировка пузырьком\n"
                            "• O(2ⁿ) — экспоненциальная: полный перебор\n\n"
                            "Правила определения:\n"
                            "1. Отбросить константы: O(2n) → O(n)\n"
                            "2. Оставить старший член: O(n² + n) → O(n²)\n"
                            "3. Вложенные циклы умножаются: O(n) × O(m) = O(n·m)\n"
                            "4. Последовательные операции складываются\n\n"
                            "Примеры:\n"
                            "```python\n"
                            "# O(n)\n"
                            "for item in arr:\n"
                            "    print(item)\n\n"
                            "# O(n²)\n"
                            "for i in arr:\n"
                            "    for j in arr:\n"
                            "        print(i, j)\n\n"
                            "# O(log n)\n"
                            "while n > 1:\n"
                            "    n //= 2\n"
                            "```"
                        ),
                        "quiz_question": "Какова сложность бинарного поиска?",
                        "quiz_options": ["O(n)", "O(log n)", "O(n log n)", "O(1)"],
                        "quiz_correct": 1,
                        "assignment": {
                            "title": "Бинарный поиск",
                            "description": "Реализуйте функцию binary_search(arr, target), которая принимает отсортированный список и искомый элемент. Возвращает индекс элемента или -1, если не найден. Используйте два указателя left и right.",
                            "tests": [
                                {"name": "Есть функция binary_search", "type": "regex", "pattern": "def\\s+binary_search\\s*\\("},
                                {"name": "Есть left/right или lo/hi", "type": "includesAny", "tokens": ["left", "lo ", "low"]},
                                {"name": "Есть деление mid", "type": "includesAny", "tokens": ["// 2", "/ 2", ">>"]},
                                {"name": "Есть цикл while", "type": "regex", "pattern": "\\bwhile\\b"},
                                {"name": "Возвращает -1 при отсутствии", "type": "includesAny", "tokens": ["return -1"]},
                            ],
                        },
                    },
                ],
            },
            {
                "title": "Сортировки",
                "lessons": [
                    {
                        "title": "Быстрая сортировка (Quick Sort)",
                        "theory": (
                            "Quick Sort — один из самых эффективных алгоритмов сортировки.\n\n"
                            "Принцип «разделяй и властвуй»:\n"
                            "1. Выбрать опорный элемент (pivot)\n"
                            "2. Разделить массив: элементы < pivot | pivot | элементы > pivot\n"
                            "3. Рекурсивно отсортировать обе части\n\n"
                            "```python\n"
                            "def quicksort(arr):\n"
                            "    if len(arr) <= 1:\n"
                            "        return arr\n"
                            "    pivot = arr[len(arr) // 2]\n"
                            "    left = [x for x in arr if x < pivot]\n"
                            "    middle = [x for x in arr if x == pivot]\n"
                            "    right = [x for x in arr if x > pivot]\n"
                            "    return quicksort(left) + middle + quicksort(right)\n"
                            "```\n\n"
                            "Сложность:\n"
                            "• Средний случай: O(n log n)\n"
                            "• Худший случай: O(n²) — при неудачном выборе pivot\n"
                            "• Память: O(log n) для стека рекурсии\n\n"
                            "Оптимизации: выбор медианы, случайный pivot, introsort."
                        ),
                        "quiz_question": "Какова средняя сложность Quick Sort?",
                        "quiz_options": ["O(n)", "O(n²)", "O(n log n)", "O(log n)"],
                        "quiz_correct": 2,
                        "assignment": {
                            "title": "Реализация Quick Sort",
                            "description": "Реализуйте функцию quicksort(arr), которая сортирует список чисел по возрастанию. Используйте рекурсию с выбором pivot (средний элемент). Функция должна возвращать новый отсортированный список.",
                            "tests": [
                                {"name": "Есть функция quicksort", "type": "regex", "pattern": "def\\s+quicksort\\s*\\("},
                                {"name": "Рекурсивный вызов", "type": "regex", "pattern": "quicksort\\s*\\("},
                                {"name": "Есть pivot", "type": "includesAny", "tokens": ["pivot"]},
                                {"name": "Базовый случай рекурсии", "type": "includesAny", "tokens": ["len(arr)", "<= 1", "== 0"]},
                                {"name": "Есть return", "type": "regex", "pattern": "\\breturn\\b"},
                            ],
                        },
                    },
                ],
            },
        ],
    },
    {
        "title": "Информационная безопасность: основы",
        "slug": "cybersecurity-fundamentals",
        "description": "Базовые принципы ИБ: шифрование, аутентификация, OWASP Top 10, SQL-инъекции, XSS, безопасность веб-приложений.",
        "level": "Intermediate",
        "category": "Security",
        "duration_hours": 20,
        "rating": 4.7,
        "students_count": random.randint(300, 900),
        "modules": [
            {
                "title": "Веб-безопасность",
                "lessons": [
                    {
                        "title": "OWASP Top 10 уязвимостей",
                        "theory": (
                            "OWASP Top 10 — список наиболее критических угроз веб-приложений.\n\n"
                            "1. Broken Access Control — обход проверок доступа\n"
                            "2. Cryptographic Failures — слабое шифрование\n"
                            "3. Injection — SQL, NoSQL, OS инъекции\n"
                            "4. Insecure Design — архитектурные уязвимости\n"
                            "5. Security Misconfiguration — неправильная настройка\n"
                            "6. Vulnerable Components — устаревшие зависимости\n"
                            "7. Auth Failures — проблемы аутентификации\n"
                            "8. Data Integrity Failures — подделка данных\n"
                            "9. Logging Failures — отсутствие мониторинга\n"
                            "10. SSRF — подделка запросов на сервере\n\n"
                            "SQL-инъекция (пример уязвимого кода):\n"
                            "```python\n"
                            "# ОПАСНО!\n"
                            "query = f\"SELECT * FROM users WHERE email='{email}'\"\n\n"
                            "# БЕЗОПАСНО — параметризованный запрос:\n"
                            "query = \"SELECT * FROM users WHERE email=$1\"\n"
                            "await db.fetch(query, email)\n"
                            "```\n\n"
                            "XSS — Cross-Site Scripting:\n"
                            "Внедрение JavaScript через пользовательский ввод.\n"
                            "Защита: экранирование, Content Security Policy (CSP), HttpOnly cookies."
                        ),
                        "quiz_question": "Какой тип атаки внедряет SQL-код через пользовательский ввод?",
                        "quiz_options": ["XSS", "CSRF", "SQL Injection", "SSRF"],
                        "quiz_correct": 2,
                        "assignment": {
                            "title": "Безопасный код",
                            "description": "Перепишите уязвимый Python-код, заменив строковую интерполяцию на параметризованные запросы. Исправьте: 1) SQL-запрос с f-string, 2) Хранение пароля в открытом виде (используйте bcrypt/hash), 3) Отсутствие валидации email.",
                            "tests": [
                                {"name": "Нет f-string в SQL", "type": "regex", "pattern": "^(?!.*f['\"].*SELECT)"},
                                {"name": "Есть параметризованный запрос", "type": "includesAny", "tokens": ["$1", "?", "%s", ":email"]},
                                {"name": "Хеширование пароля", "type": "includesAny", "tokens": ["hash", "bcrypt", "argon", "pbkdf"]},
                                {"name": "Валидация email", "type": "includesAny", "tokens": ["@", "email", "validate", "regex", "re."]},
                            ],
                        },
                    },
                ],
            },
        ],
    },
]


async def import_courses():
    pool = await asyncpg.create_pool(
        dsn=settings.database_url,
        min_size=1,
        max_size=3,
    )

    async with pool.acquire() as conn:
        teacher = await conn.fetchrow(
            "SELECT id FROM users WHERE email = 'teacher@gradus.dev' LIMIT 1"
        )
        teacher_id = teacher["id"] if teacher else None

        for course_data in COURSES:
            existing = await conn.fetchval(
                "SELECT id FROM courses WHERE slug=$1 LIMIT 1",
                course_data["slug"],
            )
            if existing:
                print(f"  Skip '{course_data['title']}' (exists, id={existing})")
                continue

            course_id = await conn.fetchval(
                """INSERT INTO courses (title, slug, description, level, category, price_cents,
                   teacher_id, status, rating, students_count, duration_hours)
                   VALUES ($1, $2, $3, $4, $5, 0, $6, 'published', $7, $8, $9)
                   RETURNING id""",
                course_data["title"],
                course_data["slug"],
                course_data["description"],
                course_data["level"],
                course_data["category"],
                teacher_id,
                course_data["rating"],
                course_data["students_count"],
                course_data["duration_hours"],
            )
            print(f"[OK] Kurs '{course_data['title']}' created (id={course_id})")

            for mod_idx, module_data in enumerate(course_data["modules"], start=1):
                module_id = await conn.fetchval(
                    """INSERT INTO course_modules (course_id, title, module_order)
                       VALUES ($1, $2, $3) RETURNING id""",
                    course_id,
                    module_data["title"],
                    mod_idx,
                )
                print(f"  Module '{module_data['title']}' (id={module_id})")

                for les_idx, lesson_data in enumerate(module_data["lessons"], start=1):
                    lesson_id = await conn.fetchval(
                        """INSERT INTO lessons (module_id, title, lesson_type, content_text, lesson_order)
                           VALUES ($1, $2, 'text', $3, $4) RETURNING id""",
                        module_id,
                        lesson_data["title"],
                        lesson_data["theory"],
                        les_idx,
                    )

                    if "assignment" in lesson_data:
                        a = lesson_data["assignment"]
                        await conn.execute(
                            """INSERT INTO assignments (lesson_id, assignment_type, title, description, tests, rubric, max_score)
                               VALUES ($1, 'code', $2, $3, $4::jsonb, '{"tests": 70, "quality": 20, "style": 10}'::jsonb, 100)""",
                            lesson_id,
                            a["title"],
                            a["description"],
                            json.dumps(a["tests"]),
                        )

                    print(f"    Lesson '{lesson_data['title']}'")


    await pool.close()
    print(f"\nDone! Imported {len(COURSES)} courses.")


if __name__ == "__main__":
    asyncio.run(import_courses())
