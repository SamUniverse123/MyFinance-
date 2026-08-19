import { Store, TriangleAlert } from "lucide-react";
import { Button } from "#/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "#/components/ui/empty";
import { Skeleton } from "#/components/ui/skeleton";
import { AddPayee } from "#/features/payees/components/add-payee";
import { PayeesTable } from "#/features/payees/components/payees-table";
import { useGetPayees } from "#/features/payees/queries";

/** The Payees tab's body — the management list (Q15) with its own loading / error /
 *  empty states, so switching to this tab never blanks the surrounding tab bar. */
export function PayeesPanel() {
	const { data: payees, isPending, isError, refetch } = useGetPayees();

	if (isPending) {
		return <Skeleton className="h-64 w-full rounded-xl" />;
	}

	if (isError) {
		return (
			<div className="flex flex-1 items-center justify-center py-10">
				<Empty>
					<EmptyHeader>
						<TriangleAlert
							className="size-16 text-muted-foreground"
							strokeWidth={1.25}
						/>
						<EmptyTitle>Couldn&apos;t load your payees</EmptyTitle>
						<EmptyDescription>
							Something went wrong reaching the server. Check your connection
							and try again.
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent className="flex-row justify-center">
						<Button onClick={() => refetch()}>Try again</Button>
					</EmptyContent>
				</Empty>
			</div>
		);
	}

	if (payees.length === 0) {
		return (
			<div className="flex flex-1 items-center justify-center py-10">
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<Store strokeWidth={1.5} />
						</EmptyMedia>
						<EmptyTitle>No payees yet</EmptyTitle>
						<EmptyDescription>
							Payees appear here as you link them to transactions, or add one
							directly.
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent className="flex-row justify-center">
						<AddPayee />
					</EmptyContent>
				</Empty>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3">
			<PayeesTable payees={payees} />
			{/* logo.dev free-tier attribution (ADR-0014). */}
			<p className="text-right text-xs text-muted-foreground">
				Logos provided by{" "}
				<a
					href="https://logo.dev"
					target="_blank"
					rel="noopener noreferrer"
					className="underline underline-offset-2 hover:text-foreground"
				>
					Logo.dev
				</a>
			</p>
		</div>
	);
}
