/**
 * Systems & Op Art (Part 3, the Retrofuturist): standard circuits drawn
 * with their textbook symbols and formulas, instrument dials laid out on
 * their real scales, slide-rule scales (logarithms), the Smith chart, the
 * Platonic solids and the golden spiral — geometry and engineering as
 * vector line work.
 */
import { DEG, INK, caption, circle, dot, f1, line, path, polyline, rect, text, type Set7Design } from "./kit";

const FEAT = { geometric: 0.75, line_art: 0.7, clean_minimal: 0.55, retro: 0.45, dark_industrial: 0.35, abstract: 0.35, density: 0.25, contrast: 0.75, typography: 0.2 };

/* ------------------------------------------------------------------ */
/* Schematic symbols                                                    */
/* ------------------------------------------------------------------ */

type Body = "R" | "C" | "L" | "D" | "BAT" | "AC" | "G";
const BODIES: Record<Body, string> = {
  R: path(polyline([[-15, 0], [-12.5, -5], [-7.5, 5], [-2.5, -5], [2.5, 5], [7.5, -5], [12.5, 5], [15, 0]]), 1.3),
  C: line(-15, 0, -3, 0, 1.3) + line(3, 0, 15, 0, 1.3) + line(-3, -8, -3, 8, 1.6) + line(3, -8, 3, 8, 1.6),
  L: path("M-15 0h3a3 3 0 0 1 6 0a3 3 0 0 1 6 0a3 3 0 0 1 6 0a3 3 0 0 1 6 0h3", 1.3),
  D: line(-15, 0, -6, 0, 1.3) + path("M-6 -6L-6 6L6 0Z", 1.3) + line(6, -6, 6, 6, 1.6) + line(6, 0, 15, 0, 1.3),
  BAT: line(-15, 0, -3, 0, 1.3) + line(3, 0, 15, 0, 1.3) + line(-3, -9, -3, 9, 1.6) + line(3, -5, 3, 5, 2.6),
  AC: line(-15, 0, -10, 0, 1.3) + line(10, 0, 15, 0, 1.3) + circle(0, 0, 10, 1.3) + path("M-6 0q3 -7 6 0t6 0", 1.1),
  G: line(-15, 0, -8, 0, 1.3) + line(8, 0, 15, 0, 1.3) + circle(0, 0, 8, 1.3) + text(0, 3, "G", 7, { bold: true }),
};

/** A two-terminal part between two points on a line (axis-aligned), leads drawn to its ends, labelled beside. */
function part(kind: Body, a: [number, number], b: [number, number], label = ""): string {
  const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2;
  const vertical = a[0] === b[0];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ang = vertical ? 90 : 0;
  let s = `<g transform="translate(${f1(cx)} ${f1(cy)}) rotate(${ang})">${BODIES[kind]}</g>`;
  if (len > 30) {
    if (vertical) s += line(a[0], a[1], a[0], cy - 15 * Math.sign(b[1] - a[1]), 1.3) + line(b[0], cy + 15 * Math.sign(b[1] - a[1]), b[0], b[1], 1.3);
    else s += line(a[0], a[1], cx - 15 * Math.sign(b[0] - a[0]), a[1], 1.3) + line(cx + 15 * Math.sign(b[0] - a[0]), b[1], b[0], b[1], 1.3);
  }
  if (label) s += vertical ? text(cx + 13, cy + 2.5, label, 7, { anchor: "start" }) : text(cx, cy - 12, label, 7);
  return s;
}
const wire = (...pts: [number, number][]) => path(polyline(pts), 1.3);
const node = (x: number, y: number) => dot(x, y, 2.2);
const ground = (x: number, y: number) => line(x, y, x, y + 6, 1.3) + line(x - 9, y + 6, x + 9, y + 6, 1.3) + line(x - 6, y + 10, x + 6, y + 10, 1.3) + line(x - 3, y + 14, x + 3, y + 14, 1.3);
const terminal = (x: number, y: number, label: string, left = true) => circle(x, y, 2.6, 1.2) + text(x + (left ? -6 : 6), y + 2.5, label, 7, { anchor: left ? "end" : "start" });

