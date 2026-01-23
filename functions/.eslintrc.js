module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
    es2021: true,
  },
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: "script",
  },
  extends: ["eslint:recommended", "google"],
  rules: {
    "no-restricted-globals": ["error", "name", "length"],
    "prefer-arrow-callback": "error",
    quotes: ["error", "double", { allowTemplateLiterals: true }],
  },
  overrides: [
    {
      files: ["index.js", "**/*.js"],
      env: { node: true },
    },
    {
      files: ["**/*.spec.*"],
      env: { mocha: true },
    },
  ],
  globals: {
    require: "readonly",
    module: "readonly",
    __dirname: "readonly",
    __filename: "readonly",
    process: "readonly",
  },
};
