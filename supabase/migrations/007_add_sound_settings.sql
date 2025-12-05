-- Migration: Add user sound settings table
-- Purpose: Store per-user sound effect preferences that sync across devices

-- Create the user_sound_settings table
CREATE TABLE IF NOT EXISTS user_sound_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    volume FLOAT NOT NULL DEFAULT 0.7 CHECK (volume >= 0.0 AND volume <= 1.0),
    positive_sound TEXT NOT NULL DEFAULT 'chime',
    negative_sound TEXT NOT NULL DEFAULT 'soft-buzz',
    custom_positive_url TEXT,
    custom_negative_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Each user can only have one settings row
    CONSTRAINT unique_user_sound_settings UNIQUE (user_id)
);

-- Create index on user_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_sound_settings_user_id ON user_sound_settings(user_id);

-- Enable Row Level Security
ALTER TABLE user_sound_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own settings

-- SELECT: Users can read their own settings
CREATE POLICY "Users can view own sound settings"
    ON user_sound_settings
    FOR SELECT
    USING (auth.uid() = user_id);

-- INSERT: Users can create their own settings
CREATE POLICY "Users can create own sound settings"
    ON user_sound_settings
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- UPDATE: Users can update their own settings
CREATE POLICY "Users can update own sound settings"
    ON user_sound_settings
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- DELETE: Users can delete their own settings
CREATE POLICY "Users can delete own sound settings"
    ON user_sound_settings
    FOR DELETE
    USING (auth.uid() = user_id);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_sound_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function on UPDATE
DROP TRIGGER IF EXISTS trigger_update_sound_settings_updated_at ON user_sound_settings;
CREATE TRIGGER trigger_update_sound_settings_updated_at
    BEFORE UPDATE ON user_sound_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_sound_settings_updated_at();

-- Enable realtime for sound settings (for cross-device sync)
ALTER PUBLICATION supabase_realtime ADD TABLE user_sound_settings;

-- Set REPLICA IDENTITY FULL for complete DELETE event payloads
ALTER TABLE user_sound_settings REPLICA IDENTITY FULL;
