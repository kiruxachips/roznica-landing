import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const variantIds: string[] = body.variantIds || []

  if (variantIds.length === 0) {
    return NextResponse.json({ available: [], unavailable: [] })
  }

  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds } },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          images: { where: { isPrimary: true }, take: 1 },
        },
      },
    },
  })

  const available: {
    variantId: string
    productId: string
    name: string
    weight: string
    price: number
    slug: string
    image: string | null
  }[] = []
  const unavailable: string[] = []

  for (const vid of variantIds) {
    const v = variants.find((x) => x.id === vid)
    if (!v || !v.isActive || v.stock <= 0 || !v.product.isActive) {
      unavailable.push(vid)
    } else {
      available.push({
        variantId: v.id,
        productId: v.product.id,
        name: v.product.name,
        weight: v.weight,
        price: v.price,
        slug: v.product.slug,
        image: v.product.images[0]?.url ?? null,
      })
    }
  }

  return NextResponse.json({ available, unavailable })
}
