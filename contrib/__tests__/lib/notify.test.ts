import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase adminClient
const mockEq = vi.fn().mockReturnThis();
const mockIn = vi.fn().mockReturnThis();
const mockSelect = vi.fn().mockReturnValue({ eq: mockEq, in: mockIn });
const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

vi.mock('@/lib/supabase-admin', () => ({
  adminClient: { from: (...args: unknown[]) => mockFrom(...args) },
}));

// Mock Telegram
const mockSendTelegram = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/telegram', () => ({
  sendTelegramMessage: (...args: unknown[]) => mockSendTelegram(...args),
}));

import { notifyGroupMembers } from '@/lib/notify';

describe('notifyGroupMembers', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset the chain for each test
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnThis();
    mockIn.mockReturnThis();
  });

  it('sends messages to subscribed members', async () => {
    // First query: group_members
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [{ profile_id: 'u1' }, { profile_id: 'u2' }],
        }),
      }),
    });

    // Second query: telegram_subscriptions
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ chat_id: 111 }, { chat_id: 222 }],
            }),
          }),
        }),
      }),
    });

    await notifyGroupMembers('g1', 'Hello', 'contributions');

    expect(mockSendTelegram).toHaveBeenCalledTimes(2);
    expect(mockSendTelegram).toHaveBeenCalledWith('111', 'Hello');
    expect(mockSendTelegram).toHaveBeenCalledWith('222', 'Hello');
  });

  it('excludes the specified profile', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [{ profile_id: 'u1' }, { profile_id: 'u2' }],
        }),
      }),
    });

    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ chat_id: 222 }],
            }),
          }),
        }),
      }),
    });

    await notifyGroupMembers('g1', 'Hello', 'contributions', 'u1');

    // The in() call should have received only ['u2']
    const inCall = mockFrom.mock.results[1].value.select().in;
    expect(inCall).toHaveBeenCalledWith('profile_id', ['u2']);
  });

  it('handles empty member list gracefully', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [] }),
      }),
    });

    await notifyGroupMembers('g1', 'Hello', 'blockers');

    expect(mockSendTelegram).not.toHaveBeenCalled();
  });

  it('handles null member list gracefully', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null }),
      }),
    });

    await notifyGroupMembers('g1', 'Hello', 'deadlines');

    expect(mockSendTelegram).not.toHaveBeenCalled();
  });

  it('handles no matching subscriptions', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [{ profile_id: 'u1' }],
        }),
      }),
    });

    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [] }),
          }),
        }),
      }),
    });

    await notifyGroupMembers('g1', 'Hello', 'weekly_digest');

    expect(mockSendTelegram).not.toHaveBeenCalled();
  });

  it('does not send when all members are excluded', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [{ profile_id: 'u1' }],
        }),
      }),
    });

    await notifyGroupMembers('g1', 'Hello', 'contributions', 'u1');

    // Should not reach the telegram_subscriptions query
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockSendTelegram).not.toHaveBeenCalled();
  });
});
