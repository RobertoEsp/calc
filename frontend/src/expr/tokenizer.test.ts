import { describe, expect, it } from 'vitest'
import { ParseError } from './errors'
import { tokenize } from './tokenizer'

describe('tokenize', () => {
  it('splits an arithmetic expression into tokens', () => {
    expect(tokenize('1 + 2')).toEqual([
      { type: 'number', value: 1, position: 0 },
      { type: 'operator', value: '+', position: 2 },
      { type: 'number', value: 2, position: 4 },
      { type: 'eof', position: 5 },
    ])
  })

  it('accepts the symbols shown on the keypad', () => {
    expect(tokenize('6÷2−1×3')).toEqual([
      { type: 'number', value: 6, position: 0 },
      { type: 'operator', value: '/', position: 1 },
      { type: 'number', value: 2, position: 2 },
      { type: 'operator', value: '-', position: 3 },
      { type: 'number', value: 1, position: 4 },
      { type: 'operator', value: '*', position: 5 },
      { type: 'number', value: 3, position: 6 },
      { type: 'eof', position: 7 },
    ])
  })

  it('reads decimals and exponents', () => {
    const tokens = tokenize('.5 + 1.5e-2')
    expect(tokens[0]).toEqual({ type: 'number', value: 0.5, position: 0 })
    expect(tokens[2]).toEqual({ type: 'number', value: 0.015, position: 5 })
  })

  it('reads powers, square roots, and percentages', () => {
    expect(tokenize('2^3 + √9%')).toEqual([
      { type: 'number', value: 2, position: 0 },
      { type: 'operator', value: '^', position: 1 },
      { type: 'number', value: 3, position: 2 },
      { type: 'operator', value: '+', position: 4 },
      { type: 'sqrt', position: 6 },
      { type: 'number', value: 9, position: 7 },
      { type: 'percent', position: 8 },
      { type: 'eof', position: 9 },
    ])
  })

  it('tracks parentheses', () => {
    expect(tokenize('(1)')).toEqual([
      { type: 'lparen', position: 0 },
      { type: 'number', value: 1, position: 1 },
      { type: 'rparen', position: 2 },
      { type: 'eof', position: 3 },
    ])
  })

  it('rejects unknown characters', () => {
    expect(() => tokenize('2 + a')).toThrowError(ParseError)
    expect(() => tokenize('2 + a')).toThrowError('Unexpected character "a".')
  })

  it('rejects an incomplete exponent', () => {
    expect(() => tokenize('1e')).toThrowError('The exponent is incomplete.')
  })

  it('rejects numbers that overflow', () => {
    expect(() => tokenize('1e999')).toThrowError('That number is too large.')
  })

  it('rejects a lone decimal point', () => {
    expect(() => tokenize('.')).toThrowError('That is not a valid number.')
  })
})
