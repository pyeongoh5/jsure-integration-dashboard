import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InfluencerEntityType } from "@jsure/shared";
import { fetchMe } from "../../lib/api/auth";
import { updateProfile } from "../../lib/api/me";
import { PageHeader } from "../../components/layout/PageHeader";
import { LabeledInput } from "../../components/form/LabeledInput";
import { RadioGroup } from "../../components/form/RadioGroup";
import { PrimaryButton } from "../../components/form/PrimaryButton";

const KANA_RE = /^[゠-ヿ　\sー]+$/;

export function MeProfile() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["me"], queryFn: fetchMe });

  const [name, setName] = useState("");
  const [nameKana, setNameKana] = useState("");
  const [phone, setPhone] = useState("");
  const [entityType, setEntityType] = useState<InfluencerEntityType | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (data) {
      setName(data.name);
      setNameKana(data.nameKana ?? "");
      setPhone(data.phone);
      setEntityType(data.entityType);
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
        entityType: entityType!,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      nav("/me");
    },
  });

  function save() {
    setTouched(true);
    if (!valid || !entityType) return;
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
        <RadioGroup<InfluencerEntityType>
          label="種別"
          value={entityType}
          options={[
            { value: "INDIVIDUAL", label: "個人" },
            { value: "CORPORATE", label: "法人" },
          ]}
          onChange={setEntityType}
        />
        <PrimaryButton onClick={save} disabled={m.isPending}>
          {m.isPending ? "保存中…" : "保存"}
        </PrimaryButton>
      </div>
    </div>
  );
}
