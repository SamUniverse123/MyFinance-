import {
	Award,
	Baby,
	Banknote,
	Beer,
	Bike,
	Bitcoin,
	Book,
	Briefcase,
	Bus,
	Cake,
	Calculator,
	Car,
	CircleDollarSign,
	Coffee,
	Coins,
	CreditCard,
	Droplet,
	Dumbbell,
	Film,
	Flame,
	Footprints,
	Fuel,
	Gamepad2,
	Gem,
	Gift,
	Glasses,
	GraduationCap,
	HandCoins,
	HeartHandshake,
	HeartPulse,
	Home,
	Hotel,
	KeyRound,
	Landmark,
	Laptop,
	Lightbulb,
	type LucideIcon,
	Luggage,
	Music,
	Newspaper,
	PawPrint,
	PiggyBank,
	Pill,
	Pizza,
	Plane,
	Receipt,
	RotateCcw,
	Scissors,
	Shapes,
	ShieldCheck,
	Shirt,
	ShoppingBag,
	ShoppingBasket,
	ShoppingCart,
	Smartphone,
	Sofa,
	Store,
	Ticket,
	Train,
	TrendingUp,
	Tv,
	Utensils,
	Wallet,
	Wifi,
	Wrench,
	Zap,
} from "lucide-react";

/**
 * Category swatches. The first 8 are the curated categorical palette from the
 * `dataviz` skill (docs/adr/0002... — see Q14/ADR discussion): hues validated for
 * CVD-safe adjacent contrast, and the ones to reach for as chart-series colors once
 * category-based reports exist. The remaining swatches are picker-only accents so
 * users have more to choose from — keep the CVD-safe 8 first, and if you wire up
 * chart series, drive them off that leading slice rather than the whole list. Stored
 * as a flat hex on `categories.color`, same convention as `account-types.tsx`.
 */
export type CategoryColorSwatch = { name: string; value: string };

export const CATEGORY_COLORS: CategoryColorSwatch[] = [
	// CVD-safe core palette — keep these first; charts read from this slice.
	{ name: "Blue", value: "#2a78d6" },
	{ name: "Orange", value: "#eb6834" },
	{ name: "Aqua", value: "#1baf7a" },
	{ name: "Yellow", value: "#eda100" },
	{ name: "Magenta", value: "#e87ba4" },
	{ name: "Green", value: "#008300" },
	{ name: "Violet", value: "#4a3aa7" },
	{ name: "Red", value: "#e34948" },
	// Extra picker accents.
	{ name: "Teal", value: "#0d9488" },
	{ name: "Sky", value: "#0ea5e9" },
	{ name: "Indigo", value: "#4f46e5" },
	{ name: "Purple", value: "#9333ea" },
	{ name: "Pink", value: "#db2777" },
	{ name: "Lime", value: "#65a30d" },
	{ name: "Brown", value: "#92610f" },
	{ name: "Slate", value: "#64748b" },
];

export const DEFAULT_CATEGORY_COLOR = CATEGORY_COLORS[0].value;

/** Curated icon set for category chips/pickers. Stored as a string key on `categories.icon`. */
export type CategoryIconValue =
	| "shopping-cart"
	| "shopping-basket"
	| "shopping-bag"
	| "home"
	| "car"
	| "utensils"
	| "pizza"
	| "coffee"
	| "beer"
	| "cake"
	| "heart-pulse"
	| "pill"
	| "dumbbell"
	| "scissors"
	| "film"
	| "tv"
	| "music"
	| "gamepad-2"
	| "ticket"
	| "plane"
	| "hotel"
	| "luggage"
	| "fuel"
	| "bus"
	| "train"
	| "bike"
	| "graduation-cap"
	| "book"
	| "gift"
	| "briefcase"
	| "laptop"
	| "store"
	| "wifi"
	| "smartphone"
	| "zap"
	| "lightbulb"
	| "droplet"
	| "flame"
	| "wrench"
	| "sofa"
	| "newspaper"
	| "shirt"
	| "footprints"
	| "glasses"
	| "gem"
	| "baby"
	| "paw-print"
	| "wallet"
	| "banknote"
	| "coins"
	| "piggy-bank"
	| "credit-card"
	| "receipt"
	| "calculator"
	| "landmark"
	| "shield-check"
	| "bitcoin"
	| "trending-up"
	| "circle-dollar-sign"
	| "key-round"
	| "hand-coins"
	| "heart-handshake"
	| "award"
	| "rotate-ccw";

export type CategoryIconMeta = {
	value: CategoryIconValue;
	label: string;
	icon: LucideIcon;
};

