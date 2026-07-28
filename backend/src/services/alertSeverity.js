// figures out how bad a low-stock alert is, critical vs warning
function alertSeverity(stockLevel, threshold) {
    const stock = Number(stockLevel);
    const thr = Number(threshold);
    const deficit = thr - stock;
    const pctBelow = thr > 0 ? deficit / thr : 1;
    const severity = stock <= 0 || pctBelow >= 0.5 ? 'critical' : 'warning';

    return { deficit, pct_below: pctBelow, severity };
}

// adds severity info onto an alert object
function annotate(alert) {
    return Object.assign({}, alert, alertSeverity(alert.stock_level, alert.threshold));
}

// converts triggered_at to a timestamp number, 0 if invalid
function triggeredMs(alert) {
    const t = new Date(alert.triggered_at).getTime();
    return Number.isNaN(t) ? 0 : t;
}

// orders alerts worst-first: most below threshold, then most recent
function sortBySeverity(list) {
    return (list || [])
        .map(annotate)
        .sort((a, b) =>
            b.pct_below - a.pct_below ||
            b.deficit - a.deficit ||
            triggeredMs(b) - triggeredMs(a)
        );
}

module.exports = { alertSeverity, sortBySeverity };
