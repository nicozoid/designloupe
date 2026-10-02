import { it, expect } from "vitest";
import mui from "./node";

it("classifies MUI component imports", () => {
  expect(mui.classifyImport("@mui/material", "Button")).toBe("Button");
  expect(mui.classifyImport("@mui/material/Button", "default")).toBe("Button");
  expect(mui.classifyImport("@mui/material/Button", "ButtonProps")).toBeNull();
  expect(mui.classifyImport("@mui/material", "ButtonProps")).toBeNull();
  expect(mui.classifyImport("@mui/material", "useTheme")).toBeNull();
  expect(mui.classifyImport("@mui/material", "ThemeProvider")).toBeNull();
  expect(mui.classifyImport("@mui/material", "CssBaseline")).toBeNull();
  expect(mui.classifyImport("@mui/material/styles", "styled")).toBeNull();
  expect(mui.classifyImport("@mui/lab", "LoadingButton")).toBe("LoadingButton");
  expect(mui.classifyImport("@mui/x-date-pickers", "DatePicker")).toBe("DatePicker");
  expect(mui.classifyImport("react-router-dom", "Link")).toBeNull();
});

it("classifies icon imports", () => {
  expect(mui.classifyIconImport("@mui/icons-material/Delete", "default")).toBe("Delete");
  expect(mui.classifyIconImport("@mui/icons-material", "DeleteOutlined")).toBe("DeleteOutlined");
  expect(mui.classifyIconImport("@mui/material", "Button")).toBeNull();
});

it("lists layout primitives", () => {
  expect(mui.layoutPrimitives).toEqual(expect.arrayContaining(["Box", "Stack", "Typography"]));
});
