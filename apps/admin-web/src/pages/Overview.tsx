import { getStoredUser } from "@/lib/auth";
import { Link } from "react-router-dom";
import { Card } from "../ui/Card";
import "./Overview.css";
import { ReactNode } from "react";

type Kpi = {
  icon: ReactNode;
  label: string;
  value: string;
  delta?: { text: string; tone: "up" | "down" | "neutral" };
  to?: string;
};

const KPIS: Kpi[] = [
  {
    icon: <i className="fa-solid fa-bullhorn" />,
    label: "모집 중 캠페인",
    value: "14",
    delta: { text: "↑ 3 신규 시작 (이번 주)", tone: "up" },
    to: "/campaigns?status=recruit",
  },
  {
    icon: "✓",
    label: "검토 대기 응모",
    value: "23",
    delta: { text: "평균 처리 시간 4시간", tone: "neutral" },
  },
  {
    icon: <i className="fa-solid fa-file-pen" />,
    label: "초안 검토 대기",
    value: "8",
    delta: { text: "↓ 2 (어제 대비)", tone: "down" },
  },
  {
    icon: <i className="fa-solid fa-money-check-dollar" />,
    label: "지급 대기 금액",
    value: "₩48.2M",
    delta: { text: "12건 정산 대기", tone: "neutral" },
  },
];

const MONTHLY = [
  { m: "5월", v: 38 },
  { m: "6월", v: 48 },
  { m: "7월", v: 36 },
  { m: "8월", v: 56 },
  { m: "9월", v: 50 },
  { m: "10월", v: 60 },
  { m: "11월", v: 70 },
  { m: "12월", v: 64 },
  { m: "1월", v: 76 },
  { m: "2월", v: 82 },
  { m: "3월", v: 90 },
  { m: "4월", v: 100 },
];

// type Activity = {
//   type: "approve" | "draft" | "campaign" | "alert" | "payout" | "complete";
//   text: string;
//   ago: string;
// };

// const ACTIVITIES: Activity[] = [
//   { type: "approve", text: "유나의 응모를 승인 처리했습니다.", ago: "2분 전" },
//   { type: "draft", text: "민준이 비오데르마 캠페인 초안을 제출했습니다.", ago: "15분 전" },
//   {
//     type: "campaign",
//     text: "스타벅스 프라푸치노 서머 캠페인 모집 인원이 90% 채워졌습니다.",
//     ago: "1시간 전",
//   },
//   { type: "alert", text: "@unknown_1234 계정이 의심 활동으로 신고되었습니다.", ago: "2시간 전" },
//   { type: "payout", text: "지윤의 정산 처리가 대기열에 추가되었습니다. (₩18M)", ago: "3시간 전" },
//   { type: "complete", text: "대한항공 호놀룰루 캠페인이 완료 처리되었습니다.", ago: "어제" },
// ];

// const ACTIVITY_STYLE: Record<Activity["type"], { icon: string; bg: string; fg: string }> = {
//   approve: { icon: "✓", bg: "#ecfdf5", fg: "#10b981" },
//   draft: { icon: "✎", bg: "#eff6ff", fg: "#2563eb" },
//   campaign: { icon: "◁", bg: "#eff6ff", fg: "#2563eb" },
//   alert: { icon: "!", bg: "#fef2f2", fg: "#ef4444" },
//   payout: { icon: "$", bg: "#f5f3ff", fg: "#8b5cf6" },
//   complete: { icon: "✓", bg: "#ecfdf5", fg: "#10b981" },
// };

type UrgentRow = {
  type: string;
  tone: "warn" | "info";
  target: string;
  receivedAt: string;
  sla: string;
  slaTone: "danger" | "warn";
  assignee: string;
  action: string;
};

const URGENT: UrgentRow[] = [
  {
    type: "응모 검토",
    tone: "warn",
    target: "유나 → 라이프스토어 그린 프로젝트",
    receivedAt: "2시간 전",
    sla: "D-1",
    slaTone: "warn",
    assignee: "HR",
    action: "검토",
  },
];

export function Overview() {
  const user = getStoredUser();
  const max = Math.max(...MONTHLY.map((m) => m.v));

  return (
    <div className="ov">
      <div className="ov__header">
        <h1 className="ov__title">
          안녕하세요, {user?.name}님 <span className="ov__wave">👋</span>
        </h1>
        <p className="ov__subtitle">오늘 운영 현황을 한눈에 확인하세요.</p>
      </div>

      <div className="ov__kpis">
        {KPIS.map((k) => {
          const card = (
            <Card
              title={
                <>
                  <span className="ov-kpi__icon">{k.icon}</span>
                  <span className="ov-kpi__label">{k.label}</span>
                </>
              }
              content={<div className="ov-kpi__value">{k.value}</div>}
              bottomAffix={
                k.delta && (
                  <span className={`ov-kpi__delta ov-kpi__delta--${k.delta.tone}`}>
                    {k.delta.text}
                  </span>
                )
              }
            />
          );
          return k.to ? (
            <Link key={k.label} to={k.to} className="ov-kpi-link">
              {card}
            </Link>
          ) : (
            <div key={k.label}>{card}</div>
          );
        })}
      </div>

      <div className="ov__row">
        <section className="ov-card ov__chart">
          <header className="ov-card__head">
            <h2>월별 캠페인 응모 추이</h2>
            <span className="ov-card__meta">최근 12개월</span>
          </header>
          <div className="ov-chart">
            {MONTHLY.map((m) => (
              <div key={m.m} className="ov-chart__col">
                <div className="ov-chart__bar-wrap">
                  <div className="ov-chart__bar" style={{ height: `${(m.v / max) * 100}%` }} />
                </div>
                <div className="ov-chart__label">{m.m}</div>
              </div>
            ))}
          </div>
        </section>

        {/* <section className="ov-card ov__activity">
          <header className="ov-card__head">
            <h2>실시간 활동</h2>
            <span className="ov-card__meta">전체</span>
          </header>
          <ul className="ov-activity">
            {ACTIVITIES.map((a, i) => {
              const s = ACTIVITY_STYLE[a.type];
              return (
                <li key={i} className="ov-activity__item">
                  <span className="ov-activity__icon" style={{ background: s.bg, color: s.fg }}>
                    {s.icon}
                  </span>
                  <div className="ov-activity__body">
                    <div className="ov-activity__text">{a.text}</div>
                    <div className="ov-activity__ago">{a.ago}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section> */}
      </div>

      <section className="ov-card ov__urgent">
        <header className="ov-card__head">
          <h2>긴급 처리 항목</h2>
          <span className="ov-card__meta">우선순위 순</span>
        </header>
        <table className="ov-table">
          <thead>
            <tr>
              <th>유형</th>
              <th>대상</th>
              <th>접수 시각</th>
              <th>SLA</th>
              <th>담당자</th>
              <th>액션</th>
            </tr>
          </thead>
          <tbody>
            {URGENT.map((row, i) => (
              <tr key={i}>
                <td>
                  <span className={`ov-tag ov-tag--${row.tone}`}>● {row.type}</span>
                </td>
                <td>{row.target}</td>
                <td>{row.receivedAt}</td>
                <td>
                  <span className={`ov-sla ov-sla--${row.slaTone}`}>{row.sla}</span>
                </td>
                <td>
                  <span className="ov-assignee">{row.assignee}</span>
                </td>
                <td>
                  <button className="ov-action">{row.action}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
