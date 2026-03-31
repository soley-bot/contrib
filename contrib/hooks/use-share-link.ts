import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/toast-provider';

interface UseShareLinkResult {
  shareUrl: string | null;
  shareLoading: boolean;
  handleShareLink: () => Promise<void>;
  handleRevokeShare: () => Promise<void>;
}

export function useShareLink(
  groupId: string | undefined,
  userId: string | undefined,
  isLead: boolean,
  refreshActivity: () => void
): UseShareLinkResult {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const { showToast } = useToast();

  // Fetch existing share link on load
  useEffect(() => {
    if (!groupId || !isLead) return;
    fetch(`/api/report/share?group_id=${groupId}`)
      .then((r) => r.json())
      .then((d) => { if (d.share) setShareUrl(`${window.location.origin}/report/${d.share.token}`); })
      .catch(() => {});
  }, [groupId, isLead]);

  async function handleShareLink() {
    if (!groupId || !userId || shareLoading) return;
    setShareLoading(true);
    try {
      const res = await fetch('/api/report/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: groupId }),
      });
      if (!res.ok) { showToast('Failed to create share link.'); return; }
      const data = await res.json();
      setShareUrl(data.url);
      await navigator.clipboard.writeText(data.url);
      showToast('Link copied to clipboard!', 'success');
      // Log share
      if (!data.existing) {
        await supabase.from('activity_log').insert({
          group_id: groupId, actor_id: userId, action: 'report_shared',
          task_id: null, meta: { token: data.token },
        });
        refreshActivity();
      }
    } catch { showToast('Failed to create share link.'); }
    finally { setShareLoading(false); }
  }

  async function handleRevokeShare() {
    if (!groupId || !userId) return;
    try {
      const res = await fetch(`/api/report/share?group_id=${groupId}`, { method: 'DELETE' });
      if (!res.ok) { showToast('Failed to revoke link.'); return; }
      setShareUrl(null);
      showToast('Share link revoked.', 'success');
    } catch { showToast('Failed to revoke link.'); }
  }

  return { shareUrl, shareLoading, handleShareLink, handleRevokeShare };
}