function npn(x: number, y: number): string {
  // Base at the left (x - 14, y), collector up, emitter down with its arrow.
  return circle(x, y, 14, 1.2) + line(x - 14, y, x - 5, y, 1.3) + line(x - 5, y - 8, x - 5, y + 8, 2) + line(x - 5, y - 4, x + 6, y - 11, 1.3) + line(x + 6, y - 11, x + 6, y - 20, 1.3) + line(x - 5, y + 4, x + 6, y + 11, 1.3) + line(x + 6, y + 11, x + 6, y + 20, 1.3) + `<path d="M${f1(x + 6)} ${f1(y + 11)}l-5.5 -1l2.5 -3.5Z" fill="${INK}"/>`;
}

function circuits(): Set7Design[] {
  const list: [string, string, string, string, string][] = [];
  // RC low-pass filter.
  list.push(["RC Low-Pass Filter", "rc-lowpass", "fc = 1 / 2πRC",
    terminal(50, 120, "IN") + part("R", [53, 120], [150, 120], "R") + wire([150, 120], [250, 120]) + node(150, 120) + terminal(250, 120, "OUT", false) + part("C", [150, 120], [150, 200], "C") + ground(150, 200) + wire([50, 200], [140, 200]) + circle(50, 200, 2.6, 1.2),
    "A resistor in series and a capacitor to ground: high frequencies pass to ground, low ones through; its cut-off is 1 / 2πRC."]);
  // Voltage divider.
  list.push(["Voltage Divider", "divider", "Vout = Vin · R2 / (R1 + R2)",
    terminal(150, 60, "Vin") + part("R", [150, 63], [150, 140], "R1") + node(150, 140) + wire([150, 140], [230, 140]) + terminal(233, 140, "Vout", false) + part("R", [150, 140], [150, 220], "R2") + ground(150, 220),
    "Two resistors in series across a supply: the voltage between them is the supply scaled by R2 over R1 + R2."]);
  // Wheatstone bridge.
  list.push(["Wheatstone Bridge", "wheatstone", "Balanced when R1 / R2 = R3 / Rx",
    wire([150, 60], [100, 110]) + wire([150, 60], [200, 110]) + wire([100, 110], [150, 160]) + wire([200, 110], [150, 160]) +
      `<g transform="translate(125 85) rotate(-45)">${BODIES.R}</g><g transform="translate(175 85) rotate(45)">${BODIES.R}</g><g transform="translate(125 135) rotate(45)">${BODIES.R}</g><g transform="translate(175 135) rotate(-45)">${BODIES.R}</g>` +
      part("G", [100, 110], [200, 110]) + node(100, 110) + node(200, 110) + node(150, 60) + node(150, 160) +
      text(106, 78, "R1", 7) + text(194, 78, "R3", 7) + text(106, 150, "R2", 7) + text(196, 150, "Rx", 7) +
      wire([150, 60], [150, 40], [60, 40], [60, 200], [150, 200], [150, 160]) + part("BAT", [60, 90], [60, 150]),
    "Four resistors in a diamond with a galvanometer across it: when no current flows through the meter, the unknown resistance follows from the other three."]);
  // Half-wave rectifier.
  list.push(["Half-Wave Rectifier", "halfwave", "One diode passes one half of each cycle",
    part("AC", [60, 100], [60, 190]) + wire([60, 100], [60, 70], [100, 70]) + part("D", [100, 70], [200, 70], "D") + wire([200, 70], [240, 70]) + part("R", [240, 70], [240, 190], "RL") + wire([240, 190], [60, 190]) + path("M252 110l6 -8l6 8l6 -8", 0.9),
    "An alternating supply, one diode and a load: the diode passes only the positive half of each cycle."]);
  // Full-wave bridge.
  list.push(["Bridge Rectifier", "bridge", "Four diodes turn both halves of the cycle one way",
    part("AC", [50, 90], [50, 190]) + wire([50, 90], [50, 60], [150, 60]) + wire([50, 190], [50, 220], [150, 220]) +
      `<g transform="translate(125 115) rotate(-45)">${BODIES.D}</g><g transform="translate(175 115) rotate(45)">${BODIES.D}</g><g transform="translate(125 165) rotate(45)">${BODIES.D}</g><g transform="translate(175 165) rotate(-45)">${BODIES.D}</g>` +
      wire([150, 60], [150, 90]) + wire([150, 190], [150, 220]) + wire([150, 90], [136, 104]) + wire([150, 90], [164, 104]) + wire([150, 190], [136, 176]) + wire([150, 190], [164, 176]) +
      wire([114, 126], [100, 140]) + wire([114, 154], [100, 140]) + wire([186, 126], [200, 140]) + wire([186, 154], [200, 140]) + node(100, 140) + node(200, 140) +
      wire([200, 140], [250, 140]) + part("R", [250, 140], [250, 250], "RL") + wire([250, 250], [100, 250], [100, 140]),
    "Four diodes in a ring feeding a load: whichever way the supply swings, current flows through the load the same way."]);
  // Common-emitter amplifier.
  list.push(["Common-Emitter Amplifier", "ce-amp", "Gain ≈ − Rc / Re",
    wire([60, 50], [240, 50]) + text(150, 44, "+V", 7, { bold: true }) + part("R", [110, 50], [110, 130], "R1") + part("R", [110, 150], [110, 230], "R2") + wire([110, 130], [110, 150]) + node(110, 140) + ground(110, 230) +
      part("C", [50, 140], [110, 140]) + terminal(47, 140, "IN") + wire([110, 140], [136, 140]) + npn(150, 140) + part("R", [156, 50], [156, 120], "Rc") + part("R", [156, 160], [156, 230], "Re") + ground(156, 230) + node(156, 120) + wire([156, 120], [200, 120]) + part("C", [200, 120], [250, 120]) + terminal(253, 120, "OUT", false),
    "One NPN transistor biased by a divider, with collector and emitter resistors: a small signal at the base comes out larger and inverted at the collector."]);
  // Inverting op-amp.
  list.push(["Inverting Amplifier", "inverting", "Gain = − Rf / Rin",
    path("M130 110L130 170L185 140Z", 1.4) + text(137, 127, "−", 9) + text(137, 162, "+", 8) + terminal(47, 125, "IN") + part("R", [50, 125], [120, 125], "Rin") + wire([120, 125], [130, 125]) + node(115, 125) + wire([115, 125], [115, 80]) + part("R", [115, 80], [200, 80], "Rf") + wire([200, 80], [200, 140]) + wire([185, 140], [250, 140]) + node(200, 140) + terminal(253, 140, "OUT", false) + wire([130, 155], [115, 155], [115, 190]) + ground(115, 190),
    "An operational amplifier with its feedback resistor to the inverting input: the output is the input times −Rf / Rin."]);
  // 555 astable.
  list.push(["555 Astable Timer", "555", "f = 1.44 / ((Ra + 2Rb) C)",
    rect(120, 100, 60, 90, 1.4) + text(150, 150, "555", 10, { bold: true }) + text(124, 116, "7", 6, { anchor: "start" }) + text(124, 136, "6", 6, { anchor: "start" }) + text(124, 176, "2", 6, { anchor: "start" }) + text(176, 116, "8", 6, { anchor: "end" }) + text(176, 146, "3", 6, { anchor: "end" }) + text(176, 186, "1", 6, { anchor: "end" }) +
      wire([60, 50], [240, 50]) + text(150, 44, "+V", 7, { bold: true }) + part("R", [80, 50], [80, 112], "Ra") + node(80, 112) + wire([80, 112], [120, 112]) + part("R", [80, 112], [80, 172], "Rb") + node(80, 172) + wire([80, 132], [120, 132]) + wire([80, 172], [120, 172]) + part("C", [80, 172], [80, 240], "C") + ground(80, 240) + wire([210, 50], [210, 112], [180, 112]) + wire([180, 182], [210, 182], [210, 240]) + ground(210, 240) + wire([180, 142], [250, 142]) + terminal(253, 142, "OUT", false) + path("M232 160h5v-8h5v8h5v-8h5", 0.9),
    "The 555 timer wired to run free: the capacitor charges through Ra and Rb and discharges through Rb, making a square wave at 1.44 / ((Ra + 2Rb) C)."]);
  // LC tank.
  list.push(["LC Tank Circuit", "lc-tank", "f = 1 / 2π√LC",
    wire([100, 80], [200, 80]) + wire([100, 200], [200, 200]) + part("L", [100, 80], [100, 200], "L") + part("C", [200, 80], [200, 200], "C") + node(100, 80) + node(200, 80) + node(100, 200) + node(200, 200) + path("M130 140q5 -14 10 0t10 0t10 0t10 0", 1),
    "An inductor and a capacitor in a loop, trading energy back and forth at its resonant frequency 1 / 2π√LC."]);
  return list.map(([title, key, formula, body, how]) => ({
    body: `<g transform="translate(150 150) scale(1.2) translate(-150 -150)">${body}</g>` + caption(318, title, formula),
    variant: "schematic",
    category: "systems" as const,
    title,
    subject: `${title} Schematic`,
    description: `The ${title.toLowerCase()} as a schematic in standard symbols. ${how}`,
    features: { ...FEAT, dark_industrial: 0.45 },
    sigKey: `circuit-${key}`,
  }));
}

