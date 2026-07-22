/** Root fallback when no locale segment matches (middleware usually rewrites first). */
export default function RootNotFound() {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Inter, Helvetica',
          background: '#F7F8FC',
          color: '#111827',
          textAlign: 'center',
          padding: '1rem',
        }}
      >
        <p style={{ fontSize: '4rem', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>404</p>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: '0.75rem 0 0' }}>Page not found</h1>
        <p style={{ fontSize: '0.875rem', color: '#6B7280', margin: '0.5rem 0 0', maxWidth: '28rem' }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <a
          href="/auth"
          style={{
            marginTop: '1.25rem',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '0.75rem',
            background: '#5e9f8b',
            color: '#fff',
            fontSize: '0.875rem',
            fontWeight: 600,
            padding: '0.625rem 1.25rem',
            textDecoration: 'none',
          }}
        >
          Go home
        </a>
      </body>
    </html>
  )
}
