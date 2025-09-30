import React from 'react';
import { cn } from '../../utils/cn';

interface FeedStatusBadgeProps {
  status?: 'active' | 'updating' | 'error' | 'paused';
  className?: string;
}

const FeedStatusBadge: React.FC<FeedStatusBadgeProps> = ({ status, className }) => {
  const statusConfig = {
    active: {
      label: 'Active',
      className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      icon: '✓'
    },
    updating: {
      label: 'Updating',
      className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      icon: '↻'
    },
    error: {
      label: 'Error',
      className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
      icon: '⚠'
    },
    paused: {
      label: 'Paused',
      className: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
      icon: '⏸'
    }
  };

  const config = status ? statusConfig[status] : undefined;
  const fallbackConfig = statusConfig.active;
  const badgeConfig = config ?? fallbackConfig;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        badgeConfig.className,
        className
      )}
    >
      <span>{badgeConfig.icon}</span>
      {badgeConfig.label}
    </span>
  );
};

export default FeedStatusBadge;
