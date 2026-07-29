export function compareValues(a, b) {
    // Nulls always sort to the end, regardless of sort direction.
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    if (typeof a === 'number' && typeof b === 'number') return a - b;

    return String(a).localeCompare(String(b), undefined, { numeric: true });
}

export function selectRows(rows, searchFields, query, sort) {
    const q = (query || '').trim().toLowerCase();
    let view = rows || [];

    if (q) {
        view = view.filter((row) =>
            searchFields.some((field) => String(row[field] ?? '').toLowerCase().includes(q))
        );
    }

    if (sort && sort.key) {
        view = [...view].sort((a, b) => compareValues(a[sort.key], b[sort.key]) * sort.dir);
    }

    return view;
}

export function toCsv(columns, rows) {
    const cell = (value) => {
        let s = value == null ? '' : String(value);
        // Neutralise spreadsheet formula injection: a leading =, +, -, @ can execute in Excel.
        if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;

        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };

    const lines = [columns.map((c) => cell(c.label)).join(',')];
    for (const row of rows || []) {
        lines.push(columns.map((c) => cell(c.get(row))).join(','));
    }

    return lines.join('\n');
}
