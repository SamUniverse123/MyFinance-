import * as React from "react"

import {
  getAccountTypeMeta,
  type AccountTypeValue,
} from "@/features/accounts/account-types"
import { useUpdateAccount } from "@/features/accounts/mutations"
import {
  AccountFormModal,
  fromMinorUnits,
  toMinorUnits,
} from "@/features/accounts/account-form"
import type { Account } from "@/features/accounts/api"

/**
 * Edit-account trigger + responsive modal, prefilled from `account`. Currency is
 * locked (the server rejects currency changes), but name, type and opening balance
 * are editable. Supply the trigger via `children`.
 */
export function EditAccount({
  account,
  children,
}: {
  account: Account
  children: React.ReactNode
}) {
  const updateAccount = useUpdateAccount(account.id)

  return (
    <AccountFormModal
      title="Edit account"
      description="Update this account's details."
      submitLabel="Save changes"
      currencyEditable={false}
      trigger={children}
      defaultValues={{
        name: account.name,
        type: account.type as AccountTypeValue,
        currency: account.currency,
        initialBalance: fromMinorUnits(account.initialBalance),
      }}
      onSubmit={async (v) => {
        const meta = getAccountTypeMeta(v.type)
        await updateAccount.mutateAsync({
          name: v.name.trim(),
          type: v.type,
          initialBalance: toMinorUnits(v.initialBalance),
          color: meta.color,
          icon: v.type,
        })
      }}
    />
  )
}
