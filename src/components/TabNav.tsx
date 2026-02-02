'use client';

import type { TabId } from '@/app/App';

interface Tab {
  label: string;
  id: TabId;
  hideOnMobile?: boolean;
}

interface TabNavProps {
  tabs: Tab[];
  onNavigate: (tab: TabId) => void;
  activeTab: TabId;
}

function ManilaTab({
  label,
  id,
  isActive,
  hideOnMobile,
  width,
  onNavigate,
}: {
  label: string;
  id: TabId;
  isActive: boolean;
  hideOnMobile?: boolean;
  width: number;
  onNavigate: (tab: TabId) => void;
}) {
  const height = 34; // Fixed height for all tabs

  return (
    <button
      onClick={() => onNavigate(id)}
      className={`
        relative block cursor-pointer
        ${hideOnMobile ? 'hidden md:block' : ''}
        ${isActive ? 'z-10' : 'z-0'}
      `}
      style={{
        width,
        height,
        marginRight: '-6px', // Overlap tabs slightly
      }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="absolute inset-0"
        preserveAspectRatio="none"
      >
        {/* Tab shape */}
        <path
          d={`
            M 0 ${height}
            L 6 4
            Q 8 0 14 0
            L ${width - 14} 0
            Q ${width - 8} 0 ${width - 6} 4
            L ${width} ${height}
            Z
          `}
          fill={isActive ? 'var(--color-background)' : '#f5f5f4'}
          stroke="var(--color-card-stroke)"
          strokeWidth="1.5"
        />
        {/* Hide bottom border for active tab */}
        {isActive && (
          <line
            x1="1"
            y1={height - 0.5}
            x2={width - 1}
            y2={height - 0.5}
            stroke="var(--color-background)"
            strokeWidth="3"
          />
        )}
      </svg>
      <span
        className={`
          absolute inset-0 flex items-center justify-center text-sm font-medium
          ${isActive ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'}
        `}
      >
        {label}
      </span>
    </button>
  );
}

// Fixed widths for each tab label to prevent layout shifts
const TAB_WIDTHS: Record<string, number> = {
  'Events': 72,
  'Sources': 80,
  'Squiggles': 90,
  'Colors': 72,
  'Stats': 64,
};

export function TabNav({ tabs, onNavigate, activeTab }: TabNavProps) {
  return (
    <div className="flex items-end h-[34px]">
      {tabs.map((tab) => (
        <ManilaTab
          key={tab.id}
          label={tab.label}
          id={tab.id}
          isActive={activeTab === tab.id}
          hideOnMobile={tab.hideOnMobile}
          width={TAB_WIDTHS[tab.label] || 80}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
}

// Pre-configured nav for the app
export function AppNav({ onNavigate, activeTab }: { onNavigate: (tab: TabId) => void; activeTab: TabId }) {
  const tabs: Tab[] = [
    { label: 'Events', id: 'events' },
    { label: 'Sources', id: 'sources' },
    { label: 'Squiggles', id: 'squiggles', hideOnMobile: true },
    { label: 'Colors', id: 'colors', hideOnMobile: true },
    { label: 'Stats', id: 'stats', hideOnMobile: true },
  ];

  return <TabNav tabs={tabs} onNavigate={onNavigate} activeTab={activeTab} />;
}
