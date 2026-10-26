# Prompt History

Chronological log of user prompts for this project, kept verbatim. Newest entries are appended at
the bottom.

- **Project:** MVP Calc
- **Session date:** 2026-10-25
- **Maintained by:** the agent, appended after each prompt

---

## 1. Plan request

> read the @requirements.md to create a plan to make this in steps, for instance I want the backend
> first and then proceed with frontend, at the end the optionals. Ask for clarification if need it

Clarification answers given:

- API shape: single `/calculate` endpoint
- Optional operations: include all three (exponentiation, square root, percentage)
- Percentage semantics: `a op (b%)`
- UI model: hybrid (keypad + expression line)
- Docker: one image, Go serves the SPA

## 2. Alternatives to per-node HTTP calls

> what other options do we have to avoid "means one HTTP call per AST node"

Clarification answer given:

- Evaluator strategy: nested operands (recursive AST), one request per evaluation, percentage as an
  operand property

## 3. Save the plan

> save this plan. Do not start the implentation yet

## 4. Prompt history file

> create a new file to create a historical of the promnts I'm giving
