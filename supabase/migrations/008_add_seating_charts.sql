-- Migration: 008_add_seating_charts
-- Description: Add seating chart functionality to ClassPoints

-- ============================================
-- 1. Create enum for room element types
-- ============================================
CREATE TYPE room_element_type AS ENUM ('teacher_desk', 'door');

-- ============================================
-- 2. Create seating_charts table (one per classroom)
-- ============================================
CREATE TABLE seating_charts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Seating Chart',
  snap_enabled BOOLEAN NOT NULL DEFAULT true,
  grid_size INTEGER NOT NULL DEFAULT 40,
  canvas_width INTEGER NOT NULL DEFAULT 1200,
  canvas_height INTEGER NOT NULL DEFAULT 800,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(classroom_id)
);

CREATE INDEX idx_seating_charts_classroom ON seating_charts(classroom_id);

-- ============================================
-- 3. Create seating_groups table (table pairs with letter labels)
-- ============================================
CREATE TABLE seating_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seating_chart_id UUID NOT NULL REFERENCES seating_charts(id) ON DELETE CASCADE,
  letter CHAR(1) NOT NULL,
  position_x DOUBLE PRECISION NOT NULL,
  position_y DOUBLE PRECISION NOT NULL,
  rotation DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(seating_chart_id, letter)
);

CREATE INDEX idx_seating_groups_chart ON seating_groups(seating_chart_id);

-- ============================================
-- 4. Create seating_seats table (4 seats per group)
-- ============================================
CREATE TABLE seating_seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seating_group_id UUID NOT NULL REFERENCES seating_groups(id) ON DELETE CASCADE,
  position_in_group INTEGER NOT NULL CHECK (position_in_group BETWEEN 1 AND 4),
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(seating_group_id, position_in_group)
);

CREATE INDEX idx_seating_seats_group ON seating_seats(seating_group_id);
CREATE INDEX idx_seating_seats_student ON seating_seats(student_id);

-- ============================================
-- 5. Create room_elements table (teacher desk, doors)
-- ============================================
CREATE TABLE room_elements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seating_chart_id UUID NOT NULL REFERENCES seating_charts(id) ON DELETE CASCADE,
  element_type room_element_type NOT NULL,
  label TEXT,
  position_x DOUBLE PRECISION NOT NULL,
  position_y DOUBLE PRECISION NOT NULL,
  width DOUBLE PRECISION NOT NULL DEFAULT 100,
  height DOUBLE PRECISION NOT NULL DEFAULT 60,
  rotation DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_room_elements_chart ON room_elements(seating_chart_id);

-- ============================================
-- 6. Create layout_presets table (user-owned, importable)
-- ============================================
CREATE TABLE layout_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  layout_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_layout_presets_user ON layout_presets(user_id);

-- ============================================
-- 7. Enable Row Level Security on all tables
-- ============================================
ALTER TABLE seating_charts ENABLE ROW LEVEL SECURITY;
ALTER TABLE seating_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE seating_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE layout_presets ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 8. RLS Policies for seating_charts
-- ============================================
CREATE POLICY "Users can view seating charts in own classrooms"
  ON seating_charts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM classrooms
    WHERE classrooms.id = seating_charts.classroom_id
    AND classrooms.user_id = auth.uid()
  ));

CREATE POLICY "Users can create seating charts in own classrooms"
  ON seating_charts FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM classrooms
    WHERE classrooms.id = seating_charts.classroom_id
    AND classrooms.user_id = auth.uid()
  ));

CREATE POLICY "Users can update seating charts in own classrooms"
  ON seating_charts FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM classrooms
    WHERE classrooms.id = seating_charts.classroom_id
    AND classrooms.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete seating charts in own classrooms"
  ON seating_charts FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM classrooms
    WHERE classrooms.id = seating_charts.classroom_id
    AND classrooms.user_id = auth.uid()
  ));

-- ============================================
-- 9. RLS Policies for seating_groups
-- ============================================
CREATE POLICY "Users can view seating groups in own classrooms"
  ON seating_groups FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM seating_charts
    JOIN classrooms ON classrooms.id = seating_charts.classroom_id
    WHERE seating_charts.id = seating_groups.seating_chart_id
    AND classrooms.user_id = auth.uid()
  ));

CREATE POLICY "Users can create seating groups in own classrooms"
  ON seating_groups FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM seating_charts
    JOIN classrooms ON classrooms.id = seating_charts.classroom_id
    WHERE seating_charts.id = seating_groups.seating_chart_id
    AND classrooms.user_id = auth.uid()
  ));

CREATE POLICY "Users can update seating groups in own classrooms"
  ON seating_groups FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM seating_charts
    JOIN classrooms ON classrooms.id = seating_charts.classroom_id
    WHERE seating_charts.id = seating_groups.seating_chart_id
    AND classrooms.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete seating groups in own classrooms"
  ON seating_groups FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM seating_charts
    JOIN classrooms ON classrooms.id = seating_charts.classroom_id
    WHERE seating_charts.id = seating_groups.seating_chart_id
    AND classrooms.user_id = auth.uid()
  ));

