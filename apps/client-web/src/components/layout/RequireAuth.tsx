import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useInfluencerAuth } from "../../context/InfluencerAuthContext";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { influencer, isReady } = useInfluencerAuth();
  const location = useLocation();

  if (!isReady) return null;
  if (!influencer) {
    const from = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?from=${from}`} replace />;
  }
  return <>{children}</>;
}
