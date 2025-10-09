import React, { useState } from "react";
import { Archive, Loader2 } from "lucide-react";
import { cn } from "../../utils/cn";
import { Episode, useEpisodesStore } from "../../store/episodesStore";

type ArchiveStatus = Episode["status"];

export interface ArchiveEpisodeButtonProps {
  episodeId: number;
  status: ArchiveStatus;
  size?: "sm" | "md" | "lg";
  className?: string;
  iconClassName?: string;
  stopPropagation?: boolean;
  onArchived?: () => void;
  disabled?: boolean;
  "aria-label"?: string;
  title?: string;
  variant?: "default" | "unstyled";
}

const sizeClasses: Record<NonNullable<ArchiveEpisodeButtonProps["size"]>, string> = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
};

const iconSizeClasses: Record<NonNullable<ArchiveEpisodeButtonProps["size"]>, string> = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
};

export const ArchiveEpisodeButton: React.FC<ArchiveEpisodeButtonProps> = ({
  episodeId,
  status,
  size = "md",
  className,
  iconClassName,
  stopPropagation = true,
  onArchived,
  disabled,
  "aria-label": ariaLabel,
  title,
  variant = "default",
}) => {
  const markAsArchived = useEpisodesStore((state) => state.markAsArchived);
  const [isArchiving, setIsArchiving] = useState(false);

  const isAlreadyArchived = status === "archived";
  const isDisabled = disabled || isAlreadyArchived || isArchiving;

  const handleClick: React.MouseEventHandler<HTMLButtonElement> = async (event) => {
    if (stopPropagation) {
      event.stopPropagation();
    }

    if (isDisabled) {
      return;
    }

    try {
      setIsArchiving(true);
      await markAsArchived(episodeId);
      onArchived?.();
    } catch (error) {
      console.error("Archive episode failed:", error);
    } finally {
      setIsArchiving(false);
    }
  };

  const effectiveAriaLabel =
    ariaLabel ??
    (isAlreadyArchived ? "Episode already archived" : "Archive episode");
  const effectiveTitle =
    title ??
    (isAlreadyArchived ? "Already archived" : "Archive episode");

  const isUnstyled = variant === "unstyled";
  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        !isUnstyled && [
          "flex items-center justify-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-800",
          sizeClasses[size],
          isDisabled
            ? "cursor-not-allowed text-gray-300 dark:text-gray-700"
            : "text-gray-500 hover:bg-blue-500 hover:text-white dark:text-gray-300 dark:hover:text-white",
        ],
        isUnstyled && [
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-800",
          isDisabled && "cursor-not-allowed",
        ],
        className,
      )}
      aria-label={effectiveAriaLabel}
      title={effectiveTitle}
      disabled={isDisabled}
    >
      {isArchiving ? (
        <Loader2
          className={cn("animate-spin", iconSizeClasses[size], iconClassName)}
        />
      ) : (
        <Archive
          className={cn(iconSizeClasses[size], iconClassName)}
          strokeWidth={1.8}
        />
      )}
    </button>
  );
};

export default ArchiveEpisodeButton;
