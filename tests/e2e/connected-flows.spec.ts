import { test, expect } from "@playwright/test";
import { outputs } from "../fixtures";
test("command shortcut routes explicit requests and asks on ambiguity", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("AI command", { exact: true })
    .fill("Help me communicate better");
  await page.getByRole("button", { name: "Open matching AI tool" }).click();
  await expect(
    page.getByRole("region", { name: "Choose the intended tool" }),
  ).toBeVisible();
  await page
    .getByRole("region", { name: "Choose the intended tool" })
    .getByRole("button", { name: "Smart Email" })
    .click();
  await expect(page.getByLabel("What would you like to say?")).toHaveValue(
    "Help me communicate better",
  );
  await page.keyboard.press("Control+k");
  await expect(page.getByLabel("Global AI command")).toBeFocused();
  await page.getByLabel("Global AI command").fill("Research cloud computing");
  await page.getByLabel("Global AI command").press("Enter");
  await expect(page.getByLabel("Research question")).toHaveValue(
    "Research cloud computing",
  );
  await page.getByLabel("Global AI command").fill("Plan my project launch");
  await page.getByLabel("Global AI command").press("Enter");
  await expect(page.getByLabel("What do you want to achieve?")).toHaveValue(
    "Plan my project launch",
  );
  await page.getByLabel("Global AI command").fill("Plan my next week");
  await page.getByLabel("Global AI command").press("Enter");
  await expect(page.getByLabel("What do you want to achieve?")).toHaveValue(
    "Plan my next week",
  );
});
test("reviewed research findings prefill an editable email", async ({
  page,
}) => {
  await page.route("**/api/ai/research", (route) =>
    route.fulfill({ json: { output: outputs.research } }),
  );
  await page.goto("/research");
  await page
    .getByLabel("Research question")
    .fill("Responsible AI for students");
  await page
    .getByRole("button", { name: "Generate research", exact: true })
    .click();
  const transfer = page.getByRole("region", { name: "Research to email" });
  await transfer.getByText("Choose research findings", { exact: true }).click();
  await transfer.getByRole("checkbox").first().check();
  await transfer
    .getByLabel("Information to use in email")
    .fill("Only share these findings after checking the original source.");
  await transfer
    .getByRole("button", { name: "Draft email from selected findings" })
    .click();
  await expect(page.getByLabel("Subject or topic")).toHaveValue(
    "Responsible AI for students",
  );
  await expect(
    page.getByLabel("Additional context", { exact: true }),
  ).toHaveValue(/Only share these findings after checking the original source/);
});
test("generated tasks require review and then persist on the real calendar", async ({
  page,
}) => {
  const today = new Date().toLocaleDateString("en-CA");
  await page.route("**/api/ai/planner", (route) =>
    route.fulfill({
      json: {
        output: {
          ...outputs.planner,
          tasks: outputs.planner.tasks.map((task) => ({
            ...task,
            dueDate: today,
            status: "To Do",
          })),
        },
      },
    }),
  );
  await page.goto("/planner");
  await page.getByLabel("Project or goal").fill("Calendar integration");
  await page
    .getByLabel("What do you want to achieve?")
    .fill("Review a generated plan before committing it to the calendar.");
  await page
    .getByRole("button", { name: "Generate plan", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Add selected tasks to workspace" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "All tasks (0)", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Task Planner", exact: true }).click();
  await page
    .getByRole("button", { name: "Add selected tasks to workspace" })
    .click();
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  const focus = page.getByRole("region", { name: "Today’s focus" });
  await expect(
    focus.getByRole("checkbox", {
      name: `Complete ${outputs.planner.tasks[0].title}`,
    }),
  ).toBeVisible();
  await expect(
    page.locator(".calendar-agenda").getByRole("button", {
      name: new RegExp(outputs.planner.tasks[0].title),
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    focus.getByRole("checkbox", {
      name: `Complete ${outputs.planner.tasks[0].title}`,
    }),
  ).toBeVisible();
});
