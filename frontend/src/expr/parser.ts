import { ParseError } from './errors'
import { tokenize, type Operator, type Token } from './tokenizer'

export type Expr =
  | { kind: 'number'; value: number }
  | { kind: 'binary'; operator: Operator; left: Expr; right: Expr }
  | { kind: 'unary'; operator: '+' | '-'; operand: Expr }
  | { kind: 'sqrt'; operand: Expr }
  | { kind: 'percent'; operand: Expr }

export function parse(input: string): Expr {
  const parser = new Parser(tokenize(input))
  const expression = parser.parseExpression()
  parser.expectEnd()
  return expression
}

class Parser {
  private readonly tokens: Token[]
  private index = 0

  constructor(tokens: Token[]) {
    this.tokens = tokens
  }

  parseExpression(): Expr {
    let left = this.parseTerm()
    while (true) {
      const token = this.current()
      if (token.type === 'operator' && (token.value === '+' || token.value === '-')) {
        this.index += 1
        left = { kind: 'binary', operator: token.value, left, right: this.parseTerm() }
        continue
      }
      return left
    }
  }

  private parseTerm(): Expr {
    let left = this.parseUnary()
    while (true) {
      const token = this.current()
      if (token.type === 'operator' && (token.value === '*' || token.value === '/')) {
        this.index += 1
        left = { kind: 'binary', operator: token.value, left, right: this.parseUnary() }
        continue
      }
      return left
    }
  }

  private parseUnary(): Expr {
    const token = this.current()
    if (token.type === 'operator' && (token.value === '+' || token.value === '-')) {
      this.index += 1
      return { kind: 'unary', operator: token.value, operand: this.parseUnary() }
    }
    return this.parsePower()
  }

  private parsePower(): Expr {
    const base = this.parsePostfix()
    const token = this.current()
    if (token.type === 'operator' && token.value === '^') {
      this.index += 1
      return { kind: 'binary', operator: '^', left: base, right: this.parseUnary() }
    }
    return base
  }

  private parsePostfix(): Expr {
    let expression = this.parsePrimary()
    while (this.current().type === 'percent') {
      this.index += 1
      expression = { kind: 'percent', operand: expression }
    }
    return expression
  }

  private parsePrimary(): Expr {
    const token = this.current()

    if (token.type === 'number') {
      this.index += 1
      return { kind: 'number', value: token.value }
    }

    if (token.type === 'sqrt') {
      this.index += 1
      return { kind: 'sqrt', operand: this.parseUnary() }
    }

    if (token.type === 'lparen') {
      this.index += 1
      const expression = this.parseExpression()
      const closing = this.current()
      if (closing.type !== 'rparen') {
        throw new ParseError('Add a closing parenthesis.', closing.position)
      }
      this.index += 1
      return expression
    }

    throw new ParseError(this.unexpectedMessage(token), token.position)
  }

  expectEnd(): void {
    const token = this.current()
    if (token.type !== 'eof') {
      throw new ParseError(`Unexpected ${describe(token)}.`, token.position)
    }
  }

  private current(): Token {
    return this.tokens[this.index]
  }

  private unexpectedMessage(token: Token): string {
    if (token.type === 'eof') {
      return 'Enter a number to finish the expression.'
    }
    if (token.type === 'rparen') {
      return 'Unexpected closing parenthesis.'
    }
    return `Unexpected ${describe(token)}.`
  }
}

function describe(token: Token): string {
  switch (token.type) {
    case 'number':
      return `number ${token.value}`
    case 'operator':
      return `operator "${token.value}"`
    case 'lparen':
      return '"("'
    case 'rparen':
      return '")"'
    case 'percent':
      return '"%"'
    case 'sqrt':
      return '"√"'
    case 'eof':
      return 'the end of the expression'
  }
}
