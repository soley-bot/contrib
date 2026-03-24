import * as Sentry from '@sentry/nextjs';
import type { NextPageContext } from 'next';

function ErrorPage({ statusCode }: { statusCode: number }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '48px', fontWeight: 800, color: '#0F172A', margin: 0 }}>{statusCode}</h1>
        <p style={{ fontSize: '16px', color: '#64748B', marginTop: '8px' }}>
          {statusCode === 404 ? 'Page not found.' : 'Something went wrong.'}
        </p>
        <a href="/" style={{ color: '#1A56E8', fontSize: '14px', fontWeight: 600, textDecoration: 'none', marginTop: '16px', display: 'inline-block' }}>
          Go home
        </a>
      </div>
    </div>
  );
}

ErrorPage.getInitialProps = async (ctx: NextPageContext) => {
  await Sentry.captureUnderscoreErrorException(ctx);
  const statusCode = ctx.res ? ctx.res.statusCode : ctx.err ? ctx.err.statusCode : 404;
  return { statusCode: statusCode ?? 500 };
};

export default ErrorPage;
