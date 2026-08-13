import * as React from "react"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button.tsx"
import { useGetAccounts } from "@/features/accounts/queries"
import { useCreateTransaction } from "@/features/transactions/mutations"
import {
  TransactionFormModal,
  toMinorUnits,
  todayISO,
} from "@/features/transactions/transaction-form"

/**
 * Add-transaction trigger + responsive modal. Optionally pre-selects `accountId`
 * (e.g. when launched from an account's page). Omit `children` for the default button.
 */
export function AddTransaction({
  accountId,
  children,
}: {
  accountId?: string
  children?: React.ReactNode
}) {
  const { data: accounts } = useGetAccounts()
  const createTransaction = useCreateTransaction()
  const list = accounts ?? []

  const trigger = children ?? (
    <Button>
      <Plus />
      Add transaction
    </Button>
  )

  return (
    <TransactionFormModal
      title="Add transaction"
      description="Record money moving in or out of an account."
      submitLabel="Add transaction"
      accounts={list}
      trigger={trigger}
      defaultValues={{
        accountId: accountId ?? list[0]?.id ?? "",
        direction: "expense",
        amount: "",
        date: todayISO(),
        payeeName: "",
        note: "",
        status: "cleared",
      }}
      onSubmit={async (v) => {
        const account = list.find((a) => a.id === v.accountId)
        if (!account) throw new Error("No account selected")
        const signed = toMinorUnits(v.amount) * (v.direction === "expense" ? -1 : 1)
        await createTransaction.mutateAsync({
          accountId: v.accountId,
          amount: signed,
          currency: account.currency,
          date: v.date,
          payeeName: v.payeeName.trim() || null,
          note: v.note.trim() || null,
          status: v.status,
        })
      }}
    />
  )
}
