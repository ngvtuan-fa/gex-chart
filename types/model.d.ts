/** The data model behind FlashAlpha GEX Charts: builds strikes and levels from FlashAlpha API responses and formats numbers. No DOM, no ECharts. */
declare const model: {
    /** Builds the chart model from a summary and a per-strike GEX response. */
    buildModel(input: { symbol: string; assetType?: 'stock' | 'futures'; summary?: unknown; gex?: unknown; expiry?: string; minOi?: number }): Record<string, unknown>;
    /** Formats a GEX value in dollars, for example "+$1.2B". */
    fmtGex(value: number): string;
    /** Formats a strike, with the currency sign for stocks. */
    fmtStrike(value: number, currency?: string): string;
    /** Formats a price with two decimals. */
    fmtPrice(value: number, currency?: string): string;
    /** "Positive gamma", "Negative gamma" or "Undetermined". */
    regimeLabel(regime: string): string;
    /** "As of " or "As of last close · ". */
    asOfPrefix(marketOpen: boolean | null, assetType: string): string;
    /** Whether a data time is too old while the market is open. */
    isStale(iso: string | null, nowMs: number, marketOpen: boolean | null): boolean;
    /** Plan rank from a plan name: basic 1, growth 2, alpha 3. */
    rankFromPlanName(name: string): number | null;
    [key: string]: unknown;
};
export default model;
