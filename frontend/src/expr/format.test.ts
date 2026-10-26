import { describe, expect, it } from 'vitest'
import { formatNumber } from './format'

describe('formatNumber', () => {
  it('renders integers and simple decimals', () => {
    expect(formatNumber(5)).toBe('5')
    expect(formatNumber(-2.5)).toBe('-2.5')
  })

  it('hides binary floating-point noise', () => {
    expect(formatNumber(0.1 + 0.2)).toBe('0.3')
  })

  it('rounds to twelve significant digits', () => {
    expect(formatNumber(1 / 3)).toBe('0.333333333333')
    expect(formatNumber(2 / 3)).toBe('0.666666666667')
  })

  it('normalizes negative zero', () => {
    expect(formatNumber(-0)).toBe('0')
  })

  it('keeps very large numbers readable', () => {
    expect(formatNumber(1e21)).toBe('1e+21')
  })

  it('reports non-finite values', () => {
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe('Error')
    expect(formatNumber(Number.NaN)).toBe('Error')
  })
})
