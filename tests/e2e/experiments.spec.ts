import { expect, test } from "@playwright/test";

test("prompt experiments refine, compare, persist, export and delete", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/experiments", async (route) => {
    calls += 1;
    const body = route.request().postDataJSON();
    if (calls === 2) {
      expect(body.action).toBe("refine");
      expect(body.previousResponse).toBe("First response, reviewed by me.");
      expect(body.instruction).toBe("Make it shorter and clearer.");
    }
    await route.fulfill({
      json: {
        output: {
          response:
            calls === 1
              ? "People should review important AI decisions."
              : "People review AI decisions.",
        },
      },
    });
  });
  await page.goto("/checkpoint");
  const lab = page.getByRole("region", {
    name: "Test an idea. Improve the response.",
  });
  await lab.getByLabel(/Experiment title/).fill("AI explainer");
  await lab
    .getByLabel("Prompt to test")
    .fill("Explain responsible AI to a student in two sentences.");
  await lab.getByRole("button", { name: "Test prompt", exact: true }).click();
  await expect(lab.getByLabel("Experiment response")).toHaveValue(
    "People should review important AI decisions.",
  );
  await lab
    .getByLabel("Experiment response")
    .fill("First response, reviewed by me.");
  await lab
    .getByLabel("How should this response improve?")
    .fill("Make it shorter and clearer.");
  await lab.getByRole("button", { name: "Refine response" }).click();
  await expect(lab.getByLabel("Experiment response")).toHaveValue(
    "People review AI decisions.",
  );
  await expect(
    lab.getByText("First response, reviewed by me.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Smart Email", exact: true }).click();
  await page.getByRole("link", { name: "AI Checkpoint", exact: true }).click();
  await expect(lab.getByLabel("Experiment response")).toHaveValue(
    "People review AI decisions.",
  );
  await lab
    .getByRole("button", { name: "Save experiment", exact: true })
    .click();
  await expect(
    lab.getByRole("button", { name: /AI explainer.*2 versions/ }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await lab.getByRole("button", { name: "Export Markdown" }).click();
  expect((await download).suggestedFilename()).toBe("prompt-experiment.md");
  await page.reload();
  await lab.getByRole("button", { name: /AI explainer.*2 versions/ }).click();
  await expect(lab.getByLabel("Experiment response")).toHaveValue(
    "People review AI decisions.",
  );
  await lab.getByLabel("Active version").selectOption({ label: "Version 1" });
  await expect(lab.getByLabel("Experiment response")).toHaveValue(
    "First response, reviewed by me.",
  );
  await lab
    .getByRole("button", { name: "Delete experiment AI explainer" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(
    lab.getByRole("button", { name: /AI explainer.*2 versions/ }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    lab.getByRole("button", { name: /AI explainer.*2 versions/ }),
  ).toHaveCount(0);
  expect(calls).toBe(2);
});

test("failed experiment refinement retains the editable response", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/experiments", async (route) => {
    calls += 1;
    await route.fulfill(
      calls === 1
        ? { json: { output: { response: "My first useful response." } } }
        : { status: 429, json: { error: "Please wait before trying again." } },
    );
  });
  await page.goto("/checkpoint");
  const lab = page.getByRole("region", {
    name: "Test an idea. Improve the response.",
  });
  await lab
    .getByLabel("Prompt to test")
    .fill("Write a useful project brief with next steps.");
  await lab.getByRole("button", { name: "Test prompt", exact: true }).click();
  await expect(lab.getByLabel("Experiment response")).toHaveValue(
    "My first useful response.",
  );
  await lab
    .getByLabel("How should this response improve?")
    .fill("Use plain language.");
  await lab.getByRole("button", { name: "Refine response" }).click();
  await expect(lab.getByRole("alert")).toHaveText(
    "Please wait before trying again.",
  );
  await expect(lab.getByLabel("Experiment response")).toHaveValue(
    "My first useful response.",
  );
  await expect(lab.getByLabel("Prompt to test")).toHaveValue(
    "Write a useful project brief with next steps.",
  );
});
