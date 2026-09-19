/**
 * Interprets a quantity the customer typed into a basket line.
 *
 * Returns the quantity to apply, or null when nothing should change. Null
 * rather than a fallback number matters: a buyer who clears the box to
 * retype has not asked for a quantity of one, and silently setting one
 * would be a wrong order line they might not notice. Removing a line stays
 * an explicit action.
 */
export function parseQuantityInput(draft: string, current: number): number | null {
  const trimmed = draft.trim()
  if (trimmed === '') return null

  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) return null

  // Fractions are rounded down rather than rejected — "2.5" almost
  // certainly means two, and refusing it outright loses the input.
  const quantity = Math.floor(parsed)
  if (quantity < 1) return null
  if (quantity === current) return null

  return quantity
}
