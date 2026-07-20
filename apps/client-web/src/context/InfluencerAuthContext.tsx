import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { PublicInfluencerSchema, type PublicInfluencer } from "@jsure/shared";
import {
  ME_STORAGE_KEY,
  REFRESH_STORAGE_KEY,
  TOKEN_STORAGE_KEY,
} from "../lib/api";

interface AuthState {
  influencer: PublicInfluencer | null;
  isReady: boolean;
  setSession: ( // new — refreshToken 저장 추가
    token: string,
    influencer: PublicInfluencer,
    refreshToken?: string,
  ) => void;
  clear: () => void;
}

const Ctx = createContext<AuthState | null>(null);

function readStored(): PublicInfluencer | null {
  try {
    const raw = localStorage.getItem(ME_STORAGE_KEY);
    if (!raw) return null;
    return PublicInfluencerSchema.parse(JSON.parse(raw));
  } catch {
    localStorage.removeItem(ME_STORAGE_KEY);
    return null;
  }
}

export function InfluencerAuthProvider({ children }: { children: ReactNode }) {
  const [influencer, setInfluencer] = useState<PublicInfluencer | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setInfluencer(readStored());
    setIsReady(true);
  }, []);

  const setSession = useCallback(
    (token: string, inf: PublicInfluencer, refreshToken?: string) => {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      if (refreshToken) {
        localStorage.setItem(REFRESH_STORAGE_KEY, refreshToken); // new
      }
      localStorage.setItem(ME_STORAGE_KEY, JSON.stringify(inf));
      setInfluencer(inf);
    },
    [],
  );

  const clear = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(REFRESH_STORAGE_KEY); // new
    localStorage.removeItem(ME_STORAGE_KEY);
    setInfluencer(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ influencer, isReady, setSession, clear }),
    [influencer, isReady, setSession, clear],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useInfluencerAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useInfluencerAuth must be inside provider");
  return v;
}
