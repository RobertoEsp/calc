const SIGNIFICANT_DIGITS = 12

/**
 * Renders a result with 12 significant digits, then lets JavaScript pick the
 * shortest representation. This keeps 0.1 + 0.2 from surfacing as 0.30000000000000004.
 */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return 'Error'
  }
  if (Object.is(value, -0)) {
    return '0'
  }
  return String(Number(value.toPrecision(SIGNIFICANT_DIGITS)))
}
