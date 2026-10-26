import { describe, expect, it } from 'vitest'
import { ParseError } from './errors'
import { parse, type Expr } from './parser'

const number = (value: number): Expr => ({ kind: 'number', value })
const binary = (operator: '+' | '-' | '*' | '/', left: Expr, right: Expr): Expr => ({
  kind: 'binary',
  operator,
  left,
  right,
})
const unary = (operator: '+' | '-', operand: Expr): Expr => ({ kind: 'unary', operator, operand })

describe('parse', () => {
  it('parses a number', () => {
    expect(parse('42')).toEqual(number(42))
  })

  it('gives multiplication precedence over addition', () => {
    expect(parse('2 + 3 * 4')).toEqual(binary('+', number(2), binary('*', number(3), number(4))))
  })

  it('is left associative', () => {
    expect(parse('8 - 3 - 2')).toEqual(binary('-', binary('-', number(8), number(3)), number(2)))
  })

  it('honors parentheses', () => {
    expect(parse('(2 + 3) * 4')).toEqual(binary('*', binary('+', number(2), number(3)), number(4)))
  })

  it('parses unary signs', () => {
    expect(parse('-3')).toEqual(unary('-', number(3)))
    expect(parse('+3')).toEqual(unary('+', number(3)))
    expect(parse('2 * -3')).toEqual(binary('*', number(2), unary('-', number(3))))
    expect(parse('--3')).toEqual(unary('-', unary('-', number(3))))
  })

  it('ignores whitespace', () => {
    expect(parse(' 1 +\t2 ')).toEqual(binary('+', number(1), number(2)))
  })

  it('reports an unfinished expression', () => {
    expect(() => parse('2 +')).toThrowError(ParseError)
    expect(() => parse('2 +')).toThrowError('Enter a number to finish the expression.')
  })

  it('reports a missing closing parenthesis', () => {
    expect(() => parse('(2 + 3')).toThrowError('Add a closing parenthesis.')
  })

  it('reports an unexpected operator', () => {
    expect(() => parse('2 + * 3')).toThrowError('Unexpected operator "*".')
  })

  it('reports unexpected trailing input', () => {
    expect(() => parse('2 3')).toThrowError('Unexpected number 3.')
  })

  it('reports unexpected closing parentheses', () => {
    expect(() => parse(')')).toThrowError('Unexpected closing parenthesis.')
  })
})
