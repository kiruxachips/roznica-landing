export async function fetchWithTimeout(
  url: string,
  opts: RequestInit = {},
  timeoutMs = 10_000
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...opts, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}
