import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Payees moved from its own route into a tab on /transactions (ADR-0013). This
 * redirect keeps the URL we shipped last session — and any bookmark to it — working.
 */
export const Route = createFileRoute("/_app/transactions/payees")({
	beforeLoad: () => {
		throw redirect({ to: "/transactions", search: { tab: "payees" } });
	},
});
