import { useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  AudioLines,
  ChevronRight,
  Heart,
  Layers3,
  Music2,
  Piano,
  Radio,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import AppNavigation from "../components/AppNavigation";
import PianoKeyboard from "../components/PianoKeyboard";
import ChordLibrary from "../components/ChordLibrary";
import ChordProgressionBuilder from "../components/ChordProgressionBuilder";
import ScaleExplorer from "../components/ScaleExplorer";
import {
  SessionBar,
  SelectionPreview,
  useStopOnNavigation,
} from "../components/StudioChrome";
import ToolArtwork from "../components/ToolArtwork";
import { useStudioSession } from "../context/StudioSession";
import { selectionRoot } from "../lib/musicNotation";

const tools = [
  {
    path: "/piano",
    kind: "piano",
    title: "The piano",
    label: "PLAY SOMETHING",
    description: "Find a melody, play a chord, or let your fingers wander.",
    icon: Piano,
    color: "peach",
  },
  {
    path: "/chords",
    kind: "chords",
    title: "Chord library",
    label: "A LITTLE HARMONY",
    description: "Choose a chord. See its notes. Hear how they fit together.",
    icon: Music2,
    color: "sage",
  },
  {
    path: "/scales",
    kind: "scales",
    title: "Scale explorer",
    label: "FOLLOW A PATTERN",
    description: "Explore the small steps that give a scale its character.",
    icon: Sparkles,
    color: "blue",
  },
  {
    path: "/progressions",
    kind: "progressions",
    title: "Progressions",
    label: "ONE THING LEADS TO ANOTHER",
    description: "Collect a few favorite chords and find where they take you.",
    icon: Layers3,
    color: "lavender",
  },
  {
    path: "/pitch-pipe",
    kind: "pitch",
    title: "Pitch & tone",
    label: "GET A FEEL FOR FREQUENCY",
    description: "Find a reference pitch, or record and see your own sound.",
    icon: Radio,
    color: "gold",
  },
  {
    path: "/studio",
    kind: "studio",
    title: "The studio",
    label: "MAKE A LITTLE MUSIC",
    description:
      "Layer a beat, sketch a melody, and turn an idea into a pattern.",
    icon: SlidersHorizontal,
    color: "rose",
  },
];

const Index = () => {
  const { pathname: rawPathname } = useLocation();
  const pathname = rawPathname.replace(/\/+$/, "") || "/";
  const session = useStudioSession();
  const { selection, select, library } = session;
  useStopOnNavigation();
  const chooseScale = useCallback(
    (notes: string[], name: string, descendingNotes?: string[]) =>
      select({ notes, name, kind: "scale", descendingNotes }),
    [select],
  );
  const active = tools.find((t) => t.path === pathname);
  const isHome = pathname === "/";
  const playChord = (notes: string[], name?: string) => {
    const next = {
      notes,
      name:
        name ||
        (selection.notes.join() === notes.join()
          ? selection.name
          : `${notes[0]} chord`),
      kind: "chord" as const,
    };
    session.togglePlay(next);
  };
  return (
    <div
      className={
        pathname === "/piano"
          ? "lumina-app piano-page"
          : pathname === "/scales"
            ? "lumina-app scale-page"
            : "lumina-app"
      }
    >
      <AppNavigation />
      <main className="lumina-main">
        {isHome ? (
          <>
            <section className="dashboard-hero">
              <div>
                <p className="studio-eyebrow">
                  <span className="eyebrow-rule" /> LEARN A LITTLE. PLAY A
                  LITTLE.
                </p>
                <h1>
                  Follow your <em>ear.</em>
                </h1>
                <p>
                  A place for musical curiosity.
                  <br />
                  Six connected tools. Plenty of room to explore.
                </p>
              </div>
              <div className="lumina-hero-signature" aria-hidden="true">
                <img
                  src={`${import.meta.env.BASE_URL}brand/lumina-coral-mark-v1.png`}
                  alt=""
                  width="160"
                  height="160"
                />
                <span>
                  GOOD THINGS START
                  <br />
                  WITH A LITTLE CURIOSITY
                </span>
              </div>
            </section>
            <section className="dashboard-section">
              <div className="dashboard-section-heading">
                <h2>Your workbench</h2>
                <span>
                  PICK A TOOL AND SETTLE IN <ChevronRight size={13} />
                </span>
              </div>
              <div className="lumina-tool-grid">
                {tools.map((tool, i) => (
                  <Link
                    key={tool.path}
                    to={tool.path}
                    className={`lumina-tool-card color-${tool.color}`}
                  >
                    <div className="tool-card-top">
                      <span className="tool-index">0{i + 1} /</span>
                      <tool.icon size={18} />
                      <span className="tool-open-arrow">
                        <ArrowUpRight size={19} />
                      </span>
                    </div>
                    <ToolArtwork kind={tool.kind} />
                    <div className="tool-card-copy">
                      <span className="studio-eyebrow">{tool.label}</span>
                      <h3>{tool.title}</h3>
                      <p>{tool.description}</p>
                    </div>
                    <span className="tool-card-open">
                      OPEN TOOL <ChevronRight size={13} />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
            <section className="dashboard-bottom">
              <span>
                <Heart size={14} /> No right answers here. Just things to hear.
              </span>
              <span>YOUR FAVORITES STAY IN THIS BROWSER</span>
            </section>
          </>
        ) : (
          <>
            <div className="workspace-title">
              <div>
                <p className="studio-eyebrow">YOUR MUSICAL WORKBENCH</p>
                <h1>{active?.title}</h1>
              </div>
              <p>{active?.description}</p>
            </div>
            {pathname === "/piano" ? (
              <PianoKeyboard />
            ) : (
              <div
                className={
                  pathname === "/scales" ? "scale-layout" : "learning-layout"
                }
              >
                <section className="focused-tool">
                  {pathname === "/chords" && (
                    <ChordLibrary
                      initialKey={selectionRoot(
                        selection.name,
                        selection.notes[0],
                      )}
                      onChordSelect={(notes, name) =>
                        select({ notes, name, kind: "chord" })
                      }
                      selectedChordNotes={selection.notes}
                      onPlayChord={playChord}
                      playingChordName={
                        session.playing && selection.kind === "chord"
                          ? selection.name
                          : undefined
                      }
                      onToggleFavorite={library.toggleFavorite}
                      favorites={library.favorites}
                      isFavorite={library.isFavorite}
                    />
                  )}
                  {pathname === "/scales" && (
                    <ScaleExplorer
                      initialRoot={selectionRoot(
                        selection.name,
                        selection.notes[0],
                      )}
                      initialScale={
                        selection.kind === "scale"
                          ? selection.name.split(" ").slice(1).join(" ")
                          : undefined
                      }
                      onScaleSelect={chooseScale}
                    />
                  )}
                  {pathname === "/progressions" && (
                    <ChordProgressionBuilder
                      onPlayProgression={session.playProgression}
                      favorites={library.favorites}
                    />
                  )}
                </section>
                {pathname !== "/scales" && (
                  <div className="learning-sidebar">
                    <SelectionPreview />
                    <aside className="discovery-note">
                      <span className="studio-eyebrow">
                        <AudioLines size={14} /> TRY A SMALL EXPERIMENT
                      </span>
                      <p>
                        {pathname === "/chords"
                          ? "Choose major, then minor on the same root. Only one note moves. How much does the feeling change?"
                          : pathname === "/scales"
                            ? "Compare a major scale with natural minor. Look for the notes that move, then listen to each selection."
                            : "Save chords with the heart in Chord library, then bring them here. Start with just two and listen to the movement."}
                      </p>
                      <Link
                        to={
                          pathname === "/progressions"
                            ? "/chords"
                            : "/pitch-pipe?view=waveform"
                        }
                        className="studio-text-link"
                      >
                        {pathname === "/progressions"
                          ? "Find some chords"
                          : "See the sound"}
                        <ArrowUpRight size={14} />
                      </Link>
                    </aside>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
      <SessionBar />
    </div>
  );
};
export default Index;
