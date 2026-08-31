import { getInitials } from '@/lib/utils';
import type { Profile } from '@/types/database';

const sizeMap = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
};

export default function Avatar({
  profile,
  size = 'sm',
  className = '',
}: {
  profile: Pick<Profile, 'full_name' | 'avatar_color'> | null | undefined;
  size?: keyof typeof sizeMap;
  className?: string;
}) {
  const color = profile?.avatar_color ?? '#64748b';
  const name = profile?.full_name ?? '?';
  return (
    <div
      className={`${sizeMap[size]} rounded-full flex items-center justify-center font-semibold text-white shrink-0 ring-2 ring-white/80 ${className}`}
      style={{ backgroundColor: color }}
      title={name}
    >
      {getInitials(name)}
    </div>
  );
}
