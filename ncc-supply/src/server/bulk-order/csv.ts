export interface ParsedCsvRow {
  sku: string
  quantity: number
}

export interface CsvRowError {
  /** 1-indexed source line number, or 0 for a whole-file error. */
  line: number
  raw: string
  reason: string
}

export interface ParsedBulkOrderCsv {
  rows: ParsedCsvRow[]
  errors: CsvRowError[]
}

/** PRD §6.6: "Upload accepts up to 500 rows per file — an implementation default." */
export const BULK_ORDER_MAX_ROWS = 500

function isPositiveInteger(value: string): boolean {
  return /^\d+$/.test(value) && Number(value) > 0
}

/**
 * Two plain columns (SKU,Quantity) — deliberately not a general-purpose CSV
 * parser. SKUs and quantities never contain commas or embedded newlines, so
 * full RFC4180 quoted-field handling would only add attack surface for a
 * shape that never needs it. A header row is auto-detected (first non-blank
 * row whose second cell isn't a positive integer) and skipped rather than
 * required. Duplicate SKUs within one file are merged by summing quantity —
 * the same rule `addLine` already applies when the same SKU is added to a
 * basket twice. Never silently drops a bad row: every row that isn't valid
 * SKU+quantity gets one specific reason in `errors` instead (PRD §6.6 "never
 * silently drops unmatched rows" — this is the same principle one level
 * earlier, at parse time rather than catalogue-match time). Exceeding the
 * row cap returns one whole-file error with zero rows processed, rather
 * than silently truncating to the first 500.
 */
export function parseBulkOrderCsv(text: string): ParsedBulkOrderCsv {
  const rawLines = text.split(/\r\n|\r|\n/)
  const nonBlank = rawLines
    .map((raw, index) => ({ raw, line: index + 1 }))
    .filter(({ raw }) => raw.trim() !== '')

  if (nonBlank.length === 0) {
    return { rows: [], errors: [{ line: 0, raw: '', reason: 'The file is empty.' }] }
  }

  const firstCells = nonBlank[0].raw.trim().split(',').map((cell) => cell.trim())
  const hasHeader = firstCells.length >= 2 && !isPositiveInteger(firstCells[1])
  const dataLines = hasHeader ? nonBlank.slice(1) : nonBlank

  if (dataLines.length > BULK_ORDER_MAX_ROWS) {
    return {
      rows: [],
      errors: [
        {
          line: 0,
          raw: '',
          reason: `This file has ${dataLines.length} rows — the maximum is ${BULK_ORDER_MAX_ROWS}. Split it into smaller files and re-upload.`,
        },
      ],
    }
  }

  const rows: ParsedCsvRow[] = []
  const errors: CsvRowError[] = []
  const quantityBySku = new Map<string, number>()
  const orderedSkus: string[] = []

  for (const { raw, line } of dataLines) {
    const cells = raw.trim().split(',').map((cell) => cell.trim())
    if (cells.length !== 2) {
      errors.push({ line, raw, reason: `Expected two columns (SKU,Quantity), found ${cells.length}` })
      continue
    }
    const [sku, quantityRaw] = cells
    if (!sku) {
      errors.push({ line, raw, reason: 'SKU is empty' })
      continue
    }
    if (!isPositiveInteger(quantityRaw)) {
      errors.push({ line, raw, reason: 'Quantity must be a positive whole number' })
      continue
    }

    const quantity = Number(quantityRaw)
    if (!quantityBySku.has(sku)) orderedSkus.push(sku)
    quantityBySku.set(sku, (quantityBySku.get(sku) ?? 0) + quantity)
  }

  for (const sku of orderedSkus) rows.push({ sku, quantity: quantityBySku.get(sku) ?? 0 })
  return { rows, errors }
}

/**
 * OWASP CSV-injection mitigation: a cell whose first character would be
 * interpreted as a formula by Excel/Sheets (`=`, `+`, `-`, `@`) gets a
 * leading apostrophe so it's forced to render as plain text instead of
 * being evaluated. Used only when *exporting* data that originated from a
 * user (e.g. "Download unmatched rows") — never needed on the parse side,
 * since an odd-looking SKU that simply fails to match a real product is
 * already handled as an ordinary "unmatched" row.
 */
export function sanitizeCsvCell(value: string): string {
  if (/^[=+\-@]/.test(value)) return `'${value}`
  return value
}
