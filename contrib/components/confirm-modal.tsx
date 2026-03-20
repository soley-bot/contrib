import { IconClose } from '@/components/icons';

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
  return (
    <div
      className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="w-full max-w-[400px] bg-white rounded-[12px] p-5">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-[15px] font-semibold text-[#1C1917]">{title}</h3>
          <button onClick={onCancel} className="text-[#A8A29E] hover:text-[#57534E] ml-2 p-0.5">
            <IconClose size={15} />
          </button>
        </div>
        <p className="text-sm text-[#57534E] mb-5 leading-relaxed">{message}</p>
        <div className="flex gap-2 justify-end">
          {cancelLabel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-[#57534E] border border-[#E7E5E4] rounded-md hover:bg-[#F5F5F4] transition-colors"
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
