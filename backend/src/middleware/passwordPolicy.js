const MIN_PASSWORD_LENGTH = 12;

const WEAK_PASSWORDS = [
    'password', 'passw0rd', 'letmein', 'welcome', 'qwerty', 'iloveyou',
    'admin', 'administrator', 'changeme', 'secret', 'monkey', 'dragon',
    'radiance', 'evolvee', 'opshub', 'shopify',
    '123456', '1234567', '12345678', '123456789', '1234567890', '111111', 'abc123'
];

function passwordProblem(password, email) {
    const value = String(password == null ? '' : password);

    if (value.length < MIN_PASSWORD_LENGTH) {
        return 'Password must be at least ' + MIN_PASSWORD_LENGTH + ' characters.';
    }

    const lowered = value.toLowerCase();

    if (WEAK_PASSWORDS.some((weak) => lowered.startsWith(weak))) {
        return 'That password starts with a commonly guessed word. Choose something less predictable.';
    }

    if (new Set(lowered).size < 5) {
        return 'Password must use at least 5 different characters.';
    }

    const localPart = email ? String(email).toLowerCase().split('@')[0] : '';

    if (localPart.length >= 3 && lowered.includes(localPart)) {
        return 'Password must not contain your email address.';
    }

    return null;
}

if (require.main === module) {
    const assert = require('assert');

    assert.strictEqual(passwordProblem('a-perfectly-fine-passphrase', 'jo@x.com'), null);
    assert.strictEqual(passwordProblem('correct horse battery staple', 'jo@x.com'), null);

    assert.ok(passwordProblem('short1234', 'jo@x.com').includes('12 characters'));
    assert.ok(passwordProblem('radiance123', 'jo@x.com').includes('12 characters'));
    assert.ok(passwordProblem('radiance123456', 'jo@x.com').includes('commonly guessed'));
    assert.ok(passwordProblem('Password123456', 'jo@x.com').includes('commonly guessed'));
    assert.ok(passwordProblem('aaaaaaaaaaaaaaa', 'jo@x.com').includes('different characters'));
    assert.ok(passwordProblem('mason-is-right-here', 'mason@x.com').includes('email'));
    assert.ok(passwordProblem(null, 'jo@x.com').includes('12 characters'));
    assert.ok(passwordProblem(undefined, null).includes('12 characters'));
    assert.strictEqual(passwordProblem('mason-is-right-here', null), null);

    console.log('passwordPolicy self-check passed.');
}

module.exports = { passwordProblem, MIN_PASSWORD_LENGTH };
