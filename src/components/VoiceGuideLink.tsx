import { ArrowRight } from "lucide-react";

// The voice guide lives on the Clearing site, beside Lumina, so the link only
// appears in the Clearing build (served under /lumina/).
const VOICE_GUIDE_URL = "/how-a-voice-shapes-its-sound.html";
const hasVoiceGuide = () => import.meta.env.BASE_URL === "/lumina/";

const VoiceGuideLink = () =>
  hasVoiceGuide() ? (
    <p className="voice-guide-link">
      <span>Why does a voice look like this?</span>
      <a href={VOICE_GUIDE_URL}>
        Explore how a voice shapes its sound <ArrowRight size={14} />
      </a>
    </p>
  ) : null;

export default VoiceGuideLink;
