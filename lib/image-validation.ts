/**
 * P1-12: валидация файла-картинки по magic-bytes.
 *
 * Браузер позволяет подделать File.type и расширение — нельзя им доверять.
 * Читаем первые байты буфера и сравниваем с сигнатурами поддерживаемых
 * форматов. Использовать ДО сохранения на диск и ДО записи в БД.
 *
 * Поддерживаем: JPEG, PNG, WebP, GIF. SVG намеренно НЕ поддерживаем:
 * SVG содержит XML с потенциально скриптуемым контентом; если понадобится,
 * нужен отдельный санитайзер.
 */
export interface ImageMagicCheck {
  ok: boolean
  detected?: "image/jpeg" | "image/png" | "image/webp" | "image/gif"
}

export function validateImageMagicBytes(buf: Buffer): ImageMagicCheck {
  if (buf.length < 12) return { ok: false }

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ok: true, detected: "image/jpeg" }
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return { ok: true, detected: "image/png" }
  }
  // WebP: "RIFF" + (4 bytes size) + "WEBP"
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return { ok: true, detected: "image/webp" }
  }
  // GIF: "GIF87a" или "GIF89a"
  if (
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38 &&
    (buf[4] === 0x37 || buf[4] === 0x39) &&
    buf[5] === 0x61
  ) {
    return { ok: true, detected: "image/gif" }
  }
  return { ok: false }
}
