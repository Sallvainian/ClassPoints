-- Enable Realtime for tables that need live updates
-- This is required for the useRealtimeSubscription hook to receive events

-- Enable realtime for point_transactions (for sidebar point totals)
ALTER PUBLICATION supabase_realtime ADD TABLE point_transactions;

-- Enable realtime for classrooms (for classroom list updates)
ALTER PUBLICATION supabase_realtime ADD TABLE classrooms;

-- Enable realtime for students (for student count updates)
ALTER PUBLICATION supabase_realtime ADD TABLE students;

-- Enable realtime for behaviors (for behavior list updates)
ALTER PUBLICATION supabase_realtime ADD TABLE behaviors;
