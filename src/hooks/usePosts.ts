import { useState, useCallback, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

/**
 * Posts — Instagram-style posts tied to a country.
 *
 * ── Required `posts` schema ─────────────────────────────────────────
 *   id          uuid primary key default gen_random_uuid(),
 *   user_id     uuid not null references profiles(id) on delete cascade,
 *   place_type  text not null default 'country',
 *   place_id    text not null,
 *   place_name  text not null,
 *   caption     text,
 *   -- NOTE: despite the name, photo_urls stores Supabase Storage FILE PATHS
 *   -- (stable). Signed URLs are generated at read time since they expire
 *   -- after 1 hour. Matches the same convention used by activity_feed.
 *   photo_urls  jsonb not null default '[]'::jsonb,
 *   created_at  timestamptz not null default now()
 *
 *   create index if not exists posts_user_place_idx
 *     on posts (user_id, place_id, created_at desc);
 * ────────────────────────────────────────────────────────────────────
 */

const BUCKET = 'travel-photos';
const SIGNED_URL_EXPIRY = 3600;
const MAX_PHOTOS_PER_POST = 20;

export interface Post {
  id: string;
  user_id: string;
  place_type: string;
  place_id: string;
  place_name: string;
  caption: string | null;
  /** Stable storage paths — what's actually in the DB column. */
  photo_paths: string[];
  /** Display-ready signed URLs hydrated at read time. */
  photo_urls: string[];
  created_at: string;
}

/** Database shape — photo_urls is the raw jsonb column. */
interface PostRow {
  id: string;
  user_id: string;
  place_type: string;
  place_id: string;
  place_name: string;
  caption: string | null;
  photo_urls: string[];
  created_at: string;
}

/** Sanitize a place_id for use as a storage folder name. */
function sanitizePath(placeId: string): string {
  return placeId.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/** Batch-sign a set of storage paths and return a path→URL map. */
async function signPaths(paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (paths.length === 0) return map;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(paths, SIGNED_URL_EXPIRY);
  if (error) {
    console.error('[Posts] createSignedUrls ERROR:', error.message);
    return map;
  }
  (data ?? []).forEach((res, i) => {
    if (res.signedUrl) map.set(paths[i], res.signedUrl);
  });
  return map;
}

/** Hydrate a raw row into a Post with signed URLs attached. */
function hydratePost(row: PostRow, urlMap: Map<string, string>): Post {
  const paths = Array.isArray(row.photo_urls) ? row.photo_urls : [];
  const urls = paths
    .map((p) => (typeof p === 'string' && p.startsWith('http') ? p : urlMap.get(p) ?? ''))
    .filter((u) => u.length > 0);
  return {
    id: row.id,
    user_id: row.user_id,
    place_type: row.place_type,
    place_id: row.place_id,
    place_name: row.place_name,
    caption: row.caption,
    photo_paths: paths,
    photo_urls: urls,
  created_at: row.created_at,
  };
}

/**
 * Hook for creating, loading, and deleting posts. Mutations always target
 * the signed-in user. Loading can target any user (own or a friend) so
 * the same hook powers both "own country activity" and the friend view.
 */
export function usePosts(userId: string | null) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Sum of photos across every post the signed-in user owns — used by the
  // profile stats card. Kept in sync client-side to avoid an extra query.
  const [totalPhotoCount, setTotalPhotoCount] = useState(0);

  const loadTotalPhotoCount = useCallback(async () => {
    if (!userId || !isSupabaseConfigured) {
      setTotalPhotoCount(0);
      return;
    }
    const { data, error } = await supabase
      .from('posts')
      .select('photo_urls')
      .eq('user_id', userId);
    if (error) {
      console.error('[Posts] count ERROR:', error.message);
      return;
    }
    let total = 0;
    for (const row of data ?? []) {
      const arr = (row as { photo_urls: unknown }).photo_urls;
      if (Array.isArray(arr)) total += arr.length;
    }
    setTotalPhotoCount(total);
  }, [userId]);

  useEffect(() => {
    loadTotalPhotoCount();
  }, [loadTotalPhotoCount]);

  /**
   * Load all posts for a single place. Pass the *target* userId (own or
   * friend). Result lands in `posts` state, newest first.
   */
  const loadPostsForPlace = useCallback(
    async (targetUserId: string, placeId: string) => {
      if (!isSupabaseConfigured || !targetUserId) {
        setPosts([]);
        return;
      }
      setLoading(true);
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', targetUserId)
        .eq('place_id', placeId)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('[Posts] loadPostsForPlace ERROR:', error.message);
        setPosts([]);
        setLoading(false);
        return;
      }
      const rows = (data ?? []) as PostRow[];
      // Collect every storage path across every post so we can batch-sign
      // in a single request.
      const allPaths = new Set<string>();
      for (const row of rows) {
        const arr = Array.isArray(row.photo_urls) ? row.photo_urls : [];
        for (const p of arr) {
          if (typeof p === 'string' && !p.startsWith('http')) allPaths.add(p);
        }
      }
      const urlMap = await signPaths(Array.from(allPaths));
      setPosts(rows.map((r) => hydratePost(r, urlMap)));
      setLoading(false);
    },
    [],
  );

  /** Clear the in-memory post list — used when closing the activity page. */
  const clearPosts = useCallback(() => setPosts([]), []);

  /**
   * Create a new post. Uploads each file to storage, then inserts a row
   * with the stored paths in `photo_urls`. Returns the hydrated post on
   * success or null on failure. Caller is responsible for logging the
   * activity feed entry.
   */
  const createPost = useCallback(
    async (
      placeId: string,
      placeName: string,
      files: File[],
      caption: string,
    ): Promise<Post | null> => {
      if (!userId || !isSupabaseConfigured) return null;
      if (files.length === 0) return null;
      if (files.length > MAX_PHOTOS_PER_POST) {
        console.error('[Posts] too many files', files.length);
        return null;
      }

      setCreating(true);
      console.log('[Posts] createPost →', { placeId, placeName, count: files.length });

      const folder = sanitizePath(placeId);
      const uploadedPaths: string[] = [];

      // Upload files sequentially so partial failures are easy to clean up.
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const filePath = `${userId}/${folder}/${Date.now()}-${i}-${file.name}`;
        const { error: uploadErr } = await supabase.storage
          .from(BUCKET)
          .upload(filePath, file, { cacheControl: '3600', upsert: false });
        if (uploadErr) {
          console.error('[Posts] upload ERROR:', uploadErr.message);
          // Roll back anything already uploaded so we don't leak files.
          if (uploadedPaths.length > 0) {
            await supabase.storage.from(BUCKET).remove(uploadedPaths);
          }
          setCreating(false);
          return null;
        }
        uploadedPaths.push(filePath);
      }

      const { data, error } = await supabase
        .from('posts')
        .insert({
          user_id: userId,
          place_type: 'country',
          place_id: placeId,
          place_name: placeName,
          caption: caption.trim() || null,
          photo_urls: uploadedPaths,
        })
        .select()
        .single();

      if (error) {
        console.error('[Posts] insert ERROR:', error.message);
        // Clean up orphaned files
        await supabase.storage.from(BUCKET).remove(uploadedPaths);
        setCreating(false);
        return null;
      }

      const urlMap = await signPaths(uploadedPaths);
      const hydrated = hydratePost(data as PostRow, urlMap);
      // Prepend so the new post appears immediately in the grid.
      setPosts((prev) => [hydrated, ...prev]);
      setTotalPhotoCount((c) => c + uploadedPaths.length);
      setCreating(false);
      return hydrated;
    },
    [userId],
  );

  /**
   * Delete a post — removes its storage files and deletes the row.
   * The activity feed entry is left alone (it's a historical record).
   */
  const deletePost = useCallback(
    async (post: Post): Promise<boolean> => {
      if (!userId || !isSupabaseConfigured) return false;
      setDeleting(true);
      console.log('[Posts] delete', post.id);

      // Only remove storage files that are real paths (not legacy http URLs).
      const pathsToRemove = post.photo_paths.filter(
        (p) => typeof p === 'string' && !p.startsWith('http'),
      );
      if (pathsToRemove.length > 0) {
        const { error: storageErr } = await supabase.storage
          .from(BUCKET)
          .remove(pathsToRemove);
        if (storageErr) {
          console.error('[Posts] storage delete ERROR:', storageErr.message);
          // Keep going — dangling storage is better than a dangling row.
        }
      }

      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', post.id)
        .eq('user_id', userId);
      if (error) {
        console.error('[Posts] db delete ERROR:', error.message);
        setDeleting(false);
        return false;
      }
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      setTotalPhotoCount((c) => Math.max(0, c - post.photo_paths.length));
      setDeleting(false);
      return true;
    },
    [userId],
  );

  return {
    posts,
    loading,
    creating,
    deleting,
    totalPhotoCount,
    loadPostsForPlace,
    clearPosts,
    createPost,
    deletePost,
  };
}
