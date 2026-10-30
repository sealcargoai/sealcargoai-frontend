
  import { createRoot } from "react-dom/client";
  import { installSandbox } from "./utils/sandbox";
  import App from "./app/App.tsx";
  import "./styles/index.css";

  // preview / test builds: nothing that creates a lead, sends an email or counts an event leaves the browser
  installSandbox();
  createRoot(document.getElementById("root")!).render(<App />);
  