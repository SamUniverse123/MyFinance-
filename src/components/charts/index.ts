/**
 * biome-ignore-all lint/performance/noBarrelFile: mirrors the Bklit UI registry's own example barrel (see docs/adr/0008)
 *
 * No `LinearGradient` re-export here on purpose: `@visx/gradient`'s package `exports`
 * map doesn't resolve under Node's strict ESM SSR loader (works fine in Vite's dev
 * bundler, breaks server rendering — Node falls back to client-only rendering for the
 * whole route, silently). Nothing in this app used it directly (`Area` already
 * generates its own default gradient), so it's left out rather than worked around.
 */

export { Area } from "./area";
export { AreaChart } from "./area-chart";
export { Candlestick } from "./candlestick";
export { CandlestickChart, type OHLCDataPoint } from "./candlestick-chart";
export { useChart } from "./chart-context";
export { ChartStatFlow, type ChartStatFlowFormat } from "./chart-stat-flow";
export { Line } from "./line";
export { LineChart } from "./line-chart";
