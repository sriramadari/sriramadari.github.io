import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { usePath } from "./router";
import "./styles.css";

// The package lab is its own chunk, so the portfolio page stays light.
const Lab = lazy(() => import("./lab/Lab"));

function Root() {
  const path = usePath();
  if (path === "/packages" || path.startsWith("/packages/")) {
    return (
      <Suspense fallback={null}>
        <Lab path={path} />
      </Suspense>
    );
  }
  return <App />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
