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
}: {
  label: string;
  href: string;
  isActive: boolean;
  hideOnMobile?: boolean;
}) {
  const width = label.length * 10 + 32; // Approximate width based on label
  const height = 32;

  return (
    <Link
      href={href}
      className={`
        relative block
        ${hideOnMobile ? 'hidden md:block' : ''}
        ${isActive ? 'z-10' : 'z-0'}
      `}
      style={{
        marginRight: '-6px', // Overlap tabs slightly
        marginBottom: isActive ? '-2px' : '0',
      }}
    >
      <svg
        width={width}
        height={height + (isActive ? 2 : 0)}
        viewBox={`0 0 ${width} ${height + (isActive ? 2 : 0)}`}
        className="block"
      >
        {/* Tab shape */}
        <path
          d={`
            M 0 ${height + (isActive ? 2 : 0)}
            L 6 4
            Q 8 0 14 0
            L ${width - 14} 0
            Q ${width - 8} 0 ${width - 6} 4
            L ${width} ${height + (isActive ? 2 : 0)}
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
            y1={height + 1}
            x2={width - 1}
            y2={height + 1}
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
        style={{
          paddingBottom: isActive ? '2px' : '0',
        }}
      >
        {label}
      </span>
    </Link>
  );
}

export function TabNav({ tabs }: TabNavProps) {
  const pathname = usePathname();

  return (
    <div className="flex items-end">
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
