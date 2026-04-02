import Head from 'next/head';
import Link from 'next/link';

export default function PrivacyPolicy() {
  return (
    <>
      <Head>
        <title>Privacy Policy — Contrib</title>
      </Head>
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#F8FAFF',
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          color: '#0F172A',
          padding: '80px 24px 60px',
        }}
      >
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              color: '#64748B',
              textDecoration: 'none',
              marginBottom: '32px',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 3L5 7l4 4" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back to Contrib
          </Link>

          <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px' }}>
            Privacy Policy
          </h1>
          <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '40px' }}>
            Last updated: April 2026
          </p>

          <Section title="What we collect">
            <p>When you create a Contrib account, we collect:</p>
            <ul>
              <li>Your name, email address, and password (or OAuth provider identity)</li>
              <li>University, faculty, and year of study</li>
              <li>Your role (student or teacher)</li>
            </ul>
            <p>As you use Contrib, we also collect:</p>
            <ul>
              <li>Tasks you create, evidence you upload, comments you write, and peer reviews you submit</li>
              <li>Group membership and activity logs</li>
              <li>Your Telegram chat ID if you connect Telegram for notifications</li>
            </ul>
          </Section>

          <Section title="How we use it">
            <p>We use your data to:</p>
            <ul>
              <li>Run the Contrib platform -- displaying tasks, contributions, and peer reviews to your group and teacher</li>
              <li>Send you notifications (in-app and via Telegram if connected)</li>
              <li>Generate your Contribution Record (the PDF export and shareable report link)</li>
              <li>Monitor for errors and improve the product</li>
            </ul>
            <p>We do not use your data for advertising or profiling.</p>
          </Section>

          <Section title="Third-party services">
            <p>Contrib relies on the following services to operate:</p>
            <ul>
              <li><strong>Supabase</strong> -- authentication, database, and file storage. Your data is stored in Supabase-managed infrastructure.</li>
              <li><strong>Vercel</strong> -- hosting and serving the application.</li>
              <li><strong>Sentry</strong> -- error tracking. When something breaks, Sentry receives technical error details (not your personal content).</li>
              <li><strong>Telegram</strong> -- optional notification delivery. Only your Telegram chat ID is stored if you choose to connect.</li>
            </ul>
            <p>Each service has its own privacy policy. We recommend reviewing them if you want the full picture.</p>
          </Section>

          <Section title="Data sharing">
            <p>We do not sell, rent, or trade your personal data. Period.</p>
            <p>Your group activity (tasks, evidence, peer reviews) is visible to members of your group and your teacher. Shareable report links are only generated when you explicitly create one.</p>
          </Section>

          <Section title="Your rights">
            <p>You can:</p>
            <ul>
              <li><strong>Export your data</strong> -- use the Contribution Record export to download a PDF of your group contributions</li>
              <li><strong>Delete your account</strong> -- contact us at support@joincontrib.com and we will delete your account and associated data</li>
              <li><strong>Disconnect Telegram</strong> -- remove your Telegram connection at any time from your profile page</li>
            </ul>
            <p>If you are in the EU or another jurisdiction with specific data rights, we will honor your requests under applicable law.</p>
          </Section>

          <Section title="Cookies">
            <p>Contrib uses essential cookies for authentication (keeping you logged in). We do not use tracking cookies or third-party analytics cookies.</p>
          </Section>

          <Section title="Children">
            <p>Contrib is intended for users aged 13 and older. We do not knowingly collect data from children under 13.</p>
          </Section>

          <Section title="Changes to this policy">
            <p>If we make significant changes to this policy, we will update the date at the top of this page. For major changes, we may notify you via the app.</p>
          </Section>

          <Section title="Contact">
            <p>Questions about your privacy? Reach us at{' '}
              <a href="mailto:support@joincontrib.com" style={{ color: '#1A56E8', textDecoration: 'none' }}>
                support@joincontrib.com
              </a>.
            </p>
          </Section>
        </div>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '32px' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px', color: '#0F172A' }}>
        {title}
      </h2>
      <div
        style={{
          fontSize: '15px',
          lineHeight: '1.7',
          color: '#334155',
        }}
      >
        {children}
      </div>
    </div>
  );
}
