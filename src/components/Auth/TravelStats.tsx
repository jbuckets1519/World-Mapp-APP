import { useMemo } from 'react';
import type { VisitedPlace } from '../../hooks/useTravelData';
import { COUNTRY_TO_CONTINENT, TOTAL_COUNTRIES, CONTINENTS } from '../../data/continents';
import type { Continent } from '../../data/continents';

interface TravelStatsProps {
  places: VisitedPlace[];
  photoCount: number;
}

/**
 * Displays travel statistics: countries, states, cities visited,
 * continent coverage, world percentage, and photo count.
 */
export default function TravelStats({ places, photoCount }: TravelStatsProps) {
  const stats = useMemo(() => {
    const countries = places.filter((p) => p.place_type === 'country');
    const states = places.filter((p) => p.place_type === 'state');
    const cities = places.filter((p) => p.place_type === 'city');

    // Determine which continents are covered by visited countries
    const visitedContinents = new Set<Continent>();
    for (const c of countries) {
      // place_id is "country:France" — extract the name after the prefix
      const name = c.place_id.replace(/^country:/, '');
      const continent = COUNTRY_TO_CONTINENT[name];
      if (continent) visitedContinents.add(continent);
    }

    const worldPercent = TOTAL_COUNTRIES > 0
      ? Math.round((countries.length / TOTAL_COUNTRIES) * 100)
      : 0;

    return {
      countryCount: countries.length,
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
        <StatTile label="Countries" value={stats.countryCount} />
        <StatTile label="States" value={stats.stateCount} />
        <StatTile label="Cities" value={stats.cityCount} />
        <StatTile label="Continents" value={`${stats.continentCount}/7`} />
        <StatTile label="World" value={`${stats.worldPercent}%`} />
        <StatTile label="Photos" value={photoCount} />
      </div>

      {stats.visitedContinents.length > 0 && (
        <div style={styles.continentSection}>
          <span style={styles.continentLabel}>Visited continents</span>
          <div style={styles.continentList}>
            {stats.visitedContinents.map((c) => (
              <span key={c} style={styles.continentTag}>{c}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={styles.tile}>
      <span style={styles.tileValue}>{value}</span>
      <span style={styles.tileLabel}>{label}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginTop: '1.25rem',
    paddingTop: '1.25rem',
    borderTop: '1px solid rgba(100, 180, 255, 0.1)',
  },
  heading: {
    margin: '0 0 0.75rem',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: '0.03em',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '0.5rem',
  },
  tile: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    padding: '0.6rem 0.25rem',
    background: 'rgba(255, 255, 255, 0.04)',
    borderRadius: '8px',
    border: '1px solid rgba(100, 180, 255, 0.08)',
  },
  tileValue: {
    fontSize: '1.15rem',
    fontWeight: 700,
    color: 'rgba(100, 180, 255, 0.9)',
    lineHeight: 1.2,
  },
  tileLabel: {
    fontSize: '0.65rem',
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: '0.2rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  },
  continentSection: {
    marginTop: '0.75rem',
  },
  continentLabel: {
    fontSize: '0.7rem',
    color: 'rgba(255, 255, 255, 0.35)',
  },
  continentList: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '0.35rem',
    marginTop: '0.35rem',
  },
  continentTag: {
    padding: '0.2rem 0.55rem',
    background: 'rgba(100, 180, 255, 0.1)',
    border: '1px solid rgba(100, 180, 255, 0.15)',
    borderRadius: '12px',
    fontSize: '0.7rem',
    color: 'rgba(100, 180, 255, 0.8)',
  },
};
