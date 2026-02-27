import { Component, type ErrorInfo, type ReactNode } from 'react';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo): void {
    // Let the app continue with a safe fallback screen.
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--app-bg)] px-6 text-center">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
          Une erreur est survenue
        </h1>
        <p className="max-w-md text-sm text-[var(--text-secondary)]">
          L&apos;application a rencontre une erreur inattendue. Recharge la page pour reprendre.
        </p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={this.handleReload}
        >
          Recharger
        </button>
      </div>
    );
  }
}
