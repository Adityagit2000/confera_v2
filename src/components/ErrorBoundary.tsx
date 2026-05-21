import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCcw, Home, Copy, CheckCircle } from "lucide-react";
import { Button } from "./ui/button";
import { logger } from "@/lib/logger";
import { detectBrowser } from "@/lib/voiceDiagnostics";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // Log to structured logger instead of just console.error
    logger.error('ui', `ErrorBoundary caught: ${error.message}`, {
      stack: error.stack?.substring(0, 1000),
      componentStack: errorInfo.componentStack?.substring(0, 1000),
    });
  }

  private getDiagnosticInfo(): string {
    const browser = detectBrowser();
    const { error, errorInfo } = this.state;
    
    return [
      `--- Confera Error Report ---`,
      `Time: ${new Date().toISOString()}`,
      `Browser: ${browser.name} ${browser.version}`,
      `OS: ${browser.os}`,
      `Mobile: ${browser.isMobile}`,
      `URL: ${window.location.href}`,
      `Error: ${error?.message || 'Unknown'}`,
      `Stack: ${error?.stack?.substring(0, 500) || 'N/A'}`,
      `Component: ${errorInfo?.componentStack?.substring(0, 300) || 'N/A'}`,
      `---`,
    ].join('\n');
  }

  private copyDiagnostics = async () => {
    try {
      await navigator.clipboard.writeText(this.getDiagnosticInfo());
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {
      // Fallback for browsers without clipboard API
      const textarea = document.createElement('textarea');
      textarea.value = this.getDiagnosticInfo();
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] w-full flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
          <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
            <AlertCircle className="w-10 h-10 text-destructive" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Something went wrong</h2>
          <p className="text-muted-foreground max-w-md mb-8">
            We've encountered an unexpected error. Don't worry, your data is safe. Please try refreshing or return home.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <Button 
              onClick={() => window.location.reload()} 
              className="bg-primary hover:bg-primary-glow shadow-glow"
            >
              <RefreshCcw className="w-4 h-4 mr-2" />
              Reload Page
            </Button>
            <Button 
              variant="outline" 
              onClick={() => window.location.href = '/'}
              className="border-border hover:bg-muted"
            >
              <Home className="w-4 h-4 mr-2" />
              Go to Dashboard
            </Button>
          </div>

          {/* Copy diagnostic info button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={this.copyDiagnostics}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {this.state.copied ? (
              <>
                <CheckCircle className="w-3 h-3 mr-1.5 text-emerald-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 mr-1.5" />
                Copy diagnostic info for support
              </>
            )}
          </Button>

          {import.meta.env.DEV && (
            <div className="mt-8 p-4 bg-muted rounded-lg text-left max-w-2xl overflow-auto">
              <p className="text-xs font-mono text-destructive">{this.state.error?.toString()}</p>
              {this.state.errorInfo && (
                <pre className="text-[10px] font-mono text-muted-foreground mt-2 whitespace-pre-wrap">
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
