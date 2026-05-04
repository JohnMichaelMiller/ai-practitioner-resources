---
mode: "agent"
description: "Count all unique paths through a workflow state machine by analyzing entry points, exit points, and branching logic from a state diagram file"
---

Given the possible entry points into the workflow and all of the possible end points, how many unique paths through the workflow exist?

To answer this:

1. Locate the state machine diagram for this repository (look for a file like `ISSUE_LIFECYCLE_STATE_DIAGRAM.md` or a Mermaid `stateDiagram` in `.github/workflows/`).

2. Identify all **entry points** — states reachable from `[*]` (the initial pseudo-state).

3. Identify all **exit points** — states that transition to `[*]` (terminal states).

4. Trace every unique simple path (no repeated states) from each entry to each exit, counting branches at each decision node.

5. Exclude retry loops (states that cycle back to themselves or a prior state) from the path count — treat them as iterations within a single path rather than separate paths.

6. Present the results as:
   - A table listing each exit point with its path count and a representative example path
   - A breakdown of what drives path multiplication (e.g., lane count × review round outcomes)
   - A final total with the formula used

7. Capture the numeric Number of the **'Workflow Testing'** GitHub project for the repository owner using: `gh project list --owner <owner> --format json` and extract the `id` field from the project with title `Workflow Testing`.

8. For each unique path found, create a GitHub issue describing the exact path that issue should follow:
   - **Title**: `[Workflow Path Test] <exit_state> via <key_branch>` (e.g. `[Workflow Path Test] Merged via On_Bench, AI Round 2 Pass`)
   - **Body** must include (use `\n\n` between each item to produce blank lines in the rendered issue):
     - A numbered list of every state in the path in order, where each entry shows: `<step>. <current_state> → <transition_trigger> → <next_state>` (e.g. `1. Issue_Created → issue created → Auto_Validation`)
     - The expected label applied at each state transition (e.g. `Step 4: label "needs-details" applied`)
     - The expected state the issue should be in after each step completes
     - The expected exit state and close reason
     - A checkbox for tracking the issue's progress through the workflow (e.g. `- [ ] Path followed correctly`)
   - **Labels**: `workflow-path-test`, `on the bench`
   - Create each issue with: `gh issue create --repo <owner>/<repo> --title "<title>" --body "<body>" --label "workflow-path-test" --label "on the bench"`
   - Add each issue to the **'Workflow Testing'** project using the ID captured in step 7: `gh project item-add <project_id> --owner <owner> --url <issue_url>`
   - After all issues are created, output a summary table with columns: path number, issue number, issue URL, and exit state
