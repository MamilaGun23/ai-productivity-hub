import { expect, test } from "@playwright/test";

test("focus tasks persist edits, completion, follow-up and deletion", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Add task", exact: true });
  await editor
    .getByLabel("Title", { exact: true })
    .fill("Review the project brief");
  await editor
    .getByLabel("Description", { exact: true })
    .fill("Read the final project goals before sending feedback.");
  await editor.getByLabel("Priority").selectOption("High");
  await editor.getByRole("button", { name: "Save task" }).click();
  await expect(editor).toHaveCount(0);
  await page
    .getByRole("checkbox", { name: "Complete Review the project brief" })
    .check();
  await expect(
    page.getByRole("img", { name: "1 of 1 tasks completed, 100%" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: "Reopen Review the project brief" }),
  ).toBeChecked();
  await page
    .getByRole("button", { name: "Edit Review the project brief", exact: true })
    .click();
  const edit = page.getByRole("dialog", { name: "Edit task", exact: true });
  await edit
    .getByLabel("Title", { exact: true })
    .fill("Review the updated project brief");
  await edit.getByRole("button", { name: "Save task" }).click();
  await page
    .getByRole("checkbox", { name: "Reopen Review the updated project brief" })
    .uncheck();
  await expect(
    page.getByRole("img", { name: "0 of 1 tasks completed, 0%" }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Email about Review the updated project brief",
    })
    .click();
  await expect(page.getByLabel("Subject or topic")).toHaveValue(
    "Review the updated project brief",
  );
  await expect(page.getByLabel("What would you like to say?")).toHaveValue(
    /follow-up email.*Review the updated project brief/,
  );
  await page.goto("/");
  await page
    .getByRole("button", {
      name: "Delete Review the updated project brief",
      exact: true,
    })
    .click();
  await page
    .getByRole("dialog", { name: "Delete this task?" })
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: /project brief/ }),
  ).toHaveCount(0);
});

test("calendar events persist and update scheduled dates", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add calendar event" }).click();
  const editor = page.getByRole("dialog", { name: "Add event", exact: true });
  await editor.getByLabel("Title", { exact: true }).fill("Design review");
  await editor.getByLabel("Time (optional)").fill("14:30");
  await editor.getByRole("button", { name: "Save event" }).click();
  await expect(
    page.getByRole("button", { name: /Design review.*14:30/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /, 1 scheduled items$/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next month", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /, 1 scheduled items$/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Go to today", exact: true }).click();
  await page.getByRole("button", { name: /Design review.*14:30/ }).click();
  const edit = page.getByRole("dialog", { name: "Edit event", exact: true });
  await edit.getByLabel("Title", { exact: true }).fill("Final design review");
  await edit.getByRole("button", { name: "Save event" }).click();
  await page.reload();
  await page
    .getByRole("button", { name: /Final design review.*14:30/ })
    .click();
  await page
    .getByRole("dialog", { name: "Edit event", exact: true })
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Delete this event?", exact: true })
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: /Final design review/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /, 1 scheduled items$/ }),
  ).toHaveCount(0);
});
