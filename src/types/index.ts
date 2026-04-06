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
