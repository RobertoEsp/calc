import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import type { CalculationNode } from '../expr/serialize'
import { server } from '../test/server'
import { CalculatorApiError, calculate } from './client'

const node: CalculationNode = { operation: 'add', operands: [2, 3] }

describe('calculate', () => {
  it('posts the expression and returns the result', async () => {
    server.use(
      http.post('*/api/v1/calculate', async ({ request }) => {
        expect(request.method).toBe('POST')
        expect(request.headers.get('Content-Type')).toContain('application/json')
        expect(await request.json()).toEqual(node)
        return HttpResponse.json({ result: 5 })
      }),
    )

    await expect(calculate(node)).resolves.toBe(5)
  })

  it('maps domain errors to readable messages', async () => {
    server.use(
      http.post('*/api/v1/calculate', () =>
        HttpResponse.json(
          { error: { code: 'division_by_zero', message: 'cannot divide by zero' } },
          { status: 422 },
        ),
      ),
    )

    await expect(calculate(node)).rejects.toMatchObject({
      code: 'division_by_zero',
      message: 'Cannot divide by zero.',
      status: 422,
    })
    await expect(calculate(node)).rejects.toBeInstanceOf(CalculatorApiError)
  })

  it.each([
    ['non_finite_result', 'That result is too large to show.'],
    ['invalid_operation', 'That operation is not supported.'],
    ['invalid_operand', 'That expression is not valid.'],
    ['invalid_operand_count', 'That expression is not valid.'],
    ['negative_sqrt', 'Cannot take the square root of a negative number.'],
    ['invalid_percent_usage', 'Percentages can only be used on the right side of an operation.'],
    ['expression_too_deep', 'That expression is nested too deeply.'],
    ['expression_too_large', 'That expression is too long.'],
    ['invalid_json', 'The expression could not be read.'],
    ['request_too_large', 'That expression is too large to send.'],
  ])('maps the %s error code to a readable message', async (code, message) => {
    server.use(
      http.post('*/api/v1/calculate', () =>
        HttpResponse.json({ error: { code, message: 'server detail' } }, { status: 422 }),
      ),
    )

    await expect(calculate(node)).rejects.toMatchObject({ code, message })
  })

  it('falls back to the server message for unknown codes', async () => {
    server.use(
      http.post('*/api/v1/calculate', () =>
        HttpResponse.json(
          { error: { code: 'unexpected_error', message: 'Something specific broke.' } },
          { status: 500 },
        ),
      ),
    )

    await expect(calculate(node)).rejects.toMatchObject({
      code: 'unexpected_error',
      message: 'Something specific broke.',
    })
  })

  it('rejects an unexpected response shape', async () => {
    server.use(
      http.post('*/api/v1/calculate', () => HttpResponse.json({ result: '5' })),
    )

    await expect(calculate(node)).rejects.toMatchObject({ code: 'invalid_response' })
  })

  it('reports network failures', async () => {
    server.use(http.post('*/api/v1/calculate', () => HttpResponse.error()))

    await expect(calculate(node)).rejects.toMatchObject({ code: 'network_error' })
  })

  it('propagates caller aborts', async () => {
    server.use(
      http.post('*/api/v1/calculate', async () => {
        await delay(200)
        return HttpResponse.json({ result: 5 })
      }),
    )

    const controller = new AbortController()
    const pending = calculate(node, { signal: controller.signal })
    controller.abort()

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('reports timeouts separately from aborts', async () => {
    server.use(
      http.post('*/api/v1/calculate', async () => {
        await delay(200)
        return HttpResponse.json({ result: 5 })
      }),
    )

    await expect(calculate(node, { timeoutMs: 10 })).rejects.toMatchObject({
      code: 'timeout',
      message: 'The calculator took too long to respond.',
    })
  })
})
