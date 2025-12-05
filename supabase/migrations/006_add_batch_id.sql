-- Add batch_id column to point_transactions for grouping class-wide awards
-- This allows undo to delete all transactions created together

ALTER TABLE point_transactions
ADD COLUMN batch_id UUID DEFAULT NULL;

-- Index for efficient batch lookups during undo
CREATE INDEX idx_point_transactions_batch_id
ON point_transactions(batch_id)
WHERE batch_id IS NOT NULL;

-- Comment explaining the column
COMMENT ON COLUMN point_transactions.batch_id IS 'Groups transactions created together (e.g., class-wide awards) for batch undo';
