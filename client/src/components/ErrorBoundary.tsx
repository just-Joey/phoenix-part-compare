import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// Without this, any uncaught render error (e.g. the API returning a result
// shape the UI didn't guard against) unmounts the entire tree and leaves a
// blank page with no indication anything went wrong.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Uncaught render error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            maxWidth: 900,
            margin: "64px auto",
            padding: 32,
            border: "1px solid var(--border-offwhite)",
            borderRadius: 16,
          }}
        >
          <h1 style={{ fontSize: 20 }}>Something went wrong</h1>
          <p className="text-secondary">
            {this.state.error.message || "An unexpected error occurred rendering this page."}
          </p>
          <button className="primary" onClick={() => this.setState({ error: null })}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
