import Head from 'next/head';
import Link from 'next/link';

export default function NotFoundPage() {
  return (
    <>
      <Head>
        <title>Page not found - Contrib</title>
      </Head>
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F8FAFF',
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          padding: '0 24px',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <div style={{ margin: '0 auto 24px', width: 80, height: 80 }}>
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="34" cy="34" r="22" stroke="#E2E8F0" strokeWidth="4" fill="none" />
              <circle cx="34" cy="34" r="14" stroke="#E2E8F0" strokeWidth="2" fill="none" strokeDasharray="4 4" />
              <line x1="50.5" y1="50.5" x2="68" y2="68" stroke="#1A56E8" strokeWidth="4" strokeLinecap="round" />
              <line x1="30" y1="30" x2="38" y2="38" stroke="#E2E8F0" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="38" y1="30" x2="30" y2="38" stroke="#E2E8F0" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0F172A', margin: '0 0 8px' }}>
            Page not found
          </h1>
          <p style={{ fontSize: 14, color: '#64748B', margin: '0 0 24px', lineHeight: 1.5 }}>
            The page you are looking for does not exist or has been moved.
          </p>
          <Link
            href="/dashboard"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '10px 20px',
              borderRadius: 8,
              backgroundColor: '#1A56E8',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </>
  );
}
