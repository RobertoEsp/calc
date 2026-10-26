package calculator

import "errors"

var errDivisionByZero = errors.New("cannot divide by zero")

type operation struct {
	arity int
	apply func(a, b float64) (float64, error)
}

var operations = map[Operation]operation{
	Add: {
		arity: 2,
		apply: func(a, b float64) (float64, error) { return a + b, nil },
	},
	Subtract: {
		arity: 2,
		apply: func(a, b float64) (float64, error) { return a - b, nil },
	},
	Multiply: {
		arity: 2,
		apply: func(a, b float64) (float64, error) { return a * b, nil },
	},
	Divide: {
		arity: 2,
		apply: func(a, b float64) (float64, error) {
			if b == 0 {
				return 0, errDivisionByZero
			}
			return a / b, nil
		},
	},
}
