import { Component } from "react";

/** Catches render crashes and shows them instead of a silent white page. */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("CAMPS render error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen grid place-items-center bg-slate-100 p-6">
          <div className="max-w-lg w-full bg-white rounded-2xl ring-1 ring-rose-200 shadow-xl p-8 text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-rose-100 grid place-items-center text-rose-500 mb-4">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-slate-900">Something went wrong</h1>
            <p className="mt-2 text-sm text-slate-500 break-words">
              {String(this.state.error?.message || this.state.error)}
            </p>
            <button
              onClick={() => {
                localStorage.clear();
                window.location.href = "/login";
              }}
              className="mt-6 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Reset session & reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
