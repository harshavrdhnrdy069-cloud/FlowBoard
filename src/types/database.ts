export type Profile = {
  id: string;
  full_name: string;
  avatar_color: string;
  created_at: string;
};

export type Project = {
  id: string;
  name: string;
  description: string;
  owner_id: string;
  color: string;
  created_at: string;
};

export type ProjectMember = {
  id: string;
  project_id: string;
  user_id: string;
  role: string;
  joined_at: string;
};

export type Column = {
  id: string;
  project_id: string;
  title: string;
  position: number;
  created_at: string;
};

export type Priority = 'low' | 'medium' | 'high';

export type Task = {
  id: string;
  column_id: string;
  project_id: string;
  title: string;
  description: string;
  position: number;
  assignee_id: string | null;
  priority: Priority;
  due_date: string | null;
  created_by: string;
  created_at: string;
};

export type Comment = {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  project_id: string | null;
  task_id: string | null;
  type: string;
  message: string;
  read: boolean;
  created_at: string;
};

export type TaskWithAssignee = Task & {
  assignee?: Profile | null;
};

export type CommentWithAuthor = Comment & {
  author?: Profile | null;
};

export type ProjectMemberWithProfile = ProjectMember & {
  profile?: Profile | null;
};
