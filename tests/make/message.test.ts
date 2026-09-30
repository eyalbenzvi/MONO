import { productSuite } from "./productSuite";
import { MESSAGES_MAX, MESSAGES_MIN, MESSAGE_MAX, WITH_MAX } from "@/lib/custom/specs/message";
import { mulberry32 } from "../../scripts/gen/core";

const W = (n: number) => "W".repeat(n);
const rnd = mulberry32(0x3e55);
const pool = ["Hi.", "Was that you with the umbrella?", "It was. Sorry about your shoes.", "They were old shoes.", "Coffee, to make up for them?", "Go on then.", "Yes", "Who is this?", "The one who borrowed your pen, still has it.", "x", "Ha", "Eight at the corner by the bakery, then."];
const fuzz: Record<string, unknown>[] = [
  { m: [[0, "Hi", "21:00"], [1, "Hi", "21:01"]] },
  { m: [[0, "Hi", "21:00"], [0, "Yo", "21:01"]] },
  { n: W(WITH_MAX), d: "2100-12-31", m: Array.from({ length: MESSAGES_MAX }, (_, i) => [i % 2, "Wwwww ".repeat(8).trim(), "23:59"]) },
];
for (let i = 0; i < 36; i++) {
  const n = MESSAGES_MIN + Math.floor(rnd() * (MESSAGES_MAX - MESSAGES_MIN + 1));
  fuzz.push({ ...(i % 2 ? { n: ["Dan", "Noa", W(WITH_MAX)][i % 3] } : {}), ...(i % 3 ? { d: "2016-08-14" } : {}), m: Array.from({ length: n }, (_, j) => [rnd() < 0.5 ? 0 : 1, pool[Math.floor(rnd() * pool.length)], `2${j % 4}:0${j}`]) });
}

productSuite({
  slug: "message",
  refuse: [{}, { m: [[0, "Hi", "21:00"]] }, { m: Array.from({ length: MESSAGES_MAX + 1 }, () => [0, "Hi", "21:00"]) }, { m: [[2, "Hi", "21:00"], [0, "Hi", "21:00"]] }, { m: [[0, "Hi", "25:00"], [0, "Hi", "21:00"]] }, { m: [[0, "", "21:00"], [0, "Hi", "21:00"]] }, { m: [[0, W(MESSAGE_MAX + 1), "21:00"], [0, "Hi", "21:00"]] }, { m: [[0, "Hi"], [0, "Hi", "21:00"]] }, { m: [[0, "Hi", "21:00"], [1, "Hi", "21:01"]], n: "" }, { m: [[0, "Hi", "21:00"], [1, "Hi", "21:01"]], d: "2016-02-30" }],
  // The messages themselves are the link: four of forty-eight characters in two-byte letters (663) are the most the thread holds at full length;
  // even six full ones (which the thread refuses) would stay under 1,000.
  linkMax: 1000,
  longest: { n: "Ã".repeat(WITH_MAX), d: "2016-08-14", m: Array.from({ length: 4 }, (_, i) => [i % 2, "Ããããã ".repeat(8).trim(), "21:04"]) },
  fuzz,
  // Six long messages can outgrow the thread: refused (the editor says it's too long).
  mayRefuse: (p) => (p.m as unknown[]).length >= 5,
});
