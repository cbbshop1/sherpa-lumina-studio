import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Play } from "lucide-react";
import { useStudioSession } from "../context/StudioSession";
import { useShelf } from "../context/OwnSoundSession";
import { formatNote } from "../lib/noteSelection";
import {
  nextSteps,
  roomFromLocation,
  type StepAction,
} from "../lib/nextSteps";

type Props = {
  scope?: "pitch" | "waveform" | "spectrum";
  onAction?: (action: StepAction) => void;
  className?: string;
};

/** A small strip of natural next moves that carry your work along. */
export default function WhatNext({ scope, onAction, className = "" }: Props) {
  const { pathname, search } = useLocation();
  const { selection, play } = useStudioSession();
  const { clip, activeId } = useShelf();
  const room = roomFromLocation(pathname, search);
  const steps = nextSteps(room, {
    selection: formatNote(selection.name),
    selectionKind: selection.kind,
    hasTake: !!clip,
    takeId: activeId,
    scope,
  });
  if (!steps.length) return null;
  const act = (action: StepAction) => {
    if (action === "play-target") void play();
    onAction?.(action);
  };
  return (
    <nav className={`what-next ${className}`} aria-label="What you could do next">
      <span className="studio-eyebrow">WHAT NEXT?</span>
      <ul>
        {steps.map((step) => (
          <li key={step.id}>
            {step.to ? (
              <Link to={step.to}>
                <strong>
                  {step.label} <ArrowRight size={13} />
                </strong>
                <span>{step.hint}</span>
              </Link>
            ) : (
              <button onClick={() => step.action && act(step.action)}>
                <strong>
                  {step.action === "play-target" && (
                    <Play size={12} fill="currentColor" />
                  )}
                  {step.label}
                </strong>
                <span>{step.hint}</span>
              </button>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
