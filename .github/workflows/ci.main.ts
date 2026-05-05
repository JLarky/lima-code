import { stringify as yamlStringify } from "@std/yaml";
import { workflow } from "@jlarky/gha-ts/workflow-types";
import { generateWorkflow } from "@jlarky/gha-ts/cli";
import { lines } from "@jlarky/gha-ts/utils";
import { checkout, installDeno } from "./utils/steps.ts";
import { publishJsr } from "./utils/jobs.ts";

const wf = workflow({
  name: "CI",
  on: {
    push: { branches: ["main"] },
    pull_request: {},
  },
  jobs: {
    dryRunPublish: publishJsr({ dryRun: true }),
    test: {
      "runs-on": "ubuntu-latest",
      steps: [
        checkout(),
        installDeno(),
        {
          name: "Check generated workflows are up to date",
          run: lines`
            for f in .github/workflows/*.main.ts; do
              deno run --allow-read --allow-write "$f"
            done
            git diff --exit-code .github/workflows/
          `,
        },
        { name: "Lint", run: "deno lint" },
        { name: "Format check", run: "deno fmt --check" },
        {
          name: "Test",
          run: "deno test --allow-read --allow-write --allow-env --allow-run",
        },
      ],
    },
  },
});

await generateWorkflow(wf, (data) => yamlStringify(data), import.meta.url);
