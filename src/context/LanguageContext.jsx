import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { SUPPORTED_LANGUAGES, translateText } from '../i18n/translations'

const LANGUAGE_STORAGE_KEY = 'vergo-language'

const LanguageContext = createContext(null)

function getInitialLanguage() {
  const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)

  if (SUPPORTED_LANGUAGES.some((language) => language.value === storedLanguage)) {
    return storedLanguage
  }

  return 'de'
}

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(getInitialLanguage)

  function changeLanguage(nextLanguage) {
    if (!SUPPORTED_LANGUAGES.some((entry) => entry.value === nextLanguage)) {
      return
    }

    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage)
    document.documentElement.lang = nextLanguage
    setLanguage(nextLanguage)
  }

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
    document.documentElement.lang = language
  }, [language])

  const value = useMemo(() => ({
    language,
    setLanguage: changeLanguage,
    changeLanguage,
    languages: SUPPORTED_LANGUAGES,
    t: (input) => translateText(input, language),
  }), [language])

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)

  if (!context) {
    throw new Error('useLanguage must be used inside LanguageProvider')
  }

  return context
}
