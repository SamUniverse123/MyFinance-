import {
	Baby,
	Banknote,
	Book,
	Briefcase,
	Bus,
	Car,
	Coffee,
	CreditCard,
	Dumbbell,
	Film,
	Fuel,
	Gift,
	GraduationCap,
	HeartPulse,
	Home,
	type LucideIcon,
	Music,
	PawPrint,
	PiggyBank,
	Plane,
	Receipt,
	Shapes,
	Shirt,
	ShoppingCart,
	Smartphone,
	TrendingUp,
	Utensils,
	Wallet,
	Wifi,
	Zap,
} from "lucide-react";

/**
 * The curated categorical palette from the `dataviz` skill (docs/adr/0002... —
 * see Q14/ADR discussion): 8 hues validated for CVD-safe adjacent contrast. Stored
 * as a flat hex on `categories.color`, same convention as `account-types.tsx`.
 * These will double as chart-series colors once category-based reports exist, so
 * don't add ad hoc hues here — extend the source palette instead.
 */
export type CategoryColorSwatch = { name: string; value: string };

export const CATEGORY_COLORS: CategoryColorSwatch[] = [
	{ name: "Blue", value: "#2a78d6" },
	{ name: "Orange", value: "#eb6834" },
	{ name: "Aqua", value: "#1baf7a" },
	{ name: "Yellow", value: "#eda100" },
	{ name: "Magenta", value: "#e87ba4" },
	{ name: "Green", value: "#008300" },
	{ name: "Violet", value: "#4a3aa7" },
	{ name: "Red", value: "#e34948" },
];

export const DEFAULT_CATEGORY_COLOR = CATEGORY_COLORS[0].value;

/** Curated icon set for category chips/pickers. Stored as a string key on `categories.icon`. */
export type CategoryIconValue =
	| "shopping-cart"
	| "home"
	| "car"
	| "utensils"
	| "heart-pulse"
	| "film"
	| "plane"
	| "graduation-cap"
	| "gift"
	| "briefcase"
	| "wifi"
	| "zap"
	| "dumbbell"
	| "baby"
	| "paw-print"
	| "shirt"
	| "coffee"
	| "wallet"
	| "trending-up"
	| "banknote"
	| "piggy-bank"
	| "credit-card"
	| "receipt"
	| "fuel"
	| "bus"
	| "smartphone"
	| "music"
	| "book";

export type CategoryIconMeta = {
	value: CategoryIconValue;
	label: string;
	icon: LucideIcon;
};

export const CATEGORY_ICONS: CategoryIconMeta[] = [
	{ value: "shopping-cart", label: "Shopping", icon: ShoppingCart },
	{ value: "home", label: "Home", icon: Home },
	{ value: "car", label: "Car", icon: Car },
	{ value: "utensils", label: "Food", icon: Utensils },
	{ value: "coffee", label: "Coffee", icon: Coffee },
	{ value: "heart-pulse", label: "Health", icon: HeartPulse },
	{ value: "dumbbell", label: "Fitness", icon: Dumbbell },
	{ value: "film", label: "Entertainment", icon: Film },
	{ value: "music", label: "Music", icon: Music },
	{ value: "plane", label: "Travel", icon: Plane },
	{ value: "fuel", label: "Fuel", icon: Fuel },
	{ value: "bus", label: "Transit", icon: Bus },
	{ value: "graduation-cap", label: "Education", icon: GraduationCap },
	{ value: "book", label: "Books", icon: Book },
	{ value: "gift", label: "Gifts", icon: Gift },
	{ value: "briefcase", label: "Work", icon: Briefcase },
	{ value: "wifi", label: "Internet", icon: Wifi },
	{ value: "zap", label: "Utilities", icon: Zap },
	{ value: "smartphone", label: "Phone", icon: Smartphone },
	{ value: "shirt", label: "Clothing", icon: Shirt },
	{ value: "baby", label: "Kids", icon: Baby },
	{ value: "paw-print", label: "Pets", icon: PawPrint },
	{ value: "wallet", label: "Wallet", icon: Wallet },
	{ value: "banknote", label: "Cash", icon: Banknote },
	{ value: "piggy-bank", label: "Savings", icon: PiggyBank },
	{ value: "credit-card", label: "Credit card", icon: CreditCard },
	{ value: "receipt", label: "Bills", icon: Receipt },
	{ value: "trending-up", label: "Income", icon: TrendingUp },
];

const ICON_BY_VALUE = new Map(CATEGORY_ICONS.map((i) => [i.value, i]));

const FALLBACK_ICON: Omit<CategoryIconMeta, "value"> = {
	label: "Other",
	icon: Shapes,
};

/** Look up an icon's component/label; falls back to a generic shape for unknown/null values. */
export function getCategoryIconMeta(
	value: string | null | undefined,
): Omit<CategoryIconMeta, "value"> {
	return (
		(value ? ICON_BY_VALUE.get(value as CategoryIconValue) : undefined) ??
		FALLBACK_ICON
	);
}

/** Resolve a persisted color, falling back to the palette's first slot. */
export function getCategoryColor(value: string | null | undefined): string {
	return value ?? DEFAULT_CATEGORY_COLOR;
}
