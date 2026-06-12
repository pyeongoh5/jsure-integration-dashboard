import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { NoticeForm, type NoticeFormValue, useNoticeMutations, getNotice } from "@/domains/notice";
import "./Notices.css";

type Mode = "create" | "edit";

type Props = {
  mode: Mode;
};

export function NoticeEdit({ mode }: Props) {
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const noticeId = params.id;

  const [initial, setInitial] = useState<NoticeFormValue | null>(
    mode === "create"
      ? {
          title: "",
          contentHtml: "",
          startAt: new Date().toISOString(),
          endAt: (() => {
            const d = new Date();
            d.setDate(d.getDate() + 30);
            return d.toISOString();
          })(),
        }
      : null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const { create, update, pendingId, error } = useNoticeMutations();

  useEffect(() => {
    if (mode !== "edit" || !noticeId) return;
    let cancelled = false;
    (async () => {
      try {
        const notice = await getNotice(noticeId);
        if (cancelled) return;
        setInitial({
          title: notice.title,
          contentHtml: notice.contentHtml,
          startAt: notice.startAt,
          endAt: notice.endAt,
        });
      } catch (caught) {
        if (cancelled) return;
        setLoadError(
          caught instanceof Error ? caught.message : "공지를 불러올 수 없습니다",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, noticeId]);

  async function handleSubmit(value: NoticeFormValue) {
    if (mode === "create") {
      const result = await create(value);
      if (result) navigate("/notices");
    } else if (noticeId) {
      const result = await update(noticeId, value);
      if (result) navigate("/notices");
    }
  }

  if (loadError) {
    return (
      <div className="notices-edit">
        <div className="notices-edit__title">
          {mode === "create" ? "공지 작성" : "공지 편집"}
        </div>
        <div>{loadError}</div>
      </div>
    );
  }

  if (!initial) {
    return (
      <div className="notices-edit">
        <div className="notices-edit__title">불러오는 중…</div>
      </div>
    );
  }

  return (
    <div className="notices-edit">
      <div className="notices-edit__title">
        {mode === "create" ? "공지 작성" : "공지 편집"}
      </div>
      <NoticeForm
        initial={initial}
        busy={pendingId !== null}
        error={error}
        submitLabel={mode === "create" ? "게시" : "저장"}
        onSubmit={handleSubmit}
        onCancel={() => navigate("/notices")}
      />
    </div>
  );
}
