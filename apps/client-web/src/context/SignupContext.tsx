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
  InfluencerEntityType,
  InfluencerSnsAccountInput,
} from "@jsure/shared";

const STORAGE_KEY = "signupDraft";

interface ProfileDraft {
  name: string;
  nameKana: string;
  phone: string;
  entityType: InfluencerEntityType | null;
}

interface AccountDraft {
  email: string;
  password: string;
}

interface BankDraft {
  ownerType: InfluencerEntityType | null;
  bankCode: string;
  bankName: string;
  branchName: string;
  accountType: "FUTSU" | "TOUZA" | null;
  accountNumber: string;
  accountHolderKana: string;
}

interface SignupDraft {
  agreedItems: ConsentItem[];
  account: AccountDraft;
  profile: ProfileDraft;
  snsAccounts: InfluencerSnsAccountInput[];
  bank: BankDraft;
}

const DEFAULT: SignupDraft = {
  agreedItems: [],
  account: { email: "", password: "" },
  profile: { name: "", nameKana: "", phone: "", entityType: null },
  snsAccounts: [],
  bank: {
    ownerType: null,
    bankCode: "",
    bankName: "",
    branchName: "",
    accountType: null,
    accountNumber: "",
    accountHolderKana: "",
  },
};

interface Ctx {
  draft: SignupDraft;
  setAgreedItems: (items: ConsentItem[]) => void;
  setAccount: (a: AccountDraft) => void;
  setProfile: (p: ProfileDraft) => void;
  setSnsAccounts: (s: InfluencerSnsAccountInput[]) => void;
  setBank: (b: BankDraft) => void;
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
  const [draft, setDraft] = useState<SignupDraft>(DEFAULT);

  useEffect(() => {
    setDraft(readStored());
  }, []);

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
      reset,
    }),
    [draft, setAgreedItems, setAccount, setProfile, setSnsAccounts, setBank, reset],
  );

  return <SignupCtx.Provider value={value}>{children}</SignupCtx.Provider>;
}

export function useSignup(): Ctx {
  const v = useContext(SignupCtx);
  if (!v) throw new Error("useSignup must be inside SignupProvider");
  return v;
}

export type { BankDraft };
