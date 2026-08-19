import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	MouseSensor,
	TouchSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
	arrayMove,
	SortableContext,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button.tsx";
import type { Category } from "@/features/categories/api";
import { getCategoryIconMeta } from "@/features/categories/category-visuals";
import { AddCategory } from "@/features/categories/components/add-category";
import { DeleteCategory } from "@/features/categories/components/delete-category";
import { EditCategory } from "@/features/categories/components/edit-category";
import { useReorderCategories } from "@/features/categories/mutations";
import { buildCategoryTree } from "@/features/categories/tree";
import { cn } from "@/lib/utils.ts";

/** Drag-reorders a flat list of ids, same dnd-kit sensor/context pattern as `data-table.tsx`. */
function SortableGroup({
	ids,
	onReorder,
	children,
}: {
	ids: string[];
	onReorder: (ids: string[]) => void;
	children: React.ReactNode;
}) {
	const sensors = useSensors(
		useSensor(MouseSensor, {}),
		useSensor(TouchSensor, {}),
		useSensor(KeyboardSensor, {}),
	);

	function handleDragEnd(event: DragEndEvent) {
		const { active, over } = event;
		if (active && over && active.id !== over.id) {
			const oldIndex = ids.indexOf(String(active.id));
			const newIndex = ids.indexOf(String(over.id));
			onReorder(arrayMove(ids, oldIndex, newIndex));
		}
	}

	return (
		<DndContext
			collisionDetection={closestCenter}
			modifiers={[restrictToVerticalAxis]}
			onDragEnd={handleDragEnd}
			sensors={sensors}
		>
			<SortableContext items={ids} strategy={verticalListSortingStrategy}>
				<div className="flex flex-col gap-2">{children}</div>
			</SortableContext>
		</DndContext>
	);
}

function CategoryRow({
	category,
	indent,
	showAddSubcategory,
}: {
	category: Category;
	indent?: boolean;
	showAddSubcategory?: boolean;
}) {
	const meta = getCategoryIconMeta(category.icon);
	const Icon = meta.icon;
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({
		id: category.id,
	});
	const style = { transform: CSS.Transform.toString(transform), transition };
	const color = category.color;

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={cn(
				"flex items-center gap-2 rounded-lg border bg-card px-2 py-2 transition-colors",
				indent && "ml-8",
				isDragging && "z-10 opacity-60",
			)}
		>
			<Button
				{...attributes}
				{...listeners}
				type="button"
				variant="ghost"
				size="icon"
				className="size-7 shrink-0 cursor-grab touch-none text-muted-foreground hover:bg-transparent"
			>
				<GripVertical className="size-3.5" />
				<span className="sr-only">Drag to reorder</span>
			</Button>

			<span
				className="flex size-8 shrink-0 items-center justify-center rounded-md"
				style={{
					color: color ?? undefined,
					backgroundColor: color ? `${color}1f` : undefined,
				}}
			>
				<Icon className="size-4" />
			</span>

			<span className="min-w-0 flex-1 truncate text-sm font-medium">
				{category.name}
			</span>

			{category.isSystem && (
				<span className="shrink-0 rounded-full border px-1.5 py-px text-[0.65rem] text-muted-foreground">
					System
				</span>
			)}

			<div className="flex shrink-0 items-center gap-1">
				{showAddSubcategory && (
					<AddCategory kind={category.kind} parent={category}>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="size-7"
							aria-label="Add subcategory"
						>
							<Plus className="size-3.5" />
						</Button>
					</AddCategory>
				)}
				<EditCategory category={category}>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="size-7"
						aria-label="Edit category"
					>
						<Pencil className="size-3.5" />
					</Button>
				</EditCategory>
				{!category.isSystem && (
					<DeleteCategory category={category}>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="size-7 text-destructive hover:text-destructive"
							aria-label="Delete category"
						>
							<Trash2 className="size-3.5" />
						</Button>
					</DeleteCategory>
				)}
			</div>
		</div>
	);
}

/** One kind's section (Q12): a top-level list, each row optionally expanded with
 *  its own sortable list of subcategories (Q13, both levels drag-reorderable). */
export function CategorySection({
	kind,
	categories,
}: {
	kind: Category["kind"];
	categories: Category[];
}) {
	const tree = React.useMemo(
		() => buildCategoryTree(categories, kind),
		[categories, kind],
	);
	const reorder = useReorderCategories();

	const topIds = tree.map((t) => t.id);

	return (
		<section className="flex flex-col gap-3">
			<div className="flex items-center justify-between">
				<h2 className="text-sm font-medium text-muted-foreground capitalize">
					{kind} categories
				</h2>
				{/* Hidden on mobile — the create FAB owns top-level "add category" there
				    (Q5/Q14). Per-row "Add subcategory" below stays on every screen. */}
				<div className="hidden md:flex">
					<AddCategory kind={kind} />
				</div>
			</div>

			{tree.length === 0 ? (
				<p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
					No {kind} categories yet.
				</p>
			) : (
				<SortableGroup
					ids={topIds}
					onReorder={(ids) =>
						reorder.mutate(ids.map((id, sortOrder) => ({ id, sortOrder })))
					}
				>
					{tree.map((node) => (
						<div key={node.id} className="flex flex-col gap-2">
							<CategoryRow category={node} showAddSubcategory />
							{node.children.length > 0 && (
								<SortableGroup
									ids={node.children.map((c) => c.id)}
									onReorder={(ids) =>
										reorder.mutate(
											ids.map((id, sortOrder) => ({ id, sortOrder })),
										)
									}
								>
									{node.children.map((child) => (
										<CategoryRow key={child.id} category={child} indent />
									))}
								</SortableGroup>
							)}
						</div>
					))}
				</SortableGroup>
			)}
		</section>
	);
}
