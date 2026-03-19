import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase';
import RoleToggle from '@/components/role-toggle';
import type { User } from '@supabase/supabase-js';
import type { UserRole } from '@/types';

const YEAR_OPTIONS = ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Graduate'];

export default function Onboarding() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [university, setUniversity] = useState('');
  const [faculty, setFaculty] = useState('');
  const [yearOfStudy, setYearOfStudy] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/signup');
        return;
      }
      setUser(session.user);
      const meta = session.user.user_metadata;
      setName(meta.full_name ?? meta.name ?? '');
    });
  }, [router]);

  async function saveProfile(nameVal: string, universityVal: string, facultyVal: string, yearVal: string) {
    if (!user) return;
    setLoading(true);
    const avatarUrl = user.user_metadata?.avatar_url ?? null;
    const { error: insertError } = await supabase.from('profiles').insert({
      id: user.id,
      name: nameVal.trim() || 'User',
      university: universityVal.trim() || null,
      faculty: facultyVal.trim() || null,
      year_of_study: yearVal || null,
      avatar_url: avatarUrl,
      role,
    });
    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return false;
    }
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Name is required.'); return; }
    const ok = await saveProfile(name, university, faculty, yearOfStudy);
    if (ok) router.push(role === 'teacher' ? '/teacher' : '/dashboard');
  }

  async function handleSkip() {
    setError('');
    const ok = await saveProfile(name, '', '', '');
    if (ok) router.push(role === 'teacher' ? '/teacher' : '/dashboard');
  }

  return (
    <div className="min-h-dvh bg-[#F9FAFB]">
      <div className="max-w-[440px] mx-auto px-5 pt-8 pb-20">
        <div className="text-xl font-extrabold text-[#FF5841] mb-6">Contrib</div>

        {/* Welcome illustration */}
        <div className="flex items-center gap-4 mb-6 p-4 bg-white border border-[#E7E5E4] rounded-[12px]">
          <svg viewBox="0 0 64 64" fill="none" className="w-14 h-14 flex-shrink-0">
            <circle cx="32" cy="32" r="32" fill="#FFF0EE"/>
            <circle cx="32" cy="24" r="10" fill="#FFCFC9"/>
            <rect x="16" y="40" width="32" height="18" rx="8" fill="#FF5841"/>
            {/* graduation cap */}
            <rect x="22" y="15" width="20" height="4" rx="2" fill="#1C1917"/>
            <polygon points="32,11 44,17 32,23 20,17" fill="#1C1917"/>
            <line x1="44" y1="17" x2="44" y2="24" stroke="#1C1917" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="44" cy="25" r="2" fill="#FF5841"/>
          </svg>
          <div>
            <p className="text-[15px] font-bold text-[#1C1917]">Welcome to Contrib! 🎉</p>
            <p className="text-[13px] text-[#57534E] mt-0.5">Let&apos;s set up your profile so you can get started.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-[#57534E]">Full name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sophea Chea"
              className="w-full border border-[#E7E5E4] rounded-md px-3 py-2.5 text-[15px] focus:border-[#FF5841] outline-none bg-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-[#57534E]">
              University <span className="font-normal text-[#A8A29E]">(optional)</span>
            </label>
            <input
              type="text"
              value={university}
              onChange={(e) => setUniversity(e.target.value)}
              placeholder="Royal University of Phnom Penh"
              className="w-full border border-[#E7E5E4] rounded-md px-3 py-2.5 text-[15px] focus:border-[#FF5841] outline-none bg-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-[#57534E]">
              Faculty / Major <span className="font-normal text-[#A8A29E]">(optional)</span>
            </label>
            <input
              type="text"
              value={faculty}
              onChange={(e) => setFaculty(e.target.value)}
              placeholder="Computer Science"
              className="w-full border border-[#E7E5E4] rounded-md px-3 py-2.5 text-[15px] focus:border-[#FF5841] outline-none bg-white"
            />
          </div>
          <RoleToggle value={role} onChange={setRole} />

          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-[#57534E]">
              Year of study <span className="font-normal text-[#A8A29E]">(optional)</span>
            </label>
            <select
              value={yearOfStudy}
              onChange={(e) => setYearOfStudy(e.target.value)}
              className="w-full border border-[#E7E5E4] rounded-md px-3 py-2.5 text-[15px] focus:border-[#FF5841] outline-none bg-white"
            >
              <option value="">Select year…</option>
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-[#EF4444]">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="h-12 bg-[#FF5841] hover:bg-[#E04030] text-white text-[15px] font-medium rounded-md transition-colors disabled:opacity-60 mt-1"
          >
            {loading ? 'Saving…' : 'Get started'}
          </button>
          <button
            type="button"
            onClick={handleSkip}
            disabled={loading}
            className="text-sm text-[#A8A29E] hover:text-[#57534E] transition-colors text-center disabled:opacity-60"
          >
            Skip for now →
          </button>
        </form>
      </div>
    </div>
  );
}
