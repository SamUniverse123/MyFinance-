import * as React from "react"
import { Link } from "@tanstack/react-router"
import { ChevronRight, LayoutGrid, List } from "lucide-react"

import { cn } from "@/lib/utils.ts"
import { formatMoney } from "#/lib/currency"
import { AnimatedMoney } from "@/components/animated-money"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group.tsx"
import { getAccountTypeMeta } from "@/features/accounts/account-types"
import type { Account } from "@/features/accounts/api"
import { accountBalance, txnTotalsByAccount } from "@/features/accounts/balances"
import { useGetTransactions } from "@/features/transactions/queries"

type ViewMode = "list" | "grid"
const VIEW_STORAGE_KEY = "accounts-view"



/** Active, net-worth-counting balances summed per currency (we can't FX-convert).
 *  Each account's balance is its opening balance plus its posted transactions. */
function netWorthByCurrency(
  accounts: Account[],
  txnTotals: Map<string, number>,
): [string, number][] {
  const totals = new Map<string, number>()
  for (const a of accounts) {
    if (a.closedAt || a.excludeFromNetWorth) continue
    totals.set(
      a.currency,
      (totals.get(a.currency) ?? 0) + accountBalance(a, txnTotals),
    )
  }
  return [...totals.entries()].sort((x, y) => y[1] - x[1])
}

function sortAccounts(accounts: Account[]): Account[] {
  return [...accounts].sort(
    (a, b) =>
      Number(Boolean(a.closedAt)) - Number(Boolean(b.closedAt)) ||
      a.sortOrder - b.sortOrder ||
      a.name.localeCompare(b.name),
  )
}

function AccountRow({
  account,
  balance,
}: {
  account: Account
  balance: number
}) {
  const meta = getAccountTypeMeta(account.type)
  const Icon = meta.icon
  const closed = Boolean(account.closedAt)

  const details = [
    meta.label,
    account.institution || null,
    account.mask ? `•••• ${account.mask}` : null,
    account.excludeFromNetWorth ? "Not in net worth" : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <Link
      to="/accounts/$accountId"
      params={{ accountId: account.id }}
      className={cn(
        "flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none inset-shadow-xs",
        closed && "opacity-60",
      )}
    >
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-lg "
        style={{ color: meta.color, backgroundColor: `${meta.color}1f` }}
      >
        <Icon className="size-5" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{account.name}</span>
          {closed && (
            <span className="shrink-0 rounded-full border px-1.5 py-px text-[0.65rem] font-medium text-muted-foreground">
              Closed
            </span>
          )}
        </div>
        <div className="truncate text-xs text-muted-foreground">{details}</div>
      </div>

      <div className="shrink-0 text-right">
        <div className="font-medium tabular-nums">
          {formatMoney(balance, account.currency)}
        </div>
        <div className="text-xs text-muted-foreground">{account.currency}</div>

      </div>

      <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
    </Link>
  )
}

function AccountCard({
  account,
  balance,
}: {
  account: Account
  balance: number
}) {
  const meta = getAccountTypeMeta(account.type)
  const Icon = meta.icon
  const closed = Boolean(account.closedAt)

  const details = [
    meta.label,
    account.institution || null,
    account.mask ? `•••• ${account.mask}` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <Link
      to="/accounts/$accountId"
      params={{ accountId: account.id }}
      className={cn(
        "flex flex-col gap-4 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none inset-shadow-xs",
        closed && "opacity-60",
      )}
    >
      <div className="flex items-start gap-3 ">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-lg"
          style={{ color: meta.color, backgroundColor: `${meta.color}1f` }}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{account.name}</div>
          <div className="truncate text-xs text-muted-foreground">{details}</div>
        </div>
        {closed && (
          <span className="shrink-0 rounded-full border px-1.5 py-px text-[0.65rem] font-medium text-muted-foreground">
            Closed
          </span>
        )}
      </div>

      <div>
        <div className="text-xl font-semibold tabular-nums">
          {formatMoney(balance, account.currency)}
        </div>
        <div className="text-xs text-muted-foreground">{account.currency}</div>
      </div>
    </Link>
  )
}

/** Remembers the last-used layout across visits (client-only; SSR starts as list). */
function useAccountsView(): [ViewMode, (v: ViewMode) => void] {
  const [view, setView] = React.useState<ViewMode>("list")

  React.useEffect(() => {
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY)
    if (stored === "grid" || stored === "list") setView(stored)
  }, [])

  const update = React.useCallback((v: ViewMode) => {
    setView(v)
    window.localStorage.setItem(VIEW_STORAGE_KEY, v)
  }, [])

  return [view, update]
}

export function AccountsList({ accounts }: { accounts: Account[] }) {
  const { data: transactions } = useGetTransactions()
  const txnTotals = txnTotalsByAccount(transactions ?? [])
  const totals = netWorthByCurrency(accounts, txnTotals)
  const rows = sortAccounts(accounts)
  const activeCount = accounts.filter((a) => !a.closedAt).length
  const [view, setView] = useAccountsView()

  return (
    <div className="flex flex-col gap-4 md:gap-6 ">
      <section className="rounded-xl border bg-card px-4 py-4 md:px-5 bg-olive-50 inset-shadow-xs">
        <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase ">
          Net worth
        </div>
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-6 gap-y-1 ">
          {totals.length === 0 ? (
            <span className="text-2xl font-semibold text-muted-foreground">—</span>
          ) : (
            totals.map(([code, amount]) => (
              <span key={code} className="flex items-baseline gap-1.5">
                <AnimatedMoney
                  amount={amount}
                  currency={code}
                  duration={0.17}
                  className="text-2xl font-semibold tabular-nums"
                />
                <span className="text-xs text-muted-foreground">{code}</span>
              </span>
            ))
          )}
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          {activeCount} {activeCount === 1 ? "account" : "accounts"}
        </div>
      </section>
    <div className="">
           <div className="flex items-center justify-between ">
        <h2 className="text-sm font-medium text-muted-foreground">All accounts</h2>
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(v) => v && setView(v as ViewMode)}
          variant="outline"
          size="sm"
          spacing={0}
        >
          <ToggleGroupItem value="list" aria-label="List view">
            <List />
          </ToggleGroupItem>
          <ToggleGroupItem value="grid" aria-label="Grid view">
            <LayoutGrid />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {view === "list" ? (
        <section className="divide-y overflow-hidden rounded-xl border bg-card ">
          {rows.map((account) => (
            <AccountRow
              key={account.id}
              account={account}
              balance={accountBalance(account, txnTotals)}
            />
          ))}
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 ">
          {rows.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              balance={accountBalance(account, txnTotals)}
            />
          ))}
        </section>
      )}
    </div>
 
    </div>
  )
}
