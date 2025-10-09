import React from "react";
import { Sparkles } from "lucide-react";
import { cn } from "../../utils/cn";

interface AITranscribeButtonProps {
  status: "idle" | "submitting" | "processing" | "succeeded" | "failed";
  onTranscribe: () => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const AITranscribeButton: React.FC<AITranscribeButtonProps> = ({
  status,
  onTranscribe,
  disabled = false,
  size = "md",
  className,
}) => {
  const sizeClasses = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-5 text-base",
  };

  const iconSizes = {
    sm: 16,
    md: 20,
    lg: 24,
  };

  const isDisabled =
    disabled ||
    status === "processing" ||
    status === "succeeded" ||
    status === "submitting";

  return (
    <button
      type="button"
      onClick={onTranscribe}
      disabled={isDisabled}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border font-medium transition",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
        sizeClasses[size],
        {
          // Idle state
          "border-gray-300 bg-white text-gray-900 hover:border-blue-500 hover:text-blue-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100":
            status === "idle",

          // Submitting state - breathing effect
          "animate-pulse border-blue-400 bg-white text-blue-600 dark:bg-gray-800":
            status === "submitting",

          // Processing state - rotate icon
          "cursor-wait border-blue-400 bg-white text-blue-600 dark:bg-gray-800":
            status === "processing",

          // Succeeded state - grayed out
          "cursor-not-allowed border-gray-300 bg-gray-100 text-gray-400 opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-500":
            status === "succeeded",

          // Failed state - red border, can retry
          "border-red-400 bg-white text-red-600 hover:border-red-500 hover:text-red-700 dark:bg-gray-800":
            status === "failed",
        },
        className,
      )}
    >
      <Sparkles
        size={iconSizes[size]}
        className={cn({
          "animate-spin": status === "processing",
        })}
      />
      {status === "submitting"
        ? "Submitting…"
        : status === "processing"
          ? "Processing…"
          : status === "succeeded"
            ? ""
            : status === "failed"
              ? "Retry AI"
              : "AI"}
    </button>
  );
};
