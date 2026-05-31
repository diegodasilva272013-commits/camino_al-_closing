'use client';

import { Component, type ReactNode } from 'react';

type Props = { children: ReactNode; label?: string };
type State = { error: Error | null };

export class ClientErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // eslint-disable-next-line no-console
    console.error('[ClientErrorBoundary]', this.props.label, error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <section className="card-premium border-2 border-red-500/60 bg-red-950/20">
          <h3 className="mb-2 text-sm font-bold text-red-300">
            ⚠️ {this.props.label ?? 'Componente'} falló
          </h3>
          <pre className="overflow-auto whitespace-pre-wrap break-words text-[11px] text-red-200">
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
        </section>
      );
    }
    return this.props.children;
  }
}
