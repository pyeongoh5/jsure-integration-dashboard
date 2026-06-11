import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMe } from "../../lib/api/auth";
import { updateProfile } from "../../lib/api/me";
import { PageHeader } from "../../components/layout/PageHeader";
import { LabeledInput } from "../../components/form/LabeledInput";
import { PrimaryButton } from "../../components/form/PrimaryButton";

const KANA_RE = /^[゠-ヿ　\sー]+$/;

export function MeProfile() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["me"], queryFn: fetchMe });

  const [name, setName] = useState("");
  const [nameKana, setNameKana] = useState("");
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (data) {
      setName(data.name);
      setNameKana(data.nameKana ?? "");
      setPhone(data.phone);
    }
  }, [data]);

  const errors = {
    name: name.trim() ? undefined : "必須",
    nameKana: KANA_RE.test(nameKana) ? undefined : "カナで入力",
    phone: /^\d{10,15}$|^[\d-]{10,20}$/.test(phone) ? undefined : "10~15桁",
  };
  const valid = !Object.values(errors).some((e) => e);

  const m = useMutation({
    mutationFn: () =>
      updateProfile({
        name,
        nameKana,
        phone: phone.replace(/[^\d]/g, ""),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      nav("/me");
    },
  });

  function save() {
    setTouched(true);
    if (!valid) return;
    m.mutate();
  }

  return (
    <div>
      <PageHeader showBack title="プロフィール" />
      <div style={{ padding: 16 }}>
        <LabeledInput
          label="お名前"
          value={name}
          onChange={setName}
          error={touched ? errors.name : undefined}
        />
        <LabeledInput
          label="お名前 (カナ)"
          value={nameKana}
          onChange={setNameKana}
          error={touched ? errors.nameKana : undefined}
        />
        <LabeledInput
          label="電話番号"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={setPhone}
          error={touched ? errors.phone : undefined}
        />

        {/* 변경 불가 정보 — 표시 전용 */}
        <div className="li">
          <span className="li__label">メールアドレス</span>
          <div
            className="li__input"
            style={{ background: "#f3f4f6", color: "#6b7280" }}
          >
            {data?.email ?? "—"}
          </div>
        </div>
        <div className="li">
          <span className="li__label">生年月日</span>
          <div
            className="li__input"
            style={{ background: "#f3f4f6", color: "#6b7280" }}
          >
            {data?.birthDate ?? "—"}
          </div>
        </div>

        <PrimaryButton onClick={save} disabled={m.isPending}>
          {m.isPending ? "保存中…" : "保存"}
        </PrimaryButton>
      </div>
    </div>
  );
}
