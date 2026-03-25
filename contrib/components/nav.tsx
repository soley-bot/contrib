import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import EditProfileModal from '@/components/edit-profile-modal';
import { IconLogout, IconHome, IconBoard, IconActivity, IconUsers, IconCheck } from '@/components/icons';
import { useProfile } from '@/hooks/use-profile';
import type { Profile, Group, UserRole } from '@/types';

interface NavProps {
  profile: Profile | null;
  role?: UserRole;
  group?: Group | null;
  title?: string;
  backLabel?: string;
  onBack?: () => void;
  onTabChange?: (tab: string) => void;
  activeTab?: string;
  onProfileUpdate?: () => void;
}

export default function Nav({ profile, role, group, title, backLabel, onBack, onTabChange, activeTab, onProfileUpdate }: NavProps) {
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
    window.location.href = '/';
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
      <header className="md:hidden fixed top-0 inset-x-0 z-50 h-14 bg-white border-b border-[#E2E8F0] flex items-center justify-between px-4 gap-2" role="banner">
        {(group || onBack) ? (
          <button
            onClick={group ? () => router.push(homeRoute) : onBack}
            className="flex items-center gap-1 text-[#64748B] hover:text-[#0F172A] transition-colors flex-shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M11 14L6 9l5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span className="text-[13px] font-medium truncate max-w-[120px]">
              {backLabel ? backLabel : (group ? (isTeacher ? 'Courses' : 'Groups') : 'Back')}
            </span>
          </button>
        ) : (
          <span
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => router.push(homeRoute)}
          >
            <svg width="20" height="20" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
              <line x1="58" y1="20" x2="58" y2="145" stroke="#1A56E8" strokeWidth="4" opacity="0.15" strokeLinecap="round"/>
              <circle cx="58" cy="130" r="7" fill="#1A56E8" opacity="0.18"/>
              <circle cx="58" cy="100" r="7" fill="#1A56E8" opacity="0.18"/>
              <circle cx="58" cy="46" r="13" fill="#1A56E8"/>
              <line x1="71" y1="46" x2="120" y2="46" stroke="#1A56E8" strokeWidth="4" strokeLinecap="round"/>
            </svg>
            <span className="text-base font-extrabold text-brand">Contrib</span>
          </span>
        )}
        {(group || title) && (
          <span className="text-[15px] font-semibold text-[#0F172A] flex-1 text-center truncate px-2">
            {group?.name ?? title}
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
            <div className="absolute right-0 top-9 w-44 bg-white border border-[#E2E8F0] rounded-xl shadow-lg py-1 z-50"
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
      <aside className="hidden md:flex flex-col fixed top-0 left-0 h-full w-[220px] bg-white border-r border-[#E2E8F0] z-50 py-5 px-3" role="navigation" aria-label="Main navigation">
        <div className="flex items-center gap-2 px-2 mb-6">
          <svg width="24" height="24" viewBox="0 0 160 160" fill="none" className="flex-shrink-0">
            <line x1="58" y1="18" x2="58" y2="142" stroke="#1A56E8" strokeWidth="3" opacity="0.15"/>
            <circle cx="58" cy="128" r="6" fill="#1A56E8" opacity="0.18"/>
            <circle cx="58" cy="100" r="7" fill="#1A56E8" opacity="0.2"/>
            <circle cx="58" cy="46" r="12" fill="#1A56E8"/>
            <line x1="70" y1="46" x2="118" y2="46" stroke="#1A56E8" strokeWidth="3" strokeLinecap="round"/>
            <circle cx="122" cy="46" r="4" fill="#1A56E8"/>
          </svg>
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
              { id: 'tasks',      label: 'Tasks',      icon: <IconBoard size={16} />    },
              { id: 'activity',   label: 'Timeline',   icon: <IconActivity size={16} /> },
              { id: 'members',    label: 'Members',    icon: <IconUsers size={16} />    },
              { id: 'evaluation', label: 'Peer Review', icon: <IconCheck size={16} />    },
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
            onClick={() => router.push('/profile')}
            className={`w-full flex items-center gap-2 px-2 py-2 rounded-md text-[13px] font-medium transition-colors ${
              router.pathname === '/profile' ? 'bg-brand-light text-brand' : 'text-[#64748B] hover:bg-[#EBF0FF]'
            }`}
          >
            <IconUsers size={16} />
            Profile
          </button>
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
