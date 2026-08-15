import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { accounts, userSettings } from "@/db/schema";
import { inferBaseCurrency, orderCurrencies } from "@/lib/currency";

export interface CurrencyScope {
	/** The currency every figure on the page is scoped to (ADR-0009). */
	currency: string;
	/** Toggle options, base/default first (empty when the user has no open accounts). */
	availableCurrencies: string[];
	/** Where the toggle starts when `?currency=` is absent/unknown. */
	defaultCurrency: string;
}

/**
 * Resolves the selected currency for a per-currency page (dashboard, budgets, …).
 *
 * Same rules the dashboard endpoint applies inline: default currency is the explicit
 * `userSettings.baseCurrency` when present, else the user's most-common open-account
 * currency; an unknown or omitted `?currency=` falls back to that default rather than
 * erroring. Currencies are never blended (ADR-0006/0009).
 */
export async function resolveCurrencyScope(
	userId: string,
	requestedCurrency: string | undefined,
): Promise<CurrencyScope> {
	const [settings] = await db
		.select()
		.from(userSettings)
		.where(eq(userSettings.userId, userId));

	const openAccounts = await db
		.select({ currency: accounts.currency })
		.from(accounts)
		.where(and(eq(accounts.userId, userId), isNull(accounts.closedAt)));

	const counts = new Map<string, number>();
	for (const a of openAccounts) {
		counts.set(a.currency, (counts.get(a.currency) ?? 0) + 1);
	}

	const defaultCurrency = settings?.baseCurrency ?? inferBaseCurrency(counts);
	const availableCurrencies = orderCurrencies(counts, defaultCurrency);

	const requestedUpper = requestedCurrency?.toUpperCase();
	const currency =
		requestedUpper && availableCurrencies.includes(requestedUpper)
			? requestedUpper
			: defaultCurrency;

	return { currency, availableCurrencies, defaultCurrency };
}
