import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const eslintConfig = [...nextCoreWebVitals, ...nextTypescript, {
  rules: {
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "prefer-const": "warn",
    "no-console": ["warn", { allow: ["warn", "error"] }],
    "no-case-declarations": "warn",
    "no-fallthrough": "warn",
    "no-irregular-whitespace": "warn",
    "no-useless-escape": "warn",
  },
}, {
  ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts", "examples/**", "skills", "mini-services/**", "hooks/**", ".opencode/**", "prisma/**", "server.ts"]
}];

export default eslintConfig;
