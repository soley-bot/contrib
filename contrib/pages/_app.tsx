import "@/styles/globals.css";
import type { AppProps } from "next/app";
import ToastProvider from "@/components/toast-provider";
import ErrorBoundary from "@/components/error-boundary";

function App({ Component, pageProps }: AppProps) {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <Component {...pageProps} />
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
