// Dashboard tile reordering

export function applyOrder(items, order) {
    if (!order || order.length === 0) return items;

    const rank = new Map(order.map((id, i) => [id, i]));
    // Items not present in the saved order sort last.
    const at = (id) => (rank.has(id) ? rank.get(id) : Infinity);

    return items
        .map((item, i) => ({ item, i }))
        .sort((a, b) => at(a.item.id) - at(b.item.id) || a.i - b.i)
        .map((x) => x.item);
}

// Uses the diagonal of the drop target to decide before/after, not just a midline.
export function dropBefore(rect, x, y) {
    const nx = (x - rect.left) / rect.width;
    const ny = (y - rect.top) / rect.height;

    return nx + ny < 1;
}

export function reorder(ids, dragId, dropId, before = true) {
    if (dragId === dropId) return ids;

    const next = ids.filter((id) => id !== dragId);
    let idx = next.indexOf(dropId);

    if (idx === -1) return ids;
    if (!before) idx += 1;

    next.splice(idx, 0, dragId);

    return next;
}
