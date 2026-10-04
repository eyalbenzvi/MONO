/**
 * Product titles in the generated catalogue (data/shirts.json and the lean
 * index the shop reads): none cut short on a dangling word or a list
 * number, no record's "--", none starting lower-case, typographic
 * apostrophes. The rules live in scripts/gen/titles.ts (houseTitle,
 * trimDangling) and the hand-set titles in data/curation/titles.json.
 */
import { describe, expect, it } from "vitest";
import { houseTitle } from "../scripts/gen/titles";
import full from "@/data/shirts.json";
import index from "@/data/shirts.index.json";

/** Words a title can't end on: articles, conjunctions, prepositions (English and the records' French, Italian, German). */
const DANGLING_WORD =
  /(?:^|\s)(?:a|an|the|and|or|nor|but|of|in|on|for|to|with|at|by|from|between|into|onto|over|under|near|as|via|after|before|above|below|along|across|beyond|through|toward|towards|upon|among|amongst|than|de|du|des|la|le|les|à|et|di|del|della|degli|dei|e|ed|von|und|der|zu|etc|&)\.?$/i;
/**
 * A number left at the end ("… Female. 3"). Not a year ("Liquid-Fuel Rocket, 1926"), a ratio
 * ("Lissajous 1:2"), or a number that is part of a name: a plate, a take, a mission.
 */
const TRAILING_NUMBER = /(?<!\b(?:Plate|Plates|No\.|Fig\.|Figure|Take|Vol\.|Part|Book|Series|Model|Mark|Type|Apollo|Skylab|Gemini|Mercury))(?:^|\s)\d{1,3}\.?$/;
/** A record's numbered list: "1. Red-winged Starling. 2. Female." */
const LIST = /(?:^|\s)\d{1,3}\.\s+\S/;

/** Why a title breaks the house rules (empty when it doesn't). */
function titleProblems(title: string): string[] {
  const out: string[] = [];
  // Closing brackets and quotes don't end a phrase: "(Plate 5)" ends on "5", "(Harp of the Winds)" on "Winds".
  const end = title.replace(/[)\]’”]+$/, "");
  if (DANGLING_WORD.test(end)) out.push("ends on a dangling word");
  if (TRAILING_NUMBER.test(end)) out.push("ends on a list number");
  if (LIST.test(title)) out.push("is a numbered list");
  if (/[,;:–—-]$/.test(end)) out.push("ends on punctuation");
  if (title.includes("--")) out.push('has "--"');
  if (/ - /.test(title)) out.push('has " - "');
  if (!/^[\p{Lu}\d‘“]/u.test(title)) out.push("doesn't start with a capital");
  if (title.includes("'")) out.push("has a straight apostrophe");
  if (title !== title.trim() || /\s{2}/.test(title)) out.push("has stray spaces");
  return out;
}

const shirts = full as { id: string; title: string }[];
const indexTitles = (index as unknown as { title: string[] }).title;

describe("the rules catch what they are for", () => {
  it.each([
    "Design for a Catafalque for the",
    "Design for a Window for the",
    "The Carter Estate between 35th and",
    "Landscape with a Hay Barn and",
    "1. Red-winged Starling. 2. Female. 3",
    "Flowers: Chrysanthemums, Peonies, etc",
    "Veduta del Tempio di Antonio e",
    "The Voyage of Life--Youth",
    "Sidewall - sample",
    "e to 500 Places",
    ") (View of Mining Site)",
    "Grevy's Zebra",
    "Octopus verrucosus 2",
    "Hall-Scott A-7-A In-line 4",
  ])("refuses %j", (t) => {
    expect(titleProblems(t)).not.toEqual([]);
  });

  it.each([
    "The Voyage of Life: Youth",
    "Sidewall, Sample",
    "Euler’s e to 500 Places",
    "Liquid-Fuel Rocket, 1926",
    "Medusae Plate 03",
    "Lissajous 1:2",
    "The History of Esculent Fish (Plate 5)",
    "Carceri Series, Plate IX",
    "Old House on 29th St., East of 3rd Ave., N.Y.",
    "555 Astable Timer",
    "Command Module, Apollo 11",
    "Red-winged Starling, Black-poll Warbler and Lesser Redpoll",
  ])("accepts %j", (t) => {
    expect(titleProblems(t)).toEqual([]);
  });
});

describe("catalogue titles", () => {
  it("every design's title keeps the house rules", () => {
    const bad = shirts.map((s) => ({ id: s.id, title: s.title, problems: titleProblems(s.title) })).filter((s) => s.problems.length);
    expect(bad).toEqual([]);
  });

  it("the index the shop reads carries the same titles", () => {
    expect(indexTitles).toEqual(shirts.map((s) => s.title));
  });

  it("titles are unique", () => {
    expect(new Set(shirts.map((s) => s.title.toLowerCase())).size).toBe(shirts.length);
  });
});

describe("houseTitle: the last word", () => {
  it("keeps its capital, but an elided article keeps its own case", () => {
    expect(houseTitle("San Juan del Sur")).toBe("San Juan del Sur");
    expect(houseTitle("La Tour de l’Horloge")).toBe("La Tour de l’Horloge");
  });
});
