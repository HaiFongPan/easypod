import React from 'react';
import { getSpeakerColor, getSpeakerLabel } from '../../utils/transcriptUtils';
import { cn } from '../../utils/cn';

interface SpeakerAvatarProps {
  speakerId: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SpeakerAvatar: React.FC<SpeakerAvatarProps> = ({
  speakerId,
  size = 'md',
  className,
}) => {
  const colors = getSpeakerColor(speakerId);
  const label = getSpeakerLabel(speakerId);

  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
  };

  return (
    <div
      className={cn(
        'flex flex-shrink-0 items-center justify-center rounded-full border-2 font-semibold',
        colors.bg,
        colors.text,
        colors.border,
        sizeClasses[size],
        className
      )}
      title={`Speaker ${speakerId}`}
    >
      {label}
    </div>
  );
};

export default SpeakerAvatar;
