import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("index.html assets", () => {
  it("declares a favicon and includes the static file", () => {
    const projectRoot = path.resolve(__dirname, "..");
    const indexHtml = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
    const faviconPath = path.join(projectRoot, "public", "favicon.svg");

    expect(indexHtml).toContain('rel="icon"');
    expect(indexHtml).toContain('href="/favicon.svg"');
    expect(fs.existsSync(faviconPath)).toBe(true);
  });
});
