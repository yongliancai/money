# 日日記｜AI 智慧記帳助手

Repository：yongliancai/money（原遠端 README：money）。

正式網址：[日日記](https://yongliancai.github.io/money/)。使用者已批准第一版發布，最新部署驗證狀態見 [發布紀錄](docs/RELEASE.md)。

免登入、單裝置、行動優先的本機帳本。完整帳本只保存在 IndexedDB，Express／SQLite 後端僅接收匿名裝置與提醒狀態。

**第一版使用 JavaScript 規則解析，不使用 AI API 或後端定時推播。** 多行文字可離線解析，分類衝突由你選擇，所有候選都要確認後才儲存。目前未發布；完整交接與實測見 [第一版驗收](docs/V1-ACCEPTANCE.md)。

## 第一版快速使用

```powershell
npm ci
npm run build:pages
npm run preview:pages
```

開啟 `http://127.0.0.1:4173/money/`。開發使用 `npm run dev:pages`，網址 `http://127.0.0.1:5173/money/`（開發模式不啟用 Worker，離線測試請使用建置版）。每行一筆，例如：

```text
早餐蛋餅 45
午餐便當 100
捷運 30
全聯買牛奶 65
```

分類為餐飲、交通、購物、娛樂、學習、生活、其他；規則集中在 `client/src/features/quick-entry/classification-rules.js`。無法判定時不會自動選「其他」，必須在可編輯預覽選擇。今日新建紀錄計入完成；備份匯入不計入。帳本只在目前瀏覽器，請定期備份。

## GitHub Pages 相容版（未發布）

目標倉庫 `yongliancai/money`，預設 Pages base `/money/`。第一版規則解析、手動記帳、統計、備份與離線 PWA 都可獨立使用；AI API 與背景推播不在第一版範圍。

```powershell
npm ci
npm run build:pages
npm run preview:pages
```

開啟 <http://127.0.0.1:4173/money/>。產物為 `dist-pages/`；第一版無需任何後端設定。現有 `npm run build`／`npm run dev` 保留為舊前後端整合測試版，未來後端接入需另訂版本，不屬第一版。發布門檻見 [第一版驗收](docs/V1-ACCEPTANCE.md)。

完整驗證需 `npx playwright install chromium webkit` 與 `npm run verify`。Pages 專用雙瀏覽器驗證為 `npm run test:pages`，WebKit 手機模擬不等於實際 iPhone Safari 驗收。

## 舊後端整合回歸環境（非第一版對外功能）

環境：Windows PowerShell，Node.js **22.23.1**，npm **10.9.8**。CI 使用同一 Node 版本。採用內建 `node:sqlite`（此 Node 版本會輸出 ExperimentalWarning），無需原生編譯工具。

```powershell
npm ci
npm run dev
```

開啟 <http://127.0.0.1:5173>，API 為 <http://127.0.0.1:3001/api/health>。預設僅綁定 loopback，無需外部服務、帳號或密鑰。Ctrl+C 停止。

要測試「展示解析」（不是實際 AI）：

```powershell
$env:AI_MODE='demo'
npm run dev
```

支援示例：「昨天午餐 120、今天咖啡 55」。展示解析只處理有限格式；結果一律預覽、可修改並明確確認後儲存。未解析文字會顯示，可改用手動記帳。

Service Worker 僅在建置版本啟用。測試完整 PWA 離線殼層：

```powershell
npm run build
# 若先前設定過 APP_ORIGIN，須與下列網址一致。
$env:APP_ORIGIN='http://127.0.0.1:3001'
npm start
```

開啟 <http://127.0.0.1:3001>。不同 port 是不同瀏覽器資料來源，因此 5173 與 3001 的帳本分開；使用 JSON 匯出／合併匯入移轉。不可把 loopback HTTP 測試推論為 iPhone HTTPS 實機成功。

可選設定範本為 `.env.example`，本機設定檔使用 Git 忽略的 `.env.local`。請勿把金鑰貼到對話或提交 Git。模型、費用上限、推播政策與公開 HTTPS 仍待決。

## 驗證

```powershell
npx playwright install chromium webkit
npm run verify
node scripts/regression-proof.mjs
npm audit --audit-level=high
```

`verify` 包含 ESLint、Prettier、依賴與機密防護、單元／整合／契約測試、Vite build 與 Chromium E2E。詳細矩陣見 [TESTING](docs/TESTING.md)，實際結果與限制見 [VERIFICATION](docs/VERIFICATION.md)。GitHub Actions 只有品質檢查，沒有部署工作。

## 功能

- 手動新增、編輯、刪除，品項搜尋、自訂分類、按消費日期的月統計。
- 單筆／多筆展示解析、可編輯預覽、取消、明確確認，失敗時手動替代。
- JSON／CSV 匯出，JSON 版本驗證、合併去重、恢復警示、預覽確認。
- 今日新建活動與匯入分離；刪光今日新增紀錄則恢復未完成。
- 交易式 outbox、匿名裝置授權／撤銷、提醒設定、事件版本與重送保護。
- 推播訂閱能力偵測與權限流程、SQLite 每日唯一發送 claim、跨日防護；實際通知仍 BLOCKED。
- 手機響應式介面、PWA shell 快取、離線本機記帳。

## 專案地圖

```text
client/                 Vite 原生 JS、UI、IndexedDB、同步、PWA
server/src/             Express API、裝置授權、SQLite、排程、展示解析
shared/                 Zod 資料契約、IANA 日期工具
scripts/                啟動、機密／架構防護、回歸證明、驗收紀錄
tests/{unit,integration,contracts,e2e}/
docs/                   需求、工程規範、ADR、各階段證據與限制
.github/workflows/      CI（不部署）
```

完整版本化檔案清單見 [PROJECT-TREE](docs/PROJECT-TREE.md)，工程入口為 [AGENTS.md](AGENTS.md)。不包含登入、跨裝置帳本同步、OCR、語音、銀行串接、預算或理財建議。
