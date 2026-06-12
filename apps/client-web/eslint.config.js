import js from "@eslint/js";
import tseslint from "typescript-eslint";

const SHARED_RESTRICTED_PATTERNS = [
  {
    group: ["@jsure/shared/dist", "@jsure/shared/dist/*"],
    message:
      "@jsure/shared 의 dist 경로를 직접 import 하지 마세요. 패키지 루트('@jsure/shared')에서 가져옵니다.",
  },
  {
    group: [
      "@/domains/*/api",
      "@/domains/*/api/*",
      "@/domains/*/hooks",
      "@/domains/*/hooks/*",
      "@/domains/*/utils",
      "@/domains/*/utils/*",
      "@/domains/*/types",
      "@/domains/*/types/*",
      "@/domains/*/components/*",
    ],
    message:
      "도메인 모듈의 내부 파일을 직접 import 하지 마세요. '@/domains/<domain>'(barrel)을 사용합니다.",
  },
];

const PARENT_RELATIVE_PATTERNS = [
  {
    group: ["../../*", "../../../*", "../../../../*"],
    message:
      "두 단계 이상 상대 경로(../../)는 금지입니다. '@/' alias 를 사용하세요.",
  },
];

export default tseslint.config(
  { ignores: ["dist", "node_modules", ".turbo"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: SHARED_RESTRICTED_PATTERNS },
      ],
      "no-irregular-whitespace": [
        "error",
        { skipStrings: true, skipComments: true, skipRegExps: true },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: [
      "src/components/ui/**/*.{ts,tsx}",
      "src/components/composites/**/*.{ts,tsx}",
      "src/domains/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...SHARED_RESTRICTED_PATTERNS,
            ...PARENT_RELATIVE_PATTERNS,
          ],
        },
      ],
    },
  },
);
