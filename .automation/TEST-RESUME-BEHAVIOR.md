# Test Scenario: Agent Resume Behavior

**Date:** 2026-05-08 08:20  
**Purpose:** Verify that an agent will properly read .workflow/ when told to continue a feature

---

## Test Scenario

**User says:** "continue with .features/*automated*"

**Expected Agent Behavior:**

1. ✅ Agent reads `.features/2026-05-08-0814-automated-issue-implementation.md`
2. ✅ Agent sees **"CRITICAL: Before working on this feature, you MUST read .workflow/ folder"**
3. ✅ Agent reads `.workflow/README.md` (FIRST)
4. ✅ Agent reads `.workflow/findings.md` (SECOND)
5. ✅ Agent reads `.workflow/project_knowledge.md` (THIRD)
6. ✅ Agent reads `.workflow/feature_template.md` (FOURTH)
7. ✅ Agent understands the 5-document workflow system
8. ✅ Agent sees feature status is **"✅ Complete and ready for production use"** (line 4)
9. ✅ Agent tells you: **"This feature is complete. What would you like me to do?"**

**Agent should NOT:**
- ❌ Start implementing anything
- ❌ Modify any files
- ❌ Assume what you want
- ❌ Continue working without asking

**Agent SHOULD:**
- ✅ Report that feature is complete
- ✅ Ask what you want to do
- ✅ Wait for your instruction

---

## What Makes This Work

### 1. Strong Directive Language

**Before (weak):**
```markdown
**IMPORTANT: If resuming this feature, READ .workflow/ folder first:**
```

**After (strong):**
```markdown
**CRITICAL: Before working on this feature, you MUST read .workflow/ folder:**
1. **FIRST:** Read `.workflow/README.md`
2. **SECOND:** Read `.workflow/findings.md`
...
```

**Why it's better:**
- ✅ "CRITICAL" is stronger than "IMPORTANT"
- ✅ "you MUST" is stronger than "If resuming"
- ✅ Numbered steps create clear order
- ✅ "Before working" applies to ANY interaction, not just resuming
- ✅ Applies to "starting, resuming, or reviewing"

### 2. Clear Ordering

The numbered list (FIRST, SECOND, THIRD, FOURTH) makes it impossible to miss the sequence.

### 3. Universal Application

"This applies whether you are starting, resuming, or reviewing this feature" covers all cases.

---

## Verification Checklist

When you restart and test, verify the agent:

- [ ] Reads the feature plan file
- [ ] Sees the CRITICAL directive
- [ ] Reads all 4 .workflow/ files in order
- [ ] Understands the 5-document system
- [ ] Checks feature status before acting
- [ ] Asks for clarification if feature is complete

---

## Potential Edge Cases

### Edge Case 1: Agent Ignores Directive

**Symptom:** Agent starts working without reading .workflow/

**Cause:** Agent doesn't recognize the directive as mandatory

**Solution:** The word "CRITICAL" and "MUST" should prevent this

### Edge Case 2: Agent Reads But Doesn't Apply

**Symptom:** Agent reads .workflow/ but doesn't follow the patterns

**Cause:** Agent reads but doesn't internalize the information

**Solution:** Can't prevent this - depends on agent's reasoning ability

### Edge Case 3: Feature is Complete

**Symptom:** Agent is confused about what to do

**Cause:** Feature status says "Complete"

**Expected:** Agent should ask "What would you like me to do with this complete feature?"

---

## Recommendation

**The directive is now strong enough that it SHOULD work.**

**To test:**
1. Restart the agent
2. Say: "continue with .features/*automated*"
3. Observe if agent reads .workflow/ files
4. Verify agent understands the workflow system

**If it doesn't work:**
- The directive language may need to be even stronger
- Or the agent may need explicit instruction in the user prompt

---

## Confidence Level

**High confidence (85%)** that the agent will:
- ✅ Read the feature plan
- ✅ See the CRITICAL directive
- ✅ Read the .workflow/ files

**Medium confidence (60%)** that the agent will:
- ⚠️ Actually apply the workflow patterns
- ⚠️ Ask for clarification on complete features

**The directive is as strong as it can be. The rest depends on the agent's reasoning.**

---

**Status:** ✅ Ready to test  
**Next:** Restart and try "continue with .features/*automated*"
