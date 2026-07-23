import test from "node:test";
import assert from "node:assert/strict";

import {
  chooseAutoQualityTier,
  detectPreferredQualityTier,
  resolveQualityTier
} from "../src/qualityProfiles.js";

test("starts phone-sized iOS devices in the mobile profile", () => {
  assert.equal(
    detectPreferredQualityTier({
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
      platform: "iPhone",
      maxTouchPoints: 5,
      coarsePointer: true,
      shortScreenEdge: 390
    }),
    "mobile"
  );
});

test("uses balanced for touch tablets and high for desktop", () => {
  assert.equal(
    detectPreferredQualityTier({
      platform: "MacIntel",
      maxTouchPoints: 5,
      coarsePointer: true,
      shortScreenEdge: 820
    }),
    "balanced"
  );
  assert.equal(detectPreferredQualityTier({ shortScreenEdge: 1080 }), "high");
});

test("manual modes override the detected auto tier", () => {
  assert.equal(resolveQualityTier("auto", "mobile"), "mobile");
  assert.equal(resolveQualityTier("high", "mobile"), "high");
  assert.equal(resolveQualityTier("economy", "high"), "economy");
});

test("auto quality degrades under load and only recovers to the preferred tier", () => {
  assert.equal(
    chooseAutoQualityTier({
      currentTier: "balanced",
      preferredTier: "balanced",
      averageFrameMs: 34
    }),
    "mobile"
  );
  assert.equal(
    chooseAutoQualityTier({
      currentTier: "mobile",
      preferredTier: "balanced",
      averageFrameMs: 16
    }),
    "balanced"
  );
  assert.equal(
    chooseAutoQualityTier({
      currentTier: "balanced",
      preferredTier: "balanced",
      averageFrameMs: 16
    }),
    "balanced"
  );
});

