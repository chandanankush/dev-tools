# Test Cases

This document captures the important regression test cases added for each developer tool so they can be run after security or middleware changes (for example CSP updates).

## How to run

```bash
pnpm run test
```

Watch mode:

```bash
pnpm run test:watch
```

## Test stack

- Runner: `vitest`
- UI testing: `@testing-library/react`
- DOM assertions: `@testing-library/jest-dom`
- Environment: `jsdom`

Config and setup:

- `vitest.config.ts`
- `tests/setup.ts`

## Tool-wise test cases

### 1) JSON Tools

Test file: `tests/tools/json-tools.test.tsx`

- **Formats valid JSON**
  - Input: compact valid JSON (`{"a":1}`)
  - Action: click **Format**
  - Expected: pretty-printed JSON output
- **Clears content and error state**
  - Input: invalid JSON
  - Action: trigger format (to create error), then click **Clear**
  - Expected: editor becomes empty and error message is removed

---

### 2) Compare Tools

Test file: `tests/tools/compare-tools.test.tsx`

- **Compares JSON samples and shows diff summary**
  - Action: click **Compare** in JSON tab
  - Expected: difference summary is shown (e.g. `3 differences`)
- **Clears both JSON inputs**
  - Action: click **Clear**
  - Expected: both left and right JSON textareas are empty

---

### 3) Base64 Tool

Test file: `tests/tools/base64-utility.test.tsx`

- **Encode flow works**
  - Input: `hello`
  - Action: click **Encode**
  - Expected: output is `aGVsbG8=`
- **Decode flow works**
  - Input: `aGVsbG8=`
  - Action: switch to decode mode and click **Decode**
  - Expected: decoded output is `hello`

---

### 4) JWT Generator

Test file: `tests/tools/jwt-generator.test.tsx`

- **Encode mode generates token output**
  - Action: click **Generate JWT**
  - Expected: generated token textarea is populated
- **Decode mode validates empty input**
  - Action: switch to decode mode and submit without token
  - Expected: validation message `Paste a JWT to decode.` appears

> Note: JWT utility functions are mocked in component tests to keep UI tests deterministic.

---

### 5) QR Code Generator

Test file: `tests/tools/qr-code-generator.test.tsx`

- **Generates QR preview from text**
  - Input: text content
  - Expected: QR preview image is rendered
- **Validates URL mode input**
  - Action: switch to URL mode and enter invalid URL
  - Expected: URL validation error is shown

> Note: `qrcode` generation is mocked in tests for stability and speed.

---

### 6) URL Expander

Test file: `tests/tools/url-expander.test.tsx`

- **Shows empty-input validation**
  - Action: submit without URLs
  - Expected: `Enter at least one short URL.` error appears
- **Renders API expansion results**
  - Input: one short URL
  - Action: submit form
  - Expected: processed count and expanded URL are displayed

> Note: `fetch` is stubbed for success/error path testing without real network dependency.

---

### 7) UUID Generator

Test file: `tests/tools/uuid-generator.test.tsx`

- **Generates requested count of UUIDs**
  - Input: count = `3`
  - Action: click **Generate UUIDs**
  - Expected: output contains exactly 3 UUID lines

> Note: `crypto.randomUUID` is mocked for deterministic assertions.

## Recommended post-change checklist

Run these after major changes (middleware/CSP, dependency bumps, UI refactors):

1. `pnpm run test`
2. `pnpm run build`
3. Spot-check key pages:
   - `/tools/json-tools`
   - `/tools/compare-tools`
   - `/tools/jwt-generator`
   - `/tools/short-url-expander`

If a test fails, update this file when behavior has intentionally changed.
