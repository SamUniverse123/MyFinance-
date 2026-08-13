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
import { useDeleteTransaction } from "@/features/transactions/mutations"
import type { Transaction } from "@/features/transactions/api"

/** Delete-transaction button + confirm dialog. Navigates back to the list on success. */
export function DeleteTransaction({ transaction }: { transaction: Transaction }) {
  const navigate = useNavigate()
  const deleteTransaction = useDeleteTransaction()
  const [open, setOpen] = React.useState(false)

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) deleteTransaction.reset()
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
          <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the transaction and can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteTransaction.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleteTransaction.isPending}
            onClick={(e) => {
              e.preventDefault()
              deleteTransaction.mutate(transaction.id, {
                onSuccess: () => {
                  setOpen(false)
                  navigate({ to: "/transactions" })
                },
              })
            }}
          >
            {deleteTransaction.isPending ? <Spinner /> : "Delete transaction"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
