import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface VisitedPlace {
  id: string;
  place_type: 'country' | 'territory' | 'state' | 'city';
  place_id: string;
  place_name: string;
  notes: string;
  visited_at: string;
  /** Optional visit start date (YYYY-MM-DD) */
  visit_start_date: string | null;
  /** Optional visit end date (YYYY-MM-DD) */
  visit_end_date: string | null;
  /** Controls globe highlight only — data persists regardless */
  is_visited: boolean;
}

/** Date info passed when marking a place as visited */
export interface VisitDates {
  startDate: string | null;  // YYYY-MM-DD
  endDate: string | null;    // YYYY-MM-DD
}

/**
 * Ensure a row exists in `profiles` for this user.
 * The visited_places.user_id FK points at profiles, so writes fail
 * without it. Runs once per login; uses upsert to avoid duplicates.
 */
async function ensureProfile(userId: string): Promise<boolean> {

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
    return true;
  }

  // Profile missing — create it
  const { error: insertErr } = await supabase
    .from('profiles')
    .insert({ id: userId });

  if (insertErr) {
    console.error('[TravelData] ensureProfile insert ERROR:', insertErr.message, insertErr);
    return false;
  }

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

  // Only is_visited=true rows get the globe highlight
  const visitedIds = useMemo(
    () => new Set(places.filter((p) => p.is_visited).map((p) => p.place_id)),
    [places],
  );

  // Fetch all visited places for the current user
  const loadPlaces = useCallback(async () => {
    if (!userId || !isSupabaseConfigured) {
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

  // Mark a place as visited. If a row already exists (is_visited=false),
  // reactivate it — all existing notes, photos, and dates stay untouched.
  const markVisited = useCallback(
    async (
      placeType: 'country' | 'territory' | 'state' | 'city',
      placeId: string,
      placeName: string,
      notes = '',
      dates?: VisitDates,
    ): Promise<boolean> => {
      if (!userId || !isSupabaseConfigured) {
        return false;
      }

      // Check for an existing row (may have is_visited=false)
      const typesToCheck = (placeType === 'country' || placeType === 'territory')
        ? ['country', 'territory'] : [placeType];
      const existing = places.find(
        (p) => typesToCheck.includes(p.place_type) && p.place_id === placeId,
      );

      if (existing) {
        // Row exists — flip is_visited back to true, optionally set dates
        const updates: Record<string, unknown> = { is_visited: true };
        if (dates) {
          updates.visit_start_date = dates.startDate;
          updates.visit_end_date = dates.endDate;
        }
        const { data, error } = await supabase
          .from('visited_places')
          .update(updates)
          .eq('id', existing.id)
          .select()
          .single();

        if (error) {
          console.error('[TravelData] markVisited (reactivate) ERROR:', error.message, error);
          return false;
        }
        setPlaces((prev) => prev.map((p) => p.id === existing.id ? data as VisitedPlace : p));
        setVersion((v) => v + 1);
        return true;
      }

      // No existing row — insert new
      const { data, error } = await supabase
        .from('visited_places')
        .insert({
          user_id: userId,
          place_type: placeType,
          place_id: placeId,
          place_name: placeName,
          notes,
          is_visited: true,
          visit_start_date: dates?.startDate ?? null,
          visit_end_date: dates?.endDate ?? null,
        })
        .select()
        .single();

      if (error) {
        console.error('[TravelData] markVisited ERROR:', error.message, error);
        return false;
      }
      setPlaces((prev) => [data as VisitedPlace, ...prev]);
      setVersion((v) => v + 1);
      return true;
    },
    [userId, places],
  );

  // Remove the globe highlight — notes, photos, and dates stay intact.
  const removeVisited = useCallback(
    async (placeType: string, placeId: string) => {
      if (!userId || !isSupabaseConfigured) {
        return;
      }
      const isPolygon = placeType === 'country' || placeType === 'territory';
      let query = supabase
        .from('visited_places')
        .update({ is_visited: false })
        .eq('user_id', userId)
        .eq('place_id', placeId);
      query = isPolygon
        ? query.in('place_type', ['country', 'territory'])
        : query.eq('place_type', placeType);

      const { error } = await query;

      if (error) {
        console.error('[TravelData] removeVisited ERROR:', error.message, error);
        return;
      }
      const typesToCheck = isPolygon ? ['country', 'territory'] : [placeType];
      setPlaces((prev) =>
        prev.map((p) =>
          typesToCheck.includes(p.place_type) && p.place_id === placeId
            ? { ...p, is_visited: false }
            : p,
        ),
      );
      setVersion((v) => v + 1);
    },
    [userId],
  );

  // Update notes for a place (called by Save button).
  // Matches both 'country' and 'territory' for backward compatibility.
  const updateNotes = useCallback(
    async (placeType: string, placeId: string, notes: string): Promise<boolean> => {
      if (!userId || !isSupabaseConfigured) {
        return false;
      }
      const isPolygon = placeType === 'country' || placeType === 'territory';
      let query = supabase
        .from('visited_places')
        .update({ notes })
        .eq('user_id', userId)
        .eq('place_id', placeId);
      query = isPolygon
        ? query.in('place_type', ['country', 'territory'])
        : query.eq('place_type', placeType);

      const { data, error } = await query.select();

      if (error) {
        console.error('[TravelData] updateNotes ERROR:', error.message, error);
        return false;
      }
      if (!data || data.length === 0) {
        console.warn('[TravelData] updateNotes matched 0 rows — no row exists for this place. Was it marked as visited first?');
        return false;
      }
      // Update local state
      const typesToCheck = isPolygon ? ['country', 'territory'] : [placeType];
      setPlaces((prev) =>
        prev.map((p) =>
          typesToCheck.includes(p.place_type) && p.place_id === placeId
            ? { ...p, notes }
            : p,
        ),
      );
      return true;
    },
    [userId],
  );

  // Update visit dates on an existing row.
  const updateDates = useCallback(
    async (placeType: string, placeId: string, dates: VisitDates): Promise<boolean> => {
      if (!userId || !isSupabaseConfigured) return false;
      const isPolygon = placeType === 'country' || placeType === 'territory';
      let query = supabase
        .from('visited_places')
        .update({ visit_start_date: dates.startDate, visit_end_date: dates.endDate })
        .eq('user_id', userId)
        .eq('place_id', placeId);
      query = isPolygon
        ? query.in('place_type', ['country', 'territory'])
        : query.eq('place_type', placeType);

      const { data, error } = await query.select();
      if (error) {
        console.error('[TravelData] updateDates ERROR:', error.message);
        return false;
      }
      if (!data || data.length === 0) return false;
      const typesToCheck = isPolygon ? ['country', 'territory'] : [placeType];
      setPlaces((prev) =>
        prev.map((p) =>
          typesToCheck.includes(p.place_type) && p.place_id === placeId
            ? { ...p, visit_start_date: dates.startDate, visit_end_date: dates.endDate }
            : p,
        ),
      );
      return true;
    },
    [userId],
  );

  // Look up a place — for country/territory, check both types to handle
  // older data that stored territories as 'country'
  const getPlace = useCallback(
    (placeType: string, placeId: string): VisitedPlace | undefined => {
      const typesToCheck = (placeType === 'country' || placeType === 'territory')
        ? ['country', 'territory']
        : [placeType];
      const found = places.find(
        (p) => typesToCheck.includes(p.place_type) && p.place_id === placeId,
      );
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
    updateDates,
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
