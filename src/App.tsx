import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react';

// Globe pulls in react-globe.gl + three.js (~2 MB). Lazy-load so the rest of
// the app (auth, tabs, UI) paints instantly while the globe chunk streams in.
const Globe = lazy(() => import('./components/Globe/Globe'));
import type { GlobeHandle } from './components/Globe/Globe';
import { getPolygonId } from './components/Globe/getPolygonId';
import GlobeLoader from './components/Globe/GlobeLoader';
import { CountryPanel } from './components/CountryPanel';
import { CountryActivity } from './components/CountryActivity';
import { SearchBar } from './components/SearchBar';
import { FriendOverlay } from './components/Friends';
import { BucketlistPanel } from './components/Bucketlist';
import { AuthOverlay, ProfileView, ProfileSetup, PasswordReset } from './components/Auth';
import { TabBar, TAB_BAR_HEIGHT } from './components/Navigation';
import type { TabId } from './components/Navigation';
import { ProfileTab } from './components/ProfileTab';
import { FriendsTab } from './components/FriendsTab';
import { FeedTab } from './components/FeedTab';
import { useGlobeConfig } from './hooks/useGlobeConfig';
import { useAuth } from './hooks/useAuth';
import { useTravelData } from './hooks/useTravelData';
import { usePosts } from './hooks/usePosts';
import { useFriends } from './hooks/useFriends';
import { useFriendData } from './hooks/useFriendData';
import { useProfile } from './hooks/useProfile';
import { useBucketlist } from './hooks/useBucketlist';
import { useActivityFeed } from './hooks/useActivityFeed';
import type { GeoJsonFeature, CityPoint } from './types';
import { isUNMember } from './data/un-members';
import { COUNTRY_TO_CONTINENT } from './data/continents';

// Badge thresholds — kept in sync with src/components/Achievements/Achievements.tsx
// so we can detect when the user crosses a tier and log an activity.
const WORLD_THRESHOLDS = [1, 5, 15, 30, 50];
const CONTINENT_THRESHOLDS = [1, 2, 4, 6, 7];
const WORLD_TIER_NAMES = ['Wanderer', 'Explorer', 'Adventurer', 'Pathfinder', 'World Citizen'];
const CONTINENT_TIER_NAMES = ['Local', 'Bi-coastal', 'Globetrotter', 'World Span', 'Full Lap'];

function currentTier(count: number, thresholds: number[]): number {
  let tier = -1;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (count >= thresholds[i]) { tier = i; break; }
  }
  return tier;
}

const MIN_ZOOM_DISTANCE = 120;
const MAX_ZOOM_DISTANCE = 500;
const STATE_ZOOM_ON = 85;
const STATE_ZOOM_OFF = 80;

// Countries with subdivision data — excluded from the base layer at state zoom
// to prevent z-fighting between the coarse country polygon and the state polygons.
const COUNTRIES_WITH_SUBDIVISIONS = new Set([
  'United States of America',
  'Canada',
]);

// Small island nations/territories — hide their city dots at low zoom to reduce clutter
const SMALL_ISLAND_NATIONS = new Set([
  // Caribbean
  'Antigua and Barbuda', 'Aruba', 'Bahamas', 'Barbados', 'British Virgin Islands',
  'Cayman Islands', 'Curaçao', 'Dominica', 'Grenada', 'Guadeloupe',
  'Martinique', 'Montserrat', 'Saint Kitts and Nevis', 'Saint Lucia',
  'Saint Vincent and the Grenadines', 'Sint Maarten', 'Turks and Caicos Islands',
  'United States Virgin Islands', 'Anguilla', 'Saint Barthélemy',
  'Saint Martin', 'Bonaire', 'Trinidad and Tobago',
  // Pacific
  'Fiji', 'Kiribati', 'Marshall Islands', 'Micronesia', 'Nauru', 'Palau',
  'Samoa', 'Solomon Islands', 'Tonga', 'Tuvalu', 'Vanuatu',
  'American Samoa', 'Cook Islands', 'French Polynesia', 'Guam',
  'New Caledonia', 'Niue', 'Northern Mariana Islands', 'Tokelau',
  'Wallis and Futuna', 'Pitcairn Islands',
  // Indian Ocean
  'Comoros', 'Maldives', 'Mauritius', 'Seychelles', 'Réunion', 'Mayotte',
  // Atlantic
  'Cape Verde', 'São Tomé and Principe', 'Bermuda',
  'Falkland Islands', 'Saint Helena', 'Faroe Islands',
  // Mediterranean / small European
  'Malta',
]);

