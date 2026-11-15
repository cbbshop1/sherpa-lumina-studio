import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Archive,
  AudioLines,
  CassetteTape,
  Download,
  GripVertical,
  Pause,
  Pencil,
  Play,
  Trash2,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";
import { useShelf } from "../context/OwnSoundSession";
import { useStudioSession } from "../context/StudioSession";
import { TAKE_DRAG_TYPE, formatDuration, type TakeMeta } from "../lib/shelf";
import { roomFromLocation } from "../lib/nextSteps";

const when = (time: number) =>
  new Date(time).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export default function ShelfPanel() {
  const shelf = useShelf();
  const { stop: stopPreview } = useStudioSession();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const room = roomFromLocation(pathname, search);
  const lookingHere = room === "own-sound";
  const {
    shelfOpen: open,
    setShelfOpen: setOpen,
    draggingId,
    setDraggingId,
  } = shelf;
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const playerUrl = useRef("");

  const stopPlayer = () => {
    player.current?.pause();
    if (playerUrl.current) URL.revokeObjectURL(playerUrl.current);
    playerUrl.current = "";
    setPlayingId(null);
  };
  useEffect(() => stopPlayer, []);
  useEffect(() => {
    if (!open) {
      stopPlayer();
      setEditingId(null);
      setConfirmId(null);
    }
  }, [open]);

  const toggle = (take: TakeMeta) => {
    if (playingId === take.id) return stopPlayer();
    stopPlayer();
    const blob = shelf.takeBlob(take.id);
    if (!blob) return;
    stopPreview();
    playerUrl.current = URL.createObjectURL(blob);
    const audio = new Audio(playerUrl.current);
    player.current = audio;
    audio.onended = stopPlayer;
    setPlayingId(take.id);
    void audio.play().catch(stopPlayer);
  };

  const look = async (take: TakeMeta) => {
    stopPlayer();
    await shelf.openTake(take.id);
    setOpen(false);
    if (!lookingHere) navigate("/pitch-pipe?view=waveform&source=microphone");
  };

  const download = (take: TakeMeta) => {
    const blob = shelf.takeBlob(take.id);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${take.name}.${take.type.includes("wav") ? "wav" : "webm"}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    // Not modal, so the page behind can catch a take dropped from the shelf.
    <Sheet open={open} onOpenChange={setOpen} modal={false}>
      <SheetTrigger asChild>
        <button className="shelf-trigger" aria-label="Open your shelf of takes">
          <Archive size={14} />
          <span>SHELF</span>
          {shelf.takes.length > 0 && <b>{shelf.takes.length}</b>}
        </button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className={`shelf-panel ${draggingId ? "dragging" : ""}`}
        onInteractOutside={(event) => {
          // A drop on the page shouldn't count as clicking away.
          if (draggingId) event.preventDefault();
        }}
      >
        <SheetHeader>
          <p className="studio-eyebrow">YOUR TAKES</p>
          <SheetTitle className="shelf-title">The shelf</SheetTitle>
          <SheetDescription className="shelf-intro">
            Every recording you make lands here, so you can carry it from room
            to room. Drag a take onto the analysis screen or a four-track lane.
            {shelf.persistent
              ? " Takes stay in this browser until you delete them."
              : " This browser won't save takes, so they disappear when you close the tab. Download any you want to keep."}
          </SheetDescription>
        </SheetHeader>
        {shelf.problem && (
          <p className="recording-message error shelf-problem" role="alert">
            {shelf.problem}{" "}
            <button onClick={shelf.clearProblem}>Dismiss</button>
          </p>
        )}
        {shelf.status === "loading" ? (
          <p className="shelf-empty">Opening your shelf…</p>
        ) : shelf.takes.length === 0 ? (
          <div className="shelf-empty">
            <AudioLines size={34} strokeWidth={1} />
            <strong>Nothing on the shelf yet.</strong>
            <p>Record your voice in See the sound and it will appear here.</p>
            <button
              onClick={() => {
                setOpen(false);
                navigate("/pitch-pipe?view=waveform&source=microphone");
              }}
            >
              Record a take
            </button>
          </div>
        ) : (
          <ul className="shelf-list">
            {shelf.takes.map((take) => (
              <li
                key={take.id}
                className={`${take.id === shelf.activeId ? "active" : ""} ${draggingId === take.id ? "lifted" : ""}`}
                draggable={editingId !== take.id}
                onDragStart={(event) => {
                  stopPlayer();
                  event.dataTransfer.setData(TAKE_DRAG_TYPE, take.id);
                  event.dataTransfer.setData("text/plain", take.name);
                  event.dataTransfer.effectAllowed = "copy";
                  // Wait a beat so the drag picture is taken before the shelf slides aside.
                  setTimeout(() => setDraggingId(take.id), 0);
                }}
                onDragEnd={() => setDraggingId(null)}
                title="Drag onto the analysis screen or a four-track lane"
              >
                <GripVertical
                  className="shelf-grip"
                  size={14}
                  aria-hidden="true"
                />
                <button
                  className="shelf-play"
                  onClick={() => toggle(take)}
                  aria-label={
                    playingId === take.id
                      ? `Stop ${take.name}`
                      : `Play ${take.name}`
                  }
                >
                  {playingId === take.id ? (
                    <Pause size={15} />
                  ) : (
                    <Play size={15} />
                  )}
                </button>
                <div className="shelf-take">
                  {editingId === take.id ? (
                    <input
                      autoFocus
                      defaultValue={take.name}
                      aria-label="Take name"
                      maxLength={60}
                      onBlur={(event) => {
                        shelf.renameTake(take.id, event.target.value);
                        setEditingId(null);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter")
                          (event.target as HTMLInputElement).blur();
                        if (event.key === "Escape") setEditingId(null);
                      }}
                    />
                  ) : (
                    <strong>
                      {take.name}
                      {take.id === shelf.activeId && <em>open</em>}
                    </strong>
                  )}
                  <span>
                    {formatDuration(take.duration)} · {when(take.createdAt)}
                    {take.target ? ` · with ${take.target}` : ""}
                  </span>
                  <div className="shelf-actions">
                    <button onClick={() => void look(take)}>
                      <AudioLines size={13} />{" "}
                      {lookingHere ? "Open here" : "See it"}
                    </button>
                    <button
                      onClick={() => {
                        stopPlayer();
                        setOpen(false);
                        navigate(`/studio?take=${encodeURIComponent(take.id)}`);
                      }}
                    >
                      <CassetteTape size={13} /> To a track
                    </button>
                    <button onClick={() => setEditingId(take.id)}>
                      <Pencil size={13} /> Rename
                    </button>
                    <button onClick={() => download(take)}>
                      <Download size={13} /> Download
                    </button>
                    {confirmId === take.id ? (
                      <button
                        className="danger"
                        onClick={() => {
                          if (playingId === take.id) stopPlayer();
                          shelf.deleteTake(take.id);
                          setConfirmId(null);
                        }}
                      >
                        <Trash2 size={13} /> Delete for good?
                      </button>
                    ) : (
                      <button onClick={() => setConfirmId(take.id)}>
                        <Trash2 size={13} /> Delete
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
}
