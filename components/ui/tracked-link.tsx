"use client"

import { cn } from "@/lib/utils"

interface TrackedLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  children: React.ReactNode
}

export function TrackedLink({ children, className, onClick, ...props }: TrackedLinkProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (typeof window !== "undefined" && typeof window.ym === "function") {
      window.ym(106584393, "reachGoal", "button")
    }
    onClick?.(e)
  }

  return (
    <a className={cn(className)} onClick={handleClick} {...props}>
      {children}
    </a>
  )
}
