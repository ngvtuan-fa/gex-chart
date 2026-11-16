/** Chart layout: the full chart with controls, the chart only, or same-day (0DTE) gamma exposure. */
export type GexMode = 'full' | 'compact' | 'zero-dte';

/** `auto` follows the visitor's system theme; `class` follows `class="dark"` on `<html>`. */
export type GexTheme = 'dark' | 'light' | 'auto' | 'class';

/** Net GEX, calls against puts, open interest, or session dealer flow (Alpha). */
export type GexView = 'net' | 'callput' | 'oi' | 'flow';

/** Strike window around spot as a fraction (0.05 = ±5%), every strike, or the default window. */
export type GexRange = number | 'all' | 'auto';

/** FlashAlpha plan names. */
export type GexPlan = 'free' | 'basic' | 'growth' | 'alpha' | 'enterprise';

/** Optional overlays on the full chart. */
export interface GexLayers {
    /** Expected move band (Basic and up). */
    em?: boolean;
    /** Pin risk score and magnet strike (Growth and up). */
    pin?: boolean;
    /** Same-day expiry bars on top of the whole chain (Growth and up). */
    zdte?: boolean;
    /** Gamma flip against spot through the session (Basic and up). */
    trail?: boolean;
}

/** Parts of the full chart that can be hidden. Every flag defaults to `true`. */
export interface GexFeatures {
    /** Key levels list beside the chart on wide screens. */
    levelsRail?: boolean;
    /** Max pain line. */
    maxPain?: boolean;
    /** Export PNG button. */
    export?: boolean;
    /** Full screen button. */
    fullscreen?: boolean;
    /** Horizontal / vertical bars button. */
    orientation?: boolean;
    /** Layers menu. */
    layers?: boolean;
    /** Automatic refresh during market hours. */
    live?: boolean;
    /** Level labels button. */
    labels?: boolean;
}

/** Text and link of the overlay shown when no API key is set. */
export interface GexGuestCta {
    title?: string;
    text?: string;
    label?: string;
    href?: string;
    /** Extra `data-*`, `aria-*`, `id` or `title` attributes of the link, for example for analytics. */
    attrs?: Record<string, string>;
}

/** FlashAlpha API responses to draw without sending any request. */
export interface GexData {
    /** A `GET /v1/stock/{symbol}/summary` response. */
    summary?: unknown;
    /** A `GET /v1/exposure/gex/{symbol}` response. */
    gex?: unknown;
    /** A `GET /v1/exposure/zero-dte/{symbol}` response, for `mode: 'zero-dte'`. */
    zeroDte?: unknown;
    /** Symbol of `zeroDte`, when it changes. */
    symbol?: string;
    /** Marks `zeroDte` as a sample snapshot. */
    sample?: boolean;
}

