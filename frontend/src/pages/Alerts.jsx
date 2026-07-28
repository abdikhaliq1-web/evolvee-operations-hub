import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useTableView, SortHeader, SearchBox, useFlash } from '../ui.jsx';

const STATUS_FILTERS = [
    { value: '', label: 'All' },
    { value: 'open', label: 'Open' },
    { value: 'acknowledged', label: 'Acknowledged' },
    { value: 'resolved', label: 'Resolved' },
];

// Alerts page: lists reorder alerts and lets user act on them.
export default function Alerts() {
    const [alerts, setAlerts] = useState(null);
    const [error, setError] = useState('');
    const [notice, setNotice] = useFlash(5000);
    const [checking, setChecking] = useState(false);
    const [filter, setFilter] = useState('');
    const { query, setQuery, view, sort, toggleSort } = useTableView(alerts, ['sku', 'product_name', 'manufacturer']);
    const loadSeq = useRef(0);

    // Fetches alerts from the server, optionally filtered by status.
    function load() {
        // Ignore this response if a newer request has started.
        const seq = ++loadSeq.current;
        api(`/alerts${filter ? `?status=${filter}` : ''}`)
            .then((data) => { if (seq === loadSeq.current) setAlerts(data.alerts); })
            .catch((e) => { if (seq === loadSeq.current) setError(e.message); });
    }

    useEffect(() => {
        load();
    }, [filter]);

    // Updates an alert's status (acknowledge/resolve).
    async function setStatus(id, status) {
        try {
            await api(`/alerts/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({ status }),
            });

            load();
        } catch (e) {
            setError(e.message);
        }
    }

    // Deletes an alert after confirming with the user.
    async function remove(id) {
        if (!window.confirm('Delete this alert?')) return;

        try {
            await api(`/alerts/${id}`, { method: 'DELETE' });
            load();
        } catch (e) {
            setError(e.message);
        }
    }

    // Run a stock check now instead of waiting for the scheduled one.
    async function checkNow() {
        setChecking(true);
        setNotice('');
        setError('');

        try {
            const result = await api('/alerts/check-now', { method: 'POST' });
            const plural = result.alerts_created === 1 ? '' : 's';

            setNotice(
                `Checked ${result.checked} SKUs / item IDs against Shopify — ` +
                `${result.alerts_created} new alert${plural} created.`
            );

            load();
        } catch (e) {
            setError(e.message);
        } finally {
            setChecking(false);
        }
    }

    // Maps alert status to a CSS class name for styling.
    function statusClass(status) {
        if (status === 'open') return 'low';
        if (status === 'acknowledged') return 'warn';

        return 'ok';
    }

    function formatDate(value) {
        return new Date(value).toLocaleDateString('en-GB');
    }

    return (
        <>
            <h1>Reorder alerts</h1>
            <p className="sub">
                Raised automatically when stock in Shopify falls to or below a SKU's or item ID's reorder threshold. Checks run hourly.
            </p>

            {error && <div className="banner error">{error}</div>}
            {notice && <div className="banner notice">{notice}</div>}

            <p>
                <button className="primary" onClick={checkNow} disabled={checking}>
                    {checking ? 'Checking…' : 'Check stock now'}
                </button>
            </p>

            <div className="toolbar">
                <SearchBox
                    query={query}
                    setQuery={setQuery}
                    placeholder="Search SKU, product, manufacturer…"
                />
                <div className="chips">
                    {STATUS_FILTERS.map((f) => (
                        <button
                            key={f.value}
                            className={filter === f.value ? 'primary' : ''}
                            onClick={() => setFilter(f.value)}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {alerts === null ? (
                <p className="empty">Loading…</p>
            ) : (
                <div className="tile">
                    <table>
                        <thead>
                            <tr>
                                <SortHeader label="Raised" sortKey="triggered_at" sort={sort} toggleSort={toggleSort} />
                                <SortHeader label="SKU / Item ID" sortKey="sku" sort={sort} toggleSort={toggleSort} />
                                <SortHeader label="Product" sortKey="product_name" sort={sort} toggleSort={toggleSort} />
                                <SortHeader label="Stock" sortKey="stock_level" sort={sort} toggleSort={toggleSort} className="num" />
                                <SortHeader label="Threshold" sortKey="threshold" sort={sort} toggleSort={toggleSort} className="num" />
                                <SortHeader label="Manufacturer" sortKey="manufacturer" sort={sort} toggleSort={toggleSort} />
                                <SortHeader label="Status" sortKey="status" sort={sort} toggleSort={toggleSort} />
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {view.length === 0 ? (
                                <tr><td colSpan={8} className="empty">
                                    {query ? `No alerts match “${query}”.` : 'No alerts for this filter.'}
                                </td></tr>
                            ) : view.map((alert) => (
                                <tr key={alert.id}>
                                    <td>{formatDate(alert.triggered_at)}</td>
                                    <td>{alert.sku}</td>
                                    <td>{alert.product_name}</td>
                                    <td className="num">{alert.stock_level}</td>
                                    <td className="num">{alert.threshold}</td>
                                    <td>{alert.manufacturer || '—'}</td>
                                    <td>
                                        <span className={`pill ${statusClass(alert.status)}`}>
                                            {alert.status}
                                        </span>
                                    </td>
                                    <td>
                                        {alert.manufacturer_id && (
                                            <Link
                                                className="link"
                                                to={`/manufacturers/${alert.manufacturer_id}?reorder_product=${alert.product_id}`}
                                            >
                                                Reorder
                                            </Link>
                                        )}
                                        {alert.status === 'open' && (
                                            <button
                                                className="link"
                                                onClick={() => setStatus(alert.id, 'acknowledged')}
                                            >
                                                Acknowledge
                                            </button>
                                        )}
                                        {alert.status !== 'resolved' && (
                                            <button
                                                className="link"
                                                onClick={() => setStatus(alert.id, 'resolved')}
                                            >
                                                Resolve
                                            </button>
                                        )}
                                        <button
                                            className="link"
                                            onClick={() => remove(alert.id)}
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </>
    );
}