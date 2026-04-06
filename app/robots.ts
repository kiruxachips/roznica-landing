import { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/auth/", "/account/", "/checkout/", "/cart", "/thank-you"],
      },
    ],
    sitemap: "https://millor-coffee.ru/sitemap.xml",
  }
}
