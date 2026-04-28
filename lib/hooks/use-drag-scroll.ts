"use client"

import { useCallback, useEffect, useRef, useState, type RefObject } from "react"

export interface DragScrollHandle<T extends HTMLElement> {
  ref: RefObject<T | null>
  canScrollLeft: boolean
  canScrollRight: boolean
  scrollByAmount: (delta: number) => void
}

/**
 * Десктопный drag-to-scroll для горизонтальных лент (категории товаров, чипы).
 * На мобиле не нужен — там нативный touch-скролл. Активируется только для мыши,
 * touch-события не перехватываются.
 *
 * Возвращает ref + признаки наличия скролла слева/справа + helper для прокрутки
 * на заданное число пикселей. Признаки переключаются по `scroll`/`resize` —
 * на их основе рисуем стрелки навигации.
 *
 * Порог 5px разделяет click vs drag: если мышка прошла меньше — это клик,
 * внутренние `<a>` должны отработать навигацию. Если больше — preventDefault
 * на click перехватывает переход.
 */
export function useDragScroll<T extends HTMLElement>(): DragScrollHandle<T> {
  const ref = useRef<T>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let isDown = false
    let startX = 0
    let startScrollLeft = 0
    let moved = false

    const DRAG_THRESHOLD = 5

    function onMouseDown(e: MouseEvent) {
      if (e.button !== 0 || !el) return
      isDown = true
      moved = false
      startX = e.clientX
      startScrollLeft = el.scrollLeft
      el.style.cursor = "grabbing"
      el.style.userSelect = "none"
    }

    function onMouseMove(e: MouseEvent) {
      if (!isDown || !el) return
      const dx = e.clientX - startX
      if (!moved && Math.abs(dx) < DRAG_THRESHOLD) return
      moved = true
      e.preventDefault()
      el.scrollLeft = startScrollLeft - dx
    }

    function onMouseUp() {
      if (!el) return
      isDown = false
      el.style.cursor = ""
      el.style.userSelect = ""
      // Сбрасываем `moved` после короткого тика: сначала отрабатывает
      // capture-handler `onClickCapture` (читает текущее `moved`), затем
      // флаг очищается, чтобы следующий чистый клик не блокировался.
      queueMicrotask(() => {
        moved = false
      })
    }

    function onMouseLeave() {
      onMouseUp()
    }

    function onClickCapture(e: MouseEvent) {
      if (moved) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    el.addEventListener("mousedown", onMouseDown)
    el.addEventListener("mousemove", onMouseMove)
    el.addEventListener("mouseup", onMouseUp)
    el.addEventListener("mouseleave", onMouseLeave)
    el.addEventListener("click", onClickCapture, true)

    return () => {
      el.removeEventListener("mousedown", onMouseDown)
      el.removeEventListener("mousemove", onMouseMove)
      el.removeEventListener("mouseup", onMouseUp)
      el.removeEventListener("mouseleave", onMouseLeave)
      el.removeEventListener("click", onClickCapture, true)
    }
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Порог 8px разделяет «реально проскроллили» от «дёрнули inertial scroll
    // на трекпаде» — иначе на каждый микро-сдвиг стрелки моргают.
    const update = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el
      setCanScrollLeft(scrollLeft > 8)
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 8)
    }

    update()
    el.addEventListener("scroll", update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)

    return () => {
      el.removeEventListener("scroll", update)
      ro.disconnect()
    }
  }, [])

  const scrollByAmount = useCallback((delta: number) => {
    ref.current?.scrollBy({ left: delta, behavior: "smooth" })
  }, [])

  return { ref, canScrollLeft, canScrollRight, scrollByAmount }
}
