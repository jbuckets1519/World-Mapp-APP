import { useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { VisitedPlace } from './useTravelData';
import type { TravelPhoto } from './useTravelPhotos';

const SIGNED_URL_EXPIRY = 3600;

/**
 * Hook for loading a friend's travel data (visited places and photos).
 * RLS policies control access — the friend must be public or followed.
 */
export function useFriendData() {
  const [friendPlaces, setFriendPlaces] = useState<VisitedPlace[]>([]);
  const [friendVisitedIds, setFriendVisitedIds] = useState<Set<string>>(new Set());
  const [friendPhotos, setFriendPhotos] = useState<TravelPhoto[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [activeFriendId, setActiveFriendId] = useState<string | null>(null);
  // Version counter — tells the Globe to re-evaluate color accessors
  const [version, setVersion] = useState(0);

  // Load all visited places for a given friend
  const loadFriendPlaces = useCallback(async (friendId: string) => {
    if (!isSupabaseConfigured) return;
    setLoadingPlaces(true);
    setActiveFriendId(friendId);

    console.log('[FriendData] fetching visited_places for friend:', friendId);
    const { data, error, status, statusText } = await supabase
      .from('visited_places')
      .select('*')
      .eq('user_id', friendId)
      .order('visited_at', { ascending: false });

    console.log('[FriendData] Supabase response:', { status, statusText, error, rowCount: data?.length ?? 0 });

    if (error) {
      console.error('[FriendData] loadFriendPlaces ERROR:', error.message, error.details, error.hint);
      setFriendPlaces([]);
      setFriendVisitedIds(new Set());
    } else {
      const places = (data ?? []) as VisitedPlace[];
      const ids = new Set(places.map((p) => p.place_id));
      setFriendPlaces(places);
      setFriendVisitedIds(ids);
      console.log('[FriendData] loaded', places.length, 'places for friend', friendId);
      console.log('[FriendData] place_ids:', [...ids]);
      if (places.length > 0) {
        console.log('[FriendData] sample row:', places[0]);
      }
    }
    setVersion((v) => v + 1);
    setLoadingPlaces(false);
  }, []);

  // Clear friend overlay
  const clearFriend = useCallback(() => {
    setFriendPlaces([]);
    setFriendVisitedIds(new Set());
    setFriendPhotos([]);
    setActiveFriendId(null);
    setVersion((v) => v + 1);
  }, []);

  // Get a friend's data for a specific place
  const getFriendPlace = useCallback(
    (placeType: string, placeId: string): VisitedPlace | undefined => {
      return friendPlaces.find(
        (p) => p.place_type === placeType && p.place_id === placeId,
      );
    },
    [friendPlaces],
  );

  // Load photos for a specific place belonging to the active friend
  const loadFriendPhotos = useCallback(
    async (placeType: string, placeId: string) => {
      if (!activeFriendId || !isSupabaseConfigured) {
        setFriendPhotos([]);
        return;
      }
      setLoadingPhotos(true);

      const { data, error } = await supabase
        .from('travel_photos')
        .select('*')
        .eq('user_id', activeFriendId)
        .eq('place_type', placeType)
        .eq('place_id', placeId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[FriendData] loadFriendPhotos ERROR:', error.message);
        setFriendPhotos([]);
        setLoadingPhotos(false);
        return;
      }

      if (!data || data.length === 0) {
        setFriendPhotos([]);
        setLoadingPhotos(false);
        return;
      }

      // Generate signed URLs
      const paths = data.map((p: TravelPhoto) => p.file_path);
      const { data: signedUrls, error: urlErr } = await supabase.storage
        .from('travel-photos')
        .createSignedUrls(paths, SIGNED_URL_EXPIRY);

      if (urlErr) {
        console.error('[FriendData] createSignedUrls ERROR:', urlErr.message);
      }

      const photosWithUrls = data.map((photo: TravelPhoto, i: number) => ({
        ...photo,
        url: signedUrls?.[i]?.signedUrl ?? undefined,
      }));

      setFriendPhotos(photosWithUrls);
      setLoadingPhotos(false);
    },
    [activeFriendId],
  );

  return {
    friendPlaces,
    friendVisitedIds,
    friendPhotos,
    activeFriendId,
    version,
    loadingPlaces,
    loadingPhotos,
    loadFriendPlaces,
    clearFriend,
    getFriendPlace,
    loadFriendPhotos,
  };
}
