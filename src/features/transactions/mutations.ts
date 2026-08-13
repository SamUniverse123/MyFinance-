import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import type {
  Transaction,
  CreateTransactionInput,
  UpdateTransactionInput,
} from "./api"
import { transactionsApi } from "./api"
import { transactionKeys } from "./queries"
import type { HttpError } from "../shared/http"

export function useCreateTransaction() {
  const queryClient = useQueryClient()
  return useMutation<Transaction, HttpError, CreateTransactionInput>({
    mutationFn: (json) => transactionsApi.create(json),
    onSuccess: () => {
      toast.success("Transaction added")
      return queryClient.invalidateQueries({ queryKey: transactionKeys.all })
    },
    onError: (err) =>
      toast.error(err.status < 500 ? err.message : "Failed to add transaction"),
  })
}

export function useUpdateTransaction(id: string) {
  const queryClient = useQueryClient()
  return useMutation<Transaction, HttpError, UpdateTransactionInput>({
    mutationFn: (json) => transactionsApi.update(id, json),
    onSuccess: () => {
      toast.success("Transaction updated")
      return queryClient.invalidateQueries({ queryKey: transactionKeys.all })
    },
    onError: (err) =>
      toast.error(err.status < 500 ? err.message : "Failed to update transaction"),
  })
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient()
  return useMutation<void, HttpError, string>({
    mutationFn: (id) => transactionsApi.remove(id),
    onSuccess: (_void, id) => {
      toast.success("Transaction deleted")
      queryClient.removeQueries({ queryKey: transactionKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: transactionKeys.all })
    },
    onError: (err) =>
      toast.error(err.status < 500 ? err.message : "Failed to delete transaction"),
  })
}
