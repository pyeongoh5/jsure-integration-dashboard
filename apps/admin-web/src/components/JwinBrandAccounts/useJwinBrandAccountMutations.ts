import { useState } from "react";
import { createBrandAccount, jwinErrorMessage, type AdminBrandAccount } from "@/domains/jwin";
import { useT } from "@/lib/i18n";

export function useJwinBrandAccountMutations(onMutated: () => void) {
  const t = useT();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (label: string): Promise<AdminBrandAccount | null> => {
    setCreating(true);
    setError(null);
    try {
      const account = await createBrandAccount(label);
      onMutated();
      return account;
    } catch (caught: unknown) {
      setError(jwinErrorMessage(caught, t("jwin.account.createFailed")));
      return null;
    } finally {
      setCreating(false);
    }
  };

  return { creating, error, create };
}
