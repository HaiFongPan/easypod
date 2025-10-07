import React from 'react';
import SpeakerAvatar from './SpeakerAvatar';
import { formatTimestamp } from '../../utils/transcriptUtils';
import { cn } from '../../utils/cn';
import type { SentenceInfo } from '../../store/transcriptStore';

interface TranscriptItemProps {
  sentence: SentenceInfo;
  isHighlighted: boolean;
  onClickTimestamp?: (timeMs: number) => void;
}

const TranscriptItem = React.forwardRef<HTMLDivElement, TranscriptItemProps>(
  ({ sentence, isHighlighted, onClickTimestamp }, ref) => {
    const handleTimestampClick = () => {
      if (onClickTimestamp) {
        onClickTimestamp(sentence.start);
      }
    };

    return (
      <div
        ref={ref}
        className={cn(
          'flex gap-3 rounded-lg border-2 px-4 py-3 transition-all duration-200',
          isHighlighted
            ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20'
            : 'border-transparent bg-white dark:bg-gray-900'
        )}
      >
        {/* Speaker Avatar */}
        <SpeakerAvatar speakerId={sentence.spk} size="md" />

        {/* Sentence Content */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {/* Timestamp */}
          <button
            type="button"
            onClick={handleTimestampClick}
            className="w-fit rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            title="Click to jump to this time"
          >
            {formatTimestamp(sentence.start)}
          </button>

          {/* Text Content */}
          <p className="select-text text-sm leading-relaxed text-gray-900 dark:text-gray-100">
            {sentence.text}
          </p>
        </div>
      </div>
    );
  }
);

TranscriptItem.displayName = 'TranscriptItem';

export default TranscriptItem;
