-- Migration 012: Add "Insubordination" default behavior (-5 points)
-- Additive and idempotent: only inserts if a matching default row doesn't already exist.

INSERT INTO behaviors (name, points, icon, category, is_custom, user_id)
SELECT 'Insubordination', -5, '🚨', 'negative', false, NULL
WHERE NOT EXISTS (
    SELECT 1 FROM behaviors
    WHERE name = 'Insubordination' AND user_id IS NULL AND is_custom = false
);
