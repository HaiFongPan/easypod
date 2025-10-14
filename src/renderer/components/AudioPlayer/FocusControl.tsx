import React from 'react';
import { Focus as FocusIcon } from 'lucide-react';
import { useTranscriptStore } from '../../store/transcriptStore';
import { cn } from '../../utils/cn';

interface FocusControlProps {
  visible: boolean;
}

const FocusControl: React.FC<FocusControlProps> = ({ visible }) => {
  const { autoScrollEnabled, enableAutoScroll, disableAutoScroll } =
    useTranscriptStore();

  const handleClick = () => {
    if (autoScrollEnabled) {
      disableAutoScroll();
    } else {
      enableAutoScroll();
    }
  };

  // If not visible, render empty space to preserve layout
  if (!visible) {
    return <div className="w-10" />;
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={autoScrollEnabled}
      className={cn(
        'p-2 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
        autoScrollEnabled
          ? 'bg-blue-500 text-white dark:text-white hover:bg-blue-600'
          : 'text-gray-600 hover:bg-blue-500 hover:text-white dark:text-gray-300 dark:hover:text-white dark:hover:bg-blue-500/70'
      )}
      title={
        autoScrollEnabled
          ? 'Click to disable auto-scroll'
          : 'Click to enable auto-scroll to current transcript'
      }
      aria-label="Toggle transcript auto-scroll"
    >
      <FocusIcon className="h-5 w-5" strokeWidth={2} />
    </button>
  );
};

export default FocusControl;
