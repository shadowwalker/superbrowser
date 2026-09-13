import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

async function atomicWrite(path: string, data: string | Uint8Array) {
  const temporary = `${path}.${process.pid}.part`;
  try {
    await writeFile(temporary, data, { mode: 0o600 });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

// A sidecar records the completed file's hash; incomplete files are downloaded again.
export async function downloadImage(
  url: string,
  path: string,
  metadata: Record<string, unknown>,
): Promise<{ status: "downloaded" | "skipped"; bytes: number }> {
  const source = new URL(url);
  source.search = "";
  source.hash = "";
  const sidecar = path.replace(/\.[^.]+$/, ".json");
  let previous: { source?: string; sha256?: string; bytes?: number; contentType?: string } | undefined;
  try { previous = JSON.parse(await readFile(sidecar, "utf8")); }
  catch (error) {
    if (!(error instanceof SyntaxError) && (error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (previous?.source === source.href && previous.sha256) {
    try {
      const bytes = await readFile(path);
      if (bytes.length === previous.bytes && digest(bytes) === previous.sha256) {
        await atomicWrite(sidecar, JSON.stringify({ ...metadata, source: source.href, bytes: bytes.length, sha256: previous.sha256, contentType: previous.contentType }, null, 2) + "\n");
        return { status: "skipped", bytes: bytes.length };
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`Image download returned HTTP ${response.status}; rerun to obtain a fresh download link`);
  const contentType = response.headers.get("content-type")?.split(";")[0] ?? "";
  if (!contentType.startsWith("image/")) throw new Error(`Expected an image response, received ${contentType || "no content type"}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const expected = response.headers.get("content-length");
  if (!bytes.length || (expected !== null && bytes.length !== Number(expected))) throw new Error("Image download was empty or incomplete");
  if (contentType === "image/jpeg" && !(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9)) {
    throw new Error("JPEG signature or end marker is missing");
  }
  await mkdir(dirname(path), { recursive: true });
  await atomicWrite(path, bytes);
  await atomicWrite(sidecar, JSON.stringify({ ...metadata, source: source.href, bytes: bytes.length, sha256: digest(bytes), contentType }, null, 2) + "\n");
  return { status: "downloaded", bytes: bytes.length };
}
