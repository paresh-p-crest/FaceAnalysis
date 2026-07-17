import { createContext, useContext, useEffect, useState, useCallback } from 'react'

const THEME_KEY = 'myface_theme'

const ThemeContext = createContext({
  theme: 'light',
  toggleTheme: () => {},
})

export function ThemeProvider({ children }) {
  // Always start with 'light' on both server and initial client render to
  // prevent a hydration mismatch. The stored preference is applied in the
  // effect below, which only runs after hydration is complete.
  const [theme, setTheme] = useState('light')

  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored && stored !== 'light') setTheme(stored)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
