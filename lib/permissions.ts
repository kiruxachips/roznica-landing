/**
 * Единая карта прав админки. Один источник правды.
 *
 * Принцип:
 * - admin может ВСЁ.
 * - manager — оперативная работа: заказы, склад, контент товаров, отзывы, промо, блог.
 *   НЕ МОЖЕТ: удалять объекты, менять настройки доставки/интеграций, управлять пользователями.
 *
 * Используется и в UI (скрыть кнопки), и в server actions (отказать в выполнении),
 * и в middleware (блокировать роуты).
 */

export type AdminRole = "admin" | "manager"
export type AdminStatus = "active" | "pending" | "blocked"

export const ALL_PERMISSIONS = [
  // Orders
  "orders.view",
  "orders.updateStatus",
  "orders.editContact",
  "orders.cancel",
  "orders.createShipment",
  "orders.refreshTracking",
  "orders.editNotes",
  "orders.delete",

  // Warehouse / stock
  "stock.view",
  "stock.adjust",
  "stock.setThreshold",

  // Products
  "products.view",
  "products.create",
  "products.edit",
  "products.toggleActive",
  "products.delete",

  // Variants
  "variants.create",
  "variants.edit",
  "variants.delete",

  // Categories
  "categories.view",
  "categories.edit",
  "categories.delete",

  // Reviews
  "reviews.view",
  "reviews.moderate",
  "reviews.delete",

  // Promo codes / promotions
  "promos.view",
  "promos.edit",
  "promos.delete",

  // Blog
  "blog.view",
  "blog.edit",
  "blog.delete",

  // Collections
  "collections.view",
  "collections.edit",
  "collections.delete",

  // Customers
  "customers.view",
  "customers.edit",

  // Delivery settings — admin only
  "delivery.settings",
  "delivery.markupRules",
  "delivery.deliveryRules",
  "delivery.senderLocations",

  // Integrations — admin only
  "integrations.view",
  "integrations.retry",

  // Email dispatch — admin only
  "email.view",
  "email.retry",

  // Admin users management — admin only
  "users.view",
  "users.approve",
  "users.block",
  "users.delete",
] as const

export type Permission = (typeof ALL_PERMISSIONS)[number]

/**
 * Для каждого permission — список ролей, которым он доступен.
 */
const ROLES_FOR_PERMISSION: Record<Permission, AdminRole[]> = {
  // --- Orders ---
  "orders.view": ["admin", "manager"],
  "orders.updateStatus": ["admin", "manager"],
  "orders.editContact": ["admin", "manager"],
  "orders.cancel": ["admin", "manager"],
  "orders.createShipment": ["admin", "manager"],
  "orders.refreshTracking": ["admin", "manager"],
  "orders.editNotes": ["admin", "manager"],
  "orders.delete": ["admin"],

  // --- Stock ---
  "stock.view": ["admin", "manager"],
  "stock.adjust": ["admin", "manager"],
  "stock.setThreshold": ["admin", "manager"],

  // --- Products ---
  "products.view": ["admin", "manager"],
  "products.create": ["admin", "manager"],
  "products.edit": ["admin", "manager"],
  "products.toggleActive": ["admin", "manager"],
  "products.delete": ["admin"],

  // --- Variants ---
  "variants.create": ["admin", "manager"],
  "variants.edit": ["admin", "manager"],
  "variants.delete": ["admin"],

  // --- Categories ---
  "categories.view": ["admin", "manager"],
  "categories.edit": ["admin", "manager"],
  "categories.delete": ["admin"],

  // --- Reviews ---
  "reviews.view": ["admin", "manager"],
  "reviews.moderate": ["admin", "manager"],
  "reviews.delete": ["admin"],

  // --- Promos ---
  "promos.view": ["admin", "manager"],
  "promos.edit": ["admin", "manager"],
  "promos.delete": ["admin"],

  // --- Blog ---
  "blog.view": ["admin", "manager"],
  "blog.edit": ["admin", "manager"],
  "blog.delete": ["admin"],

  // --- Collections ---
  "collections.view": ["admin", "manager"],
  "collections.edit": ["admin", "manager"],
  "collections.delete": ["admin"],

  // --- Customers (read-only for manager) ---
  "customers.view": ["admin", "manager"],
  "customers.edit": ["admin"],

  // --- Delivery (critical config) — admin only ---
  "delivery.settings": ["admin"],
  "delivery.markupRules": ["admin"],
  "delivery.deliveryRules": ["admin"],
  "delivery.senderLocations": ["admin"],

  // --- Integrations — admin only ---
  "integrations.view": ["admin"],
  "integrations.retry": ["admin"],

  // --- Email dispatch — admin only ---
  "email.view": ["admin"],
  "email.retry": ["admin"],

  // --- Admin users management — admin only ---
  "users.view": ["admin"],
  "users.approve": ["admin"],
  "users.block": ["admin"],
  "users.delete": ["admin"],
}

/** Проверка: имеет ли роль указанный permission. */
export function can(role: AdminRole | null | undefined, permission: Permission): boolean {
  if (!role) return false
  return ROLES_FOR_PERMISSION[permission].includes(role)
}

/** Маркер: админ имеет ВСЕ права автоматически (удобно для будущего добавления permissions). */
export function isAdminRole(role: AdminRole | null | undefined): role is "admin" {
  return role === "admin"
}

/**
 * Список разделов админки и их требуемые permissions — для AdminSidebar.
 * Если у роли нет permission — пункт меню скрывается.
 */
export const NAV_PERMISSIONS = {
  dashboard: null, // доступен всем авторизованным
  products: "products.view" as Permission,
  warehouse: "stock.view" as Permission,
  categories: "categories.view" as Permission,
  collections: "collections.view" as Permission,
  orders: "orders.view" as Permission,
  delivery: "delivery.settings" as Permission,
  reviews: "reviews.view" as Permission,
  promotions: "promos.view" as Permission,
  promoCodes: "promos.view" as Permission,
  blog: "blog.view" as Permission,
  blogCategories: "blog.edit" as Permission,
  integrations: "integrations.view" as Permission,
  emailDispatch: "email.view" as Permission,
  users: "users.view" as Permission,
  activity: "users.view" as Permission,
}
