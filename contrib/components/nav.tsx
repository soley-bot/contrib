import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase';
import { IconLogout, IconHome, IconBoard, IconActivity, IconUsers } from '@/components/icons';
import type { Profile, Group } from '@/types';

interface NavProps {
  profile: Profile | null;
  group?: Group | null;
  /** Desktop sidebar nav items — shown only on group pages */
  onTabChange?: (tab: string) => void;
  activeTab?: string;
}

export default function Nav({ profile, group, onTabChange, activeTab }: NavProps) {
  const router = useRouter();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/');
  }

  const initials = profile?.name?.slice(0, 2).toUpperCase() ?? '??';

  return (
    <>
      {/* ── MOBILE TOP BAR ─────────────────────────────── */}
      <header className="md:hidden fixed top-0 inset-x-0 z-50 h-14 bg-white border-b border-[#E7E5E4] flex items-center justify-between px-4 gap-2">
        <span
          className="text-base font-extrabold text-[#FF5841] cursor-pointer"
          onClick={() => router.push('/dashboard')}
        >
          Contrib
        </span>
        {group && (
          <span className="text-[15px] font-semibold text-[#1C1917] flex-1 text-center truncate px-2">
            {group.name}
          </span>
        )}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#FF5841] text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">
            {initials}
          </div>
        </div>
      </header>

      {/* ── DESKTOP SIDEBAR ────────────────────────────── */}
      <aside className="hidden md:flex flex-col fixed top-0 left-0 h-full w-[220px] bg-white border-r border-[#E7E5E4] z-50 py-5 px-3">
        <div className="text-base font-extrabold text-[#FF5841] px-2 mb-6">Contrib</div>

        <div className="mb-5">
          <div className="text-[10px] font-semibold tracking-widest uppercase text-[#A8A29E] px-2 mb-1.5">
            My Groups
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className={`w-full flex items-center gap-2 px-2 py-2 rounded-md text-[13px] font-medium transition-colors ${
              !group ? 'bg-[#FFF0EE] text-[#FF5841]' : 'text-[#57534E] hover:bg-[#F5F5F4]'
            }`}
          >
            <IconHome size={16} />
            Dashboard
          </button>
        </div>

        {group && onTabChange && (
          <div className="mb-5">
            <div className="text-[10px] font-semibold tracking-widest uppercase text-[#A8A29E] px-2 mb-1.5">
              Current Group
            </div>
            {[
              { id: 'tasks',    label: 'Tasks',    icon: <IconBoard size={16} />    },
              { id: 'activity', label: 'Activity', icon: <IconActivity size={16} /> },
              { id: 'members',  label: 'Members',  icon: <IconUsers size={16} />    },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center gap-2 px-2 py-2 rounded-md text-[13px] font-medium transition-colors ${
                  activeTab === item.id
                    ? 'bg-[#FFF0EE] text-[#FF5841]'
                    : 'text-[#57534E] hover:bg-[#F5F5F4]'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        )}

        <div className="mt-auto">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-[13px] font-medium text-[#57534E] hover:bg-[#F5F5F4] transition-colors"
          >
            <IconLogout size={16} />
            Sign out
          </button>
          {profile && (
            <div className="flex items-center gap-2 px-2 py-2 mt-1">
              <div className="w-7 h-7 rounded-full bg-[#FF5841] text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-[#1C1917] truncate">{profile.name}</p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
