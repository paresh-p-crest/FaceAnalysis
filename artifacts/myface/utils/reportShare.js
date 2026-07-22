/** Share current report page URL (Web Share API or clipboard fallback). */
export async function shareReportPage(shareTitle) {
  const url = typeof window !== 'undefined' ? window.location.href : ''
  if (!url) return
  if (navigator.share) {
    await navigator.share({ title: shareTitle, url })
    return
  }
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url)
  }
}
