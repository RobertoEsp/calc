package calculator

import "fmt"

// Code identifies a calculator failure in a stable, API-facing way.
type Code string

const (
	CodeInvalidExpression   Code = "invalid_expression"
	CodeInvalidOperation    Code = "invalid_operation"
	CodeInvalidOperandCount Code = "invalid_operand_count"
	CodeInvalidOperand      Code = "invalid_operand"
	CodeDivisionByZero      Code = "division_by_zero"
	CodeNegativeSqrt        Code = "negative_sqrt"
	CodeNonFiniteResult     Code = "non_finite_result"
	CodeInvalidPercentUsage Code = "invalid_percent_usage"
	CodeExpressionTooDeep   Code = "expression_too_deep"
	CodeExpressionTooLarge  Code = "expression_too_large"
)

// Error reports a calculator failure and the expression path that caused it.
type Error struct {
	Code    Code
	Message string
	Path    string
}

func (e *Error) Error() string {
	if e.Path == "" {
		return fmt.Sprintf("%s: %s", e.Code, e.Message)
	}
	return fmt.Sprintf("%s at %s: %s", e.Code, e.Path, e.Message)
}

func errorf(code Code, path, format string, args ...any) *Error {
	return &Error{Code: code, Message: fmt.Sprintf(format, args...), Path: path}
}
