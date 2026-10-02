declare module "virtual:loupe/model" {
  const model: import("@designloupe/core").DiscoveryModel;
  export default model;
}
declare module "virtual:loupe/components" {
  const components: Record<string, () => Promise<Record<string, unknown>>>;
  export default components;
}
declare module "virtual:loupe/theme" {
  export const loadTheme: null | (() => Promise<unknown>);
}
declare module "virtual:loupe/wrapper" {
  export const loadWrapper: null | (() => Promise<import("react").ComponentType<{ children: import("react").ReactNode }>>);
}
declare module "virtual:loupe/loupe-files" {
  export const componentDocs: (() => Promise<{ default: import("@designloupe/core").ComponentDocInput }>)[];
  export const loadAnomalies: null | (() => Promise<import("@designloupe/core").Anomaly[]>);
  export const loadTokenNotes: null | (() => Promise<import("@designloupe/core").TokenNotes>);
}
declare module "virtual:loupe/adapter" {
  const adapter: import("@designloupe/core").AdapterBrowser;
  export default adapter;
}
declare module "virtual:loupe/icons" {
  const icons: Record<string, () => Promise<{ default: import("react").ComponentType<Record<string, unknown>> }>>;
  export default icons;
}
