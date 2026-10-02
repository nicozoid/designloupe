import { it, expect } from "vitest";
import { findStaticIssues } from "./static-rules";

const text = `
import { styled } from "@mui/material/styles";
const A = styled("div")({ color: "rgb(10, 20, 30)", padding: 8 });
const B = styled(Box)(({ theme }) => ({ margin: "4px", color: theme.palette.text.primary }));
export const C = () => (
  <Box sx={{ bgcolor: "#e8f5e9", px: "6px", mt: 2, border: "1px solid #ccc" }} style={{ gap: "12px" }}>
    <span className="#notacolour">x</span>
  </Box>
);
`;

it("finds colour literals and px spacing only inside sx/style/styled", () => {
  const f = findStaticIssues("src/x.tsx", text);
  const brief = f.map((x) => `${x.rule}@${x.line}:${x.snippet}`);
  expect(brief).toEqual([
    "colour-literal@3:color: rgb(10, 20, 30)",
    "px-spacing@4:margin: 4px",
    "colour-literal@6:bgcolor: #e8f5e9",
    "px-spacing@6:px: 6px",
    "colour-literal@6:border: 1px solid #ccc",
    "px-spacing@6:gap: 12px",
  ]);
  expect(f[0]!.code).toMatch(/^[0-9a-z]{4}$/);
  expect(f[0]!.message).toBe("Hard-coded colour in styles; use a palette token.");
  expect(f[1]!.message).toBe("Raw px spacing; use theme.spacing units.");
});
