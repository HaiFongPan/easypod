import React, { useState } from "react";
import { cn } from "../../utils/cn";

interface SpeedControlProps {
  playbackRate: number;
  onRateChange: (rate: number) => void;
  className?: string;
}

const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];

const SpeedControl: React.FC<SpeedControlProps> = ({
  playbackRate,
  onRateChange,
  className,
}) => {
  const [showOptions, setShowOptions] = useState(false);

  const handleSpeedSelect = (speed: number) => {
    onRateChange(speed);
    // 不立即关闭菜单，让用户可以继续选择
    // setShowOptions(false);
  };

  const cycleSpeed = () => {
    const currentIndex = SPEED_OPTIONS.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % SPEED_OPTIONS.length;
    onRateChange(SPEED_OPTIONS[nextIndex]);
  };

  return (
    <div className={cn("relative", className)}>
      {/* Hover Area - 包含按钮和下拉菜单的整个区域 */}
      <div
        onMouseEnter={() => setShowOptions(true)}
        onMouseLeave={() => setShowOptions(false)}
        className="relative"
      >
        {/* Speed Button */}
        <button
          onClick={cycleSpeed}
          className={cn(
            "w-12 px-3 py-1 rounded-md text-sm font-medium transition-colors",
            "hover:bg-gray-100 dark:hover:bg-gray-700",
            playbackRate !== 1.0 &&
              "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300",
          )}
          title="Playback Speed"
        >
          {playbackRate === 1.0 ? "1×" : `${playbackRate}×`}
        </button>

        {/* Speed Options Dropdown */}
        {showOptions && (
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 pb-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 min-w-[80px]">
              {SPEED_OPTIONS.map((speed) => (
                <button
                  key={speed}
                  onClick={() => handleSpeedSelect(speed)}
                  className={cn(
                    "w-full px-3 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors",
                    speed === playbackRate &&
                      "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300",
                  )}
                >
                  {speed === 1.0 ? "1×" : `${speed}×`}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SpeedControl;
