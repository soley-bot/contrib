import Head from 'next/head';
import Link from 'next/link';

export default function Privacy() {
  return (
    <>
      <Head>
        <title>Privacy Policy - Contrib</title>
        <meta name="description" content="Contrib privacy policy. Learn how we collect, use, and protect your data." />
      </Head>
      <div className="min-h-dvh bg-[#F8FAFF]">
        <div className="max-w-2xl mx-auto px-5 pt-8 pb-20">
          <div className="flex items-center gap-2 mb-8">
            <Link href="/" className="flex items-center gap-2">
              <svg width="28" height="28" viewBox="0 0 160 160" fill="none" className="flex-shrink-0">
                <line x1="58" y1="18" x2="58" y2="142" stroke="#1A56E8" strokeWidth="3" opacity="0.15"/>
                <circle cx="58" cy="128" r="6" fill="#1A56E8" opacity="0.18"/>
                <circle cx="58" cy="100" r="7" fill="#1A56E8" opacity="0.2"/>
                <circle cx="58" cy="46" r="12" fill="#1A56E8"/>
                <line x1="70" y1="46" x2="118" y2="46" stroke="#1A56E8" strokeWidth="3" strokeLinecap="round"/>
                <circle cx="122" cy="46" r="4" fill="#1A56E8"/>
              </svg>
              <span className="text-xl font-extrabold text-[#1A56E8]">Contrib</span>
            </Link>
          </div>

          <h1 className="text-[28px] font-bold text-[#0F172A] mb-2">Privacy Policy</h1>
          <p className="text-sm text-[#64748B] mb-8">Last updated: March 26, 2025</p>

          <div className="prose-sm text-[#334155] flex flex-col gap-6">
            <section>
              <h2 className="text-lg font-semibold text-[#0F172A] mb-2">1. Who we are</h2>
              <p className="leading-relaxed">
                Contrib (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is a group contribution tracking platform for university students and teachers.
                This policy explains how we collect, use, and protect your information when you use our service at joincontrib.com.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#0F172A] mb-2">2. Information we collect</h2>
              <p className="leading-relaxed mb-2">We collect the following information when you use Contrib:</p>
              <ul className="list-disc pl-5 flex flex-col gap-1.5">
                <li><strong>Account information:</strong> name, email address, university name, and role (student or teacher) provided during signup or Google sign-in.</li>
                <li><strong>Content you create:</strong> tasks, evidence files (images, documents), peer review scores, group information, and course details.</li>
                <li><strong>Usage data:</strong> pages visited, features used, and error logs to improve the service.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#0F172A] mb-2">3. How we use your information</h2>
              <ul className="list-disc pl-5 flex flex-col gap-1.5">
                <li>To provide and operate the Contrib platform.</li>
                <li>To display contribution records to group members and teachers.</li>
                <li>To generate Contribution Record exports (PDF reports).</li>
                <li>To send essential service communications (account verification, security alerts).</li>
                <li>To improve the platform and fix issues.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#0F172A] mb-2">4. How we share your information</h2>
              <p className="leading-relaxed mb-2">We do not sell your personal information. We share data only in these cases:</p>
              <ul className="list-disc pl-5 flex flex-col gap-1.5">
                <li><strong>Within your groups and courses:</strong> group members and course teachers can see your tasks, evidence, and peer review averages (individual scores remain anonymous).</li>
                <li><strong>Service providers:</strong> we use Supabase (database and authentication), Vercel (hosting), and Sentry (error monitoring) to operate the platform.</li>
                <li><strong>Legal requirements:</strong> if required by law or to protect our rights.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#0F172A] mb-2">5. Data storage and security</h2>
              <p className="leading-relaxed">
                Your data is stored securely using Supabase with row-level security policies.
                We use HTTPS encryption for all data in transit.
                Authentication is handled through secure OAuth 2.0 (Google) or email/password with PKCE verification.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#0F172A] mb-2">6. Your rights</h2>
              <p className="leading-relaxed mb-2">You can:</p>
              <ul className="list-disc pl-5 flex flex-col gap-1.5">
                <li>Access and update your profile information at any time.</li>
                <li>Request a copy of your data by contacting us.</li>
                <li>Request deletion of your account and associated data.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#0F172A] mb-2">7. Cookies</h2>
              <p className="leading-relaxed">
                We use essential cookies only — for authentication and session management.
                We do not use advertising or tracking cookies.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#0F172A] mb-2">8. Changes to this policy</h2>
              <p className="leading-relaxed">
                We may update this policy from time to time. We will notify you of significant changes by posting a notice on the platform.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#0F172A] mb-2">9. Contact</h2>
              <p className="leading-relaxed">
                If you have questions about this policy, contact us at <a href="mailto:support@joincontrib.com" className="text-[#1A56E8] font-medium">support@joincontrib.com</a>.
              </p>
            </section>
          </div>

          <div className="mt-10 pt-6 border-t border-[#E2E8F0]">
            <Link href="/" className="text-sm text-[#1A56E8] font-medium">Back to home</Link>
          </div>
        </div>
      </div>
    </>
  );
}
