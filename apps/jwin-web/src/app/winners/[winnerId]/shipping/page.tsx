'use client';

import { use, useEffect, useState } from 'react';
import { api } from '../../../../lib/api';

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
  shipping: (Partial<ShippingForm> & { nameKana?: string }) | null;
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

  if (loadError) {
    return <main style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}>{loadError}</main>;
  }
  if (!state) {
    return <main style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}>読み込み中…</main>;
  }

  if (state.closed && !state.entered) {
    return (
      <main style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}>
        <h2>配送先の入力は締め切りました</h2>
        <p>キャンペーン終了のため、配送先の入力を受け付けられません。</p>
      </main>
    );
  }

  // 입력 완료 화면 — 마감 전이면 수정 입구를 열어둔다
  if (!editing) {
    return (
      <main style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}>
        <h2>配送先を受け付けました</h2>
        <p>
          <strong>{state.prizeName}</strong> の発送までしばらくお待ちください。
        </p>
        {state.shipping && (
          <p style={{ fontSize: 14, color: '#555' }}>
            {state.shipping.fullName} 様／〒{state.shipping.postalCode}／
            {state.shipping.prefecture}
            {state.shipping.address1} {state.shipping.address2}
          </p>
        )}
        {!state.closed && (
          <button onClick={() => setEditing(true)} style={{ padding: '10px 24px' }}>
            配送先を修正する
          </button>
        )}
      </main>
    );
  }

  const field = (
    key: keyof ShippingForm,
    label: string,
    options: { required?: boolean; placeholder?: string; pattern?: string; title?: string } = {},
  ) => (
    <label style={{ display: 'block', marginBottom: 12 }}>
      {label}
      {options.required !== false && <span style={{ color: 'crimson' }}> *</span>}
      <input
        required={options.required !== false}
        value={form[key]}
        placeholder={options.placeholder}
        pattern={options.pattern}
        title={options.title}
        onChange={(changeEvent) => setForm({ ...form, [key]: changeEvent.target.value })}
        style={{ display: 'block', width: '100%', padding: 8, marginTop: 4 }}
      />
    </label>
  );

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}>
      <h2>配送先の入力</h2>
      <p style={{ fontSize: 14, color: '#555' }}>
        賞品: <strong>{state.prizeName}</strong>
      </p>

      <label style={{ display: 'block', marginBottom: 12 }}>
        X（旧Twitter）ユーザー名
        <input
          value={`@${state.xUsername}`}
          disabled
          style={{ display: 'block', width: '100%', padding: 8, marginTop: 4, background: '#f3f4f6' }}
        />
      </label>

      <form onSubmit={submit}>
        {field('fullName', 'お名前')}
        {field('nameKana', 'お名前（フリガナ）', { placeholder: 'ヤマダ タロウ' })}
        {field('phone', '電話番号（ハイフンなし）', {
          placeholder: '09012345678',
          pattern: '[0-9]{10,11}',
          title: 'ハイフンなしの数字10〜11桁',
        })}
        {field('postalCode', '郵便番号（ハイフンあり）', {
          placeholder: '123-4567',
          pattern: '[0-9]{3}-[0-9]{4}',
          title: '例: 123-4567',
        })}
        {field('prefecture', '都道府県')}
        {field('address1', '住所（市区町村・番地）')}
        {field('address2', '建物名・部屋番号', { required: false })}
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
        <button type="submit" disabled={saving} style={{ padding: '12px 32px' }}>
          {saving ? '送信中…' : '送信する'}
        </button>
      </form>
    </main>
  );
}
