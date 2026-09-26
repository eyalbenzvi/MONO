// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { CALIBRATION_IDS, getShirtById, familyOf } from "@/lib/catalog";
import { MIN_LIKES, MIN_PASSES, tasteKnown, tasteProgress, useTasteStore } from "@/store/tasteStore";

const swipe = (action: "like" | "dislike") => {
  const top = useTasteStore.getState().deck[0];
  useTasteStore.getState().commitSwipe(top.id, action);
  return top;
};

beforeEach(() => {
  localStorage.clear();
  useTasteStore.getState().reset();
});

describe("W2: the taste is known only with enough likes and passes", () => {
  it("passing on all ten test cards isn't a taste: no result, and Discover keeps probing with new, unlike cards", () => {
    for (let i = 0; i < CALIBRATION_IDS.length; i++) swipe("dislike");
    const s = useTasteStore.getState();
    expect(tasteKnown(s)).toBe(false);
    expect(tasteProgress(s)).toMatchObject({ phase: "more", likesNeeded: MIN_LIKES, passesNeeded: 0 });
    const next = s.deck[0];
    expect(next).toBeDefined();
    expect(s.seen.map(familyOf)).not.toContain(familyOf(next.id));
  });

  it("then likes bring it: known exactly at the minimum", () => {
    for (let i = 0; i < CALIBRATION_IDS.length; i++) swipe("dislike");
    for (let i = 0; i < MIN_LIKES - 1; i++) swipe("like");
    expect(tasteKnown(useTasteStore.getState())).toBe(false);
    swipe("like");
    expect(tasteKnown(useTasteStore.getState())).toBe(true);
  });

  it("a mix inside the test is known after the ten cards; nine likes and one pass needs two more passes", () => {
    for (let i = 0; i < 10; i++) swipe(i < 5 ? "like" : "dislike");
    expect(tasteKnown(useTasteStore.getState())).toBe(true);
    useTasteStore.getState().reset();
    for (let i = 0; i < 10; i++) swipe(i < 9 ? "like" : "dislike");
    expect(tasteProgress(useTasteStore.getState())).toMatchObject({ phase: "more", passesNeeded: MIN_PASSES - 1 });
  });

  it("unsaving below the minimum takes the taste away; Undo gives it back", () => {
    for (let i = 0; i < 10; i++) swipe(i < 3 ? "like" : "dislike");
    const s = useTasteStore.getState();
    expect(tasteKnown(s)).toBe(true);
    const liked = s.likedIds[0];
    s.removeLiked(liked);
    expect(tasteProgress(useTasteStore.getState())).toMatchObject({ phase: "more", likesNeeded: 1 });
    useTasteStore.getState().restoreSaved(liked, 0);
    expect(tasteKnown(useTasteStore.getState())).toBe(true);
    expect(getShirtById(liked)).toBeDefined();
  });
});
