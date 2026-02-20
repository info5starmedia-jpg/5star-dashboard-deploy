# Parallel Delivery Workflow

1. Orchestrator defines scope and Definition of Done.
2. Builder implements changes on a feature branch.
3. QA/Test runs local checks and documents results.
4. Security/Compliance reviews for secrets/dependency risks.
5. Automation runs browser flows when UI changes are involved.
6. Orchestrator opens PR, verifies checks, and squash-merges.
