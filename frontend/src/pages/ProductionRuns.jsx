import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { statusPillClass, formatStatus } from '../status.js';
import { onEnter } from '../ui.jsx';

const STATUSES = ['ordered', 'in_production', 'shipped', 'received', 'cancelled'];

export default function ProductionRuns() {
    const [runs, setRuns] = useState(null);
    const [manufacturers, setManufacturers] = useState([]);
    const [products, setProducts] = useState([]);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        manufacturer_id: '',
        product_id: '',
        quantity: '',
        expected_date: '',
        notes: '',
    });

    function load() {
        Promise.all([api('/production-runs'), api('/manufacturers'), api('/products')])
            .then(function ([r, m, p]) {
                setRuns(r.runs);
                setManufacturers(m.manufacturers);
                setProducts(p.products);
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

    async function create() {
        if (saving) return;

        if (!form.manufacturer_id) {
            setError('Choose a manufacturer for this run.');
            return;
        }

        setError('');
        setSaving(true);

        const body = {
            manufacturer_id: Number(form.manufacturer_id),
            product_id: form.product_id ? Number(form.product_id) : null,
            quantity: form.quantity ? Number(form.quantity) : null,
            expected_date: form.expected_date || null,
            notes: form.notes || null,
        };

        try {
            await api('/production-runs', { method: 'POST', body: JSON.stringify(body) });
            setForm({ manufacturer_id: '', product_id: '', quantity: '', expected_date: '', notes: '' });
            load();
        } catch (e) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    }

    async function setStatus(id, status) {
        try {
            await api(`/production-runs/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
            load();
        } catch (e) {
            setError(e.message);
        }
    }

    // The "move to..." select resets to blank after each change, so only act on a real selection.
    function handleStatusChange(id, e) {
        if (e.target.value) {
            setStatus(id, e.target.value);
        }
    }

    return (
        <>
            <h1>Production runs</h1>
            <p className="sub">Track active manufacturing orders from placement to delivery.</p>

            {error && (
                <div className="banner error">{error}</div>
            )}

            <div className="tile" style={{ marginBottom: 18 }}>
                <h2>Start a production run</h2>
                <div className="row">
                    <select
                        value={form.manufacturer_id}
                        onChange={(e) => updateForm('manufacturer_id', e.target.value)}
                    >
                        <option value="">Manufacturer…</option>
                        {manufacturers.map(function (m) {
                            return (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            );
                        })}
                    </select>

                    <select
                        value={form.product_id}
                        onChange={(e) => updateForm('product_id', e.target.value)}
                    >
                        <option value="">Product (optional)…</option>
                        {products.map(function (p) {
                            return (
                                <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
                            );
                        })}
                    </select>

                    <input
                        type="number"
                        min="1"
                        placeholder="Quantity"
                        value={form.quantity}
                        onChange={(e) => updateForm('quantity', e.target.value)}
                        onKeyDown={onEnter(create)}
                        style={{ maxWidth: 110 }}
                    />

                    <input
                        type="date"
                        value={form.expected_date}
                        onChange={(e) => updateForm('expected_date', e.target.value)}
                        onKeyDown={onEnter(create)}
                        style={{ maxWidth: 160 }}
                    />

                    <button
                        className="primary"
                        onClick={create}
                        disabled={saving}
                        style={{ flex: '0 0 auto' }}
                    >
                        {saving ? 'Starting…' : 'Start run'}
                    </button>
                </div>
            </div>

            {!runs ? (
                <p className="empty">Loading…</p>
            ) : runs.length === 0 ? (
                <div className="tile">
                    <p className="empty">No production runs yet.</p>
                </div>
            ) : (
                <div className="tile">
                    <table>
                        <thead>
                            <tr>
                                <th>Manufacturer</th>
                                <th>Product</th>
                                <th className="num">Qty</th>
                                <th>Expected</th>
                                <th>Status</th>
                                <th>Move to…</th>
                            </tr>
                        </thead>
                        <tbody>
                            {runs.map(function (r) {
                                return (
                                    <tr key={r.id}>
                                        <td>{r.manufacturer_name}</td>
                                        <td>{r.sku ? `${r.sku} — ${r.product_name}` : '—'}</td>
                                        <td className="num">{r.quantity ?? '—'}</td>
                                        <td>
                                            {r.expected_date
                                                ? new Date(r.expected_date).toLocaleDateString('en-GB')
                                                : '—'}
                                        </td>
                                        <td>
                                            <span className={statusPillClass(r.status)}>
                                                {formatStatus(r.status)}
                                            </span>
                                        </td>
                                        <td>
                                            <select
                                                value=""
                                                onChange={(e) => handleStatusChange(r.id, e)}
                                                style={{ maxWidth: 150 }}
                                            >
                                                <option value="">change status…</option>
                                                {STATUSES.filter(function (s) {
                                                    return s !== r.status;
                                                }).map(function (s) {
                                                    return (
                                                        <option key={s} value={s}>
                                                            {formatStatus(s)}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                        </td>
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