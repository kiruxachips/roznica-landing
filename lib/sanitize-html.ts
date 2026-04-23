import sanitizeHtmlLib from "sanitize-html"

/**
 * Санитизация user-generated HTML (TipTap-редактор в админке) перед вставкой
 * через dangerouslySetInnerHTML. Разрешаем семантические теги форматирования,
 * списки, цитаты, таблицы, ссылки и картинки. Запрещаем script/iframe/object,
 * inline-хендлеры onXxx=, javascript:-схемы.
 *
 * Используется для article.content; если появится ещё один источник HTML из
 * БД (review с разметкой, описание товара с HTML) — прогонять через этот же
 * хелпер.
 *
 * Почему sanitize-html, а не DOMPurify: isomorphic-dompurify тащит JSDOM,
 * который в Next.js 15 ломает build (ERR_REQUIRE_ESM на html-encoding-sniffer).
 * sanitize-html использует htmlparser2 — чистый CJS/ESM-совместимый код.
 */
const SANITIZE_OPTIONS: sanitizeHtmlLib.IOptions = {
  allowedTags: [
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
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt", "width", "height"],
    "*": ["class", "id", "colspan", "rowspan"],
  },
  // Ограничиваем схемы ссылок — no javascript:, data:, vbscript:
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: {
    img: ["http", "https", "data"], // картинки можно data: (inline base64)
  },
  // target=_blank без rel=noopener — reverse tabnabbing уязвимость,
  // принудительно добавляем rel=noopener noreferrer ко всем внешним ссылкам.
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        rel:
          attribs.target === "_blank"
            ? "noopener noreferrer"
            : attribs.rel || "",
      },
    }),
  },
}

export function sanitizeArticleHtml(html: string): string {
  return sanitizeHtmlLib(html, SANITIZE_OPTIONS)
}
