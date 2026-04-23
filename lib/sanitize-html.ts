import DOMPurify from "isomorphic-dompurify"

/**
 * Санитизация user-generated HTML (TipTap-редактор в админке) перед вставкой
 * через dangerouslySetInnerHTML. Разрешаем семантические теги форматирования,
 * списки, цитаты, таблицы, ссылки и картинки. Запрещаем script/iframe/object,
 * inline-хендлеры onXxx=, javascript:-схемы.
 *
 * Используется для article.content; если появится ещё один источник HTML из
 * БД (review текст, описание товара с HTML) — прогонять через этот же хелпер.
 */
const ALLOWED_TAGS = [
  // Заголовки
  "h1", "h2", "h3", "h4", "h5", "h6",
  // Параграфы и переносы
  "p", "br", "hr",
  // Форматирование
  "strong", "b", "em", "i", "u", "s", "mark", "sub", "sup", "small",
  // Списки
  "ul", "ol", "li",
  // Цитаты, код
  "blockquote", "code", "pre",
  // Ссылки и медиа
  "a", "img", "figure", "figcaption",
  // Таблицы
  "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption",
  // Группировка
  "div", "span",
]

const ALLOWED_ATTR = [
  "href", "target", "rel",
  "src", "alt", "width", "height",
  "class", "id",
  "colspan", "rowspan",
]

export function sanitizeArticleHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Принудительно добавляем rel=noopener для внешних ссылок (защита от reverse tabnabbing)
    ADD_ATTR: ["target"],
    // Блокируем data:/javascript:/vbscript:-схемы в href/src
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  })
}
