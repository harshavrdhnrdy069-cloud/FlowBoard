import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { formatDueDate, getInitials } from '@/lib/utils';
import type { Column, Task, Profile, Priority, ProjectMemberWithProfile } from '@/types/database';
import Avatar from '@/components/Avatar';
import TaskDetailModal from '@/components/TaskDetailModal';
import { ArrowLeft, Plus, MoreHorizontal, Trash2, Loader2, MessageSquare, Flag, Calendar, X } from 'lucide-react';

const PRIORITY_DOT: Record<Priority, string> = {
  low: 'bg-slate-400',
  medium: 'bg-amber-500',
  high: 'bg-red-500',
};

type Props = {
  projectId: string;
  onBack: () => void;
};

export default function BoardView({ projectId, onBack }: Props) {
  const { user } = useAuth();
  const [project, setProject] = useState<{ name: string; color: string } | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [columnMenu, setColumnMenu] = useState<string | null>(null);
  const [addingTaskIn, setAddingTaskIn] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [draggedTask, setDraggedTask] = useState<{ taskId: string; fromColumn: string } | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const columnMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
    subscribeToRealtime();

    return () => {
      supabase.removeAllChannels();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(e.target as Node)) {
        setColumnMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [projRes, colRes, taskRes, memberRes] = await Promise.all([
      supabase.from('projects').select('name, color').eq('id', projectId).maybeSingle(),
      supabase.from('columns').select('*').eq('project_id', projectId).order('position', { ascending: true }),
      supabase.from('tasks').select('*').eq('project_id', projectId).order('position', { ascending: true }),
      supabase
        .from('project_members')
        .select('profile:profiles(*)')
        .eq('project_id', projectId)
        .order('joined_at', { ascending: true }),
    ]);

    setProject(projRes.data as { name: string; color: string } | null);
    setColumns((colRes.data ?? []) as Column[]);
    setTasks((taskRes.data ?? []) as Task[]);
    setMembers(
      ((memberRes.data ?? []) as unknown as { profile: Profile }[])
        .map((m) => m.profile)
        .filter(Boolean) as Profile[]
    );
    setLoading(false);
  };

  const subscribeToRealtime = () => {
    const channel = supabase
      .channel(`board-${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${projectId}` },
        () => { void loadTasks(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'columns', filter: `project_id=eq.${projectId}` },
        () => { void loadColumns(); }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  };

  const loadTasks = async () => {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', projectId)
      .order('position', { ascending: true });
    setTasks((data ?? []) as Task[]);
  };

  const loadColumns = async () => {
    const { data } = await supabase
      .from('columns')
      .select('*')
      .eq('project_id', projectId)
      .order('position', { ascending: true });
    setColumns((data ?? []) as Column[]);
  };

  const handleAddColumn = async () => {
    if (!newColumnTitle.trim()) return;
    const maxPos = columns.reduce((max, c) => Math.max(max, c.position), -1);
    const { data } = await supabase
      .from('columns')
      .insert({ project_id: projectId, title: newColumnTitle.trim(), position: maxPos + 1 })
      .select()
      .single();
    if (data) {
      setColumns((prev) => [...prev, data as Column]);
      setNewColumnTitle('');
      setAddingColumn(false);
    }
  };

  const handleDeleteColumn = async (columnId: string) => {
    setColumnMenu(null);
    await supabase.from('columns').delete().eq('id', columnId);
    setColumns((prev) => prev.filter((c) => c.id !== columnId));
    setTasks((prev) => prev.filter((t) => t.column_id !== columnId));
  };

  const handleAddTask = async (columnId: string) => {
    if (!newTaskTitle.trim() || !user) return;
    const columnTasks = tasks.filter((t) => t.column_id === columnId);
    const maxPos = columnTasks.reduce((max, t) => Math.max(max, t.position), -1);
    const { data } = await supabase
      .from('tasks')
      .insert({
        column_id: columnId,
        project_id: projectId,
        title: newTaskTitle.trim(),
        position: maxPos + 1,
        created_by: user.id,
      })
      .select()
      .single();
    if (data) {
      setTasks((prev) => [...prev, data as Task]);
      setNewTaskTitle('');
      setAddingTaskIn(null);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    await supabase.from('tasks').delete().eq('id', taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setSelectedTask(null);
  };

  const handleDragStart = (e: React.DragEvent, taskId: string, fromColumn: string) => {
    setDraggedTask({ taskId, fromColumn });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnId);
  };

  const handleDrop = async (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    if (!draggedTask) return;
    const { taskId, fromColumn } = draggedTask;
    setDraggedTask(null);
    if (fromColumn === columnId) return;

    const columnTasks = tasks.filter((t) => t.column_id === columnId);
    const maxPos = columnTasks.reduce((max, t) => Math.max(max, t.position), -1);
    await supabase.from('tasks').update({ column_id: columnId, position: maxPos + 1 }).eq('id', taskId);
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, column_id: columnId, position: maxPos + 1 } : t))
    );
  };

  const memberMap = new Map(members.map((m) => [m.id, m]));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Board header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className={`w-3 h-3 rounded-full shrink-0`} style={{ backgroundColor: project?.color ?? '#6366f1' }} />
          <h1 className="text-xl font-bold text-slate-900 truncate">{project?.name ?? 'Project'}</h1>
          <div className="flex -space-x-2 ml-2">
            {members.slice(0, 5).map((m) => (
              <Avatar key={m.id} profile={m} size="sm" className="ring-2 ring-white" />
            ))}
            {members.length > 5 && (
              <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 text-xs font-semibold flex items-center justify-center ring-2 ring-white">
                +{members.length - 5}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Board columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 sm:p-6">
        <div className="flex gap-4 h-full items-start min-w-min">
          {columns.map((column) => {
            const columnTasks = tasks.filter((t) => t.column_id === column.id);
            return (
              <div
                key={column.id}
                className={`w-72 shrink-0 bg-slate-100/70 rounded-2xl flex flex-col max-h-full transition-colors ${
                  dragOverColumn === column.id ? 'bg-slate-200/80 ring-2 ring-slate-300' : ''
                }`}
                onDragOver={(e) => handleDragOver(e, column.id)}
                onDrop={(e) => handleDrop(e, column.id)}
                onDragLeave={() => setDragOverColumn(null)}
              >
                {/* Column header */}
                <div className="flex items-center justify-between px-3 py-3">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    <h3 className="font-semibold text-slate-700 text-sm">{column.title}</h3>
                    <span className="text-xs text-slate-400 font-medium bg-slate-200/60 px-1.5 py-0.5 rounded-md">
                      {columnTasks.length}
                    </span>
                  </div>
                  <div className="relative" ref={columnMenu === column.id ? columnMenuRef : null}>
                    <button
                      onClick={() => setColumnMenu(columnMenu === column.id ? null : column.id)}
                      className="p-1 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {columnMenu === column.id && (
                      <div className="absolute top-full right-0 mt-1 bg-white rounded-xl shadow-lg border border-slate-200 z-10 overflow-hidden w-36">
                        <button
                          onClick={() => handleDeleteColumn(column.id)}
                          className="w-full px-3 py-2 text-sm text-left text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tasks */}
                <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2 min-h-[60px]">
                  {columnTasks.map((task) => {
                    const assignee = task.assignee_id ? memberMap.get(task.assignee_id) : null;
                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id, column.id)}
                        onDragEnd={() => setDraggedTask(null)}
                        onClick={() => setSelectedTask(task)}
                        className="group bg-white rounded-xl p-3 shadow-sm border border-slate-200/60 hover:border-slate-300 hover:shadow-md cursor-pointer transition-all active:cursor-grabbing"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-slate-800 leading-snug">{task.title}</p>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }}
                            className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 p-0.5 transition-all"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {task.description && (
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{task.description}</p>
                        )}

                        <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                          <span className={`w-2 h-2 rounded-full ${PRIORITY_DOT[task.priority]}`} title={`${task.priority} priority`} />
                          {task.due_date && (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                              <Calendar className="w-3 h-3" />
                              {formatDueDate(task.due_date)}
                            </span>
                          )}
                          {assignee && (
                            <div className="ml-auto">
                              <Avatar profile={assignee} size="xs" />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Add task input */}
                  {addingTaskIn === column.id ? (
                    <div className="bg-white rounded-xl p-2 border border-slate-200">
                      <textarea
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddTask(column.id); }
                          if (e.key === 'Escape') { setAddingTaskIn(null); setNewTaskTitle(''); }
                        }}
                        autoFocus
                        rows={2}
                        placeholder="Enter task title..."
                        className="w-full text-sm text-slate-800 outline-none resize-none placeholder-slate-400"
                      />
                      <div className="flex gap-2 mt-1">
                        <button
                          onClick={() => handleAddTask(column.id)}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => { setAddingTaskIn(null); setNewTaskTitle(''); }}
                          className="px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 text-xs font-medium transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingTaskIn(column.id)}
                      className="w-full flex items-center gap-1.5 px-2 py-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 text-sm transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add task
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Add column */}
          {addingColumn ? (
            <div className="w-72 shrink-0 bg-slate-100/70 rounded-2xl p-3">
              <input
                type="text"
                value={newColumnTitle}
                onChange={(e) => setNewColumnTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddColumn();
                  if (e.key === 'Escape') { setAddingColumn(false); setNewColumnTitle(''); }
                }}
                autoFocus
                placeholder="Enter column title..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 outline-none transition-all text-sm text-slate-800 bg-white"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleAddColumn}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
                >
                  Add Column
                </button>
                <button
                  onClick={() => { setAddingColumn(false); setNewColumnTitle(''); }}
                  className="px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingColumn(true)}
              className="w-72 shrink-0 flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/50 border-2 border-dashed border-slate-300 text-slate-500 hover:bg-white hover:border-slate-400 hover:text-slate-700 text-sm font-medium transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Column
            </button>
          )}
        </div>
      </div>

      {/* Task detail modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          columns={columns}
          members={members}
          projectId={projectId}
          onClose={() => setSelectedTask(null)}
          onTaskUpdated={() => {
            // Update the task in local state
            setTasks((prev) => prev.map((t) => (t.id === selectedTask.id ? { ...t, ...selectedTask } : t)));
            void loadTasks();
          }}
        />
      )}
    </div>
  );
}
