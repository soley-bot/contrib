import type { Profile } from '@/types';
import type { User } from '@supabase/supabase-js';
import { useProfileContext } from '@/components/profile-provider';

export interface UseUserResult {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => void;
}

export function useUser(): UseUserResult {
  return useProfileContext();
}
