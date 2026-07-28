import { useState, useEffect, useRef } from 'react';
import { selectRows, toCsv } from './tableView.js';

// Combines search + sort state with the derived, filtered rows.
export function useTableView(rows, searchFields) {
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState({ key: null, dir: 1 });

    const view = selectRows(rows, searchFields, query, sort);

    function toggleSort(key) {
        setSort((prev) => (prev.key === key ? { key, dir: -prev.dir } : { key, dir: 1 }));
    }

    return { query, setQuery, view, sort, toggleSort };
}

// Clickable table header that toggles sort direction.
export function SortHeader({ label, sortKey, sort, toggleSort, className }) {
    const active = sort.key === sortKey;
    const arrow = active ? (sort.dir === 1 ? ' +' : ' -') : '';

    return (
        <th
            className={`sortable${className ? ' ' + className : ''}`}
            onClick={() => toggleSort(sortKey)}
            aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
        >
            {label}{arrow}
        </th>
    );
}

// Simple search input box.
export function SearchBox({ query, setQuery, placeholder }) {
    return (
        <input
            className="search"
            type="search"
            placeholder={placeholder || 'Search…'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
        />
    );
}

// Button that exports the given rows as a downloadable CSV file.
export function ExportButton({ filename, columns, rows, label }) {
    function download() {
        const csv = toCsv(columns, rows);
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        const link = document.createElement('a');

        // Trigger a download without navigating away.
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }

    return (
        <button className="link" onClick={download} disabled={!rows || rows.length === 0}>
            {label || 'Export CSV'}
        </button>
    );
}

// Button that copies text to the clipboard and shows a checkmark briefly.
export function CopyText({ value }) {
    const [copied, setCopied] = useState(false);
    const timerRef = useRef(null);

    useEffect(() => () => clearTimeout(timerRef.current), []);

    function copy() {
        if (!navigator.clipboard) return;

        navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => setCopied(false), 1200);
        });
    }

    return (
        <button className="link copy" onClick={copy} title="Copy to clipboard">
            {value}{copied ? ' ✓' : ''}
        </button>
    );
}

// Returns a keydown handler that runs fn when Enter is pressed.
export function onEnter(fn) {
    return (e) => {
        if (e.key === 'Enter') fn();
    };
}

// Shows a message for a set duration, then clears it.
export function useFlash(ms = 3000) {
    const [msg, setMsg] = useState('');

    useEffect(() => {
        if (!msg) return;

        const timer = setTimeout(() => setMsg(''), ms);

        return () => clearTimeout(timer);
    }, [msg, ms]);

    return [msg, setMsg];
}
