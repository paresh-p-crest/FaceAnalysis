'use client'

import { useEffect } from 'react'
import { useRouter } from '../../../i18n/navigation'
import { AppBootScreen } from '../../../components/AppBootScreen'
import { ROUTES } from '../../../utils/routes'

/** Legacy path — redirects to `/visuals`. */
export default function AiVisualsLegacyRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace(ROUTES.aiVisuals)
  }, [router])

  return <AppBootScreen withNavbarOffset />
}
