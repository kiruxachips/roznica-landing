import { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Millor Coffee - Свежеобжаренный кофе",
    short_name: "Millor Coffee",
    description: "Свежеобжаренный кофе в зёрнах для дома с доставкой по России",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2d6b4a",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  }
}
