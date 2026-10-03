'use client';

import { use, useEffect, useState } from 'react';
import { api } from '../../../../lib/api';
import styles from './shipping.module.css';

type ShippingForm = {
  fullName: string;
  nameKana: string;
  phone: string;
  postalCode: string;
  prefecture: string;
  address1: string;
  address2: string;
};

type ShippingState = {
  prizeName: string;
  xUsername: string;
  closed: boolean;
  entered: boolean;
  shipping: Partial<ShippingForm> | null;
};

const EMPTY: ShippingForm = {
  fullName: '',
  nameKana: '',
  phone: '',
  postalCode: '',
  prefecture: '',
  address1: '',
  address2: '',
};

/**
 * 현물 당첨자 배송지 입력 폼 (§3.2 경품=현물 분기).
 * 새로고침·재진입하면 저장된 값을 불러와 복구하고, 마감 전까지는 수정도 가능하다.
 * 톤앤매너는 jsure-dashboard(client-web) 디자인 토큰을 따른다.
 */
export default function ShippingPage({ params }: { params: Promise<{ winnerId: string }> }) {
  const { winnerId } = use(params);
  const [state, setState] = useState<ShippingState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ShippingForm>(EMPTY);

  useEffect(() => {
    api<ShippingState>(`/winners/${winnerId}/shipping`)
      .then((result) => {
        setState(result);
        if (result.shipping) setForm({ ...EMPTY, ...result.shipping });
        setEditing(!result.entered);
      })
      .catch((caught) => {
        const status = (caught as { status?: number }).status;
        setLoadError(
          status === 401
            ? '応募に使ったXアカウントでログインしてください。'
            : '読み込みに失敗しました。時間をおいて再度お試しください。',
        );
      });
  }, [winnerId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api(`/winners/${winnerId}/shipping`, { method: 'POST', body: JSON.stringify(form) });
      setState((previous) =>
        previous ? { ...previous, entered: true, shipping: form } : previous,
      );
      setEditing(false);
    } catch (submitError) {
      const status = (submitError as { status?: number }).status;
      // 캠페인 종료 후 입력 잠금 (F-6.3)
      if (status === 409) setError('キャンペーン終了のため配送先の入力は締め切りました。');
      else setError('送信できませんでした。入力内容をご確認ください。');
    } finally {
      setSaving(false);
    }
  }

  const shell = (children: React.ReactNode) => (
    <div className={styles.page}>
      <div className={styles.card}>{children}</div>
    </div>
  );

  if (loadError) return shell(<p style={{ margin: 0 }}>{loadError}</p>);
  if (!state) return shell(<p style={{ margin: 0, color: '#6b7280' }}>読み込み中…</p>);

  if (state.closed && !state.entered) {
    return shell(
      <>
        <h2 className={styles.title}>配送先の入力は締め切りました</h2>
        <p className={styles.subtitle}>
          キャンペーン終了のため、配送先の入力を受け付けられません。
        </p>
      </>,
    );
  }

  // 입력 완료 화면 — 마감 전이면 수정 입구를 열어둔다
  if (!editing) {
    const summaryRow = (label: string, value?: string) =>
      value ? (
        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>{label}</span>
          <span>{value}</span>
        </div>
      ) : null;
    return shell(
      <>
        <h2 className={styles.title}>配送先を受け付けました</h2>
        <p className={styles.subtitle}>
          <strong>{state.prizeName}</strong> の発送までしばらくお待ちください。
        </p>
        {state.shipping && (
          <div className={styles.summary}>
            {summaryRow('お名前', state.shipping.fullName)}
            {summaryRow('フリガナ', state.shipping.nameKana)}
            {summaryRow('電話番号', state.shipping.phone)}
            {summaryRow('郵便番号', state.shipping.postalCode)}
            {summaryRow(
              '住所',
              `${state.shipping.prefecture ?? ''}${state.shipping.address1 ?? ''} ${state.shipping.address2 ?? ''}`.trim(),
            )}
          </div>
        )}
        {!state.closed && (
          <button className={styles.secondaryButton} onClick={() => setEditing(true)}>
            配送先を修正する
          </button>
        )}
      </>,
    );
  }

  const field = (
    key: keyof ShippingForm,
    label: string,
    options: {
      required?: boolean;
      placeholder?: string;
      pattern?: string;
      title?: string;
      hint?: string;
    } = {},
  ) => (
    <label className={styles.field}>
      <span className={styles.label}>
        {label}
        {options.required !== false && <span className={styles.required}>*</span>}
      </span>
      <input
        className={styles.input}
        required={options.required !== false}
        value={form[key]}
        placeholder={options.placeholder}
        pattern={options.pattern}
        title={options.title}
        onChange={(changeEvent) => setForm({ ...form, [key]: changeEvent.target.value })}
      />
      {options.hint && <span className={styles.hint}>{options.hint}</span>}
    </label>
  );

  return shell(
    <>
      <h2 className={styles.title}>配送先の入力</h2>
      <p className={styles.subtitle}>
        賞品: <strong>{state.prizeName}</strong>
      </p>

      <label className={styles.field}>
        <span className={styles.label}>X（旧Twitter）ユーザー名</span>
        <input className={styles.input} value={`@${state.xUsername}`} disabled />
      </label>

      <form onSubmit={submit}>
        {field('fullName', 'お名前')}
        {field('nameKana', 'お名前（フリガナ）', { placeholder: 'ヤマダ タロウ' })}
        {field('phone', '電話番号', {
          placeholder: '09012345678',
          pattern: '[0-9]{10,11}',
          title: 'ハイフンなしの数字10〜11桁',
          hint: 'ハイフンなしで入力してください',
        })}
        {field('postalCode', '郵便番号', {
          placeholder: '123-4567',
          pattern: '[0-9]{3}-[0-9]{4}',
          title: '例: 123-4567',
          hint: 'ハイフンありで入力してください',
        })}
        {field('prefecture', '都道府県', { placeholder: '東京都' })}
        {field('address1', '住所（市区町村・番地）')}
        {field('address2', '建物名・部屋番号', { required: false })}
        {error && <p className={styles.error}>{error}</p>}
        <button type="submit" className={styles.submit} disabled={saving}>
          {saving ? '送信中…' : '送信する'}
        </button>
      </form>
    </>,
  );
}
