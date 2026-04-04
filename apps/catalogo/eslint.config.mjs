import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
    baseDirectory: __dirname,
});

const eslintConfig = [
    ...compat.extends("next/core-web-vitals"),
    {
        rules: {
            // Regras novas do react-hooks que não existiam antes da migração —
            // desabilitadas para manter o mesmo comportamento de lint anterior.
            "react-hooks/purity": "off",
            "react-hooks/set-state-in-effect": "off",
        },
    },
];

export default eslintConfig;
