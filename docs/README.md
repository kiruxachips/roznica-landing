# Millor Coffee - Landing Page

## Описание

Рекламный лендинг для продажи свежеобжаренного кофе с переводом на основной магазин [millor-shop.ru](https://millor-shop.ru).

## Быстрый старт

### Требования
- Node.js 18+
- npm или yarn

### Установка

```bash
# Клонирование (если из репозитория)
git clone <repo-url>
cd roznica-landing

# Установка зависимостей
npm install

# Запуск в режиме разработки
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000) в браузере.

### Production сборка

```bash
npm run build
npm run start
```

## Структура страницы

Лендинг состоит из следующих секций:

1. **Header** - Фиксированная шапка с навигацией и кнопкой "В магазин"
2. **Hero** - Главный баннер с заголовком и CTA
3. **Features** - 4 преимущества компании
4. **Products** - 4 хита продаж с ценами и кнопками покупки
5. **About** - Информация о компании
6. **Testimonials** - Отзывы клиентов
7. **Contact** - Финальный призыв к действию
8. **Footer** - Подвал с контактами и ссылками

## Конфигурация

### Изменение товаров

Файл: `/lib/constants.ts`

```typescript
export const products = [
  {
    id: 1,
    name: "Название",
    description: "Описание вкуса",
    price: 580,
    priceMax: 2200,
    origin: "Страна",
    roast: "Обжарка",
    url: "https://millor-shop.ru/product/...",
    // ...
  },
]
```

### Изменение ссылок

В том же файле:

```typescript
export const SHOP_URL = "https://millor-shop.ru"
export const CATALOG_URL = "https://millor-shop.ru/product/svezheobzharennyj-kofe/"
```

### Изменение цветов

Файл: `/app/globals.css`

```css
:root {
  --primary: 24 75% 30%;      /* Основной цвет */
  --secondary: 40 30% 94%;    /* Вторичный цвет */
  --accent: 24 70% 45%;       /* Акцент */
}
```

## Технологии

| Технология | Версия | Назначение |
|------------|--------|------------|
| Next.js | 14.x | Фреймворк |
| React | 18.x | UI |
| TypeScript | 5.x | Типизация |
| Tailwind CSS | 3.x | Стили |
| lucide-react | 0.x | Иконки |

## Деплой на Beget

### Подготовка

1. Соберите проект:
```bash
npm run build
```

2. Подключитесь к серверу:
```bash
ssh beget
```

3. Загрузите файлы:
```bash
scp -r .next package.json package-lock.json next.config.js public beget:~/roznica-landing/
```

### Запуск с PM2

```bash
# На сервере
cd ~/roznica-landing
npm install --production
pm2 start npm --name "roznica" -- start
pm2 save
```

### Nginx конфигурация

```nginx
server {
    listen 80;
    server_name your-domain.ru;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Планы развития

### Фаза 1 (Текущая)
- [x] Лендинг с редиректом на магазин

### Фаза 2
- [ ] Корзина на лендинге
- [ ] Форма заказа
- [ ] Интеграция с CRM

### Фаза 3
- [ ] Авторизация пользователей
- [ ] Личный кабинет
- [ ] История заказов

### Фаза 4
- [ ] Админ-панель
- [ ] Управление товарами
- [ ] Статистика

### Фаза 5
- [ ] Онлайн-оплата
- [ ] Интеграция с доставкой
- [ ] Email-уведомления

## Контакты

- Магазин: [millor-shop.ru](https://millor-shop.ru)
- Telegram: [@millor_coffee](https://t.me/millor_coffee)
