export function readSurveyCssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return fallback;
  }
  const value = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

export interface SurveyMapColors {
  selectedOutline: string;
  satOutline: string;
  satSelectedOutline: string;
  satSelectedFill: string;
}

export function getSurveyMapColors(): SurveyMapColors {
  return {
    selectedOutline: readSurveyCssVar('--rr-text', '#16201B'),
    satOutline: readSurveyCssVar('--rr-text-inverse', '#F5F6F2'),
    satSelectedOutline: readSurveyCssVar('--rr-space-hh', '#E0803F'),
    satSelectedFill: readSurveyCssVar('--rr-water', '#1D6FA3'),
  };
}

export interface SurveyGlobeColors {
  spaceText: string;
  spaceHh: string;
  spaceHv: string;
  spaceWater: string;
}

export function getSurveyGlobeColors(): SurveyGlobeColors {
  return {
    spaceText: readSurveyCssVar('--rr-space-text', '#E6EAE4'),
    spaceHh: readSurveyCssVar('--rr-space-hh', '#E0803F'),
    spaceHv: readSurveyCssVar('--rr-space-hv', '#6FBF8E'),
    spaceWater: readSurveyCssVar('--rr-space-water', '#5AA9D6'),
  };
}
