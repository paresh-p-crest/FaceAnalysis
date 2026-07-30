/** Replit probes previewPath/healthz; keep this free of SSR/i18n. */
export function GET() {
  return Response.json({ ok: true }, { status: 200 })
}

export function HEAD() {
  return new Response(null, { status: 200 })
}
