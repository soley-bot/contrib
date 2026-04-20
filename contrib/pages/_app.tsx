import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { SWRConfig } from "swr";
import ToastProvider from "@/components/toast-provider";
import ErrorBoundary from "@/components/error-boundary";
import { ProfileProvider } from "@/components/profile-provider";
import { swrDefaults } from "@/lib/swr-config";

function App({ Component, pageProps }: AppProps) {
  return (
    <ErrorBoundary>
      <SWRConfig value={swrDefaults}>
        <ProfileProvider>
          <ToastProvider>
            <Component {...pageProps} />
          </ToastProvider>
        </ProfileProvider>
      </SWRConfig>
    </ErrorBoundary>
  );
}

export default App;
