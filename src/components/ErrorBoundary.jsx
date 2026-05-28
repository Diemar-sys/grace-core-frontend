import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '100vh', padding: 32,
          fontFamily: 'sans-serif', color: '#111',
        }}>
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12,
            padding: '32px 40px', maxWidth: 480, textAlign: 'center',
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠</div>
            <h2 style={{ margin: '0 0 8px', color: '#991b1b' }}>Algo salió mal</h2>
            <p style={{ margin: '0 0 24px', color: '#6b7280', fontSize: 14 }}>
              Ocurrió un error inesperado. Si el problema persiste, contacta a soporte.
            </p>
            <p style={{
              margin: '0 0 24px', padding: '8px 12px',
              background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6,
              fontSize: 12, color: '#374151', textAlign: 'left', wordBreak: 'break-word',
            }}>
              {this.state.error.message}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#dc2626', color: '#fff', border: 'none',
                borderRadius: 8, padding: '10px 24px', fontSize: 14,
                fontWeight: 600, cursor: 'pointer',
              }}
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
