import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getTemplate,
  previewTemplate,
  testSendTemplate,
  updateTemplate,
  TRIGGER_LABELS,
  VariablesPanel,
  PreviewModal,
  type CampaignCategory,
  type LineMessageTemplateDetailResponse,
  type LineTriggerKey,
  type LineTriggerSubType,
} from "@/domains/messageTemplate";
import styles from "./MessageTemplates.module.css";

const VAR_PATTERN = /\{\{\s*(\w+)\s*\}\}/g;

function findUnknownVariables(body: string, allowed: string[]): string[] {
  const set = new Set(allowed);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const m of body.matchAll(VAR_PATTERN)) {
    const key = m[1];
    if (key === undefined) continue;
    if (!set.has(key) && !seen.has(key)) {
      seen.add(key);
      result.push(key);
    }
  }
  return result;
}

export function MessageTemplateEdit(): JSX.Element {
  const params = useParams<{
    category: CampaignCategory;
    subType: LineTriggerSubType | "none";
    triggerKey: LineTriggerKey;
  }>();
  const navigate = useNavigate();
  const category = params.category!;
  const subType = params.subType === "none" ? null : (params.subType as LineTriggerSubType);
  const triggerKey = params.triggerKey!;

  const [detail, setDetail] = useState<LineMessageTemplateDetailResponse | null>(null);
  const [body, setBody] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    getTemplate(category, subType, triggerKey).then((res) => {
      setDetail(res);
      setBody(res.template.body);
      setEnabled(res.template.enabled);
    });
  }, [category, subType, triggerKey]);

  if (!detail) return <p>로딩중...</p>;

  const unknownVars = findUnknownVariables(
    body,
    detail.variables.map((v) => v.key),
  );
  const validationError =
    body.length > 5000
      ? "본문이 5000자를 초과했습니다"
      : unknownVars.length > 0
        ? `알 수 없는 변수: ${unknownVars.map((k) => `{{${k}}}`).join(", ")}`
        : enabled && body.trim().length === 0
          ? "활성화 상태에서 본문은 비어있을 수 없습니다"
          : null;

  const insertVariable = (key: string): void => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = `${body.substring(0, start)}{{${key}}}${body.substring(end)}`;
    setBody(next);
    setTimeout(() => {
      const pos = start + `{{${key}}}`.length;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    }, 0);
  };

  const doSave = async (): Promise<void> => {
    if (validationError) return;
    setSaving(true);
    setError(null);
    try {
      await updateTemplate(category, subType, triggerKey, { enabled, body });
      navigate("/message-templates");
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const doPreview = async (): Promise<void> => {
    if (validationError) return;
    try {
      const res = await previewTemplate(category, subType, triggerKey, body);
      setPreview(res.renderedBody);
    } catch (err) {
      setError(err instanceof Error ? err.message : "미리보기 실패");
    }
  };

  const doTestSend = async (): Promise<void> => {
    if (validationError) return;
    try {
      await testSendTemplate(category, subType, triggerKey, body);
      alert("테스트 발송 완료");
    } catch (err) {
      setError(err instanceof Error ? err.message : "테스트 발송 실패");
    }
  };

  return (
    <div className={styles.container}>
      <h1>
        {TRIGGER_LABELS[triggerKey]} {subType ? `(${subType})` : ""}
      </h1>

      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        발송 활성화
      </label>

      <div className={styles.editor}>
        <div className={styles.editorLeft}>
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={20}
          />
          <div className={styles.counter}>{body.length} / 5000 자</div>
          {validationError && <div className={styles.error}>{validationError}</div>}
          {error && <div className={styles.error}>{error}</div>}
        </div>
        <div className={styles.editorRight}>
          <VariablesPanel variables={detail.variables} onInsert={insertVariable} />
        </div>
      </div>

      <div className={styles.actions}>
        <button onClick={doPreview} disabled={!!validationError}>
          미리보기
        </button>
        <button onClick={doTestSend} disabled={!!validationError}>
          내 LINE으로 테스트 발송
        </button>
        <button onClick={() => navigate("/message-templates")}>취소</button>
        <button onClick={doSave} disabled={!!validationError || saving}>
          {saving ? "저장중..." : "저장"}
        </button>
      </div>

      {preview !== null && (
        <PreviewModal renderedBody={preview} onClose={() => setPreview(null)} />
      )}
    </div>
  );
}
