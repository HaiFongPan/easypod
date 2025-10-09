import React from "react";
import { Download } from "lucide-react";
import { cn } from "../../utils/cn";

interface ExportSRTButtonProps {
  onExport: () => void;
  disabled?: boolean;
  loading?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const ExportSRTButton: React.FC<ExportSRTButtonProps> = ({
  onExport,
  disabled = false,
  loading = false,
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

  const isDisabled = disabled || loading;

  return (
    <button
      type="button"
      onClick={onExport}
      disabled={isDisabled}
      title="Export SRT Subtitles"
      className={cn(
        "inline-flex items-center gap-2 rounded-full border font-medium transition",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
        sizeClasses[size],
        {
          // Normal state
          "border-gray-300 bg-white text-gray-900 hover:border-blue-500 hover:text-blue-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100":
            !isDisabled,

          // Disabled state
          "cursor-not-allowed border-gray-300 bg-gray-100 text-gray-400 opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-500":
            isDisabled,

          // Loading state
          "animate-pulse": loading,
        },
        className,
      )}
    >
      <Download
        size={iconSizes[size]}
        className={cn({
          "animate-pulse": loading,
        })}
      />
      {loading ? "Exporting…" : "SRT"}
    </button>
  );
};
