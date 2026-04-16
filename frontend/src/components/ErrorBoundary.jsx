import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    this.setState({ error, info });
    // You could also log the error to an external service here
    console.error("Unhandled render error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-3xl w-full bg-white dark:bg-dark-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-2 text-red-600">An unexpected error occurred</h2>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">The application encountered an error while rendering. Details are shown below for debugging.</p>
            <pre className="text-xs overflow-auto max-h-48 p-2 bg-gray-100 dark:bg-dark-700 rounded text-red-800">{String(this.state.error && this.state.error.toString())}</pre>
            <pre className="text-xs overflow-auto max-h-48 p-2 bg-gray-50 dark:bg-dark-800 rounded mt-3 text-gray-700">{this.state.info?.componentStack}</pre>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg"
              >
                Reload
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: null, info: null })}
                className="px-4 py-2 bg-gray-200 dark:bg-dark-700 text-gray-800 dark:text-gray-200 rounded-lg"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
