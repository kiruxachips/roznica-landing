# Roznica Landing - Coffee E-commerce Landing Page

## Обзор проекта

Лендинг для рекламной кампании по продаже свежеобжаренного кофе с редиректом на основной магазин millor-shop.ru. Проект спроектирован с архитектурой для масштабирования в полноценный интернет-магазин.

## Стек технологий

### Frontend (текущий)
- **Next.js 14** - App Router
- **React 18** - UI библиотека
- **TypeScript** - типизация
- **Tailwind CSS** - стилизация
- **shadcn/ui** - UI компоненты (кастомные)
- **lucide-react** - иконки

### Backend (планируется)
- **Next.js API Routes** - API эндпоинты
- **Prisma ORM** - работа с БД
- **PostgreSQL** - база данных

## Структура проекта

```
roznica-landing/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Корневой layout
│   ├── page.tsx            # Главная страница
│   └── globals.css         # Глобальные стили
├── components/
│   ├── ui/                 # UI компоненты (button, card, badge)
│   ├── layout/             # Layout компоненты (Header, Footer)
│   └── sections/           # Секции лендинга
│       ├── Hero.tsx
│       ├── Features.tsx
│       ├── Products.tsx
│       ├── About.tsx
│       ├── Testimonials.tsx
│       └── Contact.tsx
├── lib/
│   ├── utils.ts            # Утилиты (cn helper)
│   └── constants.ts        # Константы и данные
├── public/
│   └── images/             # Статические изображения
└── docs/
    └── README.md           # Документация
```

## Ключевые файлы

- `/lib/constants.ts` - все данные о товарах, ссылки на магазин, тексты
- `/app/globals.css` - CSS переменные для цветовой схемы
- `/tailwind.config.ts` - конфигурация Tailwind с кастомными цветами

## Дизайн-система

### Цветовая палитра
- **Primary**: `hsl(24, 75%, 30%)` - тёплый коричневый
- **Secondary**: `hsl(40, 30%, 94%)` - бежевый
- **Accent**: `hsl(24, 70%, 45%)` - кофейный
- **Background**: белый
- **Coffee**: кастомная палитра от 50 до 900

### Шрифты
- **Sans**: Inter (основной текст)
- **Serif**: Playfair Display (заголовки)

## Команды

```bash
npm install     # Установка зависимостей
npm run dev     # Запуск dev-сервера (http://localhost:3000)
npm run build   # Сборка для production
npm run start   # Запуск production сервера
npm run lint    # Проверка кода
```

## Внешние ссылки

- Основной магазин: https://millor-shop.ru
- Каталог кофе: https://millor-shop.ru/product/svezheobzharennyj-kofe/

## Деплой

Сервер: `ssh beget`

Для деплоя:
1. Собрать проект: `npm run build`
2. Загрузить на сервер
3. Настроить PM2 или systemd для запуска

## Планы развития

1. **Фаза 2**: Добавление корзины и оформления заказа
2. **Фаза 3**: Авторизация пользователей
3. **Фаза 4**: Админ-панель для управления товарами
4. **Фаза 5**: Интеграция с платёжными системами

## Примечания для разработки

- Все ссылки на товары ведут на millor-shop.ru
- Данные товаров хранятся в `/lib/constants.ts`
- Для добавления новых товаров - редактировать массив `products`
- Изображения пока используют placeholder, нужно добавить реальные фото