function gates(): Set7Design {
  // Seven gate symbols with their truth tables.
  const g: [string, (a: number, b: number) => number, string][] = [
    ["AND", (a, b) => a & b, "M-12 -10h12a10 10 0 0 1 0 20h-12Z"],
    ["OR", (a, b) => a | b, "M-14 -10q12 0 24 10q-12 10 -24 10q6 -10 0 -20Z"],
    ["XOR", (a, b) => a ^ b, "M-12 -10q12 0 24 10q-12 10 -24 10q6 -10 0 -20ZM-17 -10q6 10 0 20"],
    ["NAND", (a, b) => 1 - (a & b), "M-12 -10h12a10 10 0 0 1 0 20h-12Z"],
    ["NOR", (a, b) => 1 - (a | b), "M-14 -10q12 0 24 10q-12 10 -24 10q6 -10 0 -20Z"],
    ["XNOR", (a, b) => 1 - (a ^ b), "M-12 -10q12 0 24 10q-12 10 -24 10q6 -10 0 -20ZM-17 -10q6 10 0 20"],
  ];
  let s = "";
  g.forEach(([name, fn, d], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 70 + col * 140, y = 60 + row * 82;
    const inv = name.startsWith("N") || name === "XNOR";
    s += `<g transform="translate(${x} ${y})">${path(d, 1.3)}${inv ? circle(13.5, 0, 3, 1.2) : ""}${line(-22, -5, -12, -5, 1.2)}${line(-22, 5, -12, 5, 1.2)}${line(inv ? 16.5 : 10, 0, 24, 0, 1.2)}</g>`;
    s += text(x, y + 22, name, 7, { bold: true });
    [[0, 0], [0, 1], [1, 0], [1, 1]].forEach(([a, b], k) => (s += text(x - 20 + k * 13, y + 36, `${a}${b}`, 5.5) + text(x - 20 + k * 13, y + 45, String(fn(a, b)), 6, { bold: true })));
  });
  s += `<g transform="translate(150 300)">${path("M-10 -10L-10 10L8 0Z", 1.3)}${circle(11, 0, 3, 1.2)}${line(-20, 0, -10, 0, 1.2)}${line(14, 0, 22, 0, 1.2)}</g>` + text(150, 322, "NOT: 0 → 1, 1 → 0", 6);
  return {
    body: s + caption(345, "Logic Gates", "The seven, with their truth tables"),
    variant: "logic-gates",
    category: "systems",
    title: "Logic Gates and Truth Tables",
    subject: "Logic Gate Symbols",
    description: "AND, OR, XOR, NAND, NOR, XNOR and NOT in their standard distinctive-shape symbols, each with its truth table for inputs 00, 01, 10 and 11.",
    features: { ...FEAT, typography: 0.35 },
    sigKey: "gates",
  };
}

