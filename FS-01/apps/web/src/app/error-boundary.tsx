import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Application render error", error, info);
  }

  override render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main className="grid min-h-screen place-items-center bg-[var(--background)] p-6 text-center">
        <div className="max-w-md">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[color-mix(in_oklab,var(--danger)_10%,var(--surface))] text-[var(--danger)]"><AlertTriangle className="size-6" /></span>
          <h1 className="mt-5 text-2xl font-semibold">Something went wrong</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">Your work is safe. Reload the application to reconnect and try again.</p>
          <Button className="mt-6" onClick={() => window.location.reload()}>Reload Orvyn</Button>
        </div>
      </main>
    );
  }
}
