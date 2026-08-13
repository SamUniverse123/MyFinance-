import CountUp from "@/components/CountUp"
import { CURRENCY_SYMBOLS, type CurrencyCodeType } from "@/lib/currency"

/**
 * Animated equivalent of `formatMoney`: counts up from 0 to the amount (in minor
 * units, e.g. cents) and renders it as `$1,234.56`. `forceSign` overrides the
 * auto sign (used for "+"/"-" money-in/out summaries where the stored amount is
 * already a non-negative magnitude).
 */
export function AnimatedMoney({
  amount,
  currency,
  className,
  forceSign,
  duration = 1,
}: {
  amount: number
  currency: string
  className?: string
  forceSign?: "+" | "-"
  duration?: number
}) {
  const symbol = CURRENCY_SYMBOLS[currency as CurrencyCodeType] ?? `${currency} `
  const sign = forceSign ?? (amount < 0 ? "-" : "")
  const major = Math.abs(amount) / 100

  return (
    <span className={className}>
      {sign}
      {symbol}
      <CountUp to={major} decimals={2} separator="," duration={duration} />
    </span>
  )
}
