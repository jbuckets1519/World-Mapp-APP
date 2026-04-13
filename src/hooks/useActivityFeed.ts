import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

/**
 * Activity feed — cards from people the current user follows.
 *
 * There are two kinds of rows:
 *   1. "badge" rows — static, written once when a tier is earned.
 *   2. "visited" rows — LIVING cards. ONE per (user_id, place_id). Created
 *      automatically when the user marks a place visited, then later updated
 *      when the user explicitly shares notes or photos for that place.
 *      Sharing bumps `updated_at` so the card floats back to the top of the
 *      feed and shows "updated X ago".
 *
 * ── Required `activity_feed` schema ─────────────────────────────────
 *   id                uuid primary key default gen_random_uuid(),
 *   user_id           uuid not null references profiles(id) on delete cascade,
 *   activity_type     text not null check (activity_type in ('visited','badge',
 *                                                           'photos','bucketlist')),
 *   place_id          text,
 *   place_name        text,
 *   place_type        text,
 *   metadata          jsonb default '{}'::jsonb,
 *   shared_notes      text,
 *   -- NOTE: despite the name, this column stores Supabase Storage file PATHS
 *   -- (stable) not signed URLs (expire after 1h). The feed loader batches
 *   -- createSignedUrls() at read time to produce displayable URLs. Legacy
 *   -- rows that contain full https:// URLs are passed through untouched.
 *   shared_photo_urls jsonb default '[]'::jsonb,
 *   created_at        timestamptz not null default now(),
 *   updated_at        timestamptz not null default now()
 *
 *   -- Enforce one living card per user per place
 *   create unique index if not exists activity_feed_unique_place_card
 *     on activity_feed (user_id, place_id)
 *     where activity_type = 'visited';
 *
 *   create index if not exists activity_feed_user_updated_idx
 *     on activity_feed (user_id, updated_at desc);
 *
 * ── RLS ─────────────────────────────────────────────────────────────
 *   - Anyone can insert/update their own row (user_id = auth.uid())
 *   - Anyone can read rows whose user_id is in the reader's follows list
 *     OR whose user_id = auth.uid()
 * ────────────────────────────────────────────────────────────────────
 */

export type ActivityType = 'visited' | 'photos' | 'bucketlist' | 'badge' | 'post';

export interface ActivityMetadata {
  photo_count?: number;
  badge_name?: string;
  badge_category?: string;
  // Visit dates copied onto the card so the feed can show them without a join
  visit_start_date?: string | null;
  visit_end_date?: string | null;
  // Secondary line under the place name — e.g. the country for a city
  place_subtitle?: string;
  // For 'post' rows: link back to the underlying posts row
  post_id?: string;
}

