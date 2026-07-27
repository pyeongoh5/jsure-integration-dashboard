import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  ConsentItem,
  InfluencerSnsAccountInput,
} from "@jsure/shared";

const STORAGE_KEY = "signupDraft";
const LINE_TOKEN_KEY = "lineSignupToken";

// 인앱 브라우저(LINE 웹뷰 등)·프라이빗 모드에서는 sessionStorage 가 막히거나
// OAuth 리다이렉트 왕복을 못 버텨, /signup/line 이후 토큰이 사라져 LineGate 가
// /login 으로 튕겨내는 문제가 있었다. SPA 세션 동안 유지되는 메모리 변수를 1차
// 소스로 쓰고 sessionStorage 는 새로고침 복구용 보조로만 둔다.
let lineSignupTokenMemory: string | null = null;

export function getLineSignupToken(): string | null {
  if (lineSignupTokenMemory) return lineSignupTokenMemory;
  try {
    lineSignupTokenMemory = sessionStorage.getItem(LINE_TOKEN_KEY);
    return lineSignupTokenMemory;
  } catch {
    return null;
  }
}

export function setLineSignupTokenStorage(token: string | null): void {
  lineSignupTokenMemory = token;
  try {
    if (token) sessionStorage.setItem(LINE_TOKEN_KEY, token);
    else sessionStorage.removeItem(LINE_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

interface ProfileDraft {
  name: string;
  nameKana: string;
  phone: string;
  birthDate: string;
  postalCode: string;
  prefecture: string;
  city: string;
  addressLine1: string;
  addressLine2: string;
}

interface AccountDraft {
  email: string;
  password: string;
}

interface BankDraft {
  bankCode: string;
  bankName: string;
  branchName: string;
  branchCode: string;
  accountNumber: string;
  accountHolderKana: string;
  invoiceRegistrationNumber: string;
}

interface SignupDraft {
  agreedItems: ConsentItem[];
  account: AccountDraft;
  profile: ProfileDraft;
  snsAccounts: InfluencerSnsAccountInput[];
  bank: BankDraft;
  lineSignupToken: string | null;
}

const DEFAULT: SignupDraft = {
  agreedItems: [],
  account: { email: "", password: "" },
  profile: {
    name: "",
    nameKana: "",
    phone: "",
    birthDate: "",
    postalCode: "",
    prefecture: "",
    city: "",
    addressLine1: "",
    addressLine2: "",
  },
  snsAccounts: [],
  bank: {
    bankCode: "",
    bankName: "",
    branchName: "",
    branchCode: "",
    accountNumber: "",
    accountHolderKana: "",
    invoiceRegistrationNumber: "",
  },
  lineSignupToken: null,
};

interface Ctx {
  draft: SignupDraft;
  setAgreedItems: (items: ConsentItem[]) => void;
  setAccount: (a: AccountDraft) => void;
  setProfile: (p: ProfileDraft) => void;
  setSnsAccounts: (s: InfluencerSnsAccountInput[]) => void;
  setBank: (b: BankDraft) => void;
  setLineSignupToken: (token: string | null) => void;
  reset: () => void;
}

const SignupCtx = createContext<Ctx | null>(null);

function readStored(): SignupDraft {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...(JSON.parse(raw) as Partial<SignupDraft>) };
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return DEFAULT;
  }
}

export function SignupProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<SignupDraft>(() => readStored());

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft]);

  const setAgreedItems = useCallback(
    (items: ConsentItem[]) => setDraft((d) => ({ ...d, agreedItems: items })),
    [],
  );
  const setAccount = useCallback(
    (a: AccountDraft) => setDraft((d) => ({ ...d, account: a })),
    [],
  );
  const setProfile = useCallback(
    (p: ProfileDraft) => setDraft((d) => ({ ...d, profile: p })),
    [],
  );
  const setSnsAccounts = useCallback(
    (s: InfluencerSnsAccountInput[]) =>
      setDraft((d) => ({ ...d, snsAccounts: s })),
    [],
  );
  const setBank = useCallback(
    (b: BankDraft) => setDraft((d) => ({ ...d, bank: b })),
    [],
  );
  const setLineSignupToken = useCallback(
    (token: string | null) =>
      setDraft((d) => ({ ...d, lineSignupToken: token })),
    [],
  );
  const reset = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setDraft(DEFAULT);
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      draft,
      setAgreedItems,
      setAccount,
      setProfile,
      setSnsAccounts,
      setBank,
      setLineSignupToken,
      reset,
    }),
    [
      draft,
      setAgreedItems,
      setAccount,
      setProfile,
      setSnsAccounts,
      setBank,
      setLineSignupToken,
      reset,
    ],
  );

  return <SignupCtx.Provider value={value}>{children}</SignupCtx.Provider>;
}

export function useSignup(): Ctx {
  const v = useContext(SignupCtx);
  if (!v) throw new Error("useSignup must be inside SignupProvider");
  return v;
}

export type { BankDraft };
