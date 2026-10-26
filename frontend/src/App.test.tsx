import { http, HttpResponse } from 'msw'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import type { CalculationNode } from './expr/serialize'
import { server } from './test/server'

function mockResult(result: number, onRequest?: (body: unknown) => void) {
  server.use(
    http.post('*/api/v1/calculate', async ({ request }) => {
      onRequest?.(await request.json())
      return HttpResponse.json({ result })
    }),
  )
}

function mockError(code: string, message: string, status = 422) {
  server.use(
    http.post('*/api/v1/calculate', () =>
      HttpResponse.json({ error: { code, message } }, { status }),
    ),
  )
}

function renderCalculator() {
  render(<App />)
  return {
    user: userEvent.setup(),
    input: screen.getByRole('textbox', { name: 'Expression' }) as HTMLInputElement,
    result: screen.getByRole('status', { name: 'Result' }),
  }
}

describe('Calculator', () => {
  it('evaluates an expression with a single request', async () => {
    let calls = 0
    let body: unknown
    mockResult(5, (received) => {
      calls += 1
      body = received
    })

    const { user, input, result } = renderCalculator()
    await user.type(input, '2+3')
    await user.click(screen.getByRole('button', { name: 'Equals' }))

    await waitFor(() => expect(result).toHaveTextContent('5'))
    expect(body).toEqual({ operation: 'add', operands: [2, 3] } satisfies CalculationNode)
    expect(calls).toBe(1)
  })

  it('sends a nested tree for precedence in one request', async () => {
    let calls = 0
    let body: unknown
    mockResult(14, (received) => {
      calls += 1
      body = received
    })

    const { user, input, result } = renderCalculator()
    await user.type(input, '2+3*4')
    await user.click(screen.getByRole('button', { name: 'Equals' }))

    await waitFor(() => expect(result).toHaveTextContent('14'))
    expect(body).toEqual({
      operation: 'add',
      operands: [2, { operation: 'multiply', operands: [3, 4] }],
    })
    expect(calls).toBe(1)
  })

  it('builds an expression with the keypad', async () => {
    let body: unknown
    mockResult(56, (received) => {
      body = received
    })

    const { user, input, result } = renderCalculator()
    await user.click(screen.getByRole('button', { name: '7' }))
    await user.click(screen.getByRole('button', { name: 'Multiply' }))
    await user.click(screen.getByRole('button', { name: '8' }))
    await user.click(screen.getByRole('button', { name: 'Equals' }))

    expect(input).toHaveValue('7*8')
    await waitFor(() => expect(result).toHaveTextContent('56'))
    expect(body).toEqual({ operation: 'multiply', operands: [7, 8] })
  })

  it('inserts a key at the caret', async () => {
    const { user, input } = renderCalculator()
    await user.type(input, '1+2')
    input.setSelectionRange(0, 0)

    await user.click(screen.getByRole('button', { name: '9' }))
    expect(input).toHaveValue('91+2')
  })

  it('shows a domain error from the API', async () => {
    mockError('division_by_zero', 'cannot divide by zero')

    const { user, input, result } = renderCalculator()
    await user.type(input, '1/0')
    await user.click(screen.getByRole('button', { name: 'Equals' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot divide by zero.')
    expect(result.textContent).toBe('')
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('rejects invalid syntax without calling the API', async () => {
    const { user, input } = renderCalculator()
    await user.type(input, '2+')
    await user.click(screen.getByRole('button', { name: 'Equals' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter a number to finish the expression.',
    )
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('asks for input when the expression is empty', async () => {
    const { user } = renderCalculator()
    await user.click(screen.getByRole('button', { name: 'Equals' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter an expression to calculate.',
    )
  })

  it('deletes with backspace and clears everything', async () => {
    const { user, input } = renderCalculator()
    await user.type(input, '123')

    await user.click(screen.getByRole('button', { name: 'Backspace' }))
    expect(input).toHaveValue('12')

    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(input).toHaveValue('')

    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(input).toHaveFocus()
  })

  it('calculates on Enter and clears on Escape', async () => {
    mockResult(42)

    const { user, input, result } = renderCalculator()
    await user.type(input, '6*7{Enter}')
    await waitFor(() => expect(result).toHaveTextContent('42'))

    await user.type(input, '8+1')
    await user.keyboard('{Escape}')
    expect(input).toHaveValue('')
  })

  it('clears a stale result when editing resumes', async () => {
    mockResult(2)

    const { user, input, result } = renderCalculator()
    await user.type(input, '1+1')
    await user.click(screen.getByRole('button', { name: 'Equals' }))
    await waitFor(() => expect(result).toHaveTextContent('2'))

    await user.type(input, '3')
    expect(result.textContent).toBe('')
  })

  it('inserts every operator and parenthesis from the keypad', async () => {
    const { user, input } = renderCalculator()
    const keys = [
      '1', 'Add', 'Open parenthesis', '2', 'Multiply', '3', 'Close parenthesis',
      'Divide', 'Decimal point', '5', 'Subtract', '0',
    ]

    for (const name of keys) {
      await user.click(screen.getByRole('button', { name }))
    }

    expect(input).toHaveValue('1+(2*3)/.5-0')

    await user.click(screen.getByRole('button', { name: 'Clear' }))
    for (const name of ['4', '5', '6']) {
      await user.click(screen.getByRole('button', { name }))
    }
    expect(input).toHaveValue('456')
  })

  it('replaces a selection with a keypad key', async () => {
    const { user, input } = renderCalculator()
    await user.type(input, '12+34')
    input.setSelectionRange(0, 2)

    await user.click(screen.getByRole('button', { name: '7' }))
    expect(input).toHaveValue('7+34')
  })

  it('removes a selected range with backspace', async () => {
    const { user, input } = renderCalculator()
    await user.type(input, '12+34')
    input.setSelectionRange(1, 4)

    await user.click(screen.getByRole('button', { name: 'Backspace' }))
    expect(input).toHaveValue('14')
  })
})
