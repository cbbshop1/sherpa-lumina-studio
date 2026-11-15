import { useState } from "react";

type Surface = "midnight" | "brown";

/** Appearance is independent of musical settings and the recordings shelf. */
export default function WorkspaceAppearance() {
  const [surface, setSurface] = useState<Surface>(() =>
    document.documentElement.dataset.workspace === "brown" ? "brown" : "midnight",
  );
  const choose = (next: Surface) => {
    document.documentElement.dataset.workspace = next;
    setSurface(next);
    try {
      localStorage.setItem("lumina-workspace-appearance", next);
    } catch {
      // The selected appearance still works for this visit.
    }
  };
  return (
    <div className="workspace-appearance" role="group" aria-label="Panel color">
      <span>Panels</span>
      <button
        type="button"
        aria-pressed={surface === "midnight"}
        onClick={() => choose("midnight")}
      >
        <i className="swatch-blue" aria-hidden="true" />
        Blue
      </button>
      <button
        type="button"
        aria-pressed={surface === "brown"}
        onClick={() => choose("brown")}
      >
        <i className="swatch-tan" aria-hidden="true" />
        Tan
      </button>
    </div>
  );
}
