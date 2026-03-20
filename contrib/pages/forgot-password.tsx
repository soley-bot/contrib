import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email.trim()) {
      setError('Email is required.');
      return;
    }
    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + '/reset-password',
    });
    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }
    setSent(true);
  }

  return (
    <div className="min-h-dvh bg-[#F9FAFB]">
      <div className="max-w-[440px] mx-auto px-5 pt-8 pb-20">
        <div className="text-xl font-extrabold text-brand mb-8">Contrib</div>

        {sent ? (
          <>
            <h1 className="text-[22px] font-bold mb-1">Check your email</h1>
            <p className="text-sm text-[#57534E] mb-7">
              We sent a password reset link to <span className="font-medium text-[#111827]">{email}</span>.
              Click the link in the email to set a new password.
            </p>
            <p className="text-[13px] text-[#57534E] text-center mt-4">
              Back to{' '}
              <Link href="/login" className="text-[#C53678] font-medium">Log in</Link>
            </p>
          </>
        ) : (
          <>
            <h1 className="text-[22px] font-bold mb-1">Forgot password?</h1>
            <p className="text-sm text-[#57534E] mb-7">Enter your email and we&apos;ll send you a reset link.</p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-[#57534E]">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@university.edu.kh"
                  className="w-full border border-[#E7E5E4] rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none bg-white"
                />
              </div>

              {error && <p className="text-sm text-[#EF4444]">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="h-12 bg-brand hover:bg-brand-hover text-white text-[15px] font-medium rounded-md transition-colors disabled:opacity-60 mt-1"
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>

            <p className="text-[13px] text-[#57534E] text-center mt-4">
              Back to{' '}
              <Link href="/login" className="text-[#C53678] font-medium">Log in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
