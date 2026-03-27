import Head from 'next/head';
import Link from 'next/link';

export default function Terms() {
  return (
    <>
      <Head>
        <title>Terms of Service - Contrib</title>
        <meta name="description" content="Contrib terms of service. Rules and guidelines for using our platform." />
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

          <h1 className="text-[28px] font-bold text-[#0F172A] mb-2">Terms of Service</h1>
          <p className="text-sm text-[#64748B] mb-8">Last updated: March 26, 2025</p>

          <div className="prose-sm text-[#334155] flex flex-col gap-6">
            <section>
              <h2 className="text-lg font-semibold text-[#0F172A] mb-2">1. Acceptance of terms</h2>
              <p className="leading-relaxed">
                By creating an account or using Contrib at joincontrib.com, you agree to these terms.
                If you do not agree, do not use the service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#0F172A] mb-2">2. What Contrib is</h2>
              <p className="leading-relaxed">
                Contrib is a group contribution tracking platform for university students and teachers.
                Students log tasks, upload evidence, and review each other.
                Teachers monitor group progress and export Contribution Records.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#0F172A] mb-2">3. Accounts</h2>
              <ul className="list-disc pl-5 flex flex-col gap-1.5">
                <li>You must provide accurate information when creating an account.</li>
                <li>You are responsible for keeping your login credentials secure.</li>
                <li>You must be a university student or teacher to use the platform.</li>
                <li>One person per account. Do not share accounts.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#0F172A] mb-2">4. Acceptable use</h2>
              <p className="leading-relaxed mb-2">You agree not to:</p>
              <ul className="list-disc pl-5 flex flex-col gap-1.5">
                <li>Upload false or misleading evidence of contribution.</li>
                <li>Manipulate peer review scores dishonestly.</li>
                <li>Upload harmful, offensive, or illegal content.</li>
                <li>Attempt to access other users&apos; accounts or data.</li>
                <li>Use automated tools to access the service without permission.</li>
                <li>Interfere with the platform&apos;s operation.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#0F172A] mb-2">5. Your content</h2>
              <p className="leading-relaxed">
                You retain ownership of the content you upload (tasks, evidence, reviews).
                By uploading content, you grant Contrib a license to store, display, and include it in Contribution Records
                visible to your group members and course teachers.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#0F172A] mb-2">6. Evidence integrity</h2>
              <p className="leading-relaxed">
                Evidence uploaded to Contrib is immutable — it cannot be edited or deleted, only versioned.
                This is by design to maintain the integrity of the contribution record.
                Tasks use soft deletion and can be archived but not permanently removed.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#0F172A] mb-2">7. Teacher access</h2>
              <p className="leading-relaxed">
                Teachers who create courses can view all groups enrolled in their course, including tasks, evidence,
                and anonymized peer review summaries. Teachers can export Contribution Records for grading purposes.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#0F172A] mb-2">8. Service availability</h2>
              <p className="leading-relaxed">
                Contrib is provided &quot;as is&quot;. We aim for high availability but do not guarantee uninterrupted access.
                We may update, modify, or discontinue features with reasonable notice.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#0F172A] mb-2">9. Pricing</h2>
              <p className="leading-relaxed">
                Contrib is free for students. Teacher and institutional features may be offered as paid plans in the future.
                We will notify you before any pricing changes that affect your account.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#0F172A] mb-2">10. Termination</h2>
              <p className="leading-relaxed">
                We may suspend or terminate accounts that violate these terms.
                You may delete your account at any time by contacting us.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#0F172A] mb-2">11. Changes to these terms</h2>
              <p className="leading-relaxed">
                We may update these terms. Continued use after changes constitutes acceptance.
                We will notify you of significant changes through the platform.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#0F172A] mb-2">12. Contact</h2>
              <p className="leading-relaxed">
                Questions? Reach us at <a href="mailto:support@joincontrib.com" className="text-[#1A56E8] font-medium">support@joincontrib.com</a>.
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
