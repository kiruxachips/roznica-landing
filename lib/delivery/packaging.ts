/**
 * Умная упаковка заказов в физические коробки.
 *
 * Модель: у коробки есть «ёмкость в юнитах». Юнит — условный объём, пропорциональный весу пачки.
 * Алгоритм жадный: берём самую маленькую коробку, куда влезает весь заказ по весу И по юнитам;
 * если ни одна не подходит — набиваем самыми большими до тех пор, пока остаток не уложится в меньшую.
 */

export interface BoxPreset {
  code: string              // "S" | "M" | "L" | кастомный
  name: string              // человекочитаемое имя
  length: number            // см
  width: number             // см
  height: number            // см
  tareGrams: number         // вес пустой коробки
  maxWeightGrams: number    // максимальный НЕТТО-вес, по которому решаем «переходим на следующий размер»
  maxUnits: number          // максимальная вместимость в юнитах
}

export interface ItemToPack {
  weightGrams: number       // нетто-вес одной пачки
  quantity: number
}

export interface Package {
  length: number            // см
  width: number             // см
  height: number            // см
  weight: number            // грамм (нетто заложенного содержимого + тара коробки)
  presetCode: string        // код пресета, использованного для этой коробки
}

export const DEFAULT_BOX_PRESETS: BoxPreset[] = [
  { code: "S", name: "Маленькая 20×20×20", length: 20, width: 20, height: 20, tareGrams: 150, maxWeightGrams: 2500, maxUnits: 8 },
  { code: "M", name: "Средняя 31×23×20",   length: 31, width: 23, height: 20, tareGrams: 220, maxWeightGrams: 4500, maxUnits: 14 },
  { code: "L", name: "Большая 39×26×21",   length: 39, width: 26, height: 21, tareGrams: 300, maxWeightGrams: 7500, maxUnits: 23 },
]

/**
 * Парсит JSON-строку пресетов из настроек. Возвращает дефолт, если настроек нет
 * или они повреждены. Всегда возвращает отсортированный по maxWeightGrams массив
 * и гарантирует, что хотя бы один пресет есть.
 */
export function parseBoxPresets(json: string | null | undefined): BoxPreset[] {
  if (!json) return DEFAULT_BOX_PRESETS
  try {
    const parsed = JSON.parse(json)
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_BOX_PRESETS
    const valid = parsed.filter(isValidPreset)
    if (valid.length === 0) return DEFAULT_BOX_PRESETS
    return [...valid].sort((a, b) => a.maxWeightGrams - b.maxWeightGrams)
  } catch {
    return DEFAULT_BOX_PRESETS
  }
}

function isValidPreset(p: unknown): p is BoxPreset {
  if (!p || typeof p !== "object") return false
  const o = p as Record<string, unknown>
  return (
    typeof o.code === "string" &&
    typeof o.name === "string" &&
    typeof o.length === "number" && o.length > 0 &&
    typeof o.width === "number" && o.width > 0 &&
    typeof o.height === "number" && o.height > 0 &&
    typeof o.tareGrams === "number" && o.tareGrams >= 0 &&
    typeof o.maxWeightGrams === "number" && o.maxWeightGrams > 0 &&
    typeof o.maxUnits === "number" && o.maxUnits > 0
  )
}

/**
 * Сколько «юнитов» занимает одна пачка заданного веса.
 * Юнит ≈ объём типичной 250-граммовой пачки кофе.
 * Калибровка подобрана так, чтобы 2×1кг + 2×250г = 8 юнитов (ёмкость S-коробки).
 */
export function unitsFor(weightGrams: number): number {
  if (weightGrams <= 0) return 0
  if (weightGrams <= 300) return 1   // маленькая пачка 250 г
  if (weightGrams <= 700) return 2   // средняя пачка 500 г (гипотетическая)
  if (weightGrams <= 1200) return 3  // большая пачка 1 кг
  return Math.ceil(weightGrams / 400)
}