/* ------------------------------------------------------------------ */
/* Dials                                                                */
/* ------------------------------------------------------------------ */

/** A round dial: ticks on an arc, labels, a needle. */
function dial(o: { from: number; to: number; ticks: number; major: number; labels: (i: number) => string; needle: number; r?: number; inner?: string; words?: [number, string][] }): string {
  const CX = 150, CY = 160, R = o.r ?? 105;
  let s = circle(CX, CY, R + 14, 1.6) + circle(CX, CY, R + 10, 0.6);
  const ang = (t: number) => (o.from + (o.to - o.from) * t - 90) * DEG;
  for (let i = 0; i <= o.ticks; i++) {
    const a = ang(i / o.ticks);
    const major = i % o.major === 0;
    s += line(CX + Math.cos(a) * R, CY + Math.sin(a) * R, CX + Math.cos(a) * (R - (major ? 12 : 6)), CY + Math.sin(a) * (R - (major ? 12 : 6)), major ? 1.6 : 0.7);
    if (major) {
      const lab = o.labels(i);
      if (lab) s += text(CX + Math.cos(a) * (R - 24), CY + Math.sin(a) * (R - 24) + 4, lab, 11, { bold: true });
    }
  }
  for (const [t, w] of o.words ?? []) {
    const a = ang(t);
    s += `<text x="${f1(CX + Math.cos(a) * (R - 42))}" y="${f1(CY + Math.sin(a) * (R - 42))}" fill="${INK}" font-size="6.5" font-family="DejaVu Sans Mono, monospace" text-anchor="middle" letter-spacing="1" transform="rotate(${f1((a / DEG) + 90)} ${f1(CX + Math.cos(a) * (R - 42))} ${f1(CY + Math.sin(a) * (R - 42))})">${w}</text>`;
  }
  const a = ang(o.needle);
  s += line(CX - Math.cos(a) * 16, CY - Math.sin(a) * 16, CX + Math.cos(a) * (R - 8), CY + Math.sin(a) * (R - 8), 2.2) + circle(CX, CY, 5, 1.4) + dot(CX, CY, 2);
  return s + (o.inner ?? "");
}

