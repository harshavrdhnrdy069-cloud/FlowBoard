/*
# Project Management Tool — RLS Policies & Triggers

## Security (RLS)
All tables already have RLS enabled. This migration adds the policies.
Access is scoped through project membership:
- profiles: each user manages their own; members of a shared project can read each other's.
- projects: visible to members; only owner can update/delete.
- project_members: members can read; owners can add/remove.
- columns/tasks/comments: read/write requires project membership.
- notifications: each user reads/updates only their own.

## Triggers
- on_auth_user_created: auto-creates a profile row on signup.
- on_project_created: auto-adds owner as project member + seeds default columns.
*/

-- ============================================================
-- PROFILES policies
-- ============================================================
DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "select_profile_if_project_member" ON profiles;
CREATE POLICY "select_profile_if_project_member" ON profiles FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM project_members pm2
        WHERE pm2.project_id = pm.project_id
        AND pm2.user_id = profiles.id
      )
    )
  );

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============================================================
-- PROJECTS policies
-- ============================================================
DROP POLICY IF EXISTS "select_projects_as_member" ON projects;
CREATE POLICY "select_projects_as_member" ON projects FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = projects.id
      AND project_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_projects_as_owner" ON projects;
CREATE POLICY "insert_projects_as_owner" ON projects FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "update_projects_as_owner" ON projects;
CREATE POLICY "update_projects_as_owner" ON projects FOR UPDATE
  TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "delete_projects_as_owner" ON projects;
CREATE POLICY "delete_projects_as_owner" ON projects FOR DELETE
  TO authenticated USING (auth.uid() = owner_id);

-- ============================================================
-- PROJECT_MEMBERS policies
-- ============================================================
DROP POLICY IF EXISTS "select_members_if_member" ON project_members;
CREATE POLICY "select_members_if_member" ON project_members FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_members.project_id
      AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_members_as_owner" ON project_members;
CREATE POLICY "insert_members_as_owner" ON project_members FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_members.project_id
      AND pm.user_id = auth.uid()
      AND pm.role = 'owner'
    )
  );

DROP POLICY IF EXISTS "delete_members_as_owner" ON project_members;
CREATE POLICY "delete_members_as_owner" ON project_members FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_members.project_id
      AND pm.user_id = auth.uid()
      AND pm.role = 'owner'
    )
  );

-- ============================================================
-- COLUMNS policies
-- ============================================================
DROP POLICY IF EXISTS "select_columns_as_member" ON columns;
CREATE POLICY "select_columns_as_member" ON columns FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = columns.project_id
      AND project_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_columns_as_member" ON columns;
CREATE POLICY "insert_columns_as_member" ON columns FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = columns.project_id
      AND project_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "update_columns_as_member" ON columns;
CREATE POLICY "update_columns_as_member" ON columns FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = columns.project_id
      AND project_members.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = columns.project_id
      AND project_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_columns_as_member" ON columns;
CREATE POLICY "delete_columns_as_member" ON columns FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = columns.project_id
      AND project_members.user_id = auth.uid()
    )
  );

-- ============================================================
-- TASKS policies
-- ============================================================
DROP POLICY IF EXISTS "select_tasks_as_member" ON tasks;
CREATE POLICY "select_tasks_as_member" ON tasks FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = tasks.project_id
      AND project_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_tasks_as_member" ON tasks;
CREATE POLICY "insert_tasks_as_member" ON tasks FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = tasks.project_id
      AND project_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "update_tasks_as_member" ON tasks;
CREATE POLICY "update_tasks_as_member" ON tasks FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = tasks.project_id
      AND project_members.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = tasks.project_id
      AND project_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_tasks_as_member" ON tasks;
CREATE POLICY "delete_tasks_as_member" ON tasks FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = tasks.project_id
      AND project_members.user_id = auth.uid()
    )
  );

-- ============================================================
-- COMMENTS policies
-- ============================================================
DROP POLICY IF EXISTS "select_comments_as_member" ON comments;
CREATE POLICY "select_comments_as_member" ON comments FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM tasks
      JOIN project_members ON project_members.project_id = tasks.project_id
      WHERE tasks.id = comments.task_id
      AND project_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_comments_as_member" ON comments;
CREATE POLICY "insert_comments_as_member" ON comments FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks
      JOIN project_members ON project_members.project_id = tasks.project_id
      WHERE tasks.id = comments.task_id
      AND project_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_comments_as_author" ON comments;
CREATE POLICY "delete_comments_as_author" ON comments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_comments_as_author" ON comments;
CREATE POLICY "update_comments_as_author" ON comments FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- NOTIFICATIONS policies
-- ============================================================
DROP POLICY IF EXISTS "select_own_notifications" ON notifications;
CREATE POLICY "select_own_notifications" ON notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_notifications" ON notifications;
CREATE POLICY "insert_own_notifications" ON notifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_notifications" ON notifications;
CREATE POLICY "update_own_notifications" ON notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_notifications" ON notifications;
CREATE POLICY "delete_own_notifications" ON notifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- TRIGGER: auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_color)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), '#6366f1')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- TRIGGER: auto-add owner as project member + seed default columns
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_project()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.columns (project_id, title, position)
  VALUES
    (NEW.id, 'To Do', 0),
    (NEW.id, 'In Progress', 1),
    (NEW.id, 'Done', 2);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_project_created ON projects;
CREATE TRIGGER on_project_created
  AFTER INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_project();