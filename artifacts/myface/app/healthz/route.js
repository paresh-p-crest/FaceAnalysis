/** Replit Autoscale probes previewPath; keep this free of SSR/i18n. */
export function GET() {
  return Response.json({ ok: true }, { status: 200 })
}
