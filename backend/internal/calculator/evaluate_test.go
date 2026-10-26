package calculator

import (
	"errors"
	"math"
	"testing"
)

func TestEvaluateSuccess(t *testing.T) {
	deep := NewNode(Add, Number(0), Number(1))
	for i := 0; i < 10; i++ {
		deep = NewNode(Add, Number(0), Nested(deep))
	}

	tests := []struct {
		name string
		node *Node
		want float64
	}{
		{"adds", NewNode(Add, Number(2), Number(3)), 5},
		{"subtracts", NewNode(Subtract, Number(2), Number(3)), -1},
		{"multiplies", NewNode(Multiply, Number(7), Number(6)), 42},
		{"divides", NewNode(Divide, Number(10), Number(4)), 2.5},
		{"raises to a power", NewNode(Exponentiate, Number(2), Number(10)), 1024},
		{
			"raises to a nested power",
			NewNode(Exponentiate, Number(2), Nested(NewNode(Exponentiate, Number(3), Number(2)))),
			512,
		},
		{"takes a square root", NewNode(Sqrt, Number(81)), 9},
		{"takes the square root of an expression", NewNode(Sqrt, Nested(NewNode(Add, Number(7), Number(2)))), 3},
		{"converts to a percentage", NewNode(Percent, Number(25)), 0.25},
		{"accepts a flagged percentage", NewNode(Percent, PercentValue(25)), 0.25},
		{"adds a percentage", NewNode(Add, Number(200), PercentValue(10)), 220},
		{"subtracts a percentage", NewNode(Subtract, Number(200), PercentValue(10)), 180},
		{"multiplies by a percentage", NewNode(Multiply, Number(200), PercentValue(10)), 20},
		{"divides by a percentage", NewNode(Divide, Number(200), PercentValue(10)), 2000},
		{"adds a negative percentage", NewNode(Add, Number(200), PercentValue(-10)), 180},
		{
			"applies a percentage inside a nested operation",
			NewNode(Add, Number(100), Nested(NewNode(Add, Number(50), PercentValue(10)))),
			155,
		},
		{"handles decimals", NewNode(Multiply, Number(0.1), Number(3)), 0.3},
		{"honors nesting", NewNode(Add, Number(2), Nested(NewNode(Multiply, Number(3), Number(4)))), 14},
		{"deep chain", deep, 1},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, err := Evaluate(test.node)
			if err != nil {
				t.Fatalf("Evaluate() error = %v", err)
			}
			if !closeEnough(got, test.want) {
				t.Fatalf("Evaluate() = %v, want %v", got, test.want)
			}
		})
	}
}

