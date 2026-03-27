import { useEffect } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useFocusTrap(
  ref: React.RefObject<HTMLElement | null>,
  onClose: () => void
): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Store the previously focused element so we can restore it on unmount
    const previouslyFocused = document.activeElement as HTMLElement | null;

    function getFocusableElements(): HTMLElement[] {
      return Array.from(el!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    }

    // Focus the first focusable element inside the container
    const focusables = getFocusableElements();
    if (focusables.length > 0) {
      requestAnimationFrame(() => {
        focusables[0]?.focus();
      });
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;

      const currentFocusables = getFocusableElements();
      if (currentFocusables.length === 0) {
        e.preventDefault();
        return;
      }

      const first = currentFocusables[0];
      const last = currentFocusables[currentFocusables.length - 1];

      if (e.shiftKey) {
        // Shift+Tab: wrap from first to last
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab: wrap from last to first
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [ref, onClose]);
}
