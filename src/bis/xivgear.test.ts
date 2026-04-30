import { describe, expect, test } from "bun:test";
import { normalizeXivgearUrl } from "./xivgear.ts";

describe("normalizeXivgearUrl", () => {
  test("converts hash form to page form", () => {
    expect(normalizeXivgearUrl("https://xivgear.app/#/bis/war/prog"))
      .toBe("https://xivgear.app/?page=bis|war|prog");
  });

  test("converts multi-segment hash path", () => {
    expect(normalizeXivgearUrl("https://xivgear.app/#/bis/war/current"))
      .toBe("https://xivgear.app/?page=bis|war|current");
  });

  test("is idempotent on already-normalized URLs", () => {
    const url = "https://xivgear.app/?page=bis|war|current";
    expect(normalizeXivgearUrl(url)).toBe(url);
  });

  test("is idempotent on normalized URLs with selectedIndex", () => {
    const url = "https://xivgear.app/?page=bis|war|current&selectedIndex=1";
    expect(normalizeXivgearUrl(url)).toBe(url);
  });
});
