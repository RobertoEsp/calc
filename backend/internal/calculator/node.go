package calculator

// Limits protect the evaluator from pathological input.
const (
	MaxDepth = 16
	MaxNodes = 64
)

// Operation names an arithmetic operation understood by the evaluator.
type Operation string

const (
	Add          Operation = "add"
	Subtract     Operation = "subtract"
	Multiply     Operation = "multiply"
	Divide       Operation = "divide"
	Exponentiate Operation = "exponentiate"
	Sqrt         Operation = "sqrt"
	Percent      Operation = "percent"
)

// Value is a literal number, optionally expressed as a percentage.
type Value struct {
	Number  float64
	Percent bool
}

// Operand is either a literal value or a nested expression.
type Operand struct {
	Value *Value
	Node  *Node
}

// Node is an operation applied to its operands.
type Node struct {
	Operation Operation
	Operands  []Operand
}

// Number returns a literal operand.
func Number(n float64) Operand {
	return Operand{Value: &Value{Number: n}}
}

// PercentValue returns a literal operand marked as a percentage.
func PercentValue(n float64) Operand {
	return Operand{Value: &Value{Number: n, Percent: true}}
}

// Nested returns an operand that evaluates a child expression.
func Nested(n *Node) Operand {
	return Operand{Node: n}
}

// NewNode builds an expression node.
func NewNode(op Operation, operands ...Operand) *Node {
	return &Node{Operation: op, Operands: operands}
}