function dials(): Set7Design[] {
  const list: [string, string, string, string, string][] = [
    ["Altimeter", "altimeter", "Hundreds of feet, 0 to 9",
      dial({ from: 0, to: 360, ticks: 50, major: 5, labels: (i) => (i < 50 ? String(i / 5) : ""), needle: 0.37 }) + text(150, 196, "ALT", 8, { bold: true, spacing: 2 }) + text(150, 207, "100 FEET", 5.5),
      "An aircraft altimeter face: 0 to 9 around the dial in hundreds of feet, fifty divisions of twenty feet."],
    ["Aneroid Barometer", "barometer", "28 to 31 inches of mercury",
      dial({ from: -135, to: 135, ticks: 30, major: 5, labels: (i) => ["28", "", "29", "", "30", "", "31"][i / 5] ?? "", needle: 0.62, words: [[0.08, "STORMY"], [0.3, "RAIN"], [0.5, "CHANGE"], [0.7, "FAIR"], [0.92, "VERY DRY"]] }),
      "An aneroid barometer's face from 28 to 31 inches of mercury, with the traditional words from Stormy to Very Dry."],
    ["VU Meter", "vu", "Volume units, −20 to +3",
      (() => {
        const marks: [number, string][] = [[-20, "20"], [-10, "10"], [-7, "7"], [-5, "5"], [-3, "3"], [-2, "2"], [-1, "1"], [0, "0"], [1, "1"], [2, "2"], [3, "3"]];
        const CX = 150, CY = 230, R = 150;
        // Position on the scale follows the voltage: 10^(dB/20), 0 VU at 71% of the arc.
        const pos = (db: number) => (10 ** (db / 20) / 10 ** (3 / 20));
        let s = "";
        const arc = (r: number) => path(polyline(Array.from({ length: 61 }, (_, k) => { const a = (-140 + (100 * k) / 60) * DEG; return [CX + Math.cos(a) * r, CY + Math.sin(a) * r] as [number, number]; })), 1);
        s += arc(R) + arc(R - 4);
        for (const [db, lab] of marks) {
          const a = (-140 + 100 * pos(db)) * DEG;
          s += line(CX + Math.cos(a) * R, CY + Math.sin(a) * R, CX + Math.cos(a) * (R + 10), CY + Math.sin(a) * (R + 10), 1.4) + text(CX + Math.cos(a) * (R + 20), CY + Math.sin(a) * (R + 20) + 3, lab, 8, { bold: db >= 0 });
        }
        for (let k = 0; k <= 12; k++) {
          const a = (-140 + 100 * (pos(0) + ((1 - pos(0)) * k) / 12)) * DEG;
          s += line(CX + Math.cos(a) * (R - 4), CY + Math.sin(a) * (R - 4), CX + Math.cos(a) * (R - 12), CY + Math.sin(a) * (R - 12), 0.8);
        }
        const a = (-140 + 100 * pos(-3)) * DEG;
        s += line(CX, CY, CX + Math.cos(a) * (R + 4), CY + Math.sin(a) * (R + 4), 1.6) + text(150, 190, "VU", 16, { bold: true }) + text(70, 70, "−", 12) + text(234, 70, "+", 12) + rect(30, 30, 240, 230, 1.4);
        return s;
      })(),
      "A VU meter's scale from −20 to +3 volume units, marked where a needle driven by the voltage points (0 VU at 71% of the swing), with the red zone ticked past zero."],
    ["Tachometer", "tachometer", "Revolutions per minute × 1000",
      dial({ from: -135, to: 135, ticks: 40, major: 5, labels: (i) => String(i / 5), needle: 0.35, inner: text(150, 205, "RPM × 1000", 6.5, { spacing: 1 }) }) +
        (() => { let s = ""; for (let k = 0; k <= 12; k++) { const a = (-135 + 270 * (0.8125 + (0.1875 * k) / 12) - 90) * DEG; s += line(150 + Math.cos(a) * 108, 160 + Math.sin(a) * 108, 150 + Math.cos(a) * 113, 160 + Math.sin(a) * 113, 1.2); } return s; })(),
      "A rev counter from 0 to 8,000 rpm, the red line from 6,500 marked by hatching on the rim."],
    ["Clock Face", "clock", "Twelve hours, sixty minutes",
      dial({ from: 0, to: 360, ticks: 60, major: 5, labels: (i) => ["XII", "I", "II", "III", "IIII", "V", "VI", "VII", "VIII", "IX", "X", "XI", ""][i / 5], needle: 10 / 60 }) +
        (() => { const a = ((10 + 10 / 60) / 12) * 360 * DEG - Math.PI / 2 + 0; return line(150, 160, 150 + Math.cos((300 + 5) * DEG - Math.PI / 2 + Math.PI / 2 - Math.PI / 2) * 60, 160 + Math.sin((305 - 90) * DEG) * 60, 3) + (a ? "" : ""); })(),
      "A clock dial with sixty minute marks and Roman hours, four written IIII as clockmakers do, the hands at ten past ten."],
    ["Voltmeter", "voltmeter", "0 to 15 volts DC",
      (() => {
        let s = rect(30, 70, 240, 170, 1.4);
        const CX = 150, CY = 250, R = 150;
        for (let i = 0; i <= 75; i++) {
          const a = (-130 + (80 * i) / 75) * DEG;
          const major = i % 25 === 0, mid = i % 5 === 0;
          s += line(CX + Math.cos(a) * R, CY + Math.sin(a) * R, CX + Math.cos(a) * (R - (major ? 14 : mid ? 9 : 5)), CY + Math.sin(a) * (R - (major ? 14 : mid ? 9 : 5)), major ? 1.4 : 0.6);
          if (mid) s += text(CX + Math.cos(a) * (R - 22), CY + Math.sin(a) * (R - 22) + 3, String(i / 5), 7, { bold: major });
        }
        // The mirror strip under the needle (to read it without parallax).
        s += path(polyline(Array.from({ length: 41 }, (_, k) => { const a = (-130 + 2 * k) * DEG; return [CX + Math.cos(a) * (R + 6), CY + Math.sin(a) * (R + 6)] as [number, number]; })), 0.8);
        const a = (-130 + 80 * (9.3 / 15)) * DEG;
        s += line(CX, CY - 10, CX + Math.cos(a) * (R + 8), CY + Math.sin(a) * (R + 8), 1.4) + text(150, 225, "V", 18, { bold: true }) + text(150, 236, "DC", 6);
        return s;
      })(),
      "A moving-coil voltmeter's scale, 0 to 15 volts in fifths of a volt, with the mirror strip for reading the needle square on."],
  ];
  return list.map(([title, key, sub, body, how]) => ({
    body: body + caption(318, title, sub),
    variant: "dial",
    category: "systems" as const,
    title: `${title} Dial`,
    subject: `${title} Dial`,
    description: `${how} Drawn as line work.`,
    features: { ...FEAT, retro: 0.6 },
    sigKey: `dial-${key}`,
  }));
}

