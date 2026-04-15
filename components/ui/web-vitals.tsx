"use client"

import { useReportWebVitals } from "next/web-vitals"

const METRIKA_ID = 106584393

export function WebVitals() {
  useReportWebVitals((metric) => {
    if (typeof window === "undefined") return
    const ym = (window as unknown as { ym?: (...args: unknown[]) => void }).ym
    if (typeof ym !== "function") return

    ym(METRIKA_ID, "params", {
      web_vitals: {
        [metric.name]: Math.round(metric.name === "CLS" ? metric.value * 1000 : metric.value),
      },
    })
  })

  return null
}
