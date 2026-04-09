import { useState, useMemo } from 'react';

interface AchievementsProps {
  /** Number of UN-member countries the user has visited */
  countryCount: number;
  /** Number of distinct continents the user has visited */
  continentCount: number;
}

// --- Tier thresholds ---
const WORLD_THRESHOLDS = [1, 5, 15, 30, 50];
const CONTINENT_THRESHOLDS = [1, 2, 4, 6, 7];

// --- Color palettes (from the original HTML) ---
const WORLD_PALETTE = {
  l: '#FAEEDA', m1: '#FAC775', m2: '#EF9F27', b: '#BA7517',
  d: '#633806', bg: '#412402', ls: '#EF9F27', lr: '#FAC775', la: '#EF9F27',
};
const CONTINENT_PALETTE = {
  l: '#E1F5EE', m1: '#9FE1CB', m2: '#1D9E75', b: '#0F6E56',
  d: '#085041', bg: '#04342C', ls: '#1D9E75', lr: '#9FE1CB', la: '#1D9E75',
};

type Palette = typeof WORLD_PALETTE;

interface CategoryConfig {
  id: string;
  name: string;
  dotColor: string;
  accentColor: string;
  tagBg: string;
  tagColor: string;
  palette: Palette;
  tierNames: string[];
  tierReqs: string[];
  thresholds: number[];
}

const CATEGORIES: CategoryConfig[] = [
  {
    id: 'w', name: 'World Traveler',
    dotColor: '#BA7517', accentColor: '#EF9F27',
    tagBg: 'rgba(186,117,23,.18)', tagColor: '#EF9F27',
    palette: WORLD_PALETTE,
    tierNames: ['Wanderer', 'Explorer', 'Adventurer', 'Pathfinder', 'World Citizen'],
    tierReqs: ['1 country', '5 countries', '15 countries', '30 countries', '50 countries'],
    thresholds: WORLD_THRESHOLDS,
  },
  {
    id: 'c', name: 'Continents',
    dotColor: '#0F6E56', accentColor: '#1D9E75',
    tagBg: 'rgba(15,110,86,.18)', tagColor: '#1D9E75',
    palette: CONTINENT_PALETTE,
    tierNames: ['Local', 'Bi-coastal', 'Globetrotter', 'World Span', 'Full Lap'],
    tierReqs: ['1 continent', '2 continents', '4 continents', '6 continents', '7 continents'],
    thresholds: CONTINENT_THRESHOLDS,
  },
];

/** Determine which tier is unlocked and progress toward the next */
function computeProgress(count: number, thresholds: number[]) {
  let currentTier = -1;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (count >= thresholds[i]) { currentTier = i; break; }
  }
  const nextThreshold = currentTier < 4 ? thresholds[currentTier + 1] : thresholds[4];
  const progress = currentTier === 4 ? nextThreshold : count;
  return { currentTier, progress, nextThreshold };
}

// --- SVG Badge Generator (exact replica of the HTML version) ---

