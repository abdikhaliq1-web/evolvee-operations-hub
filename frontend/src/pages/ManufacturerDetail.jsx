import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { api } from '../api.js';
import { statusPillClass, formatStatus } from '../status.js';
import { onEnter } from '../ui.jsx';

const CHANNELS = ['email', 'phone', 'meeting', 'other'];

export default function ManufacturerDetail() {
    const { id } = useParams();
    const [params] = useSearchParams();
    const prefilled = useRef(false);
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [comm, setComm] = useState({ channel: 'email', summary: '' });
    const [contact, setContact] = useState({ name: '', role: '', email: '', phone: '' });
    const [reorder, setReorder] = useState({ product_id: '', quantity_ordered: '', notes: '' });
    const [metrics, setMetrics] = useState({ lead_time_days: '', min_order_quantity: '', payment_terms: '', quality_rating: '' });
    const [busy, setBusy] = useState(false);

    const load = useCallback(function loadManufacturer() {
        api(`/manufacturers/${id}`)
            .then(setData)
            .catch(function (e) {
                setError(e.message);
            });
    }, [id]);

    useEffect(function () {
        load();
    }, [load]);

    // Seed the metrics form whenever fresh manufacturer data arrives.
    useEffect(function () {
        if (data && data.manufacturer) {
            const m = data.manufacturer;
            setMetrics({
                lead_time_days: m.lead_time_days ?? '',
                min_order_quantity: m.min_order_quantity ?? '',
                payment_terms: m.payment_terms ?? '',
                quality_rating: m.quality_rating ?? '',
            });
        }
    }, [data]);

    // Prefill the reorder form when arriving via a "Reorder" link with a product in the query string.
    // Only runs once per page load (guarded by the prefilled ref).
    useEffect(function () {
        if (prefilled.current || !data) return;

        const pid = params.get('reorder_product');
        if (!pid || !data.products.some((p) => String(p.id) === pid)) return;

        prefilled.current = true;
        const lastOrder = data.reorder_history.find((r) => String(r.product_id) === pid);
        const qty = lastOrder
            ? String(lastOrder.quantity_ordered)
            : data.manufacturer.min_order_quantity
                ? String(data.manufacturer.min_order_quantity)
                : '';

        setReorder({ product_id: pid, quantity_ordered: qty, notes: '' });
        document.querySelector('[data-reorder-form]')
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [data, params]);

    // POST a sub-resource, then clear its form and reload.
    async function post(path, body, reset) {
        if (busy) return;
        setError('');
        setBusy(true);
        try {
            await api(path, { method: 'POST', body: JSON.stringify(body) });
            reset();
            load();
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    }

    function updateContact(field, value) {
        setContact(function (prev) {
            return { ...prev, [field]: value };
        });
    }

    function updateComm(field, value) {
        setComm(function (prev) {
            return { ...prev, [field]: value };
        });
    }

    function updateReorder(field, value) {
        setReorder(function (prev) {
            return { ...prev, [field]: value };
        });
    }

    function updateMetrics(field, value) {
        setMetrics(function (prev) {
            return { ...prev, [field]: value };
        });
    }

    async function saveMetrics() {
        if (busy) return;
        setError('');
        setBusy(true);
        try {
            await api(`/manufacturers/${id}`, { method: 'PATCH', body: JSON.stringify(metrics) });
            load();
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    }

    function submitContact() {
        post(
            `/manufacturers/${id}/contacts`,
            contact,
            function () {
                setContact({ name: '', role: '', email: '', phone: '' });
            }
        );
    }

    function submitComm() {
        post(
            `/manufacturers/${id}/communications`,
            comm,
            function () {
                setComm({ channel: 'email', summary: '' });
            }
        );
    }

    function submitReorder() {
        // Select and input values are strings; the API wants numbers.
        const body = {
            ...reorder,
            product_id: Number(reorder.product_id),
            quantity_ordered: Number(reorder.quantity_ordered),
        };
        post(
            `/manufacturers/${id}/reorders`,
            body,
            function () {
                setReorder({ product_id: '', quantity_ordered: '', notes: '' });
            }
        );
    }

    if (error && !data) {
        return <div className="banner error">{error}</div>;
    }

    if (!data) {
        return <p className="empty">Loading…</p>;
    }

    const m = data.manufacturer;

    return (
        <>
            <p style={{ marginTop: 0 }}>
                <Link to="/manufacturers">← All manufacturers</Link>
            </p>

            <h1>{m.name}</h1>

            <p className="sub">
                {m.country || ''}
                {m.notes ? ` — ${m.notes}` : ''}
            </p>

            {error && (
                <div className="banner error">{error}</div>
            )}

            <div className="grid">
                <section className="tile">
                    <h2>Supplier metrics</h2>

                    <div className="row">
                        <div className="field" style={{ flex: 1 }}>
                            <label>Lead time (days)</label>
                            <input
                                type="number"
                                min="0"
                                value={metrics.lead_time_days}
                                onChange={(e) => updateMetrics('lead_time_days', e.target.value)}
                                onKeyDown={onEnter(saveMetrics)}
                            />
                        </div>
                        <div className="field" style={{ flex: 1 }}>
                            <label>Min order qty</label>
                            <input
                                type="number"
                                min="0"
                                value={metrics.min_order_quantity}
                                onChange={(e) => updateMetrics('min_order_quantity', e.target.value)}
                                onKeyDown={onEnter(saveMetrics)}
                            />
                        </div>
                    </div>

                    <div className="row">
                        <div className="field" style={{ flex: 1 }}>
                            <label>Payment terms</label>
                            <input
                                placeholder="e.g. Net 30"
                                value={metrics.payment_terms}
                                onChange={(e) => updateMetrics('payment_terms', e.target.value)}
                                onKeyDown={onEnter(saveMetrics)}
                            />
                        </div>
                        <div className="field" style={{ flex: 1 }}>
                            <label>Quality (1-5)</label>
                            <input
                                type="number"
                                min="1"
                                max="5"
                                value={metrics.quality_rating}
                                onChange={(e) => updateMetrics('quality_rating', e.target.value)}
                                onKeyDown={onEnter(saveMetrics)}
                            />
                        </div>
                    </div>

                    <p style={{ color: 'var(--muted)', fontSize: 13 }}>
                        Avg production time:{' '}
                        <strong style={{ color: 'var(--ink)' }}>
                            {m.avg_production_days != null ? `${m.avg_production_days} days` : '—'}
                        </strong>{' '}
                        (from received production runs)
                    </p>

                    <p>
                        <button className="primary" onClick={saveMetrics} disabled={busy}>Save metrics</button>
                    </p>
                </section>

                <section className="tile">
                    <h2>Points of contact</h2>

                    {data.contacts.length === 0 && (
                        <p className="empty">No contacts yet — add the first one below.</p>
                    )}

                    <table>
                        <tbody>
                            {data.contacts.map(function (c) {
                                return (
                                    <tr key={c.id}>
                                        <td>
                                            <strong>{c.name}</strong>
                                            <br />
                                            <span style={{ color: 'var(--muted)', fontSize: 12.5 }}>
                                                {c.role}
                                            </span>
                                        </td>
                                        <td>
                                            {c.email}
                                            <br />
                                            <span style={{ color: 'var(--muted)' }}>{c.phone}</span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    <h3 style={{ fontSize: 13, marginTop: 16 }}>Add contact</h3>

                    <div className="row">
                        <input
                            placeholder="Name"
                            value={contact.name}
                            onChange={(e) => updateContact('name', e.target.value)}
                            onKeyDown={onEnter(submitContact)}
                        />
                        <input
                            placeholder="Role"
                            value={contact.role}
                            onChange={(e) => updateContact('role', e.target.value)}
                            onKeyDown={onEnter(submitContact)}
                        />
                    </div>

                    <div className="row" style={{ marginTop: 10 }}>
                        <input
                            placeholder="Email"
                            value={contact.email}
                            onChange={(e) => updateContact('email', e.target.value)}
                            onKeyDown={onEnter(submitContact)}
                        />
                        <input
                            placeholder="Phone"
                            value={contact.phone}
                            onChange={(e) => updateContact('phone', e.target.value)}
                            onKeyDown={onEnter(submitContact)}
                        />
                    </div>

                    <p>
                        <button className="primary" onClick={submitContact} disabled={busy}>
                            Add contact
                        </button>
                    </p>
                </section>

                <section className="tile">
                    <h2>Communication log</h2>

                    {data.communications.length === 0 && (
                        <p className="empty">Nothing logged yet.</p>
                    )}

                    <table>
                        <tbody>
                            {data.communications.map(function (c) {
                                return (
                                    <tr key={c.id}>
                                        <td style={{ width: 90 }}>
                                            <span className="pill info">{c.channel}</span>
                                            <br />
                                            <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                                                {new Date(c.logged_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                                            </span>
                                        </td>
                                        <td>
                                            {c.summary}
                                            {c.logged_by_name && (
                                                <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)' }}>
                                                    — {c.logged_by_name}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    <h3 style={{ fontSize: 13, marginTop: 16 }}>Log a communication</h3>

                    <div className="row">
                        <select
                            value={comm.channel}
                            onChange={(e) => updateComm('channel', e.target.value)}
                            style={{ maxWidth: 130 }}
                        >
                            {CHANNELS.map(function (c) {
                                return <option key={c}>{c}</option>;
                            })}
                        </select>
                        <textarea
                            rows={2}
                            placeholder="What was discussed or agreed"
                            value={comm.summary}
                            onChange={(e) => updateComm('summary', e.target.value)}
                        />
                    </div>

                    <p>
                        <button className="primary" onClick={submitComm} disabled={busy}>
                            Save log entry
                        </button>
                    </p>
                </section>

                <section className="tile">
                    <h2>Products made here</h2>

                    {data.products.length === 0 ? (
                        <p className="empty">
                            No SKUs / item IDs assigned. Assign products on the{' '}
                            <Link to="/products">Products &amp; thresholds</Link> page.
                        </p>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>SKU / Item ID</th>
                                    <th>Product</th>
                                    <th className="num">Reorder threshold</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.products.map(function (p) {
                                    return (
                                        <tr key={p.id}>
                                            <td>{p.sku}</td>
                                            <td>{p.name}</td>
                                            <td className="num">{p.threshold ?? '—'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </section>

                <section className="tile" data-reorder-form>
                    <h2>Reorder history</h2>

                    {data.reorder_history.length === 0 && (
                        <p className="empty">No reorders logged yet.</p>
                    )}

                    <table>
                        <tbody>
                            {data.reorder_history.map(function (r) {
                                return (
                                    <tr key={r.id}>
                                        <td>{new Date(r.ordered_at).toLocaleDateString('en-GB')}</td>
                                        <td>{r.sku} — {r.product_name}</td>
                                        <td className="num">{r.quantity_ordered} units</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    <h3 style={{ fontSize: 13, marginTop: 16 }}>Log a reorder</h3>

                    <div className="row">
                        <select
                            value={reorder.product_id}
                            onChange={(e) => updateReorder('product_id', e.target.value)}
                        >
                            <option value="">Choose product…</option>
                            {data.products.map(function (p) {
                                return (
                                    <option key={p.id} value={p.id}>
                                        {p.sku} — {p.name}
                                    </option>
                                );
                            })}
                        </select>
                        <input
                            type="number"
                            min="1"
                            placeholder="Quantity"
                            value={reorder.quantity_ordered}
                            onChange={(e) => updateReorder('quantity_ordered', e.target.value)}
                            onKeyDown={onEnter(submitReorder)}
                            style={{ maxWidth: 120 }}
                        />
                    </div>

                    <p>
                        <button className="primary" onClick={submitReorder} disabled={busy}>
                            Log reorder
                        </button>
                    </p>
                </section>

                <section className="tile wide">
                    <h2>Production runs</h2>

                    {data.production_runs.length === 0 ? (
                        <p className="empty">
                            No production runs. Start one from the{' '}
                            <Link to="/production">Production runs</Link> page.
                        </p>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th className="num">Qty</th>
                                    <th>Status</th>
                                    <th>Expected</th>
                                    <th>Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.production_runs.map(function (r) {
                                    return (
                                        <tr key={r.id}>
                                            <td>{r.sku ? `${r.sku} — ${r.product_name}` : '—'}</td>
                                            <td className="num">{r.quantity ?? '—'}</td>
                                            <td>
                                                <span className={statusPillClass(r.status)}>
                                                    {formatStatus(r.status)}
                                                </span>
                                            </td>
                                            <td>
                                                {r.expected_date
                                                    ? new Date(r.expected_date).toLocaleDateString('en-GB')
                                                    : '—'}
                                            </td>
                                            <td style={{ color: 'var(--muted)' }}>{r.notes || ''}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </section>
            </div>
        </>
    );
}