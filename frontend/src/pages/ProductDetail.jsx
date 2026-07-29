import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api.js';
import { statusPillClass, formatStatus } from '../status.js';

const money = (n) => (n == null ? '—' : `$${Number(n).toFixed(2)}`);
const stars = (r) => (r ? '★'.repeat(r) + '☆'.repeat(5 - r) : '—');

// Tiny inline SVG line chart, no charting library needed for a single sparkline.
function Sparkline({ points, width = 260, height = 60 }) {
    if (!points || points.length < 2) {
        return <p className="empty">Not enough sales data for a trend.</p>;
    }

    const vals = points.map((p) => p.units);
    const max = Math.max(...vals, 1);
    const stepX = width / (points.length - 1);
    const coords = vals.map((v, i) => `${(i * stepX).toFixed(1)},${(height - (v / max) * height).toFixed(1)}`);

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ maxWidth: '100%' }}>
            <polyline
                points={coords.join(' ')}
                fill="none"
                stroke="var(--gold, #b8860b)"
                strokeWidth="2"
            />
        </svg>
    );
}

export default function ProductDetail() {
    const { id } = useParams();
    const [data, setData] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        // Avoid setting state after navigating to a different product mid-fetch.
        let active = true;

        setData(null);
        setError('');
        api(`/products/${id}`)
            .then((d) => { if (active) setData(d); })
            .catch((e) => { if (active) setError(e.message); });
        return () => { active = false; };
    }, [id]);

    if (error) {
        return <div className="banner error">{error}</div>;
    }
    if (!data) {
        return <p className="empty">Loading…</p>;
    }

    const p = data.product;
    const m = data.metrics;
    const reviews = data.reviews || [];
    const rated = reviews.filter((r) => r.rating != null);
    const avgRating = rated.length
        ? Math.round(rated.reduce((s, r) => s + r.rating, 0) / rated.length)
        : null;

    const facts = [
        ['SKU / Item ID', p.sku],
        ['Manufacturer', p.manufacturer_name || '—'],
        ['Current inventory', data.current_inventory ?? '—'],
        ['Cost', money(p.unit_cost)],
        ['Retail', money(data.retail_price)],
        ['Margin', m.margin_pct != null ? `${m.margin_pct}%` : '—'],
        ['Units sold (30d)', m.units_sold_30d],
        ['Revenue (30d)', money(m.revenue_30d)],
    ];

    return (
        <>
            <p style={{ marginTop: 0 }}>
                <Link to="/products">← All products</Link>
            </p>

            <div className="row" style={{ alignItems: 'flex-start', gap: 20 }}>
                {data.photo && (
                    <img
                        src={data.photo}
                        alt={p.name}
                        style={{ width: 160, height: 160, objectFit: 'cover', borderRadius: 8, flex: '0 0 auto' }}
                    />
                )}
                <div>
                    <h1 style={{ marginBottom: 4 }}>{p.name}</h1>
                    <p className="sub" style={{ marginTop: 0 }}>{p.sku}</p>
                </div>
            </div>

            <div className="grid">
                <section className="tile">
                    <h2>At a glance</h2>
                    <table>
                        <tbody>
                            {facts.map(([label, value]) => (
                                <tr key={label}>
                                    <td style={{ color: 'var(--muted)' }}>{label}</td>
                                    <td className="num"><strong>{value}</strong></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>

                <section className="tile">
                    <h2>30-day trend</h2>
                    <p className="sub" style={{ marginTop: 0 }}>Daily units sold</p>
                    <Sparkline points={data.trend} />
                </section>

                <section className="tile">
                    <h2>
                        Reviews{' '}
                        {avgRating != null && (
                            <span style={{ color: 'var(--muted)', fontSize: 14 }}>
                                {stars(avgRating)} ({reviews.length})
                            </span>
                        )}
                    </h2>
                    {reviews.length === 0 ? (
                        <p className="empty">No reviews yet.</p>
                    ) : (
                        reviews.map((r) => (
                            <div key={r.id} style={{ borderBottom: '1px solid var(--line)', padding: '8px 0' }}>
                                <div style={{ color: 'var(--gold, #b8860b)' }}>{stars(r.rating)}</div>
                                <div>{r.body}</div>
                                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                                    {r.author}
                                    {r.created_at ? ` · ${new Date(r.created_at).toLocaleDateString('en-GB')}` : ''}
                                </div>
                            </div>
                        ))
                    )}
                </section>

                <section className="tile">
                    <h2>Reorder history</h2>
                    {data.reorder_history.length === 0 ? (
                        <p className="empty">No reorders logged yet.</p>
                    ) : (
                        <table>
                            <tbody>
                                {data.reorder_history.map((r) => (
                                    <tr key={r.id}>
                                        <td>{new Date(r.ordered_at).toLocaleDateString('en-GB')}</td>
                                        <td>{r.manufacturer_name || '—'}</td>
                                        <td className="num">{r.quantity_ordered} units</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </section>

                <section className="tile">
                    <h2>Production history</h2>
                    {data.production_runs.length === 0 ? (
                        <p className="empty">No production runs.</p>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th className="num">Qty</th>
                                    <th>Status</th>
                                    <th>Expected</th>
                                    <th>Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.production_runs.map((r) => (
                                    <tr key={r.id}>
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
                                ))}
                            </tbody>
                        </table>
                    )}
                </section>
            </div>
        </>
    );
}
