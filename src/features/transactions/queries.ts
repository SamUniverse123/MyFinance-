import { queryOptions, useQuery } from "@tanstack/react-query"
import { transactionsApi } from "./api"

export const transactionKeys = {
  all: ['transactions'] as const,
  list: () => [...transactionKeys.all, 'list'] as const,
  detail: (id: string) => [...transactionKeys.all, 'detail', id] as const,
}

export const transactionsListOptions = () =>
  queryOptions({
    queryKey: transactionKeys.list(),
    queryFn: async ({ signal }) => transactionsApi.list(signal),
  })

export const transactionDetailOptions = (id: string) =>
  queryOptions({
    enabled: !!id,
    queryKey: transactionKeys.detail(id),
    queryFn: async ({ signal }) => transactionsApi.get(id, signal),
  })

export function useGetTransactions() {
  return useQuery(transactionsListOptions())
}

export function useGetTransaction(id: string) {
  return useQuery(transactionDetailOptions(id))
}
