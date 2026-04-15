export type ProductType = "coffee" | "tea" | "instant"

export interface ProductCard {
  id: string
  name: string
  slug: string
  description: string
  productType: ProductType
  productForm: string | null
  origin: string | null
  roastLevel: string | null
  badge: string | null
  flavorNotes: string[]
  primaryImage: string | null
  primaryImageAlt: string | null
  minPrice: number | null
  minOldPrice: number | null
  reviewCount: number
  averageRating: number | null
  firstVariant: { id: string; weight: string; price: number; oldPrice: number | null; stock: number } | null
  variants?: { id: string; weight: string; price: number; oldPrice: number | null; stock: number }[]
}

export interface ProductDetail {
  id: string
  name: string
  slug: string
  description: string
  fullDescription: string | null
  productType: ProductType
  productForm: string | null
  origin: string | null
  region: string | null
  farm: string | null
  altitude: string | null
  roastLevel: string | null
  processingMethod: string | null
  flavorNotes: string[]
  acidity: number | null
  sweetness: number | null
  bitterness: number | null
  body: number | null
  brewingMethods: string[]
  badge: string | null
  metaTitle: string | null
  metaDescription: string | null
  category: {
    name: string
    slug: string
  }
  images: {
    id: string
    url: string
    alt: string | null
    isPrimary: boolean
  }[]
  variants: {
    id: string
    weight: string
    price: number
    oldPrice: number | null
    stock: number
  }[]
  reviews: {
    id: string
    name: string
    text: string
    rating: number
    date: string | null
    createdAt: Date
  }[]
}

export interface CategoryInfo {
  id: string
  name: string
  slug: string
  description: string | null
  image: string | null
  productCount: number
}

export interface CartItem {
  productId: string
  variantId: string
  name: string
  weight: string
  price: number
  image: string | null
  quantity: number
  slug: string
}

export interface OrderData {
  customerName: string
  customerEmail?: string
  customerPhone: string
  deliveryAddress?: string
  deliveryMethod?: string
  paymentMethod?: string
  notes?: string
  userId?: string
  promoCode?: string
  bonusAmount?: number
  // Delivery module fields
  deliveryType?: "door" | "pvz"
  deliveryPrice?: number
  pickupPointCode?: string
  pickupPointName?: string
  destinationCity?: string
  destinationCityCode?: string
  estimatedDelivery?: string
  tariffCode?: number
  postalCode?: string
  items: {
    productId: string
    variantId: string
    name: string
    weight: string
    price: number
    quantity: number
  }[]
}

export interface FavoriteProduct {
  id: string
  productId: string
  createdAt: Date
  product: ProductCard
}

export interface BonusTransactionInfo {
  id: string
  amount: number
  type: string
  description: string
  orderId: string | null
  createdAt: Date
}

export interface ProductFilters {
  categorySlug?: string
  collectionSlug?: string
  productType?: ProductType
  roastLevel?: string
  origin?: string
  brewingMethod?: string
  teaType?: string
  productForm?: string
  search?: string
  sort?: "price-asc" | "price-desc" | "newest" | "popular"
  page?: number
  limit?: number
}

// Blog types
export interface ArticleCategoryInfo {
  id: string
  name: string
  slug: string
  description: string | null
  articleCount: number
}

export interface ArticleCard {
  id: string
  title: string
  slug: string
  excerpt: string
  coverImage: string | null
  category: { name: string; slug: string } | null
  tags: string[]
  publishedAt: Date | null
  readingTime: number
}

export interface ArticleDetail extends ArticleCard {
  content: string
  viewCount: number
  categoryId: string | null
  metaTitle: string | null
  metaDescription: string | null
}

export interface ArticleFilters {
  categorySlug?: string
  tag?: string
  search?: string
  page?: number
  limit?: number
}
