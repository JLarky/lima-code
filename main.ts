#!/usr/bin/env -S mise x deno -- deno run --no-prompt --allow-read --allow-run --allow-env=HOME,XDG_RUNTIME_DIR,VSCODE_IPC_HOOK_CLI
/**
 * lima-code — VS Code / Cursor CLI for non-integrated terminals on Lima VMs.
 *
 * Discovers an active VS Code/Cursor IPC socket and the remote-cli binary,
 * then executes it with the user's arguments. No server needed.
 */

/** Directories where VS Code/Cursor may place IPC sockets. */
function ipcSocketDirs(): string[] {
  const dirs: string[] = [];
  const xdg = Deno.env.get("XDG_RUNTIME_DIR");
  if (xdg) dirs.push(xdg);
  dirs.push("/tmp");
  return dirs;
}

/** Find the most recent IPC socket that a server process is still listening on. */
export async function findIpcSocket(): Promise<string | null> {
  const candidates: { path: string; mtime: Date }[] = [];

  for (const dir of ipcSocketDirs()) {
    try {
      for await (const entry of Deno.readDir(dir)) {
        if (
          entry.name.startsWith("vscode-ipc-") && entry.name.endsWith(".sock")
        ) {
          const path = `${dir}/${entry.name}`;
          try {
            const stat = await Deno.stat(path);
            if (stat.mtime) {
              candidates.push({ path, mtime: stat.mtime });
            }
          } catch {
            // stale entry, skip
          }
        }
      }
    } catch {
      // dir doesn't exist or not readable, skip
    }
  }

  candidates.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  // Read /proc/net/unix once and check all candidates against it
  let procNetUnix: string;
  try {
    procNetUnix = await Deno.readTextFile("/proc/net/unix");
  } catch {
    // If /proc/net/unix is not available, return first candidate as best guess
    return candidates[0]?.path ?? null;
  }

  for (const { path } of candidates) {
    if (procNetUnix.includes(path)) {
      return path;
    }
  }

  return null;
}

/**
 * Locate the remote-cli binary inside a server install dir.
 * Searches two known layouts:
 *   - bin/<version>/bin/remote-cli/<binName>          (VS Code)
 *   - cli/servers/<version>/server/bin/remote-cli/<binName>  (Cursor)
 */
export async function findCliBin(
  serverDir: string,
  binName: string,
): Promise<string | null> {
  const layouts = [
    { versionDir: `${serverDir}/bin`, suffix: `bin/remote-cli/${binName}` },
    {
      versionDir: `${serverDir}/cli/servers`,
      suffix: `server/bin/remote-cli/${binName}`,
    },
  ];

  for (const { versionDir, suffix } of layouts) {
    const versions: { name: string; mtime: Date }[] = [];

    try {
      for await (const entry of Deno.readDir(versionDir)) {
        if (entry.isDirectory) {
          try {
            const stat = await Deno.stat(`${versionDir}/${entry.name}`);
            if (stat.mtime) {
              versions.push({ name: entry.name, mtime: stat.mtime });
            }
          } catch {
            // skip
          }
        }
      }
    } catch {
      continue;
    }

    versions.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    for (const { name } of versions) {
      const candidate = `${versionDir}/${name}/${suffix}`;
      try {
        const stat = await Deno.stat(candidate);
        if (stat.isFile) {
          return candidate;
        }
      } catch {
        // not found, try next
      }
    }
  }

  return null;
}

if (import.meta.main) {
  const socket = await findIpcSocket();
  if (!socket) {
    console.error(
      "error: no active VS Code/Cursor remote session found",
    );
    console.error(
      "Make sure VS Code or Cursor is connected to this VM via SSH.",
    );
    Deno.exit(1);
  }

  const home = Deno.env.get("HOME") ?? "/root";

  // Try VS Code first, then Cursor (cursor binary, then code binary name)
  let cliBin = await findCliBin(`${home}/.vscode-server`, "code");
  if (!cliBin) {
    cliBin = await findCliBin(`${home}/.cursor-server`, "cursor");
  }
  if (!cliBin) {
    cliBin = await findCliBin(`${home}/.cursor-server`, "code");
  }

  if (!cliBin) {
    console.error(
      `error: editor server CLI not found in ~/.vscode-server or ~/.cursor-server`,
    );
    Deno.exit(1);
  }

  Deno.env.set("VSCODE_IPC_HOOK_CLI", socket);

  const command = new Deno.Command(cliBin, {
    args: Deno.args,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });

  const { code } = await command.output();
  Deno.exit(code);
}
