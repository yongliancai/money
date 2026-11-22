# GitHub Pages 相容性與發布前交接

版本註記：以下為先前相容性改造紀錄。最新第一版改為純本機規則解析、Pages 強制不連 API、不提供背景推播，授權可推送分支／提交 PR；以 [V1-ACCEPTANCE](V1-ACCEPTANCE.md) 為準。下列選用後端 URL 說明僅適用保留的 integration 測試版，不適用第一版發布。

最終驗收（2026-11-22）：**PASS 本機發布準備**。乾淨 `npm ci`、完整 `npm run verify`、回歸 red/green、`npm audit --audit-level=high` 全部 exit 0；45 個程式測試、6 個原有 E2E、10 個 Pages E2E 全數成功，audit 0 漏洞。命令原始日誌、Node／npm 版本與執行時間見 [summary.json](evidence/pages/summary.json)。完整修改檔案清單見 [PAGES-CHANGES](PAGES-CHANGES.md)。

**正式發布狀態：尚未授權／未執行。** 前端產物與人工發布流程可供批准；公開網址、GitHub hosted CI 與 iPhone 實機驗收仍 BLOCKED。

授權僅限本機隔離分支 `work/github-pages-compat`：修改、測試、修復與發布準備。本次未推送、未啟用 Pages、未改外部權限、未部署。

## DISCOVER／AUDIT

