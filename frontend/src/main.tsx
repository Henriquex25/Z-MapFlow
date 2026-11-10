import appIcon from "../../build/appicon.png";
import React from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import App from "./App";
import { UpdateDialog } from "./components/UpdateDialog";
import { EditorBoundary } from "./components/EditorBoundary";

const favicon = document.createElement("link");
favicon.rel = "icon";
favicon.type = "image/png";
favicon.href = appIcon;
document.head.appendChild(favicon);

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
