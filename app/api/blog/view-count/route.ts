import { NextResponse } from "next/server"
import { incrementArticleViewCount } from "@/lib/dal/articles"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Инкремент счётчика просмотров статьи. Перенесён из server component
 * /blog/[slug] чтобы страница могла работать в режиме ISR — раньше каждый GET
 * статьи писал в БД одну UPDATE-операцию, что не давало ISR-кешу работать.
 * Дедуп на стороне клиента через sessionStorage в ArticleViewTracker.
 */
export async function POST(req: Request) {
  try {
    const { id } = (await req.json()) as { id?: string }
    if (!id || typeof id !== "string") {
      return NextResponse.json({ ok: false }, { status: 400 })
    }
    await incrementArticleViewCount(id)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
