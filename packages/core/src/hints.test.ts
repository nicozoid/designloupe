import { it, expect } from "vitest";
import { hintFor } from "./hints";

it("maps common failures to the config fix", () => {
  expect(hintFor("useNavigate() may be used only in the context of a <Router> component.")).toMatch(/MemoryRouter/);
  expect(hintFor("You will need to pass in an i18next instance by using initReactI18next")).toMatch(/I18nextProvider/);
  expect(hintFor("No QueryClient set, use QueryClientProvider to set one")).toMatch(/QueryClientProvider/);
  expect(hintFor("could not find react-redux context value")).toMatch(/redux/i);
  expect(hintFor('Failed to resolve import "next/headers" from "src/x.tsx"')).toMatch(/shims/);
  expect(hintFor("process is not defined")).toMatch(/define/);
  expect(hintFor("window is not defined")).toMatch(/browser-only/);
  expect(hintFor("useFoo must be used within a FooProvider")).toMatch(/wrapper/);
  expect(hintFor("something else")).toBeUndefined();
});
