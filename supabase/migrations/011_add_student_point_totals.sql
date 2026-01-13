-- Migration: Add stored point totals to students table
-- Purpose: Eliminate O(n) transaction fetch on every classroom load
--
-- Strategy:
-- 1. Store lifetime totals (point_total, positive_total, negative_total) with trigger
-- 2. Use RPC function for today/week totals (these reset at boundaries)

-- ============================================
-- ADD LIFETIME TOTAL COLUMNS
-- ============================================
ALTER TABLE students
ADD COLUMN IF NOT EXISTS point_total INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS positive_total INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS negative_total INTEGER NOT NULL DEFAULT 0;

-- ============================================
-- CREATE TRIGGER FUNCTION FOR LIFETIME TOTALS
-- ============================================
CREATE OR REPLACE FUNCTION update_student_point_totals()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE students SET
      point_total = point_total + NEW.points,
      positive_total = positive_total + GREATEST(NEW.points, 0),
      negative_total = negative_total + LEAST(NEW.points, 0)
    WHERE id = NEW.student_id;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    UPDATE students SET
      point_total = point_total - OLD.points,
      positive_total = positive_total - GREATEST(OLD.points, 0),
      negative_total = negative_total - LEAST(OLD.points, 0)
    WHERE id = OLD.student_id;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on point_transactions
DROP TRIGGER IF EXISTS trigger_update_student_totals ON point_transactions;
CREATE TRIGGER trigger_update_student_totals
AFTER INSERT OR DELETE ON point_transactions
FOR EACH ROW EXECUTE FUNCTION update_student_point_totals();

-- ============================================
-- CREATE RPC FUNCTION FOR TIME-BASED TOTALS
-- Calculates today and this_week totals for a classroom's students
-- ============================================
CREATE OR REPLACE FUNCTION get_student_time_totals(
  p_classroom_id UUID,
  p_start_of_today TIMESTAMPTZ,
  p_start_of_week TIMESTAMPTZ
)
RETURNS TABLE (
  student_id UUID,
  today_total INTEGER,
  this_week_total INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pt.student_id,
    COALESCE(SUM(CASE WHEN pt.created_at >= p_start_of_today THEN pt.points ELSE 0 END)::INTEGER, 0) AS today_total,
    COALESCE(SUM(CASE WHEN pt.created_at >= p_start_of_week THEN pt.points ELSE 0 END)::INTEGER, 0) AS this_week_total
  FROM point_transactions pt
  WHERE pt.classroom_id = p_classroom_id
    AND pt.created_at >= p_start_of_week  -- Only fetch this week's transactions (optimization)
  GROUP BY pt.student_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- BACKFILL EXISTING DATA
-- ============================================
UPDATE students s SET
  point_total = COALESCE(
    (SELECT SUM(points) FROM point_transactions WHERE student_id = s.id),
    0
  ),
  positive_total = COALESCE(
    (SELECT SUM(points) FROM point_transactions WHERE student_id = s.id AND points > 0),
    0
  ),
  negative_total = COALESCE(
    (SELECT SUM(points) FROM point_transactions WHERE student_id = s.id AND points < 0),
    0
  );

-- ============================================
-- ADD INDEXES FOR RPC FUNCTION PERFORMANCE
-- ============================================
-- Index for time-based queries on point_transactions
CREATE INDEX IF NOT EXISTS idx_transactions_classroom_created
ON point_transactions(classroom_id, created_at DESC);
