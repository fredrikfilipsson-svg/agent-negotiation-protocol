import { expect, test } from "@playwright/test";

test("the example log verifies green and a tampered copy fails", async ({
  page,
}) => {
  await page.goto("/verify");

  await page.getByRole("button", { name: "Load the example log" }).click();
  await expect(
    page.getByText("4 of 4 events verify. The chain holds."),
  ).toBeVisible();
  const result = page.getByRole("region", { name: "Verification result" });
  await expect(result.locator("ol > li")).toHaveCount(4);

  // Tamper one payload byte and re-verify.
  const textarea = page.getByLabel(/session log JSON/);
  const log = JSON.parse(await textarea.inputValue());
  log.events[2].payload.line_items[0].unit_price = 9;
  await textarea.fill(JSON.stringify(log));
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(
    page.getByText("3 of 4 events verify. This log does not hold."),
  ).toBeVisible();
  await expect(page.getByText("disputed session")).toBeVisible();

  // Garbage input gets a readable error, not a crash.
  await textarea.fill("{not json");
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  // Next's route announcer is also role=alert, so filter to ours.
  await expect(
    page.getByRole("alert").filter({ hasText: "not valid JSON" }),
  ).toBeVisible();
});
