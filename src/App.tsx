import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

import { Globe } from './components/Globe';
import type { GlobeHandle } from './components/Globe';
import { getPolygonId } from './components/Globe/Globe';
import { CountryPanel } from './components/CountryPanel';
import PhotoGallery from './components/CountryPanel/PhotoGallery';
import { ZoomIndicator } from './components/ZoomIndicator';
import { SearchBar } from './components/SearchBar';
import { FriendsPanel, FriendOverlay } from './components/Friends';
import { AuthOverlay, UserIndicator, ProfileEditor } from './components/Auth';
import { useGlobeConfig } from './hooks/useGlobeConfig';
import { useAuth } from './hooks/useAuth';
import { useTravelData } from './hooks/useTravelData';
import { useTravelPhotos } from './hooks/useTravelPhotos';
import { useFriends } from './hooks/useFriends';
import { useFriendData } from './hooks/useFriendData';
import { useProfile } from './hooks/useProfile';
import { CITIES } from './data/cities';
import type { GeoJsonFeature, CityPoint } from './types';

// Pre-compute city points with stable IDs
const CITY_POINTS: CityPoint[] = CITIES.map((c) => ({
  ...c,
  id: `city:${c.name}`,
}));

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
  const { countries, subdivisions, loading: globeLoading, error: globeError } = useGlobeConfig();
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
    searchByEmail,
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
  const [showFriendGallery, setShowFriendGallery] = useState(false);
  const [friendsPanelOpen, setFriendsPanelOpen] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);

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
      // Clear city selection when a polygon is clicked
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
      // Clear polygon selection when a city is clicked
      setSelectedFeature(null);
    },
    [selectedId],
  );

  // Search result handlers — select the item and let the SearchBar fly the camera
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
    setShowFriendGallery(false);
  }, []);

  // Derive place type and ID from whichever item is selected (polygon or city)
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
  const selectedVisitedData = hasSelection
    ? getPlace(selectedPlaceType, selectedPlaceId)
    : undefined;

  // Load photos whenever the selected place changes
  useEffect(() => {
    if (hasSelection && user) {
      loadPhotos(selectedPlaceType, selectedPlaceId);
    }
  }, [hasSelection, user, selectedPlaceType, selectedPlaceId, loadPhotos]);

  // Load friend's photos for the selected place when friend overlay is active
  useEffect(() => {
    if (hasSelection && activeFriendId) {
      loadFriendPhotos(selectedPlaceType, selectedPlaceId);
    }
  }, [hasSelection, activeFriendId, selectedPlaceType, selectedPlaceId, loadFriendPhotos]);

  // Derive friend info for CountryPanel
  const activeFriendProfile = activeFriendId
    ? following.find((f) => f.following_id === activeFriendId)?.profile
    : null;
  const activeFriendName = activeFriendProfile
    ? activeFriendProfile.display_name || activeFriendProfile.email || 'Friend'
    : null;
  const selectedFriendVisitedData = hasSelection && activeFriendId
    ? getFriendPlace(selectedPlaceType, selectedPlaceId)
    : undefined;

  const handlePhotoUpload = useCallback(
    (file: File) => uploadPhoto(selectedPlaceType, selectedPlaceId, file),
    [uploadPhoto, selectedPlaceType, selectedPlaceId],
  );

  const handleMarkVisited = useCallback(async (notes: string): Promise<boolean> => {
    console.log('[App] handleMarkVisited →', { selectedPlaceType, selectedPlaceId, selectedPlaceName, notes });
    return markVisited(selectedPlaceType, selectedPlaceId, selectedPlaceName, notes);
  }, [markVisited, selectedPlaceType, selectedPlaceId, selectedPlaceName]);

  const handleRemoveVisited = useCallback(async () => {
    console.log('[App] handleRemoveVisited →', { selectedPlaceType, selectedPlaceId });
    await removeVisited(selectedPlaceType, selectedPlaceId);
  }, [removeVisited, selectedPlaceType, selectedPlaceId]);

  const handleNotesChange = useCallback(
    async (notes: string): Promise<boolean> => {
      console.log('[App] handleNotesChange →', { selectedPlaceType, selectedPlaceId, notes });
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
        cities={CITY_POINTS}
        selectedId={selectedId}
        visitedIds={visitedIds}
        friendVisitedIds={friendVisitedIds}
        visitedVersion={visitedVersion}
        friendVersion={friendVersion}
        zoomLevel={zoomLevel}
        width={dimensions.width}
        height={dimensions.height}
        onPolygonClick={handlePolygonClick}
        onCityClick={handleCityClick}
        onZoomChange={handleZoomChange}
      />
      <SearchBar
        cities={CITY_POINTS}
        polygons={polygons}
        onSelectCity={handleSearchSelectCity}
        onSelectPolygon={handleSearchSelectPolygon}
        onFlyTo={handleFlyTo}
      />
      <ZoomIndicator level={zoomLevel} />

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
            onSearchEmail={searchByEmail}
            onFollow={follow}
            onUnfollow={unfollow}
            isFollowing={isFollowing}
            onOpenChange={setFriendsPanelOpen}
          />
          {!friendsPanelOpen && !showGallery && !showFriendGallery && (
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
        <CountryPanel
          country={selectedFeature}
          city={selectedCity}
          visitedData={selectedVisitedData}
          isLoggedIn={Boolean(user)}
          onMarkVisited={handleMarkVisited}
          onRemoveVisited={handleRemoveVisited}
          onNotesChange={handleNotesChange}
          onClose={handleClose}
          photoCount={photos.length}
          onOpenGallery={() => setShowGallery(true)}
          friendName={activeFriendName}
          friendVisitedData={selectedFriendVisitedData}
          friendPhotos={friendPhotos}
          friendPhotosLoading={friendPhotosLoading}
          onOpenFriendGallery={() => setShowFriendGallery(true)}
        />
      )}

      {showGallery && hasSelection && (
        <PhotoGallery
          countryName={selectedPlaceName}
          photos={photos}
          loading={photosLoading}
          uploading={photosUploading}
          onUpload={handlePhotoUpload}
          onDelete={deletePhoto}
          onClose={() => setShowGallery(false)}
        />
      )}

      {/* Friend's photo gallery — read-only (no upload/delete) */}
      {showFriendGallery && hasSelection && activeFriendName && (
        <PhotoGallery
          countryName={`${activeFriendName} — ${selectedPlaceName}`}
          photos={friendPhotos}
          loading={friendPhotosLoading}
          uploading={false}
          onUpload={async () => false}
          onDelete={async () => false}
          onClose={() => setShowFriendGallery(false)}
        />
      )}

      {/* Profile editor modal */}
      {showProfileEditor && profile && (
        <ProfileEditor
          profile={profile}
          saving={profileSaving}
          onSave={updateProfile}
          onUploadAvatar={uploadAvatar}
          onClose={() => setShowProfileEditor(false)}
        />
      )}
    </>
  );
}