已重新閱讀 AGENTS、主工程規範、需求、架構、ADR、原建置計畫 v1.2，以及實際程式、CI 與測試。使用者指定倉庫 [yongliancai/money](https://github.com/yongliancai/money)。GitHub connector 唯讀確認該公開倉庫存在、預設 main、查詢時 has_pages=false；本機沒有 remote。沒有使用其他專案倉庫。

原碼問題：Vite 未設 base；HTML／Manifest／Worker／通知返回網址使用根路徑；頁面預設呼叫同來源 `/api` 並嘗試匿名註冊；Push 按鈕在確認後端前要求權限。Worker 快取清理未依應用 scope 隔離；同步憑證未區分後端。

原始建置的子路徑負例已實際失敗：Manifest.start_url=`/`，期待 `/money/`，child exit 1，見 `evidence/pages/red-before.txt`。保留所有原有效測試與業務門檻。

## DESIGN／IMPLEMENT

- `config/site.json` 記錄實際倉庫；`resolveSiteBase` 從明確 override、GitHub repository、mode 推導 base。money → `/money/`；使用者首頁 repo → `/`；自訂網域可明確覆寫 `/`。不猜工作資料夾是遠端倉庫。
- HTML 靜態圖示／Manifest／首頁用 Vite BASE_URL；build 產出含 base 的 Manifest、完整 precache 與 build hash。Vite 依實際 outDir 寫產物，不固定回寫另一個目錄。
- pages mode 沒有 API URL 時完全不發 API 請求，也不建立匿名授權。手動 CRUD、搜尋、統計、JSON／CSV、匯入預覽照常。AI 不可用時停用按鈕並說明；不使用假解析代替成功。
- `api.js` 接明確 HTTPS base、限制 API 路徑、逾時、禁止 redirect、omit cookies、驗證 config；僅 loopback 測試允許 HTTP。前端變數採白名單，只接受 `VITE_API_BASE_URL`，其他 VITE 變數讓真實 build 失敗，防止整個 env object 帶出秘密。
- 後端 CORS 僅允許設定 origin 和明確 headers，不開 wildcard／cookies，也不取代 token 驗證。裝置權杖與撤銷狀態依後端 URL 分隔。
- Worker scope、圖示、通知點擊、shell fallback 與 cache prefix 都以 `/money/` 隔離，不接管其他 repo、不快取 API。fetch 改用指定 cacheName 的 match，避免舊請求把已刪快取重新開啟。Worker 不操作 IndexedDB，DB 名稱、版本與資料 schema 不變。
- PR CI 只有讀取權限、測試與預覽 artifact。發布範本位於 `.github/workflow-templates/pages-release.yml.disabled`，GitHub 不會執行；只在未來獨立批准後人工移入 workflows。保留 main、輸入確認、build dependency 與 protected environment 門檻，沒有 push／PR 自動部署。

## 本機建置與測試

```powershell
npm ci
npx playwright install chromium webkit
npm run verify
npm run build:pages
npm run preview:pages
```

預覽 `http://127.0.0.1:4173/money/`，產物 `dist-pages/`。Ctrl+C 停止預覽。`npm run test:pages` 會自行建立靜態站與 loopback API fixture，並於結束時關閉。該 fixture 的斷線控制僅在 scripts 測試伺服器，沒有加入正式 API。

```powershell
# 可選的公開設定，須在建置前設定；不含 API Key。
$env:VITE_API_BASE_URL='https://你的獨立後端/'
npm run build:pages
```

後端 `APP_ORIGIN` 須設為 `https://yongliancai.github.io`（origin 不含 `/money/`）。URL 若含 path prefix，後端需掛載對應 prefix；前端會接 `${API_BASE}api/...`。清空 URL 再建置即恢復本機模式。根網域／自訂網域才將 `PAGES_BASE_PATH` 設為 `/`；一般 money 專案留空即可。

localStorage／IndexedDB 依來源儲存，localhost 的帳本不會自動搬到 GitHub 網址，請先匯出 JSON，再由新網址預覽合併匯入。任何 Worker 更新不得清除帳本；移除網站資料仍可能遺失記帳，需定期備份。

## VERIFY 與阻礙

最終命令、版本、時間、exit code 見 `evidence/pages/summary.json`。初輪／修復紀錄見 `evidence/pages/repair-log.txt`。全部靜態檢查與 45 個程式測試、6 個原有 Chromium E2E、10 個 Pages E2E（Chromium／WebKit 各 5）已通過。

Pages E2E 覆蓋實際子路徑所有資源、Manifest／scope／Apple touch icon、無後端零 API 請求、CRUD／重載、消費日期月統計、JSON／CSV 下載、取消／恢復／合併去重、離線、Worker 更新保留帳本、保留鄰站快取、獨立後端真實 CORS／AI 確認閘門／實際斷線降級。

BLOCKED：公開 GitHub Pages 實站、GitHub hosted CI 的真實 run（本次未推送）、真實 iPhone Safari 開啟與主畫面安裝／離線、實際推播。WebKit 27.2＋iPhone 尺寸是自動化模擬，不能代替 iOS 裝置。真實 AI 模型／費用／憑證與正式提醒策略仍未定，未啟用。

## 發布設定與批准門檻

以下只是交接步驟，本次沒有執行：

1. 取得上傳此變更與正式發布的獨立批准，再將分支推送到指定 repo、經 PR／CI 驗證合併 main；不自動合併受保護分支。
2. 在 GitHub `Settings → Environments → github-pages` 設定可用的 required reviewers 與 main 分支限制；若帳號方案無此保護能力，需另訂人工發布門檻，不可宣稱已受保護。
3. 經批准後設定 `Settings → Pages → Source: GitHub Actions`。本次沒呼叫 configure-pages，也沒有自動啟用 Pages。
4. 經批准後將停用範本移到 `.github/workflows/pages-release.yml`；它只能 workflow_dispatch 手動觸發。CI 檢查此唯一發布檔必須保留人工確認／build／environment 契約；其他 CI 檔不得部署。
5. 一般專案不設 PAGES_BASE_PATH；有自訂網域時才明確設定。沒有後端時不設 `FRONTEND_API_BASE_URL`；後續若批准後端再設定此公開 Repository variable。絕不填入 AI 金鑰。
6. 再次核對批准、commit、main 與產物，手動執行 workflow，輸入 `PUBLISH money`，通過 environment review 才可 deploy。只有 deploy job 使用 `pages: write`／`id-token: write`，現行 PR CI 沒有這些權限。

預期網址 `https://yongliancai.github.io/money/`，目前尚未發布。程式具備前端靜態發布準備條件；正式發布仍等待批准與上述 BLOCKED 實站／實機驗收，不宣稱完整產品已上線。

官方依據：[Vite GitHub Pages base](https://vite.dev/guide/static-deploy.html#github-pages)、[GitHub 手動／自訂 Pages workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)、[WebKit Home Screen web app](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)。
