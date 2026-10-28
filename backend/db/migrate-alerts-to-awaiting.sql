BEGIN;

ALTER TABLE reorder_alerts
DROP CONSTRAINT reorder_alerts_status_check;

DROP INDEX idx_alerts_one_active;

UPDATE reorder_alerts
SET status = 'awaiting'
WHERE status = 'acknowledged';

ALTER TABLE reorder_alerts
    ADD CONSTRAINT reorder_alerts_status_check
        CHECK (status IN ('open', 'awaiting', 'resolved'));

CREATE UNIQUE INDEX idx_alerts_one_active
    ON reorder_alerts(product_id)
    WHERE status IN ('open', 'awaiting');

COMMIT;