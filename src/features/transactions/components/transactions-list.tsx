import { Link } from "@tanstack/react-router"
import { ArrowRightLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils.ts"
import { formatMoney } from "#/lib/currency"
import { AnimatedMoney } from "@/components/animated-money"
import { getAccountTypeMeta } from "@/features/accounts/account-types"
import type { Account } from "@/features/accounts/api"
import type { Transaction } from "@/features/transactions/api"

/** Parse a `YYYY-MM-DD` string as a local date (avoids the UTC-midnight day shift). */
function parseLocalDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function formatDayHeading(date: string): string {
  const d = parseLocalDate(date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((today.getTime() - d.getTime()) / 86_400_000)
  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Yesterday"
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })
}

/** Money in / out per currency (we can't FX-convert across currencies). */
function summarize(transactions: Transaction[]): { currency: string; in: number; out: number }[] {
  const totals = new Map<string, { in: number; out: number }>()
  for (const t of transactions) {
    const bucket = totals.get(t.currency) ?? { in: 0, out: 0 }
    if (t.amount >= 0) bucket.in += t.amount
    else bucket.out += -t.amount
    totals.set(t.currency, bucket)
  }
  return [...totals.entries()].map(([currency, v]) => ({ currency, ...v }))
}

/** Group into date sections, newest day first, newest-created first within a day. */
function groupByDay(transactions: Transaction[]): { date: string; items: Transaction[] }[] {
  const groups = new Map<string, Transaction[]>()
  for (const t of transactions) {
    const list = groups.get(t.date) ?? []
    list.push(t)
    groups.set(t.date, list)
  }
  return [...groups.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => ({
      date,
      items: items.sort((a, b) =>
        String(b.createdAt).localeCompare(String(a.createdAt)),
      ),
    }))
}

function TransactionRow({
  transaction,
  account,
}: {
  transaction: Transaction
  account: Account | undefined
}) {
  const meta = getAccountTypeMeta(account?.type ?? "other")
  const Icon = meta.icon
  const income = transaction.amount > 0

  const title = transaction.payeeName || transaction.note || "Transaction"
  const details = [account?.name ?? "Unknown account", transaction.status]
    .filter(Boolean)
    .join(" · ")

  return (
    <Link
      to="/transactions/$transactionId"
      params={{ transactionId: transaction.id }}
      className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
    >
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-lg"
        style={{ color: meta.color, backgroundColor: `${meta.color}1f` }}
      >
        <Icon className="size-5" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{title}</div>
        <div className="truncate text-xs text-muted-foreground capitalize">{details}</div>
      </div>

      <div className="shrink-0 text-right">
        <div
          className={cn(
            "font-medium tabular-nums",
            income && "text-emerald-600 dark:text-emerald-500",
          )}
        >
          {income ? "+" : ""}
          {formatMoney(transaction.amount, transaction.currency)}
        </div>
        <div className="text-xs text-muted-foreground">{transaction.currency}</div>
      </div>

      <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
    </Link>
  )
}

export function TransactionsList({
  transactions,
  accounts,
}: {
  transactions: Transaction[]
  accounts: Account[]
}) {
  const accountsById = new Map(accounts.map((a) => [a.id, a]))
  const summary = summarize(transactions)
  const groups = groupByDay(transactions)

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {summary.map(({ currency, in: moneyIn, out: moneyOut }) => (
          <div key={currency} className="rounded-xl border bg-card px-4 py-4">
            <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {currency}
            </div>
            <div className="mt-3 flex items-end justify-between gap-4">
              <div>
                <div className="text-xs text-muted-foreground">Money in</div>
                <AnimatedMoney
                  amount={moneyIn}
                  currency={currency}
                  forceSign="+"
                  className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-500"
                />
              </div>
              <ArrowRightLeft size={30} className="text-stone-300 " strokeWidth={1.25} />
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Money out</div>
                <AnimatedMoney
                  amount={moneyOut}
                  currency={currency}
                  forceSign="-"
                  className="font-semibold tabular-nums"
                />
              </div>
            </div>
          </div>
        ))}
      </section>

      <div className="flex flex-col gap-5">
        {groups.map((group) => (
          <section key={group.date}>
            <h2 className="mb-2 px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {formatDayHeading(group.date)}
            </h2>
            <div className="divide-y overflow-hidden rounded-xl border bg-card">
              {group.items.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  account={accountsById.get(transaction.accountId)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