/** Общее число юнитов в заказе */
function totalUnits(items: ItemToPack[]): number {
  return items.reduce((s, it) => s + unitsFor(it.weightGrams) * Math.max(0, it.quantity), 0)
}

/** Общий нетто-вес в заказе (грамм) */
function totalWeightGrams(items: ItemToPack[]): number {
  return items.reduce((s, it) => s + Math.max(0, it.weightGrams) * Math.max(0, it.quantity), 0)
}

function packageFromPreset(preset: BoxPreset, netWeightGrams: number): Package {
  return {
    length: preset.length,
    width: preset.width,
    height: preset.height,
    weight: Math.max(1, Math.ceil(netWeightGrams + preset.tareGrams)),
    presetCode: preset.code,
  }
}

/**
 * Строит физический план упаковки заказа.
 *
 * Алгоритм:
 * 1. Считаем общий нетто-вес и общее число юнитов.
 * 2. Если весь заказ влезает в одну коробку (по весу И по юнитам) — берём наименьшую подходящую.
 * 3. Иначе набиваем самую большую коробку до её лимита (по весу или по юнитам — что раньше заполнится),
 *    и продолжаем с остатком, пока остаток не уложится в одну коробку.
 *
 * Гарантии:
 * - Всегда возвращает минимум одну коробку (даже при пустом заказе — для устойчивости API-вызовов).
 * - Каждая отдельная коробка по весу НЕ превышает maxWeightGrams своего пресета (буфер уходит в следующую).
 * - Финальный остаток кладётся в минимально подходящую коробку — меньшие коробки дешевле в доставке.
 */
export function planPackages(items: ItemToPack[], presets: BoxPreset[] = DEFAULT_BOX_PRESETS): Package[] {
  const sorted = [...presets].sort((a, b) => a.maxWeightGrams - b.maxWeightGrams)
  const largest = sorted[sorted.length - 1]
  if (!largest) throw new Error("planPackages: пресеты коробок не заданы")

  const totalW = totalWeightGrams(items)
  const totalU = totalUnits(items)

  // Пустой или невалидный заказ — одна минимальная коробка с 1 г.
  // Это защита от падения API, в нормальном потоке не должно случаться.
  if (totalW <= 0 || totalU <= 0) {
    return [packageFromPreset(sorted[0], 0)]
  }

  // Одна коробка целиком?
  const singleFit = sorted.find((p) => totalW <= p.maxWeightGrams && totalU <= p.maxUnits)
  if (singleFit) {
    return [packageFromPreset(singleFit, totalW)]
  }

  // Нужно несколько коробок. Средний вес пачки (в граммах на 1 юнит) — используем
  // для пропорционального распределения, чтобы не получалось «пустых» коробок
  // в конце: вес и юниты отнимаются согласованно, как физическая пачка.
  const avgWeightPerUnit = totalW / totalU
  const boxes: Package[] = []
  let remainingW = totalW
  let remainingU = totalU

  const maxIterations = 100
  let iter = 0

  while (remainingW > largest.maxWeightGrams || remainingU > largest.maxUnits) {
    if (++iter > maxIterations) break

    // Сколько юнитов можно положить в коробку: ограничение либо по юнитам, либо по весу
    const unitsByUnitCap = Math.min(remainingU, largest.maxUnits)
    const unitsByWeightCap = Math.floor(largest.maxWeightGrams / avgWeightPerUnit)
    const filledU = Math.max(1, Math.min(unitsByUnitCap, unitsByWeightCap))

    // Вес заполненной части — ровно соответствует числу юнитов
    const filledW = Math.min(remainingW, Math.round(filledU * avgWeightPerUnit))

    boxes.push(packageFromPreset(largest, filledW))
    remainingW -= filledW
    remainingU -= filledU
  }

  // Остаток: наименьшая коробка, куда он влезает. Пустую (U=0, W=0) коробку не добавляем.
  if (remainingW > 0 || remainingU > 0) {
    const fit = sorted.find((p) => remainingW <= p.maxWeightGrams && remainingU <= p.maxUnits) || largest
    boxes.push(packageFromPreset(fit, Math.max(0, remainingW)))
  }

  return boxes
}

