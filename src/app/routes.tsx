import { createBrowserRouter } from "react-router";
import { LandingPage } from "./components/LandingPage";
import { ChatInterface } from "./components/ChatInterface";
import { ProductQualification } from "./components/ProductQualification";
import { MainLayout } from "./components/MainLayout";
import { AppError, NotFound } from "./components/AppError";

// 02-11c: the result pages (suppliers, costs, review topics, report) and their libraries (charts)
// load when the client gets there, so the first page opens with a much smaller download.
// The start, chat and form stay in the main bundle (that is where every visit begins).
export const router = createBrowserRouter([
  {
    path: "/",
    Component: MainLayout,
    errorElement: <AppError />,
    children: [
      { index: true, Component: LandingPage },
      { path: "chat", Component: ChatInterface },
      { path: "qualify", Component: ProductQualification },
      { path: "suppliers", lazy: () => import("./components/SupplierResults").then((m) => ({ Component: m.SupplierResults })) },
      { path: "costs", lazy: () => import("./components/CostBreakdown").then((m) => ({ Component: m.CostBreakdown })) },
      { path: "risk", lazy: () => import("./components/RiskCompliance").then((m) => ({ Component: m.RiskCompliance })) },
      { path: "report", lazy: () => import("./components/FinalCTA").then((m) => ({ Component: m.FinalCTA })) },
      { path: "*", Component: NotFound },
    ],
  },
]);
