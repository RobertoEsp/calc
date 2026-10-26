import { useCallback, useEffect, useRef, useState } from 'react'
import { CalculatorApiError, calculate } from '../api/client'
import { ParseError } from '../expr/errors'
import { formatNumber } from '../expr/format'
import { parse } from '../expr/parser'
import { toRequest } from '../expr/serialize'

type Status = 'idle' | 'calculating'

export function useCalculator() {
  const [expression, setExpressionState] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const controllerRef = useRef<AbortController | null>(null)

  const cancel = useCallback(() => {
    controllerRef.current?.abort()
    controllerRef.current = null
    setStatus('idle')
  }, [])

  const setExpression = useCallback(
    (value: string) => {
      cancel()
      setExpressionState(value)
      setResult(null)
      setError(null)
    },
    [cancel],
  )

  const clear = useCallback(() => {
    cancel()
    setExpressionState('')
    setResult(null)
    setError(null)
  }, [cancel])

  const evaluate = useCallback(async () => {
    const trimmed = expression.trim()
    if (!trimmed) {
      setResult(null)
      setError('Enter an expression to calculate.')
      return
    }

    let request
    try {
      request = toRequest(parse(trimmed))
    } catch (parseError) {
      setResult(null)
      setError(
        parseError instanceof ParseError
          ? parseError.message
          : 'The expression could not be read.',
      )
      return
    }

    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    setStatus('calculating')
    setResult(null)
    setError(null)

    try {
      const value = await calculate(request, { signal: controller.signal })
      if (controller.signal.aborted) return
      setResult(formatNumber(value))
    } catch (requestError) {
      if (controller.signal.aborted) return
      setError(
        requestError instanceof CalculatorApiError
          ? requestError.message
          : 'Something went wrong.',
      )
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null
        setStatus('idle')
      }
    }
  }, [expression])

  useEffect(() => {
    return () => {
      controllerRef.current?.abort()
    }
  }, [])

  return {
    expression,
    result,
    error,
    isCalculating: status === 'calculating',
    setExpression,
    evaluate,
    clear,
  }
}
