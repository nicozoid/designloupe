import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "@target/src/i18n";

/** Providers every preview needs. Never add a ThemeProvider here: Loupe supplies the theme. */
export default function Wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </MemoryRouter>
  );
}
