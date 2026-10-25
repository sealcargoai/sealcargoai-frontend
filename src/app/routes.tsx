import { createBrowserRouter } from "react-router";
import { LandingPage } from "./components/LandingPage";
import { ChatInterface } from "./components/ChatInterface";
import { ProductQualification } from "./components/ProductQualification";
import { SupplierResults } from "./components/SupplierResults";
import { CostBreakdown } from "./components/CostBreakdown";
import { RiskCompliance } from "./components/RiskCompliance";
import { FinalCTA } from "./components/FinalCTA";
import { MainLayout } from "./components/MainLayout";
import { AppError, NotFound } from "./components/AppError";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: MainLayout,
    errorElement: <AppError />,
    children: [
      { index: true, Component: LandingPage },
      { path: "chat", Component: ChatInterface },
      { path: "qualify", Component: ProductQualification },
      { path: "suppliers", Component: SupplierResults },
      { path: "costs", Component: CostBreakdown },
      { path: "risk", Component: RiskCompliance },
      { path: "report", Component: FinalCTA },
      { path: "*", Component: NotFound },
    ],
  },
]);
