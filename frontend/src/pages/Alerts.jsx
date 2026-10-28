import React, { useEffect, useRef, useState } from 'react';
import { api, canWrite, canDeleteAlerts } from '../api.js';
import {useTableView, SortHeader, SearchBox, useFlash, onEnter} from '../ui.jsx';

const STATUS_FILTERS = [
    { value: '', label: 'All' },
    { value: 'open', label: 'Open' },
    { value: 'awaiting', label: 'Awaiting Inventory' },
    { value: 'resolved', label: 'Resolved' },
];

export default function Alerts() {
    const [alerts, setAlerts] = useState(null);
    const [error, setError] = useState('');
    const [notice, setNotice] = useFlash(5000);
    const [filter, setFilter] = useState('');
    const { query, setQuery, view, sort, toggleSort } = useTableView(alerts, ['sku', 'product_name', 'manufacturer']);
    const loadSeq = useRef(0);
    const writable = canWrite('alerts');
    const deletable = canDeleteAlerts();
    const [selectedAlert, setSelectedAlert] = useState(null);
    const [reorder, setReorder] = useState({ quantity_ordered: '', notes: '' });
    const [operation, setOperation] = useState('idle');

    const loadingSuggestion = operation === 'suggesting';
    const submitting = operation === 'submitting';
    const busy = operation !== 'idle';
    const checking = operation === 'checking';

    function load() {
        // Guard against a stale response landing after a newer request (e.g. filter changed mid-flight).
        const seq = ++loadSeq.current;
        api(`/alerts${filter ? `?status=${filter}` : ''}`)
            .then((data) => { if (seq === loadSeq.current) setAlerts(data.alerts); })
            .catch((e) => { if (seq === loadSeq.current) setError(e.message); });
    }

    useEffect(() => {
        load();
    }, [filter]);

    async function setStatus(id, status) {
        if (busy) return;

        if (!window.confirm('Confirm that inventory has been received and replenishment is complete.')) {
            return;
        }

        setError('');
        setOperation('resolving');

        try {
            await api(`/alerts/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({ status }),
            });

            load();
        } catch (e) {
            setError(e.message);
        } finally {
            setOperation('idle');
        }
    }

    async function remove(id) {
        if (busy) return;

        if (!window.confirm('Delete this alert?')) return;

        setError('');
        setOperation('removing');

        try {
            await api(`/alerts/${id}`, { method: 'DELETE' });

            if (selectedAlert?.id === id) {
                setSelectedAlert(null);
                setReorder({ quantity_ordered: "", notes: "" });
            }
            load();
        } catch (e) {
            setError(e.message);
        } finally {
            setOperation('idle');
        }
    }

    // Run a stock check now instead of waiting for the scheduled one.
    async function checkNow() {
        if (busy) return;

        setOperation('checking');
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
            setOperation('idle');
        }
    }

    function statusClass(status) {
        if (status === 'open') return 'low';
        if (status === 'awaiting') return 'warn';

        return 'ok';
    }

    function formatDate(value) {
        return new Date(value).toLocaleDateString('en-GB');
    }

    async function openReorder(alert) {
        if (busy) return;

        if (selectedAlert?.id !== alert.id) {
            setReorder({ quantity_ordered: '', notes: '' });
            setSelectedAlert(alert);

            setError('');
            setOperation('suggesting');

            try {
                const data = await api(`/alerts/${alert.id}/reorder-suggestion`);
                setReorder({quantity_ordered: String(data.suggestion), notes: ''});
            } catch (e) {
                setError(e.message);
            } finally {
                setOperation('idle');
            }
        }
    }

    function updateReorder(field, value) {
        setReorder(function (prev) {
            return { ...prev, [field]: value };
        });
    }

    async function submitReorder() {
        if (busy || !selectedAlert) return;

        // Select and input values are strings; the API wants numbers.
        const quantity_ordered = Number(reorder.quantity_ordered);
        const notes = reorder.notes;

        if(!Number.isInteger(quantity_ordered) || quantity_ordered <= 0) {
            setError('Quantity must be a positive whole number.');
            return;
        }

        if (selectedAlert.stock_level + quantity_ordered <= selectedAlert.threshold) {
            if (!window.confirm(
                'Based on this alert’s recorded stock, receiving this quantity would leave inventory at or below the recorded low-stock threshold.\n' +
                'You can still log this reorder.\n' +
                'If inventory remains low after the alert is resolved, a later stock check may generate another alert.\n' +
                'Continue?')) {
                return;
            }
        }

        setError('');
        setOperation('submitting');

        try {
            await api(`/alerts/${selectedAlert.id}/reorders`, {
                method: 'POST',
                body: JSON.stringify({ quantity_ordered, notes }),
            });

            setSelectedAlert(null);
            setReorder({ quantity_ordered: '', notes: '' });

            load();
        } catch (e) {
            setError(e.message);
        } finally {
            setOperation('idle');
        }
    }

    return (
        <>
            <h1>Reorder alerts</h1>
            <p className="sub">
                Raised automatically when stock in Shopify falls to or below a SKU's or item ID's reorder threshold. Checks run hourly.
            </p>

            {error && <div className="banner error">{error}</div>}
            {notice && <div className="banner notice">{notice}</div>}

            {writable && (
                <p>
                    <button className="primary" onClick={checkNow} disabled={busy}>
                        {checking ? 'Checking…' : 'Check stock now'}
                    </button>
                </p>
            )}

            {writable && selectedAlert && (
                <div className="tile">
                    <h2>Log reorder</h2>
                    <p>{selectedAlert.product_name}</p>
                    <p>{selectedAlert.manufacturer}</p>
                    {loadingSuggestion &&
                        <p role="status">
                            Loading suggested quantity…
                        </p>
                    }
                    <input
                        type="number"
                        min="1"
                        placeholder="Quantity"
                        value={reorder.quantity_ordered}
                        onChange={(e) => updateReorder('quantity_ordered', e.target.value)}
                        onKeyDown={onEnter(submitReorder)}
                        style={{ maxWidth: 120 }}
                        disabled={busy}
                    />
                    <input
                        type="text"
                        placeholder="Notes"
                        value={reorder.notes}
                        onChange={(e) => updateReorder('notes', e.target.value)}
                        onKeyDown={onEnter(submitReorder)}
                        style={{ maxWidth: 120 }}
                        disabled={busy}
                    />
                    <button onClick={submitReorder} disabled={busy}>
                        {submitting ? 'Logging…' : 'Log Reorder'}
                    </button>
                    <button onClick={() => {
                        setSelectedAlert(null);
                        setReorder({ quantity_ordered: '', notes: '' });
                    }} disabled={busy}>
                        Cancel
                    </button>
                </div>
            )}

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
                                            {STATUS_FILTERS.find(f => f.value === alert.status)?.label ?? alert.status}
                                        </span>
                                    </td>
                                    <td>
                                        {writable && alert.status === 'open' && alert.manufacturer_id && (
                                            <button
                                                className="link"
                                                onClick={() => openReorder(alert)}
                                                disabled={busy}
                                            >
                                                Reorder
                                            </button>
                                        )}
                                        {writable && alert.status === 'awaiting' && (
                                            <button
                                                className="link"
                                                onClick={() => setStatus(alert.id, 'resolved')}
                                                disabled={busy}
                                            >
                                                Resolve
                                            </button>
                                        )}
                                        {deletable && (
                                            <button
                                                className="link"
                                                onClick={() => remove(alert.id)}
                                                disabled={busy}
                                            >
                                                Delete
                                            </button>
                                        )}
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