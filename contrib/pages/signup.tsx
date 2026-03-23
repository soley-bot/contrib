import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import RoleToggle from '@/components/role-toggle';
import type { UserRole } from '@/types';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  );
}

export default function Signup() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [university, setUniversity] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleGoogleSignIn() {
    setLoading(true);
    const returnTo = typeof router.query.returnTo === 'string' ? router.query.returnTo : '';
    const callbackUrl = returnTo
      ? `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(returnTo)}`
      : `${window.location.origin}/auth/callback`;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl },
    });
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', session.user.id).single();
      if (!profile) router.replace('/onboarding');
      else router.replace(profile.role === 'teacher' ? '/teacher' : '/dashboard');
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim() || !university.trim() || !email.trim() || !password.trim()) {
      setError('All fields are required.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);

    // Create user via API route (uses service role — no confirmation email sent)
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name, university, role }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? 'Sign up failed.');
      setLoading(false);
      return;
    }

    // Sign in immediately after account creation
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    const raw = typeof router.query.returnTo === 'string' ? router.query.returnTo : '';
    const hasReturnTo = raw.startsWith('/') && !raw.startsWith('//');
    router.push(hasReturnTo ? raw : role === 'teacher' ? '/teacher' : '/dashboard');
  }

  return (
    <div className="min-h-dvh bg-[#F8FAFF]">
      <div className="max-w-[440px] mx-auto px-5 pt-8 pb-20">
        <div className="flex items-center gap-2 mb-8">
          <svg width="28" height="28" viewBox="0 0 160 160" fill="none" className="flex-shrink-0">
            <line x1="58" y1="18" x2="58" y2="142" stroke="#1A56E8" strokeWidth="3" opacity="0.15"/>
            <circle cx="58" cy="128" r="6" fill="#1A56E8" opacity="0.18"/>
            <circle cx="58" cy="100" r="7" fill="#1A56E8" opacity="0.2"/>
            <circle cx="58" cy="46" r="12" fill="#1A56E8"/>
            <line x1="70" y1="46" x2="118" y2="46" stroke="#1A56E8" strokeWidth="3" strokeLinecap="round"/>
            <circle cx="122" cy="46" r="4" fill="#1A56E8"/>
          </svg>
          <span className="text-xl font-extrabold text-[#0F172A]">Contrib</span>
        </div>
        <h1 className="text-[22px] font-bold mb-1">Put your work on the record.</h1>
        <p className="text-sm text-[#64748B] mb-7">Now in early access.</p>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="h-12 w-full border border-[#E2E8F0] bg-white hover:bg-[#F8FAFF] text-[15px] font-medium rounded-md transition-colors flex items-center justify-center gap-2 disabled:opacity-60 mb-1"
        >
          <GoogleIcon /> Continue with Google
        </button>

        <div className="flex items-center gap-3 my-1">
          <hr className="flex-1 border-[#E2E8F0]" />
          <span className="text-[12px] text-[#64748B]">or</span>
          <hr className="flex-1 border-[#E2E8F0]" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-[#64748B]">Full name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-[#E2E8F0] rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none bg-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-[#64748B]">School</label>
            <input
              type="text"
              value={university}
              onChange={(e) => setUniversity(e.target.value)}
              placeholder="Royal University of Phnom Penh"
              className="w-full border border-[#E2E8F0] rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none bg-white"
            />
          </div>
          <RoleToggle value={role} onChange={setRole} />
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-[#64748B]">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sophea@gmail.com"
              className="w-full border border-[#E2E8F0] rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none bg-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-[#64748B]">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              className="w-full border border-[#E2E8F0] rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none bg-white"
            />
          </div>

          {error && <p className="text-sm text-[#DC2626]">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="h-12 bg-brand hover:bg-brand-hover text-white text-[15px] font-medium rounded-md transition-colors disabled:opacity-60 mt-1"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="text-[13px] text-[#64748B] text-center mt-4">
          Already have an account?{' '}
          <Link href="/login" className="text-brand font-medium">Log in</Link>
        </p>
      </div>
    </div>
  );
}
