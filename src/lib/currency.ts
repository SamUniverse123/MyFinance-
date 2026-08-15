export const CURRENCY_SYMBOLS = {
	AED: "د.إ",
	AFN: "؋",
	ALL: "L",
	AMD: "֏",
	ANG: "ƒ", // Netherlands Antillean guilder — superseded by XCG (2025)
	AOA: "Kz",
	ARS: "$",
	AUD: "$",
	AWG: "ƒ",
	AZN: "₼",
	BAM: "KM",
	BBD: "$",
	BDT: "৳",
	BGN: "лв",
	BHD: ".د.ب",
	BIF: "FBu",
	BMD: "$",
	BND: "$",
	BOB: "Bs.",
	BRL: "R$",
	BSD: "$",
	BTN: "Nu.",
	BWP: "P",
	BYN: "Br",
	BZD: "BZ$",
	CAD: "$",
	CDF: "FC",
	CHF: "CHF",
	CLP: "$",
	CNY: "¥",
	COP: "$",
	CRC: "₡",
	CUP: "$",
	CVE: "$",
	CZK: "Kč",
	DJF: "Fdj",
	DKK: "kr",
	DOP: "RD$",
	DZD: "د.ج",
	EGP: "E£",
	ERN: "Nfk",
	ETB: "Br",
	EUR: "€",
	FJD: "$",
	FKP: "£",
	GBP: "£",
	GEL: "₾",
	GHS: "₵",
	GIP: "£",
	GMD: "D",
	GNF: "FG",
	GTQ: "Q",
	GYD: "$",
	HKD: "$",
	HNL: "L",
	HTG: "G",
	HUF: "Ft",
	IDR: "Rp",
	ILS: "₪",
	INR: "₹",
	IQD: "ع.د",
	IRR: "﷼",
	ISK: "kr",
	JMD: "J$",
	JOD: "د.ا",
	JPY: "¥",
	KES: "KSh",
	KGS: "с",
	KHR: "៛",
	KMF: "CF",
	KPW: "₩",
	KRW: "₩",
	KWD: "د.ك",
	KYD: "$",
	KZT: "₸",
	LAK: "₭",
	LBP: "ل.ل",
	LKR: "රු",
	LRD: "$",
	LSL: "L",
	LYD: "ل.د",
	MAD: "د.م.",
	MDL: "L",
	MGA: "Ar",
	MKD: "ден",
	MMK: "K",
	MNT: "₮",
	MOP: "MOP$",
	MRU: "UM",
	MUR: "₨",
	MVR: "ރ.",
	MWK: "MK",
	MXN: "$",
	MYR: "RM",
	MZN: "MT",
	NAD: "$",
	NGN: "₦",
	NIO: "C$",
	NOK: "kr",
	NPR: "₨",
	NZD: "$",
	OMR: "ر.ع.",
	PAB: "B/.",
	PEN: "S/",
	PGK: "K",
	PHP: "₱",
	PKR: "₨",
	PLN: "zł",
	PYG: "₲",
	QAR: "ر.ق",
	RON: "lei",
	RSD: "дин.",
	RUB: "₽",
	RWF: "FRw",
	SAR: "ر.س",
	SBD: "$",
	SCR: "₨",
	SDG: "ج.س.",
	SEK: "kr",
	SGD: "$",
	SHP: "£",
	SLE: "Le", // New leone (2022 redenomination); SLL is withdrawn
	SOS: "Sh",
	SRD: "$",
	SSP: "£",
	STN: "Db",
	SVC: "₡", // El Salvador colón — still ISO-listed, de facto replaced by USD
	SYP: "£S",
	SZL: "L",
	THB: "฿",
	TJS: "ЅМ",
	TMT: "m",
	TND: "د.ت",
	TOP: "T$",
	TRY: "₺",
	TTD: "$",
	TWD: "NT$",
	TZS: "TSh",
	UAH: "₴",
	UGX: "USh",
	USD: "$",
	UYU: "$U",
	UZS: "so'm",
	VED: "Bs.D",
	VES: "Bs.S",
	VND: "₫",
	VUV: "VT",
	WST: "T",
	XAF: "FCFA", // Central African CFA franc
	XCD: "$", // East Caribbean dollar
	XCG: "Cg", // Caribbean guilder (2025) — replaced ANG
	XDR: "SDR", // IMF Special Drawing Rights — no symbol
	XOF: "CFA", // West African CFA franc
	XPF: "₣", // CFP franc
	YER: "﷼",
	ZAR: "R",
	ZMW: "ZK",
	ZWG: "ZiG", // Zimbabwe Gold (2024) — replaced ZWL
	// Precious metals (traded by the troy ounce, no symbols)
	XAU: "XAU", // Gold
	XAG: "XAG", // Silver
	XPT: "XPT", // Platinum
	XPD: "XPD", // Palladium
} as const;

