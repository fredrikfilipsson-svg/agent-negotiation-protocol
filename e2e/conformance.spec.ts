import { expect, test } from "@playwright/test";

const MOCK_HOST = "http://localhost:8787";

test("the buyer host harness passes 10 of 10 against the mock host", async ({
  page,
}) => {
  await page.goto("/conformance");
  await page.getByLabel("buyer host base URL").fill(MOCK_HOST);
  await page.getByRole("button", { name: "Run the harness" }).click();

  // The harness makes a dozen real signed requests; give it room.
  await expect(page.getByText("10 passed, 0 failed, 0 skipped.")).toBeVisible({
    timeout: 60_000,
  });
  await expect(
    page.getByText("Every observable requirement holds."),
  ).toBeVisible();
});
