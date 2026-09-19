import { describe, expect, it } from 'vitest'
import { parseQuantityInput } from './quantity'

describe('parseQuantityInput', () => {
  it('accepts a plain typed quantity, including the large ones trade buyers use', () => {
    expect(parseQuantityInput('12', 1)).toBe(12)
    expect(parseQuantityInput('250', 1)).toBe(250)
    expect(parseQuantityInput(' 40 ', 1)).toBe(40)
  })

  it('changes nothing when the field is cleared — an empty box is not an order for one', () => {
    expect(parseQuantityInput('', 5)).toBeNull()
    expect(parseQuantityInput('   ', 5)).toBeNull()
  })

  it('changes nothing for a quantity that cannot be honoured', () => {
    expect(parseQuantityInput('0', 5)).toBeNull()
    expect(parseQuantityInput('-3', 5)).toBeNull()
    expect(parseQuantityInput('abc', 5)).toBeNull()
    expect(parseQuantityInput('1e999', 5)).toBeNull() // Infinity
  })

  it('rounds a fraction down rather than discarding what was typed', () => {
    expect(parseQuantityInput('2.5', 1)).toBe(2)
    expect(parseQuantityInput('1.9', 5)).toBe(1)
  })

  it('reports no change when the typed value already matches the line', () => {
    expect(parseQuantityInput('5', 5)).toBeNull()
    expect(parseQuantityInput('5.4', 5)).toBeNull()
  })
})
