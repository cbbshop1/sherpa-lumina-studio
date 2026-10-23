import { Grid2X2, SlidersHorizontal, Sparkles } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import GlobalMidiControls from "./GlobalMidiControls";
const AppNavigation = () => (
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
