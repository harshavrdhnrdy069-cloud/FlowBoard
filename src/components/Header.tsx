import { useAuth } from '@/context/AuthContext';
import Avatar from '@/components/Avatar';
import NotificationBell from '@/components/NotificationBell';
import { KanbanSquare, LogOut } from 'lucide-react';

export default function Header() {
  const { profile, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-slate-200/80">
      <div className="flex items-center justify-between px-4 sm:px-6 h-16">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
            <KanbanSquare className="w-5 h-5" />
          </div>
          <span className="font-bold text-slate-900 text-lg tracking-tight hidden sm:block">FlowBoard</span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <NotificationBell />
          <div className="flex items-center gap-2.5 pl-2 sm:pl-3 border-l border-slate-200">
            <Avatar profile={profile} size="sm" />
            <span className="text-sm font-medium text-slate-700 hidden sm:block max-w-[120px] truncate">
              {profile?.full_name || 'User'}
            </span>
            <button
              onClick={signOut}
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              aria-label="Sign out"
            >
              <LogOut className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
