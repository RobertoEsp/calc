import { describe, expect, it } from 'vitest'
import { ParseError } from './errors'
import { parse, type Expr } from './parser'
import type { Operator } from './tokenizer'

const number = (value: number): Expr => ({ kind: 'number', value })
const binary = (operator: Operator, left: Expr, right: Expr): Expr => ({
  kind: 'binary',
  operator,
  left,
  right,
})
const unary = (operator: '+' | '-', operand: Expr): Expr => ({ kind: 'unary', operator, operand })
const sqrt = (operand: Expr): Expr => ({ kind: 'sqrt', operand })
const percent = (operand: Expr): Expr => ({ kind: 'percent', operand })

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

  it('parses exponentiation as right associative and above multiplication', () => {
    expect(parse('2 ^ 3 ^ 2')).toEqual(
      binary('^', number(2), binary('^', number(3), number(2))),
    )
    expect(parse('2 * 3 ^ 2')).toEqual(binary('*', number(2), binary('^', number(3), number(2))))
    expect(parse('2 ^ 3 * 2')).toEqual(binary('*', binary('^', number(2), number(3)), number(2)))
  })

  it('binds exponentiation more tightly than a leading sign', () => {
    expect(parse('-2 ^ 2')).toEqual(unary('-', binary('^', number(2), number(2))))
    expect(parse('2 ^ -2')).toEqual(binary('^', number(2), unary('-', number(2))))
    expect(parse('(-2) ^ 2')).toEqual(binary('^', unary('-', number(2)), number(2)))
  })

  it('parses square roots', () => {
    expect(parse('√9')).toEqual(sqrt(number(9)))
    expect(parse('√(2 + 3)')).toEqual(sqrt(binary('+', number(2), number(3))))
    expect(parse('√9 + 1')).toEqual(binary('+', sqrt(number(9)), number(1)))
  })

  it('parses percentages as postfix', () => {
    expect(parse('25%')).toEqual(percent(number(25)))
    expect(parse('200 + 10%')).toEqual(binary('+', number(200), percent(number(10))))
    expect(parse('10%%')).toEqual(percent(percent(number(10))))
    expect(parse('2 ^ 10%')).toEqual(binary('^', number(2), percent(number(10))))
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

  it('reports a missing power', () => {
    expect(() => parse('2 ^')).toThrowError('Enter a number to finish the expression.')
  })

  it('reports a percentage without a value', () => {
    expect(() => parse('%2')).toThrowError('Unexpected "%".')
  })

  it('reports a square root without a value', () => {
    expect(() => parse('√')).toThrowError('Enter a number to finish the expression.')
  })
})
