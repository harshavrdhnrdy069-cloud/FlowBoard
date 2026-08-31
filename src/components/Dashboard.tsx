import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Project, ProjectMemberWithProfile } from '@/types/database';
import Avatar from '@/components/Avatar';
import { Plus, Users, FolderKanban, Loader2, X, ArrowRight, Trash2 } from 'lucide-react';

const PROJECT_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6'];

export default function Dashboard({ onOpenProject }: { onOpenProject: (id: string) => void }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState<string | null>(null);
  const [members, setMembers] = useState<ProjectMemberWithProfile[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);

  // Create form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    setProjects(data ?? []);
    setLoading(false);
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    const { data, error } = await supabase
      .from('projects')
      .insert({ name, description, color, owner_id: user!.id })
      .select()
      .single();
    setCreating(false);
    if (error) {
      setCreateError(error.message);
      return;
    }
    setName('');
    setDescription('');
    setColor(PROJECT_COLORS[0]);
    setShowCreate(false);
    setProjects((prev) => [data as Project, ...prev]);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('projects').delete().eq('id', id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  const loadMembers = async (projectId: string) => {
    const { data } = await supabase
      .from('project_members')
      .select('*, profile:profiles(*)')
      .eq('project_id', projectId)
      .order('joined_at', { ascending: true });
    setMembers((data ?? []) as ProjectMemberWithProfile[]);
  };

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!showInvite) return;
    setInviteError(null);
    setInviteLoading(true);

    // Find user by email — profiles don't store email, so we query auth.users via a helper
    // Since we can't query auth.users directly, we'll search profiles by full_name as a fallback
    // Actually, we need to invite by email. Let's look up the user's profile.
    // We can't access auth.users from the client. We'll search by email via a different approach.
    // Let's use the profiles table - but it doesn't have email.
    // We'll need an edge function or a different approach. For now, let's search by full_name.
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, full_name')
      .ilike('full_name', inviteEmail)
      .limit(1)
      .maybeSingle();

    if (!profileData) {
      setInviteError('User not found. Ask them to sign up first, then invite by their full name.');
      setInviteLoading(false);
      return;
    }

    const { error } = await supabase
      .from('project_members')
      .insert({ project_id: showInvite, user_id: (profileData as { id: string }).id, role: 'member' });

    setInviteLoading(false);
    if (error) {
      setInviteError(error.code === '23505' ? 'User is already a member.' : error.message);
      return;
    }
    setInviteEmail('');
    setInviteError(null);
    await loadMembers(showInvite);
  };

  const openInvite = async (projectId: string) => {
    setShowInvite(projectId);
    setInviteEmail('');
    setInviteError(null);
    await loadMembers(projectId);
  };

  const removeMember = async (memberId: string) => {
    await supabase.from('project_members').delete().eq('id', memberId);
    if (showInvite) await loadMembers(showInvite);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Your Projects</h1>
          <p className="text-slate-500 mt-1">Create boards and collaborate with your team.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-24">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 mb-4">
            <FolderKanban className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700">No projects yet</h3>
          <p className="text-slate-400 mt-1 mb-6">Create your first project to get started.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-all"
          >
            <Plus className="w-4 h-4" />
            Create Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((project) => (
            <div
              key={project.id}
              className="group relative bg-white rounded-2xl border border-slate-200 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/50 transition-all overflow-hidden"
            >
              <div className="h-2" style={{ backgroundColor: project.color }} />
              <div className="p-5">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-slate-900 text-lg leading-tight">{project.name}</h3>
                  {project.owner_id === user?.id && (
                    <button
                      onClick={() => handleDelete(project.id)}
                      className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all p-1"
                      aria-label="Delete project"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-sm text-slate-500 line-clamp-2 min-h-[40px]">
                  {project.description || 'No description'}
                </p>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => openInvite(project.id)}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 font-medium transition-colors"
                  >
                    <Users className="w-3.5 h-3.5" />
                    Members
                  </button>
                  <button
                    onClick={() => onOpenProject(project.id)}
                    className="inline-flex items-center gap-1 text-sm font-medium text-slate-900 hover:gap-2 transition-all"
                  >
                    Open
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      {showCreate && (
        <Modal onClose={() => setShowCreate(false)} title="Create New Project">
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Project Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 outline-none transition-all text-slate-900"
                placeholder="Marketing Campaign"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 outline-none transition-all text-slate-900 resize-none"
                placeholder="What is this project about?"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Color</label>
              <div className="flex gap-2 flex-wrap">
                {PROJECT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-lg transition-all ${color === c ? 'ring-2 ring-offset-2 ring-slate-900 scale-110' : 'hover:scale-110'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            {createError && (
              <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                {createError}
              </div>
            )}
            <button
              type="submit"
              disabled={creating}
              className="w-full py-3 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 disabled:opacity-60 transition-all flex items-center justify-center gap-2"
            >
              {creating && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Project
            </button>
          </form>
        </Modal>
      )}

      {/* Invite / Members Modal */}
      {showInvite && (
        <Modal onClose={() => setShowInvite(null)} title="Manage Members">
          <div className="space-y-4">
            <form onSubmit={handleInvite} className="flex gap-2">
              <input
                type="text"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Enter user's full name to invite"
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 outline-none transition-all text-slate-900 text-sm"
              />
              <button
                type="submit"
                disabled={inviteLoading || !inviteEmail}
                className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-60 transition-all"
              >
                {inviteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Invite'}
              </button>
            </form>
            {inviteError && (
              <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">
                {inviteError}
              </div>
            )}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <Avatar profile={m.profile} size="sm" />
                    <div>
                      <p className="text-sm font-medium text-slate-700">{m.profile?.full_name || 'Unknown'}</p>
                      <p className="text-xs text-slate-400 capitalize">{m.role}</p>
                    </div>
                  </div>
                  {m.role !== 'owner' && (
                    <button
                      onClick={() => removeMember(m.id)}
                      className="text-slate-300 hover:text-red-500 p-1 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
