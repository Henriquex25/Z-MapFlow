import { localizeMessage } from "../i18n";
import { tr } from "../i18n";
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
        <h1>{tr("Could not display the editor")}</h1>
        <p>{tr("You can export your current changes before reopening the saved configuration.")}</p>
        <pre className="source-code">{localizeMessage(this.state.error.message)}</pre>
        {this.state.exportError && <p>{localizeMessage(this.state.exportError)}</p>}
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
            {tr("Export current changes (JSON)")}{" "}
          </button>
          <button
            className="btn primary"
            onClick={() => this.setState({ error: null, exportError: "" })}
          >
            {tr("Reopen editor")}{" "}
          </button>
        </div>
      </main>
    );
  }
}
