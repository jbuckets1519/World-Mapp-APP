import { useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { VisitedPlace } from './useTravelData';
import type { BucketlistItem } from './useBucketlist';

/**
 * Hook for loading a friend's travel data (visited places and bucketlist).
 * RLS policies control access — the friend must be public or followed.
 *
 * Friend posts are loaded separately via usePosts.loadPostsForPlace(friendId),
 * which handles its own state and signed URLs.
 */
export function useFriendData() {
  const [friendPlaces, setFriendPlaces] = useState<VisitedPlace[]>([]);
  const [friendVisitedIds, setFriendVisitedIds] = useState<Set<string>>(new Set());
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [activeFriendId, setActiveFriendId] = useState<string | null>(null);
  const [friendBucketlistIds, setFriendBucketlistIds] = useState<Set<string>>(new Set());
  // Version counter — tells the Globe to re-evaluate color accessors
  const [version, setVersion] = useState(0);

  // Load a friend's bucketlist items
  const loadFriendBucketlist = useCallback(async (friendId: string) => {
    if (!isSupabaseConfigured) return;
    const { data, error } = await supabase
      .from('bucketlist')
      .select('*')
      .eq('user_id', friendId);

    if (error) {
      console.error('[FriendData] loadFriendBucketlist ERROR:', error.message);
      setFriendBucketlistIds(new Set());
    } else {
      const ids = new Set((data ?? []).map((item: BucketlistItem) => item.place_id));
      setFriendBucketlistIds(ids);
    }
  }, []);

  // Load all visited places for a given friend
  const loadFriendPlaces = useCallback(async (friendId: string) => {
    if (!isSupabaseConfigured) return;
    setLoadingPlaces(true);
    setActiveFriendId(friendId);

    const { data, error } = await supabase
      .from('visited_places')
      .select('*')
      .eq('user_id', friendId)
      .order('visited_at', { ascending: false });


    if (error) {
      console.error('[FriendData] loadFriendPlaces ERROR:', error.message, error.details, error.hint);
      setFriendPlaces([]);
      setFriendVisitedIds(new Set());
    } else {
      const places = (data ?? []) as VisitedPlace[];
      const ids = new Set(places.filter((p) => p.is_visited !== false).map((p) => p.place_id));
      setFriendPlaces(places);
      setFriendVisitedIds(ids);
      if (places.length > 0) {
      }
    }
    // Also load their bucketlist
    loadFriendBucketlist(friendId);
    setVersion((v) => v + 1);
    setLoadingPlaces(false);
  }, [loadFriendBucketlist]);

  // Clear friend overlay
  const clearFriend = useCallback(() => {
    setFriendPlaces([]);
    setFriendVisitedIds(new Set());
    setFriendBucketlistIds(new Set());
    setActiveFriendId(null);
    setVersion((v) => v + 1);
  }, []);

  // Get a friend's data for a specific place — checks both 'country' and
  // 'territory' types so older data stored under the wrong type still matches
  const getFriendPlace = useCallback(
    (placeType: string, placeId: string): VisitedPlace | undefined => {
      const typesToCheck = (placeType === 'country' || placeType === 'territory')
        ? ['country', 'territory']
        : [placeType];
      return friendPlaces.find(
        (p) => typesToCheck.includes(p.place_type) && p.place_id === placeId,
      );
    },
    [friendPlaces],
  );

  return {
    friendPlaces,
    friendVisitedIds,
    friendBucketlistIds,
    activeFriendId,
    version,
    loadingPlaces,
    loadFriendPlaces,
    clearFriend,
    getFriendPlace,
  };
}
