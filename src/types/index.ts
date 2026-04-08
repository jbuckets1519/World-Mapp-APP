// Types for GeoJSON data used by the globe

export interface GeoJsonFeature {
  type: 'Feature';
  properties: {
    NAME: string;
    ISO_A2: string;
    POP_EST: number;
    [key: string]: unknown;
  };
  geometry: {
    type: string;
    coordinates: number[][][] | number[][][][];
  };
  /** Marker added at load time so the globe can style states differently */
  _isState?: boolean;
}

export interface GeoJsonData {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

export interface City {
  name: string;
  country: string;
  lat: number;
  lng: number;
  population: number;
  isCapital: boolean;
}

/** City with a unique ID, used by the globe points layer and travel data */
export interface CityPoint extends City {
  id: string; // "city:Paris"
}

/** A user profile as returned from the profiles table */
export interface UserProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_public: boolean;
}

/** A follow relationship */
export interface FollowRelation {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
  /** Joined profile data for the other user */
  profile: UserProfile;
}
