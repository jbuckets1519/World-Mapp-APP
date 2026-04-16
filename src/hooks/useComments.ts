import { useState, useCallback, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './useAuth';

/**
 * Comments — lightweight Instagram-style flat comment list on a post.
 *
 * ── Required `comments` schema ─────────────────────────────────────
 *   id          uuid primary key default gen_random_uuid(),
 *   post_id     uuid not null references posts(id) on delete cascade,
 *   user_id     uuid not null references profiles(id) on delete cascade,
 *   text        text not null check (char_length(text) between 1 and 500),
 *   created_at  timestamptz not null default now()
 * ───────────────────────────────────────────────────────────────────
 */

export const MAX_COMMENT_LENGTH = 500;

export interface CommentProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  text: string;
  created_at: string;
  profile: CommentProfile | null;
}

// Supabase nests embeds — with `profiles!comments_user_id_fkey(...)` the
// shape arrives as either an object or a one-element array depending on
// the FK cardinality inferred. Normalize to a single object.
interface RawCommentRow {
  id: string;
  post_id: string;
  user_id: string;
  text: string;
  created_at: string;
  profile: CommentProfile | CommentProfile[] | null;
}

function normalizeComment(row: RawCommentRow): Comment {
  const p = Array.isArray(row.profile) ? row.profile[0] ?? null : row.profile;
  return {
    id: row.id,
    post_id: row.post_id,
    user_id: row.user_id,
    text: row.text,
    created_at: row.created_at,
    profile: p,
  };
}

/**
 * Per-post comments hook. Loads on mount, mutates optimistically, joins
 * the profiles table so the UI can show avatar + username without a
 * second round-trip.
 */
export function useComments(postId: string | null) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!postId || !isSupabaseConfigured) {
      setComments([]);
      return;
    }
    setLoading(true);
    // Embed the profile row via FK — Supabase's PostgREST join syntax.
    const { data, error } = await supabase
      .from('comments')
      .select(
        'id, post_id, user_id, text, created_at, profile:profiles(id, username, display_name, avatar_url)',
      )
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('[Comments] load ERROR:', error.message);
      setComments([]);
    } else {
      setComments(((data as unknown as RawCommentRow[]) ?? []).map(normalizeComment));
    }
    setLoading(false);
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  /** Add a comment optimistically. Trims + caps at MAX_COMMENT_LENGTH. */
  const addComment = useCallback(
    async (rawText: string): Promise<boolean> => {
      if (!user || !postId || !isSupabaseConfigured) return false;
      const text = rawText.trim().slice(0, MAX_COMMENT_LENGTH);
      if (text.length === 0) return false;

      const tempId = `temp-${Date.now()}`;
      const optimistic: Comment = {
        id: tempId,
        post_id: postId,
        user_id: user.id,
        text,
        created_at: new Date().toISOString(),
        // We don't have the caller's profile row here — the UI falls back
        // to the username/email from the auth session until load() refreshes.
        profile: {
          id: user.id,
          username:
            (user.user_metadata?.username as string | undefined) ??
            (user.email ? user.email.split('@')[0] : null),
          display_name: (user.user_metadata?.display_name as string | undefined) ?? null,
          avatar_url: (user.user_metadata?.avatar_url as string | undefined) ?? null,
        },
      };
      setComments((prev) => [...prev, optimistic]);
      setSubmitting(true);

      const { data, error } = await supabase
        .from('comments')
        .insert({ post_id: postId, user_id: user.id, text })
        .select(
          'id, post_id, user_id, text, created_at, profile:profiles(id, username, display_name, avatar_url)',
        )
        .single();
      setSubmitting(false);

      if (error) {
        console.error('[Comments] add ERROR:', error.message);
        setComments((prev) => prev.filter((c) => c.id !== tempId));
        return false;
      }
      setComments((prev) =>
        prev.map((c) => (c.id === tempId ? normalizeComment(data as unknown as RawCommentRow) : c)),
      );
      return true;
    },
    [user, postId],
  );

  /** Delete a comment. Server-side RLS should reject deletes by non-owners. */
  const deleteComment = useCallback(
    async (commentId: string) => {
      if (!isSupabaseConfigured) return;
      const prev = comments;
      setComments((c) => c.filter((x) => x.id !== commentId));
      const { error } = await supabase.from('comments').delete().eq('id', commentId);
      if (error) {
        console.error('[Comments] delete ERROR:', error.message);
        setComments(prev);
      }
    },
    [comments],
  );

  return {
    comments,
    loading,
    submitting,
    addComment,
    deleteComment,
    reload: load,
  };
}
