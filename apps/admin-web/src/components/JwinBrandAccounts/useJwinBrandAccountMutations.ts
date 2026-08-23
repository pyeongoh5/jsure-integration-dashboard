import { useState } from "react";
import { createBrandAccount, type AdminBrandAccount } from "@/domains/jwin";

export function useJwinBrandAccountMutations(onMutated: () => void) {
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
      setError(caught instanceof Error ? caught.message : "계정 생성에 실패했습니다.");
      return null;
    } finally {
      setCreating(false);
    }
  };

  return { creating, error, create };
}
