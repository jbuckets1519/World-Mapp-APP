import { useMemo } from 'react';
import type { VisitedPlace } from '../../hooks/useTravelData';
import { COUNTRY_TO_CONTINENT, CONTINENTS, CONTINENT_COLORS } from '../../data/continents';
import { isUNMember, TOTAL_UN_COUNTRIES } from '../../data/un-members';
import type { Continent } from '../../data/continents';

interface TravelStatsProps {
  places: VisitedPlace[];
  photoCount: number;
}

/**
 * Displays travel statistics: UN countries, territories, states, cities,
 * continent coverage, world percentage, and photo count.
 *
 * Classification uses the UN members list rather than stored place_type
 * so that older data (territories stored as 'country') is counted correctly.
 */
export default function TravelStats({ places, photoCount }: TravelStatsProps) {
  const stats = useMemo(() => {
    // Only count places actively marked as visited
    const active = places.filter((p) => p.is_visited !== false);
    const polygonPlaces = active.filter(
      (p) => p.place_type === 'country' || p.place_type === 'territory',
    );
    const states = active.filter((p) => p.place_type === 'state');
    const cities = active.filter((p) => p.place_type === 'city');

    // Split polygons into UN countries vs territories using the authoritative list
    const countries: VisitedPlace[] = [];
    const territories: VisitedPlace[] = [];
    for (const p of polygonPlaces) {
      // place_id is "country:France" or "territory:Greenland" — extract the name
      const name = p.place_id.replace(/^(country|territory):/, '');
      if (isUNMember(name)) {
        countries.push(p);
      } else {
        territories.push(p);
      }
    }

    // Determine which continents are covered by visited countries
    const visitedContinents = new Set<Continent>();
    for (const c of countries) {
      const name = c.place_id.replace(/^(country|territory):/, '');
      const continent = COUNTRY_TO_CONTINENT[name];
      if (continent) visitedContinents.add(continent);
    }

    const worldPercent = TOTAL_UN_COUNTRIES > 0
      ? Math.round((countries.length / TOTAL_UN_COUNTRIES) * 100)
      : 0;

    return {
      countryCount: countries.length,
      territoryCount: territories.length,
      stateCount: states.length,
      cityCount: cities.length,
      continentCount: visitedContinents.size,
      visitedContinents: CONTINENTS.filter((c) => visitedContinents.has(c)),
      worldPercent,
    };
  }, [places]);

  return (
    <div style={styles.container}>
      <h3 style={styles.heading}>Travel Stats</h3>

      <div style={styles.grid}>
        <StatTile label="Countries" value={`${stats.countryCount} / ${TOTAL_UN_COUNTRIES}`}
          tint="rgba(100, 160, 255, 0.06)" accent="rgba(100, 160, 255, 0.15)" />
        <StatTile label="Territories" value={stats.territoryCount}
          tint="rgba(180, 130, 255, 0.06)" accent="rgba(180, 130, 255, 0.15)" />
        <StatTile label="States" value={stats.stateCount}
          tint="rgba(80, 200, 120, 0.06)" accent="rgba(80, 200, 120, 0.15)" />
        <StatTile label="Cities" value={stats.cityCount}
          tint="rgba(255, 170, 60, 0.06)" accent="rgba(255, 170, 60, 0.15)" />
        <StatTile label="Continents" value={`${stats.continentCount}/7`}
          tint="rgba(240, 90, 90, 0.06)" accent="rgba(240, 90, 90, 0.15)" />
        <StatTile label="World" value={`${stats.worldPercent}%`}
          tint="rgba(255, 220, 80, 0.06)" accent="rgba(255, 220, 80, 0.15)" />
        <StatTile label="Photos" value={photoCount}
          tint="rgba(255, 160, 200, 0.06)" accent="rgba(255, 160, 200, 0.15)" />
      </div>

      {stats.visitedContinents.length > 0 && (
        <div style={styles.continentSection}>
          <span style={styles.continentLabel}>Visited continents</span>
          <div style={styles.continentList}>
            {stats.visitedContinents.map((c) => {
              const cc = CONTINENT_COLORS[c];
              return (
                <span key={c} style={{
                  ...styles.continentTag,
                  background: cc.bg,
                  borderColor: cc.primary,
                  color: cc.primary,
                }}>{c}</span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value, tint, accent }: {
  label: string; value: string | number; tint?: string; accent?: string;
}) {
  return (
    <div style={{
      ...styles.tile,
      ...(tint ? { background: tint } : {}),
      ...(accent ? { borderColor: accent } : {}),
    }}>
      <span style={styles.tileValue}>{value}</span>
      <span style={styles.tileLabel}>{label}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginTop: '2rem',
    paddingTop: '2rem',
    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
  },
  heading: {
    margin: '0 0 1.25rem',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '0.75rem',
  },
  tile: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '92px',
    padding: '0.9rem 0.5rem',
    background: 'rgba(255, 255, 255, 0.06)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderRadius: '18px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.15)',
  },
  tileValue: {
    fontSize: '1.5rem',
    fontWeight: 800,
    color: 'rgba(255, 255, 255, 0.92)',
    lineHeight: 1.1,
    letterSpacing: '-0.02em',
    // Prevent values like "21 / 194" from wrapping onto two lines
    whiteSpace: 'nowrap' as const,
  },
  tileLabel: {
    fontSize: '0.65rem',
    color: 'rgba(255, 255, 255, 0.45)',
    marginTop: '0.5rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    fontWeight: 500,
  },
  continentSection: {
    marginTop: '1.5rem',
  },
  continentLabel: {
    fontSize: '0.72rem',
    color: 'rgba(255, 255, 255, 0.45)',
    letterSpacing: '0.04em',
  },
  continentList: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '0.4rem',
    marginTop: '0.55rem',
  },
  continentTag: {
    padding: '0.3rem 0.75rem',
    background: 'rgba(100, 180, 255, 0.1)',
    border: '1px solid rgba(100, 180, 255, 0.18)',
    borderRadius: '999px',
    fontSize: '0.72rem',
    color: 'rgba(100, 180, 255, 0.85)',
    fontWeight: 500,
    transition: 'all 200ms ease-out',
  },
};
