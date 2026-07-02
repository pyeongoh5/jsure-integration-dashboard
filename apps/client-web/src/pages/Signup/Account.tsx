import { useNavigate } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui";
import { t } from "@/i18n";
import { FormField } from "@/components/composites";
import { WizardFooter } from "@/components/composites/WizardFooter/WizardFooter";
import { useSignup } from "../../context/SignupContext";

const schema = z.object({
  email: z
    .string()
    .regex(
      /^[^@\s]+@[^@\s]+\.[^@\s]+$/,
      t("pages.signup.account.emailInvalid"),
    ),
});
type Values = z.infer<typeof schema>;

export function SignupAccount() {
  const nav = useNavigate();
  const { draft, setAccount } = useSignup();
  const methods = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: draft.account.email },
  });

  function next(values: Values) {
    setAccount({ email: values.email, password: "" });
    nav("/signup/profile");
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(next)}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>
          {t("pages.signup.account.heading")}
        </h2>
        <p
          style={{
            fontSize: 12,
            color: "#6b7280",
            marginTop: 0,
            marginBottom: 16,
            lineHeight: 1.6,
          }}
        >
          {t("pages.signup.account.hint")}
        </p>
        <FormField name="email" label={t("pages.signup.account.emailLabel")}>
          {(field) => (
            <Input
              id={field.id}
              type="email"
              autoComplete="email"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={field.error}
              placeholder="your@example.com"
              aria-invalid={field["aria-invalid"]}
            />
          )}
        </FormField>
        <WizardFooter
          onBack={() => nav(-1)}
          onNext={methods.handleSubmit(next)}
        />
      </form>
    </FormProvider>
  );
}
