import React from 'react';
import { useTranscriptStore } from '../../store/transcriptStore';
import { cn } from '../../utils/cn';

interface FocusControlProps {
  visible: boolean;
}

const FocusControl: React.FC<FocusControlProps> = ({ visible }) => {
  const { autoScrollEnabled, enableAutoScroll } = useTranscriptStore();

  const handleClick = () => {
    enableAutoScroll();
  };

  // If not visible, render empty space to preserve layout
  if (!visible) {
    return <div className="w-10" />;
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={autoScrollEnabled}
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
        autoScrollEnabled
          ? 'cursor-default bg-blue-500 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
      )}
      title={
        autoScrollEnabled
          ? 'Auto-scroll is active'
          : 'Click to enable auto-scroll to current transcript'
      }
      aria-label="Toggle transcript auto-scroll"
    >
      {/* Target/Focus Icon */}
      <svg
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 4v.01M12 12v.01M12 20v.01M12 12h.01M8 12h-.01M16 12h.01M12 8v-.01M12 16v-.01M9.172 9.172l-.007-.007M14.828 14.828l-.007-.007M14.828 9.172l-.007-.007M9.172 14.828l-.007-.007"
        />
      </svg>
    </button>
  );
};

export default FocusControl;
