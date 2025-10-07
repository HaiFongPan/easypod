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

  // Actions
  loadTranscript: (episodeId: number) => Promise<void>;
  clearTranscript: () => void;
  setCurrentSentenceIndex: (index: number) => void;
  enableAutoScroll: () => void;
  disableAutoScroll: () => void;
  setManualScrollDetected: (detected: boolean) => void;
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
    }),
    { name: 'Transcript Store' }
  )
);