/* ------------------------------------------------------------------ */
/* Slide rule, Smith chart, solids, spiral                              */
/* ------------------------------------------------------------------ */

function slideRule(): Set7Design {
  // Four scales side by side, 1 at the top: A (squares), C, D, CI (reciprocals); position = log10.
  const Y0 = 36, LEN = 256;
  const cols: [string, number, (x: number) => number, number[]][] = [
    ["A", 60, (x) => Math.log10(x) / 2, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]],
    ["C", 120, (x) => Math.log10(x), [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10]],
    ["D", 180, (x) => Math.log10(x), [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10]],
    ["CI", 240, (x) => 1 - Math.log10(x), [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10]],
  ];
  let s = "";
  for (const [name, x, pos, labels] of cols) {
    s += line(x, Y0, x, Y0 + LEN, 1.2) + text(x, Y0 - 8, name, 8, { bold: true });
    const top = name === "A" ? 100 : 10;
    // Ticks in whole hundredths, so labels stay exact.
    for (let h = 100; h <= top * 100; h += h < (name === "A" ? 1000 : 200) ? (name === "A" ? 50 : 5) : name === "A" ? 500 : 10) {
      const v = h / 100;
      const t = pos(v);
      const y = Y0 + t * LEN;
      const major = labels.some((l) => Math.abs(l - v) < 1e-6);
      s += line(x, y, x - (major ? 9 : 4), y, major ? 1 : 0.5);
      if (major) s += text(x + 4, y + 2.2, String(v), 5.5, { anchor: "start" });
    }
  }
  return {
    body: s + caption(322, "Slide Rule", "Scales A, C, D and CI: distance is the logarithm", "Multiply by adding lengths"),
    variant: "slide-rule",
    category: "systems",
    title: "Slide Rule Scales",
    subject: "Slide Rule Logarithmic Scales",
    description: "The A, C, D and CI scales of a slide rule set side by side: each mark placed at the logarithm of its number, so sliding one scale along another multiplies.",
    features: { ...FEAT, typography: 0.35, retro: 0.6 },
    sigKey: "slide-rule",
  };
}

