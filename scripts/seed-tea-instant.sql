-- Seed: tea and instant (cicory) products
-- Run: docker compose exec db psql -U roznica roznica -f /scripts/seed-tea-instant.sql
-- Generated: 2026-04-15

BEGIN;

-- ============================================================
-- CICORY PRODUCTS (productType = 'instant')
-- Category: cicory (8f14be7e-f557-47e2-8088-8a22bcd867ba)
-- ============================================================

-- 1. Корень цикория натуральный гранулированный
INSERT INTO "Product" (id, name, slug, description, "fullDescription", "productType", "productForm", "categoryId", badge, "isActive", "isFeatured", "sortOrder", "flavorNotes", "brewingMethods", "createdAt", "updatedAt")
VALUES (
  'p-cicory-root-0000-0000-000000000001',
  'Корень цикория натуральный гранулированный',
  'koren-cikoriya-naturalnyy-granulirovannyy',
  'Высокого качества корень цикория, молотый на промышленной мельнице и гранулированный с сохранением полезных свойств.',
  E'Производство поставляет корень цикория высшего качества, который подвергается помолу на промышленной мельнице и последующей грануляции.\n\nПродукт содержит значительное количество инулина, способствующего снижению уровня глюкозы. Состав включает витамины А, Е, В1, В2, В3, С, РР и минералы: калий, магний, кальций.\n\nРасфасовка: 100 г doy pack. Срок годности: 24 месяца.',
  'instant',
  'гранулы',
  '8f14be7e-f557-47e2-8088-8a22bcd867ba',
  'Распродажа!',
  true,
  false,
  10,
  '{}',
  '{}',
  NOW(), NOW()
);

INSERT INTO "ProductVariant" (id, "productId", weight, price, "oldPrice", stock, "isActive", "sortOrder")
VALUES ('v-cicory-root-0000-0000-000000000001', 'p-cicory-root-0000-0000-000000000001', '100г', 70, NULL, 100, true, 0);

INSERT INTO "ProductImage" (id, "productId", url, alt, "isPrimary", "sortOrder")
VALUES ('i-cicory-root-0000-0000-000000000001', 'p-cicory-root-0000-0000-000000000001', '/images/rastvorimka/koren-cikoriya.png', 'Корень цикория натуральный гранулированный', true, 0);

INSERT INTO "Review" (id, "productId", name, text, rating, date, "isVisible", "createdAt")
VALUES ('r-cicory-root-0000-0000-000000000001', 'p-cicory-root-0000-0000-000000000001', 'Валерий', 'Многолетний покупатель. Приобретал ранее на маркетплейсах, но последняя покупка совершена на этом сайте. Цены существенно ниже, оформление удобное.', 5, '17 сентября 2024', true, '2024-09-17 05:50:00');


-- 2. Цикорий растворимый гранулированный
INSERT INTO "Product" (id, name, slug, description, "fullDescription", "productType", "productForm", "categoryId", badge, "isActive", "isFeatured", "sortOrder", "flavorNotes", "brewingMethods", "createdAt", "updatedAt")
VALUES (
  'p-cicory-inst-0000-0000-000000000002',
  'Цикорий растворимый гранулированный',
  'czikoriy-rastvorimyy-granulirovannyy',
  'Продукт высшего качества, произведённый с заботой о сохранении полезных веществ. Богат инулином для снижения уровня сахара в крови.',
  E'Цикорий растворимый гранулированный содержит витамины A, E, B1, B2, B3, C, PP и минералы: калий, магний, кальций.\n\nИдеальная здоровая альтернатива кофе — растворяется в горячей воде, не требует варки. Обладает приятным слегка горьковатым вкусом с кофейными нотами.\n\nРасфасовка: 100 г doy pack. Срок годности: 24 месяца.',
  'instant',
  'гранулы',
  '8f14be7e-f557-47e2-8088-8a22bcd867ba',
  'Распродажа!',
  true,
  false,
  11,
  '{}',
  '{}',
  NOW(), NOW()
);

INSERT INTO "ProductVariant" (id, "productId", weight, price, "oldPrice", stock, "isActive", "sortOrder")
VALUES ('v-cicory-inst-0000-0000-000000000002', 'p-cicory-inst-0000-0000-000000000002', '100г', 70, NULL, 100, true, 0);

