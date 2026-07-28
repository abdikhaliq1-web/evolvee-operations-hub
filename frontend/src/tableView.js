// Compares two values for sorting, handling nulls and numbers/text.
export function compareValues(a, b) {
    // Nulls always sort to the end, regardless of sort direction.
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    if (typeof a === 'number' && typeof b === 'number') return a - b;

    return String(a).localeCompare(String(b), undefined, { numeric: true });
}

// Lowercases text and strips accents for consistent searching.
export function normalizeText(value) {
    return String(value ?? '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

// Splits a search string into terms, supporting quotes and -exclude.
export function parseQuery(query) {
    const terms = [];
    const re = /(-)?(?:"([^"]*)"|(\S+))/g;
    let match;
    while ((match = re.exec(query || '')) !== null) {
        const text = normalizeText(match[2] !== undefined ? match[2] : match[3]);
        if (text) terms.push({ negate: match[1] === '-', text });
    }
    return terms;
}

// Filters rows by search query and sorts them by the chosen column.
export function selectRows(rows, searchFields, query, sort) {
    const terms = parseQuery(query);
    let view = rows || [];

    if (terms.length) {
        view = view.filter((row) => {
            const haystack = searchFields.map((field) => normalizeText(row[field]));
            return terms.every(({ negate, text }) => {
                const hit = haystack.some((value) => value.includes(text));
                return negate ? !hit : hit;
            });
        });
    }

    if (sort && sort.key) {
        view = [...view].sort((a, b) => compareValues(a[sort.key], b[sort.key]) * sort.dir);
    }

    return view;
}

// Converts rows and column definitions into CSV text.
export function toCsv(columns, rows) {
    const cell = (value) => {
        let s = value == null ? '' : String(value);
        // Escape values starting with =, +, -, @ so Excel won't run them.
        if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;

        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };

    const lines = [columns.map((c) => cell(c.label)).join(',')];
    for (const row of rows || []) {
        lines.push(columns.map((c) => cell(c.get(row))).join(','));
    }

    return lines.join('\n');
}
