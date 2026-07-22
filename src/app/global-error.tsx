'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <html>
      <body style={{ margin: 0, background: '#080808', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '24px', textAlign: 'center', gap: '12px' }}>
          <p style={{ color: '#f87171', fontWeight: 'bold', fontSize: '16px' }}>Error de aplicación</p>
          <p style={{ color: '#a1a1aa', fontSize: '14px', maxWidth: '480px' }}>
            {error?.message || 'Error desconocido'}
          </p>
          {error?.digest && (
            <p style={{ color: '#52525b', fontSize: '11px', fontFamily: 'monospace' }}>ID: {error.digest}</p>
          )}
          <button
            onClick={reset}
            style={{ marginTop: '8px', background: '#eab308', color: '#000', border: 'none', borderRadius: '12px', padding: '10px 20px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
