import * as React from "react";
import { env } from "#/env";
import { cn } from "#/lib/utils.ts";

const TOKEN = env.VITE_LOGO_DEV_PUBLISHABLE_KEY;

/** Deterministic hue from a name, for the initials fallback tile. */
function hueFromName(name: string): number {
	let h = 0;
	for (let i = 0; i < name.length; i++) {
		h = (h * 31 + name.charCodeAt(i)) % 360;
	}
	return h;
}

function initialOf(name: string): string {
	const c = name.trim()[0];
	return c ? c.toUpperCase() : "?";
}

/**
 * Logo.dev image URL (ADR-0014). A stored `domain` uses the domain path; otherwise
 * we attempt a name-based lookup (Q8). `fallback=404` makes logo.dev 404 on a miss —
 * instead of its own monogram — so `onError` can swap in our initials tile. Returns
 * null when no publishable key is configured, degrading straight to initials.
 */
function logoUrl(
	name: string,
	domain: string | null | undefined,
	size: number,
): string | null {
	if (!TOKEN) return null;
	const host = domain?.trim();
	const path = host
		? encodeURIComponent(host)
		: `name/${encodeURIComponent(name.trim())}`;
	const params = new URLSearchParams({
		token: TOKEN,
		size: String(size),
		format: "png",
		retina: "true",
		fallback: "404",
	});
	return `https://img.logo.dev/${path}?${params.toString()}`;
}

/**
 * A payee's brand logo (from logo.dev), falling back to a colored initials tile when
 * there's no logo or no API key. Used wherever a payee renders (Q2).
 */
export function PayeeAvatar({
	name,
	domain,
	size = 36,
	className,
}: {
	name: string;
	domain?: string | null;
	size?: number;
	className?: string;
}) {
	const url = logoUrl(name, domain, size);
	const [errored, setErrored] = React.useState(false);

	// A changed source is a fresh attempt — clear any prior error.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset keyed on url
	React.useEffect(() => setErrored(false), [url]);

	const hue = hueFromName(name);

	return (
		<span
			className={cn(
				"flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-card",
				className,
			)}
			style={{ width: size, height: size }}
		>
			{url && !errored ? (
				<img
					src={url}
					alt=""
					width={size}
					height={size}
					loading="lazy"
					className="size-full object-contain"
					onError={() => setErrored(true)}
				/>
			) : (
				<span
					aria-hidden
					className="flex size-full items-center justify-center font-semibold"
					style={{
						fontSize: Math.max(10, Math.round(size * 0.42)),
						backgroundColor: `hsl(${hue} 55% 90%)`,
						color: `hsl(${hue} 45% 35%)`,
					}}
				>
					{initialOf(name)}
				</span>
			)}
		</span>
	);
}
