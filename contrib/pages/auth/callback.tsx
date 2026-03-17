import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.replace('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', session.user.id)
        .single();

      if (profile) {
        router.replace('/dashboard');
      } else {
        router.replace('/onboarding');
      }
    });
  }, [router]);

  return (
    <div className="min-h-dvh bg-[#F9FAFB] flex items-center justify-center">
      <p className="text-[15px] text-[#57534E]">Signing you in…</p>
    </div>
  );
}
