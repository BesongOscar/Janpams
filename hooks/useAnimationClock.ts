import { useState, useEffect } from 'react';

export interface AnimationClock {
  dashPhase: number;
  pulsePhase: number;
}

let sharedState: AnimationClock = { dashPhase: 0, pulsePhase: 0 };
const listeners = new Set<(v: AnimationClock) => void>();
let started = false;

function tick() {
  sharedState = {
    dashPhase: (sharedState.dashPhase + 0.05) % 1,
    pulsePhase: (sharedState.pulsePhase + 0.04) % 1,
  };
  listeners.forEach((fn) => fn(sharedState));
}

function startClock() {
  if (started) return;
  started = true;
  setInterval(tick, 50);
}

export function useAnimationClock(): AnimationClock {
  const [state, setState] = useState<AnimationClock>(sharedState);

  useEffect(() => {
    listeners.add(setState);
    startClock();
    return () => {
      listeners.delete(setState);
    };
  }, []);

  return state;
}