function Badge({ tier, palette, size, locked }: {
  tier: number; palette: Palette; size: number; locked: boolean;
}) {
  const f0 = locked ? '#1a1d26' : palette.l;
  const f1 = locked ? '#20222e' : palette.m1;
  const s0 = locked ? '#2a2c38' : palette.b;
  const s1 = locked ? '#24263a' : palette.m2;
  const dt = locked ? '#2a2c38' : palette.d;
  const lbg = locked ? '#111318' : palette.bg;
  const lst = locked ? '#222430' : palette.ls;
  const lr = locked ? '#1e2030' : palette.lr;
  const la = locked ? '#222430' : palette.la;

  let content: React.ReactNode;

  if (tier === 0) {
    content = (
      <>
        <circle r={28} fill={f0} stroke={s0} strokeWidth={1.5} />
        <circle r={19} fill="none" stroke={s1} strokeWidth={0.75} strokeDasharray="4,3" />
      </>
    );
  } else if (tier === 1) {
    content = (
      <>
        <polygon points="0,-28 24.2,-14 24.2,14 0,28 -24.2,14 -24.2,-14" fill={f0} stroke={s0} strokeWidth={1.5} />
        <circle r={18} fill="none" stroke={s1} strokeWidth={0.75} />
        <line x1={0} y1={-28} x2={0} y2={-31} stroke={s0} strokeWidth={1.2} />
        <line x1={24.2} y1={-14} x2={26.8} y2={-15.5} stroke={s0} strokeWidth={1.2} />
        <line x1={24.2} y1={14} x2={26.8} y2={15.5} stroke={s0} strokeWidth={1.2} />
        <line x1={0} y1={28} x2={0} y2={31} stroke={s0} strokeWidth={1.2} />
        <line x1={-24.2} y1={14} x2={-26.8} y2={15.5} stroke={s0} strokeWidth={1.2} />
        <line x1={-24.2} y1={-14} x2={-26.8} y2={-15.5} stroke={s0} strokeWidth={1.2} />
      </>
    );
  } else if (tier === 2) {
    const d8: [number, number][] = [[0,-28],[19.8,-19.8],[28,0],[19.8,19.8],[0,28],[-19.8,19.8],[-28,0],[-19.8,-19.8]];
    content = (
      <>
        <polygon
          points="0,-28 6.5,-15.7 19.8,-19.8 15.7,-6.5 28,0 15.7,6.5 19.8,19.8 6.5,15.7 0,28 -6.5,15.7 -19.8,19.8 -15.7,6.5 -28,0 -15.7,-6.5 -19.8,-19.8 -6.5,-15.7"
          fill={f1} stroke={s0} strokeWidth={1.5}
        />
        <circle r={15} fill="none" stroke={s1} strokeWidth={0.75} />
        {d8.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2.5} fill={dt} />
        ))}
      </>
    );
  } else if (tier === 3) {
    const d12: [number, number][] = [[0,-28],[14,-24.2],[24.2,-14],[28,0],[24.2,14],[14,24.2],[0,28],[-14,24.2],[-24.2,14],[-28,0],[-24.2,-14],[-14,-24.2]];
    content = (
      <>
        <polygon
          points="0,-28 4.9,-18.3 14,-24.2 13.4,-13.4 24.2,-14 18.3,-4.9 28,0 18.3,4.9 24.2,14 13.4,13.4 14,24.2 4.9,18.3 0,28 -4.9,18.3 -14,24.2 -13.4,13.4 -24.2,14 -18.3,4.9 -28,0 -18.3,-4.9 -24.2,-14 -13.4,-13.4 -14,-24.2 -4.9,-18.3"
          fill={f0} stroke={s0} strokeWidth={1.5}
        />
        <circle r={17} fill={f1} stroke={s0} strokeWidth={0.75} />
        <circle r={11} fill="none" stroke={s1} strokeWidth={0.75} strokeDasharray="3,2" />
        {d12.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2} fill={s0} />
        ))}
      </>
    );
  } else {
    // Tier 4 — the top-tier badge
    const tk: [number, number, number, number][] = [
      [0,-22,0,-26],[15.6,-15.6,18.4,-18.4],[22,0,26,0],[15.6,15.6,18.4,18.4],
      [0,22,0,26],[-15.6,15.6,-18.4,18.4],[-22,0,-26,0],[-15.6,-15.6,-18.4,-18.4],
    ];
    content = (
      <>
        <circle r={28} fill={lbg} stroke={la} strokeWidth={1.75} />
        <circle r={22} fill="none" stroke={lr} strokeWidth={0.75} />
        {tk.map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={lr} strokeWidth={1.5} />
        ))}
        <polygon
          points="0,-20 5,-12 14.1,-14.1 12,-5 20,0 12,5 14.1,14.1 5,12 0,20 -5,12 -14.1,14.1 -12,5 -20,0 -12,-5 -14.1,-14.1 -5,-12"
          fill={lst} stroke={lr} strokeWidth={0.75}
        />
        <circle r={10} fill={lbg} stroke={lr} strokeWidth={0.75} />
      </>
    );
  }

  return (
    <svg viewBox="-32 -32 64 64" width={size} height={size} style={{ display: 'block' }}>
      {content}
    </svg>
  );
}

// --- Main component ---

