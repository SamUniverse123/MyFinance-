import { createFileRoute } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import { Button } from "#/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "#/components/ui/empty";
import { Skeleton } from "#/components/ui/skeleton";
import { CategorySection } from "#/features/categories/components/category-tree";
import {
	categoriesListOptions,
	useGetCategories,
} from "#/features/categories/queries";
import { SiteHeader } from "@/components/site-header";

export const Route = createFileRoute("/_app/categories/")({
	loader: ({ context }) =>
		context.queryClient.ensureQueryData(categoriesListOptions()),
	component: CategoriesPage,
});

function PageShell({ children }: { children: React.ReactNode }) {
	return (
		<>
			<SiteHeader title="Categories" />
			<div className="flex flex-1 flex-col">
				<div className="@container/main flex flex-1 flex-col">
					<div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-6">
						{children}
					</div>
				</div>
			</div>
		</>
	);
}

function CategoriesPage() {
	const { data: categories, isPending, isError, refetch } = useGetCategories();

	if (isPending) {
		return (
			<PageShell>
				<Skeleton className="h-48 w-full rounded-xl" />
				<Skeleton className="h-48 w-full rounded-xl" />
			</PageShell>
		);
	}

	if (isError) {
		return (
			<PageShell>
				<div className="flex flex-1 items-center justify-center py-10">
					<Empty>
						<EmptyHeader>
							<TriangleAlert
								className="size-16 text-muted-foreground"
								strokeWidth={1.25}
							/>
							<EmptyTitle>Couldn&apos;t load your categories</EmptyTitle>
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
			</PageShell>
		);
	}

	return (
		<PageShell>
			<CategorySection kind="expense" categories={categories} />
			<CategorySection kind="income" categories={categories} />
		</PageShell>
	);
}
