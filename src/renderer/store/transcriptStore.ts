import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface SentenceInfo {
  text: string;
  start: number;
  end: number;
  timestamp: number[][];
  spk: number;
}

export interface TranscriptData {
  id: number;
  episodeId: number;
  subtitles: SentenceInfo[];
  text: string;
  speakerNumber: number;
  createdAt: string;
  updatedAt: string;
}

export interface ModelDownloadState {
  modelId: string;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  progress: number; // 0-100
  downloadedSize: number;
  totalSize: number;
  downloadPath?: string;
  errorMessage?: string;
  speed?: number; // MB/s
  estimatedTimeRemaining?: number; // seconds
}

interface TranscriptState {
  // Current transcript data
  transcript: TranscriptData | null;
  isLoading: boolean;
  error: string | null;

  // Current highlighted sentence index
  currentSentenceIndex: number;

  // Auto-scroll control
  autoScrollEnabled: boolean;
  manualScrollDetected: boolean;

  // Model download states
  models: Record<string, ModelDownloadState>;
  _progressListenerCleanup?: () => void;

  // Transcript actions
  loadTranscript: (episodeId: number) => Promise<void>;
  clearTranscript: () => void;
  setCurrentSentenceIndex: (index: number) => void;
  enableAutoScroll: () => void;
  disableAutoScroll: () => void;
  setManualScrollDetected: (detected: boolean) => void;

  // Model download actions
  loadModelStatus: (modelIds: string[]) => Promise<void>;
  downloadModel: (modelId: string) => Promise<boolean>;
  downloadModels: (
    modelIds: string[],
  ) => Promise<{
    started: string[];
    skipped: string[];
    failed: { modelId: string; error?: string }[];
  }>;
  cancelDownload: (modelId: string) => Promise<boolean>;
  updateModelProgress: (progressEvent: {
    modelId: string;
    status: string;
    progress: number;
    downloadedSize: number;
    totalSize: number;
    downloadPath?: string;
    error?: string;
  }) => void;
  setupProgressListener: () => void;
  cleanupProgressListener: () => void;
}