INSERT INTO "ProductImage" (id, "productId", url, alt, "isPrimary", "sortOrder")
VALUES ('i-cicory-inst-0000-0000-000000000002', 'p-cicory-inst-0000-0000-000000000002', '/images/rastvorimka/cikoriu-rastvorimi.png', 'Цикорий растворимый гранулированный', true, 0);

INSERT INTO "Review" (id, "productId", name, text, rating, date, "isVisible", "createdAt")
VALUES
  ('r-cicory-inst-00000-0000-000000000001', 'p-cicory-inst-0000-0000-000000000002', 'Анна', 'Самый лучший Цикорий, который пробовала!!!', 5, '09 января 2025', true, '2025-01-09 12:00:00'),
  ('r-cicory-inst-00000-0000-000000000002', 'p-cicory-inst-0000-0000-000000000002', 'Мария', 'Хороший прям', 5, '14 января 2025', true, '2025-01-14 12:00:00'),
  ('r-cicory-inst-00000-0000-000000000003', 'p-cicory-inst-0000-0000-000000000002', 'Юра', 'Годный, нам с женой зашел на ура', 5, '15 января 2025', true, '2025-01-15 12:00:00');


-- ============================================================
-- TEA PRODUCTS (productType = 'tea')
-- ============================================================

-- 3. Leaflet species BLACK OP (Чёрный чай — c219e996-ab90-4be9-96d3-21f11d7a92f4)
INSERT INTO "Product" (id, name, slug, description, "fullDescription", "productType", "productForm", "categoryId", badge, "isActive", "isFeatured", "sortOrder", "flavorNotes", "brewingMethods", "createdAt", "updatedAt")
VALUES (
  'p-tea-leafbl-0000-0000-000000000003',
  'Листовой чёрный OP',
  'listovoy-chernyy-op',
  'Классический чёрный чай с насыщенным вкусом и богатым ароматом. Отлично подходит для утреннего подъёма или уютного чаепития.',
  E'Мы поставляем чай напрямую с лучших плантаций и гарантируем строгий контроль качества на каждом этапе.\n\nЛистовой чёрный чай сорта OP (Orange Pekoe) отличается насыщенным вкусом и богатым ароматом. Идеально подходит для утреннего подъёма или уютного вечернего чаепития.\n\nРасфасовка: 100 г.',
  'tea',
  'листовой',
  'c219e996-ab90-4be9-96d3-21f11d7a92f4',
  'Распродажа!',
  true,
  false,
  20,
  '{}',
  '{}',
  NOW(), NOW()
);

INSERT INTO "ProductVariant" (id, "productId", weight, price, "oldPrice", stock, "isActive", "sortOrder")
VALUES ('v-tea-leafbl-0000-0000-000000000003', 'p-tea-leafbl-0000-0000-000000000003', '100г', 145, NULL, 100, true, 0);

INSERT INTO "ProductImage" (id, "productId", url, alt, "isPrimary", "sortOrder")
VALUES ('i-tea-leafbl-0000-0000-000000000003', 'p-tea-leafbl-0000-0000-000000000003', '/images/tea/hunan.png', 'Листовой чёрный чай OP', true, 0);

INSERT INTO "Review" (id, "productId", name, text, rating, date, "isVisible", "createdAt")
VALUES
  ('r-tea-leafbl-00000-0000-000000000001', 'p-tea-leafbl-0000-0000-000000000003', 'Олег', 'Отличный чай, лучше магазинных сортов.', 5, '14 января 2025', true, '2025-01-14 12:00:00'),
  ('r-tea-leafbl-00000-0000-000000000002', 'p-tea-leafbl-0000-0000-000000000003', 'Елена', 'Прекрасный чай, теперь беру регулярно.', 5, '26 февраля 2025', true, '2025-02-26 12:00:00');


-- 4. Large leaf species BLACK OP
INSERT INTO "Product" (id, name, slug, description, "fullDescription", "productType", "productForm", "categoryId", badge, "isActive", "isFeatured", "sortOrder", "flavorNotes", "brewingMethods", "createdAt", "updatedAt")
VALUES (
  'p-tea-lrgbl-00000-0000-000000000004',
  'Крупнолистовой чёрный OP',
  'krupnolistovoy-chernyy-op',
  'Крупнолистовой чёрный чай сорта OP с мягким насыщенным вкусом. Поставляется напрямую с плантаций.',
  E'Мы поставляем чай напрямую с лучших плантаций и гарантируем строгий контроль качества на каждом этапе.\n\nКрупнолистовой чёрный чай сорта OP (Orange Pekoe) — более крупные листья дают мягкий, менее терпкий настой с приятным ароматом.\n\nРасфасовка: 100 г.',
  'tea',
  'листовой',
  'c219e996-ab90-4be9-96d3-21f11d7a92f4',
  'Распродажа!',
  true,
  false,
  21,
  '{}',
  '{}',
  NOW(), NOW()
);

