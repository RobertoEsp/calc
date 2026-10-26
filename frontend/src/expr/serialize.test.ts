import { describe, expect, it } from 'vitest'
import { parse } from './parser'
import { toRequest } from './serialize'

describe('toRequest', () => {
  it('maps the four operations', () => {
    expect(toRequest(parse('2 + 3'))).toEqual({ operation: 'add', operands: [2, 3] })
    expect(toRequest(parse('2 - 3'))).toEqual({ operation: 'subtract', operands: [2, 3] })
    expect(toRequest(parse('2 * 3'))).toEqual({ operation: 'multiply', operands: [2, 3] })
    expect(toRequest(parse('2 / 3'))).toEqual({ operation: 'divide', operands: [2, 3] })
  })

  it('maps exponentiation and square root', () => {
    expect(toRequest(parse('2 ^ 10'))).toEqual({ operation: 'exponentiate', operands: [2, 10] })
    expect(toRequest(parse('2 ^ 3 ^ 2'))).toEqual({
      operation: 'exponentiate',
      operands: [2, { operation: 'exponentiate', operands: [3, 2] }],
    })
    expect(toRequest(parse('√81'))).toEqual({ operation: 'sqrt', operands: [81] })
    expect(toRequest(parse('√(7 + 2)'))).toEqual({
      operation: 'sqrt',
      operands: [{ operation: 'add', operands: [7, 2] }],
    })
  })

  it('sends a contextual percentage on the right of an operation', () => {
    expect(toRequest(parse('200 + 10%'))).toEqual({
      operation: 'add',
      operands: [200, { value: 10, percent: true }],
    })
    expect(toRequest(parse('200 - 10%'))).toEqual({
      operation: 'subtract',
      operands: [200, { value: 10, percent: true }],
    })
    expect(toRequest(parse('200 * 10%'))).toEqual({
      operation: 'multiply',
      operands: [200, { value: 10, percent: true }],
    })
    expect(toRequest(parse('200 / 10%'))).toEqual({
      operation: 'divide',
      operands: [200, { value: 10, percent: true }],
    })
  })

  it('keeps the sign of a negative percentage', () => {
    expect(toRequest(parse('200 + -10%'))).toEqual({
      operation: 'add',
      operands: [200, { value: -10, percent: true }],
    })
  })

  it('serializes a standalone percentage as a percent operation', () => {
    expect(toRequest(parse('25%'))).toEqual({ operation: 'percent', operands: [25] })
    expect(toRequest(parse('-(10%)'))).toEqual({
      operation: 'subtract',
      operands: [0, { operation: 'percent', operands: [10] }],
    })
  })

  it('only applies contextual percentage on the right side', () => {
    expect(toRequest(parse('10% + 200'))).toEqual({
      operation: 'add',
      operands: [{ operation: 'percent', operands: [10] }, 200],
    })
    expect(toRequest(parse('2 ^ 10%'))).toEqual({
      operation: 'exponentiate',
      operands: [2, { operation: 'percent', operands: [10] }],
    })
  })

  it('sends a percentage of an expression as a percent operation', () => {
    expect(toRequest(parse('(5 + 5)%'))).toEqual({
      operation: 'percent',
      operands: [{ operation: 'add', operands: [5, 5] }],
    })
    expect(toRequest(parse('200 + (5 + 5)%'))).toEqual({
      operation: 'add',
      operands: [200, { operation: 'percent', operands: [{ operation: 'add', operands: [5, 5] }] }],
    })
  })

  it('preserves precedence as nested expressions', () => {
    expect(toRequest(parse('2 + 3 * 4'))).toEqual({
      operation: 'add',
      operands: [2, { operation: 'multiply', operands: [3, 4] }],
    })
  })

  it('wraps a lone number in an operation', () => {
    expect(toRequest(parse('5'))).toEqual({ operation: 'add', operands: [5, 0] })
  })

  it('folds a negative number into the literal', () => {
    expect(toRequest(parse('-3'))).toEqual({ operation: 'add', operands: [-3, 0] })
    expect(toRequest(parse('2 * -3'))).toEqual({
      operation: 'multiply',
      operands: [2, -3],
    })
  })

  it('turns a negated expression into a subtraction from zero', () => {
    expect(toRequest(parse('-(2 + 3)'))).toEqual({
      operation: 'subtract',
      operands: [0, { operation: 'add', operands: [2, 3] }],
    })
  })

  it('drops a unary plus', () => {
    expect(toRequest(parse('+5'))).toEqual({ operation: 'add', operands: [5, 0] })
  })

  it('serializes parentheses as structure', () => {
    expect(toRequest(parse('(2 + 3) * 4'))).toEqual({
      operation: 'multiply',
      operands: [{ operation: 'add', operands: [2, 3] }, 4],
    })
  })
})
