import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BrandMark } from "#/components/brand-mark";

export const Route = createFileRoute("/brand-lab")({
	component: BrandLab,
});

/**
 * Isolated preview for tuning the interactive BrandMark (ADR-0016). Not linked in
 * the app — open /brand-lab directly. Delete once the mark is wired into the
 * sidebar and auth pages.
 */
function BrandLab() {
	const [expanded, setExpanded] = useState(true);
	const [replayKey, setReplayKey] = useState(0);

	return (
		<main style={{ padding: 48, maxWidth: 720, margin: "0 auto" }}>
			<h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
				BrandMark lab
			</h1>
			<p style={{ color: "#6b7280", marginBottom: 24 }}>
				Hover a mark to fan the coins out (gold → silver → brass). Toggle to see
				the collapsed in-place spin. Reduced-motion is honored by your OS
				setting.
			</p>

			<div style={{ display: "flex", gap: 12, marginBottom: 32 }}>
				<button
					type="button"
					onClick={() => setExpanded((e) => !e)}
					style={btn}
				>
					{expanded ? "Collapse (icon width)" : "Expand (lockup)"}
				</button>
				<button
					type="button"
					onClick={() => setReplayKey((k) => k + 1)}
					style={btn}
				>
					Replay autoplay
				</button>
			</div>

			<Row label="On light — hover me">
				<BrandMark expanded={expanded} size={28} />
			</Row>

			<Row label="On dark (sidebar-like) — hover me" dark>
				<BrandMark expanded={expanded} size={28} className="text-white" />
			</Row>

			<Row label="Autoplay on mount (auth page, large)">
				<BrandMark key={replayKey} expanded autoPlay size={44} />
			</Row>

			<Row label="Collapsed icon — hover spins in place">
				<BrandMark expanded={false} size={28} />
			</Row>
		</main>
	);
}

const btn: React.CSSProperties = {
	padding: "6px 12px",
	borderRadius: 8,
	border: "1px solid #d1d5db",
	background: "#fff",
	fontSize: 14,
	cursor: "pointer",
};

function Row({
	label,
	dark,
	children,
}: {
	label: string;
	dark?: boolean;
	children: React.ReactNode;
}) {
	return (
		<div style={{ marginBottom: 20 }}>
			<div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8 }}>
				{label}
			</div>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					minHeight: 84,
					padding: 20,
					borderRadius: 12,
					background: dark ? "#101114" : "#f6f7f9",
					color: dark ? "#fff" : "#111",
				}}
			>
				{children}
			</div>
		</div>
	);
}
