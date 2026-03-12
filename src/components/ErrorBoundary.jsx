import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-200 dark:bg-gray-950 p-4">
          <div className="max-w-md w-full text-center space-y-4">
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50">Something went wrong</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              An unexpected error occurred. Reload the page to try again.
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
            >
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
