import { describe, expect, it } from "vitest";
import { REVIEW_MS, localReview, nextChange, parseForce, stateAt, type ReviewTicket } from "@/lib/upload/review";

const at = (over: Partial<ReviewTicket> = {}) => ({ submittedAt: 1000, near: false, ...over });

describe("the simulated review", () => {
  it("queued for 20 s, then cleared", () => {
    expect(stateAt(at(), 1000)).toBe("queued");
    expect(stateAt(at(), 1000 + REVIEW_MS - 1)).toBe("queued");
    expect(stateAt(at(), 1000 + REVIEW_MS)).toBe("cleared");
    expect(nextChange(at(), 1000 + 5000)).toBe(REVIEW_MS - 5000);
    expect(nextChange(at(), 1000 + REVIEW_MS)).toBeNull();
  });
  it("a file near a threshold passes through a person for another 20 s", () => {
    expect(stateAt(at({ near: true }), 1000 + REVIEW_MS)).toBe("person");
    expect(stateAt(at({ near: true }), 1000 + 2 * REVIEW_MS - 1)).toBe("person");
    expect(stateAt(at({ near: true }), 1000 + 2 * REVIEW_MS)).toBe("cleared");
    expect(nextChange(at({ near: true }), 1000 + REVIEW_MS)).toBe(REVIEW_MS);
  });
  it("forced states: a refusal lands when the queue ends; person is forced", () => {
    const refuse = at({ force: { state: "refused", reason: "logo" } });
    expect(stateAt(refuse, 1000 + REVIEW_MS - 1)).toBe("queued");
    expect(stateAt(refuse, 1000 + REVIEW_MS)).toBe("refused");
    expect(nextChange(refuse, 1000 + REVIEW_MS)).toBeNull();
    expect(stateAt(at({ force: { state: "person" } }), 1000 + REVIEW_MS + 1)).toBe("person");
  });
  it("parses ?review= and ignores anything else", () => {
    expect(parseForce("refuse:hate")).toEqual({ state: "refused", reason: "hate" });
    expect(parseForce("person")).toEqual({ state: "person" });
    for (const v of ["refuse:", "refuse:virus", "cleared", "", null, undefined, "refuse:logo "]) expect(parseForce(v)).toBeUndefined();
  });
  it("the local implementation keeps tickets with the caller and reads states from the clock", () => {
    const map = new Map<string, ReviewTicket>();
    let now = 5000;
    const r = localReview({ get: (id) => map.get(id), put: (t) => map.set(t.id, t) }, () => now);
    const t = r.submit({ order: "MONO-1", uploadId: "u1", near: false });
    expect(map.get(t.id)).toEqual(t);
    expect(r.status(t.id)).toBe("queued");
    now += REVIEW_MS;
    expect(r.status(t.id)).toBe("cleared");
    expect(r.status("nope")).toBe("refused");
  });
});
