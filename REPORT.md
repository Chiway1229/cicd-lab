# CI Pipeline 實作報告

**學號：** r14725047  
**日期：** 2026-05-11

---

## 一、CI Pipeline 說明

### 1.1 Pipeline 檔案

檔案路徑：`.github/workflows/ci_r14725047.yaml`

```yaml
name: CI Pipeline (r14725047)

on:
  push:
    branches: ['**']

permissions:
  contents: read
  checks: write

jobs:
  ci:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: TypeScript typecheck
        run: npm run typecheck

      - name: Prettier check
        run: npm run format:check

      - name: Run tests
        run: |
          mkdir -p test-results
          npm test

      - name: Upload test artifact
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results
          path: test-results/junit.xml

      - name: Publish test report
        uses: dorny/test-reporter@v2
        if: always()
        with:
          name: Vitest Test Results
          path: test-results/junit.xml
          reporter: java-junit
```

### 1.2 Pipeline 設計說明

#### 自動觸發

```yaml
on:
  push:
    branches: ['**']
```

使用 `push` 事件搭配 `branches: ['**']` 萬用字元，讓所有分支的 push 都會自動觸發 CI Pipeline，不限定特定分支。

#### 核心檢查項目

| 步驟 | 指令 | 說明 |
|------|------|------|
| TypeScript typecheck | `npm run typecheck` | 執行 `tsc --noEmit`，檢查所有型別錯誤，不輸出編譯結果 |
| Prettier check | `npm run format:check` | 執行 `prettier --check .`，檢查程式碼格式是否符合 `.prettierrc` 設定 |
| Run tests | `npm test` | 執行 `vitest run`，跑所有單元測試 |

#### 錯誤阻斷機制

GitHub Actions 預設行為是：任一 step 的指令回傳非零 exit code，該 job 立即標記為 **failed** 並停止執行後續步驟（除非設定 `if: always()`）。

本 Pipeline 的設計讓 TypeScript typecheck → Prettier check → Run tests 依序執行，任一失敗即阻斷後續步驟，整個 Pipeline 顯示紅燈（failed）。

上傳測試報告的兩個步驟設定了 `if: always()`，確保即使測試失敗時，測試結果仍能上傳並顯示在 Actions 頁面。

#### 測試結果呈現

採用兩種方式呈現測試結果：

1. **`actions/upload-artifact@v4`**：將 JUnit XML 報告打包為 artifact，可在 Actions 結果頁面下載。
2. **`dorny/test-reporter@v2`**：解析 JUnit XML，在 Actions 頁面產生「Checks」區塊，直接顯示每個測試案例的通過 / 失敗狀態，無需下載。

Vitest 透過內建 JUnit reporter 輸出標準格式。Reporter 設定寫在 `vitest.config.ts`，
在 CI 環境（`CI=true`，GitHub Actions 自動設定）啟用 JUnit 輸出：

```typescript
reporters: isCI ? ['verbose', 'junit'] : ['verbose'],
outputFile: { junit: './test-results/junit.xml' }
```

Workflow 只需建立目錄並執行 `npm test`：

```bash
mkdir -p test-results
npm test
```

`dorny/test-reporter` 需要 `checks: write` 權限才能寫入 GitHub Checks，因此在頂層設定：

```yaml
permissions:
  contents: read
  checks: write
```

#### 使用工具與策略

| 工具 | 版本 | 用途 |
|------|------|------|
| `actions/checkout` | v4 | 取得程式碼 |
| `actions/setup-node` | v4 | 安裝 Node.js 22（含 npm cache） |
| `actions/upload-artifact` | v4 | 上傳測試 XML 報告 |
| `dorny/test-reporter` | v2 | 在 Actions UI 顯示測試結果 |
| Vitest | 4.1.5 | 測試框架（內建 JUnit reporter） |
| TypeScript | 5.x | 型別檢查（strict mode） |
| Prettier | 3.x | 程式碼格式檢查 |

---

## 二、CI 執行結果截圖

> **【截圖 1】成功執行截圖**
>
> 請至 GitHub → 你的 repo → **Actions** 頁籤
> → 點選「CI Pipeline (r14725047)」workflow
> → 點選最新一筆成功的執行（綠色勾勾）
> → 截取整個頁面，確認所有 steps 都顯示綠色勾勾
>
> _（請將截圖貼於此處）_

> **【截圖 2】測試結果頁面截圖**
>
> 在同一筆成功執行頁面中，捲動到下方「Checks」區塊
> 或點選右上角「Vitest Test Results」check
> → 截取顯示各測試案例通過的畫面
>
> _（請將截圖貼於此處）_

---

## 三、失敗案例說明

### 3.1 製造錯誤方式

在分支 `fail/typecheck-error` 中，於 `src/app.ts` 故意加入 TypeScript 型別錯誤：

```typescript
// Intentional type error for CI failure demo
const badValue: number = 'this is not a number';
```

將字串 `'this is not a number'` 指定給型別為 `number` 的變數，這在 TypeScript strict mode 下是不合法的型別指派。

### 3.2 Pipeline 失敗原因

`npm run typecheck`（即 `tsc --noEmit`）偵測到型別不相容，回傳非零 exit code，導致：

- 「TypeScript typecheck」step 標記為 ❌ failed
- 後續的 Prettier check、Run tests 步驟**不會執行**（被阻斷）
- 整個 job 顯示 **failed**

### 3.3 如何確認失敗

> **【截圖 3】Pipeline 失敗截圖**
>
> 請至 GitHub → Actions → 「CI Pipeline (r14725047)」
> → 點選分支 `fail/typecheck-error` 對應的那筆執行（紅色叉叉）
> → 截取整個頁面，確認「TypeScript typecheck」step 顯示紅色
> → 展開該 step，可看到錯誤訊息：
> `Type 'string' is not assignable to type 'number'`
>
> _（請將截圖貼於此處）_

### 3.4 修正方式

刪除該行有問題的變數宣告，或確保型別一致：

```typescript
// 修正：移除錯誤的型別宣告
// 或改為：
const badValue: string = 'this is not a number';
```

將修正後的程式碼 push 後，Pipeline 即可重新通過。

---

## 四、總結

本次實作透過 GitHub Actions 建立了完整的 CI Pipeline，涵蓋：

- **自動觸發**：任意分支 push 皆觸發
- **型別檢查**：TypeScript strict mode 確保型別安全
- **格式檢查**：Prettier 統一程式碼風格
- **自動化測試**：Vitest 執行單元測試並輸出 JUnit 報告
- **結果視覺化**：dorny/test-reporter 在 Actions UI 顯示測試細節
- **錯誤阻斷**：任一檢查失敗即終止後續步驟，避免品質不佳的程式碼進入主線
