/**
 * Runtime validation of critical environment variables.
 * Imported in app/layout.tsx so it runs once on server startup.
 */
if (process.env.NODE_ENV === "production") {
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
