import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import ts from "typescript-eslint";

export default defineConfig([
	js.configs.recommended,
	...ts.configs.recommended,
	{
		rules: {
			"no-unused-vars": [
				"warn",
				{
					"argsIgnorePattern": "^_",
					"varsIgnorePattern": "^_",
					"caughtErrorsIgnorePattern": "^_"
				}
			]
		}
	}
]);
