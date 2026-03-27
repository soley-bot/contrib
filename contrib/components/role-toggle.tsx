import type { UserRole } from '@/types';

interface RoleToggleProps {
  value: UserRole;
  onChange: (role: UserRole) => void;
}

export default function RoleToggle({ value, onChange }: RoleToggleProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[13px] font-medium text-text-secondary">I am a</label>
      <div className="flex rounded-md border border-border overflow-hidden bg-white">
        {(['student', 'teacher'] as UserRole[]).map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => onChange(role)}
            className={`flex-1 py-2.5 text-[14px] font-medium transition-colors capitalize ${
              value === role
                ? 'bg-brand text-white'
                : 'text-text-secondary hover:bg-bg-hover'
            }`}
          >
            {role === 'student' ? 'Student' : 'Teacher'}
          </button>
        ))}
      </div>
    </div>
  );
}
