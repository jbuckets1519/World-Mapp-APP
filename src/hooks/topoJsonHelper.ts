/**
 * Minimal TopoJSON → GeoJSON converter.
 * Avoids pulling in the full topojson-client library (~15KB) for a simple decode.
 */

interface Topology {
  type: 'Topology';
  arcs: number[][][];
  objects: Record<string, { type: string; geometries: TopoGeometry[] }>;
  transform?: {
    scale: [number, number];
    translate: [number, number];
  };
}

interface TopoGeometry {
  type: string;
  arcs: number[] | number[][] | number[][][];
  properties?: Record<string, unknown>;
  id?: string | number;
}

/**
 * Decode a TopoJSON topology into GeoJSON features for a given object key.
 */
export function topojsonFeature(
  topology: Topology,
  objectKey: string,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): any[] {
  const obj = topology.objects[objectKey];
  if (!obj) throw new Error(`Object "${objectKey}" not found in TopoJSON`);

  return obj.geometries.map((geom) => ({
    type: 'Feature' as const,
    properties: geom.properties || { name: String(geom.id ?? 'Unknown') },
    geometry: decodeGeometry(topology, geom),
  }));
}

function decodeGeometry(
  topology: Topology,
  geom: TopoGeometry,
): { type: string; coordinates: number[][][] | number[][][][] } {
  switch (geom.type) {
    case 'Polygon':
      return {
        type: 'Polygon',
        coordinates: (geom.arcs as number[][]).map((ring) =>
          decodeRing(topology, ring),
        ),
      };
    case 'MultiPolygon':
      return {
        type: 'MultiPolygon',
        coordinates: (geom.arcs as number[][][]).map((polygon) =>
          polygon.map((ring) => decodeRing(topology, ring)),
        ),
      };
    default:
      // Fallback for other geometry types — return empty polygon
      return { type: 'Polygon', coordinates: [] };
  }
}

/**
 * Decode a ring of arc indices into an array of [lng, lat] coordinates.
 */
function decodeRing(topology: Topology, arcIndices: number[]): number[][] {
  const coords: number[][] = [];

  for (const arcIndex of arcIndices) {
    // Negative index means the arc is reversed
    const reversed = arcIndex < 0;
    const idx = reversed ? ~arcIndex : arcIndex;
    const arc = topology.arcs[idx];

    let points: number[][];
    if (topology.transform) {
      // Quantized topology — delta-encoded coordinates
      points = dequantize(arc, topology.transform);
    } else {
      points = arc;
    }

    if (reversed) points = [...points].reverse();

    // Skip the first point of subsequent arcs (it's the same as the last point of the previous)
    const start = coords.length > 0 ? 1 : 0;
    for (let i = start; i < points.length; i++) {
      coords.push(points[i]);
    }
  }

  return coords;
}

/**
 * Dequantize delta-encoded arc coordinates.
 */
function dequantize(
  arc: number[][],
  transform: { scale: [number, number]; translate: [number, number] },
): number[][] {
  const { scale, translate } = transform;
  const result: number[][] = [];
  let x = 0;
  let y = 0;

  for (const point of arc) {
    x += point[0];
    y += point[1];
    result.push([x * scale[0] + translate[0], y * scale[1] + translate[1]]);
  }

  return result;
}
