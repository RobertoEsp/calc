import type { Expr } from './parser'
import type { Operator } from './tokenizer'

export type Operation = 'add' | 'subtract' | 'multiply' | 'divide'

export type CalculationNode = {
  operation: Operation
  operands: Operand[]
}

export type Operand = number | CalculationNode

const OPERATIONS: Record<Operator, Operation> = {
  '+': 'add',
  '-': 'subtract',
  '*': 'multiply',
  '/': 'divide',
}

/**
 * Converts a parsed expression into the nested request the API expects.
 * A lone number is wrapped in an addition with zero so the API always
 * receives an operation node.
 */
export function toRequest(expression: Expr): CalculationNode {
  if (expression.kind === 'binary') {
    return {
      operation: OPERATIONS[expression.operator],
      operands: [asOperand(expression.left), asOperand(expression.right)],
    }
  }

  if (expression.kind === 'unary') {
    if (expression.operator === '+') {
      return toRequest(expression.operand)
    }
    if (expression.operand.kind === 'number') {
      return { operation: 'add', operands: [-expression.operand.value, 0] }
    }
    return { operation: 'subtract', operands: [0, toRequest(expression.operand)] }
  }

  return { operation: 'add', operands: [expression.value, 0] }
}

function asOperand(expression: Expr): Operand {
  if (expression.kind === 'number') {
    return expression.value
  }

  if (expression.kind === 'unary') {
    if (expression.operator === '+') {
      return asOperand(expression.operand)
    }
    if (expression.operand.kind === 'number') {
      return -expression.operand.value
    }
  }

  return toRequest(expression)
}
