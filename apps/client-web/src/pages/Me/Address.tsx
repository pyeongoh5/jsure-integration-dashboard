import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMe } from "../../lib/api/auth";
import { updateAddress } from "../../lib/api/me";
import { PageHeader } from "../../components/layout/PageHeader";
import { PrimaryButton } from "../../components/form/PrimaryButton";
import {
  AddressFormFields,
  validateAddress,
  type AddressValues,
} from "../../components/Address/AddressFormFields";
import { ErrorBanner } from "../../components/form/ErrorBanner";

const EMPTY: AddressValues = {
  postalCode: "",
  prefecture: "",
  city: "",
  addressLine1: "",
  addressLine2: "",
};

export function MeAddress() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["me"], queryFn: fetchMe });

  const [address, setAddress] = useState<AddressValues>(EMPTY);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data?.address) {
      setAddress({
        postalCode: data.address.postalCode,
        prefecture: data.address.prefecture,
        city: data.address.city,
        addressLine1: data.address.addressLine1,
        addressLine2: data.address.addressLine2 ?? "",
      });
    }
  }, [data]);

  const errors = validateAddress(address);
  const valid = !Object.values(errors).some((e) => e);

  const m = useMutation({
    mutationFn: () => updateAddress(address),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      nav("/me");
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message ?? "保存に失敗しました");
    },
  });

  function save() {
    setTouched(true);
    setError(null);
    if (!valid) return;
    m.mutate();
  }

  return (
    <div>
      <PageHeader showBack title="配送先住所" />
      <div style={{ padding: 16 }}>
        {error && <ErrorBanner message={error} />}
        <AddressFormFields
          values={address}
          onChange={setAddress}
          touched={touched}
          errors={errors}
          showHeading={false}
        />
        <PrimaryButton onClick={save} disabled={m.isPending}>
          {m.isPending ? "保存中…" : "保存"}
        </PrimaryButton>
      </div>
    </div>
  );
}
