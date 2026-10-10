import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "@/App";
import "@/index.css";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root container #root is missing from index.html");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