/** Options of {@link init}. */
export interface GexOptions {
    /** Your FlashAlpha API key, from https://flashalpha.com/profile. `null` means the visitor has no key: the chart shows the no-key view without a plan lookup, even with a custom `apiBase`. */
    apiKey?: string | null;
    /** Returns the API key when a request is sent, instead of `apiKey`. */
    getApiKey?: () => string | null | Promise<string | null>;
    /** Ticker, for example `SPY`, `NVDA` or `ES=F`. @default 'SPY' */
    symbol?: string;
    /** Asset class. Defaults to `futures` for symbols ending in `=F`. */
    assetType?: 'stock' | 'futures';
    /** @default 'full' */
    mode?: GexMode;
    /** @default 'auto' */
    theme?: GexTheme;
    /** Starting view. @default 'net' */
    view?: GexView;
    /** Starting strike window. @default 'auto' */
    range?: GexRange;
    /** Whole chain (`all`), one expiry (`YYYY-MM-DD`) or the best one for the plan (`auto`). @default 'auto' */
    expiry?: 'auto' | 'all' | string;
    /** @default 'horizontal' */
    orientation?: 'horizontal' | 'vertical';
    /** Overlays to start with. Defaults depend on the plan. */
    layers?: GexLayers;
    /** Parts of the full chart to show. */
    features?: GexFeatures;
    /** The ECharts namespace. @default window.echarts */
    echarts?: unknown;
    /** URL of `echarts.min.js`, loaded once when no ECharts is found. */
    echartsUrl?: string;
    /** API host, or your own proxy that adds the key. @default 'https://lab.flashalpha.com' */
    apiBase?: string;
    /** Extra headers sent with every request. */
    headers?: () => Record<string, string>;
    /** Value of the `X-Source` header, or `false` to leave it out. @default 'gex-charts' */
    source?: string | false;
    /** Your plan. Skips the plan lookup on `/v1/account`. */
    plan?: GexPlan;
    /** Replaces `fetch`, for example to share a request queue. */
    fetch?: (url: string, init: RequestInit) => Promise<Response>;
    /** The most requests sent at the same time. @default 3 */
    maxConcurrent?: number;
    /** Draw these API responses and send no request. */
    data?: GexData;
    /** A summary response you already have, so it is not fetched again. */
    summary?: unknown;
    /** `local` remembers the visitor's view, range and layers in localStorage. @default 'local' */
    storage?: 'local' | 'none';
    /** Prefix of the localStorage keys. @default 'flashalpha-gex' */
    storagePrefix?: string;
    /** Injects the chart's CSS once. Set `false` under a strict CSP and import `@flashalpha/gex-charts/style.css`. @default true */
    injectCss?: boolean;
    /** CSP nonce of the injected style tag. */
    cssNonce?: string;
    /** Shows "GEX data by FlashAlpha" under the chart. @default true */
    attribution?: boolean;
    /** Link of the upgrade buttons, from the plan slug (`basic`, `growth`, `alpha`). */
    upgradeUrl?: (plan: string | null, rank: number) => string;
    /** A line under the title of the upgrade dialog, for example the plan's price. Return an empty value to leave it out. */
    upgradeNote?: (plan: string | null, rank: number) => string | null | undefined;
    /** Extra `data-*`, `aria-*`, `id` or `title` attributes of the upgrade dialog's button. */
    upgradeAttrs?: Record<string, string>;
    /** Overlay text and link when no API key is set. */
    guestCta?: GexGuestCta;
    /** Link next to the "Delayed" chip, shown while the data is delayed. */
    delayedCta?: { text?: string; href: string; attrs?: Record<string, string> };
    /** `compact` mode: keep only the N strikes with the largest net GEX. */
    top?: number;
    /** `compact` mode: show the zoom slider. @default true */
    zoomBar?: boolean;
    /** `compact` mode: show level labels on phones. @default false */
    labelsMobile?: boolean;
    /** Event handlers registered before the first request. */
    on?: Partial<{ [K in keyof GexEvents]: (payload: GexEvents[K]) => void }>;
}

/** Strikes, levels and spot on screen. */
export interface GexModel {
    symbol: string;
    spot: number | null;
    strikes: Array<Record<string, unknown> & { strike: number }>;
    callWall?: number | null;
    putWall?: number | null;
    flip?: number | null;
    maxPain?: number | null;
    asOf?: string | null;
    [key: string]: unknown;
}

