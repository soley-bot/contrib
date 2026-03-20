import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M2.5 7l3 3 6-6" stroke="var(--brand)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconArrowUp = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M7 11V3M3.5 6.5L7 3l3.5 3.5" stroke="var(--brand)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconUsers = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <circle cx="5" cy="4.5" r="2" stroke="var(--brand)" strokeWidth="1.5"/>
    <path d="M1 11.5c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="var(--brand)" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M10 6.5c1.1 0 2 .9 2 2v1" stroke="var(--brand)" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M8.5 3c.8 0 1.5.7 1.5 1.5S9.3 6 8.5 6" stroke="var(--brand)" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const IconLink = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M6 8l-1 1a2.83 2.83 0 01-4-4l2-2a2.83 2.83 0 014 0" stroke="var(--brand)" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M8 6l1-1a2.83 2.83 0 014 4l-2 2a2.83 2.83 0 01-4 0" stroke="var(--brand)" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M5 9l4-4" stroke="var(--brand)" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const IconTask = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <rect x="3" y="3" width="14" height="14" rx="3" stroke="var(--brand)" strokeWidth="1.5"/>
    <path d="M6.5 10l2.5 2.5 4.5-5" stroke="var(--brand)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconActivity = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M3 10h2.5l2-5 3 9 2-7 1.5 3H17" stroke="#C53678" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconPDF = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M5 3h7l4 4v11a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="var(--brand)" strokeWidth="1.5"/>
    <path d="M12 3v4h4" stroke="var(--brand)" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M10 9v5M7.5 12l2.5 2.5L12.5 12" stroke="var(--brand)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const HeroIllustration = () => (
  <svg viewBox="0 0 360 196" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
    <rect width="360" height="196" rx="14" fill="#FFF8F7"/>
    <rect width="360" height="44" rx="14" fill="var(--brand)"/>
    <rect y="28" width="360" height="16" fill="var(--brand)"/>
    <circle cx="22" cy="22" r="5.5" fill="white" fillOpacity="0.35"/>
    <circle cx="38" cy="22" r="5.5" fill="white" fillOpacity="0.35"/>
    <circle cx="54" cy="22" r="5.5" fill="white" fillOpacity="0.35"/>
    <rect x="76" y="14" width="160" height="16" rx="6" fill="white" fillOpacity="0.25"/>
    <rect x="84" y="19" width="80" height="6" rx="3" fill="white" fillOpacity="0.4"/>
    <circle cx="314" cy="22" r="11" fill="#C53678"/>
    <text x="314" y="26" textAnchor="middle" fontSize="8" fontWeight="700" fill="white">SO</text>
    <circle cx="330" cy="22" r="11" fill="var(--brand)" fillOpacity="0.6"/>
    <text x="330" y="26" textAnchor="middle" fontSize="8" fontWeight="700" fill="white">VR</text>
    <circle cx="346" cy="22" r="11" fill="white" fillOpacity="0.4"/>
    <text x="346" y="26" textAnchor="middle" fontSize="8" fontWeight="700" fill="white">KD</text>
    <rect x="14" y="56" width="100" height="13" rx="4" fill="#F3F4F6"/>
    <text x="22" y="66" fontSize="8" fontWeight="700" fill="#6B7280" letterSpacing="0.5">TO DO  2</text>
    <rect x="128" y="56" width="104" height="13" rx="4" fill="#FEE2E2"/>
    <text x="136" y="66" fontSize="8" fontWeight="700" fill="var(--brand)" letterSpacing="0.5">IN PROGRESS  2</text>
    <rect x="246" y="56" width="100" height="13" rx="4" fill="#D1FAE5"/>
    <text x="254" y="66" fontSize="8" fontWeight="700" fill="#16A34A" letterSpacing="0.5">DONE  2</text>
    <rect x="14" y="76" width="100" height="48" rx="8" fill="white" stroke="#E5E7EB" strokeWidth="1"/>
    <rect x="22" y="86" width="56" height="7" rx="3" fill="#1F2937"/>
    <rect x="22" y="97" width="40" height="5" rx="2.5" fill="#D1D5DB"/>
    <circle cx="101" cy="108" r="7" fill="var(--brand-light)"/>
    <text x="101" y="111" textAnchor="middle" fontSize="6" fontWeight="800" fill="var(--brand)">SO</text>
    <rect x="14" y="132" width="100" height="48" rx="8" fill="white" stroke="#E5E7EB" strokeWidth="1"/>
    <rect x="22" y="142" width="48" height="7" rx="3" fill="#1F2937"/>
    <rect x="22" y="153" width="60" height="5" rx="2.5" fill="#D1D5DB"/>
    <circle cx="101" cy="164" r="7" fill="#FDF2F7"/>
    <text x="101" y="167" textAnchor="middle" fontSize="6" fontWeight="800" fill="#C53678">KD</text>
    <rect x="128" y="76" width="104" height="48" rx="8" fill="white" stroke="#FCA5A5" strokeWidth="1"/>
    <rect x="128" y="76" width="4" height="48" rx="2" fill="var(--brand)"/>
    <rect x="140" y="86" width="65" height="7" rx="3" fill="#1F2937"/>
    <rect x="140" y="97" width="42" height="5" rx="2.5" fill="#D1D5DB"/>
    <circle cx="219" cy="108" r="7" fill="var(--brand-light)"/>
    <text x="219" y="111" textAnchor="middle" fontSize="6" fontWeight="800" fill="var(--brand)">VR</text>
    <rect x="128" y="132" width="104" height="48" rx="8" fill="white" stroke="#FCA5A5" strokeWidth="1"/>
    <rect x="128" y="132" width="4" height="48" rx="2" fill="var(--brand)"/>
    <rect x="140" y="142" width="55" height="7" rx="3" fill="#1F2937"/>
    <rect x="140" y="153" width="48" height="5" rx="2.5" fill="#D1D5DB"/>
    <circle cx="219" cy="164" r="7" fill="var(--brand-light)"/>
    <text x="219" y="167" textAnchor="middle" fontSize="6" fontWeight="800" fill="var(--brand)">LM</text>
    <rect x="246" y="76" width="100" height="48" rx="8" fill="white" stroke="#BBF7D0" strokeWidth="1" fillOpacity="0.7"/>
    <rect x="254" y="86" width="52" height="7" rx="3" fill="#9CA3AF"/>
    <rect x="254" y="97" width="40" height="5" rx="2.5" fill="#E5E7EB"/>
    <circle cx="333" cy="100" r="9" fill="#DCFCE7"/>
    <path d="M328 100l3 3 5-5" stroke="#16A34A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <rect x="246" y="132" width="100" height="48" rx="8" fill="white" stroke="#BBF7D0" strokeWidth="1" fillOpacity="0.7"/>
    <rect x="254" y="142" width="62" height="7" rx="3" fill="#9CA3AF"/>
    <rect x="254" y="153" width="34" height="5" rx="2.5" fill="#E5E7EB"/>
    <circle cx="333" cy="156" r="9" fill="#DCFCE7"/>
    <path d="M328 156l3 3 5-5" stroke="#16A34A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export default function Landing() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/dashboard');
    });
  }, [router]);

  return (
    <div className="min-h-dvh bg-white">

      {/* Nav */}
      <nav className="h-14 border-b border-[#F3F4F6] sticky top-0 z-50 bg-white">
        <div className="max-w-6xl mx-auto px-5 h-full flex items-center justify-between">
          <span className="text-lg font-extrabold tracking-tight text-brand">Contrib</span>
          <div className="flex gap-2">
            <Link href="/login" className="h-8 px-3 flex items-center text-sm text-[#6B7280] hover:text-[#111827] font-medium rounded-md transition-colors">
              Log in
            </Link>
            <Link href="/signup" className="h-8 px-3 flex items-center text-sm text-white font-semibold rounded-md transition-colors bg-brand hover:bg-brand-hover">
              Sign up free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-6xl mx-auto px-5">
        <div className="py-10 md:py-16 flex flex-col md:flex-row md:items-center md:gap-12 lg:gap-20">

          {/* Text */}
          <div className="md:flex-1 text-center md:text-left mb-6 md:mb-0">
            <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full mb-4 bg-brand-light text-brand">
              For Cambodian university students
            </span>
            <h1 className="text-[32px] md:text-[44px] lg:text-[52px] font-extrabold leading-tight tracking-tight text-[#111827] mb-4">
              Track. Prove.<br />
              <span className="text-brand">Export.</span>
            </h1>
            <p className="text-[15px] md:text-[17px] text-[#6B7280] leading-relaxed mb-7 max-w-xs mx-auto md:mx-0 md:max-w-sm">
              Stop arguing about who did what. Contrib records every contribution and exports a PDF your teacher already expects.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
              <Link href="/signup" className="inline-flex items-center justify-center h-12 px-8 text-white text-[15px] font-semibold rounded-md transition-colors bg-brand hover:bg-brand-hover">
                Get started — it&apos;s free
              </Link>
              <Link href="/login" className="inline-flex items-center justify-center h-12 px-4 text-[15px] font-medium text-[#6B7280] hover:text-[#111827] transition-colors">
                Log in →
              </Link>
            </div>
            {/* Pills — desktop */}
            <div className="hidden md:flex gap-2 mt-6 flex-wrap">
              {[
                { icon: <IconCheck />, text: 'Timestamped logs' },
                { icon: <IconArrowUp />, text: 'PDF peer eval' },
                { icon: <IconUsers />, text: '3–6 members' },
                { icon: <IconLink />, text: 'Invite via link' },
              ].map((pill) => (
                <div key={pill.text} className="px-3 py-1.5 bg-white border border-[#E5E7EB] rounded-full text-[12px] font-medium text-[#6B7280] flex items-center gap-1.5">
                  {pill.icon} {pill.text}
                </div>
              ))}
            </div>
          </div>

          {/* Illustration */}
          <div className="md:flex-1 md:max-w-[520px]">
            <HeroIllustration />
          </div>
        </div>
      </div>

      {/* Pills — mobile */}
      <div className="flex md:hidden gap-2 justify-center px-5 pb-8 flex-wrap">
        {[
          { icon: <IconCheck />, text: 'Timestamped logs' },
          { icon: <IconArrowUp />, text: 'PDF peer eval' },
          { icon: <IconUsers />, text: '3–6 members' },
          { icon: <IconLink />, text: 'Invite via link' },
        ].map((pill) => (
          <div key={pill.text} className="px-3.5 py-2 bg-white border border-[#E5E7EB] rounded-full text-[13px] font-medium text-[#6B7280] flex items-center gap-1.5">
            {pill.icon} {pill.text}
          </div>
        ))}
      </div>

      {/* Features */}
      <div className="bg-[#FAFAF9] border-t border-[#F3F4F6]">
        <div className="max-w-6xl mx-auto px-5 py-12">
          <h2 className="text-[18px] md:text-[22px] font-extrabold tracking-tight text-[#111827] text-center mb-8">
            Everything your group needs
          </h2>
          <div className="flex flex-col md:grid md:grid-cols-3 gap-4">
            {[
              { icon: <IconTask />, bg: 'var(--brand-light)', title: 'Task Tracking', desc: 'Assign tasks to members, track To Do → In Progress → Done. Every move is timestamped.' },
              { icon: <IconActivity />, bg: '#FDF2F7', title: 'Activity Feed', desc: 'A live record of who did what and when. No editing, no deleting — honest data only.' },
              { icon: <IconPDF />, bg: 'var(--brand-light)', title: 'PDF Export', desc: 'One click generates a contribution report formatted exactly like the peer evaluation form your teacher uses.' },
            ].map((f) => (
              <div key={f.title} className="bg-white border border-[#E5E7EB] rounded-[10px] p-5">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: f.bg }}>
                  {f.icon}
                </div>
                <h3 className="text-[15px] font-bold tracking-tight mb-1">{f.title}</h3>
                <p className="text-[13px] text-[#6B7280] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <footer className="py-6 text-center text-xs text-[#9CA3AF] border-t border-[#E5E7EB] bg-white">
        © 2026 Contrib · Made for Cambodian universities
      </footer>
    </div>
  );
}
