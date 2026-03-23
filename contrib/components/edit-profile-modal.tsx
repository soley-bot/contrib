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
  const [faculty, setFaculty] = useState(profile.faculty ?? '');
  const [yearOfStudy, setYearOfStudy] = useState(profile.year_of_study ?? '');
  const [role, setRole] = useState<UserRole>(profile.role ?? 'student');
  const [error, setError] = useState('');
  const { updateProfile, saving } = useProfile();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required.'); return; }
    const err = await updateProfile(profile.id, name, university, role, faculty, yearOfStudy);
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
      <div className="w-full md:max-w-[400px] bg-white rounded-t-2xl md:rounded-xl">
        <div className="w-10 h-1 rounded-full bg-[#CBD5E1] mx-auto mt-2.5 md:hidden" />
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <h2 className="text-base font-semibold text-[#0F172A]">Edit Profile</h2>
          <button onClick={onClose} className="text-[#475569] hover:text-[#0F172A] p-1">
            <IconClose size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-3.5">
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-[#475569]">Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full border border-[#E2E8F0] rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-[#475569]">University</label>
            <input type="text" value={university} onChange={(e) => setUniversity(e.target.value)}
              className="w-full border border-[#E2E8F0] rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-[#475569]">Faculty <span className="font-normal text-[#94A3B8]">(optional)</span></label>
            <input type="text" value={faculty} onChange={(e) => setFaculty(e.target.value)} placeholder="e.g. Business"
              className="w-full border border-[#E2E8F0] rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-[#475569]">Year of study <span className="font-normal text-[#94A3B8]">(optional)</span></label>
            <select value={yearOfStudy} onChange={(e) => setYearOfStudy(e.target.value)}
              className="w-full border border-[#E2E8F0] rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none bg-white">
              <option value="">Select year…</option>
              <option value="Year 1">Year 1</option>
              <option value="Year 2">Year 2</option>
              <option value="Year 3">Year 3</option>
              <option value="Year 4">Year 4</option>
              <option value="Year 5+">Year 5+</option>
            </select>
          </div>
          <RoleToggle value={role} onChange={setRole} />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="pt-1 border-t border-[#E2E8F0] flex gap-2">
            <button type="button" onClick={onClose}
              className="flex-1 h-11 border border-[#E2E8F0] text-[#475569] text-sm font-medium rounded-md hover:bg-[#F1F5F9] transition-colors">
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
