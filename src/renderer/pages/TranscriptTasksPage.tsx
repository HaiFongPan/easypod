import React, { useEffect, useMemo, useState } from "react";
import { cn } from "../utils/cn";
import Button from "../components/Button";
import {
  Search,
  Loader2,
  AlertCircle,
  Mic,
  Trash2,
  RotateCcw,
  CheckCircle,
  Clock,
  XCircle,
} from "lucide-react";
import { useToast } from "../components/Toast/ToastProvider";

const PAGE_SIZE = 10;

interface TranscriptTask {
  id: number;
  episodeId: number;
  taskId: string;
  output: string;
  service: "funasr" | "aliyun";
  status: "pending" | "processing" | "succeeded" | "failed";
  createdAt: string;
  updatedAt: string;
  episode: {
    id: number;
    title: string;
    episodeImageUrl: string | null;
    feedId: number;
    coverUrl: string | null;
  };
}

export const TranscriptTasksPage: React.FC = () => {
  const [tasks, setTasks] = useState<TranscriptTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [localSearchQuery, setLocalSearchQuery] = useState("");
  const toast = useToast();

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.transcript.getTasksList(
        currentPage,
        PAGE_SIZE,
        searchQuery || undefined,
      );

      if (result.success) {
        setTasks(result.tasks || []);
        setTotal(result.total || 0);
      } else {
        setError(result.error || "Failed to load tasks");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [currentPage, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(localSearchQuery);
  };

  const handleDelete = async (task: TranscriptTask) => {
    if (
      !confirm(`Are you sure?\nAll AGC of ${task.episode.title} will be delete`)
    ) {
      return;
    }

    try {
      const result = await window.electronAPI.transcript.deleteTask(
        task.episodeId,
      );
      if (result.success) {
        await fetchTasks();
      } else {
        toast.error(`删除失败: ${result.error}`);
      }
    } catch (err) {
      toast.error(
        `删除失败: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    }
  };

  const handleRetry = async (task: TranscriptTask) => {
    try {
      const result = await window.electronAPI.transcript.retryTask(
        task.episodeId,
      );
      if (result.success) {
        await fetchTasks();
      } else {
        toast.error(`重试失败: ${result.error}`);
      }
    } catch (err) {
      toast.error(
        `重试失败: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, total);

  const goToPage = (page: number) => {
    const nextPage = Math.min(Math.max(page, 1), totalPages);
    if (nextPage !== currentPage) {
      setCurrentPage(nextPage);
    }
  };

  const getStatusIcon = (status: TranscriptTask["status"]) => {
    switch (status) {
      case "pending":
        return <Clock className="w-4 h-4 text-gray-400" />;
      case "processing":
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case "succeeded":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusText = (status: TranscriptTask["status"]) => {
    switch (status) {
      case "pending":
        return "Pending";
      case "processing":
        return "Processing";
      case "succeeded":
        return "Success";
      case "failed":
        return "Fail";
    }
  };

  const getStatusColor = (status: TranscriptTask["status"]) => {
    switch (status) {
      case "pending":
        return "text-gray-600 dark:text-gray-400";
      case "processing":
        return "text-blue-600 dark:text-blue-400";
      case "succeeded":
        return "text-green-600 dark:text-green-400";
      case "failed":
        return "text-red-600 dark:text-red-400";
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const getCoverUrl = (task: TranscriptTask) => {
    return task.episode.episodeImageUrl || task.episode.coverUrl || "";
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="flex-shrink-0 p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Tasks
            </h1>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fetchTasks()}
              disabled={loading}
              icon={
                <svg
                  className={cn("w-4 h-4", loading && "animate-spin")}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              }
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch}>
          <div className="relative">
            <input
              type="text"
              className="w-full px-4 py-2 pl-10 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-gray-900 dark:text-gray-100"
              placeholder="Search Episode..."
              value={localSearchQuery}
              onChange={(e) => setLocalSearchQuery(e.target.value)}
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          </div>
        </form>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0 flex flex-col overflow-x-hidden">
        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center h-full">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center h-full">
            <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
            <p className="text-gray-900 dark:text-gray-100 mb-2">
              Error: {error}
            </p>
            <Button onClick={() => fetchTasks()}>Retry</Button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full p-8">
            <Mic className="w-24 h-24 text-gray-400 dark:text-gray-600 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Nothing here
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-center max-w-md">
              {searchQuery ? "Nothing here" : "No task found"}
            </p>
          </div>
        )}

        {/* Tasks List */}
        {!loading && !error && tasks.length > 0 && (
          <div className="flex-1 min-h-0 p-6 flex flex-col gap-4">
            <div
              className="flex-1 min-h-0 overflow-y-auto pr-1"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <div className="space-y-3">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                  >
                    {/* Cover */}
                    <div className="flex-shrink-0">
                      {getCoverUrl(task) ? (
                        <img
                          src={getCoverUrl(task)}
                          alt={task.episode.title}
                          className="w-8 h-8 rounded object-cover"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                          <Mic className="w-8 h-8 text-gray-400" />
                        </div>
                      )}
                    </div>

                    {/* Title */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {task.episode.title}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Powerby: {task.service.toUpperCase()}
                      </p>
                    </div>

                    {/* Created At */}
                    <div className="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
                      {formatDate(task.createdAt)}
                    </div>

                    {/* Status */}
                    <div
                      className={cn(
                        "flex items-center gap-2 flex-shrink-0",
                        getStatusColor(task.status),
                      )}
                    >
                      {getStatusIcon(task.status)}
                      <span className="text-sm font-medium">
                        {getStatusText(task.status)}
                      </span>
                    </div>

                    {/* Operations */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {task.status === "failed" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRetry(task)}
                          title="Retry"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(task)}
                        title="Delete"
                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {total > PAGE_SIZE && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-gray-200 dark:border-gray-700 pt-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Shoing {startIndex + 1}-{endIndex} of {total} tasks
                </p>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
