Set up an alias in your shell on your host machine:

```bash
alias lcode='lima mise x deno -- deno run --no-prompt --allow-read --allow-run --allow-env=HOME,XDG_RUNTIME_DIR,VSCODE_IPC_HOOK_CLI https://raw.githubusercontent.com/JLarky/lima-code/refs/heads/main/main.ts'
```

Then run `lcode --help`, `lcode /tmp/myfile.ts`, etc. to execute commands in the
context of your remote editor.

The script directly discovers the active VS Code/Cursor IPC socket and the
`remote-cli` binary on the VM.

# Requirements

- An active VS Code or Cursor remote SSH session to the Lima VM
- Deno runtime available on the VM (via `mise` or directly)

# Permissions

| Flag                                                   | Why                                                                                                                                                                             |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--allow-read`                                         | Read filesystem for IPC socket discovery, liveness check, and CLI binary lookup. Unrestricted because VM paths (`$HOME`, `$XDG_RUNTIME_DIR`) can't be known from the host shell |
| `--allow-run`                                          | Execute the editor's `remote-cli` binary (can't scope further — exact path unknown at alias time)                                                                               |
| `--allow-env=HOME,XDG_RUNTIME_DIR,VSCODE_IPC_HOOK_CLI` | Read `HOME` and `XDG_RUNTIME_DIR` for path resolution, set `VSCODE_IPC_HOOK_CLI` for the editor subprocess                                                                      |

# How it works

1. Scans `/tmp/vscode-ipc-*.sock` for active IPC sockets (validated against
   `/proc/net/unix`)
2. Finds the `remote-cli` binary in `~/.vscode-server/bin/` or
   `~/.cursor-server/bin/`
3. Runs the binary with `VSCODE_IPC_HOOK_CLI` pointing to the active socket

Deno's permission system provides security guarantees that the script only
accesses what it declares.

# Security concerns

The script only executes the editor's own `remote-cli` binary — never arbitrary
commands. Arguments are passed through to the editor CLI.
