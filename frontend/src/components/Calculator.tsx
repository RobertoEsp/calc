import { useEffect, useRef, type KeyboardEvent } from 'react'
import { useCalculator } from '../hooks/useCalculator'
import { Display } from './Display'
import { Keypad } from './Keypad'

export function Calculator() {
  const { expression, result, error, isCalculating, setExpression, evaluate, clear } =
    useCalculator()
  const inputRef = useRef<HTMLInputElement>(null)
  const pendingCaret = useRef<number | null>(null)

  useEffect(() => {
    const position = pendingCaret.current
    if (position === null) return
    pendingCaret.current = null

    const input = inputRef.current
    if (!input) return
    input.focus()
    input.setSelectionRange(position, position)
  }, [expression])

  const handleInsert = (text: string) => {
    const { start, end } = selectionIn(inputRef.current, expression)
    pendingCaret.current = start + text.length
    setExpression(expression.slice(0, start) + text + expression.slice(end))
  }

  const handleBackspace = () => {
    const { start, end } = selectionIn(inputRef.current, expression)
    if (start === 0 && end === 0) return

    if (start !== end) {
      pendingCaret.current = start
      setExpression(expression.slice(0, start) + expression.slice(end))
      return
    }

    pendingCaret.current = start - 1
    setExpression(expression.slice(0, start - 1) + expression.slice(start))
  }

  const handleClear = () => {
    if (expression === '') {
      inputRef.current?.focus()
      return
    }
    pendingCaret.current = 0
    clear()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      void evaluate()
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      handleClear()
    }
  }

  return (
    <div className="calculator">
      <header className="calculator__header">
        <h1>Calculator</h1>
        <p>Add, subtract, multiply, divide.</p>
      </header>

      <Display
        expression={expression}
        inputRef={inputRef}
        result={result}
        error={error}
        isCalculating={isCalculating}
        onChange={setExpression}
        onKeyDown={handleKeyDown}
      />

      <Keypad
        onInsert={handleInsert}
        onClear={handleClear}
        onBackspace={handleBackspace}
        onEvaluate={() => void evaluate()}
        disabled={isCalculating}
      />

      <p className="calculator__hint">Press Enter to calculate, Escape to clear.</p>
    </div>
  )
}

function selectionIn(input: HTMLInputElement | null, expression: string) {
  if (!input || document.activeElement !== input) {
    return { start: expression.length, end: expression.length }
  }
  const start = input.selectionStart ?? expression.length
  const end = input.selectionEnd ?? start
  return { start, end }
}
