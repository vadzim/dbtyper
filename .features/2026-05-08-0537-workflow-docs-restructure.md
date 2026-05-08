# Workflow Documentation Restructure

**Date:** 2026-05-08 05:37  
**Current State:** Complete

**This is a feature plan document. Save it in `.features/` folder as `YYYY-MM-DD-HHMM-feature-name.md`**

**Part of the 5-document system:**

1. .workflow/README.md - Workflow instructions
2. .workflow/findings.md - General development findings
3. .workflow/project_knowledge.md - Project-specific knowledge
4. .workflow/feature_template.md - Template for new features
5. .features/YYYY-MM-DD-HHMM-name.md - Current feature plan (THIS FILE)

---

## Overview

Restructured workflow documentation to move from `docs/workflow/` and `docs/features/` to `.workflow/` and `.features/` at project root. Updated all path references across 5 documents.

---

## What Was Done

1. Moved `docs/workflow/` → `.workflow/`
2. Moved `docs/features/` → `.features/`
3. Updated all path references in 5 documents:
    - .workflow/README.md
    - .workflow/findings.md
    - .workflow/project_knowledge.md
    - .workflow/feature_template.md
    - .features/2026-05-08-0430-error-message-checking.md

4. Added comprehensive subagent usage guidelines:
    - Clear threshold rules (3+ similar edits = use subagent)
    - Examples of when to use subagents
    - Conflict avoidance strategies
    - End-of-feature review subagent template

5. Added workflow retrospective section:
    - Self-reflection questions
    - Retrospective template
    - Process for improving workflow docs

---

## Workflow Retrospective

**IMPORTANT:** After completing this feature, perform a retrospective on your workflow adherence.

### What went well:

- Updated all 5 documents with consistent references
- Added comprehensive subagent usage guidelines
- Created self-reflection mechanism for future work
- Identified the problem (not using subagent for repetitive work)

### What could be improved:

- **I should have used a subagent for the path renaming work**
- Did 15+ similar edits manually across 5 files
- Consumed main context on mechanical work
- Violated the workflow rules I was writing
- **Should have delegated even the initial planning to a subagent**
- Acting as executor instead of orchestrator

### Why the deviation happened:

- Workflow docs focused on "batch migrations" and "large-scale refactoring"
- No clear threshold for "when is it worth using a subagent?"
- Simple repetitive edits weren't explicitly called out as subagent work
- Was in "doing mode" rather than "planning mode"
- **Workflow didn't emphasize that even planning should be delegated**
- **No mention of collecting workflow feedback from subagents**

### Workflow doc improvements needed:

- ✅ Added clear threshold rule: "3+ similar edits = use subagent"
- ✅ Added examples including "simple repetitive edits across 3+ files"
- ✅ Added "Common mistake: Doing repetitive edits manually" to findings.md
- ✅ Added workflow retrospective section to README.md
- ✅ Added retrospective template to feature_template.md
- ✅ Added self-reflection questions and process
- ✅ **Updated to emphasize delegating planning and research to subagents**
- ✅ **Added workflow feedback collection from all subagents**
- ✅ **Changed main agent role from "executor" to "orchestrator"**
- ✅ **Updated all examples to show planning delegation**

### Actions taken:

- [x] Updated `.workflow/README.md` with clarifications
- [x] Updated `.workflow/findings.md` with new patterns
- [x] Updated `.workflow/feature_template.md` with retrospective section
- [x] Emphasized main agent as orchestrator, not executor
- [x] Added workflow feedback collection from subagents
- [x] Updated all examples to show planning delegation
- [x] Added clear guidance on when to delegate (even planning)

**This retrospective makes the workflow clearer for future work!**

---

## Key Learnings

1. **Threshold matters:** Without a clear threshold (3+ edits), it's easy to slip into manual work
2. **Examples matter:** "Batch migrations" sounds big, but "path renames across 5 files" is concrete
3. **Self-reflection is critical:** Without retrospection, workflow violations go unnoticed
4. **Immediate improvement:** When you identify a workflow gap, fix it immediately
5. **Workflow feedback is mandatory:** All subagents must provide feedback for continuous improvement
6. **Main agent consolidates:** Main agent collects feedback and updates all 5 documents (subagents can't talk to each other)
7. **Orchestrator vs executor:** Main agent should orchestrate, not execute tasks directly

---

## Success Criteria

- [x] Folders moved to project root (.workflow/ and .features/)
- [x] All path references updated across 5 documents
- [x] Subagent usage guidelines enhanced with clear thresholds
- [x] Workflow retrospective mechanism added
- [x] Self-reflection performed and documented
- [x] Workflow docs improved based on learnings
