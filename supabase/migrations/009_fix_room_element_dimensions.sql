-- Fix existing room element dimensions to align with 40px grid
UPDATE room_elements 
SET width = 120, height = 80 
WHERE element_type = 'teacher_desk';

UPDATE room_elements 
SET width = 80, height = 40 
WHERE element_type = 'door';

-- Update default values in table
ALTER TABLE room_elements 
ALTER COLUMN width SET DEFAULT 120,
ALTER COLUMN height SET DEFAULT 80;
