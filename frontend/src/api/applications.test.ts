import { describe, expect, it } from "vitest";

import { applicationsPath } from "./applications";

describe("applicationsPath", () => {
  it("returns the bare list path when no filters are set", () => {
    expect(applicationsPath({})).toBe("/applications/");
    expect(applicationsPath({ status: "", source: "", search: "" })).toBe("/applications/");
  });

  it("adds only the filters that have values", () => {
    expect(applicationsPath({ status: "interview", source: "", search: "acme co" })).toBe(
      "/applications/?status=interview&search=acme+co",
    );
  });
});
