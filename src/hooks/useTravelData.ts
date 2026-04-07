import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface VisitedPlace {
  id: string;
  place_type: 'country' | 'state';
  place_id: string;
  place_name: string;
  notes: string;
  visited_at: string;
}

/**
 * Ensure a row exists in `profiles` for this user.
 * The visited_places.user_id FK points at profiles, so writes fail
 * without it. Runs once per login; uses upsert to avoid duplicates.
 */
async function ensureProfile(userId: string): Promise<boolean> {
  console.log('[TravelData] ensureProfile — checking for', userId);

  // Try to read first (cheap, no write needed if it exists)
  const { data: existing, error: readErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (readErr) {
    console.error('[TravelData] ensureProfile read ERROR:', readErr.message, readErr);
    return false;
  }

  if (existing) {
    console.log('[TravelData] ensureProfile — profile already exists');
    return true;
  }

  // Profile missing — create it
  console.log('[TravelData] ensureProfile — creating profile row');
  const { error: insertErr } = await supabase
    .from('profiles')
    .insert({ id: userId });

  if (insertErr) {
    console.error('[TravelData] ensureProfile insert ERROR:', insertErr.message, insertErr);
    return false;
  }

  console.log('[TravelData] ensureProfile — profile created OK');
  return true;
}

/**
 * CRUD hook for the visited_places table.
 * Auto-loads data when userId changes (login/logout).
 */
export function useTravelData(userId: string | null) {
  const [places, setPlaces] = useState<VisitedPlace[]>([]);
  const [loading, setLoading] = useState(false);
  // Increments on every data mutation so the Globe knows to re-evaluate colors
  const [version, setVersion] = useState(0);
  // Track whether we've already verified the profile exists this session
  const profileChecked = useRef(false);

  // Memoized set of visited place IDs for O(1) lookup
  const visitedIds = useMemo(() => new Set(places.map((p) => p.place_id)), [places]);

  // Fetch all visited places for the current user
  const loadPlaces = useCallback(async () => {
    if (!userId || !isSupabaseConfigured) {
      console.log('[TravelData] loadPlaces skipped — userId:', userId, 'configured:', isSupabaseConfigured);
      return;
    }
    setLoading(true);

    // Make sure the profiles row exists before any DB operations
    if (!profileChecked.current) {
      const ok = await ensureProfile(userId);
      if (!ok) {
        console.error('[TravelData] loadPlaces aborted — could not ensure profile');
        setLoading(false);
        return;
      }
      profileChecked.current = true;
    }

    const { data, error } = await supabase
      .from('visited_places')
      .select('*')
      .eq('user_id', userId)
      .order('visited_at', { ascending: false });

    if (error) {
      console.error('[TravelData] loadPlaces ERROR:', error.message, error);
    } else {
      console.log('[TravelData] loadPlaces OK — loaded', data?.length, 'places');
      setPlaces(data as VisitedPlace[]);
      setVersion((v) => v + 1);
    }
    setLoading(false);
  }, [userId]);

  // Reload when user changes
  useEffect(() => {
    if (userId) {
      loadPlaces();
    } else {
      setPlaces([]);
      profileChecked.current = false;
    }
  }, [userId, loadPlaces]);

  // Mark a place as visited, optionally with initial notes.
  // Returns true on success, false on failure.
  const markVisited = useCallback(
    async (placeType: 'country' | 'state', placeId: string, placeName: string, notes = ''): Promise<boolean> => {
      if (!userId || !isSupabaseConfigured) {
        console.log('[TravelData] markVisited skipped — userId:', userId, 'configured:', isSupabaseConfigured);
        return false;
      }
      console.log('[TravelData] markVisited →', { placeType, placeId, placeName, notes, userId });
      const { data, error } = await supabase
        .from('visited_places')
        .insert({
          user_id: userId,
          place_type: placeType,
          place_id: placeId,
          place_name: placeName,
          notes,
        })
        .select()
        .single();

      if (error) {
        console.error('[TravelData] markVisited ERROR:', error.message, error);
        return false;
      }
      console.log('[TravelData] markVisited OK:', data);
      setPlaces((prev) => [data as VisitedPlace, ...prev]);
      setVersion((v) => v + 1);
      return true;
    },
    [userId],
  );

  // Remove a visited place
  const removeVisited = useCallback(
    async (placeType: string, placeId: string) => {
      if (!userId || !isSupabaseConfigured) {
        console.log('[TravelData] removeVisited skipped — userId:', userId);
        return;
      }
      console.log('[TravelData] removeVisited →', { placeType, placeId });
      const { error } = await supabase
        .from('visited_places')
        .delete()
        .eq('user_id', userId)
        .eq('place_type', placeType)
        .eq('place_id', placeId);

      if (error) {
        console.error('[TravelData] removeVisited ERROR:', error.message, error);
        return;
      }
      console.log('[TravelData] removeVisited OK');
      setPlaces((prev) =>
        prev.filter((p) => !(p.place_type === placeType && p.place_id === placeId)),
      );
      setVersion((v) => v + 1);
    },
    [userId],
  );

  // Update notes for a place (called by Save button).
  // Returns true on success, false on failure.
  const updateNotes = useCallback(
    async (placeType: string, placeId: string, notes: string): Promise<boolean> => {
      if (!userId || !isSupabaseConfigured) {
        console.log('[TravelData] updateNotes skipped — userId:', userId);
        return false;
      }
      console.log('[TravelData] updateNotes →', { placeType, placeId, notes });
      const { data, error } = await supabase
        .from('visited_places')
        .update({ notes })
        .eq('user_id', userId)
        .eq('place_type', placeType)
        .eq('place_id', placeId)
        .select();

      if (error) {
        console.error('[TravelData] updateNotes ERROR:', error.message, error);
        return false;
      }
      console.log('[TravelData] updateNotes OK — rows matched:', data?.length, data);
      if (!data || data.length === 0) {
        console.warn('[TravelData] updateNotes matched 0 rows — no row exists for this place. Was it marked as visited first?');
        return false;
      }
      // Update local state
      setPlaces((prev) =>
        prev.map((p) =>
          p.place_type === placeType && p.place_id === placeId
            ? { ...p, notes }
            : p,
        ),
      );
      return true;
    },
    [userId],
  );

  // Get a specific place's data
  const getPlace = useCallback(
    (placeType: string, placeId: string): VisitedPlace | undefined => {
      const found = places.find((p) => p.place_type === placeType && p.place_id === placeId);
      console.log('[TravelData] getPlace →', { placeType, placeId }, '→', found ?? 'NOT FOUND', `(${places.length} places in memory)`);
      return found;
    },
    [places],
  );

  return {
    places,
    visitedIds,
    version,
    loading,
    markVisited,
    removeVisited,
    updateNotes,
    getPlace,
  };
}

/**
 * Hook that debounces a callback. Uses a ref for the callback so the
 * returned function is stable and always invokes the latest version.
 */
export function useDebouncedCallback<T extends (...args: never[]) => void>(
  callback: T,
  delay: number,
): T {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Stable function — same reference across renders
  const debouncedFn = useCallback(
    ((...args: Parameters<T>) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => callbackRef.current(...args), delay);
    }) as T,
    [delay],
  );

  return debouncedFn;
}
