import { useState } from "react";

/** Appearance is independent of musical settings and the recordings shelf. */
export default function WorkspaceAppearance() {
  const [brown, setBrown] = useState(
    () => document.documentElement.dataset.workspace === "brown",
  );
  const toggle = () => {
    const next = !brown;
    document.documentElement.dataset.workspace = next ? "brown" : "midnight";
    setBrown(next);
    try {
      localStorage.setItem("lumina-workspace-appearance", next ? "brown" : "midnight");
    } catch {
      // The selected appearance still works for this visit.
    }
  };
  return (
    <button
      className="workspace-appearance"
      type="button"
      aria-pressed={brown}
      aria-label="Brown working surfaces"
      onClick={toggle}
    >
      {brown ? "Brown workspace" : "Midnight workspace"}
    </button>
  );
}
