import NavShell from '@/components/nav-shell';
import type { Profile, Group } from '@/types';

interface TeacherNavProps {
  profile: Profile | null;
  group?: Group | null;
  title?: string;
  backLabel?: string;
  onBack?: () => void;
  onTabChange?: (tab: string) => void;
  activeTab?: string;
  onProfileUpdate?: () => void;
}

export default function TeacherNav(props: TeacherNavProps) {
  return (
    <NavShell
      {...props}
      homeRoute="/teacher"
      sectionLabel="My Courses"
      defaultBackLabel="Courses"
    />
  );
}
