import React from 'react';
import { cn } from '../../utils/cn';

interface FeedStatusBadgeProps {
  status: 'active' | 'updating' | 'error' | 'paused';
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

  const config = statusConfig[status];

  return (
    <span
      className={cn(
        'absolute top-2 right-2 px-2 py-1 text-xs font-medium rounded-full',
        config.className,
        className
      )}
    >
      <span className="mr-1">{config.icon}</span>
      {config.label}
    </span>
  );
};

export default FeedStatusBadge;