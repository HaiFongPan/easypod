import { create } from 'zustand';

export type AppView =
  | 'library'
  | 'subscriptions'
  | 'recently-played'
  | 'completed'
  | 'transcriptions'
  | 'ai-summaries'
  | 'rss-tester';

interface NavigationState {
  currentView: AppView;
  previousView?: AppView;
}

interface NavigationActions {
  setCurrentView: (view: AppView) => void;
  goBack: () => void;
}

export const useNavigationStore = create<NavigationState & NavigationActions>((set, get) => ({
  // State
  currentView: 'subscriptions',
  previousView: undefined,

  // Actions
  setCurrentView: (view) => {
    const { currentView } = get();
    set({
      currentView: view,
      previousView: currentView,
    });
  },

  goBack: () => {
    const { previousView } = get();
    if (previousView) {
      set({
        currentView: previousView,
        previousView: undefined,
      });
    }
  },
}));