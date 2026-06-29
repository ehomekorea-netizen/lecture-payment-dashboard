import React, { useMemo } from 'react';

const STAR_COLOR = '#00E5FF';
const LINE_COLOR = 'rgba(0,229,255,0.25)';
const GLOW_COLOR = 'rgba(0,229,255,0.6)';
const W = 800;
const H = 500;

const keyframesStyle = `
@keyframes twinkle {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}`;

function parseLectureDay(dateStr) {
  const korean = dateStr.match(/(\d+)월\s*(\d+)일/);
  if (korean) return parseInt(korean[2], 10);
  const iso = dateStr.match(/\d{4}-(\d{2})-(\d{2})/);
  if (iso) return parseInt(iso[2], 10);
  return null;
}

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 7) % 2147483647;
    return (s & 0x7fffffff) / 0x7fffffff;
  };
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

export default function ConstellationView({ lectures = [], currentYear, currentMonth }) {
  const { lectureDays, positions, connections, branches } = useMemo(() => {
    const totalDays = getDaysInMonth(currentYear, currentMonth);
    const daySet = new Set();
    lectures.forEach((l) => {
      const d = parseLectureDay(l.date);
      if (d && d >= 1 && d <= totalDays) daySet.add(d);
    });
    const sorted = [...daySet].sort((a, b) => a - b);

    const cols = 7;
    const rows = Math.ceil(totalDays / cols);
    const padX = 80, padY = 70;
    const cellW = (W - padX * 2) / (cols - 1 || 1);
    const cellH = (H - padY * 2) / (rows - 1 || 1);
    const rand = seededRandom(currentYear * 13 + currentMonth * 7 + 3);

    const pos = {};
    for (let d = 1; d <= totalDays; d++) {
      const idx = d - 1;
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      pos[d] = {
        x: padX + col * cellW + (rand() - 0.5) * cellW * 0.35,
        y: padY + row * cellH + (rand() - 0.5) * cellH * 0.35,
      };
    }

    const conns = [];
    for (let i = 1; i < sorted.length; i++) {
      conns.push([sorted[i - 1], sorted[i]]);
    }

    const branchLines = [];
    const randB = seededRandom(currentMonth * 31 + currentYear);
    sorted.forEach((day) => {
      if (randB() > 0.55) return;
      const p = pos[day];
      const angle = randB() * Math.PI * 2;
      const len = 30 + randB() * 50;
      branchLines.push({
        x1: p.x, y1: p.y,
        x2: Math.min(W - 20, Math.max(20, p.x + Math.cos(angle) * len)),
        y2: Math.min(H - 20, Math.max(20, p.y + Math.sin(angle) * len)),
      });
    });

    return { lectureDays: sorted, positions: pos, connections: conns, branches: branchLines };
  }, [lectures, currentYear, currentMonth]);

  return (
    <div style={{ width: '100%', borderRadius: 16, overflow: 'hidden' }}>
      <style>{keyframesStyle}</style>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <defs>
          <radialGradient id="bg">
            <stop offset="0%" stopColor="#0d1b3e" />
            <stop offset="100%" stopColor="#060e23" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="lineGlow">
            <feGaussianBlur stdDeviation="1.8" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <rect width={W} height={H} fill="url(#bg)" />

        {/* background tiny stars */}
        {Array.from({ length: 60 }, (_, i) => {
          const r = seededRandom(i * 97 + 11);
          return (
            <circle key={`bg-${i}`} cx={r() * W} cy={r() * H} r={0.5 + r() * 1.2}
              fill="rgba(255,255,255,0.25)"
              style={{ animation: `twinkle ${2 + r() * 4}s ease-in-out ${r() * 3}s infinite` }}
            />
          );
        })}

        {/* branch lines */}
        {branches.map((b, i) => (
          <line key={`br-${i}`} x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2}
            stroke="rgba(0,229,255,0.12)" strokeWidth={1} strokeDasharray="4 6"
            filter="url(#lineGlow)"
          />
        ))}

        {/* constellation lines */}
        {connections.map(([a, b], i) => (
          <line key={`ln-${i}`}
            x1={positions[a].x} y1={positions[a].y}
            x2={positions[b].x} y2={positions[b].y}
            stroke={LINE_COLOR} strokeWidth={1.6} filter="url(#lineGlow)"
          />
        ))}

        {/* star nodes */}
        {lectureDays.map((day, i) => {
          const p = positions[day];
          const delay = (i * 0.7) % 4;
          return (
            <g key={day}>
              <circle cx={p.x} cy={p.y} r={10} fill={GLOW_COLOR} opacity={0.2} />
              <circle cx={p.x} cy={p.y} r={5} fill={STAR_COLOR} filter="url(#glow)"
                style={{ animation: `twinkle ${2.5 + delay}s ease-in-out ${delay}s infinite` }}
              />
              <circle cx={p.x} cy={p.y} r={2} fill="#fff" />
              <text x={p.x + 10} y={p.y - 10} fill="rgba(200,230,255,0.85)"
                fontSize={11} fontFamily="'Segoe UI',system-ui,sans-serif" fontWeight={600}
              >
                {day}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
