import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { UserProfile, FollowRelation } from '../types';

/**
 * Hook for managing follow relationships.
 * Searches users by email, follows/unfollows, and lists followers/following.
 *
 * Assumes the follows table has columns:
 *   id, follower_id, following_id, created_at
 * And profiles table has: id, username, display_name, email, avatar_url, bio, is_public
 */
export function useFriends(userId: string | null) {
  const [following, setFollowing] = useState<FollowRelation[]>([]);
  const [followers, setFollowers] = useState<FollowRelation[]>([]);
  const [loading, setLoading] = useState(false);

  // Load both lists when userId changes
  const loadRelations = useCallback(async () => {
    if (!userId || !isSupabaseConfigured) {
      setFollowing([]);
      setFollowers([]);
      return;
    }
    setLoading(true);

    // People I follow — join the profile of the person I'm following
    const { data: followingData, error: followingErr } = await supabase
      .from('follows')
      .select('id, follower_id, following_id, created_at, profile:profiles!follows_following_id_fkey(id, username, display_name, email, avatar_url, bio, is_public)')
      .eq('follower_id', userId)
      .order('created_at', { ascending: false });

    if (followingErr) {
      console.error('[Friends] load following ERROR:', followingErr.message);
    } else {
      // Supabase returns the joined profile as an object (single row join)
      const mapped = (followingData ?? []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        follower_id: row.follower_id as string,
        following_id: row.following_id as string,
        created_at: row.created_at as string,
        profile: row.profile as UserProfile,
      }));
      setFollowing(mapped);
    }

    // People who follow me — join the profile of the follower
    const { data: followersData, error: followersErr } = await supabase
      .from('follows')
      .select('id, follower_id, following_id, created_at, profile:profiles!follows_follower_id_fkey(id, username, display_name, email, avatar_url, bio, is_public)')
      .eq('following_id', userId)
      .order('created_at', { ascending: false });

    if (followersErr) {
      console.error('[Friends] load followers ERROR:', followersErr.message);
    } else {
      const mapped = (followersData ?? []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        follower_id: row.follower_id as string,
        following_id: row.following_id as string,
        created_at: row.created_at as string,
        profile: row.profile as UserProfile,
      }));
      setFollowers(mapped);
    }

    setLoading(false);
  }, [userId]);

  useEffect(() => {
    loadRelations();
  }, [loadRelations]);

  // Search for users by email (partial match)
  const searchByEmail = useCallback(
    async (query: string): Promise<UserProfile[]> => {
      if (!userId || !isSupabaseConfigured || query.length < 3) return [];

      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, email, avatar_url, bio, is_public')
        .ilike('email', `%${query}%`)
        .neq('id', userId) // don't show yourself
        .limit(8);

      if (error) {
        console.error('[Friends] searchByEmail ERROR:', error.message);
        return [];
      }
      return (data ?? []) as UserProfile[];
    },
    [userId],
  );

  // Follow a user
  const follow = useCallback(
    async (targetId: string): Promise<boolean> => {
      if (!userId || !isSupabaseConfigured) return false;

      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: userId, following_id: targetId });

      if (error) {
        console.error('[Friends] follow ERROR:', error.message);
        return false;
      }
      // Reload to get fresh joined data
      await loadRelations();
      return true;
    },
    [userId, loadRelations],
  );

  // Unfollow a user
  const unfollow = useCallback(
    async (targetId: string): Promise<boolean> => {
      if (!userId || !isSupabaseConfigured) return false;

      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', userId)
        .eq('following_id', targetId);

      if (error) {
        console.error('[Friends] unfollow ERROR:', error.message);
        return false;
      }
      setFollowing((prev) => prev.filter((f) => f.following_id !== targetId));
      return true;
    },
    [userId],
  );

  // Quick check: am I following this user?
  const isFollowing = useCallback(
    (targetId: string): boolean => {
      return following.some((f) => f.following_id === targetId);
    },
    [following],
  );

  return {
    following,
    followers,
    loading,
    searchByEmail,
    follow,
    unfollow,
    isFollowing,
    reload: loadRelations,
  };
}
