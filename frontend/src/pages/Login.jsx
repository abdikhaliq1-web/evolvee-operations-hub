import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setSession } from '../api.js';

// Network failures surface as 'Failed to fetch'; show something clearer.
function resolveErrorMessage(err) {
    if (err.message === 'Failed to fetch') {
        return 'Cannot reach the server. Is the backend running?';
    }
    return err.message;
}

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const navigate = useNavigate();

    async function submit() {
        setBusy(true);
        setError('');

        try {
            // Plain fetch, not api(): no token exists yet.
            const res = await fetch(`${import.meta.env.VITE_API_BASE || ''}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.error || 'Sign in failed.');
            }
            if (!data.token) {
                throw new Error('Unexpected response — check VITE_API_BASE points to the backend.');
            }

            setSession(data.token, data.user);
            navigate('/');
        } catch (err) {
            setError(resolveErrorMessage(err));
        } finally {
            setBusy(false);
        }
    }

    function handleKeyDown(e) {
        if (e.key === 'Enter') {
            submit();
        }
    }

    return (
        <div className="login-wrap">
            <div className="login-card">
                <div className="wordmark">Evolvée Radiance</div>
                <p className="tag">Operations Hub - sign in to continue</p>

                {error && (
                    <div className="banner error">{error}</div>
                )}

                <div className="field">
                    <label htmlFor="email">Email</label>
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onKeyDown={handleKeyDown}
                        autoComplete="username"
                    />
                </div>

                <div className="field">
                    <label htmlFor="password">Password</label>
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={handleKeyDown}
                        autoComplete="current-password"
                    />
                </div>

                <button
                    className="primary"
                    style={{ width: '100%' }}
                    onClick={submit}
                    disabled={busy}
                >
                    {busy ? 'Signing in…' : 'Sign in'}
                </button>
            </div>
        </div>
    );
}