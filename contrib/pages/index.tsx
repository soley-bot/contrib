import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function Landing() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/dashboard');
    });
  }, [router]);

  return (
    <div className="min-h-dvh bg-[#F9FAFB]">
      {/* Nav */}
      <nav className="h-14 px-5 flex items-center justify-between bg-white border-b border-[#E5E7EB]">
        <span className="text-lg font-extrabold text-[#6366F1]">Contrib</span>
        <div className="flex gap-2">
          <Link href="/login" className="h-8 px-3 flex items-center text-sm text-[#6B7280] hover:text-[#111827] font-medium rounded-md transition-colors">
            Log in
          </Link>
          <Link href="/signup" className="h-8 px-3 flex items-center text-sm text-white bg-[#6366F1] hover:bg-[#4F46E5] font-medium rounded-md transition-colors">
            Sign up free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="text-center px-5 pt-12 pb-10">
        <span className="inline-block px-3 py-1 bg-[#EEF2FF] text-[#6366F1] text-xs font-semibold rounded-full mb-4">
          For Cambodian university students
        </span>
        <h1 className="text-[30px] font-extrabold leading-tight tracking-tight text-[#111827] mb-3">
          Track. Prove.<br />
          <span className="text-[#6366F1]">Export.</span>
        </h1>
        <p className="text-[15px] text-[#6B7280] leading-relaxed mb-7 max-w-xs mx-auto">
          Stop arguing about who did what. Contrib records every contribution automatically and exports a PDF your teacher already expects.
        </p>
        <Link
          href="/signup"
          className="inline-flex items-center justify-center h-12 px-8 bg-[#6366F1] hover:bg-[#4F46E5] text-white text-base font-medium rounded-md transition-colors w-full max-w-[300px]"
        >
          Get started — it&apos;s free
        </Link>
      </div>

      {/* Pills */}
      <div className="flex gap-2 justify-center px-5 pb-10 flex-wrap">
        {['✓ Timestamped logs', '↑ PDF peer eval', '👥 3–6 members'].map((pill) => (
          <div key={pill} className="px-3.5 py-2 bg-white border border-[#E5E7EB] rounded-full text-[13px] font-medium text-[#6B7280]">
            {pill}
          </div>
        ))}
      </div>

      {/* Features */}
      <div className="px-5 pb-12 flex flex-col gap-3 max-w-lg mx-auto">
        {[
          { icon: '📝', title: 'Task Tracking', desc: 'Assign tasks to members, track To Do → In Progress → Done. Every move is logged with a timestamp.' },
          { icon: '📊', title: 'Activity Feed', desc: 'A live record of who did what and when. No editing, no deleting — honest data only.' },
          { icon: '📄', title: 'PDF Export', desc: 'One click generates a contribution report formatted exactly like the peer evaluation form your teacher uses.' },
        ].map((f) => (
          <div key={f.title} className="bg-white border border-[#E5E7EB] rounded-[10px] p-5">
            <div className="w-9 h-9 rounded-lg bg-[#EEF2FF] flex items-center justify-center text-lg mb-3">{f.icon}</div>
            <h3 className="text-[15px] font-semibold mb-1">{f.title}</h3>
            <p className="text-[13px] text-[#6B7280] leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>

      <footer className="py-6 text-center text-xs text-[#9CA3AF] border-t border-[#E5E7EB]">
        © 2026 Contrib · Made for Cambodian universities
      </footer>
    </div>
  );
}
