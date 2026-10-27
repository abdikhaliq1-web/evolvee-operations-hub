class ReorderValidationError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'ReorderValidationError';
    }
}

// Shares functionality between logging reorders
async function reorder(body, manufacturerId, userId, db) {
    const productId = body.product_id;
    const quantityOrdered = body.quantity_ordered;
    const orderedAt = body.ordered_at;
    const notes = body.notes;

    if (!productId || !quantityOrdered) {
        throw new ReorderValidationError(
            'INVALID_FIELDS',
            'product_id and quantity_ordered are required.');
    }

    if (!manufacturerId) {
        throw new ReorderValidationError(
            'MANUFACTURER_ASSIGNMENT',
            'The product needs an assigned manufacturer!');
    }

    if(!Number.isInteger(quantityOrdered) || quantityOrdered <= 0) {
        throw new ReorderValidationError(
            'INVALID_QUANTITY',
            'Quantity must be a positive whole number.');
    }

    const orderedAtValue = orderedAt || null;
    const notesValue = notes || null;

    const sql =
        'INSERT INTO reorder_history ' +
        '    (product_id, manufacturer_id, quantity_ordered, ordered_at, notes, created_by) ' +
        'VALUES ($1, $2, $3, COALESCE($4, CURRENT_DATE), $5, $6) ' +
        'RETURNING *';

    const result = await db.query(
        sql,
        [productId,
        manufacturerId,
        quantityOrdered,
        orderedAtValue,
        notesValue,
        userId]);

    const row = { reorder : result.rows[0] };

    if (!row.reorder || !row.reorder.id) {
        throw new Error("Reorder insert returned no row.");
    }

    return row;
}

module.exports = { reorder, ReorderValidationError };