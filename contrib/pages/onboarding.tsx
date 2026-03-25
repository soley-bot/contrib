import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import type { GetServerSideProps } from 'next';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/supabase-server';
import RoleToggle from '@/components/role-toggle';
import type { User } from '@supabase/supabase-js';
import type { UserRole } from '@/types';

const YEAR_OPTIONS = ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Graduate'];

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
      university: universityVal.trim() || '',
      faculty: facultyVal.trim() || '',
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
    <div className="min-h-dvh bg-[#F8FAFF]">
      <div className="max-w-[440px] mx-auto px-5 pt-8 pb-20">
        <div className="text-xl font-extrabold text-brand mb-6">Contrib</div>

        {/* Welcome illustration */}
        <div className="flex items-center gap-4 mb-6 p-4 bg-white border border-[#E2E8F0] rounded-xl">
          <svg viewBox="0 0 64 64" fill="none" className="w-14 h-14 flex-shrink-0">
            <circle cx="32" cy="32" r="32" fill="#EBF0FF"/>
            <circle cx="32" cy="24" r="10" fill="#93B4FF"/>
            <rect x="16" y="40" width="32" height="18" rx="8" fill="#1A56E8"/>
            {/* graduation cap */}
            <rect x="22" y="15" width="20" height="4" rx="2" fill="#0F172A"/>
            <polygon points="32,11 44,17 32,23 20,17" fill="#0F172A"/>
            <line x1="44" y1="17" x2="44" y2="24" stroke="#0F172A" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="44" cy="25" r="2" fill="#1A56E8"/>
          </svg>
          <div>
            <p className="text-[15px] font-bold text-[#0F172A]">Welcome to Contrib</p>
            <p className="text-[13px] text-[#475569] mt-0.5">Let&apos;s set up your profile so you can get started.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-[#475569]">Full name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sophea Chea"
              className="w-full border border-[#E2E8F0] rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none bg-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-[#475569]">
              University <span className="font-normal text-[#94A3B8]">(optional)</span>
            </label>
            <input
              type="text"
              value={university}
              onChange={(e) => setUniversity(e.target.value)}
              placeholder="Royal University of Phnom Penh"
              className="w-full border border-[#E2E8F0] rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none bg-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-[#475569]">
              Faculty / Major <span className="font-normal text-[#94A3B8]">(optional)</span>
            </label>
            <input
              type="text"
              value={faculty}
              onChange={(e) => setFaculty(e.target.value)}
              placeholder="Computer Science"
              className="w-full border border-[#E2E8F0] rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none bg-white"
            />
          </div>
          <div className="flex flex-col gap-0">
            <RoleToggle value={role} onChange={setRole} />
            <p className="text-[12px] text-[#64748B] mt-1.5 leading-snug">
              This determines your experience. You can change it later in your profile -- until you create your first group or course.
            </p>
          </div>

          {role === 'student' && (
            <div className="flex flex-col gap-1">
              <label className="text-[13px] font-medium text-[#475569]">
                Year of study <span className="font-normal text-[#94A3B8]">(optional)</span>
              </label>
              <select
                value={yearOfStudy}
                onChange={(e) => setYearOfStudy(e.target.value)}
                className="w-full border border-[#E2E8F0] rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none bg-white"
              >
                <option value="">Select year…</option>
                {YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          )}

          {error && <p className="text-sm text-[#DC2626]">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="h-11 bg-brand hover:bg-brand-hover text-white text-[15px] font-medium rounded-md transition-colors disabled:opacity-60 mt-1"
          >
            {loading ? 'Saving…' : 'Get started'}
          </button>
          <button
            type="button"
            onClick={handleSkip}
            disabled={loading}
            className="text-sm text-[#94A3B8] hover:text-[#475569] transition-colors text-center disabled:opacity-60"
          >
            Skip for now →
          </button>
        </form>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const { redirect } = await requireAuth(ctx);
  if (redirect) return { redirect };
  return { props: {} };
};
