import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useTableView, SortHeader, SearchBox, onEnter } from '../ui.jsx';

const ROLES = ['admin', 'developer', 'ops_manager', 'marketing', 'partner'];

const EMPTY_FORM = { email: '', full_name: '', password: '', role: 'marketing' };

// Team access page: manage users, roles, and password resets.
export default function Users() {
    const [users, setUsers] = useState(null);
    const [error, setError] = useState('');
    const [form, setForm] = useState(EMPTY_FORM);
    // Which user's password is being reset, and the value typed so far.
    const [resetId, setResetId] = useState(null);
    const [resetPwd, setResetPwd] = useState('');
    const [busy, setBusy] = useState(false);
    const { query, setQuery, view, sort, toggleSort } = useTableView(users, ['full_name', 'email', 'role']);

    function load() {
        return api('/users')
            .then((d) => setUsers(d.users))
            .catch((e) => setError(e.message));
    }

    useEffect(() => { load(); }, []);

    function updateForm(field, value) {
        setForm((prev) => ({ ...prev, [field]: value }));
    }

    // Submits the new team member form.
    async function createUser() {
        if (busy) return;

        setError('');
        setBusy(true);
        try {
            await api('/users', { method: 'POST', body: JSON.stringify(form) });
            setForm(EMPTY_FORM);
            await load();
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    }

    // Sends a partial update (role, active state, password) for a user.
    async function patchUser(id, body) {
        try {
            await api(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
            load();
        } catch (e) {
            setError(e.message);
        }
    }

    // Only one row's password reset form is open at a time, tracked by user id.
    function startReset(user) {
        setError('');
        setResetPwd('');
        setResetId(user.id);
    }

    function cancelReset() {
        setResetId(null);
        setResetPwd('');
    }

    // Validates and submits a password reset for a user.
    async function submitReset(user) {
        if (busy) return;
        if (resetPwd.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }
        setError('');
        setBusy(true);
        try {
            await patchUser(user.id, { password: resetPwd });
            cancelReset();
        } finally {
            setBusy(false);
        }
    }

    function renderRoleOptions() {
        return ROLES.map((role) => (
            <option key={role} value={role}>{role.replace('_', ' ')}</option>
        ));
    }

    function renderStatusPill(isActive) {
        if (isActive) {
            return <span className="pill ok">Active</span>;
        }
        return <span className="pill low">Deactivated</span>;
    }

    // Renders one table row for a user, with role/status controls.
    function renderRow(user) {
        return (
            <tr key={user.id}>
                <td>{user.full_name}</td>
                <td>{user.email}</td>
                <td>
                    <select
                        value={user.role}
                        onChange={(e) => patchUser(user.id, { role: e.target.value })}
                        style={{ maxWidth: 150 }}
                    >
                        {renderRoleOptions()}
                    </select>
                </td>
                <td>{renderStatusPill(user.is_active)}</td>
                <td>
                    <button
                        className="link"
                        onClick={() => patchUser(user.id, { is_active: !user.is_active })}
                    >
                        {user.is_active ? 'Deactivate' : 'Reactivate'}
                    </button>
                    {' · '}
                    {resetId === user.id ? (
                        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                            <input
                                type="password"
                                autoComplete="new-password"
                                placeholder="New password (min 8)"
                                value={resetPwd}
                                onChange={(e) => setResetPwd(e.target.value)}
                                onKeyDown={onEnter(() => submitReset(user))}
                                style={{ maxWidth: 170 }}
                            />
                            <button className="link" onClick={() => submitReset(user)} disabled={busy}>Set</button>
                            <button className="link" onClick={cancelReset} disabled={busy}>Cancel</button>
                        </span>
                    ) : (
                        <button className="link" onClick={() => startReset(user)}>
                            Reset password
                        </button>
                    )}
                </td>
            </tr>
        );
    }

    return (
        <>
            <h1>Team access</h1>
            <p className="sub">Add team members and choose which parts of the hub each role can see.</p>

            {error && <div className="banner error">{error}</div>}

            <div className="tile" style={{ marginBottom: 18 }}>
                <h2>Add team member</h2>
                <div className="row">
                    <input
                        placeholder="Full name"
                        value={form.full_name}
                        onChange={(e) => updateForm('full_name', e.target.value)}
                        onKeyDown={onEnter(createUser)}
                    />
                    <input
                        placeholder="Email"
                        type="email"
                        value={form.email}
                        onChange={(e) => updateForm('email', e.target.value)}
                        onKeyDown={onEnter(createUser)}
                    />
                    <input
                        placeholder="Password (min 8 chars)"
                        type="password"
                        value={form.password}
                        onChange={(e) => updateForm('password', e.target.value)}
                        onKeyDown={onEnter(createUser)}
                    />
                    <select
                        value={form.role}
                        onChange={(e) => updateForm('role', e.target.value)}
                        style={{ maxWidth: 160 }}
                    >
                        {renderRoleOptions()}
                    </select>
                    <button className="primary" onClick={createUser} disabled={busy} style={{ flex: '0 0 auto' }}>
                        {busy ? 'Adding…' : 'Add'}
                    </button>
                </div>
            </div>

            {!users ? (
                <p className="empty">Loading…</p>
            ) : (
                <div className="tile">
                    <div className="toolbar">
                        <SearchBox
                            query={query}
                            setQuery={setQuery}
                            placeholder="Search name, email, role…"
                        />
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <SortHeader label="Name" sortKey="full_name" sort={sort} toggleSort={toggleSort} />
                                <SortHeader label="Email" sortKey="email" sort={sort} toggleSort={toggleSort} />
                                <SortHeader label="Role" sortKey="role" sort={sort} toggleSort={toggleSort} />
                                <SortHeader label="Status" sortKey="is_active" sort={sort} toggleSort={toggleSort} />
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {view.length === 0 ? (
                                <tr><td colSpan={5} className="empty">No users match “{query}”.</td></tr>
                            ) : view.map(renderRow)}
                        </tbody>
                    </table>
                </div>
            )}
        </>
    );
}