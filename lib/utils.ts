import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Компактная пагинация: возвращает массив страниц/эллипсисов вокруг текущей.
 * Пример при total=20, current=10:
 *   [1, "...", 9, 10, 11, "...", 20]
 * Если total ≤ 7 — возвращает все страницы. Используется в ЛК и на блоге,
 * чтобы 50 кнопок не разворачивались на двух мобильных строках.
 */
export function paginateRange(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const result: (number | "...")[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) result.push("...")
  for (let i = start; i <= end; i++) result.push(i)
  if (end < total - 1) result.push("...")
  result.push(total)
  return result
}
