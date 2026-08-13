import type {Account, CreateAccountInput, UpdateAccountInput} from "@/features/accounts/api.ts"
import { accountsApi } from "@/features/accounts/api.ts";
import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { accountKeys } from "./queries";
import { toast } from "sonner";
import type { HttpError } from "../shared/http";

type UpdateAccountContext = {
  previousDetail: Account | undefined
  previousLists: [QueryKey, Account[] | undefined][]
}

export function useCreateAccount(){
    const queryClient = useQueryClient();
    const mutation = useMutation<
    Account,
    HttpError,
    CreateAccountInput
  >({
    mutationFn: (json) => accountsApi.create(json),
    onSuccess: (account) => {
      toast.success(`Account "${account.name}" created`);
      return queryClient.invalidateQueries({ queryKey: accountKeys.all });
    },
    onError: (err) => {
      toast.error(err.status < 500 ? err.message : "Failed to create account")
    },
  });

  return mutation;
}


export function useUpdateAccount(id: string) {
  const queryClient = useQueryClient()
  const listFilter = { queryKey: [...accountKeys.all, 'list'] } as const

  return useMutation<Account, HttpError, UpdateAccountInput, UpdateAccountContext>({
    mutationFn: (json) => accountsApi.update(id, json),

    onMutate: async (patch) => {
      // stop in-flight fetches for BOTH caches that show this row
      await Promise.all([
        queryClient.cancelQueries({ queryKey: accountKeys.detail(id) }),
        queryClient.cancelQueries(listFilter),
      ])

      const previousDetail = queryClient.getQueryData<Account>(accountKeys.detail(id))
      const previousLists = queryClient.getQueriesData<Account[]>(listFilter)

      queryClient.setQueryData<Account>(accountKeys.detail(id), (old) =>
        old && { ...old, ...patch },
      )
      queryClient.setQueriesData<Account[]>(listFilter, (old) =>
        old?.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      )

      return { previousDetail, previousLists }
    },

    onError: (err, _patch, ctx) => {
      if (ctx?.previousDetail) queryClient.setQueryData(accountKeys.detail(id), ctx.previousDetail)
      ctx?.previousLists?.forEach(([key, data]) => queryClient.setQueryData(key, data))
      toast.error(err.status < 500 ? err.message : "Failed to update account")
    },

    onSuccess: (account) => {
      toast.success(`Account "${account.name}" updated`)
    },

    // runs on success and error → the single source of truth reconciliation
    onSettled: () => queryClient.invalidateQueries({ queryKey: accountKeys.all }),
  })
}


export function useDeleteAccount() {
  const queryClient = useQueryClient()

  // variables = the id, so ONE hook instance can delete any row from a list
  // (mutate(id)) — unlike useUpdateAccount, which binds a single id in closure.
  return useMutation<void, HttpError, string>({
    mutationFn: (id) => accountsApi.remove(id),

    // NOT optimistic. Delete can legitimately be refused (409, see below), so we
    // wait for the server's answer before touching the cache — §4.4: "close and
    // delete show the server's answer". Yanking the row then restoring it on a
    // routine 409 would flicker the list for an outcome that isn't an error.
    onSuccess: (_void, id) => {
      toast.success("Account deleted")
      queryClient.removeQueries({ queryKey: accountKeys.detail(id) }) // drop the now-dead detail entry
      queryClient.invalidateQueries({ queryKey: accountKeys.all })    // refetch every list/summary
    },

    onError: (err) => {
      // 409 conflict = "account still has transactions" (invariant #7). This is an
      // EXPECTED branch, not a failure to bury in a toast: the confirm dialog reads
      // err.detail.transactionCount and offers "Close instead" / "Delete N txns too".
      // Returning here leaves it on mutation.error for the dialog to act on.
      if (err.status === 409) return
      toast.error(err.status < 500 ? err.message : "Failed to delete account")
    },
  })
}