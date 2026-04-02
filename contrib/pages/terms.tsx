import Head from 'next/head';
import Link from 'next/link';

export default function TermsOfService() {
  return (
    <>
      <Head>
        <title>Terms of Service — Contrib</title>
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
            Terms of Service
          </h1>
          <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '40px' }}>
            Last updated: April 2026
          </p>

          <Section title="Using Contrib">
            <p>Contrib is a group project contribution tracker for students and teachers. By creating an account, you agree to these terms.</p>
            <ul>
              <li>Contrib is <strong>free for students</strong> -- no hidden fees, no trial periods.</li>
              <li>You must be <strong>at least 13 years old</strong> to use Contrib.</li>
              <li>You are responsible for keeping your account credentials secure.</li>
            </ul>
          </Section>

          <Section title="Your content">
            <p>You own everything you create on Contrib -- your tasks, evidence, comments, and peer reviews. We do not claim ownership of your content.</p>
            <p>By using Contrib, you grant us a limited license to display your content to your group members and teacher as part of the platform&#39;s functionality. This includes showing your contributions in group views, Contribution Records, and shareable report links you create.</p>
          </Section>

          <Section title="Acceptable use">
            <p>When using Contrib, you agree not to:</p>
            <ul>
              <li>Impersonate another person or create accounts on behalf of others without their consent</li>
              <li>Submit false or misleading contributions to misrepresent your work</li>
              <li>Harass, bully, or abuse other users through comments or peer reviews</li>
              <li>Attempt to access other users&#39; data or interfere with the platform&#39;s operation</li>
              <li>Use Contrib for anything illegal</li>
            </ul>
          </Section>

          <Section title="Account termination">
            <p>You can stop using Contrib at any time. To delete your account, contact us at{' '}
              <a href="mailto:support@joincontrib.com" style={{ color: '#1A56E8', textDecoration: 'none' }}>
                support@joincontrib.com
              </a>.
            </p>
            <p>We may suspend or terminate accounts that violate these terms, particularly in cases of abuse or impersonation.</p>
          </Section>

          <Section title="Disclaimer">
            <p>Contrib is provided &quot;as is&quot; without warranties of any kind. While we work hard to keep the platform reliable, we cannot guarantee uninterrupted access or that the service will be error-free.</p>
            <p>Contrib is a tool for tracking contributions -- it does not determine grades. Grading decisions remain with your teacher or institution.</p>
          </Section>

          <Section title="Limitation of liability">
            <p>To the extent permitted by law, Contrib and its team are not liable for any indirect, incidental, or consequential damages arising from your use of the platform.</p>
          </Section>

          <Section title="Changes to these terms">
            <p>We may update these terms from time to time. If we make significant changes, we will update the date at the top of this page. Continued use of Contrib after changes means you accept the updated terms.</p>
          </Section>

          <Section title="Contact">
            <p>Questions about these terms? Reach us at{' '}
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
