export function statusPillClass(status) {
    if (status === 'received') return 'pill ok';
    if (status === 'cancelled') return 'pill low';

    return 'pill info';
}

export function formatStatus(status) {
    return status.replace('_', ' ');
}
