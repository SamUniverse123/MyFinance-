import type { Transaction } from "../transactions/api";
import type { Account } from "./api";

/**
 * Single source of truth for "how much is in an account" on the client.
 *
 * An account's current balance is its opening balance plus every transaction
 * posted to it (no date filter — unlike the dashboard's *monthly* figures, a
 * balance is cumulative). The server computes net worth the same way in
 * `src/server/routes/dashboard.ts`; keep the two in step if the definition ever
 * grows (e.g. excluding pending transactions).
 */

/** Sum of transaction amounts per `accountId`, in minor units. */
export function txnTotalsByAccount(
	transactions: Transaction[],
): Map<string, number> {
	const totals = new Map<string, number>();
	for (const t of transactions) {
		totals.set(t.accountId, (totals.get(t.accountId) ?? 0) + t.amount);
	}
	return totals;
}

/** Opening balance + posted transactions for a single account. */
export function accountBalance(
	account: Account,
	totals: Map<string, number>,
): number {
	return account.initialBalance + (totals.get(account.id) ?? 0);
}
