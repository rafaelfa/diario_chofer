export default function OfflinePage() {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Sem Conexão - Diário do Motorista</title>
      </head>
      <body style={{
        minHeight: '100vh',
        background: 'linear-gradient(to bottom, #f8fafc, #f1f5f9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        margin: 0,
        fontFamily: 'system-ui, sans-serif'
      }}>
        <div style={{
          maxWidth: '400px',
          width: '100%',
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          padding: '24px',
          textAlign: 'center'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            background: '#fef3c7',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <span style={{ fontSize: '32px' }}>📡</span>
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>
            Sem Conexão
          </h1>
          <p style={{ color: '#64748b', marginBottom: '16px' }}>
            Você está offline no momento.
          </p>
          <a 
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              background: '#059669',
              color: 'white',
              padding: '12px 24px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: '500'
            }}
          >
            Tentar Novamente
          </a>
        </div>
      </body>
    </html>
  );
}
