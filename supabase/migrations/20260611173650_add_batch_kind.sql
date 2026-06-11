-- Add batch_kind column to point_transactions for durable cross-device undo labels
-- (deferred #7). 'class' = entire-class award, 'subset' = multi-select award.
-- NULL = legacy/pre-migration batches, single awards, and the old-bundle deploy
-- window — readers fall back to the class-wide label for NULL.
--
-- Named CHECK constraint so the integration test can pin the 23514 rejection
-- against a stable identifier. No index: the column is only read off rows
-- already fetched by batch_id/classroom_id — never used as a lookup key.

ALTER TABLE point_transactions
ADD COLUMN batch_kind TEXT DEFAULT NULL
CONSTRAINT point_transactions_batch_kind_check
CHECK (batch_kind IN ('class', 'subset') OR batch_kind IS NULL);

-- Comment explaining the column
COMMENT ON COLUMN point_transactions.batch_kind IS 'Kind of batch award that produced the row (''class'' = entire class, ''subset'' = multi-select) for undo-toast labeling; NULL for single awards and legacy rows (read as class-wide fallback)';
