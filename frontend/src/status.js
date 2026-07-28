// Maps a status value to a CSS class for the colored status pill.
export function statusPillClass(status) {
    if (status === 'received') return 'pill ok';
    if (status === 'cancelled') return 'pill low';

    return 'pill info';
}

// Turns a status code into readable text.
export function formatStatus(status) {
    return status.replace('_', ' ');
}
