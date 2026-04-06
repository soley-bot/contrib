import { useState, useRef } from 'react';
import ConfirmModal from '@/components/confirm-modal';
import { useToast } from '@/components/toast-provider';
import type { Profile } from '@/types';

interface TeacherModeSectionProps {
  profile: Profile;
  locked: boolean;
  lockReason: 'groups' | 'courses' | null;
  onRoleChanged: () => void;
}

export default function TeacherModeSection({
  profile,
  locked,
  lockReason,
  onRoleChanged,
}: TeacherModeSectionProps) {
  const { showToast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submitRef = useRef(false);

  const isTeacher = profile.role === 'teacher';
  const nextRole = isTeacher ? 'student' : 'teacher';

  async function handleConfirm() {
    if (submitRef.current) return;
    submitRef.current = true;
    setSubmitting(true);

    try {
      const res = await fetch('/api/profile/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: nextRole }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast(data.error ?? 'Something went wrong. Please try again.', 'error');
        return;
      }

      if (nextRole === 'teacher') {
        showToast('Teacher mode enabled. Find your teacher dashboard in the menu.', 'success');
      } else {
        showToast('Switched back to student mode.', 'success');
      }

      onRoleChanged();
      setModalOpen(false);
    } finally {
      submitRef.current = false;
      setSubmitting(false);
    }
  }

  function handleCancel() {
    if (submitting) return;
    setModalOpen(false);
  }

  let description: string;
  let buttonLabel: string;
  let title: string;
  let modalTitle: string;
  let modalMessage: string;
  let modalConfirmLabel: string;

  if (!isTeacher) {
    title = 'Teaching a class with Contrib?';
    description =
      'Enable teacher mode to create courses, invite students, and monitor group progress.' +
      (locked && lockReason === 'groups'
        ? " You're currently in one or more groups. Leave all groups to enable teacher mode."
        : '');
    buttonLabel = 'Enable teacher mode';
    modalTitle = 'Enable teacher mode?';
    modalMessage =
      "You'll get access to:\n" +
      '- Create and manage courses\n' +
      '- Invite students to your courses\n' +
      '- Monitor group progress and blockers\n' +
      '- Open peer review for your class\n\n' +
      'You can switch back to student mode anytime - until you create your first course.';
    modalConfirmLabel = 'Enable';
  } else {
    title = 'Teacher mode: ON';
    description = locked
      ? 'You have access to courses and teacher features. Your role is locked because you own one or more courses. Delete all courses to switch back.'
      : 'You have access to courses and teacher features. You can switch back to student mode anytime.';
    buttonLabel = 'Switch back to student';
    modalTitle = 'Switch back to student mode?';
    modalMessage =
      "You'll lose access to teacher features until you enable teacher mode again. Your existing data stays safe.";
    modalConfirmLabel = 'Switch back';
  }

  return (
    <>
      <div className="bg-white border border-border rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-text mb-1">{title}</p>
            <p className="text-sm text-text-secondary leading-relaxed">{description}</p>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            disabled={locked || submitting}
            className={
              isTeacher
                ? 'shrink-0 px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-bg-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
                : 'shrink-0 px-4 py-2 text-sm font-medium bg-brand hover:bg-brand-hover text-white rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
            }
          >
            {buttonLabel}
          </button>
        </div>
      </div>

      {modalOpen && (
        <ConfirmModal
          title={modalTitle}
          message={modalMessage}
          confirmLabel={modalConfirmLabel}
          cancelLabel="Cancel"
          loading={submitting}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </>
  );
}
