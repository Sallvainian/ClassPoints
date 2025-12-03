-- Sync Default Behaviors with localStorage
-- Migration 003: Update seed behaviors to match the 14 defaults from localStorage

-- ============================================
-- REMOVE OLD DEFAULT BEHAVIORS
-- ============================================

DELETE FROM behaviors WHERE is_custom = false AND user_id IS NULL;

-- ============================================
-- INSERT NEW DEFAULT BEHAVIORS (14 total)
-- Matching localStorage defaults.ts exactly
-- ============================================

INSERT INTO behaviors (name, points, icon, category, is_custom, user_id) VALUES
    -- Positive behaviors (8)
    ('On Task', 1, '📚', 'positive', false, NULL),
    ('Helping Others', 2, '🤝', 'positive', false, NULL),
    ('Great Effort', 2, '💪', 'positive', false, NULL),
    ('Participation', 1, '✋', 'positive', false, NULL),
    ('Excellent Work', 3, '⭐', 'positive', false, NULL),
    ('Being Kind', 2, '❤️', 'positive', false, NULL),
    ('Following Rules', 1, '✅', 'positive', false, NULL),
    ('Working Quietly', 1, '🤫', 'positive', false, NULL),

    -- Negative behaviors (6)
    ('Off Task', -1, '😴', 'negative', false, NULL),
    ('Disruptive', -2, '🔊', 'negative', false, NULL),
    ('Unprepared', -1, '📝', 'negative', false, NULL),
    ('Unkind Words', -2, '💬', 'negative', false, NULL),
    ('Not Following Rules', -1, '🚫', 'negative', false, NULL),
    ('Late', -1, '⏰', 'negative', false, NULL);
