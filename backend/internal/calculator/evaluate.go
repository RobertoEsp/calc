package calculator

import (
	"errors"
	"fmt"
	"math"
)

// Evaluate validates the expression and returns its numeric result.
func Evaluate(root *Node) (float64, error) {
	if err := validate(root); err != nil {
		return 0, err
	}
	return evaluate(root, "")
}

func validate(root *Node) error {
	if root == nil {
		return errorf(CodeInvalidExpression, "", "expression is required")
	}

	nodes := 0
	var walk func(node *Node, depth int, path string) error
	walk = func(node *Node, depth int, path string) error {
		if depth > MaxDepth {
			return errorf(CodeExpressionTooDeep, path, "expression exceeds maximum depth of %d", MaxDepth)
		}

		nodes++
		if nodes > MaxNodes {
			return errorf(CodeExpressionTooLarge, path, "expression exceeds maximum of %d nodes", MaxNodes)
		}

		def, ok := operations[node.Operation]
		if !ok {
			return errorf(CodeInvalidOperation, path, "unknown operation %q", node.Operation)
		}
		if len(node.Operands) != def.arity {
			return errorf(
				CodeInvalidOperandCount,
				path,
				"operation %q expects %d operands, got %d",
				node.Operation, def.arity, len(node.Operands),
			)
		}

		for i, operand := range node.Operands {
			childPath := operandPath(path, i)
			switch {
			case operand.Value == nil && operand.Node == nil:
				return errorf(CodeInvalidOperand, childPath, "operand must be a number or an expression")
			case operand.Value != nil && operand.Node != nil:
				return errorf(CodeInvalidOperand, childPath, "operand cannot be both a number and an expression")
			case operand.Value != nil && operand.Value.Percent:
				return errorf(CodeInvalidPercentUsage, childPath, "percentage operands are not supported for %q yet", node.Operation)
			case operand.Node != nil:
				if err := walk(operand.Node, depth+1, childPath); err != nil {
					return err
				}
			}
		}
		return nil
	}

	return walk(root, 1, "")
}

func evaluate(node *Node, path string) (float64, error) {
	def := operations[node.Operation]
	values := make([]float64, len(node.Operands))
	for i, operand := range node.Operands {
		if operand.Node != nil {
			value, err := evaluate(operand.Node, operandPath(path, i))
			if err != nil {
				return 0, err
			}
			values[i] = value
			continue
		}
		values[i] = operand.Value.Number
	}

	result, err := def.apply(values[0], values[1])
	if err != nil {
		if errors.Is(err, errDivisionByZero) {
			return 0, errorf(CodeDivisionByZero, path, "cannot divide by zero")
		}
		return 0, errorf(CodeInvalidOperation, path, "operation %q failed", node.Operation)
	}
	if math.IsNaN(result) || math.IsInf(result, 0) {
		return 0, errorf(CodeNonFiniteResult, path, "result is not a finite number")
	}
	return result, nil
}

func operandPath(base string, index int) string {
	if base == "" {
		return fmt.Sprintf("operands[%d]", index)
	}
	return fmt.Sprintf("%s.operands[%d]", base, index)
}