export interface ActivityItem {
  id: string;
  user_id: string;
  activity_type: ActivityType;
  place_id: string | null;
  place_name: string | null;
  place_type: string | null;
  metadata: ActivityMetadata;
  shared_notes: string | null;
  /** Raw file paths stored in DB — stable identifiers, used for toggling share state. */
  shared_photo_paths: string[];
  /** Display-ready signed URLs generated at load time. */
  shared_photo_urls: string[];
  created_at: string;
  updated_at: string;
  profile: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

export interface LogBadgeParams {
  badgeName: string;
  badgeCategory: string;
}

export interface LogPostParams {
  placeId: string;
  placeName: string;
  placeType: string;
  /** The post row id — stored in metadata so the feed card can link back. */
  postId: string;
  /** Storage paths of the post's photos — signed at feed read time. */
  photoPaths: string[];
  /** Optional caption snippet to show on the feed card. */
  caption: string | null;
}

export interface UpsertPlaceCardParams {
  placeId: string;
  placeName: string;
  placeType: string;
  /** Replaces shared_notes on the card. Bumps updated_at. Pass null to clear. */
  sharedNotes?: string | null;
  /** Appends a storage file path to shared_photo_urls. Bumps updated_at. */
  addPhotoPath?: string;
  /** Removes a storage file path from shared_photo_urls. Bumps updated_at. */
  removePhotoPath?: string;
  /** Patches metadata (merged into existing). Does not bump on its own. */
  metadataPatch?: Partial<ActivityMetadata>;
}

/**
 * Fetches activity from the set of users the current user follows, plus
 * exposes `logBadge` and `upsertPlaceCard` helpers for writing.
 */
export function useActivityFeed(
  userId: string | null,
  followingIds: string[],
) {
  const [feed, setFeed] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (opts: { showSpinner?: boolean } = {}) => {
    if (!userId || !isSupabaseConfigured) {
      setFeed([]);
      return;
    }
    // Feed shows ONLY activity from users you follow.
    const othersFollowed = followingIds.filter((id) => id !== userId);
    if (othersFollowed.length === 0) {
      setFeed([]);
      return;
    }
    if (opts.showSpinner) setLoading(true);

    const { data, error } = await supabase
      .from('activity_feed')
      .select(
        'id, user_id, activity_type, place_id, place_name, place_type, metadata, shared_notes, shared_photo_urls, created_at, updated_at, profile:profiles!activity_feed_user_id_fkey(id, username, display_name, avatar_url)',
      )
      .in('user_id', othersFollowed)
      .neq('user_id', userId)
      // Ordering by updated_at lets bumped cards float to the top.
      .order('updated_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('[ActivityFeed] load ERROR:', error.message);
      setFeed([]);
      setLoading(false);
      return;
    }

    // Normalize + split stored entries into paths vs. legacy signed URLs.
    // Legacy rows from the first version of this feature stored full https://
    // URLs (which expire after 1h). New rows store stable storage paths.
    const rows = (data ?? []).map((row: unknown) => {
      const r = row as Record<string, unknown>;
      const stored = Array.isArray(r.shared_photo_urls)
        ? (r.shared_photo_urls as string[])
        : [];
      return {
        ...r,
        metadata: (r.metadata as ActivityMetadata | null) ?? {},
        shared_photo_paths: stored,
        shared_photo_urls: [] as string[],
        _stored_entries: stored,
      };
    });

    // Collect all storage paths across rows so we can batch-sign in one call.
    const allPaths = new Set<string>();
    for (const row of rows) {
      for (const entry of row._stored_entries) {
        if (typeof entry === 'string' && !entry.startsWith('http')) {
          allPaths.add(entry);
        }
      }
    }

    const pathToUrl = new Map<string, string>();
    if (allPaths.size > 0) {
      const paths = Array.from(allPaths);
      const { data: signed, error: urlErr } = await supabase.storage
        .from('travel-photos')
        .createSignedUrls(paths, 3600);
      if (urlErr) {
        console.error('[ActivityFeed] createSignedUrls ERROR:', urlErr.message);
      } else if (signed) {
        signed.forEach((res, i) => {
          if (res.signedUrl) pathToUrl.set(paths[i], res.signedUrl);
        });
      }
    }

    const enriched = rows.map((row) => {
      const displayUrls = row._stored_entries.map((entry: string) => {
        if (typeof entry !== 'string') return '';
        if (entry.startsWith('http')) return entry; // legacy row
        return pathToUrl.get(entry) ?? '';
      }).filter((u: string) => u.length > 0);
      // Remove the temporary _stored_entries scratch field before handing
      // rows to the UI.
      const { _stored_entries, ...rest } = row;
      void _stored_entries;
      return { ...rest, shared_photo_urls: displayUrls };
    });

    setFeed(enriched as unknown as ActivityItem[]);
    setLoading(false);
  }, [userId, followingIds]);

