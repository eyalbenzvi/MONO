import { describe, expect, it } from "vitest";
import { OFFER_MS, isUploadDesign, offerState, parseOfferForce, shopId, type Offer } from "@/lib/upload/openCall";

const offer = (o: Partial<Offer> = {}): Offer => ({ uploadId: "u1", id: "mono-u-1", title: "Heron", category: "pattern", credit: "Noa L.", submittedAt: 0, quality: 80, distance: 30, ...o });

describe("the Open Call's accept rule", () => {
  it("offered for 30 s, then accepted at quality ≥ 72 with nothing within Hamming 12", () => {
    expect(offerState(offer(), OFFER_MS - 1)).toBe("offered");
    expect(offerState(offer(), OFFER_MS)).toBe("accepted");
    expect(offerState(offer({ quality: 72, distance: 13 }), OFFER_MS)).toBe("accepted");
    expect(offerState(offer({ quality: 71 }), OFFER_MS)).toBe("declined");
    expect(offerState(offer({ distance: 12 }), OFFER_MS)).toBe("declined");
  });
  it("forcing wins over the rule; withdrawing wins over everything", () => {
    expect(offerState(offer({ quality: 10, force: "accepted" }), OFFER_MS)).toBe("accepted");
    expect(offerState(offer({ force: "declined" }), OFFER_MS)).toBe("declined");
    expect(offerState(offer({ withdrawn: true }), 5 * OFFER_MS)).toBe("withdrawn");
    expect(parseOfferForce("accept")).toBe("accepted");
    expect(parseOfferForce("refuse:logo")).toBeUndefined();
  });
  it("names accepted designs mono-u-<base36>", () => {
    expect(shopId(1700000000000)).toBe(`mono-u-${(1700000000000).toString(36)}`);
    expect(isUploadDesign(shopId(123))).toBe(true);
    expect(isUploadDesign("mono-123")).toBe(false);
  });
});
