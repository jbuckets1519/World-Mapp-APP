import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

import { Globe } from './components/Globe';
import type { GlobeHandle } from './components/Globe';
import { getPolygonId } from './components/Globe/Globe';
import { CountryPanel } from './components/CountryPanel';
import PhotoGallery from './components/CountryPanel/PhotoGallery';
import { ZoomIndicator } from './components/ZoomIndicator';
import { SearchBar } from './components/SearchBar';
import { FriendsPanel, FriendOverlay } from './components/Friends';
import { AuthOverlay, UserIndicator, ProfileEditor, ProfileView } from './components/Auth';
import { useGlobeConfig } from './hooks/useGlobeConfig';
import { useAuth } from './hooks/useAuth';
import { useTravelData } from './hooks/useTravelData';
import { useTravelPhotos } from './hooks/useTravelPhotos';
import { useFriends } from './hooks/useFriends';
import { useFriendData } from './hooks/useFriendData';
import { useProfile } from './hooks/useProfile';
import type { GeoJsonFeature, CityPoint } from './types';

const MIN_ZOOM_DISTANCE = 120;
const MAX_ZOOM_DISTANCE = 500;
const STATE_ZOOM_ON = 85;
const STATE_ZOOM_OFF = 80;

function distanceToZoomLevel(distance: number): number {
  const clamped = Math.max(MIN_ZOOM_DISTANCE, Math.min(MAX_ZOOM_DISTANCE, distance));
  const ratio = (MAX_ZOOM_DISTANCE - clamped) / (MAX_ZOOM_DISTANCE - MIN_ZOOM_DISTANCE);
  return Math.round(1 + ratio * 99);
}

