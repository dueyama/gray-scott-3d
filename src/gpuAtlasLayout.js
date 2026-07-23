export function createAtlasLayout(size) {
  const normalizedSize = Math.max(1, Number(size) | 0);
  const columns = Math.ceil(Math.sqrt(normalizedSize));
  const rows = Math.ceil(normalizedSize / columns);

  return {
    size: normalizedSize,
    columns,
    rows,
    width: columns * normalizedSize,
    height: rows * normalizedSize
  };
}

export function atlasPixelIndex(layout, x, y, z) {
  const tileColumn = x % layout.columns;
  const tileRow = Math.floor(x / layout.columns);
  const pixelX = tileColumn * layout.size + z;
  const pixelY = tileRow * layout.size + y;
  return pixelY * layout.width + pixelX;
}

