import * as Sentry from '@sentry/nextjs';
import type { NextPageContext } from 'next';
import Head from 'next/head';

function ErrorPage({ statusCode }: { statusCode: number }) {
  const is404 = statusCode === 404;
  const title = is404 ? 'Page not found' : 'Something went wrong';
  const message = is404
    ? 'The page you are looking for does not exist or has been moved.'
    : 'An unexpected error occurred. Please try again.';

  return (
    <>
      <Head>
        <title>{title} - Contrib</title>
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
          <div
            style={{
              width: 56,
              height: 56,
              margin: '0 auto 20px',
              borderRadius: '50%',
              backgroundColor: is404 ? '#EBF0FF' : '#FEE2E2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {is404 ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1A56E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            )}
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', margin: '0 0 8px' }}>
            {title}
          </h1>
          <p style={{ fontSize: 14, color: '#64748B', margin: '0 0 24px', lineHeight: 1.5 }}>
            {message}
          </p>
          {is404 ? (
            <a
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
            </a>
          ) : (
            <button
              onClick={() => window.location.reload()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '10px 20px',
                borderRadius: 8,
                backgroundColor: '#1A56E8',
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </>
  );
}

ErrorPage.getInitialProps = async (ctx: NextPageContext) => {
  await Sentry.captureUnderscoreErrorException(ctx);
  const statusCode = ctx.res ? ctx.res.statusCode : ctx.err ? ctx.err.statusCode : 404;
  return { statusCode: statusCode ?? 500 };
};

export default ErrorPage;
