import React from "react";
import { useRouteError, Link } from "react-router-dom";

function Fallback({ message, onReset }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4" role="alert">
      <div className="max-w-md text-center space-y-4 bg-white rounded-3xl p-8 border border-slate-200 shadow-md">
        <div className="text-5xl">⚠️</div>
        <h1 className="text-xl font-extrabold text-slate-900">Something went wrong</h1>
        <p className="text-sm text-slate-500">
          This page hit an unexpected error. You can try again or head back home.
        </p>
        {message && <p className="text-xs font-mono text-slate-400 break-words">{message}</p>}
        <div className="flex gap-3 justify-center">
          <button
            onClick={onReset || (() => window.location.reload())}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700"
          >
            Try again
          </button>
          <Link to="/" className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

// Used as the router's errorElement: catches render errors and failed lazy chunk loads
export function RouteErrorFallback() {
  const error = useRouteError();
  return <Fallback message={error?.message} />;
}

// Wraps any subtree so a crash in one widget doesn't blank the whole page
export default class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return <Fallback message={this.state.error.message} onReset={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}
