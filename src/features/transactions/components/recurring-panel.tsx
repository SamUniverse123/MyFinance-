import { Repeat } from "lucide-react";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "#/components/ui/empty";

/**
 * Placeholder for the Recurring tab (Q6). The schema already has
 * `scheduled_transactions` (recurring templates), but there's no UI yet — this is a
 * deliberate empty state rather than a blank panel so the tab doesn't read as broken.
 */
export function RecurringPanel() {
	return (
		<div className="flex flex-1 items-center justify-center py-16">
			<Empty>
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<Repeat strokeWidth={1.5} />
					</EmptyMedia>
					<EmptyTitle>Recurring transactions are coming soon</EmptyTitle>
					<EmptyDescription>
						Set up rent, salary, and subscriptions to post automatically on a
						schedule. This isn&apos;t available yet.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		</div>
	);
}
