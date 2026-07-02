import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { UpdateInfluencerAddressRequest } from "@jsure/shared";
import { fetchMe } from "@/domains/auth";
import { updateAddress } from "@/domains/me";
import { PageHeader } from "../../components/composites/PageHeader";
import { PrimaryButton } from "../../components/composites/PrimaryButton";
import { AddressFormFields, AddressZodSchema } from "@/domains/me";
import { ErrorBanner } from "../../components/composites/ErrorBanner";
import { t } from "@i18n";

const schema = AddressZodSchema;
type Values = z.infer<typeof schema>;

const EMPTY: Values = {
  postalCode: "",
  prefecture: "" as Values["prefecture"],
  city: "",
  addressLine1: "",
  addressLine2: "",
};

export function MeAddress() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["me"], queryFn: fetchMe });
  const [serverError, setServerError] = useState<string | null>(null);

  const methods = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (data?.address) {
      methods.reset({
        postalCode: data.address.postalCode,
        prefecture: data.address.prefecture as Values["prefecture"],
        city: data.address.city,
        addressLine1: data.address.addressLine1,
        addressLine2: data.address.addressLine2 ?? "",
      });
    }
  }, [data, methods]);

  const mutation = useMutation({
    mutationFn: (values: Values) =>
      updateAddress(values as UpdateInfluencerAddressRequest),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      nav("/me");
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      setServerError(error?.response?.data?.message ?? t("pages.me.address.saveFailed"));
    },
  });

  function save(values: Values) {
    setServerError(null);
    mutation.mutate(values);
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(save)}>
        <PageHeader showBack title={t("pages.me.address.title")} />
        <div style={{ padding: 16 }}>
          {serverError && <ErrorBanner message={serverError} />}
          <AddressFormFields showHeading={false} />
          <PrimaryButton
            onClick={() => methods.handleSubmit(save)()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? t("pages.me.address.saving") : t("pages.me.address.save")}
          </PrimaryButton>
        </div>
      </form>
    </FormProvider>
  );
}
