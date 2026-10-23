import { Grid2X2, SlidersHorizontal, Sparkles, Waves } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import GlobalMidiControls from "./GlobalMidiControls";
const AppNavigation = () => (
  <>
    <header className="lumina-header">
      <div className="lumina-header-inner">
        <Link to="/" className="lumina-brand" aria-label="Lumina home">
          <span className="lumina-brand-mark">
            <Waves size={25} />
          </span>
          <span>
            lumina<small>A LITTLE MUSIC STUDIO</small>
          </span>
        </Link>
        <nav className="lumina-main-nav" aria-label="Main navigation">
          <NavLink to="/" end>
            <Grid2X2 size={16} />
            <span>All tools</span>
          </NavLink>
          <NavLink to="/chords">
            <Sparkles size={16} />
            <span>Explore</span>
          </NavLink>
          <NavLink to="/studio">
            <SlidersHorizontal size={16} />
            <span>Studio</span>
          </NavLink>
        </nav>
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
export default AppNavigation;
