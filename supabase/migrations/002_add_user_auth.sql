-- Add User Authentication Support
-- Migration 002: Add user_id columns and update RLS policies

-- ============================================
-- ADD USER_ID COLUMNS
-- ============================================

-- Add user_id to classrooms (each user has their own classrooms)
ALTER TABLE classrooms ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id to behaviors (users can have their own custom behaviors)
ALTER TABLE behaviors ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Note: students and point_transactions inherit user ownership through classrooms
-- No need for separate user_id columns on those tables

-- ============================================
-- CREATE INDEXES FOR USER QUERIES
-- ============================================

CREATE INDEX idx_classrooms_user_id ON classrooms(user_id);
CREATE INDEX idx_behaviors_user_id ON behaviors(user_id);

-- ============================================
-- DROP OLD PERMISSIVE POLICIES
-- ============================================

DROP POLICY IF EXISTS "Allow all classrooms" ON classrooms;
DROP POLICY IF EXISTS "Allow all students" ON students;
DROP POLICY IF EXISTS "Allow all behaviors" ON behaviors;
DROP POLICY IF EXISTS "Allow all transactions" ON point_transactions;

-- ============================================
-- CREATE NEW USER-BASED RLS POLICIES
-- ============================================

-- Classrooms: Users can only access their own classrooms
CREATE POLICY "Users can view own classrooms"
    ON classrooms FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own classrooms"
    ON classrooms FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own classrooms"
    ON classrooms FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own classrooms"
    ON classrooms FOR DELETE
    USING (auth.uid() = user_id);

-- Students: Users can access students in their classrooms
CREATE POLICY "Users can view students in own classrooms"
    ON students FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM classrooms
            WHERE classrooms.id = students.classroom_id
            AND classrooms.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create students in own classrooms"
    ON students FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM classrooms
            WHERE classrooms.id = students.classroom_id
            AND classrooms.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update students in own classrooms"
    ON students FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM classrooms
            WHERE classrooms.id = students.classroom_id
            AND classrooms.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete students in own classrooms"
    ON students FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM classrooms
            WHERE classrooms.id = students.classroom_id
            AND classrooms.user_id = auth.uid()
        )
    );

-- Behaviors: Users can access default behaviors (user_id IS NULL) OR their own custom behaviors
CREATE POLICY "Users can view default and own behaviors"
    ON behaviors FOR SELECT
    USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Users can create own behaviors"
    ON behaviors FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own behaviors"
    ON behaviors FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own behaviors"
    ON behaviors FOR DELETE
    USING (auth.uid() = user_id);

-- Point Transactions: Users can access transactions in their classrooms
CREATE POLICY "Users can view transactions in own classrooms"
    ON point_transactions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM classrooms
            WHERE classrooms.id = point_transactions.classroom_id
            AND classrooms.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create transactions in own classrooms"
    ON point_transactions FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM classrooms
            WHERE classrooms.id = point_transactions.classroom_id
            AND classrooms.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete transactions in own classrooms"
    ON point_transactions FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM classrooms
            WHERE classrooms.id = point_transactions.classroom_id
            AND classrooms.user_id = auth.uid()
        )
    );

-- ============================================
-- FUNCTION TO AUTO-SET USER_ID ON INSERT
-- ============================================

CREATE OR REPLACE FUNCTION set_user_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.user_id IS NULL THEN
        NEW.user_id = auth.uid();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for classrooms
CREATE TRIGGER set_classrooms_user_id
    BEFORE INSERT ON classrooms
    FOR EACH ROW
    EXECUTE FUNCTION set_user_id();

-- Trigger for behaviors (only for custom behaviors)
CREATE TRIGGER set_behaviors_user_id
    BEFORE INSERT ON behaviors
    FOR EACH ROW
    EXECUTE FUNCTION set_user_id();
