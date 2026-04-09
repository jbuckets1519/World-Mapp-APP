import { useState, useCallback, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const BUCKET = 'travel-photos';
// Signed URLs are valid for 1 hour
const SIGNED_URL_EXPIRY = 3600;

export interface TravelPhoto {
  id: string;
  user_id: string;
  place_type: string;
  place_id: string;
  file_path: string;
  file_name: string;
  created_at: string;
  /** Populated client-side after fetching a signed URL */
  url?: string;
}

/**
 * Sanitize a place_id for use as a storage folder name.
 * "country:France" → "country_France"
 */
function sanitizePath(placeId: string): string {
  return placeId.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Hook for uploading, loading, and deleting photos in the
 * travel-photos Supabase Storage bucket + travel_photos table.
 */
export function useTravelPhotos(userId: string | null) {
  const [photos, setPhotos] = useState<TravelPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Total photo count across all places (for stats display)
  const [totalPhotoCount, setTotalPhotoCount] = useState(0);

  // Fetch total photo count on mount and after uploads/deletes
  const loadTotalPhotoCount = useCallback(async () => {
    if (!userId || !isSupabaseConfigured) {
      setTotalPhotoCount(0);
      return;
    }
    const { count, error } = await supabase
      .from('travel_photos')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (error) {
      console.error('[TravelPhotos] count ERROR:', error.message);
    } else {
      setTotalPhotoCount(count ?? 0);
    }
  }, [userId]);

  // Load total count when user changes
  useEffect(() => {
    loadTotalPhotoCount();
  }, [loadTotalPhotoCount]);

  /**
   * Load all photos for a specific place from the travel_photos table,
   * then generate signed URLs so we can display them.
   */
  const loadPhotos = useCallback(
    async (placeType: string, placeId: string) => {
      if (!userId || !isSupabaseConfigured) {
        setPhotos([]);
        return;
      }
      setLoading(true);

      const { data, error } = await supabase
        .from('travel_photos')
        .select('*')
        .eq('user_id', userId)
        .eq('place_type', placeType)
        .eq('place_id', placeId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[TravelPhotos] loadPhotos ERROR:', error.message, error);
        setPhotos([]);
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        setPhotos([]);
        setLoading(false);
        return;
      }

      // Generate signed URLs for all photos in one batch call
      const paths = data.map((p: TravelPhoto) => p.file_path);
      const { data: signedUrls, error: urlErr } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(paths, SIGNED_URL_EXPIRY);

      if (urlErr) {
        console.error('[TravelPhotos] createSignedUrls ERROR:', urlErr.message);
      }

      // Merge signed URLs into photo records
      const photosWithUrls = data.map((photo: TravelPhoto, i: number) => ({
        ...photo,
        url: signedUrls?.[i]?.signedUrl ?? undefined,
      }));

      setPhotos(photosWithUrls);
      setLoading(false);
    },
    [userId],
  );

  /**
   * Upload a file to Storage and create a record in travel_photos.
   * Returns true on success.
   */
  const uploadPhoto = useCallback(
    async (placeType: string, placeId: string, file: File): Promise<boolean> => {
      if (!userId || !isSupabaseConfigured) return false;

      setUploading(true);
      const folder = sanitizePath(placeId);
      // Prefix with timestamp to avoid collisions
      const filePath = `${userId}/${folder}/${Date.now()}-${file.name}`;

      console.log('[TravelPhotos] uploading →', filePath);

      // 1. Upload file to Storage
      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (uploadErr) {
        console.error('[TravelPhotos] upload ERROR:', uploadErr.message, uploadErr);
        setUploading(false);
        return false;
      }

      // 2. Insert a record in the travel_photos table
      const { data, error: insertErr } = await supabase
        .from('travel_photos')
        .insert({
          user_id: userId,
          place_type: placeType,
          place_id: placeId,
          file_path: filePath,
          file_name: file.name,
        })
        .select()
        .single();

      if (insertErr) {
        console.error('[TravelPhotos] insert ERROR:', insertErr.message, insertErr);
        // Clean up the orphaned file
        await supabase.storage.from(BUCKET).remove([filePath]);
        setUploading(false);
        return false;
      }

      // 3. Get a signed URL for the new photo
      const { data: urlData } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(filePath, SIGNED_URL_EXPIRY);

      const newPhoto: TravelPhoto = {
        ...(data as TravelPhoto),
        url: urlData?.signedUrl ?? undefined,
      };

      console.log('[TravelPhotos] upload OK:', newPhoto.id);
      setPhotos((prev) => [...prev, newPhoto]);
      setTotalPhotoCount((c) => c + 1);
      setUploading(false);
      return true;
    },
    [userId],
  );

  /**
   * Delete a photo from Storage and remove its table record.
   */
  const deletePhoto = useCallback(
    async (photoId: string, filePath: string): Promise<boolean> => {
      if (!userId || !isSupabaseConfigured) return false;

      console.log('[TravelPhotos] deleting →', photoId, filePath);

      // Delete from Storage
      const { error: storageErr } = await supabase.storage
        .from(BUCKET)
        .remove([filePath]);

      if (storageErr) {
        console.error('[TravelPhotos] storage delete ERROR:', storageErr.message);
        return false;
      }

      // Delete from table
      const { error: dbErr } = await supabase
        .from('travel_photos')
        .delete()
        .eq('id', photoId)
        .eq('user_id', userId);

      if (dbErr) {
        console.error('[TravelPhotos] db delete ERROR:', dbErr.message);
        return false;
      }

      console.log('[TravelPhotos] delete OK');
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      setTotalPhotoCount((c) => Math.max(0, c - 1));
      return true;
    },
    [userId],
  );

  return {
    photos,
    loading,
    uploading,
    totalPhotoCount,
    loadPhotos,
    uploadPhoto,
    deletePhoto,
  };
}
