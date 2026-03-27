import { useRef } from 'react';
import { IconClose } from '@/components/icons';
import { useFocusTrap } from '@/hooks/use-focus-trap';

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, onCancel);

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div ref={modalRef} className="w-full max-w-[400px] bg-white rounded-xl p-5" role="dialog" aria-labelledby="confirm-modal-title">
        <div className="flex items-start justify-between mb-3">
          <h3 id="confirm-modal-title" className="text-[15px] font-semibold text-text">{title}</h3>
          <button onClick={onCancel} aria-label="Close dialog" className="text-text-tertiary hover:text-text-secondary ml-2 p-0.5">
            <IconClose size={15} />
          </button>
        </div>
        <p className="text-sm text-text-secondary mb-5 leading-relaxed">{message}</p>
        <div className="flex gap-2 justify-end">
          {cancelLabel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-text-secondary border border-border rounded-md hover:bg-bg-hover transition-colors"
            >
              {cancelLabel}
            </button>
          )}
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors ${
              destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-brand hover:bg-brand-hover'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
