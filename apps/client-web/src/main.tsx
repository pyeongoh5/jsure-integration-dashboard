import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import "./styles/tokens.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import { App } from "./App";
import { InfluencerAuthProvider } from "./context/InfluencerAuthContext";
import { initSentry } from "./lib/sentry";
import { createQueryClient } from "./lib/queryClient";
import "./index.css";

initSentry();

const queryClient = createQueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <InfluencerAuthProvider>
          <App />
        </InfluencerAuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