INSERT INTO "ProductVariant" (id, "productId", weight, price, "oldPrice", stock, "isActive", "sortOrder")
VALUES ('v-tea-lrgbl-00000-0000-000000000004', 'p-tea-lrgbl-00000-0000-000000000004', '100г', 125, NULL, 100, true, 0);

INSERT INTO "ProductImage" (id, "productId", url, alt, "isPrimary", "sortOrder")
VALUES ('i-tea-lrgbl-00000-0000-000000000004', 'p-tea-lrgbl-00000-0000-000000000004', '/images/tea/yunan.png', 'Крупнолистовой чёрный чай OP', true, 0);


-- 5. SENCHA (Зелёный чай — 1b2ddee2-025f-4107-8752-f1cdf0a746fe)
INSERT INTO "Product" (id, name, slug, description, "fullDescription", "productType", "productForm", "categoryId", badge, "isActive", "isFeatured", "sortOrder", "flavorNotes", "brewingMethods", "createdAt", "updatedAt")
VALUES (
  'p-tea-sencha-0000-0000-000000000005',
  'Сенча',
  'sencha',
  'Китайский зелёный чай с лёгкой терпкостью и насыщенным вкусом. Содержит меньше кофеина, чем другие сорта зелёного чая.',
  E'Чай заказывается напрямую с плантаций. Каждая партия проходит строгий контроль качества при поступлении.\n\nКитайский зелёный чай с лёгкой терпкостью и насыщенным вкусом. Содержит меньше кофеина, чем другие сорта зелёного чая — отличный выбор для тех, кто хочет получить бодрость без лишней нагрузки.\n\nРасфасовка: 100 г.',
  'tea',
  'листовой',
  '1b2ddee2-025f-4107-8752-f1cdf0a746fe',
  'Распродажа!',
  true,
  false,
  30,
  ARRAY['терпкий', 'насыщенный', 'травяной'],
  '{}',
  NOW(), NOW()
);

INSERT INTO "ProductVariant" (id, "productId", weight, price, "oldPrice", stock, "isActive", "sortOrder")
VALUES ('v-tea-sencha-0000-0000-000000000005', 'p-tea-sencha-0000-0000-000000000005', '100г', 140, NULL, 100, true, 0);

INSERT INTO "ProductImage" (id, "productId", url, alt, "isPrimary", "sortOrder")
VALUES ('i-tea-sencha-0000-0000-000000000005', 'p-tea-sencha-0000-0000-000000000005', '/images/tea/sencha.png', 'Сенча — зелёный чай', true, 0);

INSERT INTO "Review" (id, "productId", name, text, rating, date, "isVisible", "createdAt")
VALUES
  ('r-tea-sencha-00000-0000-000000000001', 'p-tea-sencha-0000-0000-000000000005', 'Татьяна', 'Отличный чай', 5, '23 января 2025', true, '2025-01-23 12:00:00'),
  ('r-tea-sencha-00000-0000-000000000002', 'p-tea-sencha-0000-0000-000000000005', 'Михаил', 'Класс', 5, '28 февраля 2025', true, '2025-02-28 12:00:00');


-- 6. GREEN OP (Зелёный чай)
INSERT INTO "Product" (id, name, slug, description, "fullDescription", "productType", "productForm", "categoryId", badge, "isActive", "isFeatured", "sortOrder", "flavorNotes", "brewingMethods", "createdAt", "updatedAt")
VALUES (
  'p-tea-greenop-000-0000-000000000006',
  'Зелёный OP',
  'zelenyy-op',
  'Зелёный чай с прямых плантаций. Сбалансированный вкус с лёгкой терпкостью в послевкусии.',
  E'Чай поставляется напрямую с плантаций с жёстким контролем производства.\n\nЗелёный чай сорта OP отличается сбалансированным вкусом зелёного чая с лёгкой терпкостью в послевкусии. Мягкий и приятный в заваривании.\n\nРасфасовка: 100 г.',
  'tea',
  'листовой',
  '1b2ddee2-025f-4107-8752-f1cdf0a746fe',
  'Распродажа!',
  true,
  false,
  31,
  '{}',
  '{}',
  NOW(), NOW()
);