  useEffect(() => {
    load({ showSpinner: true });
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  /**
   * Badge auto-post — static, lifetime-deduped, never updated after creation.
   */
  const logBadge = useCallback(async (params: LogBadgeParams) => {
    if (!userId || !isSupabaseConfigured) return;

    // Lifetime dedupe: a given badge is only ever logged once per user.
    const { data: existing } = await supabase
      .from('activity_feed')
      .select('id')
      .eq('user_id', userId)
      .eq('activity_type', 'badge')
      .eq('metadata->>badge_name', params.badgeName)
      .limit(1);
    if (existing && existing.length > 0) return;

    const { error } = await supabase.from('activity_feed').insert({
      user_id: userId,
      activity_type: 'badge',
      metadata: {
        badge_name: params.badgeName,
        badge_category: params.badgeCategory,
      },
    });
    if (error) console.error('[ActivityFeed] badge ERROR:', error.message);
  }, [userId]);

  /**
   * Create or update the single "visited" card for a place.
   *
   * - If no card exists, inserts a new one (optionally with sharedNotes /
   *   addPhotoUrl / metadataPatch pre-populated).
   * - If one already exists, patches it in place. Passing sharedNotes or
   *   addPhotoUrl bumps `updated_at` so the card floats to the top of the
   *   feed; metadataPatch alone (e.g. date edits) does not bump.
   */
  const upsertPlaceCard = useCallback(async (params: UpsertPlaceCardParams): Promise<boolean> => {
    if (!userId || !isSupabaseConfigured) {
      console.warn('[ActivityFeed] upsertPlaceCard skipped — no user or supabase');
      return false;
    }

    console.log('[ActivityFeed] upsertPlaceCard →', {
      placeId: params.placeId,
      placeName: params.placeName,
      sharedNotes: params.sharedNotes === undefined ? '(unchanged)' : params.sharedNotes,
      addPhotoPath: params.addPhotoPath,
      removePhotoPath: params.removePhotoPath,
      metadataPatch: params.metadataPatch,
    });

    const { data: existing, error: selErr } = await supabase
      .from('activity_feed')
      .select('id, metadata, shared_photo_urls')
      .eq('user_id', userId)
      .eq('activity_type', 'visited')
      .eq('place_id', params.placeId)
      .maybeSingle();

    if (selErr) {
      console.error('[ActivityFeed] lookup ERROR:', selErr.message, selErr);
      return false;
    }

    const now = new Date().toISOString();

    if (!existing) {
      const initialPaths: string[] = params.addPhotoPath ? [params.addPhotoPath] : [];
      const { data: inserted, error } = await supabase.from('activity_feed').insert({
        user_id: userId,
        activity_type: 'visited',
        place_id: params.placeId,
        place_name: params.placeName,
        place_type: params.placeType,
        metadata: params.metadataPatch ?? {},
        shared_notes: params.sharedNotes ?? null,
        shared_photo_urls: initialPaths,
        created_at: now,
        updated_at: now,
      }).select().single();
      if (error) {
        console.error('[ActivityFeed] insert ERROR:', error.message, error);
        return false;
      }
      console.log('[ActivityFeed] inserted card', inserted?.id);
      return true;
    }

    const existingPaths: string[] = Array.isArray(existing.shared_photo_urls)
      ? (existing.shared_photo_urls as string[])
      : [];

    const update: Record<string, unknown> = {
      place_name: params.placeName,
      place_type: params.placeType,
    };
    let bump = false;

    if (params.sharedNotes !== undefined) {
      update.shared_notes = params.sharedNotes;
      bump = true;
    }
    if (params.addPhotoPath) {
      if (!existingPaths.includes(params.addPhotoPath)) {
        update.shared_photo_urls = [...existingPaths, params.addPhotoPath];
      }
      bump = true;
    }
    if (params.removePhotoPath) {
      const filtered = existingPaths.filter((p) => p !== params.removePhotoPath);
      update.shared_photo_urls = filtered;
      bump = true;
    }
    if (params.metadataPatch) {
      const existingMeta = (existing.metadata as ActivityMetadata | null) ?? {};
      update.metadata = { ...existingMeta, ...params.metadataPatch };
    }
    if (bump) update.updated_at = now;

    const { data: updated, error } = await supabase
      .from('activity_feed')
      .update(update)
      .eq('id', existing.id)
      .select()
      .single();
    if (error) {
      console.error('[ActivityFeed] update ERROR:', error.message, error);
      return false;
    }
    console.log('[ActivityFeed] updated card', updated?.id, {
      shared_notes: updated?.shared_notes,
      shared_photo_urls: updated?.shared_photo_urls,
    });
    return true;
  }, [userId]);

  /**
   * New-post activity row. Unlike `visited` cards, each post gets its OWN
   * feed row (static, not bumped). Photos are stored as storage paths and
   * signed at read time — same convention as the visited card.
   */
  const logPost = useCallback(async (params: LogPostParams) => {
    if (!userId || !isSupabaseConfigured) return;
    console.log('[ActivityFeed] logPost →', params.postId);
    const { error } = await supabase.from('activity_feed').insert({
      user_id: userId,
      activity_type: 'post',
      place_id: params.placeId,
      place_name: params.placeName,
      place_type: params.placeType,
      shared_notes: params.caption,
      shared_photo_urls: params.photoPaths,
      metadata: { post_id: params.postId },
    });
    if (error) console.error('[ActivityFeed] logPost ERROR:', error.message);
  }, [userId]);

  /**
   * Fetch the current user's own visited card for a given place. Used by the
   * CountryPanel / PhotoGallery to hydrate toggle state so the UI reflects
   * what's actually shared to the feed.
   */
  const getOwnPlaceCard = useCallback(
    async (placeId: string): Promise<{
      sharedNotes: string | null;
      sharedPhotoPaths: string[];
    } | null> => {
      if (!userId || !isSupabaseConfigured) return null;
      const { data, error } = await supabase
        .from('activity_feed')
        .select('shared_notes, shared_photo_urls')
        .eq('user_id', userId)
        .eq('activity_type', 'visited')
        .eq('place_id', placeId)
        .maybeSingle();
      if (error) {
        console.error('[ActivityFeed] getOwnPlaceCard ERROR:', error.message);
        return null;
      }
      if (!data) return null;
      const paths = Array.isArray(data.shared_photo_urls)
        ? (data.shared_photo_urls as string[]).filter((p) => typeof p === 'string')
        : [];
      return {
        sharedNotes: (data.shared_notes as string | null) ?? null,
        sharedPhotoPaths: paths,
      };
    },
    [userId],
  );

  return { feed, loading, refreshing, refresh, logBadge, logPost, upsertPlaceCard, getOwnPlaceCard };
}
