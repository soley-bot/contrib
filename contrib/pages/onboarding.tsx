import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

const YEAR_OPTIONS = ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Graduate'];

export default function Onboarding() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [university, setUniversity] = useState('');
  const [faculty, setFaculty] = useState('');
  const [yearOfStudy, setYearOfStudy] = useState('');
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim() || !university.trim() || !faculty.trim() || !yearOfStudy) {
      setError('All fields are required.');
      return;
    }
    if (!user) return;
    setLoading(true);

    const avatarUrl = user.user_metadata?.avatar_url ?? null;

    const { error: insertError } = await supabase.from('profiles').insert({
      id: user.id,
      name: name.trim(),
      university: university.trim(),
      faculty: faculty.trim(),
      year_of_study: yearOfStudy,
      avatar_url: avatarUrl,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    router.push('/dashboard');
  }

  return (
    <div className="min-h-dvh bg-[#F9FAFB]">
      <div className="max-w-[440px] mx-auto px-5 pt-8 pb-20">
        <div className="text-xl font-extrabold text-[#FF5841] mb-8">Contrib</div>
        <h1 className="text-[22px] font-bold mb-1">Almost there!</h1>
        <p className="text-sm text-[#57534E] mb-7">Tell us a bit about yourself to get started.</p>

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
            <label className="text-[13px] font-medium text-[#57534E]">University</label>
            <input
              type="text"
              value={university}
              onChange={(e) => setUniversity(e.target.value)}
              placeholder="Royal University of Phnom Penh"
              className="w-full border border-[#E7E5E4] rounded-md px-3 py-2.5 text-[15px] focus:border-[#FF5841] outline-none bg-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-[#57534E]">Faculty / Major</label>
            <input
              type="text"
              value={faculty}
              onChange={(e) => setFaculty(e.target.value)}
              placeholder="Computer Science"
              className="w-full border border-[#E7E5E4] rounded-md px-3 py-2.5 text-[15px] focus:border-[#FF5841] outline-none bg-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-[#57534E]">Year of study</label>
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
        </form>
      </div>
    </div>
  );
}
