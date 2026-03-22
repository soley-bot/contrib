import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import EditProfileModal from '@/components/edit-profile-modal';
import { IconLogout, IconHome, IconBoard, IconActivity, IconUsers } from '@/components/icons';
import { useProfile } from '@/hooks/use-profile';
import type { Profile, Group, UserRole } from '@/types';

interface NavProps {
  profile: Profile | null;
  role?: UserRole;
  group?: Group | null;
  onTabChange?: (tab: string) => void;
  activeTab?: string;
  onProfileUpdate?: () => void;
}

export default function Nav({ profile, role, group, onTabChange, activeTab, onProfileUpdate }: NavProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [showEdit, setShowEdit] = useState(false);
  const { signOut } = useProfile();
  const isTeacher = role === 'teacher';
  const homeRoute = isTeacher ? '/teacher' : '/dashboard';
  const initials = profile?.name?.slice(0, 2).toUpperCase() ?? '??';

  async function handleSignOut() {
    await signOut();
    router.push('/');
  }

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  return (
    <>
      {/* ── MOBILE TOP BAR ─────────────────────────────── */}
      <header className="md:hidden fixed top-0 inset-x-0 z-50 h-14 bg-white border-b border-[#E2E8F0] flex items-center justify-between px-4 gap-2">
        {group ? (
          <button
            onClick={() => router.push(homeRoute)}
            className="flex items-center gap-1 text-[#64748B] hover:text-[#0F172A] transition-colors flex-shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M11 14L6 9l5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span className="text-[13px] font-medium">{isTeacher ? 'Courses' : 'Groups'}</span>
          </button>
        ) : (
          <span
            className="text-base font-extrabold text-brand cursor-pointer"
            onClick={() => router.push(homeRoute)}
          >
            Contrib
          </span>
        )}
        {group && (
          <span className="text-[15px] font-semibold text-[#0F172A] flex-1 text-center truncate px-2">
            {group.name}
          </span>
        )}
        <div className="relative flex items-center gap-2" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="w-7 h-7 rounded-full bg-brand text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0 active:opacity-80"
          >
            {initials}
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-9 w-44 bg-white border border-[#E2E8F0] rounded-[10px] shadow-lg py-1 z-50"
              style={{ boxShadow: '0 4px 16px rgba(0,0,0,.10)' }}>
              {profile && (
                <div className="px-3 py-2 border-b border-[#F3F4F6]">
                  <p className="text-[13px] font-semibold text-[#0F172A] truncate">{profile.name}</p>
                </div>
              )}
              <button
                onClick={() => { setMenuOpen(false); setShowEdit(true); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-[13px] font-medium text-[#64748B] hover:bg-[#EBF0FF] transition-colors"
              >
                Edit profile
              </button>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-[13px] font-medium text-[#64748B] hover:bg-[#EBF0FF] transition-colors"
              >
                <IconLogout size={15} /> Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── DESKTOP SIDEBAR ────────────────────────────── */}
      <aside className="hidden md:flex flex-col fixed top-0 left-0 h-full w-[220px] bg-white border-r border-[#E2E8F0] z-50 py-5 px-3">
        <div className="flex items-center gap-2 px-2 mb-6">
          <div className="w-6 h-6 bg-brand rounded-[7px] flex items-center justify-center flex-shrink-0">
            <svg width="13" height="13" viewBox="0 0 160 160" fill="none">
              <line x1="58" y1="18" x2="58" y2="142" stroke="#fff" strokeWidth="3" opacity="0.15"/>
              <circle cx="58" cy="128" r="6" fill="#fff" opacity="0.18"/>
              <circle cx="58" cy="100" r="7" fill="#fff" opacity="0.2"/>
              <circle cx="58" cy="46" r="12" fill="#fff"/>
              <line x1="70" y1="46" x2="118" y2="46" stroke="#fff" strokeWidth="3" strokeLinecap="round"/>
              <circle cx="122" cy="46" r="4" fill="#fff"/>
            </svg>
          </div>
          <span className="text-base font-extrabold text-[#0F172A]">Contrib</span>
        </div>

        <div className="mb-5">
          <div className="text-[11px] font-semibold tracking-widest uppercase text-[#64748B] px-2 mb-1.5">
            {isTeacher ? 'My Courses' : 'My Groups'}
          </div>
          <button
            onClick={() => router.push(homeRoute)}
            className={`w-full flex items-center gap-2 px-2 py-2 rounded-md text-[13px] font-medium transition-colors ${
              !group ? 'bg-brand-light text-brand' : 'text-[#64748B] hover:bg-[#EBF0FF]'
            }`}
          >
            <IconHome size={16} />
            Dashboard
          </button>
        </div>

        {group && onTabChange && (
          <div className="mb-5">
            <div className="text-[11px] font-semibold tracking-widest uppercase text-[#64748B] px-2 mb-1.5">
              Current Group
            </div>
            {[
              { id: 'tasks',    label: 'Tasks',    icon: <IconBoard size={16} />    },
              { id: 'activity', label: 'Timeline', icon: <IconActivity size={16} /> },
              { id: 'members',  label: 'Members',  icon: <IconUsers size={16} />    },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center gap-2 px-2 py-2 rounded-md text-[13px] font-medium transition-colors ${
                  activeTab === item.id
                    ? 'bg-brand-light text-brand'
                    : 'text-[#64748B] hover:bg-[#EBF0FF]'
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
            className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-[13px] font-medium text-[#64748B] hover:bg-[#EBF0FF] transition-colors"
          >
            <IconLogout size={16} />
            Sign out
          </button>
          {profile && (
            <div className="flex items-center gap-2 px-2 py-2 mt-1">
              <div className="w-7 h-7 rounded-full bg-brand text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-[#0F172A] truncate">{profile.name}</p>
                <button onClick={() => setShowEdit(true)} className="text-[11px] text-[#64748B] hover:text-brand transition-colors">
                  Edit profile
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {showEdit && profile && (
        <EditProfileModal
          profile={profile}
          onSaved={() => onProfileUpdate?.()}
          onClose={() => setShowEdit(false)}
        />
      )}
    </>
  );
}
