import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStorage } from "../memoryStorage";
import { FEATURE_KEYS } from "@/types/shirt";

const storage = new MemoryStorage();
vi.stubGlobal("localStorage", storage);
vi.stubGlobal("window", { localStorage: storage });

const features = Object.fromEntries(FEATURE_KEYS.map((k) => [k, 0.5]));
const offer = (o: Record<string, unknown> = {}) => ({ uploadId: "u1abc", id: "mono-u-k1", title: "Heron at Dusk", category: "pattern", credit: "Noa L.", submittedAt: 1000, quality: 80, distance: 30, features, colors: ["white", "black"], ...o });

async function fresh() {
  vi.resetModules();
  return { ...(await import("@/lib/catalog")), ...(await import("@/lib/upload/designs")), ...(await import("@/store/makeStore")) };
}
beforeEach(() => storage.clear());

describe("Open Call designs on this device", () => {
  it("an accepted offer resolves as mono-u-… with its credit; it is never in the catalogue list (so never dealt in Discover)", async () => {
    storage.setItem("mono-make", JSON.stringify({ state: { offers: { u1abc: offer() } }, version: 1 }));
    const { getShirtById, SHIRTS, creditLine } = await fresh();
    const p = getShirtById("mono-u-k1")!;
    expect(p).toMatchObject({ id: "mono-u-k1", title: "Heron at Dusk", category: "pattern", colors: ["white", "black"], baseColor: "white" });
    expect(SHIRTS.some((s) => s.id === "mono-u-k1")).toBe(false);
    expect(creditLine(offer())).toBe("By Noa L. · Open Call 01");
  });
  it("a declined, pending or withdrawn offer doesn't resolve", async () => {
    for (const o of [offer({ quality: 60 }), offer({ submittedAt: Date.now() }), offer({ withdrawn: true })]) {
      storage.setItem("mono-make", JSON.stringify({ state: { offers: { u1abc: o } }, version: 1 }));
      const { getShirtById } = await fresh();
      expect(getShirtById("mono-u-k1")).toBeUndefined();
    }
  });
  it("the mono-make store keeps well-formed entries only, and withdraws", async () => {
    const { sanitizeMake, useMakeStore } = await fresh();
    const s = sanitizeMake({ offers: { u1abc: offer(), bad: { uploadId: "other" } }, reviews: { r1: { id: "r1", uploadId: "u1", order: "MONO-1", submittedAt: 1, near: false, force: { state: "refused", reason: "virus" } } }, uploads: 5 });
    expect(Object.keys(s.offers)).toEqual(["u1abc"]);
    expect(s.reviews).toEqual({});
    useMakeStore.getState().putOffer(offer() as never);
    useMakeStore.getState().withdraw("u1abc");
    expect(useMakeStore.getState().offers.u1abc.withdrawn).toBe(true);
  });
});
