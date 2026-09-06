import { useState } from "react";
import {
  createBrandAccount,
  jwinErrorMessage,
  updateBrandAccount,
  type AdminBrandAccount,
  type AdminBrandAccountCreate,
  type AdminBrandAccountPatch,
} from "@/domains/jwin";
import { useT } from "@/lib/i18n";

export function useJwinBrandAccountMutations(onMutated: () => void) {
  const t = useT();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (body: AdminBrandAccountCreate): Promise<AdminBrandAccount | null> => {
    setCreating(true);
    setError(null);
    try {
      const account = await createBrandAccount(body);
      onMutated();
      return account;
    } catch (caught: unknown) {
      setError(jwinErrorMessage(caught, t("jwin.account.createFailed")));
      return null;
    } finally {
      setCreating(false);
    }
  };

  /** 표시명·slug·로고 수정. 성공하면 null, 실패하면 메시지. */
  const edit = async (
    brandAccountId: string,
    body: AdminBrandAccountPatch,
  ): Promise<string | null> => {
    try {
      await updateBrandAccount(brandAccountId, body);
      onMutated();
      return null;
    } catch (caught: unknown) {
      return jwinErrorMessage(caught, t("jwin.account.editFailed"));
    }
  };

  return { creating, error, create, edit };
}
