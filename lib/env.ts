/**
 * Runtime validation of critical environment variables.
 * Imported in app/layout.tsx so it runs on server startup.
 * Skipped during `next build` (NEXT_PHASE === phase-production-build).
 */
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build"

if (process.env.NODE_ENV === "production" && !isBuildPhase) {
  const required = [
    "DATABASE_URL",
    "NEXTAUTH_SECRET",
    "NEXTAUTH_URL",
  ]

  const missing = required.filter((key) => !process.env[key])
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. ` +
      `Set them in .env or docker-compose environment.`
    )
  }

  if (process.env.NEXTAUTH_SECRET === "change-me" || process.env.NEXTAUTH_SECRET === "change-me-to-a-random-secret-in-production") {
    throw new Error(
      "NEXTAUTH_SECRET is still set to the placeholder value. " +
      "Generate a secure secret: openssl rand -base64 32"
    )
  }
}
