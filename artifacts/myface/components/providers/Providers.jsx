'use client'

import { ThemeProvider } from '../../utils/theme'
import { AppProvider } from './AppProvider'

export function Providers({ children }) {
  return (
    <ThemeProvider>
      <AppProvider>{children}</AppProvider>
    </ThemeProvider>
  )
}
