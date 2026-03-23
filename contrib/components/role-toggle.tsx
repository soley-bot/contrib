import type { UserRole } from '@/types';

interface RoleToggleProps {
  value: UserRole;
  onChange: (role: UserRole) => void;
}

export default function RoleToggle({ value, onChange }: RoleToggleProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[13px] font-medium text-[#475569]">I am a</label>
      <div className="flex rounded-md border border-[#E2E8F0] overflow-hidden bg-white">
        {(['student', 'teacher'] as UserRole[]).map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => onChange(role)}
            className={`flex-1 py-2.5 text-[14px] font-medium transition-colors capitalize ${
              value === role
                ? 'bg-brand text-white'
                : 'text-[#475569] hover:bg-[#F1F5F9]'
            }`}
          >
            {role === 'student' ? 'Student' : 'Teacher'}
          </button>
        ))}
      </div>
    </div>
  );
}
