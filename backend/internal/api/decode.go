package api

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"

	"calc/backend/internal/calculator"
)

// request is the wire shape of POST /api/v1/calculate.
type request struct {
	Operation string        `json:"operation"`
	Operands  []operandJSON `json:"operands"`
}

// operandJSON decodes the union of a literal number, a value object, and a
// nested expression.
type operandJSON struct {
	operand calculator.Operand
}

func (o operandJSON) toOperand() calculator.Operand {
	return o.operand
}

func (o *operandJSON) UnmarshalJSON(data []byte) error {
	data = bytes.TrimSpace(data)
	if len(data) == 0 {
		return errors.New("operand must not be empty")
	}

	switch data[0] {
	case '{':
		return o.unmarshalObject(data)
	case 'n':
		return errors.New("operand must not be null")
	default:
		number, err := decodeNumber(data, "operand")
		if err != nil {
			return fmt.Errorf("operand must be a number or an expression: %w", err)
		}
		o.operand = calculator.Number(number)
		return nil
	}
}

func (o *operandJSON) unmarshalObject(data []byte) error {
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(data, &fields); err != nil {
		return fmt.Errorf("invalid operand: %w", err)
	}

	_, hasOperation := fields["operation"]
	_, hasValue := fields["value"]
	switch {
	case hasOperation && hasValue:
		return errors.New(`operand cannot combine "operation" and "value"`)
	case hasOperation:
		node, err := decodeNode(fields)
		if err != nil {
			return err
		}
		o.operand = calculator.Nested(node)
		return nil
	case hasValue:
		value, err := decodeValue(fields)
		if err != nil {
			return err
		}
		o.operand = calculator.Operand{Value: value}
		return nil
	default:
		return errors.New(`operand object must contain "operation" or "value"`)
	}
}

func decodeNode(fields map[string]json.RawMessage) (*calculator.Node, error) {
	for key := range fields {
		switch key {
		case "operation", "operands":
		default:
			return nil, fmt.Errorf("unknown field %q in expression", key)
		}
	}

	var operation string
	if err := json.Unmarshal(fields["operation"], &operation); err != nil {
		return nil, fmt.Errorf(`expression "operation" must be a string: %w`, err)
	}

	rawOperands, ok := fields["operands"]
	if !ok {
		return nil, errors.New(`expression is missing "operands"`)
	}
	var operands []operandJSON
	if err := json.Unmarshal(rawOperands, &operands); err != nil {
		return nil, fmt.Errorf(`invalid "operands": %w`, err)
	}
	if operands == nil {
		return nil, errors.New(`expression "operands" must be an array`)
	}

	list := make([]calculator.Operand, len(operands))
	for i, operand := range operands {
		list[i] = operand.toOperand()
	}
	return &calculator.Node{Operation: calculator.Operation(operation), Operands: list}, nil
}

func decodeValue(fields map[string]json.RawMessage) (*calculator.Value, error) {
	for key := range fields {
		switch key {
		case "value", "percent":
		default:
			return nil, fmt.Errorf("unknown field %q in value", key)
		}
	}

	number, err := decodeNumber(fields["value"], "value")
	if err != nil {
		return nil, err
	}

	var percent bool
	if rawPercent, ok := fields["percent"]; ok {
		if err := json.Unmarshal(rawPercent, &percent); err != nil {
			return nil, fmt.Errorf(`"percent" must be a boolean: %w`, err)
		}
	}

	return &calculator.Value{Number: number, Percent: percent}, nil
}

func decodeNumber(raw json.RawMessage, field string) (float64, error) {
	if bytes.Equal(bytes.TrimSpace(raw), []byte("null")) {
		return 0, fmt.Errorf("%q must be a number", field)
	}
	var number float64
	if err := json.Unmarshal(raw, &number); err != nil {
		return 0, fmt.Errorf("%q must be a number: %w", field, err)
	}
	return number, nil
}

func decodeRequest(body io.Reader) (*calculator.Node, error) {
	decoder := json.NewDecoder(body)
	decoder.DisallowUnknownFields()

	var payload request
	if err := decoder.Decode(&payload); err != nil {
		if errors.Is(err, io.EOF) {
			return nil, errors.New("request body is empty")
		}
		return nil, err
	}

	var extra json.RawMessage
	if err := decoder.Decode(&extra); !errors.Is(err, io.EOF) {
		if err == nil {
			return nil, errors.New("request body must contain exactly one JSON object")
		}
		return nil, err
	}

	operands := make([]calculator.Operand, len(payload.Operands))
	for i, operand := range payload.Operands {
		operands[i] = operand.toOperand()
	}
	return &calculator.Node{
		Operation: calculator.Operation(payload.Operation),
		Operands:  operands,
	}, nil
}
