import type { SWRConfiguration } from 'swr';

/**
 * Base SWR defaults applied via <SWRConfig value={swrDefaults}> in _app.tsx.
 * ProfileProvider (Task 3) and the Task 4 data hooks inherit these settings automatically.
 */
export const swrDefaults: SWRConfiguration = {
  revalidateOnFocus: false,
  dedupingInterval: 30_000,
  shouldRetryOnError: false,
};
