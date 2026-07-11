import { expect, test } from "@playwright/test";

const MOCK_HOST = "http://localhost:8787";

test("full negotiation: 12 events verify, celebration, tamper teaching", async ({
  page,
}) => {
  await page.goto("/playground");
  await page.getByLabel("buyer host base URL").fill(MOCK_HOST);

  // Step 1: identity.
  await page.getByRole("button", { name: "Generate keypair" }).click();
  await expect(page.getByText("fingerprint (sha-256)")).toBeVisible();

  // Step 2: register.
  await page.getByRole("button", { name: "Sign proof and register" }).click();
  await expect(page.getByText("agent id", { exact: true })).toBeVisible();
  await expect(page.getByText("sandbox", { exact: true })).toBeVisible();

  // Step 3: open a session.
  await expect(
    page.getByText("valid against envelope.schema.json"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open sandbox session" }).click();
  const chain = page.getByRole("region", { name: "Session chain" });
  await expect(chain.getByText("2 of 2 events verify")).toBeVisible();

  // Step 4: five vendor events, each answered by the sandbox buyer.
  const sendOffer = async () => {
    await page.getByRole("tab", { name: "Structured offer" }).click();
    await page.getByRole("button", { name: "Sign and send offer" }).click();
  };
  const sendMessage = async () => {
    await page.getByRole("tab", { name: "Free text message" }).click();
    await page.getByRole("button", { name: "Sign and send message" }).click();
  };

  await sendOffer();
  await expect(chain.getByText("4 of 4 events verify")).toBeVisible();
  await sendMessage();
  await expect(chain.getByText("6 of 6 events verify")).toBeVisible();
  await sendOffer();
  await expect(chain.getByText("8 of 8 events verify")).toBeVisible();
  await sendMessage();
  await expect(chain.getByText("10 of 10 events verify")).toBeVisible();
  await sendOffer();
  await expect(chain.getByText("12 of 12 events verify")).toBeVisible();

  // The buyer countered every offer.
  await expect(chain.getByText("counter_offer")).toHaveCount(3);

  // Verify entire chain: the quiet celebration at 12 of 12.
  await page.getByRole("button", { name: "Verify entire chain" }).click();
  await expect(chain.getByText("The chain holds.")).toBeVisible();

  // Tamper: exactly one event fails, on payload_hash, and the signature
  // over the declared hash still verifies.
  await page.getByRole("button", { name: "Tamper", exact: true }).click();
  await expect(chain.getByText("11 of 12 events verify")).toBeVisible();
  const failing = chain.locator("li", { hasText: "tampered locally" });
  await expect(failing).toHaveCount(1);
  await expect(failing.getByText("payload_hash").first()).toBeVisible();
  await expect(failing.getByText("fails")).toBeVisible();

  await page.getByRole("button", { name: "Undo tamper" }).click();
  await expect(chain.getByText("12 of 12 events verify")).toBeVisible();
});

test("unreachable host surfaces the connectivity message", async ({
  page,
}) => {
  await page.goto("/playground");
  await page
    .getByLabel("buyer host base URL")
    .fill("http://localhost:59999");
  await page.getByRole("button", { name: "Generate keypair" }).click();
  await expect(page.getByText("fingerprint (sha-256)")).toBeVisible();
  await page.getByRole("button", { name: "Sign proof and register" }).click();
  // Next's route announcer is also role=alert, so filter to ours.
  await expect(
    page.getByRole("alert").filter({ hasText: "CORS policy" }),
  ).toBeVisible();
});
