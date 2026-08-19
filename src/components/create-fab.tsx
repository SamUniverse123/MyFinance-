import { ArrowLeftRight, Plus, Store, Tag, Wallet } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import * as React from "react";
import { toast } from "sonner";
import { AddAccount } from "#/features/accounts/components/add-account";
import { useGetAccounts } from "#/features/accounts/queries";
import { AddCategory } from "#/features/categories/components/add-category";
import { AddPayee } from "#/features/payees/components/add-payee";
import { AddTransaction } from "#/features/transactions/components/add-transaction";
import { cn } from "#/lib/utils.ts";

/** A fan-out speed-dial action pill. Composed as the trigger `children` of an Add*
 *  modal (Radix Slot merges this onClick with the modal's open handler), so tapping
 *  both opens the modal and collapses the dial. */
function FabItem({
	icon,
	label,
	onClick,
	disabled,
}: {
	icon: React.ReactNode;
	label: string;
	onClick?: () => void;
	disabled?: boolean;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className={cn(
				"flex w-44 items-center gap-3 rounded-full border bg-card px-4 py-2.5 text-sm font-medium shadow-lg transition-colors",
				disabled ? "text-muted-foreground" : "hover:bg-accent active:bg-accent",
			)}
		>
			<span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary [&_svg]:size-4">
				{icon}
			</span>
			{label}
		</button>
	);
}

/**
 * Mobile-only "+" speed-dial (Q3) mounted once in the app layout (Q4). It gathers the
 * three global create actions — Add transaction / Add account / Add category — into a
 * single bottom-center button, since their per-page header buttons are hidden on
 * mobile (Q5). Each item reuses the existing Add* modal (Q10). The items stay mounted
 * (only visually toggled) so an open modal survives the dial collapsing.
 */
export function CreateFab() {
	const [open, setOpen] = React.useState(false);
	const { data: accounts } = useGetAccounts();
	const hasAccounts = (accounts?.length ?? 0) > 0;
	const close = () => setOpen(false);

	// Bottom-up stagger: last item (closest to the +) animates first.
	const itemMotion = (index: number) => ({
		initial: false,
		animate: open
			? { opacity: 1, y: 0, scale: 1, pointerEvents: "auto" as const }
			: { opacity: 0, y: 12, scale: 0.9, pointerEvents: "none" as const },
		transition: { duration: 0.18, delay: open ? index * 0.04 : 0 },
	});

	return (
		<div className="md:hidden">
			<AnimatePresence>
				{open && (
					<motion.button
						type="button"
						aria-label="Close create menu"
						onClick={close}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="fixed inset-0 z-30 bg-black/25"
					/>
				)}
			</AnimatePresence>

			<div className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 z-40 flex -translate-x-1/2 flex-col items-center gap-3">
				<div className="flex flex-col items-stretch gap-2">
					{/* order top→bottom; stagger indices run bottom→top */}
					<motion.div {...itemMotion(3)}>
						{hasAccounts ? (
							<AddTransaction>
								<FabItem
									icon={<ArrowLeftRight />}
									label="Add transaction"
									onClick={close}
								/>
							</AddTransaction>
						) : (
							<FabItem
								icon={<ArrowLeftRight />}
								label="Add transaction"
								disabled
								onClick={() => {
									toast.info(
										"Add an account first, then record a transaction.",
									);
									close();
								}}
							/>
						)}
					</motion.div>

					<motion.div {...itemMotion(2)}>
						<AddAccount>
							<FabItem icon={<Wallet />} label="Add account" onClick={close} />
						</AddAccount>
					</motion.div>

					<motion.div {...itemMotion(1)}>
						{/* Global context → kind is selectable in the form, defaulting to Expense (Q11). */}
						<AddCategory kind="expense">
							<FabItem icon={<Tag />} label="Add category" onClick={close} />
						</AddCategory>
					</motion.div>

					<motion.div {...itemMotion(0)}>
						<AddPayee>
							<FabItem icon={<Store />} label="Add payee" onClick={close} />
						</AddPayee>
					</motion.div>
				</div>

				<button
					type="button"
					aria-label={open ? "Close create menu" : "Create"}
					aria-expanded={open}
					onClick={() => setOpen((o) => !o)}
					className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl ring-1 ring-black/5 transition-transform active:scale-95"
				>
					<motion.span
						animate={{ rotate: open ? 45 : 0 }}
						transition={{ duration: 0.18 }}
						className="flex [&_svg]:size-6"
					>
						<Plus />
					</motion.span>
				</button>
			</div>
		</div>
	);
}