function distanceToZoomLevel(distance: number): number {
  const clamped = Math.max(MIN_ZOOM_DISTANCE, Math.min(MAX_ZOOM_DISTANCE, distance));
  const ratio = (MAX_ZOOM_DISTANCE - clamped) / (MAX_ZOOM_DISTANCE - MIN_ZOOM_DISTANCE);
  return Math.round(1 + ratio * 99);
}

export default function App() {
  const { countries, subdivisions, lakes, cities: allCities, loading: globeLoading, error: globeError } = useGlobeConfig();
  const { user, loading: authLoading, isPasswordRecovery, signIn, signUp, signOut, clearPasswordRecovery } = useAuth();
  const {
    places,
    visitedIds,
    version: visitedVersion,
    markVisited,
    removeVisited,
    updateDates,
    getPlace,
  } = useTravelData(user?.id ?? null);

  const {
    posts,
    loading: postsLoading,
    creating: postsCreating,
    deleting: postsDeleting,
    totalPhotoCount,
    loadPostsForPlace,
    clearPosts,
    createPost,
    deletePost,
  } = usePosts(user?.id ?? null);

  const {
    following,
    followers,
    loading: friendsLoading,
    searchUsers,
    follow,
    unfollow,
    isFollowing,
  } = useFriends(user?.id ?? null);

  const {
    profile,
    loading: profileLoading,
    saving: profileSaving,
    updateProfile,
    uploadAvatar,
    reload: reloadProfile,
  } = useProfile(user?.id ?? null);

  const {
    friendVisitedIds,
    friendBucketlistIds,
    activeFriendId,
    version: friendVersion,
    loadingPlaces: friendLoadingPlaces,
    loadFriendPlaces,
    clearFriend,
    getFriendPlace,
  } = useFriendData();

  const {
    items: bucketlistItems,
    bucketlistIds,
    loading: bucketlistLoading,
    addItem: addBucketlistItemRaw,
    removeItem: removeBucketlistItem,
    isInBucketlist,
  } = useBucketlist(user?.id ?? null);

  // Activity feed — pulls from people the current user follows
  const followingIds = useMemo(
    () => following.map((f) => f.following_id),
    [following],
  );
  const {
    feed: activityFeed,
    loading: activityLoading,
    refreshing: activityRefreshing,
    refresh: refreshActivityFeed,
    logBadge,
    logPost,
    upsertPlaceCard,
  } = useActivityFeed(user?.id ?? null, followingIds);

  const [showBucketlistOverlay, setShowBucketlistOverlay] = useState(false);
  const [showFriendBucketlist, setShowFriendBucketlist] = useState(false);
  // Version counter to trigger globe re-render when bucketlist changes
  const bucketlistVersion = bucketlistItems.length;

  const globeRef = useRef<GlobeHandle>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<GeoJsonFeature | null>(null);
  const [selectedCity, setSelectedCity] = useState<CityPoint | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  // Full-screen country activity page (Instagram-style post grid)
  const [showActivity, setShowActivity] = useState(false);
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('globe');

  // Clear overlays when switching tabs so nothing bleeds across views
  const handleTabChange = useCallback((tab: TabId) => {
    setActiveTab(tab);
    setViewingProfileId(null);
    setShowActivity(false);
  }, []);

  // View a friend's map: load their places, switch to globe tab, close profile modal
  const handleViewFriendMap = useCallback((friendId: string) => {
    loadFriendPlaces(friendId);
    setActiveTab('globe');
    setViewingProfileId(null);
  }, [loadFriendPlaces]);

  // Are we viewing a friend's map? This drives the entire UI mode.
  const isFriendView = Boolean(activeFriendId);

  // New user needs profile setup if logged in, profile loaded, and no username yet
  const needsProfileSetup = Boolean(user && !profileLoading && profile && !profile.username);

  const rafRef = useRef(0);
  const handleZoomChange = useCallback((distance: number) => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setZoomLevel(distanceToZoomLevel(distance));
    });
  }, []);

  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () =>
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [showStates, setShowStates] = useState(false);
  useEffect(() => {
    if (!showStates && zoomLevel >= STATE_ZOOM_ON) {
      setShowStates(true);
    } else if (showStates && zoomLevel < STATE_ZOOM_OFF) {
      setShowStates(false);
    }
  }, [zoomLevel, showStates]);

  // Tier cities by zoom: only show top-ranked at low zoom, reveal more as user zooms in.
  // Dataset is top 300 cities by population. Discrete breakpoints avoid constant recomputation.
  const maxScaleRank = useMemo(() => {
    if (zoomLevel < 10) return 1;   // ~20 major world cities
    if (zoomLevel < 30) return 3;   // ~60 cities
    if (zoomLevel < 50) return 5;   // ~150 cities
    return 10;                       // all 300 cities
  }, [zoomLevel]);

  const visibleCities = useMemo(() => {
    return allCities.filter((c) => {
      if (c.scaleRank > maxScaleRank) return false;
      // Hide small island nation dots at low zoom — they clutter the globe
      if (zoomLevel < 90 && SMALL_ISLAND_NATIONS.has(c.country)) return false;
      return true;
    });
  }, [allCities, maxScaleRank, zoomLevel]);

  const countriesOnly = useMemo(() => {
    if (countries.length === 0) return [];
    return lakes.length > 0 ? [...countries, ...lakes] : countries;
  }, [countries, lakes]);

  // At state zoom, exclude countries that have subdivision data (USA, Canada, Mexico)
  // to prevent z-fighting between the coarse country polygon and the detailed state
  // polygons at nearly the same altitude — this causes dark patches inside states.
  // Lakes fill the water gaps (Great Lakes, etc.) between state shorelines.
  const withStates = useMemo(() => {
    if (countries.length === 0) return [];
    const otherCountries = countries.filter(
      (f) => !COUNTRIES_WITH_SUBDIVISIONS.has(f.properties.NAME as string),
    );
    const base = lakes.length > 0 ? [...otherCountries, ...lakes] : otherCountries;
    return subdivisions.length > 0 ? [...base, ...subdivisions] : base;
  }, [countries, subdivisions, lakes]);

  const polygons = showStates ? withStates : countriesOnly;

  useEffect(() => {
    if (!showStates && selectedFeature?._isState) {
      setSelectedId(null);
      setSelectedFeature(null);
    }
  }, [showStates, selectedFeature]);

  // Clear selection when switching between own map and friend map
  useEffect(() => {
    setSelectedId(null);
    setSelectedFeature(null);
    setSelectedCity(null);
    setShowActivity(false);
    setShowFriendBucketlist(false);
  }, [activeFriendId]);

  // Guard: when a city dot is clicked, react-globe.gl also fires onPolygonClick
  // for the polygon underneath. This ref lets handlePolygonClick ignore that second event.
  const cityClickedRef = useRef(false);

  const handlePolygonClick = useCallback(
    (polygon: GeoJsonFeature) => {
      if (cityClickedRef.current) {
        cityClickedRef.current = false;
        return;
      }
      const id = getPolygonId(polygon);
      if (id === selectedId) {
        setSelectedId(null);
        setSelectedFeature(null);
      } else {
        setSelectedId(id);
        setSelectedFeature(polygon);
      }
      setSelectedCity(null);
    },
    [selectedId],
  );

  const handleCityClick = useCallback(
    (city: CityPoint) => {
      cityClickedRef.current = true;
      if (city.id === selectedId) {
        setSelectedId(null);
        setSelectedCity(null);
      } else {
        setSelectedId(city.id);
        setSelectedCity(city);
      }
      setSelectedFeature(null);
    },
    [selectedId],
  );

  const handleSearchSelectCity = useCallback((city: CityPoint) => {
    setSelectedId(city.id);
    setSelectedCity(city);
    setSelectedFeature(null);
  }, []);

  const handleSearchSelectPolygon = useCallback((polygon: GeoJsonFeature) => {
    const id = getPolygonId(polygon);
    setSelectedId(id);
    setSelectedFeature(polygon);
    setSelectedCity(null);
  }, []);

  const handleFlyTo = useCallback((lat: number, lng: number) => {
    globeRef.current?.flyTo(lat, lng);
  }, []);

  // Feed → globe: user tapped an activity referencing a place. Switch to the
  // globe tab and select the matching polygon (or city) so the info box opens.
  // The `place_id` format matches what getPolygonId produces, e.g. "country:Japan".
  const handleNavigateToPlace = useCallback(
    (placeId: string, placeType: string) => {
      setActiveTab('globe');
      setShowActivity(false);
      setViewingProfileId(null);

      if (placeType === 'city') {
        const city = allCities.find((c) => c.id === placeId);
        if (city) {
          setSelectedId(city.id);
          setSelectedCity(city);
          setSelectedFeature(null);
          globeRef.current?.flyTo(city.lat, city.lng);
        }
        return;
      }

      // Find the polygon by id match. We check both country and state lists
      // since 'state:Texas' vs 'country:USA' use the same id-building scheme.
      const allPolygons: GeoJsonFeature[] = [...countries, ...subdivisions];
      const match = allPolygons.find((p) => getPolygonId(p) === placeId);
      if (match) {
        setSelectedId(placeId);
        setSelectedFeature(match);
        setSelectedCity(null);
      }
    },
    [allCities, countries, subdivisions],
  );

  const handleClose = useCallback(() => {
    setSelectedId(null);
    setSelectedFeature(null);
    setSelectedCity(null);
    setShowActivity(false);
  }, []);

  // --- Derive selected place info ---
  // Non-state polygons are classified as 'country' (UN member) or 'territory'
  const selectedPlaceType: 'country' | 'territory' | 'state' | 'city' = selectedCity
    ? 'city'
    : selectedFeature?._isState
      ? 'state'
      : selectedFeature
        ? isUNMember(selectedFeature.properties.NAME as string) ? 'country' : 'territory'
        : 'country';
  const selectedPlaceId = selectedCity
    ? selectedCity.id
    : selectedFeature
      ? getPolygonId(selectedFeature)
      : '';
  const selectedPlaceName = selectedCity
    ? selectedCity.name
    : selectedFeature?.properties.NAME ?? '';
  const hasSelection = Boolean(selectedFeature || selectedCity);

  // --- Data for the selected place depends on whose map we're viewing ---
  const selectedVisitedData = hasSelection
    ? isFriendView
      ? getFriendPlace(selectedPlaceType, selectedPlaceId)
      : getPlace(selectedPlaceType, selectedPlaceId)
    : undefined;

  // Load posts for the selected country when the activity page opens.
  // In friend view we target the friend's user_id so RLS grants read access.
  useEffect(() => {
    if (!showActivity || !hasSelection) return;
    const targetUserId = isFriendView ? activeFriendId : user?.id ?? null;
    if (!targetUserId) return;
    loadPostsForPlace(targetUserId, selectedPlaceId);
  }, [
    showActivity,
    hasSelection,
    isFriendView,
    activeFriendId,
    user?.id,
    selectedPlaceId,
    loadPostsForPlace,
  ]);

  // Clear the in-memory post list when the activity page closes so stale
  // posts from a previous country don't flash when reopening.
  useEffect(() => {
    if (!showActivity) clearPosts();
  }, [showActivity, clearPosts]);

  // Friend info
  const activeFriendProfile = activeFriendId
    ? following.find((f) => f.following_id === activeFriendId)?.profile
    : null;
  const activeFriendName = activeFriendProfile
    ? activeFriendProfile.username || activeFriendProfile.display_name || 'Friend'
    : null;

  // Globe data: show friend's visited IDs when in friend view, otherwise own
  const globeVisitedIds = isFriendView ? friendVisitedIds : visitedIds;
  const globeVisitedVersion = isFriendView ? friendVersion : visitedVersion;

  // Create a post from the activity page. Uploads files, creates the post
  // row, then inserts a matching activity_feed row so followers see it.
  const handleCreatePost = useCallback(
    async (files: File[], caption: string): Promise<boolean> => {
      if (!selectedPlaceId || !selectedPlaceName) return false;
      const created = await createPost(selectedPlaceId, selectedPlaceName, files, caption);
      if (!created) return false;
      await logPost({
        placeId: created.place_id,
        placeName: created.place_name,
        placeType: 'country',
        postId: created.id,
        photoPaths: created.photo_paths,
        caption: created.caption,
      });
      return true;
    },
    [createPost, logPost, selectedPlaceId, selectedPlaceName],
  );

  // Mark visited — auto-creates (never auto-updates) the initial feed card
  // for this place. Dates land in metadata so the card can display them.
  const handleMarkVisited = useCallback(async (
    dates?: { startDate: string | null; endDate: string | null },
  ): Promise<boolean> => {
    const ok = await markVisited(selectedPlaceType, selectedPlaceId, selectedPlaceName, '', dates);
    if (ok) {
      upsertPlaceCard({
        placeId: selectedPlaceId,
        placeName: selectedPlaceName,
        placeType: selectedPlaceType,
        metadataPatch: {
          visit_start_date: dates?.startDate ?? null,
          visit_end_date: dates?.endDate ?? null,
          ...(selectedCity ? { place_subtitle: selectedCity.country } : {}),
        },
      });
    }
    return ok;
  }, [markVisited, upsertPlaceCard, selectedPlaceType, selectedPlaceId, selectedPlaceName, selectedCity]);

  // Bucketlist adds no longer auto-post to the feed.
  const addBucketlistItem = useCallback(
    async (placeType: string, placeId: string, placeName: string) => {
      return addBucketlistItemRaw(placeType, placeId, placeName);
    },
    [addBucketlistItemRaw],
  );

  // --- Badge detection ---
  // Compute current country / continent counts from the user's visited places
  // the same way the Achievements component does. When a tier is crossed, log
  // an activity. We track previous tiers in refs so the first render (after
  // hydrating places from the DB) doesn't spam-log stale badges.
  const { ownCountryCount, ownContinentCount } = useMemo(() => {
    const active = places.filter((p) => p.is_visited !== false);
    const polys = active.filter(
      (p) => p.place_type === 'country' || p.place_type === 'territory',
    );
    let cCount = 0;
    const continents = new Set<string>();
    for (const p of polys) {
      const name = p.place_id.replace(/^(country|territory):/, '');
      if (isUNMember(name)) {
        cCount++;
        const continent = COUNTRY_TO_CONTINENT[name];
        if (continent) continents.add(continent);
      }
    }
    return { ownCountryCount: cCount, ownContinentCount: continents.size };
  }, [places]);

  const prevWorldTier = useRef<number | null>(null);
  const prevContinentTier = useRef<number | null>(null);

  useEffect(() => {
    if (!user) return;
    const wTier = currentTier(ownCountryCount, WORLD_THRESHOLDS);
    const cTier = currentTier(ownContinentCount, CONTINENT_THRESHOLDS);

    // First time we see this user's counts — just seed the refs, don't log
    if (prevWorldTier.current === null) {
      prevWorldTier.current = wTier;
      prevContinentTier.current = cTier;
      return;
    }

    if (wTier > (prevWorldTier.current ?? -1)) {
      logBadge({ badgeName: WORLD_TIER_NAMES[wTier], badgeCategory: 'World Traveler' });
    }
    if (cTier > (prevContinentTier.current ?? -1)) {
      logBadge({ badgeName: CONTINENT_TIER_NAMES[cTier], badgeCategory: 'Continents' });
    }
    prevWorldTier.current = wTier;
    prevContinentTier.current = cTier;
  }, [ownCountryCount, ownContinentCount, user, logBadge]);

  const handleRemoveVisited = useCallback(async () => {
    await removeVisited(selectedPlaceType, selectedPlaceId);
  }, [removeVisited, selectedPlaceType, selectedPlaceId]);

  // Date edits keep the feed card's metadata in sync so the dates shown on
  // bumped cards stay accurate — but date edits alone never bump the feed.
  const handleUpdateDates = useCallback(
    async (dates: { startDate: string | null; endDate: string | null }): Promise<boolean> => {
      const ok = await updateDates(selectedPlaceType, selectedPlaceId, dates);
      if (ok) {
        upsertPlaceCard({
          placeId: selectedPlaceId,
          placeName: selectedPlaceName,
          placeType: selectedPlaceType,
          metadataPatch: {
            visit_start_date: dates.startDate,
            visit_end_date: dates.endDate,
          },
        });
      }
      return ok;
    },
    [updateDates, upsertPlaceCard, selectedPlaceType, selectedPlaceId, selectedPlaceName],
  );

  if (globeError) {
    return (
      <div style={{ color: '#ff6b6b', padding: '2rem', textAlign: 'center' }}>
        Failed to load globe data: {globeError}
      </div>
    );
  }

  if (globeLoading || authLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          color: 'rgba(100, 180, 255, 0.6)',
          fontSize: '1.2rem',
        }}
      >
        Loading...
      </div>
    );
  }

  return (
    <>
      {/* Globe is always mounted so it keeps state, but hidden when on profile tab */}
      <div style={{ display: activeTab === 'globe' ? 'contents' : 'none' }}>
        <Suspense fallback={<GlobeLoader />}>
          <Globe
            ref={globeRef}
            polygons={polygons}
            cities={visibleCities}
            selectedId={selectedId}
            visitedIds={globeVisitedIds}
            visitedVersion={globeVisitedVersion}
            visitedColor={isFriendView ? 'purple' : 'orange'}
            zoomLevel={zoomLevel}
            width={dimensions.width}
            height={dimensions.height}
            onPolygonClick={handlePolygonClick}
            onCityClick={handleCityClick}
            onZoomChange={handleZoomChange}
            onGlobeClick={handleClose}
            bucketlistIds={
              isFriendView
                ? (showFriendBucketlist ? friendBucketlistIds : undefined)
                : (showBucketlistOverlay ? bucketlistIds : undefined)
            }
            bucketlistVersion={
              isFriendView
                ? (showFriendBucketlist ? friendVersion : 0)
                : (showBucketlistOverlay ? bucketlistVersion : 0)
            }
          />
        </Suspense>
        <SearchBar
          cities={allCities}
          polygons={polygons}
          onSelectCity={handleSearchSelectCity}
          onSelectPolygon={handleSearchSelectPolygon}
          onFlyTo={handleFlyTo}
          isInBucketlist={user ? isInBucketlist : undefined}
          onAddToBucketlist={user ? (t, id, n) => { addBucketlistItem(t, id, n); } : undefined}
          onRemoveFromBucketlist={user ? (id) => { removeBucketlistItem(id); } : undefined}
        />

        {/* "Back to My Map" banner when viewing a friend's map */}
        {isFriendView && activeFriendName && (
          <div style={friendBannerStyles.banner}>
            <span style={friendBannerStyles.dot} />
            <span>Viewing <strong>{activeFriendName}</strong>'s map</span>
            <button style={friendBannerStyles.backBtn} onClick={clearFriend}>
              Back to My Map
            </button>
          </div>
        )}

        {user && (
          <>
            {/* Bucketlist pail icon must not appear over the activity page */}
            {!showActivity && (
              <BucketlistPanel
                items={bucketlistItems}
                loading={bucketlistLoading}
                showOverlay={showBucketlistOverlay}
                onToggleOverlay={() => setShowBucketlistOverlay((v) => !v)}
                onRemove={removeBucketlistItem}
              />
            )}
            {/* Friend overlay selector — "View friend's map" stays on globe tab */}
            {!showActivity && (
              <FriendOverlay
                following={following}
                activeFriendId={activeFriendId}
                loadingPlaces={friendLoadingPlaces}
                onSelectFriend={loadFriendPlaces}
                onClear={clearFriend}
                showFriendBucketlist={showFriendBucketlist}
                onToggleFriendBucketlist={() => setShowFriendBucketlist((v) => !v)}
              />
            )}
          </>
        )}

        {/* Info box hides while the country activity page is open so the
            user never sees both at once. Selection is preserved. */}
        {hasSelection && !showActivity && (
          isFriendView ? (
            <CountryPanel
              country={selectedFeature}
              city={selectedCity}
              visitedData={selectedVisitedData}
              isLoggedIn={Boolean(user)}
              onMarkVisited={async () => false}
              onRemoveVisited={() => {}}
              onUpdateDates={async () => false}
              onClose={handleClose}
              onOpenActivity={() => setShowActivity(true)}
              friendViewMode={true}
              friendName={activeFriendName}
            />
          ) : (
            <CountryPanel
              country={selectedFeature}
              city={selectedCity}
              visitedData={selectedVisitedData}
              isLoggedIn={Boolean(user)}
              onMarkVisited={handleMarkVisited}
              onRemoveVisited={handleRemoveVisited}
              onUpdateDates={handleUpdateDates}
              onClose={handleClose}
              onOpenActivity={() => setShowActivity(true)}
              isInBucketlist={isInBucketlist(selectedPlaceId)}
              onAddToBucketlist={() => addBucketlistItem(selectedPlaceType, selectedPlaceId, selectedPlaceName)}
              onRemoveFromBucketlist={() => removeBucketlistItem(selectedPlaceId)}
            />
          )
        )}

        {showActivity && hasSelection && (
          <CountryActivity
            countryName={selectedPlaceName}
            posts={posts}
            loading={postsLoading}
            creating={postsCreating}
            deleting={postsDeleting}
            readOnly={isFriendView}
            friendName={isFriendView ? activeFriendName : null}
            onClose={() => setShowActivity(false)}
            onCreatePost={handleCreatePost}
            onDeletePost={deletePost}
          />
        )}
      </div>

      {/* Friends tab */}
      {activeTab === 'friends' && user && (
        <FriendsTab
          following={following}
          followers={followers}
          friendsLoading={friendsLoading}
          onSearchUsers={searchUsers}
          onFollow={follow}
          onUnfollow={unfollow}
          isFollowing={isFollowing}
          onViewProfile={setViewingProfileId}
        />
      )}

      {/* Feed tab */}
      {activeTab === 'feed' && user && (
        <FeedTab
          feed={activityFeed}
          loading={activityLoading}
          refreshing={activityRefreshing}
          followingCount={following.length}
          onRefresh={refreshActivityFeed}
          onNavigateToPlace={handleNavigateToPlace}
          onViewProfile={setViewingProfileId}
        />
      )}

      {/* Profile tab */}
      {activeTab === 'profile' && user && profile && (
        <ProfileTab
          profile={profile}
          saving={profileSaving}
          places={places}
          totalPhotoCount={totalPhotoCount}
          onSave={updateProfile}
          onUploadAvatar={uploadAvatar}
          onSignOut={signOut}
        />
      )}

      {/* Password recovery overlay — shown when arriving from a reset link */}
      {isPasswordRecovery && (
        <PasswordReset onComplete={clearPasswordRecovery} />
      )}

      {/* Auth overlay — always visible regardless of tab */}
      {!user && <AuthOverlay onSignIn={signIn} onSignUp={signUp} />}

      {/* First-time profile setup — blocks the app until username is set */}
      {needsProfileSetup && profile && (
        <ProfileSetup
          profile={profile}
          saving={profileSaving}
          onSave={updateProfile}
          onUploadAvatar={uploadAvatar}
          onComplete={reloadProfile}
        />
      )}

      {/* ProfileView modal — can appear from both tabs */}
      {viewingProfileId && (
        <ProfileView
          userId={viewingProfileId}
          currentUserId={user?.id ?? null}
          isFollowing={isFollowing}
          onFollow={follow}
          onUnfollow={unfollow}
          onClose={() => setViewingProfileId(null)}
          onViewMap={handleViewFriendMap}
        />
      )}

      {/* Bottom tab bar — only show when logged in */}
      {user && (
        <TabBar activeTab={activeTab} onTabChange={handleTabChange} />
      )}
    </>
  );
}

// --- Styles for the friend view banner ---
const friendBannerStyles: Record<string, React.CSSProperties> = {
  banner: {
    position: 'fixed',
    bottom: `calc(${TAB_BAR_HEIGHT + 12}px + env(safe-area-inset-bottom, 0px))`,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 0.75rem 0.5rem 0.65rem',
    background: 'rgba(15, 15, 25, 0.9)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(180, 130, 255, 0.3)',
    borderRadius: '10px',
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: '0.8rem',
    zIndex: 15,
    whiteSpace: 'nowrap',
  },
  dot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    background: 'rgba(180, 130, 255, 0.8)',
    flexShrink: 0,
  },
  backBtn: {
    marginLeft: '0.5rem',
    padding: '0.3rem 0.65rem',
    background: 'rgba(100, 180, 255, 0.15)',
    border: '1px solid rgba(100, 180, 255, 0.3)',
    borderRadius: '6px',
    color: 'rgba(100, 180, 255, 0.9)',
    fontSize: '0.75rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
};
