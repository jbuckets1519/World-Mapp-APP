export type TabId = 'globe' | 'friends' | 'profile';

interface TabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

/** Reusable helper — returns the active or inactive colour for a tab */
function tabColor(active: boolean): string {
  return active ? 'rgba(100, 180, 255, 0.95)' : 'rgba(255, 255, 255, 0.4)';
}

export default function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <nav style={styles.bar}>
      <button
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

const TAB_BAR_HEIGHT = 56;

// Export so other components can account for the tab bar height
export { TAB_BAR_HEIGHT };

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
    background: 'rgba(10, 10, 20, 0.95)',
    backdropFilter: 'blur(12px)',
    borderTop: '1px solid rgba(100, 180, 255, 0.12)',
    zIndex: 2000,
    padding: '0 2rem',
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
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
    padding: '6px 0',
    fontFamily: 'inherit',
    maxWidth: '120px',
  },
  tabActive: {
    // Active indicator handled via color on children
  },
  tabLabel: {
    fontSize: '0.65rem',
    fontWeight: 500,
    letterSpacing: '0.02em',
  },
};
