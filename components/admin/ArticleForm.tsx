"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { createArticle, updateArticle } from "@/lib/actions/articles"
import { ArticleCoverUploader } from "./ArticleCoverUploader"

const TipTapEditor = dynamic(
  () => import("./TipTapEditor").then((m) => m.TipTapEditor),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[400px] rounded-lg border bg-muted/20 animate-pulse" />
    ),
  }
)

interface Category {
  id: string
  name: string
}

interface ArticleFormProps {
  article?: {
    id: string
    title: string
    slug: string
    excerpt: string
    content: string
    coverImage: string | null
    categoryId: string | null
    tags: string[]
    isPublished: boolean
    publishedAt: Date | null
    metaTitle: string | null
    metaDescription: string | null
  }
  categories: Category[]
}

function generateSlug(text: string) {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh",
    з: "z", и: "i", й: "j", к: "k", л: "l", м: "m", н: "n", о: "o",
    п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c",
    ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  }
  return text.toLowerCase().split("").map((ch) => map[ch] || ch).join("").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function formatDateForInput(date: Date | null): string {
  if (!date) return ""
  const d = new Date(date)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function ArticleForm({ article, categories }: ArticleFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [title, setTitle] = useState(article?.title ?? "")
  const [slug, setSlug] = useState(article?.slug ?? "")
  const [excerpt, setExcerpt] = useState(article?.excerpt ?? "")
  const [content, setContent] = useState(article?.content ?? "")
  const [categoryId, setCategoryId] = useState(article?.categoryId ?? "")
  const [tagsInput, setTagsInput] = useState(article?.tags.join(", ") ?? "")
  const [isPublished, setIsPublished] = useState(article?.isPublished ?? false)
  const [publishedAt, setPublishedAt] = useState(formatDateForInput(article?.publishedAt ?? null))
  const [metaTitle, setMetaTitle] = useState(article?.metaTitle ?? "")
  const [metaDescription, setMetaDescription] = useState(article?.metaDescription ?? "")

  function handleTitleChange(value: string) {
    setTitle(value)
    if (!article) {
      setSlug(generateSlug(value))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean)

    try {
      const data = {
        title,
        slug,
        excerpt,
        content,
        categoryId: categoryId || undefined,
        tags,
        isPublished,
        publishedAt: publishedAt || undefined,
        metaTitle: metaTitle || undefined,
        metaDescription: metaDescription || undefined,
      }

      if (article) {
        await updateArticle(article.id, {
          ...data,
          categoryId: categoryId || null,
          publishedAt: publishedAt || null,
        })
      } else {
        await createArticle(data)
      }
      router.push("/admin/blog")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения")
    } finally {
      setLoading(false)
    }
  }

  const inputClass = "w-full h-10 px-3 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"

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
            <label className="block text-sm font-medium mb-1">Заголовок *</label>
            <input value={title} onChange={(e) => handleTitleChange(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Slug *</label>
            <input value={slug} onChange={(e) => setSlug(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Рубрика</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
              <option value="">Без рубрики</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Краткое описание *</label>
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              required
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="bg-white rounded-xl p-6 shadow-sm border border-border">
        <h2 className="text-lg font-semibold mb-4">Содержание</h2>
        <TipTapEditor content={content} onChange={setContent} articleId={article?.id} />
      </section>

      {/* Cover image (only for existing articles) */}
      {article && (
        <section className="bg-white rounded-xl p-6 shadow-sm border border-border">
          <h2 className="text-lg font-semibold mb-4">Обложка</h2>
          <ArticleCoverUploader articleId={article.id} coverImage={article.coverImage} />
        </section>
      )}

      {/* Tags */}
      <section className="bg-white rounded-xl p-6 shadow-sm border border-border">
        <h2 className="text-lg font-semibold mb-4">Теги</h2>
        <div>
          <label className="block text-sm font-medium mb-1">Теги (через запятую)</label>
          <input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="кофе, обжарка, рецепт"
            className={inputClass}
          />
        </div>
      </section>

      {/* Publishing */}
      <section className="bg-white rounded-xl p-6 shadow-sm border border-border">
        <h2 className="text-lg font-semibold mb-4">Публикация</h2>
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} className="rounded" />
            Опубликовать
          </label>
          <div>
            <label className="block text-sm font-medium mb-1">Дата публикации</label>
            <input
              type="datetime-local"
              value={publishedAt}
              onChange={(e) => setPublishedAt(e.target.value)}
              className={inputClass + " max-w-xs"}
            />
          </div>
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
            <textarea
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
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
          {loading ? "Сохранение..." : article ? "Сохранить" : "Создать статью"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/blog")}
          className="px-6 py-2 border border-border rounded-lg text-sm hover:bg-muted transition-colors"
        >
          Отмена
        </button>
      </div>
    </form>
  )
}
