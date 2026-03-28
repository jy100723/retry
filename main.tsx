import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// root 엘리먼트가 있는지 확인하고 렌더링합니다.
const container = document.getElementById("root");

if (!container) {
  throw new Error("Failed to find the root element. index.html에 id가 'root'인 div가 있는지 확인하세요.");
}

const root = createRoot(container);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);