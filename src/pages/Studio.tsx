import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppNavigation from "@/components/AppNavigation";
import CassetteDeck, { type DeckMode } from "@/components/tape/CassetteDeck";
import TapeLane from "@/components/tape/TapeLane";
import TakeDropZone from "@/components/TakeDropZone";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useShelf } from "@/context/OwnSoundSession";
import { useStudioSession } from "@/context/StudioSession";
import { formatNote } from "@/lib/noteSelection";
import { encodeWav, recordingError } from "@/lib/toneRecording";
import {
  STORAGE_KEY,
  audible,
  readSong,
  songSeconds,
  type SongSettings,
  type TrackSettings,
} from "@/lib/fourTrack";
import { TapeDeck, renderEffects } from "@/lib/tapeDeck";

type Buffers = (AudioBuffer | null)[];
const EMPTY: Buffers = [null, null, null, null];

function loadSong() {
  try {
    return readSong(localStorage.getItem(STORAGE_KEY));
  } catch {
    return readSong(null);
  }
}

export default function Studio() {
  const shelf = useShelf();
  const { selection, stop: stopPreview } = useStudioSession();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [song, setSong] = useState<SongSettings>(loadSong);
  const [originals, setOriginals] = useState<Buffers>(EMPTY);
  const [processed, setProcessed] = useState<Buffers>(EMPTY);
  const [mode, setMode] = useState<DeckMode>("stopped");
  const [position, setPosition] = useState(0);
  const [message, setMessage] = useState("");
  // A take waiting for "yes, replace it" before it goes onto a full track.
  const [pending, setPending] = useState<{
    index: number;
    takeId: string;
  } | null>(null);
  const deck = useRef<TapeDeck | null>(null);
  const latest = useRef({ song, processed, mode });
  latest.current = { song, processed, mode };
  const songSec = songSeconds(song);
  const heard = useMemo(() => audible(song.tracks), [song.tracks]);
  const incomingTake = params.get("take");
  const incoming = shelf.takes.find((take) => take.id === incomingTake);

  const getDeck = () => (deck.current ??= new TapeDeck());

  // Save the arrangement (not the audio, which lives on the shelf).
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(song));
    } catch {
      // Private windows may refuse; the song still works for this visit.
    }
  }, [song]);

  const updateTrack = useCallback(
    (index: number, patch: Partial<TrackSettings>) =>
      setSong((current) => ({
        ...current,
        tracks: current.tracks.map((track, i) =>
          i === index ? { ...track, ...patch } : track,
        ),
      })),
    [],
  );

  // Bring each track's take back from the shelf when the page opens.
  const loaded = useRef(false);
  useEffect(() => {
    if (shelf.status !== "ready" || loaded.current) return;
    loaded.current = true;
    const ids = latest.current.song.tracks.map((track) => track.takeId);
    void Promise.all(ids.map((id) => (id ? shelf.takeAudio(id) : null))).then(
      (buffers) => {
        setOriginals(buffers);
        const missing = ids.filter((id, i) => id && !buffers[i]).length;
        if (missing) {
          setSong((current) => ({
            ...current,
            tracks: current.tracks.map((track, i) =>
              track.takeId && !buffers[i]
                ? { ...track, takeId: null, startSec: 0, nudgeMs: 0 }
                : track,
            ),
          }));
          setMessage(
            missing === 1
              ? "One track's take was deleted from your shelf, so that track is blank again."
              : `${missing} tracks' takes were deleted from your shelf, so those tracks are blank again.`,
          );
        }
      },
    );
  }, [shelf.status, shelf]);

  // Print reverb and echo into each track's waveform, a moment after the
  // knobs stop moving.
  const fxKey = song.tracks
    .map((track) => `${track.reverb}/${track.echo}/${track.startSec}`)
    .concat(String(song.bars))
    .join("|");
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      const { song: current } = latest.current;
      void Promise.all(
        originals.map((buffer, i) =>
          buffer
            ? renderEffects(
                buffer,
                current.tracks[i].reverb,
                current.tracks[i].echo,
                current.bpm,
                songSeconds(current) - current.tracks[i].startSec,
              ).catch(() => buffer)
            : null,
        ),
      ).then((next) => {
        if (!cancelled) setProcessed(next);
      });
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [originals, fxKey, song.bpm]);

  const deckTracks = () =>
    latest.current.song.tracks.map((track, i) => ({
      buffer: latest.current.processed[i],
      startSec: track.startSec,
      nudgeMs: track.nudgeMs,
      volume: track.volume,
      pan: track.pan,
      audible: audible(latest.current.song.tracks)[i],
    }));

  const finishTake = useCallback(
    (captured: ReturnType<TapeDeck["stop"]>) => {
      const { song: current } = latest.current;
      const index = current.armed;
      if (index === null) return;
      if (!captured) {
        setMessage(
          "That take was too short to keep. Try again, and sing a little longer.",
        );
        return;
      }
      const track = current.tracks[index];
      const blob = new Blob([encodeWav(captured.buffer)], {
        type: "audio/wav",
      });
      const id = shelf.shelveTake(blob, captured.buffer, {
        prefix: track.name,
        target: selection.name ? formatNote(selection.name) : undefined,
      });
      if (!id) {
        setMessage(
          "Your shelf is full, so this take couldn't be kept. Delete a few old takes from the shelf, then record again.",
        );
        return;
      }
      setOriginals((list) =>
        list.map((buffer, i) => (i === index ? captured.buffer : buffer)),
      );
      updateTrack(index, {
        takeId: id,
        startSec: captured.startSec,
        nudgeMs: 0,
      });
      setMessage("");
    },
    [shelf, selection.name, updateTrack],
  );

  const stop = useCallback(() => {
    const active = deck.current;
    if (!active) return;
    const wasRecording = active.isRecording;
    const at = active.position();
    const captured = active.stop();
    setMode("stopped");
    if (at !== null)
      setPosition(Math.max(0, Math.min(at, songSeconds(latest.current.song))));
    if (wasRecording) finishTake(captured);
  }, [finishTake]);

  // Keep the counter, reels and playhead moving, and stop at the end of tape.
  useEffect(() => {
    if (mode === "stopped" || mode === "arming") return;
    let frame = 0;
    const tick = () => {
      const active = deck.current;
      const at = active?.position();
      if (active && at !== null && at !== undefined) {
        if (active.countingIn())
          setMode((m) => (m === "recording" ? "count-in" : m));
        else setMode((m) => (m === "count-in" ? "recording" : m));
        setPosition(Math.max(0, at));
        if (at >= songSeconds(latest.current.song)) {
          stop();
          setPosition(songSeconds(latest.current.song));
          return;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [mode, stop]);

  // Escape, hiding the page, or leaving the Studio all stop the tape.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") stop();
      if (
        event.key === " " &&
        !(event.target instanceof HTMLInputElement) &&
        !(event.target instanceof HTMLSelectElement) &&
        !(event.target instanceof HTMLButtonElement)
      ) {
        event.preventDefault();
        if (latest.current.mode === "stopped") void play();
        else stop();
      }
    };
    const onHide = () => document.hidden && stop();
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onHide);
    };
    // play is stable enough for a key handler; it reads everything from refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stop]);
  useEffect(
    () => () => {
      const active = deck.current;
      if (active?.isRecording) finishTake(active.stop());
      active?.dispose();
    },
    // Only on leaving the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const startAt = () => (position >= songSec - 0.05 ? 0 : position);

  async function play() {
    stopPreview();
    setMessage("");
    const from = startAt();
    setPosition(from);
    try {
      await getDeck().play({
        tracks: deckTracks(),
        fromSec: from,
        toSec: songSeconds(latest.current.song),
        bpm: latest.current.song.bpm,
        click: latest.current.song.click,
      });
      setMode("playing");
    } catch {
      setMessage("The tape couldn't start. Try pressing Play again.");
    }
  }

  async function record() {
    const { song: current } = latest.current;
    if (current.armed === null) return;
    stopPreview();
    setMessage("");
    const from = startAt();
    setPosition(from);
    setMode("arming");
    try {
      await getDeck().record({
        tracks: deckTracks().map((track, i) =>
          // The track being recorded is silent so you don't hear the old take.
          i === current.armed ? { ...track, audible: false } : track,
        ),
        fromSec: from,
        songLengthSec: songSeconds(current),
        bpm: current.bpm,
        click: current.click,
        countIn: current.countIn,
      });
      setMode(current.countIn ? "count-in" : "recording");
    } catch (error) {
      deck.current?.stop();
      setMode("stopped");
      setMessage(recordingError(error).replace("Record my sound", "REC"));
    }
  }

  const loadTake = async (index: number, takeId: string) => {
    const buffer = await shelf.takeAudio(takeId);
    if (!buffer) {
      setMessage("That take couldn't be opened in this browser.");
      return;
    }
    setOriginals((list) => list.map((b, i) => (i === index ? buffer : b)));
    updateTrack(index, { takeId, startSec: 0, nudgeMs: 0 });
    setMessage("");
  };

  const clearTrack = (index: number) => {
    setOriginals((list) => list.map((b, i) => (i === index ? null : b)));
    setProcessed((list) => list.map((b, i) => (i === index ? null : b)));
    updateTrack(index, { takeId: null, startSec: 0, nudgeMs: 0 });
  };

  // Blank tape takes a take straight away; a full track asks first.
  const offerTake = (index: number, takeId: string) => {
    const current = song.tracks[index].takeId;
    if (current === takeId) return;
    if (current) setPending({ index, takeId });
    else void loadTake(index, takeId);
  };

  const placeIncoming = (index: number) => {
    if (!incomingTake) return;
    offerTake(index, incomingTake);
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete("take");
      return next;
    });
  };

  const takeName = (id: string | null) =>
    id
      ? (shelf.takes.find((take) => take.id === id)?.name ?? "Loading…")
      : null;
  const busy = mode !== "stopped";
  const armedName =
    song.armed === null ? null : (song.tracks[song.armed]?.name ?? null);

  return (
    <div className="lumina-app studio-tape-page">
      <AppNavigation />
      <main className="lumina-main">
        <div className="workspace-title">
          <div>
            <p className="studio-eyebrow">MAKE A LITTLE MUSIC</p>
            <h1>The four-track</h1>
          </div>
          <p>Four voices, one tape. Sing a part, then sing against it.</p>
        </div>

        {incoming && (
          <div
            className="tape-incoming"
            role="region"
            aria-label="Place a take"
          >
            <span>
              Put <b>{incoming.name}</b> on which track?
            </span>
            {song.tracks.map((track, i) => (
              <button key={i} disabled={busy} onClick={() => placeIncoming(i)}>
                {i + 1}. {track.name}
              </button>
            ))}
            <button
              className="quiet"
              onClick={() =>
                setParams((previous) => {
                  const next = new URLSearchParams(previous);
                  next.delete("take");
                  return next;
                })
              }
            >
              Not now
            </button>
          </div>
        )}

        <CassetteDeck
          song={song}
          mode={mode}
          position={position}
          songSec={songSec}
          armedName={armedName}
          onPlay={() => void play()}
          onStop={stop}
          onRecord={() => void record()}
          onRewind={() => setPosition(0)}
          onChange={(patch) => {
            setSong((current) => ({ ...current, ...patch }));
            if (patch.bars)
              setPosition((p) =>
                Math.min(p, songSeconds({ ...song, ...patch })),
              );
          }}
        />

        {message && (
          <p className="recording-message error tape-message" role="alert">
            {message}
          </p>
        )}

        <div className="tape-lanes">
          <div className="tape-ruler" aria-hidden="true">
            {Array.from({ length: song.bars }, (_, bar) => (
              <span key={bar}>{bar % 4 === 0 ? bar + 1 : ""}</span>
            ))}
          </div>
          {song.tracks.map((track, i) => (
            <TakeDropZone
              key={i}
              label={
                track.takeId
                  ? `Drop to replace ${track.name}'s take`
                  : `Drop onto ${track.name}`
              }
              disabled={busy}
              onTake={(id) => offerTake(i, id)}
            >
              <TapeLane
                index={i}
                track={track}
                original={originals[i]}
                processed={processed[i]}
                armed={song.armed === i}
                recording={
                  (mode === "recording" || mode === "count-in") &&
                  song.armed === i
                }
                busy={busy}
                heard={heard[i]}
                songSec={songSec}
                bars={song.bars}
                position={position}
                takes={shelf.takes}
                takeName={takeName(track.takeId)}
                onChange={(patch) => updateTrack(i, patch)}
                onArm={() =>
                  setSong((current) => ({
                    ...current,
                    armed: current.armed === i ? null : i,
                  }))
                }
                onSeek={(seconds) => !busy && setPosition(seconds)}
                onLoad={(id) => offerTake(i, id)}
                onClear={() => clearTrack(i)}
              />
            </TakeDropZone>
          ))}
        </div>

        <AlertDialog
          open={!!pending}
          onOpenChange={(open) => !open && setPending(null)}
        >
          <AlertDialogContent className="tape-confirm">
            <AlertDialogHeader>
              <AlertDialogTitle>
                Replace {pending ? song.tracks[pending.index].name : ""}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                {pending && (
                  <>
                    <b>{takeName(pending.takeId)}</b> will go onto this track in
                    place of{" "}
                    <b>{takeName(song.tracks[pending.index].takeId)}</b>. The
                    old take stays on your shelf, so you can always put it back.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep the current take</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (pending) void loadTake(pending.index, pending.takeId);
                  setPending(null);
                }}
              >
                Replace it
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <aside className="tape-tips">
          <p>
            <b>Try this:</b> arm Soprano, sing a simple line, and stop. Then arm
            Alto and sing a harmony while Soprano plays back. Every take lands
            on your shelf, so nothing is ever lost. You can drag any take from
            the shelf onto a track, too.
          </p>
          <button
            className="studio-text-link"
            onClick={() => navigate("/pitch-pipe")}
          >
            Need a starting note? Open the pitch pipe →
          </button>
        </aside>
      </main>
    </div>
  );
}
