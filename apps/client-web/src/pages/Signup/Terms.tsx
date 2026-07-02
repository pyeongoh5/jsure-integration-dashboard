import { useNavigate } from "react-router-dom";
import { useForm, FormProvider, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { INFLUENCER_TERMS, ConsentItemSchema, type ConsentItem } from "@jsure/shared";
import { TermsAccordion } from "@/domains/auth";
import { t } from "@i18n";
import { WizardFooter } from "@/components/composites/WizardFooter/WizardFooter";
import { useSignup } from "../../context/SignupContext";

const ALL_KEYS = INFLUENCER_TERMS.map((term) => term.key);

const schema = z.object({
  agreedItems: z
    .array(ConsentItemSchema)
    .refine((items) => ALL_KEYS.every((key) => items.includes(key)), {
      message: t("pages.signup.terms.agreeAllRequired"),
    }),
});
type Values = z.infer<typeof schema>;

export function SignupTerms() {
  const nav = useNavigate();
  const { draft, setAgreedItems } = useSignup();
  const methods = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { agreedItems: draft.agreedItems },
  });
  const agreedItems = useWatch({
    control: methods.control,
    name: "agreedItems",
  });
  const agreedSet = new Set<ConsentItem>(agreedItems ?? []);
  const allChecked = ALL_KEYS.every((key) => agreedSet.has(key));

  function toggle(key: ConsentItem) {
    const next = new Set(agreedSet);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    methods.setValue("agreedItems", Array.from(next), {
      shouldDirty: true,
      shouldValidate: methods.formState.isSubmitted,
    });
  }

  function toggleAll() {
    methods.setValue("agreedItems", allChecked ? [] : [...ALL_KEYS], {
      shouldDirty: true,
      shouldValidate: methods.formState.isSubmitted,
    });
  }

  function next(values: Values) {
    setAgreedItems(values.agreedItems);
    nav("/signup/account");
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(next)}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>
          {t("pages.signup.terms.heading")}
        </h2>
        <TermsAccordion
          agreed={agreedSet}
          onToggle={toggle}
          onToggleAll={toggleAll}
        />
        <WizardFooter
          onBack={() => nav("/")}
          onNext={methods.handleSubmit(next)}
          disabled={!allChecked}
        />
      </form>
    </FormProvider>
  );
}
