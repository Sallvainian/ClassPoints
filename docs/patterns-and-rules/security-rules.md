# Security Rules

## Authentication Rules

1. **Session management** handled by Supabase Auth
2. **Token refresh** automatic via Supabase client
3. **AuthGuard** protects all authenticated routes

```tsx
function AuthGuard({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <Loading />;
  if (!user) return <AuthPage />;

  return children;
}
```

**Rules:**

- Never bypass AuthGuard
- Don't store sensitive data in localStorage
- Use Supabase Auth for all authentication flows

## RLS Policy Pattern

```sql
-- SELECT: Check ownership
CREATE POLICY "Users can view own X" ON table
  FOR SELECT USING (auth.uid() = user_id);

-- INSERT: Verify ownership on create
CREATE POLICY "Users can create own X" ON table
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Child table pattern (check parent)
CREATE POLICY "Users can view X in own classrooms" ON child_table
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM classrooms
      WHERE classrooms.id = child_table.classroom_id
      AND classrooms.user_id = auth.uid()
    )
  );
```

**Rules:**

- Every table MUST have RLS enabled
- Every operation (SELECT, INSERT, UPDATE, DELETE) needs a policy
- Use `auth.uid()` to check current user

## Auto-Set User ID Pattern

```sql
CREATE OR REPLACE FUNCTION set_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id = auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Rules:**

- Tables with `user_id` should have trigger to auto-set
- Client doesn't need to manually set `user_id`

---
