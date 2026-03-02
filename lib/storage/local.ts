import { writeFile, mkdir, unlink } from "fs/promises"
import path from "path"
import sharp from "sharp"

export async function saveImageLocal(file: Buffer, filename: string, entityId: string, type: string = "products"): Promise<string> {
  const dir = path.join(process.cwd(), "public", "uploads", type, entityId)
  await mkdir(dir, { recursive: true })

  // Convert to WebP
  const webpFilename = filename.replace(/\.[^.]+$/, ".webp")
  const webpBuffer = await sharp(file).webp({ quality: 85 }).resize(1200, 1600, { fit: "inside", withoutEnlargement: true }).toBuffer()

  const filePath = path.join(dir, webpFilename)
  await writeFile(filePath, webpBuffer)

  return `/uploads/${type}/${entityId}/${webpFilename}`
}

export async function deleteImageLocal(url: string): Promise<void> {
  const filePath = path.join(process.cwd(), "public", url)
  try {
    await unlink(filePath)
  } catch {
    // File may already be deleted
  }
}
