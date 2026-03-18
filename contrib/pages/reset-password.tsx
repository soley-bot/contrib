import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase processes the recovery token in the URL hash and fires an
    // AUTH_TOKEN_REFRESHED / PASSWORD_RECOVERY event. Wait for it.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }
    router.push('/dashboard');
  }

  return (
    <div className="min-h-dvh bg-[#F9FAFB]">
      <div className="max-w-[440px] mx-auto px-5 pt-8 pb-20">
        <div className="text-xl font-extrabold text-[#FF5841] mb-8">Contrib</div>

        {!ready ? (
          <>
            <h1 className="text-[22px] font-bold mb-1">Link invalid or expired</h1>
            <p className="text-sm text-[#57534E] mb-7">
              This reset link has expired or already been used. Request a new one.
            </p>
            <Link
              href="/forgot-password"
              className="block h-12 bg-[#FF5841] hover:bg-[#E04030] text-white text-[15px] font-medium rounded-md transition-colors text-center leading-[48px]"
            >
              Request new link
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-[22px] font-bold mb-1">Set new password</h1>
            <p className="text-sm text-[#57534E] mb-7">Choose a password that&apos;s at least 8 characters.</p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-[#57534E]">New password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full border border-[#E7E5E4] rounded-md px-3 py-2.5 text-[15px] focus:border-[#FF5841] outline-none bg-white"
                />
              </div>

              {error && <p className="text-sm text-[#EF4444]">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="h-12 bg-[#FF5841] hover:bg-[#E04030] text-white text-[15px] font-medium rounded-md transition-colors disabled:opacity-60 mt-1"
              >
                {loading ? 'Saving…' : 'Set password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
