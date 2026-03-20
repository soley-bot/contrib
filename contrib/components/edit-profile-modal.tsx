import { useState } from 'react';
import { useRouter } from 'next/router';
import { IconClose } from '@/components/icons';
import { useProfile } from '@/hooks/use-profile';
import RoleToggle from '@/components/role-toggle';
import type { Profile, UserRole } from '@/types';

interface EditProfileModalProps {
  profile: Profile;
  onSaved: () => void;
  onClose: () => void;
}

export default function EditProfileModal({ profile, onSaved, onClose }: EditProfileModalProps) {
  const router = useRouter();
  const [name, setName] = useState(profile.name ?? '');
  const [university, setUniversity] = useState(profile.university ?? '');
  const [role, setRole] = useState<UserRole>(profile.role ?? 'student');
  const [error, setError] = useState('');
  const { updateProfile, saving } = useProfile();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required.'); return; }
    const err = await updateProfile(profile.id, name, university, role);
    if (err) { setError(err); return; }
    onSaved();
    onClose();
    if (role !== profile.role) {
      router.push(role === 'teacher' ? '/teacher' : '/dashboard');
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/40 flex items-end md:items-center md:justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full md:max-w-[400px] bg-white rounded-t-[20px] md:rounded-[10px]">
        <div className="w-10 h-1 rounded-full bg-[#D6D3D1] mx-auto mt-2.5 md:hidden" />
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E7E5E4]">
          <h2 className="text-base font-semibold text-[#1C1917]">Edit Profile</h2>
          <button onClick={onClose} className="text-[#57534E] hover:text-[#1C1917] p-1">
            <IconClose size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-3.5">
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-[#57534E]">Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full border border-[#E7E5E4] rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-[#57534E]">University</label>
            <input type="text" value={university} onChange={(e) => setUniversity(e.target.value)}
              className="w-full border border-[#E7E5E4] rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none" />
          </div>
          <RoleToggle value={role} onChange={setRole} />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="pt-1 border-t border-[#E7E5E4] flex gap-2">
            <button type="button" onClick={onClose}
              className="flex-1 h-11 border border-[#E7E5E4] text-[#57534E] text-sm font-medium rounded-md hover:bg-[#F5F5F4] transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 h-11 bg-brand hover:bg-brand-hover text-white text-sm font-medium rounded-md transition-colors disabled:opacity-60">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
