// Express route param handler for ':id' - rejects non-positive-integer ids before the route runs.
function validateId(req, res, next, value) {
    const id = Number(value);

    if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({ error: 'Invalid id.' });
    }

    next();
}

module.exports = { validateId };
