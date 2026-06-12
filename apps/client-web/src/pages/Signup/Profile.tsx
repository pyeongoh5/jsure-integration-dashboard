import { useNavigate } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui";
import { FormField } from "@/components/composites";
import labeledInputStyles from "@/components/composites/LabeledInput.module.css";
import { WizardFooter } from "@/components/composites/WizardFooter/WizardFooter";
import { useSignup } from "../../context/SignupContext";
import { AddressFormFields, AddressZodSchema } from "@/domains/me";

const KANA_RE = /^[゠-ヿ　\sー]+$/;
const BIRTH_RE = /^\d{4}-\d{2}-\d{2}$/;
const TODAY_YMD = new Date().toISOString().slice(0, 10);

const schema = z.object({
  name: z
    .string()
    .refine((value) => value.trim().length > 0, "お名前は必須"),
  nameKana: z.string().regex(KANA_RE, "カナで入力してください"),
  phone: z
    .string()
    .refine(
      (value) => /^\d{10,15}$|^[\d-]{10,20}$/.test(value),
      "電話番号は10~15桁",
    ),
  birthDate: z
    .string()
    .refine(
      (value) => BIRTH_RE.test(value) && value <= TODAY_YMD,
      "生年月日を入力してください",
    ),
  address: AddressZodSchema,
});
type Values = z.infer<typeof schema>;

export function SignupProfile() {
  const nav = useNavigate();
  const { draft, setProfile } = useSignup();
  const methods = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: draft.profile.name,
      nameKana: draft.profile.nameKana,
      phone: draft.profile.phone,
      birthDate: draft.profile.birthDate,
      address: {
        postalCode: draft.profile.postalCode,
        prefecture: draft.profile.prefecture as Values["address"]["prefecture"],
        city: draft.profile.city,
        addressLine1: draft.profile.addressLine1,
        addressLine2: draft.profile.addressLine2,
      },
    },
  });

  function next(values: Values) {
    setProfile({
      name: values.name,
      nameKana: values.nameKana,
      phone: values.phone,
      birthDate: values.birthDate,
      postalCode: values.address.postalCode,
      prefecture: values.address.prefecture,
      city: values.address.city,
      addressLine1: values.address.addressLine1,
      addressLine2: values.address.addressLine2,
    });
    nav("/signup/sns");
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(next)}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>
          プロフィール
        </h2>
        <FormField name="name" label="お名前">
          {(field) => (
            <Input
              id={field.id}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={field.error}
              aria-invalid={field["aria-invalid"]}
            />
          )}
        </FormField>
        <FormField
          name="nameKana"
          label="お名前 (カナ)"
          hint="例: ヤマダ ハナコ"
        >
          {(field) => (
            <Input
              id={field.id}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={field.error}
              aria-invalid={field["aria-invalid"]}
            />
          )}
        </FormField>
        <FormField name="phone" label="電話番号">
          {(field) => (
            <Input
              id={field.id}
              type="tel"
              inputMode="tel"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={field.error}
              placeholder="09012345678"
              aria-invalid={field["aria-invalid"]}
            />
          )}
        </FormField>
        <FormField name="birthDate" label="生年月日">
          {(field) => (
            <input
              id={field.id}
              type="date"
              className={[
                labeledInputStyles.input,
                field.error && labeledInputStyles.error,
              ]
                .filter(Boolean)
                .join(" ")}
              value={field.value}
              max={TODAY_YMD}
              onChange={(event) => field.onChange(event.target.value)}
              onBlur={field.onBlur}
              aria-invalid={field["aria-invalid"]}
            />
          )}
        </FormField>

        <AddressFormFields prefix="address" />

        <WizardFooter
          onBack={() => nav(-1)}
          onNext={methods.handleSubmit(next)}
        />
      </form>
    </FormProvider>
  );
}
