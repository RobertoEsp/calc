import type { CalculationNode } from '../expr/serialize'

export class CalculatorApiError extends Error {
  readonly code: string
  readonly status: number | null

  constructor(message: string, code: string, status: number | null = null) {
    super(message)
    this.name = 'CalculatorApiError'
    this.code = code
    this.status = status
  }
}

const MESSAGES: Record<string, string> = {
  division_by_zero: 'Cannot divide by zero.',
  non_finite_result: 'That result is too large to show.',
  invalid_operation: 'That operation is not supported.',
  invalid_operand: 'That expression is not valid.',
  invalid_operand_count: 'That expression is not valid.',
  invalid_percent_usage: 'Percentages are not available yet.',
  expression_too_deep: 'That expression is nested too deeply.',
  expression_too_large: 'That expression is too long.',
  invalid_json: 'The expression could not be read.',
  request_too_large: 'That expression is too large to send.',
  invalid_response: 'The calculator returned an unexpected result.',
}

type ErrorEnvelope = {
  error?: {
    code?: string
    message?: string
  }
}

export type CalculateOptions = {
  signal?: AbortSignal
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 10_000

export async function calculate(
  node: CalculationNode,
  options: CalculateOptions = {},
): Promise<number> {
  const controller = new AbortController()
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const abortFromCaller = () => controller.abort()
  options.signal?.addEventListener('abort', abortFromCaller, { once: true })

  try {
    const response = await fetch(new URL('/api/v1/calculate', window.location.origin), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(node),
      signal: controller.signal,
    })

    if (!response.ok) {
      const envelope = await readErrorEnvelope(response)
      const code = envelope?.error?.code ?? 'unknown_error'
      throw new CalculatorApiError(messageFor(code, envelope?.error?.message), code, response.status)
    }

    const payload = (await response.json()) as { result?: unknown }
    if (typeof payload.result !== 'number' || !Number.isFinite(payload.result)) {
      throw new CalculatorApiError(MESSAGES.invalid_response, 'invalid_response', response.status)
    }
    return payload.result
  } catch (error) {
    if (error instanceof CalculatorApiError) {
      throw error
    }
    if (isAbortError(error)) {
      if (options.signal?.aborted) {
        throw error
      }
      throw new CalculatorApiError('The calculator took too long to respond.', 'timeout')
    }
    throw new CalculatorApiError('Cannot reach the calculator service.', 'network_error')
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', abortFromCaller)
  }
}

async function readErrorEnvelope(response: Response): Promise<ErrorEnvelope | null> {
  try {
    return (await response.json()) as ErrorEnvelope
  } catch {
    return null
  }
}

function messageFor(code: string, serverMessage?: string): string {
  return MESSAGES[code] ?? serverMessage ?? 'The calculator failed. Try again.'
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
    || (typeof error === 'object' && error !== null && (error as { name?: string }).name === 'AbortError')
}
