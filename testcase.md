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

**JSON tab**
- **Visual diff count is shown after compare**
  - Action: click **Compare** in JSON tab with pre-loaded samples
  - Expected: `3 differences` badge is shown above the side-by-side diff view
- **Side-by-side diff renders correct columns**
  - Expected: column headers show `JSON A` and `JSON B`
  - Expected: unchanged lines appear in both columns (neutral background)
  - Expected: changed values appear red in JSON A column, green in JSON B column
  - Expected: keys present only in B appear green on right, empty/grey on left
  - Expected: keys present only in A appear red on left, empty/grey on right
- **Match state shows success icon**
  - Modify both inputs to be identical JSON
  - Action: click **Compare**
  - Expected: green `JSON match` message with checkmark icon
- **Invalid JSON shows error**
  - Input: `{ bad json`
  - Action: click **Compare**
  - Expected: red error message shown, no diff tree rendered
- **Clears both JSON inputs**
  - Action: click **Clear**
  - Expected: both textareas empty, diff view hidden
- **Swap exchanges the two inputs**
  - Action: click **Swap**
  - Expected: JSON A and JSON B contents are exchanged, diff view reset

**cURL tab**
- **Structured table shows changed fields**
  - Action: switch to cURL tab, click **Compare** with pre-loaded samples
  - Expected: differences count shown; table with columns `Field`, `cURL A`, `cURL B`
  - Expected: differing values highlighted red (A) and green (B)
  - Expected: missing values shown as `—`
- **Match state shows success icon**
  - Input identical curl commands in both fields
  - Expected: green `Commands match` message
- **Invalid cURL shows error**
  - Input: `not a curl command`
  - Expected: red error message

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

### 8) Editor Pad

Test file: `tests/tools/editor-pad.test.tsx`

- **Renders sidebar and default note**
  - Expected: sidebar visible, default note created with timestamp title
- **Creates new note on + click**
  - Action: click **+**
  - Expected: new note added to sidebar with a unique timestamp name (`DD-MM-YY HH:MM:SS`)
- **Deletes note with trash icon**
  - Action: click trash icon on the only note
  - Expected: empty-state message shown
- **Plain mode renders textarea**
  - Expected: `<textarea>` with placeholder present in plain mode (default)
- **Auto-saves after debounce**
  - Input: type text into textarea
  - After 500ms: `editorpad-notes` localStorage key updated with new content
- **Live word / char count**
  - Input: `hello world`
  - Expected: status bar shows `2 words` and `11 chars`
- **Status bar label matches mode**
  - Plain mode → `Plain text`; Rich mode → `Rich text`
- **Mode switch hides textarea**
  - Action: click **Rich**
  - Expected: textarea removed, status shows `Rich text`
- **Find & Replace panel — toolbar button**
  - Action: click search icon
  - Expected: Find and Replace inputs visible
- **Find & Replace panel — Ctrl+H keyboard shortcut**
  - Action: dispatch `keydown` with `ctrlKey + h`
  - Expected: panel toggles open/closed
- **Replace All in plain mode**
  - Input: `foo bar foo`, find `foo`, replace `baz`
  - Expected: textarea value becomes `baz bar baz`
- **Copy to clipboard**
  - Action: click copy button
  - Expected: `navigator.clipboard.writeText` called with note text
- **Word wrap button visible only in plain mode**
  - Expected: Wrap button present in plain mode, absent in rich mode
- **Font size selector highlights active size**
  - Action: click **XL**
  - Expected: XL button receives active highlight class
- **Inline rename — Enter commits**
  - Action: double-click title, type new name, press Enter
  - Expected: new title displayed
- **Inline rename — Escape cancels**
  - Action: double-click title, type new name, press Escape
  - Expected: original title unchanged
- **Upload button triggers file input**
  - Action: click upload button
  - Expected: hidden `<input type="file">` click fired

> Note: All Tiptap packages are mocked in tests — jsdom does not support ProseMirror's DOM requirements. Download behaviour is mode-aware: `.txt` in plain mode, `.html` (full document) in rich mode.

---

## Recommended post-change checklist

Run these after major changes (middleware/CSP, dependency bumps, UI refactors):

1. `pnpm run test`
2. `pnpm run build`
3. Spot-check key pages:
   - `/tools/json-tools`
   - `/tools/editor-pad`
   - `/tools/compare-tools`
   - `/tools/jwt-generator`
   - `/tools/short-url-expander`
   - `/tools/basic-calculator` (both Calculator and Weight Price tabs)

If a test fails, update this file when behavior has intentionally changed.

---

### 9) Basic Calculator

Test file: `tests/tools/basic-calculator.test.tsx` (39 tests)

**Core UI**
- Renders expression input and key buttons (7, +, Equals, Clear, Backspace)
- Clicking digit buttons appends to expression
- Clicking operator buttons appends value
- C button clears the expression
- ⌫ button deletes the last character
- Enter key evaluates the expression
- Typing non-allowed characters is blocked

**Arithmetic**
- `3 + 4 = 7`
- `10 / 2 = 5`
- `6 * 7 = 42`

**Operator precedence**
- `2+3*4 = 14` (multiplication before addition)
- `10-2+5 = 13` (left-to-right)
- `100/5-8 = 12`
- `2*3+4*5 = 26`
- `20-5-3 = 12`
- `(2+3)*4-1 = 19`

**Parentheses**
- `(2+3)*4 = 20`
- `((3+2)*2)-4 = 6`
- `(10-4)/(2+1) = 2`
- `-(5+3) = -8`
- `2*(3+(4*5)) = 46`
- Mismatched parentheses → error

**Error states**
- Empty expression → "Expression is empty"
- Division by zero → "Result is undefined"
- Mismatched parentheses → error alert
- Bare `%` with no preceding number → error alert

**Percentage operator**
- `%` button renders and appends `%`
- `50% = 0.5`
- `100% = 1`
- `25% = 0.25`
- `200+10% = 220` (10% of 200 = 20, added to 200)
- `100-50% = 50` (50% of 100 = 50, subtracted)
- `1000-20% = 800`
- `500+5% = 525`
- `200*10% = 20` (multiplicative)
- `50%*2 = 1`

**History**
- Entry added after evaluation (expression + result visible)
- Clicking history item restores expression
- Saves to localStorage after evaluation
- Loads from localStorage on mount

**GST / Discount quick actions**
- `+ GST` and `− Discount` buttons render
- Buttons disabled when no value is in the expression
- Typing percentage and pressing Enter/Apply applies GST (adds `value*(rate/100)` to value)
- Typing percentage and pressing Enter/Apply applies discount (subtracts `value*(rate/100)` from value)
- History entry records breakdown (e.g. `1000 + 180 GST @18%`)

---

### 10) Weight Price Calculator (tab inside Basic Calculator)

No dedicated test file — covered via visual and manual testing.

**Normal mode (Price → Total)**
- Select unit: per kg / per 500g / per 100g / per 2kg
- Enter price and weight → result auto-calculates
- Breakdown line shows `Xkg × ₹Y/kg`
- Rounding chips (Exact / ₹1 / ₹5 / ₹10) modify displayed result; exact shown below when rounding active
- Negative inputs are blocked

**Reverse mode (Total → Weight)**
- Enter price/unit + total paid → shows kg and grams received

**Edge cases**
- Small weights (0.05 kg) handled correctly
- Decimal prices (e.g. ₹99.99/kg) handled correctly
- Empty inputs show placeholder, no result card rendered
- Clear button resets price, weight, and total fields
