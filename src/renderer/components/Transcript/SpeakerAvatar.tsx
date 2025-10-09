import React from 'react';
import { cn } from '../../utils/cn';
import spk0 from '../../assets/spk_0.png';
import spk1 from '../../assets/spk_1.png';
import spk2 from '../../assets/spk_2.png';
import spk3 from '../../assets/spk_3.png';
import spk4 from '../../assets/spk_4.png';
import spk5 from '../../assets/spk_5.png';

interface SpeakerAvatarProps {
  speakerId: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const speakerImages = [spk0, spk1, spk2, spk3, spk4, spk5];

const SpeakerAvatar: React.FC<SpeakerAvatarProps> = ({
  speakerId,
  size = 'md',
  className,
}) => {
  const imageIndex = speakerId % 6;
  const imageSrc = speakerImages[imageIndex];

  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
  };

  return (
    <div
      className={cn(
        'flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-transparent transition-colors dark:bg-white dark:p-0.5',
        sizeClasses[size],
        className
      )}
      title={`Speaker ${speakerId + 1}`}
    >
      <img
        src={imageSrc}
        alt={`Speaker ${speakerId + 1}`}
        className="h-full w-full rounded-full object-cover"
      />
    </div>
  );
};

export default SpeakerAvatar;