function smithChart(): Set7Design {
  const CX = 150, CY = 165, R = 115;
  let s = `<defs><clipPath id="smith"><circle cx="${CX}" cy="${CY}" r="${R}"/></clipPath></defs>` + circle(CX, CY, R, 1.4) + line(CX - R, CY, CX + R, CY, 0.9);
  let g = "";
  for (const r of [0.2, 0.5, 1, 2, 5]) g += circle(CX + (R * r) / (1 + r), CY, R / (1 + r), 0.8);
  for (const x of [0.2, 0.5, 1, 2, 5]) for (const sgn of [-1, 1]) g += circle(CX + R, CY - (sgn * R) / x, R / x, 0.8);
  s += `<g clip-path="url(#smith)">${g}</g>`;
  for (const r of [0, 0.2, 0.5, 1, 2, 5]) s += text(CX - R + (2 * R * r) / (1 + r) + 4, CY - 3, String(r), 5, { anchor: "start" });
  return {
    body: s + caption(318, "Smith Chart", "Impedance on the reflection plane", "Circles of constant resistance and reactance"),
    variant: "smith-chart",
    category: "systems",
    title: "Smith Chart",
    subject: "Smith Chart for Impedance",
    description: "The Smith chart radio engineers use to match impedances: circles of constant resistance and arcs of constant reactance, drawn from their equations inside the unit circle.",
    features: { ...FEAT, abstract: 0.55 },
    sigKey: "smith",
  };
}

function solids(): Set7Design {
  const phi = (1 + Math.sqrt(5)) / 2;
  const shapes: [string, number[][]][] = [
    ["TETRAHEDRON", [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]]],
    ["CUBE", [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => [x, y, z])))],
    ["OCTAHEDRON", [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map((v) => v.map((c) => c * 1.4))],
    ["DODECAHEDRON", [...[-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => [x, y, z]))), ...[-1, 1].flatMap((a) => [-1, 1].flatMap((b) => [[0, a / phi, b * phi], [a / phi, b * phi, 0], [a * phi, 0, b / phi]]))]],
    ["ICOSAHEDRON", [-1, 1].flatMap((a) => [-1, 1].flatMap((b) => [[0, a, b * phi], [a, b * phi, 0], [b * phi, 0, a]]))],
  ];
  const rot = (v: number[]) => {
    const [ax, ay] = [0.55, 0.62];
    let [x, y, z] = v;
    [y, z] = [y * Math.cos(ax) - z * Math.sin(ax), y * Math.sin(ax) + z * Math.cos(ax)];
    [x, z] = [x * Math.cos(ay) + z * Math.sin(ay), -x * Math.sin(ay) + z * Math.cos(ay)];
    return [x, y, z];
  };
  let s = "";
  const pos = [[80, 80], [220, 80], [150, 165], [80, 250], [220, 250]];
  shapes.forEach(([name, verts], i) => {
    // Edges: vertex pairs at the shortest distance.
    let min = Infinity;
    for (let a = 0; a < verts.length; a++) for (let b = a + 1; b < verts.length; b++) min = Math.min(min, Math.hypot(...verts[a].map((c, k) => c - verts[b][k])));
    const scale = 26 / Math.max(...verts.map((v) => Math.hypot(...v)));
    const P = verts.map(rot).map(([x, y]) => [pos[i][0] + x * scale, pos[i][1] + y * scale]);
    for (let a = 0; a < verts.length; a++)
      for (let b = a + 1; b < verts.length; b++)
        if (Math.abs(Math.hypot(...verts[a].map((c, k) => c - verts[b][k])) - min) < 1e-6) s += line(P[a][0], P[a][1], P[b][0], P[b][1], 1.1);
    s += text(pos[i][0], pos[i][1] + 42, name, 5.5, { bold: true, spacing: 1 });
  });
  return {
    body: s + caption(330, "Platonic Solids", "The only five regular convex polyhedra"),
    variant: "platonic",
    category: "systems",
    title: "The Five Platonic Solids",
    subject: "Platonic Solids Wireframes",
    description: "Tetrahedron, cube, octahedron, dodecahedron and icosahedron as wireframes, built from their vertex coordinates: the only convex solids with identical regular faces.",
    features: { ...FEAT, abstract: 0.5 },
    sigKey: "platonic",
  };
}