export default function App() {
  const { countries, subdivisions, cities: allCities, loading: globeLoading, error: globeError } = useGlobeConfig();
  const { user, loading: authLoading, signIn, signUp, signOut } = useAuth();
  const {
    visitedIds,
    version: visitedVersion,
    markVisited,
    removeVisited,
    updateNotes,
    getPlace,
  } = useTravelData(user?.id ?? null);

  const {
    photos,
    loading: photosLoading,
    uploading: photosUploading,
    loadPhotos,
    uploadPhoto,
    deletePhoto,
  } = useTravelPhotos(user?.id ?? null);

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
    saving: profileSaving,
    updateProfile,
    uploadAvatar,
  } = useProfile(user?.id ?? null);

  const {
    friendVisitedIds,
    activeFriendId,
    version: friendVersion,
    loadingPlaces: friendLoadingPlaces,
    friendPhotos,
    loadingPhotos: friendPhotosLoading,
    loadFriendPlaces,
    clearFriend,
    getFriendPlace,
    loadFriendPhotos,
  } = useFriendData();

  const globeRef = useRef<GlobeHandle>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<GeoJsonFeature | null>(null);
  const [selectedCity, setSelectedCity] = useState<CityPoint | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showGallery, setShowGallery] = useState(false);
  const [friendsPanelOpen, setFriendsPanelOpen] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);

  // Are we viewing a friend's map? This drives the entire UI mode.
  const isFriendView = Boolean(activeFriendId);

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
  // Dataset is SCALERANK 0–6 (~1,000 cities). Discrete breakpoints avoid constant recomputation.
  const maxScaleRank = useMemo(() => {
    if (zoomLevel < 10) return 1;   // ~30 major world cities
    if (zoomLevel < 25) return 2;   // ~80 cities
    if (zoomLevel < 40) return 3;   // ~150 cities
    if (zoomLevel < 55) return 4;   // ~300 cities
    if (zoomLevel < 70) return 5;   // ~600 cities
    return 6;                        // all ~1,000 cities
  }, [zoomLevel]);

  const visibleCities = useMemo(() => {
    return allCities.filter((c) => c.scaleRank <= maxScaleRank);
  }, [allCities, maxScaleRank]);

  const countriesOnly = useMemo(() => {
    return countries.length > 0 ? countries : [];
  }, [countries]);

  const withStates = useMemo(() => {
    if (countries.length === 0) return [];
    if (subdivisions.length === 0) return countries;
    return [...countries, ...subdivisions];
  }, [countries, subdivisions]);

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
    setShowGallery(false);
  }, [activeFriendId]);

  const handlePolygonClick = useCallback(
    (polygon: GeoJsonFeature) => {
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

  const handleClose = useCallback(() => {
    setSelectedId(null);
    setSelectedFeature(null);
    setSelectedCity(null);
    setShowGallery(false);
  }, []);

  // --- Derive selected place info ---
  const selectedPlaceType: 'country' | 'state' | 'city' = selectedCity
    ? 'city'
    : selectedFeature?._isState
      ? 'state'
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

  // Load photos for the selected place
  useEffect(() => {
    if (!hasSelection) return;
    if (isFriendView) {
      loadFriendPhotos(selectedPlaceType, selectedPlaceId);
    } else if (user) {
      loadPhotos(selectedPlaceType, selectedPlaceId);
    }
  }, [hasSelection, isFriendView, user, selectedPlaceType, selectedPlaceId, loadPhotos, loadFriendPhotos]);

  // Friend info
  const activeFriendProfile = activeFriendId
    ? following.find((f) => f.following_id === activeFriendId)?.profile
    : null;
  const activeFriendName = activeFriendProfile
    ? activeFriendProfile.username || activeFriendProfile.display_name || activeFriendProfile.email || 'Friend'
    : null;

  // Which photos/counts to show depends on mode
  const panelPhotos = isFriendView ? friendPhotos : photos;
  const panelPhotosLoading = isFriendView ? friendPhotosLoading : photosLoading;

  // Globe data: show friend's visited IDs when in friend view, otherwise own
  const globeVisitedIds = isFriendView ? friendVisitedIds : visitedIds;
  const globeVisitedVersion = isFriendView ? friendVersion : visitedVersion;

  const handlePhotoUpload = useCallback(
    (file: File) => uploadPhoto(selectedPlaceType, selectedPlaceId, file),
    [uploadPhoto, selectedPlaceType, selectedPlaceId],
  );

  const handleMarkVisited = useCallback(async (notes: string): Promise<boolean> => {
    return markVisited(selectedPlaceType, selectedPlaceId, selectedPlaceName, notes);
  }, [markVisited, selectedPlaceType, selectedPlaceId, selectedPlaceName]);

  const handleRemoveVisited = useCallback(async () => {
    await removeVisited(selectedPlaceType, selectedPlaceId);
  }, [removeVisited, selectedPlaceType, selectedPlaceId]);

  const handleNotesChange = useCallback(
    async (notes: string): Promise<boolean> => {
      return updateNotes(selectedPlaceType, selectedPlaceId, notes);
    },
    [updateNotes, selectedPlaceType, selectedPlaceId],
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
      />
      <SearchBar
        cities={allCities}
        polygons={polygons}
        onSelectCity={handleSearchSelectCity}
        onSelectPolygon={handleSearchSelectPolygon}
        onFlyTo={handleFlyTo}
      />
      <ZoomIndicator level={zoomLevel} />

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

      {!user && <AuthOverlay onSignIn={signIn} onSignUp={signUp} />}
      {user && (
        <>
          <UserIndicator
            email={user.email ?? ''}
            profile={profile}
            onSignOut={signOut}
            onEditProfile={() => setShowProfileEditor(true)}
          />
          <FriendsPanel
            following={following}
            followers={followers}
            loading={friendsLoading}
            onSearchUsers={searchUsers}
            onFollow={follow}
            onUnfollow={unfollow}
            isFollowing={isFollowing}
            onOpenChange={setFriendsPanelOpen}
            onViewProfile={setViewingProfileId}
          />
          {/* Friend overlay selector — hidden when panels are open */}
          {!friendsPanelOpen && !showGallery && (
            <FriendOverlay
              following={following}
              activeFriendId={activeFriendId}
              loadingPlaces={friendLoadingPlaces}
              onSelectFriend={loadFriendPlaces}
              onClear={clearFriend}
            />
          )}
        </>
      )}

      {hasSelection && (
        isFriendView ? (
          // Friend view: read-only panel with friend's data
          <CountryPanel
            country={selectedFeature}
            city={selectedCity}
            visitedData={selectedVisitedData}
            isLoggedIn={Boolean(user)}
            onMarkVisited={async () => false}
            onRemoveVisited={() => {}}
            onNotesChange={async () => false}
            onClose={handleClose}
            photoCount={panelPhotos.length}
            onOpenGallery={() => setShowGallery(true)}
            friendViewMode={true}
            friendName={activeFriendName}
          />
        ) : (
          // Own map: editable panel
          <CountryPanel
            country={selectedFeature}
            city={selectedCity}
            visitedData={selectedVisitedData}
            isLoggedIn={Boolean(user)}
            onMarkVisited={handleMarkVisited}
            onRemoveVisited={handleRemoveVisited}
            onNotesChange={handleNotesChange}
            onClose={handleClose}
            photoCount={panelPhotos.length}
            onOpenGallery={() => setShowGallery(true)}
          />
        )
      )}

      {showGallery && hasSelection && (
        <PhotoGallery
          countryName={isFriendView ? `${activeFriendName} — ${selectedPlaceName}` : selectedPlaceName}
          photos={panelPhotos}
          loading={panelPhotosLoading}
          uploading={isFriendView ? false : photosUploading}
          onUpload={isFriendView ? async () => false : handlePhotoUpload}
          onDelete={isFriendView ? async () => false : deletePhoto}
          onClose={() => setShowGallery(false)}
        />
      )}

      {showProfileEditor && profile && (
        <ProfileEditor
          profile={profile}
          saving={profileSaving}
          onSave={updateProfile}
          onUploadAvatar={uploadAvatar}
          onClose={() => setShowProfileEditor(false)}
        />
      )}

      {viewingProfileId && (
        <ProfileView
          userId={viewingProfileId}
          isFollowing={isFollowing(viewingProfileId)}
          onFollow={follow}
          onUnfollow={unfollow}
          onClose={() => setViewingProfileId(null)}
        />
      )}
    </>
  );
}

// --- Styles for the friend view banner ---
const friendBannerStyles: Record<string, React.CSSProperties> = {
  banner: {
    position: 'fixed',
    bottom: '1rem',
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
