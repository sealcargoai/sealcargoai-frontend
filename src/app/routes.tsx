import { createBrowserRouter } from "react-router";
import { LandingPage } from "./components/LandingPage";
import { MainLayout } from "./components/MainLayout";
import { AppError, NotFound } from "./components/AppError";

// 02-11c: the result pages (suppliers, costs, review topics, report) and their libraries (charts)
// load when the client gets there, so the first page opens with a much smaller download.
// 02-11l: the chat and the form load the same way; they are fetched in the background once the start
// page is idle, so moving on from the start page does not wait for them.
export const router = createBrowserRouter([
  {
    path: "/",
    Component: MainLayout,
    errorElement: <AppError />,
    children: [
      { index: true, Component: LandingPage },
      { path: "chat", lazy: () => import("./components/ChatInterface").then((m) => ({ Component: m.ChatInterface })) },
      { path: "qualify", lazy: () => import("./components/ProductQualification").then((m) => ({ Component: m.ProductQualification })) },
      { path: "suppliers", lazy: () => import("./components/SupplierResults").then((m) => ({ Component: m.SupplierResults })) },
      { path: "costs", lazy: () => import("./components/CostBreakdown").then((m) => ({ Component: m.CostBreakdown })) },
      { path: "risk", lazy: () => import("./components/RiskCompliance").then((m) => ({ Component: m.RiskCompliance })) },
      { path: "report", lazy: () => import("./components/FinalCTA").then((m) => ({ Component: m.FinalCTA })) },
      { path: "*", Component: NotFound },
    ],
  },
]);

// 02-11l: after the start page is shown, fetch the next two pages in the background
const prefetchNext = () => {
  void import("./components/ChatInterface").catch(() => undefined);
  void import("./components/ProductQualification").catch(() => undefined);
};
if (typeof window !== "undefined") {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(prefetchNext, { timeout: 4000 });
  else setTimeout(prefetchNext, 2500);
}
