import { create } from 'zustand';

interface AppState {
  language: 'he' | 'en';
  setLanguage: (lang: 'he' | 'en') => void;
}

export const useStore = create<AppState>((set) => ({
  language: 'he',
  setLanguage: (lang) => set({ language: lang }),
}));