export type CurrencyCodeType = keyof typeof CURRENCY_SYMBOLS;

export const CURRENCY_CODES = Object.keys(
	CURRENCY_SYMBOLS,
) as CurrencyCodeType[];

/**
 * The `flag-icons` country code (ISO 3166-1 alpha-2, lowercase) for a currency,
 * or `null` when there is no national flag to show.
 *
 * ISO 4217 builds most codes as `<ISO 3166 country><currency letter>` (USD→US,
 * MYR→MY, GBP→GB), so the first two letters are the flag code. The exceptions are
 * the supranational `X…` codes (CFA francs, IMF SDR) and the precious metals
 * (XAU/XAG/…), which have no country — plus the euro, which maps to the EU flag.
 */
export function currencyFlag(code: string): string | null {
	if (code === "EUR") return "eu";
	if (code.startsWith("X")) return null;
	return code.slice(0, 2).toLowerCase();
}

/**
 * Format an integer amount in minor units (the schema's `bigint`, e.g. cents) as a
 * currency string: `formatMoney(123456, "USD")` → `"$1,234.56"`. Negative amounts
 * keep the sign ahead of the symbol (`-$50.00`). Falls back to the code when the
 * symbol is unknown.
 */
export function formatMoney(minorUnits: number, code: string): string {
	const symbol = CURRENCY_SYMBOLS[code as CurrencyCodeType] ?? `${code} `;
	const major = minorUnits / 100;
	const sign = major < 0 ? "-" : "";
	const abs = Math.abs(major).toLocaleString(undefined, {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});
	return `${sign}${symbol}${abs}`;
}

export function getSymbol(code: CurrencyCodeType) {
	return CURRENCY_SYMBOLS[code];
}

export function isCurrencyCode(code: string): code is CurrencyCodeType {
	return code in CURRENCY_SYMBOLS;
}

export function toCurrencyCode(str: string): CurrencyCodeType | undefined {
	return isCurrencyCode(str) ? str : undefined;
}

export function stringToCode(str: string): CurrencyCodeType | undefined {
	return CURRENCY_CODES.find((code) => code === str);
}

/** Most common currency among a set of counts; USD when there are none. */
export function inferBaseCurrency(counts: Map<string, number>): string {
	let best: string | null = null;
	let bestCount = 0;
	for (const [currency, count] of counts) {
		if (count > bestCount) {
			best = currency;
			bestCount = count;
		}
	}
	return best ?? "USD";
}

/**
 * Toggle order: base/default currency first, then by count descending (ties broken
 * alphabetically). Mirrors `orderCurrencies` in `server/routes/dashboard.ts` — kept
 * duplicated because the transactions page derives currencies from data it already
 * has client-side (accounts) rather than a dedicated summary endpoint.
 */
export function orderCurrencies(
	counts: Map<string, number>,
	baseCurrency: string,
): string[] {
	return [...counts.keys()].sort((a, b) => {
		if (a === baseCurrency) return -1;
		if (b === baseCurrency) return 1;
		return (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.localeCompare(b);
	});
}
