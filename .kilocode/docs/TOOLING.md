# Tooling

## Primary tools

- Docker MCP servers defined in [`mcp.json`](../mcp.json): github, fetch, filesystem, playwright, memory, research.

## Process

- Orchestrator runs resource intake and defines Definition of Done.
- Builder implements changes.
- QA/Test runs local checks and reproduces issues.
- Security/Compliance runs dependency and secrets review.
- Automation (Browser) runs Playwright/Puppeteer workflows.

## Memory updates

Update memory files after each completed task:

- [`docs/memory/PROJECT_STATE.md`](memory/PROJECT_STATE.md)
- [`docs/memory/DECISIONS.md`](memory/DECISIONS.md)
- [`docs/memory/CHECKLIST.md`](memory/CHECKLIST.md)

## GitHub policy

- Do not merge unless all required checks pass.
- Squash-merge only.
