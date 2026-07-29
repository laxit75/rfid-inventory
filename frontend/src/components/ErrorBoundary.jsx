import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="page-shell" style={{ padding: '2rem', textAlign: 'center' }}>
          <div className="content-card" style={{ maxWidth: 500, margin: '2rem auto' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
            <h2 style={{ margin: 0 }}>Something went wrong</h2>
            <p className="page-subtitle" style={{ marginTop: '0.5rem', marginBottom: '1.5rem' }}>
              {this.props.fallbackMessage || 'An unexpected error occurred in this section. Please try refreshing the page.'}
            </p>
            <div className="button-row" style={{ justifyContent: 'center' }}>
              <button
                className="button"
                onClick={() => {
                  this.setState({ hasError: false, error: null, errorInfo: null })
                  window.location.reload()
                }}
              >
                Refresh page
              </button>
              {this.props.onReset && (
                <button className="button button-ghost" onClick={this.props.onReset}>
                  Try again
                </button>
              )}
            </div>
            {this.state.error && (
              <details style={{ marginTop: '1rem', textAlign: 'left', fontSize: '0.8rem', color: '#64748b' }}>
                <summary>Error details</summary>
                <pre style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#f8fafc', borderRadius: 8, overflow: 'auto' }}>
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
