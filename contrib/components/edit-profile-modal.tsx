import { useState, useRef } from 'react';
import { IconClose } from '@/components/icons';
import { useProfile } from '@/hooks/use-profile';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import type { Profile } from '@/types';

interface EditProfileModalProps {
  profile: Profile;
  onSaved: () => void;
  onClose: () => void;
}

export default function EditProfileModal({ profile, onSaved, onClose }: EditProfileModalProps) {
  const [name, setName] = useState(profile.name ?? '');
  const [university, setUniversity] = useState(profile.university ?? '');
  const [faculty, setFaculty] = useState(profile.faculty ?? '');
  const [yearOfStudy, setYearOfStudy] = useState(profile.year_of_study ?? '');
  const [error, setError] = useState('');
  const { updateProfile, saving } = useProfile();
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, onClose);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required.'); return; }
    const err = await updateProfile(profile.id, name, university, profile.role, faculty, yearOfStudy);
    if (err) { setError(err); return; }
    onSaved();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/40 flex items-end md:items-center md:justify-center"
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}
    >
      <div ref={modalRef} role="dialog" aria-modal="true" aria-label="Edit profile" className="w-full md:max-w-[400px] bg-white rounded-t-2xl md:rounded-xl">
        <div className="w-10 h-1 rounded-full bg-[#CBD5E1] mx-auto mt-2.5 md:hidden" />
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-text">Edit Profile</h2>
          <button onClick={onClose} aria-label="Close" className="text-text-secondary hover:text-text p-1">
            <IconClose size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-3.5">
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-profile-name" className="text-[13px] font-medium text-text-secondary">Name</label>
            <input id="edit-profile-name" type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-profile-university" className="text-[13px] font-medium text-text-secondary">University</label>
            <input id="edit-profile-university" type="text" value={university} onChange={(e) => setUniversity(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-profile-faculty" className="text-[13px] font-medium text-text-secondary">Faculty <span className="font-normal text-text-tertiary">(optional)</span></label>
            <input id="edit-profile-faculty" type="text" value={faculty} onChange={(e) => setFaculty(e.target.value)} placeholder="e.g. Business"
              className="w-full border border-border rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-profile-year" className="text-[13px] font-medium text-text-secondary">Year of study <span className="font-normal text-text-tertiary">(optional)</span></label>
            <select id="edit-profile-year" value={yearOfStudy} onChange={(e) => setYearOfStudy(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2.5 text-[15px] focus:border-brand outline-none bg-white">
              <option value="">Select year…</option>
              <option value="Year 1">Year 1</option>
              <option value="Year 2">Year 2</option>
              <option value="Year 3">Year 3</option>
              <option value="Year 4">Year 4</option>
              <option value="Year 5 or above">Year 5 or above</option>
            </select>
          </div>
          {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
          <div className="pt-1 border-t border-border flex gap-2">
            <button type="button" onClick={onClose}
              className="flex-1 h-11 border border-border text-text-secondary text-sm font-medium rounded-md hover:bg-bg-hover transition-colors">
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
