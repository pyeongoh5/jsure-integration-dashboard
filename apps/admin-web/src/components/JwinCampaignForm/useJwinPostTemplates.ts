import { useCallback, useEffect, useState } from "react";
import {
  createPostTemplate,
  deletePostTemplate,
  fetchPostTemplates,
  jwinErrorMessage,
  type AdminPostTemplate,
  type AdminPostTemplateCreate,
} from "@/domains/jwin";
import { useT } from "@/lib/i18n";

export type UseJwinPostTemplatesResult = {
  loading: boolean;
  loadError: string | null;
  templates: AdminPostTemplate[];
  reload: () => void;
  /** 성공하면 null, 실패하면 사용자에게 보여줄 메시지 */
  add: (body: Omit<AdminPostTemplateCreate, "campaignId">) => Promise<string | null>;
  remove: (templateId: string) => Promise<string | null>;
};

/** 소재 목록 + 등록/삭제. 목록은 activeFrom 오름차순으로 정렬해 돌려준다. */
export function useJwinPostTemplates(campaignId: string): UseJwinPostTemplatesResult {
  const t = useT();
  const [templates, setTemplates] = useState<AdminPostTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchPostTemplates(campaignId)
      .then((result) => {
        if (cancelled) return;
        const sorted = [...result.postTemplates].sort((left, right) =>
          left.activeFrom.localeCompare(right.activeFrom),
        );
        setTemplates(sorted);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(jwinErrorMessage(error, t("jwin.postTemplate.loadFailed")));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId, reloadKey, t]);

  const reload = useCallback(() => setReloadKey((current) => current + 1), []);

  const add = useCallback(
    async (body: Omit<AdminPostTemplateCreate, "campaignId">): Promise<string | null> => {
      try {
        await createPostTemplate({ ...body, campaignId });
        reload();
        return null;
      } catch (error: unknown) {
        return jwinErrorMessage(error, t("jwin.postTemplate.error.addFailed"));
      }
    },
    [campaignId, reload, t],
  );

  const remove = useCallback(
    async (templateId: string): Promise<string | null> => {
      try {
        await deletePostTemplate(templateId);
        reload();
        return null;
      } catch (error: unknown) {
        return jwinErrorMessage(error, t("jwin.postTemplate.error.deleteFailed"));
      }
    },
    [reload, t],
  );

  return { loading, loadError, templates, reload, add, remove };
}
