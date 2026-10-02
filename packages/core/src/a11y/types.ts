export type WcagStatus = "pass" | "inherited" | "partial" | "fail";

/** A live contrast measurement between two token paths ("palette.primary.main"). */
export type ContrastMeasure = {
  fg: string;
  bg: string;
  kind: "text" | "large-text" | "ui";
  fgAlpha?: number;
  bgAlpha?: number;
  over?: string;   // token the (translucent) bg sits on; defaults to palette.background.default
  label?: string;
};

export type WcagCheck =
  | { sc: string; status: WcagStatus; evidence: string; measure?: never }
  | { sc: string; measure: ContrastMeasure; evidence?: string; status?: never };
