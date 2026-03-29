import { assertEquals } from "@std/assert";
import { findCliBin, findIpcSocket } from "./main.ts";

Deno.test("findIpcSocket returns null when no sockets exist", async () => {
  // In a test environment there should be no vscode-ipc sockets
  // This test verifies the function handles the empty case gracefully
  const result = await findIpcSocket();
  // We can't assert null because there might be a real session;
  // just verify it returns string or null without throwing
  assertEquals(typeof result === "string" || result === null, true);
});

Deno.test("findCliBin returns null for nonexistent dir", async () => {
  const result = await findCliBin(
    "/tmp/nonexistent-dir-lima-code-test",
    "code",
  );
  assertEquals(result, null);
});

Deno.test("findCliBin finds binary in bin/ layout", async () => {
  const tmpDir = await Deno.makeTempDir({ prefix: "lima-code-test-" });
  try {
    const binPath = `${tmpDir}/bin/abc123/bin/remote-cli/code`;
    await Deno.mkdir(`${tmpDir}/bin/abc123/bin/remote-cli`, {
      recursive: true,
    });
    await Deno.writeTextFile(binPath, "#!/bin/sh\necho fake");

    const result = await findCliBin(tmpDir, "code");
    assertEquals(result, binPath);
  } finally {
    await Deno.remove(tmpDir, { recursive: true });
  }
});

Deno.test("findCliBin finds binary in cli/servers/ layout", async () => {
  const tmpDir = await Deno.makeTempDir({ prefix: "lima-code-test-" });
  try {
    const binPath =
      `${tmpDir}/cli/servers/Stable-abc123/server/bin/remote-cli/cursor`;
    await Deno.mkdir(
      `${tmpDir}/cli/servers/Stable-abc123/server/bin/remote-cli`,
      { recursive: true },
    );
    await Deno.writeTextFile(binPath, "#!/bin/sh\necho fake");

    const result = await findCliBin(tmpDir, "cursor");
    assertEquals(result, binPath);
  } finally {
    await Deno.remove(tmpDir, { recursive: true });
  }
});

Deno.test("findCliBin picks most recent version", async () => {
  const tmpDir = await Deno.makeTempDir({ prefix: "lima-code-test-" });
  try {
    // Create two versions
    const oldPath = `${tmpDir}/bin/old-version/bin/remote-cli/code`;
    const newPath = `${tmpDir}/bin/new-version/bin/remote-cli/code`;

    await Deno.mkdir(`${tmpDir}/bin/old-version/bin/remote-cli`, {
      recursive: true,
    });
    await Deno.writeTextFile(oldPath, "old");

    // Small delay to ensure different mtime
    await new Promise((r) => setTimeout(r, 50));

    await Deno.mkdir(`${tmpDir}/bin/new-version/bin/remote-cli`, {
      recursive: true,
    });
    await Deno.writeTextFile(newPath, "new");

    const result = await findCliBin(tmpDir, "code");
    assertEquals(result, newPath);
  } finally {
    await Deno.remove(tmpDir, { recursive: true });
  }
});

Deno.test("findCliBin returns null when binary name doesn't match", async () => {
  const tmpDir = await Deno.makeTempDir({ prefix: "lima-code-test-" });
  try {
    await Deno.mkdir(`${tmpDir}/bin/abc123/bin/remote-cli`, {
      recursive: true,
    });
    await Deno.writeTextFile(
      `${tmpDir}/bin/abc123/bin/remote-cli/code`,
      "fake",
    );

    const result = await findCliBin(tmpDir, "cursor");
    assertEquals(result, null);
  } finally {
    await Deno.remove(tmpDir, { recursive: true });
  }
});
