export const QUALITY_ORDER = ["economy", "mobile", "balanced", "high"];

export const QUALITY_PROFILES = {
  economy: {
    pixelRatioCap: 1,
    raySteps: 80,
    snapshotIntervalMs: 2000,
    computeBudgetMs: 6,
    maxStepsPerChunk: 6
  },
  mobile: {
    pixelRatioCap: 1,
    raySteps: 96,
    snapshotIntervalMs: 1500,
    computeBudgetMs: 8,
    maxStepsPerChunk: 8
  },
  balanced: {
    pixelRatioCap: 1.25,
    raySteps: 112,
    snapshotIntervalMs: 1000,
    computeBudgetMs: 10,
    maxStepsPerChunk: 24
  },
  high: {
    pixelRatioCap: 2,
    raySteps: 144,
    snapshotIntervalMs: 500,
    computeBudgetMs: 12,
    maxStepsPerChunk: 100
  }
};

export function detectPreferredQualityTier({
  userAgent = "",
  platform = "",
  maxTouchPoints = 0,
  coarsePointer = false,
  shortScreenEdge = 1024,
  mobileHint = false
} = {}) {
  const isiOS =
    /iPad|iPhone|iPod/i.test(userAgent) ||
    (platform === "MacIntel" && Number(maxTouchPoints) > 1);
  const phoneSized = Number(shortScreenEdge) <= 700;

  if (mobileHint || (coarsePointer && phoneSized) || (isiOS && phoneSized)) {
    return "mobile";
  }
  if (coarsePointer || isiOS) {
    return "balanced";
  }
  return "high";
}

export function resolveQualityTier(mode, autoTier) {
  if (mode === "high") return "high";
  if (mode === "economy") return "economy";
  return QUALITY_PROFILES[autoTier] ? autoTier : "balanced";
}

export function chooseAutoQualityTier({
  currentTier,
  preferredTier,
  averageFrameMs
}) {
  const currentIndex = Math.max(0, QUALITY_ORDER.indexOf(currentTier));
  const preferredIndex = Math.max(0, QUALITY_ORDER.indexOf(preferredTier));

  if (averageFrameMs > 30 && currentIndex > 0) {
    return QUALITY_ORDER[currentIndex - 1];
  }
  if (averageFrameMs < 18 && currentIndex < preferredIndex) {
    return QUALITY_ORDER[currentIndex + 1];
  }
  return QUALITY_ORDER[currentIndex];
}

