var PALETTES = {
    'flashalpha-dark': {
        text: '#e2e8f0',
        muted: '#94a3b8',
        faint: '#64748b',
        grid: 'rgba(100,116,139,0.14)',
        axis: 'rgba(100,116,139,0.45)',
        bg: '#0f172a',
        tooltipBg: 'rgba(15,23,42,0.96)',
        tooltipBorder: 'rgba(100,116,139,0.35)',
        pos: '#34d399',
        neg: '#f87171',
        callWall: '#059669',
        putWall: '#f84040',
        posArea: 'rgba(52,211,153,0.06)',
        negArea: 'rgba(248,113,113,0.06)',
        posAreaText: 'rgba(52,211,153,0.7)',
        negAreaText: 'rgba(248,113,113,0.7)',
        flip: '#fbbf24',
        spot: '#f1f5f9',
        maxPain: '#a78bfa',
        flowFlip: '#22d3ee',
        em: '#94a3b8',
        emArea: 'rgba(148,163,184,0.08)',
        magnet: '#f472b6',
        glow: 'rgba(241,245,249,0.45)'
    },
    'flashalpha-light': {
        text: '#0f172a',
        muted: '#475569',
        faint: '#64748b',
        grid: 'rgba(100,116,139,0.16)',
        axis: 'rgba(100,116,139,0.5)',
        bg: '#ffffff',
        tooltipBg: 'rgba(255,255,255,0.98)',
        tooltipBorder: 'rgba(148,163,184,0.6)',
        pos: '#059669',
        neg: '#dc2626',
        callWall: '#065f46',
        putWall: '#f84040',
        posArea: 'rgba(5,150,105,0.06)',
        negArea: 'rgba(220,38,38,0.06)',
        posAreaText: 'rgba(5,150,105,0.7)',
        negAreaText: 'rgba(220,38,38,0.7)',
        flip: '#d97706',
        spot: '#0f172a',
        maxPain: '#7c3aed',
        flowFlip: '#0891b2',
        em: '#64748b',
        emArea: 'rgba(100,116,139,0.08)',
        magnet: '#db2777',
        glow: 'rgba(15,23,42,0.3)'
    }
};
function palette(name) { return PALETTES[name] || PALETTES['flashalpha-dark']; }
function themeFor(p) {
    var axis = {
        axisLine: { lineStyle: { color: p.axis } },
        axisTick: { lineStyle: { color: p.axis } },
        axisLabel: { color: p.muted },
        splitLine: { lineStyle: { color: p.grid } },
        nameTextStyle: { color: p.faint }
    };
    return {
        backgroundColor: 'transparent',
        textStyle: { color: p.text, fontFamily: 'inherit' },
        color: [p.pos, p.neg],
        valueAxis: axis,
        categoryAxis: axis,
        tooltip: {
            backgroundColor: p.tooltipBg,
            borderColor: p.tooltipBorder,
            textStyle: { color: p.text }
        },
        dataZoom: {
            textStyle: { color: p.muted },
            borderColor: p.axis,
            fillerColor: 'rgba(100,116,139,0.18)',
            handleStyle: { color: p.muted, borderColor: p.axis },
            dataBackground: { lineStyle: { color: p.faint }, areaStyle: { color: p.grid } }
        }
    };
}
var registered = typeof WeakSet === 'function' ? new WeakSet() : null;
function register(echarts) {
    if (!echarts || (registered && registered.has(echarts))) return;
    Object.keys(PALETTES).forEach(function (name) { echarts.registerTheme(name, themeFor(PALETTES[name])); });
    if (registered) registered.add(echarts);
}
var NAMES = Object.keys(PALETTES);
export default { palette: palette, register: register, NAMES: NAMES };
