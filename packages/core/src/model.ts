export type Mode = "light" | "dark";
export interface CallSite { file: string; line: number }            // file relative to target root
export interface PropInfo {
  name: string; type: string; required: boolean; defaultValue?: string; description?: string;
  enumValues?: string[];   // unquoted string literal members, when the type is a string-literal union
  inherited: boolean;      // declared in node_modules (e.g. MUI ButtonProps or DOM attributes)
}
export type ComponentSource = { kind: "wraps"; library: string; component: string } | { kind: "custom" };
export interface ComponentInfo {
  id: string;              // `${file}#${exportName}`, e.g. "src/components/PrimaryButton.tsx#PrimaryButton"
  name: string;            // display name
  exportName: string;      // named export or "default"
  file: string;            // relative to target root, posix separators
  folder: string;          // relative dir of file, e.g. "src/components/icons"
  description?: string;
  source: ComponentSource;
  props: PropInfo[];       // own props first, then inherited ones
  inheritedPropCount: number;
  builtFrom: { library: string[]; own: string[] }; // own = component ids
  usages: CallSite[];
  isIcon: boolean;
}
export interface LibraryUsage { component: string; sites: CallSite[] }
export interface IconInfo { name: string; source: "library" | "custom"; importPath: string; componentId?: string; sites: CallSite[] }
export interface StaticFinding { code: string; rule: "colour-literal" | "px-spacing"; file: string; line: number; snippet: string; message: string }
export interface DiscoveryModel {
  name: string; root: string; adapter: string; libraryName: string; libraryVersion?: string;
  themeEntry?: string; themeExport: string;
  components: ComponentInfo[]; libraryUsage: LibraryUsage[]; icons: IconInfo[];
  findings: StaticFinding[]; warnings: string[]; generatedAt: string;
}
