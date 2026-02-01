'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Tab {
  label: string;
  href: string;
  hideOnMobile?: boolean;
}

interface TabNavProps {
  tabs: Tab[];
}

function ManilaTab({
  label,
  href,
  isActive,
  hideOnMobile,
  width,
}: {
  label: string;
  href: string;
  isActive: boolean;
  hideOnMobile?: boolean;
  width: number;
}) {
  const height = 34; // Fixed height for all tabs

  return (
    <Link
      href={href}
      className={`
        relative block
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
          fill={isActive ? '#FFF8F0' : '#f5f5f4'}
          stroke="#d3d3d3"
          strokeWidth="1.5"
        />
        {/* Hide bottom border for active tab */}
        {isActive && (
          <line
            x1="1"
            y1={height - 0.5}
            x2={width - 1}
            y2={height - 0.5}
            stroke="#FFF8F0"
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
    </Link>
  );
}

// Fixed widths for each tab label to prevent layout shifts
const TAB_WIDTHS: Record<string, number> = {
  'Events': 72,
  'Sources': 80,
  'Squiggles': 90,
  'Stats': 64,
};

export function TabNav({ tabs }: TabNavProps) {
  const pathname = usePathname();

  return (
    <div className="flex items-end h-[34px]">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href ||
          (tab.href === '/' && pathname === '/');

        return (
          <ManilaTab
            key={tab.href}
            label={tab.label}
            href={tab.href}
            isActive={isActive}
            hideOnMobile={tab.hideOnMobile}
            width={TAB_WIDTHS[tab.label] || 80}
          />
        );
      })}
    </div>
  );
}

// Pre-configured nav for the app
export function AppNav() {
  const tabs: Tab[] = [
    { label: 'Events', href: '/' },
    { label: 'Sources', href: '/sources' },
    { label: 'Squiggles', href: '/squiggles', hideOnMobile: true },
    { label: 'Stats', href: '/stats', hideOnMobile: true },
  ];

  return <TabNav tabs={tabs} />;
}
