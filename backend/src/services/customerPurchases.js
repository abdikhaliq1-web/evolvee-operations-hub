// groups orders by customer email, finds each customer's favorite product
function aggregateCustomerPurchases(orders) {
    const byEmail = {};

    for (const order of orders) {
        const rawEmail = order.customer && order.customer.email;
        if (!rawEmail) continue;
        const email = rawEmail.toLowerCase();

        if (!byEmail[email]) {
            byEmail[email] = { unitsBySku: {}, titleBySku: {}, history: [] };
        }

        const entry = byEmail[email];
        const items = [];

        for (const li of (order.line_items || [])) {
            const key = li.sku || li.title;
            const qty = li.quantity || 0;
            entry.unitsBySku[key] = (entry.unitsBySku[key] || 0) + qty;
            entry.titleBySku[key] = li.title || key;
            items.push({ title: li.title || key, qty: qty });
        }

        entry.history.push({
            date: (order.created_at || '').slice(0, 10),
            order: order.name || '',
            total: Number(order.total_price || 0),
            items: items
        });
    }

    const result = {};

    for (const email of Object.keys(byEmail)) {
        const entry = byEmail[email];

        // Favorite = highest units purchased across all of this customer's SKUs.
        let favSku = null;
        let favUnits = 0;
        for (const sku of Object.keys(entry.unitsBySku)) {
            if (entry.unitsBySku[sku] > favUnits) {
                favUnits = entry.unitsBySku[sku];
                favSku = sku;
            }
        }

        // Most recent order first.
        entry.history.sort((a, b) => (a.date < b.date ? 1 : -1));

        result[email] = {
            favorite_title: favSku ? entry.titleBySku[favSku] : null,
            favorite_units: favUnits,
            history: entry.history
        };
    }

    return result;
}

module.exports = { aggregateCustomerPurchases };
