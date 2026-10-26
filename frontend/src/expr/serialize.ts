import type { Expr } from './parser'
import type { Operator } from './tokenizer'

export type Operation =
  | 'add'
  | 'subtract'
  | 'multiply'
  | 'divide'
  | 'exponentiate'
  | 'sqrt'
  | 'percent'

export type CalculationNode = {
  operation: Operation
  operands: Operand[]
}

export type PercentValue = {
  value: number
  percent: true
}

export type Operand = number | PercentValue | CalculationNode

const OPERATIONS: Record<Operator, Operation> = {
  '+': 'add',
  '-': 'subtract',
  '*': 'multiply',
  '/': 'divide',
  '^': 'exponentiate',
}

/**
 * Converts a parsed expression into the nested request the API expects.
 * A lone number is wrapped in an addition with zero so the API always
 * receives an operation node.
 */
export function toRequest(expression: Expr): CalculationNode {
  return asNode(expression)
}

function asNode(expression: Expr): CalculationNode {
  switch (expression.kind) {
    case 'number':
      return { operation: 'add', operands: [expression.value, 0] }
    case 'binary': {
      const operation = OPERATIONS[expression.operator]
      return {
        operation,
        operands: [asOperand(expression.left), asOperand(expression.right, operation)],
      }
    }
    case 'unary':
      if (expression.operator === '+') {
        return asNode(expression.operand)
      }
      if (expression.operand.kind === 'number') {
        return { operation: 'add', operands: [-expression.operand.value, 0] }
      }
      return { operation: 'subtract', operands: [0, asNode(expression.operand)] }
    case 'sqrt':
      return { operation: 'sqrt', operands: [asOperand(expression.operand)] }
    case 'percent':
      return { operation: 'percent', operands: [asOperand(expression.operand)] }
  }
}

function asOperand(expression: Expr, rightOf?: Operation): Operand {
  if (expression.kind === 'number') {
    return expression.value
  }

  // A percentage on the right of + - * / is contextual: the API receives a
  // percent-flagged value rather than a separate percent operation.
  if (rightOf !== undefined && takesContextualPercent(rightOf)) {
    const percentage = percentLeafValue(expression)
    if (percentage !== null) {
      return { value: percentage, percent: true }
    }
  }

  if (expression.kind === 'unary') {
    if (expression.operator === '+') {
      return asOperand(expression.operand, rightOf)
    }
    if (expression.operand.kind === 'number') {
      return -expression.operand.value
    }
  }

  return asNode(expression)
}

function takesContextualPercent(operation: Operation): boolean {
  return (
    operation === 'add' ||
    operation === 'subtract' ||
    operation === 'multiply' ||
    operation === 'divide'
  )
}

/** Returns the number inside a percent expression, including any leading sign. */
function percentLeafValue(expression: Expr): number | null {
  if (expression.kind === 'percent') {
    return signedNumber(expression.operand)
  }
  if (expression.kind === 'unary' && expression.operator === '+') {
    return percentLeafValue(expression.operand)
  }
  if (expression.kind === 'unary' && expression.operator === '-') {
    const value = percentLeafValue(expression.operand)
    return value === null ? null : -value
  }
  return null
}

function signedNumber(expression: Expr): number | null {
  if (expression.kind === 'number') {
    return expression.value
  }
  if (expression.kind === 'unary' && expression.operand.kind === 'number') {
    return expression.operator === '-' ? -expression.operand.value : expression.operand.value
  }
  return null
}
