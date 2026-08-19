import type { Payee } from "./api";

/**
 * A transaction's payee display name: the linked payee's current name when
 * `payeeId` is set (kept fresh through renames), otherwise the raw `payeeName`
 * string (transactions.md §2.5). Returns null when neither is present.
 */
export function payeeDisplayName(
	txn: { payeeId: string | null; payeeName: string | null },
	payeesById: Map<string, Pick<Payee, "name">>,
): string | null {
	if (txn.payeeId) {
		return payeesById.get(txn.payeeId)?.name ?? txn.payeeName ?? null;
	}
	return txn.payeeName ?? null;
}

/** Build the id→payee lookup the resolver needs. */
export function payeesById(payees: Payee[]): Map<string, Payee> {
	return new Map(payees.map((p) => [p.id, p]));
}

/**
 * A transaction's payee identity for `PayeeAvatar` — display name plus the linked
 * payee's `domain` (null for raw/unlinked payees, which fall back to a name-based
 * logo then initials). Returns null when the transaction has no payee at all.
 */
export function payeeIdentity(
	txn: { payeeId: string | null; payeeName: string | null },
	byId: Map<string, Payee>,
): { name: string; domain: string | null } | null {
	const name = payeeDisplayName(txn, byId);
	if (!name) return null;
	const domain = txn.payeeId ? (byId.get(txn.payeeId)?.domain ?? null) : null;
	return { name, domain };
}
