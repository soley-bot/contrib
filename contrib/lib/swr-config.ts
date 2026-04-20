import type { SWRConfiguration } from 'swr';

export const swrDefaults: SWRConfiguration = {
  revalidateOnFocus: false,
  dedupingInterval: 30_000,
  shouldRetryOnError: false,
};
