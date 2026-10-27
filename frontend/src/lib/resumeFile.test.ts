import { describe, expect, it } from "vitest";

import { RESUME_MAX_BYTES, validateResumeFile } from "./resumeFile";

function file(name: string, size = 1000) {
  return new File([new Uint8Array(size)], name);
}

describe("validateResumeFile", () => {
  it("requires a file", () => {
    expect(validateResumeFile(null)).toBe("Choose a file to upload.");
  });

  it("accepts PDF, DOC, and DOCX regardless of extension case", () => {
    expect(validateResumeFile(file("resume.PDF"))).toBeNull();
    expect(validateResumeFile(file("resume.doc"))).toBeNull();
    expect(validateResumeFile(file("resume.docx"))).toBeNull();
  });

  it("rejects other file types", () => {
    expect(validateResumeFile(file("notes.txt"))).toBe("Upload a PDF, DOC, or DOCX file.");
    expect(validateResumeFile(file("no-extension"))).toBe("Upload a PDF, DOC, or DOCX file.");
  });

  it("allows exactly 5 MB but nothing larger", () => {
    expect(validateResumeFile(file("exact.pdf", RESUME_MAX_BYTES))).toBeNull();
    expect(validateResumeFile(file("big.pdf", RESUME_MAX_BYTES + 1))).toBe("File must be 5 MB or smaller.");
  });
});
