# 測試與驗收

第一批新增 `analysis-regression.test.js`（unit／integration）與 `analysis-regression.spec.js`（Pages Chromium／WebKit）：實際帶資料 v1 升級、createdAt、交易回滾與重試、跨分頁競爭、匯入來源／群組碰撞、日期與金額邊界、五筆門檻與刪改重算、鍵盤操作、三主分頁、320／390／768 寬度與離線分析。統一 verify 保留所有既有測試。當前證據存於 `docs/evidence/batch1/`；[本批交接](ANALYSIS-BATCH1.md) 為最新驗收入口，不用舊第一版 PASS 推定本批通過。舊驗收腳本 `verify-published.mjs` 僅適用已發布第一版，本批不執行正式站測試或部署。

第一版新增本機 quick-entry unit 與雙瀏覽器 E2E。`scripts/test-pages.mjs` 刻意在 Pages fixture 留下後端 URL，驗證第一版依然零 API；另一個 integration fixture 繼續原有後端回歸。根目錄網路錯誤測試單獨設定 serviceWorkers:block 以可靠攔截 HTTP，不影響獨立 Worker／離線／更新測試。理由見 [Playwright 官方說明](https://playwright.dev/docs/network#missing-network-events-and-service-workers)。最新結果以 [V1-ACCEPTANCE](V1-ACCEPTANCE.md) 為準。

Pages 最新驗收：`npm run verify` 現在額外執行 `npm run test:pages`，在嚴格 `/money/` 靜態站（無 API、無 SPA fallback）以 Chromium 與 WebKit 手機尺寸驗證。安裝瀏覽器使用 `npx playwright install chromium webkit`。新增 `scripts/workflow-policy.mjs` 驗證 CI 與手動發布範本分離；公開變數白名單有真實負例 build。證據可用 `npm run verify:record -- docs/evidence/pages` 保存，避免覆蓋初始里程碑紀錄。詳見 [Pages 驗收](GITHUB-PAGES.md)。

| 命令                              | 覆蓋                                                                      |
| --------------------------------- | ------------------------------------------------------------------------- |
| npm ci                            | lockfile 安裝，不依賴其他專案                                             |
| npm run lint                      | ESLint 語法與前端 restricted imports                                      |
| npm run format:check              | Prettier 一致性                                                           |
| npm run guardrails                | AST 依賴方向、機密形狀、Git 追蹤檔政策                                    |
| npm run test:unit                 | 金額／日期／統計／展示解析／提醒純函式／SW／防護正反例                    |
| npm run test:integration          | 真實 IDB API 的 fake-indexeddb adapter、SQLite、API client 同步與狀態序列 |
| npm run test:contracts            | 真實 Express／SQLite＋Supertest 授權、Schema、限流、安全負例              |
| npm run build                     | Vite 產出 JS/CSS、PWA shell、build hash cache                             |
| npm run test:e2e                  | 建置版真實 HTTP／Chromium／IndexedDB／Service Worker                      |
| npm run verify                    | 以上所有品質、行為、建置、E2E 門檻（不含 npm ci）                         |
| node scripts/regression-proof.mjs | 跨月錯誤樣本 red（拒絕）與正確實作 green                                  |
| npm audit --audit-level=high      | 實際安裝依賴漏洞檢查                                                      |

E2E 固定 loopback 3101、`:memory:` SQLite、demo parser、停用外部推播，每個 case 新 browser context。測試不會使用真實帳本。手機尺寸模擬不是 iPhone Safari 實機。

狀態 property test 固定 seed=20261122，200 個隨機序列，每序列 1–60 個亂序／重送事件，驗證最大 revision 不被倒退。SQLite 兩連線排程測試同一檔案，競爭日唯一 claim；外部 send 為受控 stub。

## 真機待驗步驟（BLOCKED）

取得使用者另行批准的隔離 HTTPS 網址、VAPID 測試設定、iPhone 與通知操作。記錄 iOS／Safari 版本，從 Safari 加入主畫面，再由明確點擊訂閱，測試拒絕／允許／撤銷／失效訂閱，關閉 App 後接收，點擊回同站，午夜前後、時區變更與去重。正式提醒有效期與補發延遲先做產品決策。不得把 Web Push accepted、Chromium 或 stub 當作通知已送達。

## 規範持久化

獨立工作階段應指出 AGENTS.md、主要規範、依賴方向、verify、部署禁止與外部批准範圍，再執行非法依賴負例。讀檔成功與平台自動載入分開判定；無乾淨工作階段時 BLOCKED。

文件一致性另由 `npm run docs:check` 驗證。`npm run verify:record` 執行乾淨安裝、完整 verify、red/green、audit，保存原始日誌與時間／版本／exit code。
