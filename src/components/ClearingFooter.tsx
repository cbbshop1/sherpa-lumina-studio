// The Clearing's site footer. Lumina is served inside the Clearing under /lumina/,
// so the footer only appears in that build, matching the footer on the Clearing's own pages.
const inClearing = () => import.meta.env.BASE_URL === "/lumina/";

const links = [
  ["/", "The Clearing"],
  ["/#read", "Read"],
  ["/#learn", "Learn"],
  ["/#play", "Play"],
  ["/map.html", "Map of everything"],
  ["/about.html", "About"],
  ["/about.html#contact", "Contact"],
] as const;

const ClearingFooter = () =>
  inClearing() ? (
    <footer className="clearing-footer">
      <div className="clearing-footer-inner">
        <nav aria-label="Site links">
          {links.map(([href, label]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
        </nav>
        <p>© 2026 The Clearing Collective. All rights reserved.</p>
      </div>
    </footer>
  ) : null;

export default ClearingFooter;
