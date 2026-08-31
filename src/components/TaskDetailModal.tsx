import { useEffect, useRef, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { formatRelativeTime, formatDueDate } from '@/lib/utils';
import type { Task, Profile, CommentWithAuthor, Priority, Column } from '@/types/database';
import Avatar from '@/components/Avatar';
import { X, Trash2, Send, Calendar, Flag, User, MessageSquare, Loader2 } from 'lucide-react';

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bg: string; dot: string }> = {
  low: { label: 'Low', color: 'text-slate-600', bg: 'bg-slate-100', dot: 'bg-slate-400' },
  medium: { label: 'Medium', color: 'text-amber-700', bg: 'bg-amber-100', dot: 'bg-amber-500' },
  high: { label: 'High', color: 'text-red-700', bg: 'bg-red-100', dot: 'bg-red-500' },
};

type Props = {
  task: Task;
  columns: Column[];
  members: Profile[];
  projectId: string;
  onClose: () => void;
  onTaskUpdated: () => void;
};

export default function TaskDetailModal({ task, columns, members, projectId, onClose, onTaskUpdated }: Props) {
  const { user, profile } = useAuth();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [assigneeId, setAssigneeId] = useState(task.assignee_id);
  const [priority, setPriority] = useState(task.priority);
  const [dueDate, setDueDate] = useState(task.due_date ?? '');
  const [columnId, setColumnId] = useState(task.column_id);
  const [showAssigneeMenu, setShowAssigneeMenu] = useState(false);
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const assigneeRef = useRef<HTMLDivElement>(null);
  const priorityRef = useRef<HTMLDivElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadComments();

    const channel = supabase
      .channel(`comments-${task.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments', filter: `task_id=eq.${task.id}` },
        (payload) => {
          const newC = payload.new as CommentWithAuthor;
          // Fetch author info
          (async () => {
            if (newC.user_id === user?.id) {
              setComments((prev) => [{ ...newC, author: profile }, ...prev]);
              return;
            }
            const { data: authorProfile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', newC.user_id)
              .maybeSingle();
            setComments((prev) => [{ ...newC, author: authorProfile as Profile }, ...prev]);
          })();
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'comments', filter: `task_id=eq.${task.id}` },
        (payload) => {
          setComments((prev) => prev.filter((c) => c.id !== (payload.old as { id: string }).id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (assigneeRef.current && !assigneeRef.current.contains(e.target as Node)) setShowAssigneeMenu(false);
      if (priorityRef.current && !priorityRef.current.contains(e.target as Node)) setShowPriorityMenu(false);
      if (columnRef.current && !columnRef.current.contains(e.target as Node)) setShowColumnMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadComments = async () => {
    setLoadingComments(true);
    const { data } = await supabase
      .from('comments')
      .select('*, author:profiles!comments_user_id_fkey(*)')
      .eq('task_id', task.id)
      .order('created_at', { ascending: false });
    setComments((data ?? []) as CommentWithAuthor[]);
    setLoadingComments(false);
  };

  const saveTitle = async () => {
    if (title === task.title) {
      setEditingTitle(false);
      return;
    }
    await supabase.from('tasks').update({ title }).eq('id', task.id);
    task.title = title;
    setEditingTitle(false);
    onTaskUpdated();
  };

  const saveDescription = async () => {
    if (description === task.description) {
      setEditingDesc(false);
      return;
    }
    await supabase.from('tasks').update({ description }).eq('id', task.id);
    task.description = description;
    setEditingDesc(false);
    onTaskUpdated();
  };

  const updateAssignee = async (newAssigneeId: string | null) => {
    setAssigneeId(newAssigneeId);
    setShowAssigneeMenu(false);
    await supabase.from('tasks').update({ assignee_id: newAssigneeId }).eq('id', task.id);
    task.assignee_id = newAssigneeId;

    if (newAssigneeId && newAssigneeId !== user?.id) {
      const assignee = members.find((m) => m.id === newAssigneeId);
      await supabase.from('notifications').insert({
        user_id: newAssigneeId,
        project_id: projectId,
        task_id: task.id,
        type: 'assignment',
        message: `${profile?.full_name || 'Someone'} assigned you to "${task.title}"`,
      });
      void assignee;
    }
    onTaskUpdated();
  };

  const updatePriority = async (newPriority: Priority) => {
    setPriority(newPriority);
    setShowPriorityMenu(false);
    await supabase.from('tasks').update({ priority: newPriority }).eq('id', task.id);
    task.priority = newPriority;
    onTaskUpdated();
  };

  const updateDueDate = async (value: string) => {
    setDueDate(value);
    await supabase.from('tasks').update({ due_date: value || null }).eq('id', task.id);
    task.due_date = value || null;
    onTaskUpdated();
  };

  const updateColumn = async (newColumnId: string) => {
    setColumnId(newColumnId);
    setShowColumnMenu(false);
    await supabase.from('tasks').update({ column_id: newColumnId }).eq('id', task.id);
    task.column_id = newColumnId;
    onTaskUpdated();
  };

  const handleAddComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;
    setSubmitting(true);
    const { data } = await supabase
      .from('comments')
      .insert({ task_id: task.id, user_id: user.id, content: newComment.trim() })
      .select('*, author:profiles!comments_user_id_fkey(*)')
      .single();
    setSubmitting(false);
    if (data) {
      // Don't double-add if realtime already did; check
      setComments((prev) => {
        if (prev.some((c) => c.id === data.id)) return prev;
        return [data as CommentWithAuthor, ...prev];
      });
      setNewComment('');

      // Notify other members
      const otherMembers = members.filter((m) => m.id !== user.id);
      if (otherMembers.length > 0) {
        await supabase.from('notifications').insert(
          otherMembers.map((m) => ({
            user_id: m.id,
            project_id: projectId,
            task_id: task.id,
            type: 'comment',
            message: `${profile?.full_name || 'Someone'} commented on "${task.title}"`,
          }))
        );
      }
    }
  };

  const deleteComment = async (commentId: string) => {
    await supabase.from('comments').delete().eq('id', commentId);
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  };

  const currentAssignee = members.find((m) => m.id === assigneeId);
  const currentColumn = columns.find((c) => c.id === columnId);
  const prioConfig = PRIORITY_CONFIG[priority];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          {editingTitle ? (
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
              autoFocus
              className="flex-1 text-lg font-semibold text-slate-900 bg-transparent border-b-2 border-slate-300 focus:border-slate-900 outline-none mr-4"
            />
          ) : (
            <h2
              className="text-lg font-semibold text-slate-900 flex-1 cursor-text hover:text-slate-700"
              onClick={() => setEditingTitle(true)}
            >
              {title}
            </h2>
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Main content */}
            <div className="sm:col-span-2 space-y-5">
              {/* Description */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-slate-700">Description</span>
                </div>
                {editingDesc ? (
                  <div>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                      autoFocus
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 outline-none transition-all text-slate-900 text-sm resize-none"
                      placeholder="Add a more detailed description..."
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={saveDescription}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => { setDescription(task.description); setEditingDesc(false); }}
                        className="px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 text-sm font-medium transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p
                    onClick={() => setEditingDesc(true)}
                    className="text-sm text-slate-600 cursor-text hover:bg-slate-50 rounded-lg px-3 py-2 -mx-3 -my-1 min-h-[40px]"
                  >
                    {description || 'Add a more detailed description...'}
                  </p>
                )}
              </div>

              {/* Comments */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-medium text-slate-700">Comments ({comments.length})</span>
                </div>

                <form onSubmit={handleAddComment} className="flex gap-2 mb-4">
                  <Avatar profile={profile} size="sm" className="mt-0.5" />
                  <div className="flex-1 flex gap-2">
                    <input
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Write a comment..."
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 outline-none transition-all text-slate-900 text-sm"
                    />
                    <button
                      type="submit"
                      disabled={submitting || !newComment.trim()}
                      className="px-3 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
                    >
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                </form>

                {loadingComments ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
                  </div>
                ) : comments.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">No comments yet. Start the conversation!</p>
                ) : (
                  <div className="space-y-4">
                    {comments.map((c) => (
                      <div key={c.id} className="flex gap-3 group">
                        <Avatar profile={c.author} size="sm" className="mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-medium text-slate-700">{c.author?.full_name || 'Unknown'}</span>
                            <span className="text-xs text-slate-400">{formatRelativeTime(c.created_at)}</span>
                            {c.user_id === user?.id && (
                              <button
                                onClick={() => deleteComment(c.id)}
                                className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 ml-auto transition-all p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <p className="text-sm text-slate-600 leading-relaxed">{c.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Column / Status */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1.5">
                  <span>Status</span>
                </label>
                <div className="relative" ref={columnRef}>
                  <button
                    onClick={() => setShowColumnMenu((o) => !o)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 hover:border-slate-300 text-sm text-slate-700 text-left transition-colors flex items-center justify-between"
                  >
                    <span>{currentColumn?.title || 'Select'}</span>
                  </button>
                  {showColumnMenu && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-slate-200 z-10 overflow-hidden">
                      {columns.map((col) => (
                        <button
                          key={col.id}
                          onClick={() => updateColumn(col.id)}
                          className={`w-full px-3 py-2 text-sm text-left hover:bg-slate-50 transition-colors ${col.id === columnId ? 'bg-slate-50 font-medium text-slate-900' : 'text-slate-600'}`}
                        >
                          {col.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Assignee */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1.5">
                  <User className="w-3.5 h-3.5" />
                  Assignee
                </label>
                <div className="relative" ref={assigneeRef}>
                  <button
                    onClick={() => setShowAssigneeMenu((o) => !o)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 hover:border-slate-300 text-sm text-slate-700 text-left transition-colors flex items-center gap-2"
                  >
                    {currentAssignee ? (
                      <>
                        <Avatar profile={currentAssignee} size="xs" />
                        <span className="truncate">{currentAssignee.full_name}</span>
                      </>
                    ) : (
                      <span className="text-slate-400">Unassigned</span>
                    )}
                  </button>
                  {showAssigneeMenu && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-slate-200 z-10 overflow-hidden max-h-48 overflow-y-auto">
                      <button
                        onClick={() => updateAssignee(null)}
                        className="w-full px-3 py-2 text-sm text-left hover:bg-slate-50 text-slate-500 transition-colors"
                      >
                        Unassigned
                      </button>
                      {members.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => updateAssignee(m.id)}
                          className={`w-full px-3 py-2 text-sm text-left hover:bg-slate-50 transition-colors flex items-center gap-2 ${m.id === assigneeId ? 'bg-slate-50 font-medium' : ''}`}
                        >
                          <Avatar profile={m} size="xs" />
                          <span className="truncate text-slate-700">{m.full_name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1.5">
                  <Flag className="w-3.5 h-3.5" />
                  Priority
                </label>
                <div className="relative" ref={priorityRef}>
                  <button
                    onClick={() => setShowPriorityMenu((o) => !o)}
                    className={`w-full px-3 py-2 rounded-xl text-sm text-left transition-colors flex items-center gap-2 ${prioConfig.bg} ${prioConfig.color}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${prioConfig.dot}`} />
                    {prioConfig.label}
                  </button>
                  {showPriorityMenu && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-slate-200 z-10 overflow-hidden">
                      {(['low', 'medium', 'high'] as Priority[]).map((p) => (
                        <button
                          key={p}
                          onClick={() => updatePriority(p)}
                          className={`w-full px-3 py-2 text-sm text-left hover:bg-slate-50 transition-colors flex items-center gap-2 ${p === priority ? 'font-medium' : ''}`}
                        >
                          <span className={`w-2 h-2 rounded-full ${PRIORITY_CONFIG[p].dot}`} />
                          <span className={PRIORITY_CONFIG[p].color}>{PRIORITY_CONFIG[p].label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Due Date */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => updateDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 outline-none transition-all text-sm text-slate-700"
                />
                {dueDate && (
                  <p className="text-xs text-slate-400 mt-1">{formatDueDate(dueDate)}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
