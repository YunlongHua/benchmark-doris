import { create } from 'zustand'

type Language = 'zh-CN' | 'en-US'

interface LanguageStore {
  language: Language
  setLanguage: (lang: Language) => void
}

export const useLanguageStore = create<LanguageStore>((set) => ({
  language: 'zh-CN',
  setLanguage: (lang) => set({ language: lang })
}))