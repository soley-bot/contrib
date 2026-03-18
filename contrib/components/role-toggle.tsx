import type { UserRole } from '@/types';

interface RoleToggleProps {
  value: UserRole;
  onChange: (role: UserRole) => void;
}

export default function RoleToggle({ value, onChange }: RoleToggleProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[13px] font-medium text-[#57534E]">I am a</label>
      <div className="flex rounded-md border border-[#E7E5E4] overflow-hidden bg-white">
        {(['student', 'teacher'] as UserRole[]).map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => onChange(role)}
            className={`flex-1 py-2.5 text-[14px] font-medium transition-colors capitalize ${
              value === role
                ? 'bg-[#FF5841] text-white'
                : 'text-[#57534E] hover:bg-[#F5F5F4]'
            }`}
          >
            {role === 'student' ? 'Student' : 'Teacher'}
          </button>
        ))}
      </div>
    </div>
  );
}
