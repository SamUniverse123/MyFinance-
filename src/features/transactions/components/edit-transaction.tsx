import * as React from "react"

import { useGetAccounts } from "@/features/accounts/queries"
import { useUpdateTransaction } from "@/features/transactions/mutations"
import {
  TransactionFormModal,
  magnitudeText,
  toMinorUnits,
  type TxnStatus,
} from "@/features/transactions/transaction-form"
import type { Transaction } from "@/features/transactions/api"

/**
 * Edit-transaction trigger + responsive modal, prefilled from `transaction`.
 * Supply the trigger via `children`.
 */
export function EditTransaction({
  transaction,
  children,
}: {
  transaction: Transaction
  children: React.ReactNode
}) {
  const { data: accounts } = useGetAccounts()
  const updateTransaction = useUpdateTransaction(transaction.id)
  const list = accounts ?? []

  return (
    <TransactionFormModal
      title="Edit transaction"
      description="Update this transaction's details."
      submitLabel="Save changes"
      accounts={list}
      trigger={children}
      defaultValues={{
        accountId: transaction.accountId,
        direction: transaction.amount < 0 ? "expense" : "income",
        amount: magnitudeText(transaction.amount),
        date: transaction.date,
        payeeName: transaction.payeeName ?? "",
        note: transaction.note ?? "",
        status: transaction.status as TxnStatus,
      }}
      onSubmit={async (v) => {
        const account = list.find((a) => a.id === v.accountId)
        const signed = toMinorUnits(v.amount) * (v.direction === "expense" ? -1 : 1)
        await updateTransaction.mutateAsync({
          accountId: v.accountId,
          amount: signed,
          currency: account?.currency ?? transaction.currency,
          date: v.date,
          payeeName: v.payeeName.trim() || null,
          note: v.note.trim() || null,
          status: v.status,
        })
      }}
    />
  )
}
