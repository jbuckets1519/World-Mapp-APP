import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface ProfileData {
  id: string;
  username: string | null;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_public: boolean;
}

/**
 * Hook for loading and updating the current user's profile.
 * Reads from the profiles table, uploads avatars to a storage bucket.
 */
export function useProfile(userId: string | null) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!userId || !isSupabaseConfigured) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, email, avatar_url, bio, is_public')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('[Profile] load ERROR:', error.message);
    } else if (data) {
      setProfile(data as ProfileData);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (userId) {
      loadProfile();
    } else {
      setProfile(null);
    }
  }, [userId, loadProfile]);

  // Update username, bio, display_name
  const updateProfile = useCallback(
    async (updates: { username?: string; bio?: string }): Promise<boolean> => {
      if (!userId || !isSupabaseConfigured) return false;
      setSaving(true);

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);

      if (error) {
        console.error('[Profile] update ERROR:', error.message);
        setSaving(false);
        return false;
      }

      // Update local state
      setProfile((prev) => prev ? { ...prev, ...updates } : prev);
      setSaving(false);
      return true;
    },
    [userId],
  );

  // Upload avatar image, then save the public URL to profiles.avatar_url
  const uploadAvatar = useCallback(
    async (file: File): Promise<boolean> => {
      if (!userId || !isSupabaseConfigured) return false;
      setSaving(true);

      const ext = file.name.split('.').pop() ?? 'jpg';
      const filePath = `${userId}/avatar.${ext}`;

      // Step 1: Upload to storage (overwrite if exists)
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });


      if (uploadErr) {
        console.error('[Profile] avatar upload ERROR:', uploadErr.message, uploadErr);
        setSaving(false);
        return false;
      }

      // Step 2: Get the public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const avatarUrl = urlData.publicUrl;

      // Step 3: Save URL to profiles table
      const { data: updateData, error: updateErr } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', userId)
        .select();


      if (updateErr) {
        console.error('[Profile] avatar_url update ERROR:', updateErr.message, updateErr);
        setSaving(false);
        return false;
      }

      setProfile((prev) => prev ? { ...prev, avatar_url: avatarUrl } : prev);
      setSaving(false);
      return true;
    },
    [userId],
  );

  return {
    profile,
    loading,
    saving,
    updateProfile,
    uploadAvatar,
    reload: loadProfile,
  };
}