func TestEvaluateErrors(t *testing.T) {
	tests := []struct {
		name     string
		node     *Node
		wantCode Code
		wantPath string
	}{
		{"nil expression", nil, CodeInvalidExpression, ""},
		{"unknown operation", NewNode("modulo", Number(1), Number(2)), CodeInvalidOperation, ""},
		{
			"unknown nested operation",
			NewNode(Add, Number(1), Nested(NewNode("modulo", Number(1), Number(2)))),
			CodeInvalidOperation,
			"operands[1]",
		},
		{"missing operand", NewNode(Add, Number(1)), CodeInvalidOperandCount, ""},
		{"too many operands", NewNode(Add, Number(1), Number(2), Number(3)), CodeInvalidOperandCount, ""},
		{"sqrt with two operands", NewNode(Sqrt, Number(1), Number(2)), CodeInvalidOperandCount, ""},
		{"percent with two operands", NewNode(Percent, Number(1), Number(2)), CodeInvalidOperandCount, ""},
		{
			"nested wrong arity",
			NewNode(Add, Number(1), Nested(NewNode(Add, Number(1)))),
			CodeInvalidOperandCount,
			"operands[1]",
		},
		{"division by zero", NewNode(Divide, Number(1), Number(0)), CodeDivisionByZero, ""},
		{
			"nested division by zero",
			NewNode(Add, Number(1), Nested(NewNode(Divide, Number(1), Number(0)))),
			CodeDivisionByZero,
			"operands[1]",
		},
		{"percentage division by zero", NewNode(Divide, Number(200), PercentValue(0)), CodeDivisionByZero, ""},
		{"negative square root", NewNode(Sqrt, Number(-4)), CodeNegativeSqrt, ""},
		{
			"nested negative square root",
			NewNode(Add, Number(1), Nested(NewNode(Sqrt, Number(-4)))),
			CodeNegativeSqrt,
			"operands[1]",
		},
		{"overflow", NewNode(Multiply, Number(1e308), Number(10)), CodeNonFiniteResult, ""},
		{"power overflow", NewNode(Exponentiate, Number(10), Number(400)), CodeNonFiniteResult, ""},
		{"power overflow via zero exponent", NewNode(Exponentiate, Number(0), Number(-1)), CodeNonFiniteResult, ""},
		{"power with no real result", NewNode(Exponentiate, Number(-8), Number(0.5)), CodeNonFiniteResult, ""},
		{
			"nested overflow",
			NewNode(Add, Number(1), Nested(NewNode(Multiply, Number(1e308), Number(10)))),
			CodeNonFiniteResult,
			"operands[1]",
		},
		{
			"nan result",
			NewNode(Add, Number(math.Inf(1)), Number(math.Inf(-1))),
			CodeNonFiniteResult,
			"",
		},
		{"percent on the left", NewNode(Add, PercentValue(10), Number(200)), CodeInvalidPercentUsage, "operands[0]"},
		{
			"percent on the left of multiplication",
			NewNode(Multiply, PercentValue(10), Number(200)),
			CodeInvalidPercentUsage,
			"operands[0]",
		},
		{
			"percent in exponentiation",
			NewNode(Exponentiate, Number(2), PercentValue(10)),
			CodeInvalidPercentUsage,
			"operands[1]",
		},
		{"percent in square root", NewNode(Sqrt, PercentValue(25)), CodeInvalidPercentUsage, "operands[0]"},
		{
			"nested percent on the left",
			NewNode(Add, Number(1), Nested(NewNode(Subtract, PercentValue(10), Number(2)))),
			CodeInvalidPercentUsage,
			"operands[1].operands[0]",
		},
		{"empty operand", NewNode(Add, Operand{}, Number(1)), CodeInvalidOperand, "operands[0]"},
		{
			"ambiguous operand",
			NewNode(Add, Operand{
				Value: &Value{Number: 1},
				Node:  NewNode(Add, Number(1), Number(2)),
			}, Number(1)),
			CodeInvalidOperand,
			"operands[0]",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			_, err := Evaluate(test.node)
			calcErr := requireCode(t, err, test.wantCode)
			if calcErr.Path != test.wantPath {
				t.Fatalf("path = %q, want %q", calcErr.Path, test.wantPath)
			}
		})
	}
}

func TestValidateLimits(t *testing.T) {
	t.Run("depth at limit", func(t *testing.T) {
		if err := validate(chain(16)); err != nil {
			t.Fatalf("validate() error = %v", err)
		}
	})

	t.Run("depth over limit", func(t *testing.T) {
		err := validate(chain(17))
		calcErr := requireCode(t, err, CodeExpressionTooDeep)
		if calcErr.Path == "" {
			t.Fatal("expected a path for the offending node")
		}
	})

	t.Run("node count at limit", func(t *testing.T) {
		if err := validate(fullTree(6)); err != nil {
			t.Fatalf("validate() error = %v", err)
		}
	})

	t.Run("node count over limit", func(t *testing.T) {
		requireCode(t, validate(fullTree(7)), CodeExpressionTooLarge)
	})
}

func TestErrorString(t *testing.T) {
	withPath := &Error{Code: CodeDivisionByZero, Message: "cannot divide by zero", Path: "operands[1]"}
	if got, want := withPath.Error(), "division_by_zero at operands[1]: cannot divide by zero"; got != want {
		t.Fatalf("Error() = %q, want %q", got, want)
	}

	withoutPath := &Error{Code: CodeInvalidExpression, Message: "expression is required"}
	if got, want := withoutPath.Error(), "invalid_expression: expression is required"; got != want {
		t.Fatalf("Error() = %q, want %q", got, want)
	}
}

func chain(depth int) *Node {
	node := NewNode(Add, Number(1), Number(1))
	for i := 1; i < depth; i++ {
		node = NewNode(Add, Number(1), Nested(node))
	}
	return node
}

func fullTree(levels int) *Node {
	if levels == 1 {
		return NewNode(Add, Number(1), Number(2))
	}
	return NewNode(Add, Nested(fullTree(levels-1)), Nested(fullTree(levels-1)))
}

func requireCode(t *testing.T, err error, want Code) *Error {
	t.Helper()
	if err == nil {
		t.Fatalf("expected error code %q, got nil", want)
	}
	var calcErr *Error
	if !errors.As(err, &calcErr) {
		t.Fatalf("expected *Error, got %T: %v", err, err)
	}
	if calcErr.Code != want {
		t.Fatalf("code = %q, want %q (error: %v)", calcErr.Code, want, err)
	}
	return calcErr
}

func closeEnough(got, want float64) bool {
	scale := math.Max(1, math.Abs(want))
	return math.Abs(got-want) <= 1e-9*scale
}