export const CATEGORY_ICONS: CategoryIconMeta[] = [
	// Food, drink & shopping
	{ value: "shopping-cart", label: "Shopping", icon: ShoppingCart },
	{ value: "shopping-basket", label: "Groceries", icon: ShoppingBasket },
	{ value: "shopping-bag", label: "Retail", icon: ShoppingBag },
	{ value: "utensils", label: "Dining", icon: Utensils },
	{ value: "pizza", label: "Takeout", icon: Pizza },
	{ value: "coffee", label: "Coffee", icon: Coffee },
	{ value: "beer", label: "Drinks", icon: Beer },
	{ value: "cake", label: "Treats", icon: Cake },
	// Health & personal care
	{ value: "heart-pulse", label: "Health", icon: HeartPulse },
	{ value: "pill", label: "Pharmacy", icon: Pill },
	{ value: "dumbbell", label: "Fitness", icon: Dumbbell },
	{ value: "scissors", label: "Beauty", icon: Scissors },
	// Entertainment & leisure
	{ value: "film", label: "Entertainment", icon: Film },
	{ value: "tv", label: "Streaming", icon: Tv },
	{ value: "music", label: "Music", icon: Music },
	{ value: "gamepad-2", label: "Gaming", icon: Gamepad2 },
	{ value: "ticket", label: "Events", icon: Ticket },
	// Travel & transport
	{ value: "plane", label: "Travel", icon: Plane },
	{ value: "hotel", label: "Hotels", icon: Hotel },
	{ value: "luggage", label: "Vacation", icon: Luggage },
	{ value: "car", label: "Car", icon: Car },
	{ value: "fuel", label: "Fuel", icon: Fuel },
	{ value: "bus", label: "Transit", icon: Bus },
	{ value: "train", label: "Rail", icon: Train },
	{ value: "bike", label: "Cycling", icon: Bike },
	// Education & work
	{ value: "graduation-cap", label: "Education", icon: GraduationCap },
	{ value: "book", label: "Books", icon: Book },
	{ value: "briefcase", label: "Work", icon: Briefcase },
	{ value: "laptop", label: "Freelance", icon: Laptop },
	{ value: "store", label: "Business", icon: Store },
	// Home & bills
	{ value: "home", label: "Home", icon: Home },
	{ value: "sofa", label: "Furniture", icon: Sofa },
	{ value: "wrench", label: "Repairs", icon: Wrench },
	{ value: "zap", label: "Utilities", icon: Zap },
	{ value: "lightbulb", label: "Electricity", icon: Lightbulb },
	{ value: "droplet", label: "Water", icon: Droplet },
	{ value: "flame", label: "Gas", icon: Flame },
	{ value: "wifi", label: "Internet", icon: Wifi },
	{ value: "smartphone", label: "Phone", icon: Smartphone },
	{ value: "newspaper", label: "Subscriptions", icon: Newspaper },
	{ value: "receipt", label: "Bills", icon: Receipt },
	// Clothing & accessories
	{ value: "shirt", label: "Clothing", icon: Shirt },
	{ value: "footprints", label: "Shoes", icon: Footprints },
	{ value: "glasses", label: "Eyewear", icon: Glasses },
	{ value: "gem", label: "Jewelry", icon: Gem },
	// Family & giving
	{ value: "baby", label: "Kids", icon: Baby },
	{ value: "paw-print", label: "Pets", icon: PawPrint },
	{ value: "gift", label: "Gifts", icon: Gift },
	{ value: "heart-handshake", label: "Charity", icon: HeartHandshake },
	// Money, banking & income
	{ value: "wallet", label: "Wallet", icon: Wallet },
	{ value: "banknote", label: "Cash", icon: Banknote },
	{ value: "coins", label: "Interest", icon: Coins },
	{ value: "piggy-bank", label: "Savings", icon: PiggyBank },
	{ value: "credit-card", label: "Credit card", icon: CreditCard },
	{ value: "calculator", label: "Taxes", icon: Calculator },
	{ value: "landmark", label: "Bank", icon: Landmark },
	{ value: "shield-check", label: "Insurance", icon: ShieldCheck },
	{ value: "bitcoin", label: "Crypto", icon: Bitcoin },
	{ value: "trending-up", label: "Investments", icon: TrendingUp },
	{ value: "circle-dollar-sign", label: "Salary", icon: CircleDollarSign },
	{ value: "key-round", label: "Rent income", icon: KeyRound },
	{ value: "hand-coins", label: "Dividends", icon: HandCoins },
	{ value: "award", label: "Bonus", icon: Award },
	{ value: "rotate-ccw", label: "Refund", icon: RotateCcw },
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
