export default [
  {
    files: ["**/*.js"],
    type: module,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module"
    },
    rules: {
      "no-var": "error",
      "semi": ["error", "always"]
    }
  }
];

