import sanitizeHtml from 'sanitize-html'

/**
 * Shopify's `descriptionHtml` is merchant-authored rich text (real
 * paragraphs/lists/emphasis a buyer should actually see formatted, not raw
 * markup) — but it's still externally-sourced content reaching this app
 * over an API, so it's sanitized before ever being handed to
 * `dangerouslySetInnerHTML` rather than trusted outright (defense in
 * depth, CLAUDE.md rule 21). A tight allowlist: structural/text-formatting
 * tags only — no scripts, iframes, forms, or event-handler attributes of
 * any kind, and no inline styles.
 */
export function sanitizeProductDescriptionHtml(rawHtml: string): string {
  return sanitizeHtml(rawHtml, {
    allowedTags: ['p', 'br', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'span'],
    allowedAttributes: {},
  }).trim()
}

/** Plain text only — for contexts like JSON-LD/meta descriptions where markup is meaningless or actively unsafe to embed (e.g. an unescaped `</script>` inside a raw HTML string). */
export function stripToPlainText(rawHtml: string): string {
  return sanitizeHtml(rawHtml, { allowedTags: [], allowedAttributes: {} }).trim()
}