export default function Achievements({ countryCount, continentCount }: AchievementsProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  const categoryData = useMemo(() => {
    const counts: Record<string, number> = { w: countryCount, c: continentCount };
    return CATEGORIES.map((cat) => {
      const { currentTier, progress, nextThreshold } = computeProgress(counts[cat.id], cat.thresholds);
      return { ...cat, currentTier, progress, nextThreshold };
    });
  }, [countryCount, continentCount]);

  const totalEarned = categoryData.reduce(
    (sum, c) => sum + (c.currentTier + 1),
    0,
  );

  const handleToggle = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <div style={styles.container}>
      <h3 style={styles.heading}>Achievements</h3>
      <p style={styles.subheading}>{totalEarned} of 10 badges earned</p>

      <div style={styles.cards}>
        {categoryData.map((cat) => {
          const isOpen = openId === cat.id;
          const currentName = cat.currentTier >= 0 ? cat.tierNames[cat.currentTier] : 'Locked';
          const nextName = cat.currentTier >= 0 && cat.currentTier < 4
            ? cat.tierNames[cat.currentTier + 1]
            : cat.currentTier === 4 ? 'Max tier' : cat.tierNames[0];
          const pct = cat.currentTier === 4
            ? 100
            : cat.nextThreshold > 0 ? Math.round((cat.progress / cat.nextThreshold) * 100) : 0;
          const progStr = `${cat.progress} / ${cat.nextThreshold}`;

          return (
            <div
              key={cat.id}
              style={{
                ...styles.card,
                borderColor: isOpen ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.07)',
              }}
              onClick={() => handleToggle(cat.id)}
            >
              {/* Card header */}
              <div style={styles.cardHead}>
                <div style={{ ...styles.dot, background: cat.dotColor }} />
                <div style={styles.cardName}>{cat.name}</div>
                <div style={{ ...styles.tag, background: cat.tagBg, color: cat.tagColor }}>
                  {currentName}
                </div>
              </div>

              {/* Badge strip */}
              <div style={styles.badgeStrip}>
                {[0, 1, 2, 3, 4].map((i) => {
                  const locked = i > cat.currentTier;
                  const isCurrent = i === cat.currentTier;
                  return (
                    <div
                      key={i}
                      style={{
                        ...styles.badgeWrap,
                        borderColor: isCurrent ? cat.accentColor : 'transparent',
                      }}
                    >
                      <Badge tier={i} palette={cat.palette} size={42} locked={locked} />
                    </div>
                  );
                })}
              </div>

              {/* Progress bar */}
              <div style={styles.progressRow}>
                <div style={styles.progressLabels}>
                  <span style={styles.progressLabel}>{'\u2192'} {nextName}</span>
                  <span style={styles.progressLabel}>{progStr} · {pct}%</span>
                </div>
                <div style={styles.progressBar}>
                  <div style={{ ...styles.progressFill, width: `${pct}%`, background: cat.accentColor }} />
                </div>
              </div>

              {/* Expandable tier detail */}
              {isOpen && (
                <div style={styles.tierDetail}>
                  <div style={styles.tierSep} />
                  {[0, 1, 2, 3, 4].map((i) => {
                    const earned = i <= cat.currentTier;
                    const locked = i > cat.currentTier;
                    const isNext = i === cat.currentTier + 1;
                    return (
                      <div key={i} style={{ ...styles.tierItem, opacity: earned ? 1 : 0.22 }}>
                        <div style={{ flexShrink: 0 }}>
                          <Badge tier={i} palette={cat.palette} size={52} locked={locked} />
                        </div>
                        <div style={styles.tierInfo}>
                          <div style={styles.tierName}>{cat.tierNames[i]}</div>
                          <div style={styles.tierReq}>{cat.tierReqs[i]}</div>
                        </div>
                        <div style={{
                          ...styles.tierCheck,
                          ...(earned ? styles.tierCheckDone : {}),
                        }}>
                          {earned ? '\u2713' : isNext ? '+' : '\u00B7'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
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
    margin: '0 0 0.2rem',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: '0.03em',
  },
  subheading: {
    margin: '0 0 0.75rem',
    fontSize: '0.72rem',
    color: 'rgba(255, 255, 255, 0.32)',
  },
  cards: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  card: {
    background: 'rgba(255,255,255,0.045)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '16px',
    cursor: 'pointer',
    transition: 'border-color 0.2s',
  },
  cardHead: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 14px 8px',
    gap: '9px',
  },
  dot: {
    width: '9px',
    height: '9px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  cardName: {
    color: '#fff',
    fontSize: '13px',
    fontWeight: 500,
    flex: 1,
  },
  tag: {
    fontSize: '11px',
    padding: '2px 7px',
    borderRadius: '20px',
    fontWeight: 500,
  },
  badgeStrip: {
    display: 'flex',
    gap: '5px',
    padding: '2px 14px 10px',
  },
  badgeWrap: {
    borderRadius: '50%',
    flexShrink: 0,
    border: '2.5px solid transparent',
    display: 'flex',
  },
  progressRow: {
    padding: '0 14px 12px',
  },
  progressLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '5px',
  },
  progressLabel: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.35)',
  },
  progressBar: {
    height: '2.5px',
    background: 'rgba(255,255,255,0.08)',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: '2px',
    transition: 'width 0.3s ease',
  },
  tierDetail: {
    padding: '0 14px 12px',
  },
  tierSep: {
    height: '1px',
    background: 'rgba(255,255,255,0.06)',
    marginBottom: '10px',
  },
  tierItem: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    padding: '5px 0',
  },
  tierInfo: {
    flex: 1,
    minWidth: 0,
  },
  tierName: {
    color: '#fff',
    fontSize: '13px',
    fontWeight: 500,
  },
  tierReq: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: '11px',
    marginTop: '1px',
  },
  tierCheck: {
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '9px',
    color: 'rgba(255,255,255,0.2)',
    flexShrink: 0,
    fontWeight: 500,
  },
  tierCheckDone: {
    background: 'rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.7)',
  },
};
