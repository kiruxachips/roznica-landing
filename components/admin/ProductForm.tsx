"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createProduct, updateProduct } from "@/lib/actions/products"
import { syncProductCollections } from "@/lib/actions/collections"
import { uploadImage } from "@/lib/actions/images"
import { VariantManager } from "./VariantManager"
import { ImageUploader } from "./ImageUploader"
import { InlineVariantEditor, type LocalVariant } from "./InlineVariantEditor"
import { InlineImagePicker } from "./InlineImagePicker"
import {
  isSectionVisible,
  getSectionTitle,
  getBrewingOptions,
  getWeightOptions,
  getTemplates,
  getFieldConfig,
  type CategoryTemplate,
} from "@/lib/category-config"

interface Category {
  id: string
  name: string
  slug: string
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

interface CollectionOption {
  id: string
  name: string
  emoji: string | null
}

interface ProductFormProps {
  collections?: CollectionOption[]
  productCollectionIds?: string[]
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
    productType: string
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
    metaTitle: string | null
    metaDescription: string | null
    smallImage: string | null
    variants: Variant[]
    images: ProductImage[]
  }
  categories: Category[]
}

export function ProductForm({ product, categories, collections = [], productCollectionIds = [] }: ProductFormProps) {
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
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>(productCollectionIds)
  const [badge, setBadge] = useState(product?.badge ?? "")
  const [productType, setProductType] = useState(product?.productType ?? "coffee")
  const [productForm, setProductForm] = useState(product?.productForm ?? "")
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
  const [smallImage, setSmallImage] = useState(product?.smallImage ?? "")

  // Inline create state (only for new products)
  const [localVariants, setLocalVariants] = useState<LocalVariant[]>([])
  const [pendingImages, setPendingImages] = useState<File[]>([])

  // Derive category slug from selected categoryId
  const categorySlug = categories.find((c) => c.id === categoryId)?.slug ?? ""

  // Field visibility helpers
  const fields = getFieldConfig(categorySlug)
  const hasAnyAttributes = fields.length > 0
  const showOrigin = isSectionVisible(categorySlug, "origin")
  const showRegion = isSectionVisible(categorySlug, "region")
  const showFarm = isSectionVisible(categorySlug, "farm")
  const showAltitude = isSectionVisible(categorySlug, "altitude")
  const showRoastLevel = isSectionVisible(categorySlug, "roastLevel")
  const showProcessingMethod = isSectionVisible(categorySlug, "processingMethod")
  const showFlavorNotes = isSectionVisible(categorySlug, "flavorNotes")
  const showFlavorProfile = isSectionVisible(categorySlug, "flavorProfile")
  const showBrewingMethods = isSectionVisible(categorySlug, "brewingMethods")

  // Templates
  const templates = !product ? getTemplates(categorySlug) : []

  // Brewing options depend on category
  const brewingOptions = getBrewingOptions(categorySlug)

  // Weight options depend on category
  const weightOptions = getWeightOptions(categorySlug)

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

  function handleCategoryChange(newCategoryId: string) {
    const newSlug = categories.find((c) => c.id === newCategoryId)?.slug ?? ""
    const newFields = getFieldConfig(newSlug)

    // Clear fields that are no longer visible
    if (!newFields.includes("origin")) setOrigin("")
    if (!newFields.includes("region")) setRegion("")
    if (!newFields.includes("farm")) setFarm("")
    if (!newFields.includes("altitude")) setAltitude("")
    if (!newFields.includes("roastLevel")) setRoastLevel("")
    if (!newFields.includes("processingMethod")) setProcessingMethod("")
    if (!newFields.includes("flavorNotes")) setFlavorNotesInput("")
    if (!newFields.includes("flavorProfile")) {
      setAcidity(50)
      setSweetness(50)
      setBitterness(50)
      setBody(50)
    }
    if (!newFields.includes("brewingMethods")) setBrewingMethods([])

    // Reset inline variants when category changes (weight options differ)
    if (!product) setLocalVariants([])

    setCategoryId(newCategoryId)
  }

  function applyTemplate(template: CategoryTemplate) {
    setName(template.name)
    setSlug(generateSlug(template.name))
    setDescription(template.description)

    const attrs = template.attributes
    if (attrs.origin) setOrigin(attrs.origin)
    if (attrs.region) setRegion(attrs.region)
    if (attrs.farm) setFarm(attrs.farm)
    if (attrs.altitude) setAltitude(attrs.altitude)
    if (attrs.roastLevel) setRoastLevel(attrs.roastLevel)
    if (attrs.processingMethod) setProcessingMethod(attrs.processingMethod)
    if (attrs.flavorNotes) setFlavorNotesInput(attrs.flavorNotes)
    if (attrs.acidity !== undefined) setAcidity(attrs.acidity)
    if (attrs.sweetness !== undefined) setSweetness(attrs.sweetness)
    if (attrs.bitterness !== undefined) setBitterness(attrs.bitterness)
    if (attrs.body !== undefined) setBody(attrs.body)
    if (attrs.brewingMethods) setBrewingMethods(attrs.brewingMethods)

    // Apply default variants
    setLocalVariants(
      template.variants.map((v, i) => ({
        key: `template-${i}-${Date.now()}`,
        weight: v.weight,
        price: v.price,
        oldPrice: v.oldPrice ?? null,
        stock: v.stock,
      }))
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const flavorNotes = showFlavorNotes
      ? flavorNotesInput.split(",").map((n) => n.trim()).filter(Boolean)
      : []

    try {
      // Build data, only including visible attribute fields
      const data: Record<string, unknown> = {
        name,
        slug,
        description,
        fullDescription: fullDescription || undefined,
        categoryId,
        isActive,
        isFeatured,
        badge: badge || undefined,
        productType,
        productForm: productForm || undefined,
        metaTitle: metaTitle || undefined,
        metaDescription: metaDescription || undefined,
        smallImage: smallImage || undefined,
      }

      // Only include attributes that are visible for this category
      if (showOrigin) data.origin = origin || undefined
      if (showRegion) data.region = region || undefined
      if (showFarm) data.farm = farm || undefined
      if (showAltitude) data.altitude = altitude || undefined
      if (showRoastLevel) data.roastLevel = roastLevel || undefined
      if (showProcessingMethod) data.processingMethod = processingMethod || undefined
      if (showFlavorNotes) data.flavorNotes = flavorNotes
      if (showFlavorProfile) {
        data.acidity = acidity
        data.sweetness = sweetness
        data.bitterness = bitterness
        data.body = body
      }
      if (showBrewingMethods) data.brewingMethods = brewingMethods

      if (product) {
        // Update existing product
        await updateProduct(product.id, data)
        await syncProductCollections(product.id, selectedCollectionIds)
        router.push("/admin/products")
        router.refresh()
      } else {
        // Create new product with variants
        if (localVariants.length > 0) {
          data.variants = localVariants.map((v) => ({
            weight: v.weight,
            price: v.price,
            oldPrice: v.oldPrice,
            stock: v.stock,
          }))
        }

        const created = await createProduct(data as Parameters<typeof createProduct>[0])
        await syncProductCollections(created.id, selectedCollectionIds)

        // Upload pending images
        if (pendingImages.length > 0) {
          for (const file of pendingImages) {
            const formData = new FormData()
            formData.append("file", file)
            formData.append("productId", created.id)
            await uploadImage(formData)
          }
        }

        router.push("/admin/products")
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения")
    } finally {
      setLoading(false)
    }
  }

  const inputClass = "w-full h-10 px-3 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
  const selectClass = inputClass

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
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Slug *</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
              className={inputClass}
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
              onChange={(e) => handleCategoryChange(e.target.value)}
              className={selectClass}
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
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Тип продукта</label>
            <select value={productType} onChange={(e) => setProductType(e.target.value)} className={selectClass}>
              <option value="coffee">Кофе</option>
              <option value="tea">Чай</option>
              <option value="instant">Растворимая продукция</option>
            </select>
          </div>
          {(productType === "tea" || productType === "instant") && (
            <div>
              <label className="block text-sm font-medium mb-1">Форма продукта</label>
              <input
                value={productForm}
                onChange={(e) => setProductForm(e.target.value)}
                placeholder={productType === "tea" ? "листовой, пакетики..." : "гранулы, порошок, капсулы..."}
                className={inputClass}
              />
            </div>
          )}
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

        {/* Collections */}
        {collections.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-2">Подборки</label>
            <div className="flex flex-wrap gap-2">
              {collections.map((c) => (
                <label key={c.id} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedCollectionIds.includes(c.id)}
                    onChange={(e) => {
                      setSelectedCollectionIds(
                        e.target.checked
                          ? [...selectedCollectionIds, c.id]
                          : selectedCollectionIds.filter((id) => id !== c.id)
                      )
                    }}
                    className="rounded"
                  />
                  {c.emoji && `${c.emoji} `}{c.name}
                </label>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Templates (only for new products when category has templates) */}
      {templates.length > 0 && (
        <section className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <h3 className="text-sm font-medium text-blue-800 mb-2">Быстрое заполнение из шаблона</h3>
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => applyTemplate(t)}
                className="px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-sm text-blue-700 hover:bg-blue-100 transition-colors"
              >
                {t.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Category-specific attributes */}
      {hasAnyAttributes && (
        <section className="bg-white rounded-xl p-6 shadow-sm border border-border">
          <h2 className="text-lg font-semibold mb-4">{getSectionTitle(categorySlug)}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {showOrigin && (
              <div>
                <label className="block text-sm font-medium mb-1">Страна</label>
                <input value={origin} onChange={(e) => setOrigin(e.target.value)} className={inputClass} />
              </div>
            )}
            {showRegion && (
              <div>
                <label className="block text-sm font-medium mb-1">Регион</label>
                <input value={region} onChange={(e) => setRegion(e.target.value)} className={inputClass} />
              </div>
            )}
            {showFarm && (
              <div>
                <label className="block text-sm font-medium mb-1">Ферма</label>
                <input value={farm} onChange={(e) => setFarm(e.target.value)} className={inputClass} />
              </div>
            )}
            {showAltitude && (
              <div>
                <label className="block text-sm font-medium mb-1">Высота</label>
                <input value={altitude} onChange={(e) => setAltitude(e.target.value)} placeholder="1200-1800м" className={inputClass} />
              </div>
            )}
            {showRoastLevel && (
              <div>
                <label className="block text-sm font-medium mb-1">Обжарка</label>
                <select value={roastLevel} onChange={(e) => setRoastLevel(e.target.value)} className={selectClass}>
                  <option value="">Не указано</option>
                  <option value="Светлая">Светлая</option>
                  <option value="Средняя">Средняя</option>
                  <option value="Тёмная">Тёмная</option>
                </select>
              </div>
            )}
            {showProcessingMethod && (
              <div>
                <label className="block text-sm font-medium mb-1">Обработка</label>
                <select value={processingMethod} onChange={(e) => setProcessingMethod(e.target.value)} className={selectClass}>
                  <option value="">Не указано</option>
                  <option value="Мытая">Мытая</option>
                  <option value="Натуральная">Натуральная</option>
                  <option value="Хани">Хани</option>
                </select>
              </div>
            )}
            {showFlavorNotes && (
              <div className="md:col-span-3">
                <label className="block text-sm font-medium mb-1">Вкусовые ноты (через запятую)</label>
                <input
                  value={flavorNotesInput}
                  onChange={(e) => setFlavorNotesInput(e.target.value)}
                  placeholder="Шоколад, Карамель, Цитрус"
                  className={inputClass}
                />
              </div>
            )}
          </div>
        </section>
      )}

      {/* Flavor profile */}
      {showFlavorProfile && (
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
      )}

      {/* Brewing methods */}
      {showBrewingMethods && (
        <section className="bg-white rounded-xl p-6 shadow-sm border border-border">
          <h2 className="text-lg font-semibold mb-4">Способы заваривания</h2>
          <div className="flex flex-wrap gap-3">
            {brewingOptions.map((method) => (
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
      )}

      {/* Images */}
      {product ? (
        <section className="bg-white rounded-xl p-6 shadow-sm border border-border">
          <h2 className="text-lg font-semibold mb-4">Изображения</h2>
          <ImageUploader productId={product.id} images={product.images} />
        </section>
      ) : (
        <section className="bg-white rounded-xl p-6 shadow-sm border border-border">
          <h2 className="text-lg font-semibold mb-4">Изображения</h2>
          <InlineImagePicker images={pendingImages} onChange={setPendingImages} />
        </section>
      )}

      {/* Variants */}
      {product ? (
        <section className="bg-white rounded-xl p-6 shadow-sm border border-border">
          <h2 className="text-lg font-semibold mb-4">Варианты (вес и цена)</h2>
          <VariantManager productId={product.id} variants={product.variants} />
        </section>
      ) : (
        <section className="bg-white rounded-xl p-6 shadow-sm border border-border">
          <h2 className="text-lg font-semibold mb-4">Варианты (вес и цена)</h2>
          <InlineVariantEditor
            variants={localVariants}
            onChange={setLocalVariants}
            weightOptions={weightOptions}
          />
        </section>
      )}

      {/* Pack images */}
      <section className="bg-white rounded-xl p-6 shadow-sm border border-border">
        <h2 className="text-lg font-semibold mb-4">Изображения по весу</h2>
        <div>
          <label className="block text-sm font-medium mb-1">Фото пачки 250г</label>
          <input
            value={smallImage}
            onChange={(e) => setSmallImage(e.target.value)}
            placeholder="/images/coffee/Small/Peru.jpg"
            className="w-full px-3 py-2 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Путь к изображению маленькой пачки. Доступные файлы в{" "}
            <code className="bg-muted px-1 rounded">/images/coffee/Small/</code>
          </p>
          {smallImage && (
            <img src={smallImage} alt="250г preview" className="mt-2 h-20 object-contain rounded border" />
          )}
        </div>
      </section>

      {/* SEO */}
      <section className="bg-white rounded-xl p-6 shadow-sm border border-border">
        <h2 className="text-lg font-semibold mb-4">SEO</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Meta Title</label>
            <input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} className={inputClass} />
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
