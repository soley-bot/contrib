import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function Signup() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [university, setUniversity] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/dashboard');
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
      body: JSON.stringify({ email, password, name, university }),
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
    const returnTo = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/dashboard';
    router.push(returnTo);
  }

  return (
    <div className="min-h-dvh bg-[#F9FAFB]">
      <div className="max-w-[440px] mx-auto px-5 pt-8 pb-20">
        <div className="text-xl font-extrabold text-[#FF5841] mb-8">Contrib</div>
        <h1 className="text-[22px] font-bold mb-1">Create your account</h1>
        <p className="text-sm text-[#57534E] mb-7">Free forever. No credit card.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-[#57534E]">Full name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-[#E7E5E4] rounded-md px-3 py-2.5 text-[15px] focus:border-[#FF5841] outline-none bg-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-[#57534E]">School</label>
            <input
              type="text"
              value={university}
              onChange={(e) => setUniversity(e.target.value)}
              placeholder="Royal University of Phnom Penh"
              className="w-full border border-[#E7E5E4] rounded-md px-3 py-2.5 text-[15px] focus:border-[#FF5841] outline-none bg-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-[#57534E]">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="yourname@gmail.com"
              className="w-full border border-[#E7E5E4] rounded-md px-3 py-2.5 text-[15px] focus:border-[#FF5841] outline-none bg-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-[#57534E]">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              className="w-full border border-[#E7E5E4] rounded-md px-3 py-2.5 text-[15px] focus:border-[#FF5841] outline-none bg-white"
            />
          </div>

          {error && <p className="text-sm text-[#EF4444]">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="h-12 bg-[#FF5841] hover:bg-[#E04030] text-white text-[15px] font-medium rounded-md transition-colors disabled:opacity-60 mt-1"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="text-[13px] text-[#57534E] text-center mt-4">
          Already have an account?{' '}
          <Link href="/login" className="text-[#C53678] font-medium">Log in</Link>
        </p>
      </div>
    </div>
  );
}
