import type { ErrorComponentProps } from "@tanstack/react-router";
import { useRouter } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import { Button } from "#/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "#/components/ui/empty";

/**
 * The router's `defaultErrorComponent`: the last-resort fallback for errors that
 * escape a route's `beforeLoad`/`loader` (e.g. the root session fetch failing when
 * the database is unreachable) and would otherwise render TanStack Router's raw
 * "Something went wrong! / Internal server error" screen.
 *
 * Per-page data failures don't reach here — those loaders are best-effort
 * (`prefetch`) and each page renders its own graceful `isError` state. This is the
 * net for the beforeLoad-level failures a page component never gets to handle.
 */
export function RouteError({ reset }: ErrorComponentProps) {
	const router = useRouter();

	return (
		<div className="flex min-h-svh flex-1 items-center justify-center p-6">
			<Empty>
				<EmptyHeader>
					<TriangleAlert
						className="size-16 text-muted-foreground"
						strokeWidth={1.25}
					/>
					<EmptyTitle>Something went wrong</EmptyTitle>
					<EmptyDescription>
						We couldn&apos;t reach the server. Check your connection and try
						again.
					</EmptyDescription>
				</EmptyHeader>
				<EmptyContent className="flex-row justify-center">
					<Button
						onClick={() => {
							reset();
							router.invalidate();
						}}
					>
						Try again
					</Button>
				</EmptyContent>
			</Empty>
		</div>
	);
}
