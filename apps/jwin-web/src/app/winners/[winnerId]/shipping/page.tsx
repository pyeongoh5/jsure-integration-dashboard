'use client';

import { use, useState } from 'react';
import { api } from '../../../../lib/api';

/** 현물 당첨자 배송지 입력 폼 (§3.2 경품=현물 분기) */
export default function ShippingPage({ params }: { params: Promise<{ winnerId: string }> }) {
  const { winnerId } = use(params);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    postalCode: '',
    prefecture: '',
    address1: '',
    address2: '',
    fullName: '',
    phone: '',
  });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await api(`/winners/${winnerId}/shipping`, { method: 'POST', body: JSON.stringify(form) });
      setDone(true);
    } catch (submitError) {
      const status = (submitError as { status?: number }).status;
      // 캠페인 종료 후 입력 잠금 (F-6.3)
      if (status === 409) setError('キャンペーン終了のため配送先の入力は締め切りました。');
      else setError('送信できませんでした。入力内容をご確認ください。');
    }
  }

  if (done) {
    return (
      <main style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}>
        <h2>配送先を受け付けました</h2>
        <p>賞品の発送までしばらくお待ちください。</p>
      </main>
    );
  }

  const field = (key: keyof typeof form, label: string, required = true) => (
    <label style={{ display: 'block', marginBottom: 12 }}>
      {label}
      <input
        required={required}
        value={form[key]}
        onChange={(changeEvent) => setForm({ ...form, [key]: changeEvent.target.value })}
        style={{ display: 'block', width: '100%', padding: 8, marginTop: 4 }}
      />
    </label>
  );

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}>
      <h2>配送先の入力</h2>
      <form onSubmit={submit}>
        {field('fullName', 'お名前')}
        {field('postalCode', '郵便番号')}
        {field('prefecture', '都道府県')}
        {field('address1', '住所')}
        {field('address2', '建物名・部屋番号', false)}
        {field('phone', '電話番号')}
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
        <button type="submit" style={{ padding: '12px 32px' }}>
          送信する
        </button>
      </form>
    </main>
  );
}
