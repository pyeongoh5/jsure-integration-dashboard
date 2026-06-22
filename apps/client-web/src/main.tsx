import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import "./styles/tokens.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import { App } from "./App";
import { InfluencerAuthProvider } from "./context/InfluencerAuthContext";
import { initSentry } from "./lib/sentry";
import "./index.css";

initSentry();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

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
