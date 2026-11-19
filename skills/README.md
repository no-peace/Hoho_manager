# Repository skills

This directory contains reusable instructions for compatible AI coding agents.

## Impeccable

- Skill entrypoint: [impeccable/SKILL.md](./impeccable/SKILL.md)
- Upstream: https://github.com/pbakaus/impeccable
- Installed upstream version: 4.10.0
- License: Apache-2.0 ([license](./impeccable/LICENSE))

The complete skill references and runtime support files are vendored under `impeccable/`. Keep the folder structure intact because the skill references files relative to its own directory.

This repository copy does not install the skill into ChatGPT's built-in skill catalog. Coding agents must be configured to load repository skills from `skills/` or be pointed to `skills/impeccable/SKILL.md`.
