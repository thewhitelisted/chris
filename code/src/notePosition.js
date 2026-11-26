export const NOTE_MARGIN = 8

// Moves a note of the given size so all of it lies inside the viewport, NOTE_MARGIN from each edge.
// A note larger than the viewport keeps its top-left corner at the margin (its CSS caps the height,
// so in practice this only happens to the width on very narrow screens).
export function clampNotePosition(position, size, viewport) {
  const clamp = (value, extent, available) => {
    const max = Math.max(NOTE_MARGIN, available - extent - NOTE_MARGIN)
    return Math.min(Math.max(value, NOTE_MARGIN), max)
  }
  return {
    x: clamp(position.x, size.width, viewport.width),
    y: clamp(position.y, size.height, viewport.height),
  }
}
