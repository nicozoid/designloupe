const RULES: [RegExp, string][] = [
  [/useNavigate|useLocation|useHref|useRoutes|<Router>|useParams\(\) may be used/i, "Needs a router. Add a <MemoryRouter> to your wrapper (loupe.config.ts → wrapper)."],
  [/i18next|useTranslation|I18nextProvider/i, "Needs i18n. Initialise i18next and add an <I18nextProvider> to your wrapper."],
  [/QueryClient/i, "Needs React Query. Add a <QueryClientProvider client={new QueryClient()}> to your wrapper."],
  [/react-redux|could not find .*store/i, "Needs a redux store. Add a <Provider store={…}> to your wrapper."],
  [/Failed to resolve import|Failed to fetch dynamically imported module|Cannot find module|does not provide an export named/i, "A module failed to load. For framework modules (next/*, etc.) add a shim in loupe.config.ts → shims, or the matching preset."],
  [/process is not defined|process\.env/i, "Code reads process.env. Add the variable to loupe.config.ts → define, e.g. { \"process.env.API_URL\": '\"\"' }."],
  [/(window|document|localStorage|navigator) is not defined/i, "Touches a browser-only global at import time. It may still work in the viewer: doctor loads modules in Node."],
  [/must be (used|rendered) (with)?in|outside of .*Provider|useContext/i, "A context provider is missing. Add it to your wrapper."],
];

/** A one-line suggestion for a common import/render failure, or undefined. */
export function hintFor(message: string): string | undefined {
  return RULES.find(([re]) => re.test(message))?.[1];
}
