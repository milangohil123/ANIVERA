/**
 * Centralized Google Maps compatibility wrapper.
 * Forwards to GoogleMapViewer with full boundary polygon and vaccination coverage capabilities.
 */
export { GoogleMapViewer as InteractiveBotadMap } from './GoogleMapViewer';
export type {
  GoogleMapViewerProps as InteractiveBotadMapProps,
  MapLayerMode,
  ProcessedVillageLocation as ProcessedVillage,
} from './GoogleMapViewer';
