import { useState, useCallback, useEffect, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './useAuth';

/**
 * Reactions — Instagram-style emoji reactions on posts.
 *
 * ── Required `reactions` schema ────────────────────────────────────
 *   id          uuid primary key default gen_random_uuid(),
 *   post_id     uuid not null references posts(id) on delete cascade,
 *   user_id     uuid not null references profiles(id) on delete cascade,
 *   emoji       text not null,
 *   created_at  timestamptz not null default now(),
 *   unique (post_id, user_id, emoji)
 * ───────────────────────────────────────────────────────────────────
 */

export const REACTION_EMOJIS = ['❤️', '🔥', '✈️', '🌍'] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export interface Reaction {
  id: string;
  post_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

/**
 * Per-post reactions hook. Loads on mount for the given postId, mutates
 * optimistically so tapping an emoji feels instant, and rolls back on
 * database errors.
 */
export function useReactions(postId: string | null) {
  const { user } = useAuth();
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!postId || !isSupabaseConfigured) {
      setReactions([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('reactions')
      .select('id, post_id, user_id, emoji, created_at')
      .eq('post_id', postId);
    if (error) {
      console.error('[Reactions] load ERROR:', error.message);
      setReactions([]);
    } else {
      setReactions((data as Reaction[]) ?? []);
    }
    setLoading(false);
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  /** Add a reaction optimistically. No-op if the user already has that emoji. */
  const addReaction = useCallback(
    async (emoji: string) => {
      if (!user || !postId || !isSupabaseConfigured) return;
      // Already reacted? Do nothing — addReaction is idempotent.
      if (reactions.some((r) => r.user_id === user.id && r.emoji === emoji)) return;

      const tempId = `temp-${Date.now()}-${emoji}`;
      const optimistic: Reaction = {
        id: tempId,
        post_id: postId,
        user_id: user.id,
        emoji,
        created_at: new Date().toISOString(),
      };
      setReactions((prev) => [...prev, optimistic]);

      const { data, error } = await supabase
        .from('reactions')
        .insert({ post_id: postId, user_id: user.id, emoji })
        .select('id, post_id, user_id, emoji, created_at')
        .single();
      if (error) {
        console.error('[Reactions] add ERROR:', error.message);
        setReactions((prev) => prev.filter((r) => r.id !== tempId));
        return;
      }
      setReactions((prev) => prev.map((r) => (r.id === tempId ? (data as Reaction) : r)));
    },
    [user, postId, reactions],
  );

  /** Remove the current user's reaction for the given emoji. No-op if none. */
  const removeReaction = useCallback(
    async (emoji: string) => {
      if (!user || !postId || !isSupabaseConfigured) return;
      const existing = reactions.find((r) => r.user_id === user.id && r.emoji === emoji);
      if (!existing) return;

      const prev = reactions;
      setReactions((r) => r.filter((x) => x.id !== existing.id));
      const { error } = await supabase.from('reactions').delete().eq('id', existing.id);
      if (error) {
        console.error('[Reactions] remove ERROR:', error.message);
        setReactions(prev);
      }
    },
    [user, postId, reactions],
  );

  /** Flip a reaction on/off. */
  const toggleReaction = useCallback(
    (emoji: string) => {
      if (!user) return;
      const has = reactions.some((r) => r.user_id === user.id && r.emoji === emoji);
      if (has) removeReaction(emoji);
      else addReaction(emoji);
    },
    [user, reactions, addReaction, removeReaction],
  );

  // Derived counts + "did I react with this emoji" map — recomputed only
  // when `reactions` or `user` changes so children re-render cleanly.
  const { counts, mine } = useMemo(() => {
    const counts: Record<string, number> = {};
    const mine: Record<string, boolean> = {};
    for (const r of reactions) {
      counts[r.emoji] = (counts[r.emoji] ?? 0) + 1;
      if (user && r.user_id === user.id) mine[r.emoji] = true;
    }
    return { counts, mine };
  }, [reactions, user]);

  return {
    reactions,
    counts,
    mine,
    loading,
    addReaction,
    removeReaction,
    toggleReaction,
    reload: load,
  };
}
