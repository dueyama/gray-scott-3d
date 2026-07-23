import test from "node:test";
import assert from "node:assert/strict";

import { atlasPixelIndex, createAtlasLayout } from "../src/gpuAtlasLayout.js";

test("creates a compact atlas for common simulation sizes", () => {
  assert.deepEqual(createAtlasLayout(64), {
    size: 64,
    columns: 8,
    rows: 8,
    width: 512,
    height: 512
  });
  assert.deepEqual(createAtlasLayout(100), {
    size: 100,
    columns: 10,
    rows: 10,
    width: 1000,
    height: 1000
  });
});

test("maps every field coordinate to a unique atlas pixel", () => {
  const layout = createAtlasLayout(5);
  const indices = new Set();

  for (let x = 0; x < layout.size; x += 1) {
    for (let y = 0; y < layout.size; y += 1) {
      for (let z = 0; z < layout.size; z += 1) {
        const index = atlasPixelIndex(layout, x, y, z);
        assert.ok(index >= 0);
        assert.ok(index < layout.width * layout.height);
        indices.add(index);
      }
    }
  }

  assert.equal(indices.size, layout.size ** 3);
});

