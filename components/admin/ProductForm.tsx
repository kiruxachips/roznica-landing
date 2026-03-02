"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createProduct, updateProduct } from "@/lib/actions/products"
import { VariantManager } from "./VariantManager"
import { ImageUploader } from "./ImageUploader"

interface Category {
  id: string
  name: string
}

interface Variant {
  id: string
  weight: string
  price: number
  oldPrice: number | null
  stock: number
  sortOrder: number
  isActive: boolean
}

interface ProductImage {
  id: string
  url: string
  alt: string | null
  isPrimary: boolean
}

interface ProductFormProps {
  product?: {
    id: string
    name: string
    slug: string
    description: string
    fullDescription: string | null
    categoryId: string
    isActive: boolean
    isFeatured: boolean
    badge: string | null
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
    metaTitle: string | null
    metaDescription: string | null
    variants: Variant[]
    images: ProductImage[]
  }
  categories: Category[]
}

const BREWING_OPTIONS = [
  { value: "espresso", label: "Эспрессо" },
  { value: "filter", label: "Фильтр" },
  { value: "french-press", label: "Френч-пресс" },
  { value: "turka", label: "Турка" },
  { value: "aeropress", label: "Аэропресс" },
  { value: "moka", label: "Мока" },
]

export function ProductForm({ product, categories }: ProductFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Form state
  const [name, setName] = useState(product?.name ?? "")
  const [slug, setSlug] = useState(product?.slug ?? "")
  const [description, setDescription] = useState(product?.description ?? "")
  const [fullDescription, setFullDescription] = useState(product?.fullDescription ?? "")
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? categories[0]?.id ?? "")
  const [isActive, setIsActive] = useState(product?.isActive ?? true)
  const [isFeatured, setIsFeatured] = useState(product?.isFeatured ?? false)
  const [badge, setBadge] = useState(product?.badge ?? "")
  const [origin, setOrigin] = useState(product?.origin ?? "")
  const [region, setRegion] = useState(product?.region ?? "")
  const [farm, setFarm] = useState(product?.farm ?? "")
  const [altitude, setAltitude] = useState(product?.altitude ?? "")
  const [roastLevel, setRoastLevel] = useState(product?.roastLevel ?? "")
  const [processingMethod, setProcessingMethod] = useState(product?.processingMethod ?? "")
  const [flavorNotesInput, setFlavorNotesInput] = useState(product?.flavorNotes.join(", ") ?? "")
  const [acidity, setAcidity] = useState(product?.acidity ?? 50)
  const [sweetness, setSweetness] = useState(product?.sweetness ?? 50)
  const [bitterness, setBitterness] = useState(product?.bitterness ?? 50)
  const [body, setBody] = useState(product?.body ?? 50)
  const [brewingMethods, setBrewingMethods] = useState<string[]>(product?.brewingMethods ?? [])
  const [metaTitle, setMetaTitle] = useState(product?.metaTitle ?? "")
  const [metaDescription, setMetaDescription] = useState(product?.metaDescription ?? "")

  function generateSlug(text: string) {
    const map: Record<string, string> = {
      а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh",
      з: "z", и: "i", й: "j", к: "k", л: "l", м: "m", н: "n", о: "o",
      п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c",
      ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
    }
    return text
      .toLowerCase()
      .split("")
      .map((char) => map[char] || char)
      .join("")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
  }

  function handleNameChange(value: string) {
    setName(value)
    if (!product) {
      setSlug(generateSlug(value))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const flavorNotes = flavorNotesInput
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean)

    try {
      const data = {
        name,
        slug,
        description,
        fullDescription: fullDescription || undefined,
        categoryId,
        isActive,
        isFeatured,
        badge: badge || undefined,
        origin: origin || undefined,
        region: region || undefined,
        farm: farm || undefined,
        altitude: altitude || undefined,
        roastLevel: roastLevel || undefined,
        processingMethod: processingMethod || undefined,
        flavorNotes,
        acidity,
        sweetness,
        bitterness,
        body,
        brewingMethods,
        metaTitle: metaTitle || undefined,
        metaDescription: metaDescription || undefined,
      }

      if (product) {
        await updateProduct(product.id, data)
      } else {
        await createProduct(data)
      }
      router.push("/admin/products")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl">
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Basic info */}
      <section className="bg-white rounded-xl p-6 shadow-sm border border-border">
        <h2 className="text-lg font-semibold mb-4">Основная информация</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Название *</label>
            <input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
              className="w-full h-10 px-3 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Slug *</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
              className="w-full h-10 px-3 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Короткое описание *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Полное описание</label>
            <textarea
              value={fullDescription}
              onChange={(e) => setFullDescription(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Категория *</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Бейдж</label>
            <input
              value={badge}
              onChange={(e) => setBadge(e.target.value)}
              placeholder="Хит продаж, Новинка..."
              className="w-full h-10 px-3 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded" />
              Активен
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} className="rounded" />
              На главной
            </label>
          </div>
        </div>
      </section>

      {/* Coffee attributes */}
      <section className="bg-white rounded-xl p-6 shadow-sm border border-border">
        <h2 className="text-lg font-semibold mb-4">Кофейные атрибуты</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Страна</label>
            <input value={origin} onChange={(e) => setOrigin(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Регион</label>
            <input value={region} onChange={(e) => setRegion(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Ферма</label>
            <input value={farm} onChange={(e) => setFarm(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Высота</label>
            <input value={altitude} onChange={(e) => setAltitude(e.target.value)} placeholder="1200-1800м" className="w-full h-10 px-3 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Обжарка</label>
            <select value={roastLevel} onChange={(e) => setRoastLevel(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="">Не указано</option>
              <option value="Светлая">Светлая</option>
              <option value="Средняя">Средняя</option>
              <option value="Тёмная">Тёмная</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Обработка</label>
            <select value={processingMethod} onChange={(e) => setProcessingMethod(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="">Не указано</option>
              <option value="Мытая">Мытая</option>
              <option value="Натуральная">Натуральная</option>
              <option value="Хани">Хани</option>
            </select>
          </div>
          <div className="md:col-span-3">
            <label className="block text-sm font-medium mb-1">Вкусовые ноты (через запятую)</label>
            <input
              value={flavorNotesInput}
              onChange={(e) => setFlavorNotesInput(e.target.value)}
              placeholder="Шоколад, Карамель, Цитрус"
              className="w-full h-10 px-3 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </section>

      {/* Flavor profile */}
      <section className="bg-white rounded-xl p-6 shadow-sm border border-border">
        <h2 className="text-lg font-semibold mb-4">Профиль вкуса</h2>
        <div className="space-y-4">
          {[
            { label: "Кислотность", value: acidity, set: setAcidity },
            { label: "Сладость", value: sweetness, set: setSweetness },
            { label: "Горечь", value: bitterness, set: setBitterness },
            { label: "Тело", value: body, set: setBody },
          ].map(({ label, value, set }) => (
            <div key={label} className="flex items-center gap-4">
              <span className="text-sm font-medium w-28">{label}</span>
              <input
                type="range"
                min={0}
                max={100}
                value={value}
                onChange={(e) => set(Number(e.target.value))}
                className="flex-1 accent-primary"
              />
              <span className="text-sm text-muted-foreground w-10 text-right">{value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Brewing methods */}
      <section className="bg-white rounded-xl p-6 shadow-sm border border-border">
        <h2 className="text-lg font-semibold mb-4">Способы заваривания</h2>
        <div className="flex flex-wrap gap-3">
          {BREWING_OPTIONS.map((method) => (
            <label key={method.value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={brewingMethods.includes(method.value)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setBrewingMethods([...brewingMethods, method.value])
                  } else {
                    setBrewingMethods(brewingMethods.filter((m) => m !== method.value))
                  }
                }}
                className="rounded"
              />
              {method.label}
            </label>
          ))}
        </div>
      </section>

      {/* Images (only for existing products) */}
      {product && (
        <section className="bg-white rounded-xl p-6 shadow-sm border border-border">
          <h2 className="text-lg font-semibold mb-4">Изображения</h2>
          <ImageUploader productId={product.id} images={product.images} />
        </section>
      )}

      {/* Variants (only for existing products) */}
      {product && (
        <section className="bg-white rounded-xl p-6 shadow-sm border border-border">
          <h2 className="text-lg font-semibold mb-4">Варианты (вес и цена)</h2>
          <VariantManager productId={product.id} variants={product.variants} />
        </section>
      )}

      {/* SEO */}
      <section className="bg-white rounded-xl p-6 shadow-sm border border-border">
        <h2 className="text-lg font-semibold mb-4">SEO</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Meta Title</label>
            <input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Meta Description</label>
            <textarea value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
        </div>
      </section>

      {/* Submit */}
      <div className="flex gap-4">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? "Сохранение..." : product ? "Сохранить" : "Создать товар"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/products")}
          className="px-6 py-2 border border-border rounded-lg text-sm hover:bg-muted transition-colors"
        >
          Отмена
        </button>
      </div>
    </form>
  )
}
