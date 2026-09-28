import { describe, expect, it } from "vitest";
import { DAY, expired, type UploadLife } from "@/lib/upload/retention";

const u = (o: Partial<UploadLife>): UploadLife => ({ id: "u", createdAt: 0, inBag: false, ordered: false, accepted: false, ...o });

describe("upload deletion rules", () => {
  it("a cleared raster goes 30 days after clearing, unless accepted", () => {
    expect(expired([u({ ordered: true, clearedAt: DAY })], 31 * DAY - 1)).toEqual([]);
    expect(expired([u({ ordered: true, clearedAt: DAY })], 31 * DAY)).toEqual(["u"]);
    expect(expired([u({ ordered: true, clearedAt: DAY, accepted: true })], 400 * DAY)).toEqual([]);
  });
  it("an abandoned upload goes after 7 days; one in the bag or under review stays", () => {
    expect(expired([u({})], 7 * DAY - 1)).toEqual([]);
    expect(expired([u({})], 7 * DAY)).toEqual(["u"]);
    expect(expired([u({ inBag: true })], 70 * DAY)).toEqual([]);
    expect(expired([u({ ordered: true })], 70 * DAY)).toEqual([]);
  });
});
