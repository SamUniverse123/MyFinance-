import { createFileRoute } from '@tanstack/react-router'
import { CurrencyDollarIcon } from "@phosphor-icons/react"
import { TriangleAlert } from 'lucide-react'

import { SiteHeader } from "@/components/site-header"
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '#/components/ui/empty'
import { AddAccount } from '#/features/accounts/components/add-account'
import { AccountsList } from '#/features/accounts/components/accounts-list'
import { accountsListOptions, useGetAccounts } from '#/features/accounts/queries'

export const Route = createFileRoute('/_app/accounts/')({
  // Prefetched on the server so the list is in the cache before first paint.
  loader: ({ context }) => context.queryClient.ensureQueryData(accountsListOptions()),
  component: AccountsPage,
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
      <SiteHeader title="Accounts" actions={actions} />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
            {children}
          </div>
        </div>
      </div>
    </>
  )
}

function AccountsPage() {
  const { data: accounts, isPending, isError, refetch } = useGetAccounts()

  if (isPending) {
    return (
      <PageShell>
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </PageShell>
    )
  }

  if (isError) {
    return (
      <PageShell>
        <div className="flex flex-1 items-center justify-center py-10">
          <Empty>
            <EmptyHeader>
              <TriangleAlert className="size-16 text-muted-foreground" strokeWidth={1.25} />
              <EmptyTitle>Couldn&apos;t load your accounts</EmptyTitle>
              <EmptyDescription>
                Something went wrong reaching the server. Check your connection and try again.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="flex-row justify-center">
              <Button onClick={() => refetch()}>Try again</Button>
            </EmptyContent>
          </Empty>
        </div>
      </PageShell>
    )
  }

  if (accounts.length === 0) {
    return (
      <PageShell>
        <div className="flex flex-1 items-center justify-center py-10">
          <Empty>
            <EmptyHeader>
              <CurrencyDollarIcon size={80} color="#e1dfdfb1" weight="fill" />
              <EmptyTitle>No accounts yet</EmptyTitle>
              <EmptyDescription>
                Add your first account to start tracking balances and transactions.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="flex-row justify-center gap-2">
              <AddAccount />
            </EmptyContent>
          </Empty>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell actions={<AddAccount />}>
      <AccountsList accounts={accounts} />
    </PageShell>
  )
}
