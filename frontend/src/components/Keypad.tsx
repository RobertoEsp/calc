type KeypadProps = {
  onInsert: (text: string) => void
  onClear: () => void
  onBackspace: () => void
  onEvaluate: () => void
  disabled: boolean
}

type KeyProps = {
  label: string
  ariaLabel: string
  onClick: () => void
  disabled?: boolean
  className?: string
}

function Key({ label, ariaLabel, onClick, disabled, className }: KeyProps) {
  return (
    <button
      type="button"
      className={className ? `key ${className}` : 'key'}
      aria-label={ariaLabel}
      onClick={onClick}
      onMouseDown={(event) => event.preventDefault()}
      disabled={disabled}
    >
      {label}
    </button>
  )
}

export function Keypad({ onInsert, onClear, onBackspace, onEvaluate, disabled }: KeypadProps) {
  return (
    <div className="keypad" role="group" aria-label="Keypad">
      <Key label="C" ariaLabel="Clear" onClick={onClear} className="key--utility" />
      <Key label="⌫" ariaLabel="Backspace" onClick={onBackspace} className="key--utility" />
      <Key label="(" ariaLabel="Open parenthesis" onClick={() => onInsert('(')} />
      <Key label=")" ariaLabel="Close parenthesis" onClick={() => onInsert(')')} />

      <Key label="7" ariaLabel="7" onClick={() => onInsert('7')} />
      <Key label="8" ariaLabel="8" onClick={() => onInsert('8')} />
      <Key label="9" ariaLabel="9" onClick={() => onInsert('9')} />
      <Key
        label="÷"
        ariaLabel="Divide"
        onClick={() => onInsert('/')}
        className="key--operator"
      />

      <Key label="4" ariaLabel="4" onClick={() => onInsert('4')} />
      <Key label="5" ariaLabel="5" onClick={() => onInsert('5')} />
      <Key label="6" ariaLabel="6" onClick={() => onInsert('6')} />
      <Key
        label="×"
        ariaLabel="Multiply"
        onClick={() => onInsert('*')}
        className="key--operator"
      />

      <Key label="1" ariaLabel="1" onClick={() => onInsert('1')} />
      <Key label="2" ariaLabel="2" onClick={() => onInsert('2')} />
      <Key label="3" ariaLabel="3" onClick={() => onInsert('3')} />
      <Key
        label="−"
        ariaLabel="Subtract"
        onClick={() => onInsert('-')}
        className="key--operator"
      />

      <Key label="0" ariaLabel="0" onClick={() => onInsert('0')} className="key--zero" />
      <Key label="." ariaLabel="Decimal point" onClick={() => onInsert('.')} />
      <Key label="+" ariaLabel="Add" onClick={() => onInsert('+')} className="key--operator" />

      <Key
        label="="
        ariaLabel="Equals"
        onClick={onEvaluate}
        disabled={disabled}
        className="key--equals"
      />
    </div>
  )
}
