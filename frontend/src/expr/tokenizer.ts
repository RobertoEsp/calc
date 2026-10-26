import { ParseError } from './errors'

export type Operator = '+' | '-' | '*' | '/'

export type Token =
  | { type: 'number'; value: number; position: number }
  | { type: 'operator'; value: Operator; position: number }
  | { type: 'lparen'; position: number }
  | { type: 'rparen'; position: number }
  | { type: 'eof'; position: number }

const OPERATORS: Record<string, Operator> = {
  '+': '+',
  '-': '-',
  '*': '*',
  '/': '/',
  // Accept the symbols the keypad displays, in case they are typed directly.
  '−': '-',
  '×': '*',
  '÷': '/',
}

export function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let index = 0

  while (index < input.length) {
    const char = input[index]

    if (/\s/.test(char)) {
      index += 1
      continue
    }

    if (char === '(') {
      tokens.push({ type: 'lparen', position: index })
      index += 1
      continue
    }

    if (char === ')') {
      tokens.push({ type: 'rparen', position: index })
      index += 1
      continue
    }

    const operator = OPERATORS[char]
    if (operator !== undefined) {
      tokens.push({ type: 'operator', value: operator, position: index })
      index += 1
      continue
    }

    if (isDigit(char) || char === '.') {
      const start = index
      while (isDigit(input[index])) index += 1
      if (input[index] === '.') {
        index += 1
        while (isDigit(input[index])) index += 1
      }
      if (input[index] === 'e' || input[index] === 'E') {
        index += 1
        if (input[index] === '+' || input[index] === '-') index += 1
        if (!isDigit(input[index])) {
          throw new ParseError('The exponent is incomplete.', start)
        }
        while (isDigit(input[index])) index += 1
      }

      const raw = input.slice(start, index)
      const value = Number(raw)
      if (Number.isNaN(value)) {
        throw new ParseError('That is not a valid number.', start)
      }
      if (!Number.isFinite(value)) {
        throw new ParseError('That number is too large.', start)
      }
      tokens.push({ type: 'number', value, position: start })
      continue
    }

    throw new ParseError(`Unexpected character "${char}".`, index)
  }

  tokens.push({ type: 'eof', position: input.length })
  return tokens
}

function isDigit(char: string | undefined): boolean {
  return char !== undefined && char >= '0' && char <= '9'
}
