import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface BucketlistItem {
  id: string;
  place_type: string;
  place_id: string;
  place_name: string;
  created_at: string;
}

/**
 * CRUD hook for the bucketlist table.
 * Loads all items on mount, provides add/remove/check helpers.
 */
export function useBucketlist(userId: string | null) {
  const [items, setItems] = useState<BucketlistItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Set of place_ids for O(1) lookup (used by globe highlighting)
  const bucketlistIds = useMemo(
    () => new Set(items.map((i) => i.place_id)),
    [items],
  );

  const loadItems = useCallback(async () => {
    if (!userId || !isSupabaseConfigured) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('bucketlist')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Bucketlist] load ERROR:', error.message);
    } else {
      setItems((data ?? []) as BucketlistItem[]);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (userId) loadItems();
    else setItems([]);
  }, [userId, loadItems]);

  const addItem = useCallback(
    async (placeType: string, placeId: string, placeName: string): Promise<boolean> => {
      if (!userId || !isSupabaseConfigured) return false;
      const { data, error } = await supabase
        .from('bucketlist')
        .insert({ user_id: userId, place_type: placeType, place_id: placeId, place_name: placeName })
        .select()
        .single();
      if (error) {
        console.error('[Bucketlist] add ERROR:', error.message);
        return false;
      }
      setItems((prev) => [data as BucketlistItem, ...prev]);
      return true;
    },
    [userId],
  );

  const removeItem = useCallback(
    async (placeId: string): Promise<boolean> => {
      if (!userId || !isSupabaseConfigured) return false;
      const { error } = await supabase
        .from('bucketlist')
        .delete()
        .eq('user_id', userId)
        .eq('place_id', placeId);
      if (error) {
        console.error('[Bucketlist] remove ERROR:', error.message);
        return false;
      }
      setItems((prev) => prev.filter((i) => i.place_id !== placeId));
      return true;
    },
    [userId],
  );

  const isInBucketlist = useCallback(
    (placeId: string): boolean => bucketlistIds.has(placeId),
    [bucketlistIds],
  );

  return {
    items,
    bucketlistIds,
    loading,
    addItem,
    removeItem,
    isInBucketlist,
  };
}
