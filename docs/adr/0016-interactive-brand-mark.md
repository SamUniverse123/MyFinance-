# The logo is an interactive, animated BrandMark

The app's logo is a reusable `<BrandMark>` component, not a static icon. It renders three coins (gold, silver, brass) and the "Denarii" wordmark, and plays a spin-and-settle flourish on hover, on first entry into the app, and whenever the sidebar is toggled. Built with **CSS 3D transforms driven by Motion** (`motion/react`, already a dependency), not three.js — the right weight for a small brand mark (see [[0008-bklit-ui-for-dashboard-charts]] for the same "don't reach for the heavy library" instinct).

## Decisions

- **Rest state is three coins seen edge-on, stacked; hover fans them out and spins them to face-on.** The signature gesture is a self-contained flourish: the coins spread apart, each spins (a decelerating `rotateY`) and settles face-on **in the order gold → silver → brass** (~250ms apart), then reverses back to the stacked edge-on rest state when the cursor leaves. Because a flat disc at `rotateY(90°)` has zero width, each coin carries a **real rim element** (its thickness) so the edge-on state stays solid — this is why a coin is two faces plus a rim, not a single div.

- **The wordmark fades out early, as the coins begin to spread, and the coins fan into the space it vacated.** The lockup's footprint doesn't change, so nothing around it reflows. Name-visible-when-stacked / name-gone-when-spread is the coupling for the *hover* axis.

- **One width-parameterized flourish covers all three triggers.** Spread distance is driven by available width, so the same animation degrades gracefully: full fan-out at the expanded sidebar width (16rem), and an **in-place spin** with no spread at the collapsed icon width (3rem), where there is no room to fan out or show the wordmark. The alternative — a distinct collapsed animation, or morphing between one and three coins — was rejected as more code and a second mental model.

- **Autoplay is `sessionStorage`-gated to the first app-shell mount, not the dashboard route.** Entering the app from outside plays the flourish once; **reloads within the session do not replay it** (the flag survives reload); a fresh tab/session replays. The auth-page `<BrandMark>` is outside this gate — it autoplays once on mount as a larger brand moment, since it has no sidebar and no session flag.

- **`prefers-reduced-motion` suppresses all rotation, spread, and translation.** State changes become an opacity crossfade or instant swap, the first-mount and toggle autoplays are **skipped entirely**, and hover is reduced to a subtle opacity/tint change. Spinning coins are precisely what that setting exists to tame.

## Consequences

- `<BrandMark>` reads sidebar state (`useSidebar().state`) to choose expanded vs. collapsed layout and spread distance; it is the same component in the sidebar header and (larger, always-expanded) on the auth pages.
- The sidebar header's generic `CommandIcon` + "Denarii" text (`app-sidebar.tsx`) is replaced by `<BrandMark>`.
- Per-coin timing (different durations to stagger the stops) means the coins animate via **independent transforms** (`rotateY`, `x`) rather than a single `transform`, with `willChange` set on the animating properties and removed at rest.
- Motion values are never read during render; the flourish is fully interruptible, so a cursor leaving mid-spin re-targets from the current angle rather than snapping.
