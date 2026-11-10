import React from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import App from "./App";
import { UpdateDialog } from "./components/UpdateDialog";
import { EditorBoundary } from "./components/EditorBoundary";

const container = document.getElementById("root");

const root = createRoot(container!);

root.render(
  <React.StrictMode>
    <EditorBoundary>
      <App />
      <UpdateDialog />
    </EditorBoundary>
  </React.StrictMode>,
);
