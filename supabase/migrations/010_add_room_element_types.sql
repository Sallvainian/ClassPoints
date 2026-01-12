-- Add new room element types to the enum
ALTER TYPE room_element_type ADD VALUE IF NOT EXISTS 'window';
ALTER TYPE room_element_type ADD VALUE IF NOT EXISTS 'countertop';
ALTER TYPE room_element_type ADD VALUE IF NOT EXISTS 'sink';
