import { useRef, useState, type ReactNode } from "react";
import { useShelf } from "../context/OwnSoundSession";
import { TAKE_DRAG_TYPE } from "../lib/shelf";

type Props = {
  /** Called with the dropped take's id. */
  onTake: (id: string) => void;
  /** Short line shown while a take hovers here, e.g. "Drop to look at this take". */
  label: string;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
};

const carriesTake = (event: React.DragEvent) =>
  Array.from(event.dataTransfer.types).includes(TAKE_DRAG_TYPE);

/** A place a shelf take can be dropped. Lights up while one is being dragged. */
export default function TakeDropZone({
  onTake,
  label,
  disabled = false,
  className = "",
  children,
}: Props) {
  const { draggingId, setDraggingId, setShelfOpen } = useShelf();
  const [over, setOver] = useState(false);
  // Drag events fire for every child the pointer crosses, so count them.
  const depth = useRef(0);
  const ready = !!draggingId && !disabled;

  return (
    <div
      className={`take-drop ${ready ? "ready" : ""} ${over && ready ? "over" : ""} ${className}`}
      onDragEnter={(event) => {
        if (disabled || !carriesTake(event)) return;
        event.preventDefault();
        depth.current++;
        setOver(true);
      }}
      onDragOver={(event) => {
        if (disabled || !carriesTake(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1);
        if (!depth.current) setOver(false);
      }}
      onDrop={(event) => {
        depth.current = 0;
        setOver(false);
        if (disabled || !carriesTake(event)) return;
        event.preventDefault();
        const id = event.dataTransfer.getData(TAKE_DRAG_TYPE);
        setDraggingId(null);
        setShelfOpen(false);
        if (id) onTake(id);
      }}
    >
      {children}
      {ready && (
        <div className="take-drop-hint" aria-hidden="true">
          <span>{over ? label : "Drop a take here"}</span>
        </div>
      )}
    </div>
  );
}
