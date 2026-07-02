import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getTemplate,
  previewTemplate,
  testSendTemplate,
  updateAdminTestLineUserId,
  updateTemplate,
  TRIGGER_LABELS,
  VariablesPanel,
  type CampaignCategory,
  type LineMessageTemplateDetailResponse,
  type LineTriggerKey,
  type LineTriggerSubType,
} from "@/domains/messageTemplate";
import { Button, Checkbox, Dialog, Input, Textarea } from "@/components/ui";
import styles from "./MessageTemplates.module.css";

const VAR_PATTERN = /\{\{\s*(\w+)\s*\}\}/g;

function findUnknownVariables(body: string, allowed: string[]): string[] {
  const set = new Set(allowed);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const match of body.matchAll(VAR_PATTERN)) {
    const key = match[1];
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
  const [testLineIdDialogOpen, setTestLineIdDialogOpen] = useState(false);
  const [testLineIdInput, setTestLineIdInput] = useState("");
  const [testLineIdSaving, setTestLineIdSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    getTemplate(category, subType, triggerKey).then((res) => {
      setDetail(res);
      setBody(res.template.body);
      setEnabled(res.template.enabled);
    });
  }, [category, subType, triggerKey]);

  if (!detail) {
    return (
      <div className={styles.edit}>
        <div className={styles.state}>불러오는 중…</div>
      </div>
    );
  }

  const unknownVars = findUnknownVariables(
    body,
    detail.variables.map((v) => v.key),
  );
  const validationError =
    body.length > 5000
      ? "본문이 5,000자를 초과했습니다"
      : unknownVars.length > 0
        ? `알 수 없는 변수: ${unknownVars.map((k) => `{{${k}}}`).join(", ")}`
        : enabled && body.trim().length === 0
          ? "발송 활성화 상태에서 본문은 비어있을 수 없습니다"
          : null;

  const insertVariable = (key: string): void => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const next = `${body.substring(0, start)}{{${key}}}${body.substring(end)}`;
    setBody(next);
    setTimeout(() => {
      const pos = start + `{{${key}}}`.length;
      textarea.focus();
      textarea.setSelectionRange(pos, pos);
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
    setError(null);
    try {
      await testSendTemplate(category, subType, triggerKey, body);
      alert("테스트 발송 완료");
    } catch (err) {
      const message = err instanceof Error ? err.message : "테스트 발송 실패";
      if (message.includes("TEST_LINE_USER_ID_MISSING") || message.includes("LINE 사용자 ID")) {
        setTestLineIdInput("");
        setTestLineIdDialogOpen(true);
      } else {
        setError(message);
      }
    }
  };

  const saveTestLineIdAndRetry = async (): Promise<void> => {
    const trimmed = testLineIdInput.trim();
    if (!trimmed) return;
    setTestLineIdSaving(true);
    try {
      await updateAdminTestLineUserId(trimmed);
      setTestLineIdDialogOpen(false);
      await testSendTemplate(category, subType, triggerKey, body);
      alert("테스트 발송 완료");
    } catch (err) {
      setError(err instanceof Error ? err.message : "테스트 발송 실패");
    } finally {
      setTestLineIdSaving(false);
    }
  };

  return (
    <div className={styles.edit}>
      <button
        type="button"
        className={styles.backLink}
        onClick={() => navigate("/message-templates")}
      >
        ← 목록으로
      </button>

      <div className={styles.editHeader}>
        <div className={styles.editTitle}>{TRIGGER_LABELS[triggerKey]}</div>
        {subType && <span className={styles.editSubBadge}>{subType}</span>}
      </div>

      <Checkbox checked={enabled} onChange={setEnabled} label="발송 활성화" />

      <div className={styles.editBody}>
        <div className={styles.editLeft}>
          <Textarea
            ref={textareaRef}
            value={body}
            onChange={setBody}
            rows={20}
            placeholder="LINE으로 발송할 메시지 본문을 입력하세요"
          />
          <div className={styles.counter}>{body.length.toLocaleString()} / 5,000 자</div>
          {validationError && <div className={styles.error}>{validationError}</div>}
          {error && <div className={styles.error}>{error}</div>}
        </div>

        <aside className={styles.editRight}>
          <VariablesPanel variables={detail.variables} onInsert={insertVariable} />
        </aside>
      </div>

      <div className={styles.actions}>
        <Button variant="secondary" onClick={() => navigate("/message-templates")}>
          취소
        </Button>
        <Button variant="secondary" onClick={doPreview} disabled={!!validationError}>
          미리보기
        </Button>
        <Button variant="secondary" onClick={doTestSend} disabled={!!validationError}>
          내 LINE으로 테스트 발송
        </Button>
        <Button variant="primary" onClick={doSave} disabled={!!validationError || saving}>
          {saving ? "저장 중…" : "저장"}
        </Button>
      </div>

      <Dialog
        open={preview !== null}
        onClose={() => setPreview(null)}
        title="미리보기"
        footer={
          <Button variant="secondary" onClick={() => setPreview(null)}>
            닫기
          </Button>
        }
      >
        <div className={styles.previewBox}>{preview}</div>
      </Dialog>

      <Dialog
        open={testLineIdDialogOpen}
        onClose={() => setTestLineIdDialogOpen(false)}
        title="LINE 사용자 ID 등록"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setTestLineIdDialogOpen(false)}
              disabled={testLineIdSaving}
            >
              취소
            </Button>
            <Button
              variant="primary"
              onClick={saveTestLineIdAndRetry}
              disabled={testLineIdSaving || testLineIdInput.trim().length === 0}
            >
              {testLineIdSaving ? "발송 중…" : "저장 후 발송"}
            </Button>
          </>
        }
      >
        <div className={styles.testDialogBody}>
          <div className={styles.testDialogHint}>
            테스트 발송에 사용할 본인의 LINE 사용자 ID를 등록해 주세요. 등록 후 바로 테스트
            메시지가 발송됩니다.
          </div>
          <Input
            value={testLineIdInput}
            onChange={setTestLineIdInput}
            placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            autoFocus
          />
        </div>
      </Dialog>
    </div>
  );
}