INSERT INTO "ProductVariant" (id, "productId", weight, price, "oldPrice", stock, "isActive", "sortOrder")
VALUES ('v-tea-greenop-000-0000-000000000006', 'p-tea-greenop-000-0000-000000000006', '100г', 120, NULL, 100, true, 0);

INSERT INTO "Review" (id, "productId", name, text, rating, date, "isVisible", "createdAt")
VALUES ('r-tea-greenop-0000-0000-000000000001', 'p-tea-greenop-000-0000-000000000006', 'Кристина', 'Беру постоянно, очень вкусный', 5, '24 января 2025', true, '2025-01-24 11:44:00');


-- 7. GREEN CHUNMEE (Зелёный чай)
INSERT INTO "Product" (id, name, slug, description, "fullDescription", "productType", "productForm", "categoryId", badge, "isActive", "isFeatured", "sortOrder", "flavorNotes", "brewingMethods", "createdAt", "updatedAt")
VALUES (
  'p-tea-chunme-0000-0000-000000000007',
  'Чунь Ми (Chun Mee)',
  'chun-mee',
  'Высококачественный зелёный чай с премиальных плантаций. Свежий вкус с лёгкой кислинкой и приятной сбалансированной свежестью.',
  E'Премиальный зелёный чай, поставляемый напрямую от производителей с жёстким контролем качества.\n\nЧунь Ми (Chun Mee — «драгоценные брови») — один из классических китайских зелёных чаёв. Предлагает насыщенный свежий вкус с лёгкой кислинкой и приятной сбалансированной свежестью для ежедневного употребления.\n\nРасфасовка: 100 г.',
  'tea',
  'листовой',
  '1b2ddee2-025f-4107-8752-f1cdf0a746fe',
  'Распродажа!',
  true,
  false,
  32,
  ARRAY['свежий', 'лёгкая кислинка', 'сбалансированный'],
  '{}',
  NOW(), NOW()
);

INSERT INTO "ProductVariant" (id, "productId", weight, price, "oldPrice", stock, "isActive", "sortOrder")
VALUES ('v-tea-chunme-0000-0000-000000000007', 'p-tea-chunme-0000-0000-000000000007', '100г', 110, NULL, 100, true, 0);

INSERT INTO "ProductImage" (id, "productId", url, alt, "isPrimary", "sortOrder")
VALUES ('i-tea-chunme-0000-0000-000000000007', 'p-tea-chunme-0000-0000-000000000007', '/images/tea/chun-mee.png', 'Чунь Ми — зелёный чай', true, 0);

INSERT INTO "Review" (id, "productId", name, text, rating, date, "isVisible", "createdAt")
VALUES
  ('r-tea-chunme-00000-0000-000000000001', 'p-tea-chunme-0000-0000-000000000007', 'Вика', 'Приятный чай с лёгким вкусом.', 5, '09 января 2025', true, '2025-01-09 17:55:00'),
  ('r-tea-chunme-00000-0000-000000000002', 'p-tea-chunme-0000-0000-000000000007', 'Алекс', 'Отличный', 5, '27 января 2025', true, '2025-01-27 15:10:00');


-- 8. MILK OOLONG (Улун — 1ef9bd63-666a-4034-b19b-15ac3cad4f7a)
INSERT INTO "Product" (id, name, slug, description, "fullDescription", "productType", "productForm", "categoryId", badge, "isActive", "isFeatured", "sortOrder", "flavorNotes", "brewingMethods", "createdAt", "updatedAt")
VALUES (
  'p-tea-moolng-0000-0000-000000000008',
  'Молочный улун',
  'molochniy-ulung',
  'Изысканный молочный улун, созданный методом бережной ферментации. Нежные молочные оттенки и расслабляющий аромат.',
  E'Мы поставляем чай напрямую с лучших плантаций и гарантируем строгий контроль качества на каждом этапе.\n\nМолочный улун — один из самых популярных сортов улунского чая. Создан методом бережной ферментации, благодаря которой чай приобретает нежные молочные оттенки и бархатистую текстуру настоя.\n\nОтлично расслабляет и успокаивает, при этом не утяжеляет. Можно заваривать несколько раз.\n\nРасфасовка: 100 г.',
  'tea',
  'листовой',
  '1ef9bd63-666a-4034-b19b-15ac3cad4f7a',
  'Распродажа!',
  true,
  false,
  40,
  ARRAY['молочный', 'нежный', 'бархатистый'],
  '{}',
  NOW(), NOW()
);

