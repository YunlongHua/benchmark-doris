import { useLanguageStore } from '../stores/languageStore'
import { t as translate, TranslationKey } from '../i18n'

export function useTranslation() {
  const language = useLanguageStore(s => s.language)
  return {
    t: (key: TranslationKey) => translate(key, language),
    language
  }
}