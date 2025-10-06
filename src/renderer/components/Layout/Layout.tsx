
import React, { useEffect, useRef } from 'react';
import { cn } from '../../utils/cn';
import Button from '../Button';
import AudioPlayer from '../AudioPlayer';
import { useNavigationStore, AppView } from '../../store/navigationStore';
import { useAppStore } from '../../store/appStore';


const SidebarIcon: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg
    className="h-5 w-5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

const LibraryIcon: React.FC = () => (
  <SidebarIcon>
    <rect x="4" y="3" width="4" height="18" rx="1" />
    <rect x="10" y="3" width="4" height="18" rx="1" />
    <rect x="16" y="3" width="4" height="18" rx="1" />
  </SidebarIcon>
);

const EpisodesIcon: React.FC = () => (
  <SidebarIcon>
    <line x1="4" y1="6" x2="14" y2="6" />
    <line x1="4" y1="12" x2="14" y2="12" />
    <line x1="4" y1="18" x2="14" y2="18" />
    <circle cx="18" cy="6" r="1.5" />
    <circle cx="18" cy="12" r="1.5" />
    <circle cx="18" cy="18" r="1.5" />
  </SidebarIcon>
);

const PlayQueueIcon: React.FC = () => (
  <SidebarIcon>
    <line x1="4" y1="6" x2="12" y2="6" />
    <line x1="4" y1="12" x2="12" y2="12" />
    <line x1="4" y1="18" x2="12" y2="18" />
    <path d="M16 7l5 3-5 3z" />
  </SidebarIcon>
);

const CompletedIcon: React.FC = () => (
  <SidebarIcon>
    <circle cx="12" cy="12" r="9" />
    <path d="M9 12l2 2 4-4" />
  </SidebarIcon>
);

const SettingsIcon: React.FC = () => (
  <SidebarIcon>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
  </SidebarIcon>
);

const RssIcon: React.FC = () => (
  <SidebarIcon>
    <path d="M4 11a9 9 0 0 1 9 9" />
    <path d="M4 4a16 16 0 0 1 16 16" />
    <circle cx="5" cy="19" r="1.5" />
  </SidebarIcon>
);

export interface LayoutProps {
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  appVersion?: string;
  platform?: string;
  children?: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({
  isDarkMode,
  onToggleDarkMode,
  appVersion,
  platform,
  children,
}) => {
  const { currentView, setCurrentView } = useNavigationStore();
  const { sidebarCollapsed, toggleSidebar, setSidebarCollapsed } = useAppStore((state) => ({
    sidebarCollapsed: state.ui.sidebarCollapsed,
    toggleSidebar: state.toggleSidebar,
    setSidebarCollapsed: state.setSidebarCollapsed,
  }));
  const autoCollapseRef = useRef(false);

  useEffect(() => {
    const handleResize = () => {
      if (typeof window === 'undefined') {
        return;
      }
      const shouldCollapse = window.innerWidth < 1024;

      if (shouldCollapse && !sidebarCollapsed) {
        setSidebarCollapsed(true);
        autoCollapseRef.current = true;
        return;
      }

      if (!shouldCollapse && autoCollapseRef.current) {
        setSidebarCollapsed(false);
        autoCollapseRef.current = false;
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarCollapsed, setSidebarCollapsed]);


  const activeView = currentView === 'episode-detail' ? 'episodes' : currentView;

  const navigationItems: { id: AppView; label: string; icon: React.ReactNode }[] = [
    { id: 'subscriptions', label: 'All Podcasts', icon: <LibraryIcon /> },
    { id: 'episodes', label: 'All Episodes', icon: <EpisodesIcon /> },
    { id: 'play-queue', label: 'Play Queue', icon: <PlayQueueIcon /> },
    { id: 'completed', label: 'Completed', icon: <CompletedIcon /> },
  ];

  const settingsItems: { id: AppView; label: string; icon: React.ReactNode }[] = [
    { id: 'settings', label: 'Settings', icon: <SettingsIcon /> },
    { id: 'rss-tester', label: 'RSS Tester', icon: <RssIcon /> },
  ];

  const handleNavClick = (viewId: AppView) => {
    if (viewId === currentView) {
      return;
    }
    setCurrentView(viewId);
  };

  const renderNavButton = (
    item: { id: AppView; label: string; icon: React.ReactNode },
    isActive: boolean
  ) => (
    <button
      key={item.id}
      type="button"
      onClick={() => handleNavClick(item.id)}
      title={item.label}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex w-full items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
        sidebarCollapsed ? 'justify-center px-0' : 'justify-start',
        isActive
          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
      )}
    >
      <span
        className={cn(
          'flex items-center justify-center',
          sidebarCollapsed ? 'h-10 w-10' : 'mr-3'
        )}
      >
        {item.icon}
      </span>
      {!sidebarCollapsed && <span>{item.label}</span>}
    </button>
  );

  return (
    <div className="flex h-full flex-col bg-gray-50 dark:bg-gray-900">
      <div className="app-drag flex h-12 items-center justify-between border-b border-gray-200 bg-white px-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center space-x-3">
          <div className="w-16" />
        </div>
        <div className="app-no-drag flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleDarkMode}
            icon={
              isDarkMode ? (
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              )
            }
          >
            {isDarkMode ? 'Light' : 'Dark'}
          </Button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <div
          className={cn(
            'flex h-full flex-shrink-0 flex-col border-r border-gray-200 bg-white transition-all duration-200 ease-in-out dark:border-gray-700 dark:bg-gray-800',
            sidebarCollapsed ? 'w-16' : 'w-64'
          )}
        >
          <div className="flex flex-col">
            <div className="border-b border-gray-200 px-3 py-3 dark:border-gray-700">
              <div
                className={cn(
                  'flex items-center gap-2',
                  sidebarCollapsed ? 'justify-center' : 'justify-between'
                )}
              >
                {!sidebarCollapsed && (
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    EasyPod
                  </span>
                )}
                <button
                  type="button"
                  onClick={toggleSidebar}
                  aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  className="rounded-md p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
                >
                  {sidebarCollapsed ? (
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M7.293 14.707a1 1 0 010-1.414L9.586 11H4a1 1 0 110-2h5.586L7.293 6.707a1 1 0 111.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M12.707 5.293a1 1 0 010 1.414L10.414 9H16a1 1 0 110 2h-5.586l2.293 2.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <nav className="flex-1 space-y-6 overflow-y-auto px-2 py-4">
              <div>
                {!sidebarCollapsed && (
                  <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Library
                  </div>
                )}
                <div className="space-y-1">
                  {navigationItems.map((item) => renderNavButton(item, activeView === item.id))}
                </div>
              </div>
              <div>
                {!sidebarCollapsed && (
                  <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Settings
                  </div>
                )}
                <div className="space-y-1">
                  {settingsItems.map((item) => renderNavButton(item, activeView === item.id))}
                </div>
              </div>
            </nav>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden">{children}</div>
          <AudioPlayer />
        </div>
      </div>
    </div>
  );
};

export default Layout;
