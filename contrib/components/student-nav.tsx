import NavShell from '@/components/nav-shell';
import type { Profile, Group } from '@/types';

interface TabBadges {
  tasks?: number;
  activity?: boolean;
  evaluation?: boolean;
}

interface StudentNavProps {
  profile: Profile | null;
  group?: Group | null;
  title?: string;
  backLabel?: string;
  onBack?: () => void;
  onTabChange?: (tab: string) => void;
  activeTab?: string;
  onProfileUpdate?: () => void;
  tabBadges?: TabBadges;
}

export default function StudentNav(props: StudentNavProps) {
  return (
    <NavShell
      {...props}
      homeRoute="/dashboard"
      sectionLabel="My Groups"
      defaultBackLabel="Groups"
    />
  );
}
