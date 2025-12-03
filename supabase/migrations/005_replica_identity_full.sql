-- Set REPLICA IDENTITY FULL on point_transactions table
-- This is required so that DELETE events in Supabase Realtime include all column values,
-- not just the primary key. Without this, the onDelete handler can't access
-- classroom_id and points to update the sidebar totals.

ALTER TABLE point_transactions REPLICA IDENTITY FULL;

-- Also set it for students table since we use classroom_id in onDelete
ALTER TABLE students REPLICA IDENTITY FULL;
