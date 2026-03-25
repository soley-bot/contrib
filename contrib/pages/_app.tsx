import "@/styles/globals.css";
import type { AppProps } from "next/app";
import * as Sentry from "@sentry/nextjs";
import ToastProvider from "@/components/toast-provider";

function App({ Component, pageProps }: AppProps) {
  return (
    <ToastProvider>
      <Component {...pageProps} />
    </ToastProvider>
  );
}

export default Sentry.withErrorBoundary(App, {
  fallback: ({ error }) => (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '48px', fontWeight: 800, color: '#0F172A', margin: 0 }}>Oops</h1>
        <p style={{ fontSize: '16px', color: '#64748B', marginTop: '8px' }}>Something went wrong.</p>
        <a href="/" style={{ color: '#1A56E8', fontSize: '14px', fontWeight: 600, textDecoration: 'none', marginTop: '16px', display: 'inline-block' }}>
          Go home
        </a>
      </div>
    </div>
  ),
});
