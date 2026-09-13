import { describe, expect, it } from 'vitest'
import { BULK_ORDER_MAX_ROWS, parseBulkOrderCsv, sanitizeCsvCell } from './csv'

describe('parseBulkOrderCsv', () => {
  it('parses plain SKU,Quantity rows with no header', () => {
    const { rows, errors } = parseBulkOrderCsv('ABC123,5\nDEF456,10')
    expect(errors).toEqual([])
    expect(rows).toEqual([
      { sku: 'ABC123', quantity: 5 },
      { sku: 'DEF456', quantity: 10 },
    ])
  })

  it('auto-detects and skips a header row', () => {
    const { rows, errors } = parseBulkOrderCsv('SKU,Quantity\nABC123,5')
    expect(errors).toEqual([])
    expect(rows).toEqual([{ sku: 'ABC123', quantity: 5 }])
  })

  it('handles mixed line endings and blank lines', () => {
    const { rows, errors } = parseBulkOrderCsv('ABC123,5\r\n\r\nDEF456,10\n')
    expect(errors).toEqual([])
    expect(rows).toEqual([
      { sku: 'ABC123', quantity: 5 },
      { sku: 'DEF456', quantity: 10 },
    ])
  })

  it('merges duplicate SKUs by summing quantity', () => {
    const { rows } = parseBulkOrderCsv('ABC123,5\nABC123,3')
    expect(rows).toEqual([{ sku: 'ABC123', quantity: 8 }])
  })

  it('reports a specific reason for a malformed row instead of aborting the whole parse', () => {
    const { rows, errors } = parseBulkOrderCsv('ABC123,5\nBAD ROW\nDEF456,not-a-number\n,10\nGHI789,10')
    expect(rows).toEqual([
      { sku: 'ABC123', quantity: 5 },
      { sku: 'GHI789', quantity: 10 },
    ])
    expect(errors).toHaveLength(3)
    expect(errors[0].reason).toMatch(/two columns/i)
    expect(errors[1].reason).toMatch(/positive whole number/i)
    expect(errors[2].reason).toMatch(/empty/i)
  })

  it('rejects zero and negative quantities as malformed, not silently coerced', () => {
    // A header row disambiguates the very first data row from the
    // header-detection heuristic itself (which otherwise can't tell "a
    // header" from "an invalid quantity on line 1" — the same ambiguity a
    // real spreadsheet export would have).
    const { rows, errors } = parseBulkOrderCsv('SKU,Quantity\nABC123,0\nDEF456,-5')
    expect(rows).toEqual([])
    expect(errors).toHaveLength(2)
  })

  it('returns one whole-file error over the row cap, processing nothing — not a silent truncation', () => {
    const lines = Array.from({ length: BULK_ORDER_MAX_ROWS + 1 }, (_, i) => `SKU${i},1`).join('\n')
    const { rows, errors } = parseBulkOrderCsv(lines)
    expect(rows).toEqual([])
    expect(errors).toHaveLength(1)
    expect(errors[0].reason).toMatch(new RegExp(String(BULK_ORDER_MAX_ROWS)))
  })

  it('accepts exactly the row cap', () => {
    const lines = Array.from({ length: BULK_ORDER_MAX_ROWS }, (_, i) => `SKU${i},1`).join('\n')
    const { rows, errors } = parseBulkOrderCsv(lines)
    expect(errors).toEqual([])
    expect(rows).toHaveLength(BULK_ORDER_MAX_ROWS)
  })

  it('treats a fully empty file as one whole-file error', () => {
    const { rows, errors } = parseBulkOrderCsv('   \n\n  ')
    expect(rows).toEqual([])
    expect(errors).toHaveLength(1)
  })
})

describe('sanitizeCsvCell', () => {
  it.each(['=cmd|/c calc', '+1+1', '-2+3', '@SUM(A1:A2)'])(
    'prefixes a leading apostrophe for a formula-triggering value: %s',
    (value) => {
      expect(sanitizeCsvCell(value)).toBe(`'${value}`)
    },
  )

  it('leaves an ordinary SKU untouched', () => {
    expect(sanitizeCsvCell('B1190001')).toBe('B1190001')
  })
})
