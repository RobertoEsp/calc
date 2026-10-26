package calculator

import (
	"errors"
	"math"
)

var (
	errDivisionByZero = errors.New("cannot divide by zero")
	errNegativeSqrt   = errors.New("cannot take the square root of a negative number")
)

// percentMode describes where a percent-flagged value may appear.
type percentMode int

const (
	percentNone percentMode = iota
	// percentRight allows a percentage as the right operand of a binary operation.
	percentRight
	// percentAny allows a percentage on the single operand of a unary operation.
	percentAny
)

type operation struct {
	arity   int
	percent percentMode
	apply   func(values []float64) (float64, error)
}

var operations = map[Operation]operation{
	Add: {
		arity:   2,
		percent: percentRight,
		apply: func(values []float64) (float64, error) {
			return values[0] + values[1], nil
		},
	},
	Subtract: {
		arity:   2,
		percent: percentRight,
		apply: func(values []float64) (float64, error) {
			return values[0] - values[1], nil
		},
	},
	Multiply: {
		arity:   2,
		percent: percentRight,
		apply: func(values []float64) (float64, error) {
			return values[0] * values[1], nil
		},
	},
	Divide: {
		arity:   2,
		percent: percentRight,
		apply: func(values []float64) (float64, error) {
			if values[1] == 0 {
				return 0, errDivisionByZero
			}
			return values[0] / values[1], nil
		},
	},
	Exponentiate: {
		arity: 2,
		apply: func(values []float64) (float64, error) {
			return math.Pow(values[0], values[1]), nil
		},
	},
	Sqrt: {
		arity: 1,
		apply: func(values []float64) (float64, error) {
			if values[0] < 0 {
				return 0, errNegativeSqrt
			}
			return math.Sqrt(values[0]), nil
		},
	},
	Percent: {
		arity:   1,
		percent: percentAny,
		apply: func(values []float64) (float64, error) {
			return values[0] / 100, nil
		},
	},
}

func (o operation) allowsPercent(index int) bool {
	switch o.percent {
	case percentRight:
		return index == 1
	case percentAny:
		return true
	default:
		return false
	}
}

// applyPercent converts a percent-flagged right operand into the amount the
// operation should use. Addition and subtraction take a percentage of the left
// operand, while multiplication and division use the percentage as a fraction.
func applyPercent(operation Operation, values []float64) {
	switch operation {
	case Add, Subtract:
		values[1] = values[0] * values[1] / 100
	case Multiply, Divide:
		values[1] = values[1] / 100
	}
}
