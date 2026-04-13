import { memo } from 'react';

export type TabId = 'globe' | 'friends' | 'feed' | 'profile';

interface TabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const TABS: TabId[] = ['globe', 'feed', 'friends', 'profile'];

/** Reusable helper — returns the active or inactive colour for a tab */
function tabColor(active: boolean): string {
  return active ? 'rgba(140, 200, 255, 1)' : 'rgba(255, 255, 255, 0.55)';
}

function TabBar({ activeTab, onTabChange }: TabBarProps) {
  const activeIndex = TABS.indexOf(activeTab);
  // Position the sliding dot indicator: each tab occupies 1/3 of the usable
  // width; the dot sits centered beneath the active tab's icon.
  const indicatorLeft = `calc(${(activeIndex + 0.5) * (100 / TABS.length)}% - 3px)`;

  return (
    <nav style={styles.bar}>
      {/* Animated dot indicator that slides between tabs */}
      <span
        aria-hidden
        style={{
          ...styles.indicator,
          left: indicatorLeft,
        }}
      />

      <button
        className="btn-press"
        style={{
          ...styles.tab,
          ...(activeTab === 'globe' ? styles.tabActive : {}),
        }}
        onClick={() => onTabChange('globe')}
        aria-label="Globe"
      >
        {/* Globe icon */}
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke={tabColor(activeTab === 'globe')}
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          style={activeTab === 'globe' ? styles.activeIcon : undefined}
        >
          <path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0z" />
          <path d="M3.6 9h16.8" />
          <path d="M3.6 15h16.8" />
          <path d="M12 3a15.3 15.3 0 0 1 4 9 15.3 15.3 0 0 1-4 9 15.3 15.3 0 0 1-4-9 15.3 15.3 0 0 1 4-9z" />
        </svg>
        <span style={{ ...styles.tabLabel, color: tabColor(activeTab === 'globe') }}>
          Globe
        </span>
      </button>

      <button
        className="btn-press"
        style={{
          ...styles.tab,
          ...(activeTab === 'feed' ? styles.tabActive : {}),
        }}
        onClick={() => onTabChange('feed')}
        aria-label="Feed"
      >
        {/* Feed / activity icon — stacked content lines */}
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke={tabColor(activeTab === 'feed')}
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          style={activeTab === 'feed' ? styles.activeIcon : undefined}
        >
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="14" y2="18" />
          <circle cx="18" cy="18" r="2" />
        </svg>
        <span style={{ ...styles.tabLabel, color: tabColor(activeTab === 'feed') }}>
          Feed
        </span>
      </button>

      <button
        className="btn-press"
        style={{
          ...styles.tab,
          ...(activeTab === 'friends' ? styles.tabActive : {}),
        }}
        onClick={() => onTabChange('friends')}
        aria-label="Friends"
      >
        {/* People/group icon */}
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke={tabColor(activeTab === 'friends')}
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          style={activeTab === 'friends' ? styles.activeIcon : undefined}
        >
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        <span style={{ ...styles.tabLabel, color: tabColor(activeTab === 'friends') }}>
          Friends
        </span>
      </button>

      <button
        className="btn-press"
        style={{
          ...styles.tab,
          ...(activeTab === 'profile' ? styles.tabActive : {}),
        }}
        onClick={() => onTabChange('profile')}
        aria-label="Profile"
      >
        {/* Person icon */}
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke={tabColor(activeTab === 'profile')}
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          style={activeTab === 'profile' ? styles.activeIcon : undefined}
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <span style={{ ...styles.tabLabel, color: tabColor(activeTab === 'profile') }}>
          Profile
        </span>
      </button>
    </nav>
  );
}

const TAB_BAR_HEIGHT = 42;

// Export so other components can account for the tab bar height
export { TAB_BAR_HEIGHT };

export default memo(TabBar);

const styles: Record<string, React.CSSProperties> = {
  bar: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: `calc(${TAB_BAR_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    background: 'rgba(14, 16, 30, 0.72)',
    backdropFilter: 'blur(28px) saturate(160%)',
    WebkitBackdropFilter: 'blur(28px) saturate(160%)',
    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
    zIndex: 2000,
    padding: '0 2rem',
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
  },
  // Sliding dot beneath the active tab
  indicator: {
    position: 'absolute',
    top: '3px',
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: 'rgba(140, 200, 255, 0.95)',
    boxShadow: '0 0 10px rgba(140, 200, 255, 0.7)',
    transition: 'left 280ms cubic-bezier(0.4, 0, 0.2, 1)',
    pointerEvents: 'none',
  },
  tab: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '8px 0 4px',
    fontFamily: 'inherit',
    maxWidth: '120px',
  },
  tabActive: {
    // Active state is conveyed via indicator dot + activeIcon glow + label color
  },
  // Soft glow applied to the active SVG icon for a brightness boost
  activeIcon: {
    filter: 'drop-shadow(0 0 6px rgba(140, 200, 255, 0.55))',
  },
  tabLabel: {
    fontSize: '0.65rem',
    fontWeight: 500,
    letterSpacing: '0.02em',
    transition: 'color 220ms ease-out',
  },
};
