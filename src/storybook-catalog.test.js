import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("catálogo Storybook do Design System", () => {
  it("mantém as histórias dos componentes iniciais e os controles ARCD", () => {
    const storiesDirectory = resolve(process.cwd(), "src/design-system/stories");
    const storyFiles = readdirSync(storiesDirectory).sort();
    expect(storyFiles).toEqual([
      "Badge.stories.jsx",
      "Button.stories.jsx",
      "Card.stories.jsx",
      "DataTable.stories.jsx",
      "Dialog.stories.jsx",
      "Drawer.stories.jsx",
      "Input.stories.jsx",
      "MobileRecordCard.stories.jsx",
      "PageHeader.stories.jsx",
      "Select.stories.jsx",
      "TabRow.stories.jsx",
    ]);

    const preview = readFileSync(resolve(process.cwd(), ".storybook/preview.jsx"), "utf8");
    expect(preview).toContain("high-contrast");
    expect(preview).toContain("comfortable");
  });
});
