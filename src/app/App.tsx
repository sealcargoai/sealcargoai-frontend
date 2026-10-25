import { RouterProvider } from "react-router";
import { router } from "./routes";
import { LanguageProvider } from "./context/LanguageContext";

// Shown small in the corner so testers can tell which version they are seeing.
// Update it with each published change.
export const APP_VERSION = "2026.10.24-g";

export default function App() {
  return (
    <LanguageProvider>
      <RouterProvider router={router} />
      <div
        aria-hidden="true"
        className="fixed bottom-1 left-2 z-50 text-[10px] text-slate-400 pointer-events-none select-none"
      >
        v{APP_VERSION}
      </div>
    </LanguageProvider>
  );
}