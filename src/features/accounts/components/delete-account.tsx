import * as React from "react"
import { useNavigate } from "@tanstack/react-router"
import { Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button.tsx"
import { Spinner } from "@/components/ui/spinner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog.tsx"
import { useDeleteAccount } from "@/features/accounts/mutations"
import type { Account } from "@/features/accounts/api"

/**
 * Delete-account button + confirm dialog. On success it navigates back to the list.
 * A 409 ("account still has transactions") is shown inline rather than as an error,
 * keeping the dialog open so the user understands why it was refused.
 */
export function DeleteAccount({ account }: { account: Account }) {
  const navigate = useNavigate()
  const deleteAccount = useDeleteAccount()
  const [open, setOpen] = React.useState(false)

  const hasTransactions = deleteAccount.error?.status === 409

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) deleteAccount.reset()
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{account.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the account and can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {hasTransactions && (
          <p className="text-sm text-destructive">
            This account still has transactions, so it can't be deleted yet. Remove or reassign
            them first.
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteAccount.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleteAccount.isPending}
            onClick={(e) => {
              e.preventDefault() // wait for the server's answer before closing
              deleteAccount.mutate(account.id, {
                onSuccess: () => {
                  setOpen(false)
                  navigate({ to: "/accounts" })
                },
              })
            }}
          >
            {deleteAccount.isPending ? <Spinner /> : "Delete account"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