export const useTranscriptStore = create<TranscriptState>()(
  devtools(
    (set, get) => ({
      // Initial state
      transcript: null,
      isLoading: false,
      error: null,
      currentSentenceIndex: -1,
      autoScrollEnabled: true,
      manualScrollDetected: false,
      models: {},

      // Load transcript from database
      loadTranscript: async (episodeId: number) => {
        set({ isLoading: true, error: null });

        try {
          const result = await window.electronAPI.transcript.getByEpisode(episodeId);

          if (result.success && result.transcript) {
            set({
              transcript: result.transcript,
              isLoading: false,
              error: null,
              currentSentenceIndex: -1,
              autoScrollEnabled: true,
              manualScrollDetected: false,
            });
          } else {
            set({
              transcript: null,
              isLoading: false,
              error: result.error || 'Failed to load transcript',
              currentSentenceIndex: -1,
            });
          }
        } catch (error) {
          console.error('[TranscriptStore] Error loading transcript:', error);
          set({
            transcript: null,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            currentSentenceIndex: -1,
          });
        }
      },

      // Clear transcript data
      clearTranscript: () => {
        set({
          transcript: null,
          isLoading: false,
          error: null,
          currentSentenceIndex: -1,
          autoScrollEnabled: true,
          manualScrollDetected: false,
        });
      },

      // Set current sentence index (for highlighting)
      setCurrentSentenceIndex: (index: number) => {
        const current = get().currentSentenceIndex;
        if (current !== index) {
          set({ currentSentenceIndex: index });
        }
      },

      // Enable auto-scroll
      enableAutoScroll: () => {
        set({ autoScrollEnabled: true, manualScrollDetected: false });
      },

      // Disable auto-scroll
      disableAutoScroll: () => {
        set({ autoScrollEnabled: false });
      },

      // Mark that user has manually scrolled
      setManualScrollDetected: (detected: boolean) => {
        if (detected) {
          set({ manualScrollDetected: true, autoScrollEnabled: false });
        } else {
          set({ manualScrollDetected: false });
        }
      },

      // Model download: Load model status for given model IDs
      loadModelStatus: async (modelIds: string[]) => {
        try {
          const result = await window.electronAPI.transcriptModel.getAllStatus(modelIds);

          if (result.success && result.status) {
            set({
              models: result.status,
            });
          }
        } catch (error) {
          console.error('[TranscriptStore] Failed to load model status:', error);
        }
      },

      // Model download: Start downloading a model
      downloadModel: async (modelId: string) => {
        try {
          // Initialize model state
          set((state) => ({
            models: {
              ...state.models,
              [modelId]: {
                modelId,
                status: 'downloading',
                progress: 0,
                downloadedSize: 0,
                totalSize: 0,
              },
            },
          }));

          // Start download
          const downloadResult = await window.electronAPI.transcriptModel.download(modelId);

          if (!downloadResult.success) {
            // Update to failed state
            set((state) => ({
              models: {
                ...state.models,
                [modelId]: {
                  ...state.models[modelId],
                  status: 'failed',
                  errorMessage: downloadResult.error || 'Failed to start download',
                },
              },
            }));
            return false;
          }

          // Subscribe to progress updates
          await window.electronAPI.transcriptModel.subscribeProgress(modelId);

          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          console.error('[TranscriptStore] Failed to start download:', error);

          set((state) => ({
            models: {
              ...state.models,
              [modelId]: {
                ...state.models[modelId],
                status: 'failed',
                errorMessage: message,
              },
            },
          }));

          return false;
        }
      },

      // Model download: Start multiple model downloads in batch
      downloadModels: async (modelIds: string[]) => {
        const started: string[] = [];
        const skipped: string[] = [];
        const failed: { modelId: string; error?: string }[] = [];

        for (const modelId of modelIds) {
          const currentState = get().models[modelId];

          if (currentState?.status === 'completed' || currentState?.status === 'downloading') {
            skipped.push(modelId);
            continue;
          }

          const success = await get().downloadModel(modelId);

          if (success) {
            started.push(modelId);
          } else {
            const errorMessage = get().models[modelId]?.errorMessage;
            failed.push({ modelId, error: errorMessage });
          }
        }

        return { started, skipped, failed };
      },

      // Model download: Cancel an ongoing download
      cancelDownload: async (modelId: string) => {
        try {
          const result = await window.electronAPI.transcriptModel.cancelDownload(modelId);

          if (result.success) {
            // Update local state
            set((state) => ({
              models: {
                ...state.models,
                [modelId]: {
                  ...state.models[modelId],
                  status: 'failed',
                  errorMessage: 'Download cancelled by user',
                },
              },
            }));

            // Unsubscribe from progress
            await window.electronAPI.transcriptModel.unsubscribeProgress(modelId);

            return true;
          }

          return false;
        } catch (error) {
          console.error('[TranscriptStore] Failed to cancel download:', error);
          return false;
        }
      },

      // Model download: Update model progress from SSE event
      updateModelProgress: (progressEvent) => {
        const { modelId } = progressEvent;
        const currentState = get().models[modelId];

        // Calculate download speed
        let speed: number | undefined;
        if (currentState && currentState.downloadedSize > 0) {
          const sizeDiff = progressEvent.downloadedSize - currentState.downloadedSize;
          const timeDiff = 1; // Assuming updates every ~1 second
          speed = sizeDiff / timeDiff / (1024 * 1024); // Convert to MB/s
        }

        // Calculate estimated time remaining
        let estimatedTimeRemaining: number | undefined;
        if (speed && speed > 0) {
          const remainingBytes = progressEvent.totalSize - progressEvent.downloadedSize;
          estimatedTimeRemaining = remainingBytes / (speed * 1024 * 1024);
        }

        set((state) => ({
          models: {
            ...state.models,
            [modelId]: {
              modelId,
              status: progressEvent.status as any,
              progress: progressEvent.progress,
              downloadedSize: progressEvent.downloadedSize,
              totalSize: progressEvent.totalSize,
              downloadPath: progressEvent.downloadPath,
              errorMessage: progressEvent.error,
              speed,
              estimatedTimeRemaining,
            },
          },
        }));
      },

      // Model download: Setup progress listener
      setupProgressListener: () => {
        const cleanup = get()._progressListenerCleanup;
        if (cleanup) {
          // Already set up
          return;
        }

        const unsubscribe = window.electronAPI.transcriptModel.onProgress((event) => {
          get().updateModelProgress(event);
        });

        set({ _progressListenerCleanup: unsubscribe });
      },

      // Model download: Cleanup progress listener
      cleanupProgressListener: () => {
        const cleanup = get()._progressListenerCleanup;
        if (cleanup) {
          cleanup();
          set({ _progressListenerCleanup: undefined });
        }
      },
    }),
    { name: 'Transcript Store' }
  )
);

// Auto-setup progress listener when store is created
useTranscriptStore.getState().setupProgressListener();

// Cleanup on window unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    useTranscriptStore.getState().cleanupProgressListener();
  });
}
