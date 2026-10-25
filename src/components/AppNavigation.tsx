import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import GlobalMidiControls from "./GlobalMidiControls";
const destinations = [
  { path: "/", label: "All tools" },
  { path: "/piano", label: "Piano" },
  { path: "/chords", label: "Chords" },
  { path: "/scales", label: "Scales" },
  { path: "/progressions", label: "Progressions" },
  { path: "/pitch-pipe", label: "Pitch & tone" },
  { path: "/studio", label: "Studio" },
];
const AppNavigation = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const path = pathname.replace(/\/+$/, "") || "/";
  return (
    <>
      <header className="lumina-header">
        <div className="lumina-header-inner">
          <Link to="/" className="lumina-brand" aria-label="Lumina home">
            <img
              className="lumina-brand-mark"
              src={`${import.meta.env.BASE_URL}brand/lumina-coral-mark-v1.png`}
              alt=""
              width="56"
              height="56"
            />
            <span>
              Lumina<small>MUSIC STUDIO</small>
            </span>
          </Link>
          <nav
            className="lumina-main-nav tool-nav"
            aria-label="Main navigation"
          >
            {destinations.map((tool) => (
              <NavLink key={tool.path} to={tool.path} end={tool.path === "/"}>
                {tool.label}
              </NavLink>
            ))}
          </nav>
          <label className="tool-picker">
            <span>GO TO</span>
            <select
              aria-label="Go to a tool"
              value={path}
              onChange={(event) => navigate(event.target.value)}
            >
              {destinations.map((tool) => (
                <option key={tool.path} value={tool.path}>
                  {tool.label}
                </option>
              ))}
            </select>
          </label>
          <a
            className="header-note clearing-return"
            href={
              import.meta.env.BASE_URL === "/"
                ? "https://the-clearing.cbbsherpa.chatgpt.site/#learn"
                : "/#learn"
            }
          >
            <i /> THE CLEARING ↗
          </a>
        </div>
      </header>
      <GlobalMidiControls />
    </>
  );
};
export default AppNavigation;