/** Payload of each event. */
export interface GexEvents {
    /** Data loaded and drawn. */
    ready: { model: GexModel; raw: unknown; live?: boolean };
    /** A request started. */
    loading: { symbol: string; refresh: boolean };
    /** A live refresh arrived. */
    'live-update': { model: GexModel };
    'view-change': { view: GexView };
    'range-change': { range: GexRange };
    'expiry-change': { expiry: string };
    'orientation-change': { orientation: 'horizontal' | 'vertical' };
    /** A level was picked in the chips or the levels list. */
    'level-click': { key: string; price: number; scope: string };
    /** A feature needs a key or a higher FlashAlpha plan. */
    locked: { feature?: string; requiredPlan: string; reason: string };
    /** Daily quota or the concurrency limit was reached. */
    'rate-limited': { kind: 'quota' | 'concurrency'; resetAt: string | null; retryAfter: number | null };
    /** No strikes for this symbol or expiry. */
    empty: { expiry?: string | null; noZeroDte?: boolean };
    /** Network, API or ECharts error. */
    error: { kind: string; status?: number | null; code?: string | null };
    /** The chart was removed. */
    dispose: void;
}

/** A chart created by {@link init}. */
export interface GexChart {
    /** Listens to an event. */
    on<K extends keyof GexEvents>(name: K, handler: (payload: GexEvents[K]) => void): this;
    /** Stops listening. Without a handler, removes every handler of the event. */
    off<K extends keyof GexEvents>(name: K, handler?: (payload: GexEvents[K]) => void): this;
    /** Loads another ticker. Sends requests. */
    setSymbol(symbol: string, assetType?: 'stock' | 'futures'): this;
    /** Changes options. `view`, `range`, `expiry`, `orientation`, `theme` and `layers` apply in place; any other option rebuilds the chart. */
    setOption(partial: Partial<GexOptions>): this;
    /** Shortcut for `setOption({ view })`. The Flow view sends a request. */
    setView(view: GexView): this;
    /** Shortcut for `setOption({ range })`. No request. */
    setRange(range: GexRange): this;
    /** Shortcut for `setOption({ expiry })`. Sends requests. */
    setExpiry(expiry: string): this;
    /** Shortcut for `setOption({ theme })`. No request. */
    setTheme(theme: GexTheme): this;
    /** Shortcut for `setOption({ orientation })`. The full chart reloads its data. */
    setOrientation(orientation: 'horizontal' | 'vertical'): this;
    /** Redraws from API responses you already have. No request. */
    setData(data: GexData): this;
    /** Fetches fresh data now. Returns `false` when it is too soon (15 s) or not possible. */
    refresh(): boolean;
    /** Measures the container again. Usually automatic. */
    resize(): this;
    /** Data on screen, or `null` before the first load. */
    getModel(): GexModel | null;
    /** `loading`, `ready`, `guest`, `locked`, `limit`, `empty`, `not_found`, `error` or `disposed`. */
    getStatus(): string;
    /** Current bar orientation. */
    getOrientation(): 'horizontal' | 'vertical' | null;
    /** PNG data URL of the chart, or `null` when nothing is drawn. */
    getDataURL(options?: Record<string, unknown>): string | null;
    /** The element passed to `init`. */
    getDom(): HTMLElement;
    isDisposed(): boolean;
    /** Removes the chart, its timers and listeners. */
    dispose(): void;
}

/** Creates a gamma exposure chart in `dom` (an element or a CSS selector). An existing chart there is disposed first. */
export function init(dom: HTMLElement | string, options?: GexOptions): GexChart;

/** The chart created in `dom`, or `null`. */
export function getInstanceByDom(dom: HTMLElement): GexChart | null;

/** Disposes a chart, or the chart in an element or selector. */
export function dispose(target: GexChart | HTMLElement | string): void;

/** Creates a chart in every `[data-flashalpha-gex]` element under `root` that has none yet. The script build runs it on page load. */
export function autoInit(root?: ParentNode): GexChart[];

/** Package version. */
export const version: string;

/** Formatting helpers used by the chart, such as `fmtGex`, `fmtStrike`, `fmtPrice` and `regimeLabel`. */
export const model: {
    fmtGex(value: number): string;
    fmtStrike(value: number, currency?: string): string;
    fmtPrice(value: number, currency?: string): string;
    regimeLabel(regime: string): string;
    rankFromPlanName(name: string): number | null;
    [key: string]: unknown;
};