/**
 * Сводит массив коробок в одну «виртуальную» для API-провайдеров, которые не умеют
 * в мультикоробку на уровне одного запроса расчёта. Суммирует вес, берёт максимальные
 * габариты по каждой оси. Используется как запасной путь, НЕ как основной (мультикоробочные
 * вызовы дают более честную цену).
 */
export function mergeToVirtualPackage(packages: Package[]): Package {
  if (packages.length === 0) throw new Error("mergeToVirtualPackage: empty packages")
  if (packages.length === 1) return packages[0]
  return {
    length: Math.max(...packages.map((p) => p.length)),
    width: Math.max(...packages.map((p) => p.width)),
    height: Math.max(...packages.map((p) => p.height)),
    weight: packages.reduce((s, p) => s + p.weight, 0),
    presetCode: packages.map((p) => p.presetCode).join("+"),
  }
}

/** Итоговый брутто-вес плана (сумма всех коробок с учётом тары) */
export function totalPlanWeight(packages: Package[]): number {
  return packages.reduce((s, p) => s + p.weight, 0)
}

/**
 * Распределяет товарные позиции по физическим коробкам плана упаковки.
 * Используется при формировании отгрузки (CDEK shipment requires items per package).
 *
 * Алгоритм: разворачиваем позиции в отдельные пачки, сортируем по убыванию веса,
 * раскладываем жадно в первую подходящую коробку по её оставшемуся весу. После —
 * сворачиваем обратно в агрегированные позиции по (name, weight, price).
 *
 * Для одной коробки: все позиции попадают в неё (fast path).
 */
export interface ShipmentItem {
  name: string
  weight: number // grams per unit (НЕТТО одной пачки)
  price: number
  quantity: number
}

export function distributeItemsToPackages(
  items: ShipmentItem[],
  packages: Package[]
): ShipmentItem[][] {
  if (packages.length === 0) return []
  if (packages.length === 1) return [items.map((i) => ({ ...i }))]

  type Unit = { name: string; weight: number; price: number }
  const units: Unit[] = []
  for (const item of items) {
    for (let k = 0; k < Math.max(0, item.quantity); k++) {
      units.push({ name: item.name, weight: item.weight, price: item.price })
    }
  }
  units.sort((a, b) => b.weight - a.weight) // тяжёлые первыми

  const assigned: Unit[][] = packages.map(() => [])
  const remaining = packages.map((p) => p.weight) // допустимый вес на коробку (с тарой, но close enough)

  for (const u of units) {
    let placed = false
    for (let bIdx = 0; bIdx < packages.length; bIdx++) {
      if (remaining[bIdx] >= u.weight) {
        assigned[bIdx].push(u)
        remaining[bIdx] -= u.weight
        placed = true
        break
      }
    }
    if (!placed) {
      // Фолбэк: в коробку с наибольшим остатком
      let bestIdx = 0
      for (let bIdx = 1; bIdx < packages.length; bIdx++) {
        if (remaining[bIdx] > remaining[bestIdx]) bestIdx = bIdx
      }
      assigned[bestIdx].push(u)
      remaining[bestIdx] -= u.weight
    }
  }

  // Сворачиваем обратно
  return assigned.map((boxUnits) => {
    const byKey = new Map<string, ShipmentItem>()
    for (const u of boxUnits) {
      const key = `${u.name}|${u.weight}|${u.price}`
      const existing = byKey.get(key)
      if (existing) existing.quantity++
      else byKey.set(key, { name: u.name, weight: u.weight, price: u.price, quantity: 1 })
    }
    return Array.from(byKey.values())
  })
}
