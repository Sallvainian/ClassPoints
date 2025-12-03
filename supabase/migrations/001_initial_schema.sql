-- ClassPoints Database Schema
-- Initial migration

-- ============================================
-- CLASSROOMS TABLE
-- ============================================
CREATE TABLE classrooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for listing classrooms
CREATE INDEX idx_classrooms_created_at ON classrooms(created_at DESC);

-- ============================================
-- STUDENTS TABLE
-- ============================================
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    avatar_color TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fetching students by classroom
CREATE INDEX idx_students_classroom_id ON students(classroom_id);

-- ============================================
-- BEHAVIORS TABLE
-- ============================================
CREATE TYPE behavior_category AS ENUM ('positive', 'negative');

CREATE TABLE behaviors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    points INTEGER NOT NULL CHECK (points >= -5 AND points <= 5 AND points != 0),
    icon TEXT NOT NULL,
    category behavior_category NOT NULL,
    is_custom BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for listing behaviors by category
CREATE INDEX idx_behaviors_category ON behaviors(category);

-- ============================================
-- POINT TRANSACTIONS TABLE
-- ============================================
CREATE TABLE point_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    behavior_id UUID REFERENCES behaviors(id) ON DELETE SET NULL,
    behavior_name TEXT NOT NULL,
    behavior_icon TEXT NOT NULL,
    points INTEGER NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for querying transactions
CREATE INDEX idx_transactions_student_id ON point_transactions(student_id);
CREATE INDEX idx_transactions_classroom_id ON point_transactions(classroom_id);
CREATE INDEX idx_transactions_created_at ON point_transactions(created_at DESC);

-- Composite index for student point calculations
CREATE INDEX idx_transactions_student_created ON point_transactions(student_id, created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
-- For now, allow all operations (no auth yet)
-- TODO: Add user_id column and RLS policies when auth is implemented

ALTER TABLE classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE behaviors ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;

-- Temporary permissive policies (replace with user-based policies later)
CREATE POLICY "Allow all classrooms" ON classrooms FOR ALL USING (true);
CREATE POLICY "Allow all students" ON students FOR ALL USING (true);
CREATE POLICY "Allow all behaviors" ON behaviors FOR ALL USING (true);
CREATE POLICY "Allow all transactions" ON point_transactions FOR ALL USING (true);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_classrooms_updated_at
    BEFORE UPDATE ON classrooms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DEFAULT BEHAVIORS (seed data)
-- ============================================
INSERT INTO behaviors (name, points, icon, category, is_custom) VALUES
    -- Positive behaviors
    ('Participation', 1, '🙋', 'positive', false),
    ('Helping Others', 2, '🤝', 'positive', false),
    ('Great Work', 2, '⭐', 'positive', false),
    ('Excellence', 3, '🏆', 'positive', false),
    ('Leadership', 3, '👑', 'positive', false),
    -- Negative behaviors
    ('Off Task', -1, '📱', 'negative', false),
    ('Disruptive', -2, '🔊', 'negative', false),
    ('Unprepared', -1, '📝', 'negative', false),
    ('Disrespectful', -3, '😤', 'negative', false);
