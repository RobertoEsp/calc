import type { KeyboardEvent, RefObject } from 'react'

type DisplayProps = {
  expression: string
  inputRef: RefObject<HTMLInputElement | null>
  result: string | null
  error: string | null
  isCalculating: boolean
  onChange: (value: string) => void
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
}

export function Display({
  expression,
  inputRef,
  result,
  error,
  isCalculating,
  onChange,
  onKeyDown,
}: DisplayProps) {
  return (
    <section className="display" aria-label="Calculation display">
      <input
        ref={inputRef}
        className="display__input"
        type="text"
        value={expression}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Type an expression"
        aria-label="Expression"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'calculation-error' : undefined}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
      />

      <output className="display__result" role="status" aria-label="Result" aria-live="polite">
        {isCalculating ? '…' : (result ?? '')}
      </output>

      {error ? (
        <p className="display__error" id="calculation-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}
