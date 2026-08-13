import * as React from "react"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button.tsx"
import { getAccountTypeMeta } from "@/features/accounts/account-types"
import { useCreateAccount } from "@/features/accounts/mutations"
import { AccountFormModal, toMinorUnits } from "@/features/accounts/account-form"

/**
 * Add-account trigger + responsive modal. Pass your own trigger via `children`, or
 * omit it for the default "Add account" button.
 */
export function AddAccount({ children }: { children?: React.ReactNode }) {
  const createAccount = useCreateAccount()

  const trigger = children ?? (
    <Button>
      <Plus />
      Add account
    </Button>
  )

  return (
    <AccountFormModal
      title="Add account"
      description="Track a new balance. You can adjust the details anytime."
      submitLabel="Add account"
      trigger={trigger}
      defaultValues={{ name: "", type: "checking", currency: "USD", initialBalance: "" }}
      onSubmit={async (v) => {
        const meta = getAccountTypeMeta(v.type)
        await createAccount.mutateAsync({
          name: v.name.trim(),
          type: v.type,
          currency: v.currency,
          initialBalance: toMinorUnits(v.initialBalance),
          color: meta.color,
          icon: v.type,
        })
      }}
    />
  )
}
