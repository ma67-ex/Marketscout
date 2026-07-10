// Ambient background: a few enormous, softly-blurred light sources drifting
// past each other very slowly, with a faint film-grain texture over the top.
// No particles, no lines, no sweep — just quiet depth and motion, the way a
// premium product site breathes without ever asking for attention. Pure CSS
// (no canvas, no JS loop), so it costs nothing to render or animate. Fixed,
// pointer-events: none, negative z-index, monochrome.

export default function AmbientDriftBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background"
    >
      <div className="ambient-blob ambient-blob-a" />
      <div className="ambient-blob ambient-blob-b" />
      <div className="ambient-blob ambient-blob-c" />
      <div className="ambient-grain" />
    </div>
  );
}
