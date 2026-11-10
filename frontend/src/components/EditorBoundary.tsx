import { Component, type ReactNode } from "react";
import { api } from "../services/api";
import { useKeyboardStore } from "../store/useKeyboardStore";

// Keep a rendering error actionable instead of leaving a blank desktop window.
export class EditorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null; exportError: string }
> {
  state = { error: null as Error | null, exportError: "" };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="loading-screen" role="alert">
        <h1>Não foi possível exibir o editor</h1>
        <p>Você pode exportar a edição atual antes de reabrir a configuração salva.</p>
        <pre className="source-code">{this.state.error.message}</pre>
        {this.state.exportError && <p>{this.state.exportError}</p>}
        <div className="flex gap-3">
          <button
            className="btn"
            onClick={async () => {
              const p = useKeyboardStore.getState().project;
              if (!p) return;
              try {
                await api.exportProject(p);
              } catch (e) {
                this.setState({ exportError: String(e) });
              }
            }}
          >
            Exportar edição atual (JSON)
          </button>
          <button
            className="btn primary"
            onClick={() => this.setState({ error: null, exportError: "" })}
          >
            Reabrir editor
          </button>
        </div>
      </main>
    );
  }
}
