import { createFileRoute } from '@tanstack/react-router'
import { ArrowLeftRight, TriangleAlert } from 'lucide-react'

import { SiteHeader } from '@/components/site-header'
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '#/components/ui/empty'
import { AddAccount } from '#/features/accounts/components/add-account'
import { accountsListOptions, useGetAccounts } from '#/features/accounts/queries'
import { AddTransaction } from '#/features/transactions/components/add-transaction'
import { TransactionsList } from '#/features/transactions/components/transactions-list'
import {
  transactionsListOptions,
  useGetTransactions,
} from '#/features/transactions/queries'

export const Route = createFileRoute('/_app/transactions/')({
  // Prefetch both on the server: the list needs account data to render each row.
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(transactionsListOptions()),
      context.queryClient.ensureQueryData(accountsListOptions()),
    ]),
  component: TransactionsPage,
})

function PageShell({
  actions,
  children,
}: {
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <>
      <SiteHeader title="Transactions" actions={actions} />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">{children}</div>
        </div>
      </div>
    </>
  )
}

function TransactionsPage() {
  const transactionsQuery = useGetTransactions()
  const accountsQuery = useGetAccounts()

  if (transactionsQuery.isPending || accountsQuery.isPending) {
    return (
      <PageShell>
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </PageShell>
    )
  }

  if (transactionsQuery.isError) {
    return (
      <PageShell>
        <div className="flex flex-1 items-center justify-center py-10">
          <Empty>
            <EmptyHeader>
              <TriangleAlert className="size-16 text-muted-foreground" strokeWidth={1.25} />
              <EmptyTitle>Couldn&apos;t load your transactions</EmptyTitle>
              <EmptyDescription>
                Something went wrong reaching the server. Check your connection and try again.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="flex-row justify-center">
              <Button onClick={() => transactionsQuery.refetch()}>Try again</Button>
            </EmptyContent>
          </Empty>
        </div>
      </PageShell>
    )
  }

  const transactions = transactionsQuery.data
  const accounts = accountsQuery.data ?? []

  if (transactions.length === 0) {
    // No account yet → nudge account creation first, since a transaction needs one.
    const noAccounts = accounts.length === 0
    return (
      <PageShell>
        <div className="flex flex-1 items-center justify-center py-10">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ArrowLeftRight strokeWidth={1.5} />
              </EmptyMedia>
              <EmptyTitle>No transactions yet</EmptyTitle>
              <EmptyDescription>
                {noAccounts
                  ? 'Add an account first, then your transactions will show up here.'
                  : 'Once you record money moving in or out, it will appear here.'}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="flex-row justify-center">
              {noAccounts ? <AddAccount /> : <AddTransaction />}
            </EmptyContent>
          </Empty>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell actions={<AddTransaction />}>
      <TransactionsList transactions={transactions} accounts={accounts} />
    </PageShell>
  )
}
