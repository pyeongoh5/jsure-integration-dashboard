import { useCallback, useState } from "react";
import type {
  CreateNoticeRequest,
  NoticeResponse,
  UpdateNoticeRequest,
} from "@jsure/shared";
import { createNotice, deleteNotice, updateNotice } from "../api";

type Options = {
  onMutated?: () => void | Promise<void>;
};

export function useNoticeMutations({ onMutated }: Options = {}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(
    async (input: CreateNoticeRequest): Promise<NoticeResponse | null> => {
      setPendingId("__create__");
      setError(null);
      try {
        const result = await createNotice(input);
        await onMutated?.();
        return result;
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "저장에 실패했습니다",
        );
        return null;
      } finally {
        setPendingId(null);
      }
    },
    [onMutated],
  );

  const update = useCallback(
    async (
      id: string,
      input: UpdateNoticeRequest,
    ): Promise<NoticeResponse | null> => {
      setPendingId(id);
      setError(null);
      try {
        const result = await updateNotice(id, input);
        await onMutated?.();
        return result;
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "저장에 실패했습니다",
        );
        return null;
      } finally {
        setPendingId(null);
      }
    },
    [onMutated],
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      setPendingId(id);
      setError(null);
      try {
        await deleteNotice(id);
        await onMutated?.();
        return true;
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "삭제에 실패했습니다",
        );
        return false;
      } finally {
        setPendingId(null);
      }
    },
    [onMutated],
  );

  return { create, update, remove, pendingId, error };
}
