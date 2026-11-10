import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileMusic, Play, Square, Trash2, Upload } from "lucide-react";
import AppNavigation from "@/components/AppNavigation";
import ChartStaff from "@/components/ChartStaff";
import { useStopOnNavigation } from "@/components/StudioChrome";
import { useStudioSession } from "@/context/StudioSession";
import { ChartPlayer, chartNotes } from "@/lib/chartPlayer";
import { readHarmony } from "@/lib/harmony";
import { readChart, readScoreFile } from "@/lib/musicxml";
import { formatNote } from "@/lib/noteSelection";

const STORE = "lumina-chart";
type Saved = { xml: string; title: string; lowerTop?: boolean };

function load(): Saved | null {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? "null");
    return saved && typeof saved.xml === "string" ? saved : null;
  } catch {
    return null;
  }
}

/** Bring in a score, see its four parts, hear them, and watch what the chords are doing. */
export default function ChartRoom() {
  const { stop: stopPreview } = useStudioSession();
  useStopOnNavigation();
  const [saved, setSaved] = useState<Saved | null>(load);
  const [error, setError] = useState("");
  const [naming, setNaming] = useState<"numerals" | "clock">("numerals");
  const [bpm, setBpm] = useState(96);
  const [heard, setHeard] = useState([true, true, true, true]);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState<number | null>(null);
  const [dropping, setDropping] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const player = useRef<ChartPlayer | null>(null);

  const read = useMemo(() => {
    if (!saved) return null;
    try {
      const chart = readChart(saved.xml, saved.lowerTop);
      return { chart, reading: readHarmony(chart), notes: chartNotes(chart) };
    } catch {
      return null;
    }
  }, [saved]);

  useEffect(() => {
    try {
      if (saved) localStorage.setItem(STORE, JSON.stringify(saved));
      else localStorage.removeItem(STORE);
    } catch {
      // Too large to keep, or storage is off: the chart lasts for this visit.
    }
  }, [saved]);

  const halt = useCallback(() => {
    player.current?.stop();
    setPlaying(false);
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && halt();
    const onHide = () => document.hidden && halt();
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onHide);
      player.current?.dispose();
      player.current = null;
    };
  }, [halt]);
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      setTime(player.current?.position() ?? null);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  const open = async (file: File) => {
    halt();
    setError("");
    try {
      const xml = await readScoreFile(await file.arrayBuffer());
      const chart = readChart(xml);
      if (!chart.bars.some((bar) => bar.parts.some((part) => part.length)))
        throw new Error("empty");
      const scanned = chart.title.length > 48 || !chart.title;
      setTime(null);
      setSaved({
        xml,
        // A scan often mistakes a line of small print for the title.
        title: !scanned
          ? chart.title
          : /^[\w-]{24,}$/.test(file.name.replace(/\.\w+$/, ""))
            ? "Untitled chart"
            : file.name.replace(/\.(mxl|musicxml|xml)$/i, ""),
      });
    } catch {
      setError(
        "Lumina couldn't read that file. It needs a MusicXML score, which ends in .mxl, .musicxml or .xml. A PDF has to be converted first.",
      );
    }
  };
  const start = (from: number) => {
    if (!read) return;
    stopPreview();
    player.current ??= new ChartPlayer();
    heard.forEach((on, part) => player.current!.setLevel(part, on ? 1 : 0));
    const end = read.reading.barStarts[read.reading.barStarts.length - 1];
    setPlaying(true);
    setTime(from);
    void player.current.play(read.notes, bpm, from >= end - 0.01 ? 0 : from, end, () => {
      setPlaying(false);
      setTime(null);
      player.current?.seek(0);
    });
  };
  const seek = (when: number) => {
    if (playing) start(when);
    else {
      player.current ??= new ChartPlayer();
      player.current.seek(when);
      setTime(when);
    }
  };
  const toggle = (part: number) =>
    setHeard((current) => {
      const next = current.map((on, index) => (index === part ? !on : on));
      player.current?.setLevel(part, next[part] ? 1 : 0);
      return next;
    });
  const only = (part: number) =>
    setHeard((current) => {
      const alone = current.every((on, index) => on === (index === part));
      const next = current.map((_, index) => alone || index === part);
      next.forEach((on, index) => player.current?.setLevel(index, on ? 1 : 0));
      return next;
    });

  const chart = read?.chart,
    reading = read?.reading;
  const barOf = (when: number) => {
    if (!chart || !reading) return "";
    let bar = 0;
    while (bar < chart.bars.length - 1 && reading.barStarts[bar + 1] <= when + 1e-6) bar++;
    return chart.bars[bar].number;
  };
  const fixes = chart
    ? [
        chart.loweredTop && "the top staff is read an octave lower, as tenor and lead sing it",
        chart.repairs.rejoinedBars &&
          `${chart.repairs.rejoinedBars} bar${chart.repairs.rejoinedBars === 1 ? "" : "s"} split by the scan ${chart.repairs.rejoinedBars === 1 ? "was" : "were"} rejoined`,
        chart.repairs.movedNotes &&
          `${chart.repairs.movedNotes} stray note${chart.repairs.movedNotes === 1 ? "" : "s"} went back to ${chart.repairs.movedNotes === 1 ? "its part" : "their parts"}`,
      ].filter(Boolean)
    : [];

  return (
    <div className="lumina-app chart-page">
      <AppNavigation />
      <main className="lumina-main">
        <div className="workspace-title">
          <div>
            <p className="studio-eyebrow">READ A CHART</p>
            <h1>The chart room</h1>
          </div>
          <p>Bring in a score. See its four parts, hear them, and watch what the chords are doing.</p>
        </div>

        <input
          ref={picker}
          type="file"
          accept=".mxl,.musicxml,.xml"
          hidden
          aria-label="Choose a MusicXML score"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void open(file);
          }}
        />
        {error && (
          <p className="chart-error" role="alert">
            {error}
          </p>
        )}

        {!chart || !reading ? (
          <section
            className={`chart-drop ${dropping ? "over" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDropping(true);
            }}
            onDragLeave={() => setDropping(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDropping(false);
              const file = event.dataTransfer.files[0];
              if (file) void open(file);
            }}
          >
            <FileMusic size={34} />
            <h2>Drop a score here</h2>
            <p>
              Lumina reads MusicXML, the format notation programs save for sharing. It works best
              with four voices, written the barbershop way on two staves or as four separate lines.
            </p>
            <button className="chart-choose" onClick={() => picker.current?.click()}>
              <Upload size={15} /> Choose a file
            </button>
            <p className="chart-small">
              Only have a PDF? A free program called Audiveris turns a PDF into MusicXML. Your chart
              stays in this browser. Nothing is uploaded.
            </p>
          </section>
        ) : (
          <>
            <section className="chart-head">
              <div className="chart-title">
                <input
                  aria-label="Chart title"
                  value={saved!.title}
                  maxLength={80}
                  onChange={(event) => setSaved({ ...saved!, title: event.target.value })}
                />
                <p>
                  {formatNote(reading.tonic)} {reading.mode} · {chart.beats}/{chart.beatUnit} ·{" "}
                  {chart.bars.length} bars · {chart.voices.join(", ")}
                </p>
              </div>
              <div className="chart-file">
                <button onClick={() => picker.current?.click()}>
                  <Upload size={13} /> Open another
                </button>
                <button
                  onClick={() => {
                    halt();
                    setSaved(null);
                    setTime(null);
                  }}
                >
                  <Trash2 size={13} /> Remove
                </button>
              </div>
            </section>

            {(fixes.length > 0 || chart.repairs.unevenBars > 0) && (
              <p className="chart-repairs">
                {fixes.length > 0 && (
                  <>
                    Tidied on the way in: {fixes.join(", ")}.{" "}
                  </>
                )}
                {chart.repairs.unevenBars > 0 &&
                  `${chart.repairs.unevenBars} bar${chart.repairs.unevenBars === 1 ? " doesn't" : "s don't"} add up in the file and ${chart.repairs.unevenBars === 1 ? "is" : "are"} marked with a ?. `}
                <label>
                  <input
                    type="checkbox"
                    checked={chart.octaveTreble}
                    onChange={(event) => {
                      halt();
                      setSaved({ ...saved!, lowerTop: event.target.checked });
                    }}
                  />{" "}
                  Top staff sounds an octave lower
                </label>
              </p>
            )}

            <section className="chart-controls" aria-label="Playback">
              <button
                className={`chart-play ${playing ? "on" : ""}`}
                onClick={() => (playing ? halt() : start(player.current?.position() ?? 0))}
              >
                {playing ? (
                  <>
                    <Square size={12} fill="currentColor" /> Stop
                  </>
                ) : (
                  <>
                    <Play size={13} fill="currentColor" /> Play
                  </>
                )}
              </button>
              <button
                disabled={playing || !time}
                onClick={() => {
                  player.current?.seek(0);
                  setTime(null);
                }}
              >
                From the top
              </button>
              <label className="chart-tempo">
                Tempo <span>{bpm}</span>
                <input
                  type="range"
                  aria-label="Tempo"
                  min={40}
                  max={180}
                  step={4}
                  value={bpm}
                  onChange={(event) => {
                    setBpm(Number(event.target.value));
                    if (playing) halt();
                  }}
                />
              </label>
              <div className="chart-parts" role="group" aria-label="Parts you hear">
                {chart.voices.map((voice, part) => (
                  <span key={voice}>
                    <button aria-pressed={heard[part]} onClick={() => toggle(part)}>
                      {voice}
                    </button>
                    <button aria-label={`Hear only the ${voice.toLowerCase()}`} onClick={() => only(part)}>
                      solo
                    </button>
                  </span>
                ))}
              </div>
              <div className="piano-mode" role="group" aria-label="How chords are named">
                <button aria-pressed={naming === "numerals"} onClick={() => setNaming("numerals")}>
                  Numerals
                </button>
                <button aria-pressed={naming === "clock"} onClick={() => setNaming("clock")}>
                  Clock
                </button>
              </div>
            </section>
            <p className="chart-hint">
              {naming === "clock"
                ? `The barbershop clock: ${formatNote(reading.tonic)} is home at 12. Each hour is one more step around the circle of fifths, and the music walks back toward 12.`
                : "Click any bar to play from there. Under each chord is its place in the key."}
            </p>

            <ChartStaff chart={chart} reading={reading} naming={naming} time={time} onSeek={seek} />

            <section className="chart-story" aria-label="What the chords are doing">
              <span className="studio-eyebrow">WHAT THE CHORDS ARE DOING</span>
              {reading.brackets.length ? (
                <ul>
                  {reading.brackets.map((bracket) => (
                    <li key={`${bracket.kind}${bracket.start}`} className={bracket.kind}>
                      <button onClick={() => start(bracket.start)}>
                        <Play size={11} fill="currentColor" /> Bars {barOf(bracket.start)} to{" "}
                        {barOf(bracket.end - 0.01)}
                      </button>
                      <span>{bracket.label}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>This chart stays close to home. Lumina found no long leans on another chord.</p>
              )}
              <p>
                This is Lumina's reading, made beat by beat from the four parts. Passing notes and
                scanning mistakes can fool it, so trust your ear where the two disagree.
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
