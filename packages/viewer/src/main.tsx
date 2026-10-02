import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LoupeProvider } from "./state";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LoupeProvider>
      <App />
    </LoupeProvider>
  </StrictMode>,
);
