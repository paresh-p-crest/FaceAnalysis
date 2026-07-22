'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

const THEME_KEY = 'myface_theme'

const ThemeContext = createContext({
  theme: 'light',
  toggleTheme: () => {},
})

export function ThemeProvider({ children }) {
  // Always start with 'light' so SSR HTML matches the first client render.
  // Preference is applied after mount (no <head> localStorage script — that
  // desynced SSR vs client in Replit Agent Preview).
  const [theme, setTheme] = useState('light')
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setTheme(localStorage.getItem(THEME_KEY) || 'light')
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem(THEME_KEY, theme)
  }, [theme, hydrated])

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
