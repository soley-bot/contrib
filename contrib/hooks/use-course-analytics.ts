import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { EvaluationSession } from '@/types';

interface EvalCount {
  group_id: string;
  evaluator_id: string;
}

interface ActivityEntry {
  group_id: string;
  created_at: string;
}

interface EvalScoreRow {
  group_id: string;
  contribution_score: number;
  collaboration_score: number;
}

interface UseCourseAnalyticsResult {
  evalSessions: EvaluationSession[];
  evalCounts: Record<string, string[]>; // group_id -> unique evaluator_ids
  evalScores: EvalScoreRow[];
  latestActivity: Record<string, string>; // group_id -> ISO timestamp
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useCourseAnalytics(groupIds: string[]): UseCourseAnalyticsResult {
  const [evalSessions, setEvalSessions] = useState<EvaluationSession[]>([]);
  const [evalCounts, setEvalCounts] = useState<Record<string, string[]>>({});
  const [evalScores, setEvalScores] = useState<EvalScoreRow[]>([]);
  const [latestActivity, setLatestActivity] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (groupIds.length === 0) {
      setLoading(false);
      setEvalSessions([]);
      setEvalCounts({});
      setEvalScores([]);
      setLatestActivity({});
      return;
    }
    setLoading(true);
    fetchAll(groupIds).finally(() => setLoading(false));
  }, [groupIds.join(','), tick]);

  async function fetchAll(ids: string[]) {
    const [sessionsRes, evalsRes, activityRes, scoresRes] = await Promise.all([
      supabase
        .from('evaluation_sessions')
        .select('*')
        .in('group_id', ids),
      supabase
        .from('evaluations')
        .select('group_id, evaluator_id')
        .in('group_id', ids),
      supabase
        .from('activity_log')
        .select('group_id, created_at')
        .in('group_id', ids)
        .order('created_at', { ascending: false }),
      supabase
        .from('evaluations')
        .select('group_id, contribution_score, collaboration_score')
        .in('group_id', ids),
    ]);

    if (sessionsRes.error) {
      console.error('Failed to load evaluation sessions:', sessionsRes.error);
      setError('Failed to load peer review data.');
      return;
    }
    if (evalsRes.error) {
      console.error('Failed to load evaluations:', evalsRes.error);
      setError('Failed to load peer review data.');
      return;
    }
    if (activityRes.error) {
      console.error('Failed to load activity log:', activityRes.error);
      setError('Failed to load activity data.');
      return;
    }
    if (scoresRes.error) {
      console.error('Failed to load evaluation scores:', scoresRes.error);
      setError('Failed to load peer review scores.');
      return;
    }

    setError(null);
    setEvalSessions((sessionsRes.data as EvaluationSession[]) ?? []);

    // Build evaluator counts per group (unique evaluator_ids)
    const counts: Record<string, string[]> = {};
    ids.forEach((id) => { counts[id] = []; });
    ((evalsRes.data as EvalCount[]) ?? []).forEach((row) => {
      if (!counts[row.group_id]) counts[row.group_id] = [];
      if (!counts[row.group_id].includes(row.evaluator_id)) {
        counts[row.group_id].push(row.evaluator_id);
      }
    });
    setEvalCounts(counts);

    // Build latest activity per group
    const latest: Record<string, string> = {};
    ((activityRes.data as ActivityEntry[]) ?? []).forEach((row) => {
      // Already ordered descending, so first occurrence per group is the latest
      if (!latest[row.group_id]) {
        latest[row.group_id] = row.created_at;
      }
    });
    setLatestActivity(latest);

    setEvalScores((scoresRes.data as EvalScoreRow[]) ?? []);
  }

  return {
    evalSessions,
    evalCounts,
    evalScores,
    latestActivity,
    loading,
    error,
    refresh: () => setTick((t) => t + 1),
  };
}
