const translationCache = new Map<string, Record<string, string>>()

let currentLocale = 'en'

export function getCurrentLocale(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('medibill-locale') || 'en'
  }
  return currentLocale
}

export function setCurrentLocale(locale: string): void {
  currentLocale = locale
  if (typeof window !== 'undefined') {
    localStorage.setItem('medibill-locale', locale)
  }
}

export const SUPPORTED_LOCALES = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
]

export async function loadTranslations(locale: string, namespace: string): Promise<Record<string, string>> {
  const cacheKey = `${locale}:${namespace}`
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey)!
  }
  try {
    const res = await fetch(`/api/translations?locale=${locale}&namespace=${namespace}`)
    if (res.ok) {
      const data = await res.json()
      const translations = data.data || data || {}
      translationCache.set(cacheKey, translations)
      return translations
    }
  } catch {
    // Fallback silently
  }
  return {}
}

export function t(key: string, translations?: Record<string, string>): string {
  if (translations && translations[key]) {
    return translations[key]
  }
  return key
}

export function useTranslation(namespace: string) {
  return { t: (key: string) => key }
}