-- ============================================
-- 10. RLS Policies for seating_seats
-- ============================================
CREATE POLICY "Users can view seating seats in own classrooms"
  ON seating_seats FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM seating_groups
    JOIN seating_charts ON seating_charts.id = seating_groups.seating_chart_id
    JOIN classrooms ON classrooms.id = seating_charts.classroom_id
    WHERE seating_groups.id = seating_seats.seating_group_id
    AND classrooms.user_id = auth.uid()
  ));

CREATE POLICY "Users can create seating seats in own classrooms"
  ON seating_seats FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM seating_groups
    JOIN seating_charts ON seating_charts.id = seating_groups.seating_chart_id
    JOIN classrooms ON classrooms.id = seating_charts.classroom_id
    WHERE seating_groups.id = seating_seats.seating_group_id
    AND classrooms.user_id = auth.uid()
  ));

CREATE POLICY "Users can update seating seats in own classrooms"
  ON seating_seats FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM seating_groups
    JOIN seating_charts ON seating_charts.id = seating_groups.seating_chart_id
    JOIN classrooms ON classrooms.id = seating_charts.classroom_id
    WHERE seating_groups.id = seating_seats.seating_group_id
    AND classrooms.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete seating seats in own classrooms"
  ON seating_seats FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM seating_groups
    JOIN seating_charts ON seating_charts.id = seating_groups.seating_chart_id
    JOIN classrooms ON classrooms.id = seating_charts.classroom_id
    WHERE seating_groups.id = seating_seats.seating_group_id
    AND classrooms.user_id = auth.uid()
  ));

-- ============================================
-- 11. RLS Policies for room_elements
-- ============================================
CREATE POLICY "Users can view room elements in own classrooms"
  ON room_elements FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM seating_charts
    JOIN classrooms ON classrooms.id = seating_charts.classroom_id
    WHERE seating_charts.id = room_elements.seating_chart_id
    AND classrooms.user_id = auth.uid()
  ));

CREATE POLICY "Users can create room elements in own classrooms"
  ON room_elements FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM seating_charts
    JOIN classrooms ON classrooms.id = seating_charts.classroom_id
    WHERE seating_charts.id = room_elements.seating_chart_id
    AND classrooms.user_id = auth.uid()
  ));

CREATE POLICY "Users can update room elements in own classrooms"
  ON room_elements FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM seating_charts
    JOIN classrooms ON classrooms.id = seating_charts.classroom_id
    WHERE seating_charts.id = room_elements.seating_chart_id
    AND classrooms.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete room elements in own classrooms"
  ON room_elements FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM seating_charts
    JOIN classrooms ON classrooms.id = seating_charts.classroom_id
    WHERE seating_charts.id = room_elements.seating_chart_id
    AND classrooms.user_id = auth.uid()
  ));

-- ============================================
-- 12. RLS Policies for layout_presets
-- ============================================
CREATE POLICY "Users can view own layout presets"
  ON layout_presets FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own layout presets"
  ON layout_presets FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own layout presets"
  ON layout_presets FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own layout presets"
  ON layout_presets FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- 13. Trigger: Auto-create 4 seats when group is inserted
-- ============================================
CREATE OR REPLACE FUNCTION auto_create_group_seats()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO seating_seats (seating_group_id, position_in_group)
  VALUES
    (NEW.id, 1),
    (NEW.id, 2),
    (NEW.id, 3),
    (NEW.id, 4);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_auto_create_group_seats
  AFTER INSERT ON seating_groups
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_group_seats();

-- ============================================
-- 14. Trigger: Ensure student only assigned once per chart
-- ============================================
CREATE OR REPLACE FUNCTION ensure_student_single_seat()
RETURNS TRIGGER AS $$
DECLARE
  chart_id UUID;
  existing_seat_id UUID;
BEGIN
  IF NEW.student_id IS NOT NULL THEN
    -- Get the seating chart ID
    SELECT seating_chart_id INTO chart_id
    FROM seating_groups
    WHERE id = NEW.seating_group_id;

    -- Check if student is already seated in this chart
    SELECT ss.id INTO existing_seat_id
    FROM seating_seats ss
    JOIN seating_groups sg ON sg.id = ss.seating_group_id
    WHERE sg.seating_chart_id = chart_id
    AND ss.student_id = NEW.student_id
    AND ss.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

    IF existing_seat_id IS NOT NULL THEN
      RAISE EXCEPTION 'Student is already assigned to another seat in this seating chart';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_ensure_student_single_seat
  BEFORE INSERT OR UPDATE OF student_id ON seating_seats
  FOR EACH ROW
  EXECUTE FUNCTION ensure_student_single_seat();

-- ============================================
-- 15. Trigger: Auto-update updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_seating_chart_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_seating_chart_timestamp
  BEFORE UPDATE ON seating_charts
  FOR EACH ROW
  EXECUTE FUNCTION update_seating_chart_timestamp();
