import { queryOptions, useQuery } from "@tanstack/react-query";
import { accountsApi } from "./api";


export const accountKeys = {
  all:    ['accounts'] as const,
  list:   () => [...accountKeys.all, 'list', ] as const,
  detail: (id: string) => [...accountKeys.all, 'detail', id] as const,
}


export const accountsListOptions = () =>
    queryOptions({
            queryKey: accountKeys.list(),
            queryFn: async({ signal }) => accountsApi.list(signal)
        })


export const accountsDetailsOptions = (id: string) =>
    queryOptions({
            enabled: !!id,
            queryKey: accountKeys.detail(id),
            queryFn: async({ signal }) => accountsApi.get(id, signal)
        })


export function useGetAccounts(){
    return useQuery(accountsListOptions())
}

export function useGetAccount(id: string){
    return useQuery(accountsDetailsOptions(id))
}