# Mobile Mission Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mobile-only floating mission button that opens a bottom drawer for the current mission list.

**Architecture:** Keep the desktop sidebar unchanged and add a small piece of mobile-only state in `App.tsx` for the drawer open/close flow. Reuse the existing `missions` data and existing mission-card content so the mobile drawer shows the same information goals as the desktop sidebar.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library

---

### Task 1: Add a failing test for the mobile mission drawer

**Files:**
- Modify: `D:/project/linguopals-ai/src/App.test.tsx`
- Test: `D:/project/linguopals-ai/src/App.test.tsx`

- [ ] **Step 1: Write the failing test**

Add a test that:
- mocks `refreshMissions()` with at least one mission
- enters a character scene
- clicks a button labeled `打开任务抽屉`
- expects a drawer labeled `移动端任务抽屉` to appear
- expects the mission description to be visible inside the drawer
- clicks a button labeled `关闭任务抽屉`
- expects the drawer to disappear

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- src/App.test.tsx`
Expected: FAIL because the mobile task drawer controls do not exist yet.

### Task 2: Implement the mobile drawer

**Files:**
- Modify: `D:/project/linguopals-ai/src/App.tsx`
- Test: `D:/project/linguopals-ai/src/App.test.tsx`

- [ ] **Step 1: Add minimal drawer state**

Add a boolean state for opening and closing the mobile mission drawer.

- [ ] **Step 2: Add the floating mobile button**

Render a mobile-only floating action button in the chat view with:
- label `打开任务抽屉`
- an incomplete mission count badge

- [ ] **Step 3: Add the bottom drawer**

Render a mobile-only bottom drawer with:
- label `移动端任务抽屉`
- close button labeled `关闭任务抽屉`
- current mission cards and loading/empty states

- [ ] **Step 4: Keep desktop behavior unchanged**

Do not remove or redesign the current desktop sidebar.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm.cmd test -- src/App.test.tsx`
Expected: PASS for the new mobile drawer test.

### Task 3: Verify no regressions

**Files:**
- Test: `D:/project/linguopals-ai/src/App.test.tsx`
- Test: `D:/project/linguopals-ai/src/services/geminiService.api.test.ts`

- [ ] **Step 1: Run focused regression checks**

Run: `npm.cmd test -- src/App.test.tsx`
Expected: PASS

- [ ] **Step 2: Run service-layer checks**

Run: `npm.cmd test -- src/services/geminiService.api.test.ts`
Expected: PASS

- [ ] **Step 3: Run typecheck**

Run: `npm.cmd run lint`
Expected: PASS

- [ ] **Step 4: Run production build**

Run: `npm.cmd run build`
Expected: PASS
