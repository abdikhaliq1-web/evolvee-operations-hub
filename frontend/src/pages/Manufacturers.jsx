import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useTableView, SortHeader, SearchBox, onEnter } from '../ui.jsx';

// Renders the "last contacted" table cell, flags it if stale.
function lastContactCell(iso) {
    if (!iso) return <span className="pill warn">Never</span>;

    const days = Math.round((Date.now() - new Date(iso)) / 86400000);
    const label = new Date(iso).toLocaleDateString('en-GB');

    // Flag stale relationships (no contact in over a month).
    return days > 30
        ? <span className="pill warn" title={`${days} days ago`}>{label}</span>
        : label;
}

// Manufacturers list page: Shows suppliers and lets user add new ones.
export default function Manufacturers() {
    const [list, setList] = useState(null);
    const [error, setError] = useState('');
    const [form, setForm] = useState({ name: '', country: '', notes: '', lead_time_days: '', min_order_quantity: '', payment_terms: '', quality_rating: '' });
    const [adding, setAdding] = useState(false);
    const [saving, setSaving] = useState(false);
    const { query, setQuery, view, sort, toggleSort } = useTableView(list, ['name', 'country', 'notes']);

    // Fetches the manufacturer list from the server.
    function load() {
        api('/manufacturers')
            .then(function (d) {
                setList(d.manufacturers);
            })
            .catch(function (e) {
                setError(e.message);
            });
    }

    useEffect(function () {
        load();
    }, []);

    function updateForm(field, value) {
        setForm(function (prev) {
            return { ...prev, [field]: value };
        });
    }

    // Validates and submits the new manufacturer form.
    async function create() {
        if (saving) return;
        // Name is the only required field.
        if (!form.name.trim()) {
            setError('Manufacturer name is required.');
            return;
        }

        setError('');
        setSaving(true);

        try {
            await api('/manufacturers', { method: 'POST', body: JSON.stringify(form) });
            setForm({ name: '', country: '', notes: '', lead_time_days: '', min_order_quantity: '', payment_terms: '', quality_rating: '' });
            setAdding(false);
            load();
        } catch (e) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <>
            <h1>Manufacturers &amp; suppliers</h1>
            <p className="sub">
                Every supplier relationship in one place — contacts, products, and history.
            </p>

            {error && (
                <div className="banner error">{error}</div>
            )}

            {adding ? (
                <div className="tile" style={{ marginBottom: 18, maxWidth: 560 }}>
                    <h2>New manufacturer</h2>

                    <div className="field">
                        <label>Name</label>
                        <input
                            value={form.name}
                            onChange={(e) => updateForm('name', e.target.value)}
                            onKeyDown={onEnter(create)}
                        />
                    </div>

                    <div className="field">
                        <label>Country</label>
                        <input
                            value={form.country}
                            onChange={(e) => updateForm('country', e.target.value)}
                            onKeyDown={onEnter(create)}
                        />
                    </div>

                    <div className="row">
                        <div className="field" style={{ flex: 1 }}>
                            <label>Lead time (days)</label>
                            <input
                                type="number"
                                min="0"
                                value={form.lead_time_days}
                                onChange={(e) => updateForm('lead_time_days', e.target.value)}
                                onKeyDown={onEnter(create)}
                            />
                        </div>
                        <div className="field" style={{ flex: 1 }}>
                            <label>Min order qty</label>
                            <input
                                type="number"
                                min="0"
                                value={form.min_order_quantity}
                                onChange={(e) => updateForm('min_order_quantity', e.target.value)}
                                onKeyDown={onEnter(create)}
                            />
                        </div>
                    </div>

                    <div className="row">
                        <div className="field" style={{ flex: 1 }}>
                            <label>Payment terms</label>
                            <input
                                placeholder="e.g. Net 30"
                                value={form.payment_terms}
                                onChange={(e) => updateForm('payment_terms', e.target.value)}
                                onKeyDown={onEnter(create)}
                            />
                        </div>
                        <div className="field" style={{ flex: 1 }}>
                            <label>Quality (1-5)</label>
                            <input
                                type="number"
                                min="1"
                                max="5"
                                value={form.quality_rating}
                                onChange={(e) => updateForm('quality_rating', e.target.value)}
                                onKeyDown={onEnter(create)}
                            />
                        </div>
                    </div>

                    <div className="field">
                        <label>Notes</label>
                        <textarea
                            rows={2}
                            value={form.notes}
                            onChange={(e) => updateForm('notes', e.target.value)}
                        />
                    </div>

                    <div className="row" style={{ maxWidth: 280 }}>
                        <button className="primary" onClick={create} disabled={saving}>
                            {saving ? 'Saving…' : 'Save manufacturer'}
                        </button>
                        <button onClick={() => setAdding(false)} disabled={saving}>Cancel</button>
                    </div>
                </div>
            ) : (
                <p>
                    <button className="primary" onClick={() => setAdding(true)}>
                        Add manufacturer
                    </button>
                </p>
            )}

            {!list ? (
                <p className="empty">Loading…</p>
            ) : (
                <div className="tile">
                    <div className="toolbar">
                        <SearchBox
                            query={query}
                            setQuery={setQuery}
                            placeholder="Search name, country, notes…"
                        />
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <SortHeader label="Name" sortKey="name" sort={sort} toggleSort={toggleSort} />
                                <SortHeader label="Country" sortKey="country" sort={sort} toggleSort={toggleSort} />
                                <SortHeader label="Products" sortKey="product_count" sort={sort} toggleSort={toggleSort} className="num" />
                                <SortHeader label="Active runs" sortKey="active_runs" sort={sort} toggleSort={toggleSort} className="num" />
                                <SortHeader label="Lead time (d)" sortKey="lead_time_days" sort={sort} toggleSort={toggleSort} className="num" />
                                <SortHeader label="Quality" sortKey="quality_rating" sort={sort} toggleSort={toggleSort} className="num" />
                                <SortHeader label="Last contacted" sortKey="last_contacted" sort={sort} toggleSort={toggleSort} />
                                <th>Notes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {view.length === 0 && (
                                <tr><td colSpan={8} className="empty">No manufacturers match “{query}”.</td></tr>
                            )}
                            {view.map(function (m) {
                                return (
                                    <tr key={m.id}>
                                        <td>
                                            <Link to={`/manufacturers/${m.id}`}>
                                                <strong>{m.name}</strong>
                                            </Link>
                                        </td>
                                        <td>{m.country || '—'}</td>
                                        <td className="num">{m.product_count}</td>
                                        <td className="num">{m.active_runs}</td>
                                        <td className="num">{m.lead_time_days ?? '—'}</td>
                                        <td className="num">{m.quality_rating ? `${m.quality_rating}/5` : '—'}</td>
                                        <td>{lastContactCell(m.last_contacted)}</td>
                                        <td style={{ color: 'var(--muted)' }}>{m.notes || ''}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </>
    );
}