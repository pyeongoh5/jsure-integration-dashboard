import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SessionSummary } from "@jsure/shared";
import { clearAuth, listMySessions, revokeSession } from "@/lib/auth";
import { ConfirmDialog } from "@/ui/ConfirmDialog";
import "./Settings.css";

function describeDevice(userAgent: string | null): string {
  if (!userAgent) return "알 수 없는 기기";
  const ua = userAgent;
  let os = "Unknown OS";
  if (/Windows/.test(ua)) os = "Windows";
  else if (/Mac OS X|Macintosh/.test(ua)) os = "macOS";
  else if (/iPhone|iPad|iOS/.test(ua)) os = "iOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/Linux/.test(ua)) os = "Linux";

  let browser = "Browser";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua)) browser = "Safari";

  return `${browser} · ${os}`;
}

function formatTime(iso: string, now: Date): string {
  const then = new Date(iso);
  const diffMin = Math.floor((now.getTime() - then.getTime()) / 60_000);
  if (diffMin < 1) return "방금";
  if (diffMin < 60) return `${diffMin}분 전`;
  const hours = Math.floor(diffMin / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "어제";
  if (days < 7) return `${days}일 전`;
  return then.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function Settings() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [pending, setPending] = useState<SessionSummary | null>(null);
  const now = useMemo(() => new Date(), [sessions]);

  async function load() {
    try {
      const rows = await listMySessions();
      setSessions(rows);
      setError(null);
    } catch {
      setError("세션 목록을 불러오지 못했습니다.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function confirmRevoke() {
    if (!pending) return;
    const session = pending;
    setRevokingId(session.id);
    try {
      await revokeSession(session.id);
      if (session.isCurrent) {
        clearAuth();
        navigate("/login", { replace: true });
        return;
      }
      await load();
      setPending(null);
    } catch {
      setError("세션을 종료하지 못했습니다.");
      setPending(null);
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <div className="settings">
      <div>
        <h1 className="settings__title">설정</h1>
        <p className="settings__subtitle">계정 보안과 세션을 관리하세요.</p>
      </div>

      <section className="settings-section">
        <div className="settings-section__head">
          <h2 className="settings-section__title">활성 세션</h2>
          {sessions && (
            <span className="settings__subtitle">{sessions.length}개 기기</span>
          )}
        </div>
        <p className="settings-section__hint">
          로그인 중인 기기 목록입니다. 모르는 기기가 있다면 즉시 종료하세요.
        </p>

        {error ? (
          <div className="settings__state settings__state--error">{error}</div>
        ) : !sessions ? (
          <div className="settings__state">불러오는 중...</div>
        ) : sessions.length === 0 ? (
          <div className="settings__state">활성 세션이 없습니다.</div>
        ) : (
          <div className="sessions">
            {sessions.map((s) => (
              <div
                key={s.id}
                className={`session ${s.isCurrent ? "session--current" : ""}`}
              >
                <div className="session__icon">
                  <i className="fa-solid fa-desktop" />
                </div>
                <div className="session__body">
                  <div className="session__device">
                    <span>{describeDevice(s.userAgent)}</span>
                    {s.isCurrent && (
                      <span className="session__current-tag">현재 세션</span>
                    )}
                  </div>
                  <div className="session__meta">
                    {s.ip ?? "IP 미상"} · 마지막 활동 {formatTime(s.lastSeenAt, now)}
                  </div>
                </div>
                <button
                  type="button"
                  className="session__revoke"
                  onClick={() => setPending(s)}
                  disabled={revokingId === s.id}
                >
                  {revokingId === s.id
                    ? "처리 중..."
                    : s.isCurrent
                      ? "이 세션 종료"
                      : "로그아웃"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={pending !== null}
        title={pending?.isCurrent ? "현재 세션을 종료할까요?" : "이 세션에서 로그아웃할까요?"}
        subtitle={
          pending?.isCurrent
            ? "종료 즉시 로그인 화면으로 이동합니다."
            : `${describeDevice(pending?.userAgent ?? null)} (${pending?.ip ?? "IP 미상"}) 세션이 종료됩니다.`
        }
        confirmLabel={pending?.isCurrent ? "세션 종료" : "로그아웃"}
        cancelLabel="취소"
        tone="danger"
        busy={revokingId !== null}
        onConfirm={confirmRevoke}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
