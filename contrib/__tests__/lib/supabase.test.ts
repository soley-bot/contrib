import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('supabase client', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('throws when env vars are missing', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    const { supabase } = await import('@/lib/supabase');
    expect(() => supabase.auth).toThrow('Supabase env vars are not set');
  });

  it('initializes without error when env vars are set', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY', 'test-anon-key');
    const { supabase } = await import('@/lib/supabase');
    expect(() => supabase.auth).not.toThrow();
  });
});
