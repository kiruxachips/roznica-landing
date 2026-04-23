"use client"

import { useEffect, useRef, type RefObject } from "react"

/**
 * Десктопный drag-to-scroll для горизонтальных лент (категории товаров, чипы).
 * На мобиле не нужен — там нативный touch-скролл. Активируется только для мыши,
 * touch-события не перехватываются.
 *
 * Возвращает ref на контейнер, на который вешаются handlers.
 *
 * Порог 5px разделяет click vs drag: если мышка прошла меньше — это клик,
 * внутренние `<a>` должны отработать навигацию. Если больше — preventDefault
 * на click перехватывает переход.
 */
export function useDragScroll<T extends HTMLElement>(): RefObject<T | null> {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let isDown = false
    let startX = 0
    let startScrollLeft = 0
    let moved = false

    const DRAG_THRESHOLD = 5

    function onMouseDown(e: MouseEvent) {
      // Только ЛКМ, игнорируем touch-devices (у них есть нативный скролл)
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
    }

    function onMouseLeave() {
      onMouseUp()
    }

    // Перехватываем клик по внутренним <a> ровно в том случае, если
    // пользователь тянул мышь — иначе переход по карточке отработает.
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

  return ref
}
