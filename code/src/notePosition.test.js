import { describe, it, expect } from 'vitest'
import { clampNotePosition, NOTE_MARGIN } from './notePosition.js'

// Input classes per axis: inside, at each limit, one past each limit, far past, negative,
// note exactly as large as the room, note larger than the room.

const viewport = { width: 1280, height: 720 }
const size = { width: 300, height: 438 }

describe('clampNotePosition', () => {
  it('keeps a position that already fits', () => {
    expect(clampNotePosition({ x: 100, y: 200 }, size, viewport)).toEqual({ x: 100, y: 200 })
  })

  it('keeps the limits themselves and moves anything one past them', () => {
    const maxX = 1280 - 300 - NOTE_MARGIN
    const maxY = 720 - 438 - NOTE_MARGIN
    expect(clampNotePosition({ x: maxX, y: maxY }, size, viewport)).toEqual({ x: maxX, y: maxY })
    expect(clampNotePosition({ x: maxX + 1, y: maxY + 1 }, size, viewport)).toEqual({ x: maxX, y: maxY })
    expect(clampNotePosition({ x: NOTE_MARGIN, y: NOTE_MARGIN }, size, viewport)).toEqual({ x: NOTE_MARGIN, y: NOTE_MARGIN })
    expect(clampNotePosition({ x: NOTE_MARGIN - 1, y: NOTE_MARGIN - 1 }, size, viewport)).toEqual({ x: NOTE_MARGIN, y: NOTE_MARGIN })
  })

  it('pulls a note placed for a shorter note back above the bottom edge', () => {
    // Projects.jsx can place the top at innerHeight - 350; a 438px note would end 68px below the edge.
    expect(clampNotePosition({ x: 20, y: 370 }, size, viewport)).toEqual({ x: 20, y: 274 })
  })

  it('handles far-off and negative positions', () => {
    expect(clampNotePosition({ x: -500, y: 1e6 }, size, viewport)).toEqual({ x: NOTE_MARGIN, y: 720 - 438 - NOTE_MARGIN })
  })

  it('puts a note exactly as large as the room at the margin', () => {
    expect(clampNotePosition({ x: 50, y: 50 }, { width: 1264, height: 704 }, viewport)).toEqual({ x: NOTE_MARGIN, y: NOTE_MARGIN })
  })

  it('pins a note larger than the room to the top-left margin', () => {
    expect(clampNotePosition({ x: 50, y: 50 }, { width: 400, height: 900 }, { width: 375, height: 667 })).toEqual({ x: NOTE_MARGIN, y: NOTE_MARGIN })
  })

  it('always fits a note that fits the room, and never moves one that is already inside (random cases)', () => {
    let seed = 7
    const rand = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n }
    for (let i = 0; i < 2000; i++) {
      const view = { width: 200 + rand(2000), height: 200 + rand(1200) }
      const note = { width: 1 + rand(view.width - 2 * NOTE_MARGIN), height: 1 + rand(view.height - 2 * NOTE_MARGIN) }
      const start = { x: rand(4000) - 2000, y: rand(4000) - 2000 }
      const { x, y } = clampNotePosition(start, note, view)
      expect(x).toBeGreaterThanOrEqual(NOTE_MARGIN)
      expect(y).toBeGreaterThanOrEqual(NOTE_MARGIN)
      expect(x + note.width).toBeLessThanOrEqual(view.width - NOTE_MARGIN)
      expect(y + note.height).toBeLessThanOrEqual(view.height - NOTE_MARGIN)
      const inside = (v, e, room) => v >= NOTE_MARGIN && v + e <= room - NOTE_MARGIN
      if (inside(start.x, note.width, view.width)) expect(x).toBe(start.x)
      if (inside(start.y, note.height, view.height)) expect(y).toBe(start.y)
    }
  })
})