INSERT INTO "ProductVariant" (id, "productId", weight, price, "oldPrice", stock, "isActive", "sortOrder")
VALUES ('v-tea-moolng-0000-0000-000000000008', 'p-tea-moolng-0000-0000-000000000008', '100г', 155, NULL, 100, true, 0);

INSERT INTO "ProductImage" (id, "productId", url, alt, "isPrimary", "sortOrder")
VALUES ('i-tea-moolng-0000-0000-000000000008', 'p-tea-moolng-0000-0000-000000000008', '/images/tea/milk-oolong.png', 'Молочный улун', true, 0);

INSERT INTO "Review" (id, "productId", name, text, rating, date, "isVisible", "createdAt")
VALUES
  ('r-tea-moolng-00000-0000-000000000001', 'p-tea-moolng-0000-0000-000000000008', 'Татьяна', 'Вкусненький, и цена достойная.', 5, '09 января 2025', true, '2025-01-09 17:57:00'),
  ('r-tea-moolng-00000-0000-000000000002', 'p-tea-moolng-0000-0000-000000000008', 'Ольга', 'Прекрасный улун, насыщенный но и не тяжелый. Расслабляет!', 5, '25 февраля 2025', true, '2025-02-25 11:20:00'),
  ('r-tea-moolng-00000-0000-000000000003', 'p-tea-moolng-0000-0000-000000000008', 'Михаил', 'Один из лучших из тех что пробовал.', 5, '26 февраля 2025', true, '2025-02-26 17:06:00'),
  ('r-tea-moolng-00000-0000-000000000004', 'p-tea-moolng-0000-0000-000000000008', 'Александра', 'Спасибо очень вкусный! быстро доставили', 5, '28 февраля 2025', true, '2025-02-28 12:11:00');


-- 9. Matcha (Матча — 8517927a-69b6-49d5-9e25-b2045a8d2237)
INSERT INTO "Product" (id, name, slug, description, "fullDescription", "productType", "productForm", "categoryId", badge, "isActive", "isFeatured", "sortOrder", "flavorNotes", "brewingMethods", "createdAt", "updatedAt")
VALUES (
  'p-tea-matcha-0000-0000-000000000009',
  'Матча (зелёный чай)',
  'matcha',
  'Зелёный чай матча с освежающим вкусом, лёгкой горечью и травяным ароматом. Приготовление: взбить с горячей водой 90–93°C.',
  E'Матча — это особый вид зелёного чая в виде мелкого порошка. Чайные листья выращиваются в тени, что увеличивает содержание хлорофилла и аминокислот.\n\nОсвежающий вкус с лёгкой горечью и характерным травяным ароматом. Богата антиоксидантами и L-теанином, который даёт мягкое, сосредоточенное состояние без резких скачков кофеина.\n\nПриготовление: насыпьте небольшое количество в чашку, залейте горячей водой 90–93°C (не кипятком), взбейте венчиком до однородной консистенции.\n\nРасфасовка: 100 г.',
  'tea',
  'порошок',
  '8517927a-69b6-49d5-9e25-b2045a8d2237',
  'Распродажа!',
  true,
  false,
  50,
  ARRAY['освежающий', 'лёгкая горечь', 'травяной'],
  '{}',
  NOW(), NOW()
);

INSERT INTO "ProductVariant" (id, "productId", weight, price, "oldPrice", stock, "isActive", "sortOrder")
VALUES ('v-tea-matcha-0000-0000-000000000009', 'p-tea-matcha-0000-0000-000000000009', '100г', 170, NULL, 100, true, 0);

INSERT INTO "ProductImage" (id, "productId", url, alt, "isPrimary", "sortOrder")
VALUES ('i-tea-matcha-0000-0000-000000000009', 'p-tea-matcha-0000-0000-000000000009', '/images/tea/matcha.png', 'Матча — зелёный чай порошок', true, 0);

COMMIT;

-- Verify
SELECT p.name, p."productType", p."productForm", c.name as category, pv.price
FROM "Product" p
JOIN "Category" c ON p."categoryId" = c.id
JOIN "ProductVariant" pv ON pv."productId" = p.id
WHERE p.id LIKE 'p-%'
ORDER BY p."sortOrder";
