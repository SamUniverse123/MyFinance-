import { Ellipsis } from "lucide-react";
import { currencyFlag } from "#/lib/currency";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { cn } from "@/lib/utils.ts";

const VISIBLE_LIMIT = 3;

/** Country flag for a currency, or a neutral chip for supranational/metal codes with none. */
function Flag({ code }: { code: string }) {
	const flag = currencyFlag(code);
	if (!flag) {
		return (
			<span
				aria-hidden
				className="inline-block size-full rounded-md bg-muted"
			></span>
		);
	}
	return (
		// `flag-icons` is imported unlayered (styles.css), so its rules beat Tailwind's
		// `@layer utilities` no matter the specificity — every override here needs `!`.
		// `.fi.fis` in particular pins `width: 1em`, which would otherwise squeeze the
		// flag into a narrow strip inside the button.
		<span
			aria-hidden
			className={cn(
				"fi size-full! rounded-md bg-cover! bg-center!",
				`fis fi-${flag}`,
			)}
		></span>
	);
}

function CircleButton({
	code,
	active,
	onClick,
}: {
	code: string;
	active: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={active}
			aria-label={code}
			title={code}
			className={cn(
				"flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md outline-none transition-all",
				"focus-visible:ring-3 focus-visible:ring-ring/50",
				active
					? "ring-2 ring-primary ring-offset-2 ring-offset-background"
					: "opacity-60 grayscale hover:opacity-100 hover:grayscale-0",
			)}
		>
			<Flag code={code} />
		</button>
	);
}

/**
 * Up to 3 currencies as square flag buttons (ADR-0009: currencies are a view
 * toggle, never converted/blended); a 4th+ collapses into an overflow dropdown.
 * `currencies` is expected pre-ordered (default/base currency first, then by
 * account count — see `orderCurrencies` in `server/routes/dashboard.ts`).
 * Renders nothing for single-currency users — there's nothing to toggle.
 */
export function CurrencyToggle({
	currencies,
	value,
	onChange,
}: {
	currencies: string[];
	value: string;
	onChange: (currency: string) => void;
}) {
	if (currencies.length <= 1) return null;

	const visible = currencies.slice(0, VISIBLE_LIMIT);
	const overflow = currencies.slice(VISIBLE_LIMIT);
	const activeInOverflow = overflow.includes(value);

	return (
		<div className="flex items-center gap-4">
			{visible.map((code) => (
				<CircleButton
					key={code}
					code={code}
					active={value === code}
					onClick={() => onChange(code)}
				/>
			))}
			{overflow.length > 0 && (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							aria-label={
								activeInOverflow
									? `${value} (more currencies)`
									: "More currencies"
							}
							className={cn(
								"flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border outline-none transition-all",
								"focus-visible:ring-3 focus-visible:ring-ring/50",
								activeInOverflow
									? "ring-2 ring-primary ring-offset-2 ring-offset-background"
									: "border-border text-muted-foreground hover:bg-accent",
							)}
						>
							{activeInOverflow ? (
								<Flag code={value} />
							) : (
								<Ellipsis className="size-4" />
							)}
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						{overflow.map((code) => (
							<DropdownMenuItem key={code} onSelect={() => onChange(code)}>
								<span className="flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-sm">
									<Flag code={code} />
								</span>
								{code}
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			)}
		</div>
	);
}
