import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import type { GetServerSidePropsContext } from 'next';
import { createServerClient } from '@/lib/supabase-server';

// ─── Logo ────────────────────────────────────────────────────────────────────

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <svg width="28" height="28" viewBox="0 0 160 160" fill="none" className="flex-shrink-0">
        <line x1="58" y1="18" x2="58" y2="142" stroke="#1A56E8" strokeWidth="3" opacity="0.15"/>
        <circle cx="58" cy="128" r="6" fill="#1A56E8" opacity="0.18"/>
        <circle cx="58" cy="100" r="7" fill="#1A56E8" opacity="0.2"/>
        <circle cx="58" cy="46" r="12" fill="#1A56E8"/>
        <line x1="70" y1="46" x2="118" y2="46" stroke="#1A56E8" strokeWidth="3" strokeLinecap="round"/>
        <circle cx="122" cy="46" r="4" fill="#1A56E8"/>
      </svg>
      <span className="text-lg font-extrabold tracking-tight text-[#0F172A]">Contrib</span>
    </div>
  );
}

// ─── Slide visuals ────────────────────────────────────────────────────────────

function Slide1Visual({ active }: { active: boolean }) {
  return (
    <div className="w-full max-w-[420px] mx-auto">
      <div className="rounded-2xl bg-white border border-[#E2E8F0] overflow-hidden shadow-lg">
        {/* chat header */}
        <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#EF4444]"/>
          <div className="w-2 h-2 rounded-full bg-[#F59E0B]"/>
          <div className="w-2 h-2 rounded-full bg-[#22C55E]"/>
          <span className="ml-2 text-[12px] text-[#64748B] font-medium">Group Project — Mobile App</span>
        </div>
        {/* chat messages */}
        <div className="px-4 py-4 flex flex-col gap-3 min-h-[200px]">
          {[
            { name: 'Dara', msg: 'I finished the wireframes', done: true, delay: 0 },
            { name: 'Dara', msg: 'Also fixed the login bug', done: true, delay: 0.3 },
            { name: 'Dara', msg: 'Starting the API docs now', done: true, delay: 0.6 },
            { name: 'Sokha', msg: '...', done: false, delay: 0.9 },
          ].map((m, i) => (
            <div
              key={i}
              className="flex items-start gap-2.5 transition-all duration-500"
              style={{
                opacity: active ? 1 : 0,
                transform: active ? 'translateY(0)' : 'translateY(8px)',
                transitionDelay: active ? `${m.delay + 0.4}s` : '0s',
              }}
            >
              <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold"
                style={{ background: m.done ? '#1A56E8' : '#CBD5E1', color: 'white' }}>
                {m.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="text-[10px] text-[#94A3B8] mb-0.5">{m.name}</div>
                <div className="text-[13px] text-[#0F172A] bg-[#F1F5F9] rounded-lg px-3 py-2 inline-block">
                  {m.msg}
                </div>
              </div>
            </div>
          ))}
        </div>
        {/* verdict */}
        <div
          className="mx-4 mb-4 rounded-lg border border-[#EF4444]/20 bg-[#FEF2F2] px-4 py-3 text-center transition-all duration-500"
          style={{ opacity: active ? 1 : 0, transitionDelay: active ? '1.8s' : '0s' }}
        >
          <div className="text-[11px] font-bold text-[#EF4444] uppercase tracking-widest mb-1">Final Grade</div>
          <div className="text-[18px] font-extrabold text-[#0F172A]">Everyone gets B+.</div>
          <div className="text-[12px] text-[#64748B] mt-0.5">Same grade. Different effort.</div>
        </div>
      </div>
    </div>
  );
}

function Slide2Visual({ active }: { active: boolean }) {
  const scores = [5, 5, 4, 5, 5, 4, 5, 5];
  return (
    <div className="w-full max-w-[420px] mx-auto relative">
      <div
        className="rounded-2xl bg-white border border-[#E2E8F0] overflow-hidden shadow-lg transition-all duration-500"
        style={{ opacity: active ? 1 : 0, transform: active ? 'translateX(0)' : 'translateX(24px)', transitionDelay: active ? '0.3s' : '0s' }}
      >
        <div className="bg-[#F8FAFF] border-b border-[#E2E8F0] px-5 py-3">
          <div className="text-[13px] font-bold text-[#0F172A]">Peer Evaluation Form</div>
          <div className="text-[11px] text-[#64748B]">Group Project — Semester 2</div>
        </div>
        <div className="px-5 py-4">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-[#94A3B8]">
                <th className="text-left pb-2 font-medium">Member</th>
                <th className="text-center pb-2 font-medium">Score</th>
              </tr>
            </thead>
            <tbody>
              {['Dara', 'Sokha', 'Rith', 'Maly'].map((name, i) => (
                <tr key={name} className="border-t border-[#F1F5F9]">
                  <td className="py-2 text-[#0F172A] font-medium">{name}</td>
                  <td className="py-2 text-center">
                    <div className="flex justify-center gap-0.5">
                      {[1,2,3,4,5].map(star => (
                        <div key={star} className={`w-3 h-3 rounded-sm ${star <= scores[i] ? 'bg-[#F59E0B]' : 'bg-[#E2E8F0]'}`}/>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* FORMALITY stamp */}
      <div
        className="absolute inset-0 flex items-center justify-center transition-all duration-500 pointer-events-none"
        style={{ opacity: active ? 0.45 : 0, transitionDelay: active ? '1.1s' : '0s' }}
      >
        <div className="border-4 border-[#EF4444]/50 rounded-lg px-5 py-2 rotate-[-12deg]">
          <span className="text-[22px] font-extrabold text-[#EF4444]/60 tracking-[0.25em] uppercase">Formality</span>
        </div>
      </div>
    </div>
  );
}

function Slide3Visual({ active }: { active: boolean }) {
  const members = [
    { name: 'Dara', pct: 47, color: '#1A56E8' },
    { name: 'Sokha', pct: 28, color: '#93B4FF' },
    { name: 'Rith', pct: 15, color: '#CBD5E1' },
    { name: 'Maly', pct: 10, color: '#E2E8F0' },
  ];
  return (
    <div className="w-full max-w-[420px] mx-auto">
      <div className="rounded-2xl bg-white border border-[#E2E8F0] shadow-lg overflow-hidden">
        <div className="bg-[#F8FAFF] border-b border-[#E2E8F0] px-4 py-3 flex items-center justify-between">
          <span className="text-[13px] font-bold text-[#0F172A]">Group Contributions</span>
          <span className="text-[10px] font-semibold text-[#1A56E8] bg-[#EBF0FF] px-2 py-0.5 rounded-full">Live</span>
        </div>
        {/* tasks */}
        <div className="px-4 pt-3 pb-2">
          <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest mb-2">Recent Tasks</div>
          {[
            { task: 'Wireframes', assignee: 'DA', done: true, delay: 0.3 },
            { task: 'Login bug fix', assignee: 'DA', done: true, delay: 0.5 },
            { task: 'API documentation', assignee: 'SK', done: false, delay: 0.7 },
          ].map((t, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 py-1.5 transition-all duration-500"
              style={{ opacity: active ? 1 : 0, transform: active ? 'translateX(0)' : 'translateX(-12px)', transitionDelay: active ? `${t.delay}s` : '0s' }}
            >
              <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${t.done ? 'bg-[#16A34A]' : 'bg-[#EBF0FF] border border-[#93B4FF]'}`}>
                {t.done && (
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1.5 4l2 2 3-3" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <span className="text-[13px] text-[#0F172A] flex-1">{t.task}</span>
              <div className="w-6 h-6 rounded-full bg-[#EBF0FF] flex items-center justify-center text-[9px] font-bold text-[#1A56E8]">{t.assignee}</div>
            </div>
          ))}
        </div>
        {/* contribution bars */}
        <div className="px-4 py-3 border-t border-[#F1F5F9]">
          <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest mb-3">Contribution</div>
          {members.map((m, i) => (
            <div key={m.name} className="flex items-center gap-2.5 mb-2">
              <div className="w-16 text-[12px] font-medium text-[#0F172A]">{m.name}</div>
              <div className="flex-1 h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: active ? `${m.pct}%` : '0%',
                    background: m.color,
                    transitionDelay: active ? `${0.9 + i * 0.15}s` : '0s',
                  }}
                />
              </div>
              <div className="w-8 text-right text-[11px] font-semibold text-[#64748B]"
                style={{ opacity: active ? 1 : 0, transition: 'opacity 0.3s', transitionDelay: active ? `${1.3 + i * 0.15}s` : '0s' }}>
                {m.pct}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Slide4Visual({ active }: { active: boolean }) {
  const grades = [
    { name: 'Dara', grade: 'A', color: '#16A34A', bg: '#DCFCE7', border: '#BBF7D0', delay: 0.3 },
    { name: 'Sokha', grade: 'B+', color: '#1A56E8', bg: '#EBF0FF', border: '#93B4FF', delay: 0.55 },
    { name: 'Rith', grade: 'C+', color: '#D97706', bg: '#FEF3C7', border: '#FDE68A', delay: 0.8 },
    { name: 'Maly', grade: 'C', color: '#9CA3AF', bg: '#F1F5F9', border: '#E5E7EB', delay: 1.05 },
  ];
  return (
    <div className="w-full max-w-[420px] mx-auto">
      <div className="grid grid-cols-2 gap-3">
        {grades.map((g) => (
          <div
            key={g.name}
            className="rounded-2xl border p-4 text-center transition-all duration-500"
            style={{
              background: g.bg,
              borderColor: g.border,
              opacity: active ? 1 : 0,
              transform: active ? 'scale(1)' : 'scale(0.85)',
              transitionDelay: active ? `${g.delay}s` : '0s',
            }}
          >
            <div className="text-[11px] font-bold text-[#64748B] mb-2">{g.name}</div>
            <div className="text-[40px] font-extrabold leading-none" style={{ color: g.color }}>{g.grade}</div>
          </div>
        ))}
      </div>
      <div
        className="mt-3 text-center text-[12px] text-[#64748B] transition-all duration-500"
        style={{ opacity: active ? 1 : 0, transitionDelay: active ? '1.4s' : '0s' }}
      >
        Grades based on evidence, not memory.
      </div>
    </div>
  );
}

function Slide5Visual({ active }: { active: boolean }) {
  const stats = [
    { value: '237K', label: 'university students', delay: 0.3 },
    { value: '189', label: 'institutions', delay: 0.6 },
    { value: '0', label: 'tools built for this', delay: 0.9 },
  ];
  return (
    <div className="w-full max-w-[420px] mx-auto flex flex-col gap-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-2xl border border-[#E2E8F0] bg-white px-6 py-5 flex items-center gap-4 transition-all duration-600 shadow-sm"
          style={{
            opacity: active ? 1 : 0,
            transform: active ? 'translateY(0)' : 'translateY(20px)',
            transitionDelay: active ? `${s.delay}s` : '0s',
          }}
        >
          <div className="text-[42px] font-extrabold text-[#0F172A] leading-none w-24 flex-shrink-0">{s.value}</div>
          <div className="text-[14px] text-[#64748B]">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Slide definitions ────────────────────────────────────────────────────────

interface Slide {
  id: number;
  label: string;
  title: string;
  body: string;
  bg: string;
  textColor: string;
  labelColor: string;
  Visual: React.FC<{ active: boolean }>;
}

const SLIDES: Slide[] = [
  {
    id: 1,
    label: 'Every semester',
    title: 'The same thing happens.',
    body: "A group of students gets assigned a project. Four people work. One doesn\u2019t. The deadline comes \u2014 and everyone gets the same grade.",
    bg: '#F8FAFF',
    textColor: '#0F172A',
    labelColor: '#1A56E8',

    Visual: Slide1Visual,
  },
  {
    id: 2,
    label: 'The real problem',
    title: "Teachers know. They just can\u2019t see.",
    body: "Peer evaluation forms exist \u2014 but they\u2019re filled out at the end, from memory, under social pressure. The form becomes a formality.",
    bg: '#F8FAFF',
    textColor: '#0F172A',
    labelColor: '#1A56E8',

    Visual: Slide2Visual,
  },
  {
    id: 3,
    label: 'The shift',
    title: "Make effort visible \u2014 while it\u2019s happening.",
    body: 'Students log tasks and review each other inside Contrib. Teachers get a live Contribution Record for every group.',
    bg: '#FFFFFF',
    textColor: '#0F172A',
    labelColor: '#1A56E8',

    Visual: Slide3Visual,
  },
  {
    id: 4,
    label: 'The result',
    title: 'The grade reflects the work.',
    body: 'The student who carried the group gets recognized. The teacher grades with evidence, not instinct.',
    bg: '#F8FAFF',
    textColor: '#0F172A',
    labelColor: '#1A56E8',

    Visual: Slide4Visual,
  },
  {
    id: 5,
    label: 'Why now. Why Cambodia.',
    title: 'No tool was built for this.',
    body: "Cambodia\u2019s higher education is growing fast \u2014 but fair group assessment hasn\u2019t kept up. Contrib gives universities the tool to do what they always intended.",
    bg: '#F8FAFF',
    textColor: '#0F172A',
    labelColor: '#1A56E8',

    Visual: Slide5Visual,
  },
];

// ─── CTA Slide ────────────────────────────────────────────────────────────────

function CTASlide({ active }: { active: boolean }) {
  return (
    <div
      className="snap-start flex-shrink-0 w-screen min-h-dvh relative flex flex-col items-center justify-center px-6 py-12"
      style={{ background: '#FFFFFF' }}
    >
      <div
        className="text-center max-w-md transition-all duration-700"
        style={{ opacity: active ? 1 : 0, transform: active ? 'translateY(0)' : 'translateY(20px)', transitionDelay: active ? '0.2s' : '0s' }}
      >
        {/* Record mark large */}
        <div className="flex justify-center mb-6">
          <svg width="48" height="48" viewBox="0 0 160 160" fill="none">
            <line x1="58" y1="18" x2="58" y2="142" stroke="#1A56E8" strokeWidth="3" opacity="0.15"/>
            <circle cx="58" cy="128" r="6" fill="#1A56E8" opacity="0.18"/>
            <circle cx="58" cy="100" r="7" fill="#1A56E8" opacity="0.2"/>
            <circle cx="58" cy="46" r="12" fill="#1A56E8"/>
            <line x1="70" y1="46" x2="118" y2="46" stroke="#1A56E8" strokeWidth="3" strokeLinecap="round"/>
            <circle cx="122" cy="46" r="4" fill="#1A56E8"/>
          </svg>
        </div>
        <h2 className="font-extrabold text-[#0F172A] mb-2" style={{ fontSize: 'clamp(28px, 5vw, 42px)', lineHeight: 1.15 }}>
          Your work.<br />On record.
        </h2>
        <p className="text-[16px] text-[#64748B] mb-8">Now in early access.</p>
        <Link
          href="/signup"
          className="inline-flex items-center justify-center h-13 px-8 py-3.5 text-white text-[16px] font-semibold rounded-lg transition-colors bg-[#1A56E8] hover:bg-[#1240C4]"
        >
          Get started — it&apos;s free
        </Link>
        <div className="mt-10 flex items-center gap-4 text-[12px] text-[#94A3B8]">
          <Link href="/privacy" className="hover:text-[#64748B] transition-colors">Privacy</Link>
          <span>|</span>
          <Link href="/terms" className="hover:text-[#64748B] transition-colors">Terms</Link>
          <span>|</span>
          <a href="mailto:support@joincontrib.com" className="hover:text-[#64748B] transition-colors">Contact</a>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Landing() {
  const router = useRouter();
  const [activeSlide, setActiveSlide] = useState(0);
  const [hintVisible, setHintVisible] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const totalSlides = SLIDES.length + 1; // +1 for CTA

  // Auth redirect handled by getServerSideProps below

  // Track active slide via scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const idx = Math.round(el.scrollLeft / el.clientWidth);
      setActiveSlide(idx);
      if (idx > 0) setHintVisible(false);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const goTo = useCallback((idx: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(totalSlides - 1, idx));
    el.scrollTo({ left: clamped * el.clientWidth, behavior: 'smooth' });
  }, [totalSlides]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goTo(activeSlide + 1);
      if (e.key === 'ArrowLeft') goTo(activeSlide - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeSlide, goTo]);

  return (
    <div className="min-h-dvh bg-white overflow-hidden">
      <Head>
        <title>Contrib - Make group contributions visible</title>
        <meta name="description" content="Track individual contributions in group projects. Students log tasks and review each other. Teachers get a live Contribution Record for every group." />
        <meta property="og:title" content="Contrib - Make group contributions visible" />
        <meta property="og:description" content="Track individual contributions in group projects. Students log work, review each other, and teachers grade with evidence." />
        <meta property="og:url" content="https://joincontrib.com" />
        <meta name="twitter:title" content="Contrib - Make group contributions visible" />
        <meta name="twitter:description" content="Track individual contributions in group projects. Students log work, review each other, and teachers grade with evidence." />
        <link rel="canonical" href="https://joincontrib.com" />
      </Head>
      {/* Nav — always visible for branding (Google OAuth verification requires app name on homepage) */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <nav className="h-14 bg-white/95 backdrop-blur-sm border-b border-[#E2E8F0]">
          <div className="max-w-none px-5 h-full flex items-center justify-between">
            <Logo />
            <div className="flex gap-2">
              <Link href="/login" className="h-8 px-3 flex items-center text-sm text-[#6B7280] hover:text-[#111827] font-medium rounded-md transition-colors">
                Log in
              </Link>
              <Link href="/signup" className="h-8 px-3 flex items-center text-sm text-white font-semibold rounded-md transition-colors bg-[#1A56E8] hover:bg-[#1240C4]">
                Sign up free
              </Link>
            </div>
          </div>
        </nav>
      </div>

      {/* Tap zones — mobile edge navigation */}
      <div
        className="fixed top-0 left-0 w-12 h-full z-40 md:hidden"
        onClick={() => goTo(activeSlide - 1)}
        style={{ opacity: activeSlide > 0 ? 1 : 0, pointerEvents: activeSlide > 0 ? 'auto' : 'none' }}
      />
      <div
        className="fixed top-0 right-0 w-12 h-full z-40 md:hidden"
        onClick={() => goTo(activeSlide + 1)}
        style={{ opacity: activeSlide < totalSlides - 1 ? 1 : 0, pointerEvents: activeSlide < totalSlides - 1 ? 'auto' : 'none' }}
      />

      {/* Horizontal scroll container — full viewport */}
      <div
        ref={scrollRef}
        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
        style={{
          height: '100dvh',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Story slides */}
        {SLIDES.map((slide, i) => {
          const isActive = activeSlide === i;
          const { Visual } = slide;
          return (
            <div
              key={slide.id}
              className="snap-start flex-shrink-0 w-screen relative overflow-hidden"
              style={{ background: slide.bg }}
            >
              {/* Slide content — 2-col desktop, stacked mobile */}
              <div className="relative z-10 h-full flex flex-col md:flex-row md:items-center max-w-6xl mx-auto px-5 md:px-10 lg:px-16 py-4 md:py-10 pb-16 md:pb-4 gap-3 md:gap-16">
                {/* Text col */}
                <div className="md:flex-1 flex flex-col justify-start md:justify-center">
                  <div
                    className="transition-all duration-600 text-[11px] font-bold uppercase tracking-[2.5px] mb-3"
                    style={{
                      color: slide.labelColor,
                      opacity: isActive ? 1 : 0,
                      transform: isActive ? 'translateY(0)' : 'translateY(10px)',
                      transitionDelay: isActive ? '0.15s' : '0s',
                    }}
                  >
                    {slide.label}
                  </div>
                  <h2
                    className="font-extrabold mb-3 md:mb-5 transition-all duration-600"
                    style={{
                      color: slide.textColor,
                      fontSize: 'clamp(32px, 4.5vw, 52px)',
                      lineHeight: 1.1,
                      letterSpacing: '-0.5px',
                      opacity: isActive ? 1 : 0,
                      transform: isActive ? 'translateY(0)' : 'translateY(14px)',
                      transitionDelay: isActive ? '0.25s' : '0s',
                    }}
                  >
                    {slide.title}
                  </h2>
                  <p
                    className="text-[16px] font-medium leading-[1.6] transition-all duration-600 max-w-sm"
                    style={{
                      color: '#64748B',
                      opacity: isActive ? 1 : 0,
                      transform: isActive ? 'translateY(0)' : 'translateY(14px)',
                      transitionDelay: isActive ? '0.35s' : '0s',
                    }}
                  >
                    {slide.body}
                  </p>
                </div>

                {/* Visual col */}
                <div
                  className="flex-1 md:flex-[1.2] flex items-center justify-center transition-all duration-600 overflow-visible"
                  style={{
                    opacity: isActive ? 1 : 0,
                    transform: isActive ? 'translateX(0)' : 'translateX(20px)',
                    transitionDelay: isActive ? '0.1s' : '0s',
                  }}
                >
                  <Visual active={isActive} />
                </div>
              {/* Next slide arrow */}
              </div>
            </div>
          );
        })}

        {/* CTA slide */}
        <CTASlide active={activeSlide === SLIDES.length} />
      </div>

      {/* Navigation chrome */}
      <div className="fixed bottom-6 left-0 right-0 z-50 flex flex-col items-center gap-3 pointer-events-none">
        {/* Swipe hint — first slide only */}
        {hintVisible && activeSlide === 0 && (
          <div className="pointer-events-none flex items-center gap-1.5 text-[12px] text-[#94A3B8] animate-pulse">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 7h8M8 4l3 3-3 3" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Swipe or use arrow keys
          </div>
        )}

        {/* Progress dots + counter */}
        <div className="flex items-center gap-3 pointer-events-auto">
          {/* Left arrow */}
          <button
            onClick={() => goTo(activeSlide - 1)}
            disabled={activeSlide === 0}
            className="hidden md:flex w-8 h-8 rounded-full items-center justify-center border border-[rgba(0,0,0,0.1)] transition-all disabled:opacity-20"
            style={{ background: activeSlide === 0 ? 'transparent' : 'rgba(0,0,0,0.06)' }}
            aria-label="Previous slide"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M7.5 2.5L4 6l3.5 3.5" stroke="#0F172A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {/* Dots */}
          <div className="flex items-center gap-2">
            {Array.from({ length: totalSlides }).map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === activeSlide ? 20 : 6,
                  height: 6,
                  background: i === activeSlide ? '#1A56E8' : 'rgba(0,0,0,0.15)',
                }}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>

          {/* Right arrow */}
          <button
            onClick={() => goTo(activeSlide + 1)}
            disabled={activeSlide === totalSlides - 1}
            className="hidden md:flex w-8 h-8 rounded-full items-center justify-center border border-[rgba(0,0,0,0.1)] transition-all disabled:opacity-20"
            style={{ background: activeSlide < totalSlides - 1 ? 'rgba(0,0,0,0.06)' : 'transparent' }}
            aria-label="Next slide"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M4.5 2.5L8 6l-3.5 3.5" stroke="#0F172A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* Slide counter */}
        <div className="text-[11px] font-medium tabular-nums text-[#94A3B8]">
          {activeSlide + 1} / {totalSlides}
        </div>
      </div>

      {/* Footer — always in DOM for search engines and Google OAuth verification */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between px-5 py-1.5 text-[11px] text-[#94A3B8]">
        <span>&copy; {new Date().getFullYear()} Contrib</span>
        <div className="flex items-center gap-3">
          <Link href="/privacy" className="hover:text-[#64748B] transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-[#64748B] transition-colors">Terms of Service</Link>
        </div>
      </footer>
    </div>
  );
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const supabase = createServerClient(ctx);
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', session.user.id).single();
    if (profile) {
      return {
        redirect: {
          destination: profile.role === 'teacher' ? '/teacher' : '/dashboard',
          permanent: false,
        },
      };
    }
  }
  return { props: {} };
}
