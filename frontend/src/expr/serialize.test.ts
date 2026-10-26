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
