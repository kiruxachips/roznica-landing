import { mkdir, writeFile } from "fs/promises"
import path from "path"
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer"
import type { ReactElement } from "react"

/**
 * Рендерит PDF в буфер и сохраняет на локальный диск.
 * Возвращает публичный URL вида /uploads/wholesale/invoices/{companyId}/{number}.pdf.
 *
 * В Docker path /app/public/uploads смонтирован как volume — PDF переживают
 * rebuild контейнера. Диск очищается только при явном docker volume rm.
 */
export async function renderAndSavePDF(
  doc: ReactElement<DocumentProps>,
  subdir: string,
  filename: string
): Promise<{ url: string; size: number }> {
  const buffer = await renderToBuffer(doc)
  const dir = path.join(process.cwd(), "public", "uploads", subdir)
  await mkdir(dir, { recursive: true })
  const file = path.join(dir, filename)
  await writeFile(file, buffer)
  return {
    url: `/uploads/${subdir}/${filename}`,
    size: buffer.length,
  }
}
