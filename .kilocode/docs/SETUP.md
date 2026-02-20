# Kilo Code Setup (Full Automation)

## Prerequisites

- Docker Desktop installed and running.
- GitHub Personal Access Token (PAT) with `repo` and `workflow` scopes.
- (Optional) Brave Search API key for the research MCP server.

## Required Windows User Environment Variables

Set these as **User** environment variables on Windows:

- `GITHUB_TOKEN` = your GitHub PAT
- `BRAVE_API_KEY` = your Brave Search API key (optional)

## MCP Server Configuration

Kilo reads MCP server definitions from [`mcp.json`](../mcp.json). Each MCP server runs via Docker, so no local installs are required beyond Docker Desktop.

## GitHub Automation

- Multi-repo access is enabled via the PAT.
- Kilo can create branches, push, and open PRs.
- All PR checks must pass before merge.
- Squash-merge is required.

## Parallel Agents

Parallel agent roles live under [`modes`](../modes). The Orchestrator delegates to Builder, QA/Test, Security/Compliance, and Automation (Browser).
