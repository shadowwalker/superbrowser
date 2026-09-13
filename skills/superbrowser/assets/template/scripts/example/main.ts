import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { runScript } from "../../utils/run.js";

await runScript({ name: "example" }, async run => {
  const config = JSON.parse(await readFile(join(run.scriptDir, "config.json"), "utf8"));
  const target = new URL(process.argv[2] || config.url);
  if (!["http:", "https:"].includes(target.protocol)) throw new Error("The example URL must use HTTP or HTTPS");
  const page = await run.step("select-page", async () => {
    for (const page of await run.context.pages()) if (await page.url() === target.href) return page;
    return await run.context.newPage(target.href);
  });
  run.usePage(page);
  return await run.step("verify-page", async () => {
    if (!await page.waitForSelector("body", { state: "visible", timeout: 10000 })) throw new Error("The page did not become ready");
    const snapshot = await page.snapshot();
    const title = await page.title();
    if (!title || !snapshot.formattedTree.trim()) throw new Error("The page has no title or readable DOM");
    return { title, url: await page.url(), pageId: page.pageId, snapshot: snapshot.formattedTree.slice(0, 4000) };
  });
});
