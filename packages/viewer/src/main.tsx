import { createRoot } from "react-dom/client";
import model from "virtual:loupe/model";

createRoot(document.getElementById("root")!).render(
  <p>Design Loupe: {model.name}, {model.components.length} components</p>,
);
