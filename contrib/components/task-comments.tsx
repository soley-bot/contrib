import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useTaskComments } from '@/hooks/use-task-comments';
import { taskCommentSchema } from '@/lib/validation';
import { IconTrash } from '@/components/icons';
import type { TaskComment } from '@/types';

interface TaskCommentsProps {
  taskId: string;
  taskTitle: string;
  groupId: string;
  userId: string;
  userName: string;
  isLead: boolean;
}

function getInitials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

function getAvatarColor(name: string): string {
  const colors = ['#1A56E8', '#7C3AED', '#059669', '#D97706', '#DC2626', '#0891B2'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export default function TaskComments({ taskId, taskTitle, groupId, userId, userName, isLead }: TaskCommentsProps) {
  const { comments, loading, error } = useTaskComments(taskId);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const deletingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function handleSubmit() {
    if (saving) return;
    setFormError('');
    const parsed = taskCommentSchema.safeParse({ content });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0].message);
      return;
    }
    setSaving(true);

    const { error: insertError } = await supabase.from('task_comments').insert({
      task_id: taskId,
      author_id: userId,
      content: parsed.data.content,
    });

    if (insertError) {
      setFormError('Failed to post comment. Please try again.');
      setSaving(false);
      return;
    }

    // Activity log
    supabase.from('activity_log').insert({
      group_id: groupId,
      actor_id: userId,
      action: 'comment_added',
      task_id: taskId,
      meta: { task_title: taskTitle, comment_preview: parsed.data.content.slice(0, 100) },
    }).then(null, () => {});

    // Telegram notification (fire-and-forget)
    fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groupId,
        message: `${userName} commented on "${taskTitle}": ${parsed.data.content.slice(0, 80)}`,
        type: 'contributions',
      }),
    }).catch(() => {});

    // In-app notification for assignee (fire-and-forget)
    supabase.from('tasks').select('assignee_id').eq('id', taskId).single().then(({ data: taskData }) => {
      if (taskData?.assignee_id && taskData.assignee_id !== userId) {
        supabase.from('notifications').insert({
          recipient_id: taskData.assignee_id,
          group_id: groupId,
          type: 'task_comment',
          title: `${userName} commented on "${taskTitle}"`,
          meta: { groupName: null, comment_preview: parsed.data.content.slice(0, 100) },
        }).then(null, () => {});
      }
    });

    setContent('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '52px';
    }
    setSaving(false);
  }

  async function handleDelete(commentId: string) {
    if (deletingRef.current) return;
    deletingRef.current = true;
    await supabase
      .from('task_comments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', commentId);
    deletingRef.current = false;
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[13px] font-medium text-text-secondary">
          Discussion {comments.length > 0 && <span className="font-normal text-brand">({comments.length})</span>}
        </p>
      </div>

      {loading && <div className="py-4 flex justify-center"><div className="spinner" /></div>}

      {error && <p className="text-[12px] text-red-600 mb-2">{error}</p>}

      {!loading && comments.length === 0 && (
        <p className="text-[12px] text-text-tertiary mb-3">No comments yet. Start the discussion.</p>
      )}

      {comments.map((c) => (
        <div key={c.id} className="flex gap-2 mb-3 group">
          <div
            className="w-7 h-7 rounded-full text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: getAvatarColor(c.author?.name ?? '') }}
          >
            {getInitials(c.author?.name ?? '??')}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] font-semibold text-text">{c.author?.name ?? 'Unknown'}</span>
              <span className="text-[11px] text-text-tertiary">{formatRelativeTime(c.created_at)}</span>
              {(c.author_id === userId || isLead) && (
                <button
                  onClick={() => handleDelete(c.id)}
                  className="ml-auto opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-red-500 transition-opacity p-0.5"
                  aria-label="Delete comment"
                >
                  <IconTrash size={12} />
                </button>
              )}
            </div>
            <p className="text-[13px] text-text mt-0.5 whitespace-pre-wrap break-words">{c.content}</p>
          </div>
        </div>
      ))}

      {/* Input */}
      <div className="flex gap-2 mt-2 items-end">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            const el = e.target;
            el.style.height = 'auto';
            el.style.height = Math.min(el.scrollHeight, 120) + 'px';
          }}
          onKeyDown={handleKeyDown}
          placeholder="Add a comment..."
          rows={2}
          className="flex-1 border border-border rounded-lg px-3 py-2 text-[13px] text-text outline-none focus:border-brand resize-none"
          style={{ minHeight: '52px', maxHeight: '120px' }}
        />
        <button
          onClick={handleSubmit}
          disabled={saving || !content.trim()}
          className="w-8 h-8 rounded-lg bg-brand hover:bg-brand-hover text-white flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-colors"
          aria-label="Send comment"
        >
          {saving ? (
            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M2 14l12-6L2 2v5l8 1-8 1v5z" fill="currentColor"/>
            </svg>
          )}
        </button>
      </div>
      {formError && <p className="text-[11px] text-red-600 mt-1">{formError}</p>}
    </div>
  );
}