function goldenSpiral(): Set7Design {
  // Fibonacci squares 1, 1, 2, … 34 wound clockwise (right, down, left, up), a quarter arc in each.
  const fib = [1, 1, 2, 3, 5, 8, 13, 21, 34];
  const sq: { x: number; y: number; n: number; a: [number, number]; b: [number, number] }[] = [{ x: 0, y: 0, n: 1, a: [0, 1], b: [1, 0] }];
  let [minX, minY, maxX, maxY] = [0, 0, 1, 1];
  for (let i = 1; i < fib.length; i++) {
    const n = fib[i];
    const dir = (i - 1) % 4;
    let x: number, y: number, a: [number, number], b: [number, number];
    if (dir === 0) (x = maxX), (y = minY), (a = [x, y]), (b = [x + n, y + n]);
    else if (dir === 1) (x = maxX - n), (y = maxY), (a = [x + n, y]), (b = [x, y + n]);
    else if (dir === 2) (x = minX - n), (y = maxY - n), (a = [x + n, y + n]), (b = [x, y]);
    else (x = minX), (y = minY - n), (a = [x, y + n]), (b = [x + n, y]);
    sq.push({ x, y, n, a, b });
    [minX, minY, maxX, maxY] = [Math.min(minX, x), Math.min(minY, y), Math.max(maxX, x + n), Math.max(maxY, y + n)];
  }
  const u = Math.min(250 / (maxX - minX), 250 / (maxY - minY));
  const ox = 150 - ((minX + maxX) / 2) * u, oy = 165 - ((minY + maxY) / 2) * u;
  const X = (v: number) => ox + v * u, Y = (v: number) => oy + v * u;
  let s = "", d = "";
  for (const { x, y, n, a, b } of sq) {
    s += rect(X(x), Y(y), n * u, n * u, 0.7);
    d += `${d ? "" : `M${f1(X(a[0]))} ${f1(Y(a[1]))}`}A${f1(n * u)} ${f1(n * u)} 0 0 1 ${f1(X(b[0]))} ${f1(Y(b[1]))}`;
    if (n >= 5) s += text(X(x + n / 2), Y(y + n / 2) + 3, String(n), Math.min(12, 4 + n * 0.3));
  }
  s += path(d, 1.6);
  return {
    body: s + caption(318, "Golden Spiral", "Fibonacci squares 1 to 34, a quarter turn in each"),
    variant: "golden-spiral",
    category: "systems",
    title: "Golden Spiral in Fibonacci Squares",
    subject: "Fibonacci Spiral",
    description: "Squares with sides 1, 1, 2, 3, 5, 8, 13, 21 and 34 wound into a rectangle close to the golden ratio, a quarter circle drawn in each.",
    features: { ...FEAT, classic: 0.4 },
    sigKey: "golden-spiral",
  };
}

export function systemsSet(): Set7Design[] {
  return [...circuits(), gates(), ...dials(), slideRule(), smithChart(), solids(), goldenSpiral()];
}
