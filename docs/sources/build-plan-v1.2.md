---
title: "AI 智慧記帳助手｜AI Code Factory 工程環境建置計畫書"
subtitle: "v1.2 正式審核版（僅計畫，尚未授權建置）"
date: "2026 年 11 月 22 日"
lang: zh-TW
---

> **文件狀態：待批准（PLAN ONLY）**  
> 本文件為工程環境建置的完整計畫，不代表已建立程式碼、Git Repository、CI、測試、推播服務或正式部署。  
> **所有現有專案維持不變；本次只建立獨立計畫文件。** 未取得書面或明確訊息批准，不得開始建置；每次正式部署另行批准。

# 0. 文件控制與核准範圍

| 項目 | 說明 |
|---|---|
| 專案名稱 | AI 智慧記帳助手（AI Bookkeeping Assistant） |
| 工程方法 | AI Code Factory Guide v2.0（以 `START-HERE.md` 與 `modules/01–08` 為依據） |
| 文件版本 | v1.2，2026-11-22 |
| 專案生命週期 | Greenfield：已確認尚無任何業務程式碼 |
| 本版用途 | 審核工程環境、測試策略、Codex 工作方式與風險治理 |
| 已確認 | 核心需求及第一輪功能審查決策；專案尚未建立 |
| 尚待確認 | 第二輪系統架構提議、提醒新鮮度細節、部署位置、模型、固定分類等 |
| 本次授權 | 閱讀、分析、規劃與生成本計畫文件 |
| 本次未授權 | 建立或修改專案、提交 Git、執行 Codex 建置、操作正式資料、正式部署 |

## 0.1 執行摘要

本計畫的目標不是「一次交由 AI 把整個記帳 App 寫完」，而是先建立一個**可重現、可測試、可檢查、可回滾、可交接**的工程環境，讓 Codex 在後續逐項開發功能時有清楚的輸入、可執行品質門檻及真實證據。優先保護三項高風險行為：**帳本正確性、AI 解析後的人工確認、每日提醒狀態一致性**。

建議以 **Phase 0～3** 為首批「工程環境」候選授權範圍；Phase 4 起含真實推播可行性及功能實作，須另行確認詳細範圍。任何正式部署均非此計畫的自動延伸。

## 0.2 成功定義

1. 新工作階段的開發者／Codex 可找到架構、需求、品質規範與執行指令，無需依賴本段對話。
2. 最小前後端應用可在隔離環境依文件重現啟動；工具、執行環境與套件版本可追溯。
3. 至少一項**真實、可執行的負例防護**會攔截違規；正例通過。
4. 記帳資料、AI 輸出及提醒狀態具備可執行測試契約，核心回歸有 red/green 證據。
5. CI 能在 PR 上執行明確檢查，不依賴人工口頭宣稱「已測試」。
6. 能清楚區分 PASS／FAIL／BLOCKED／NOT_CONFIGURED／NOT_APPLICABLE；缺乏證據時不宣稱 PASS。
7. 建置與部署有不同的批准閘門；沒有部署批准就不存在自動上線路徑。

# 1. 唯讀盤點報告（對應手冊模板 01）

## 1.1 現況及證據

| 盤點項目 | 目前狀態 | 證據及限制 |
|---|---|---|
| 需求及功能決策 | 已有規劃 | 本對話已確認核心需求與第一輪功能決策；不是已測試功能 |
| 原始碼 | **不存在** | 使用者明確確認專案尚未建立程式碼 |
| Git Repository | 未建立／未指定 | 未提供本專案倉庫；不得套用其他專案 Repository |
| 前端／後端版本 | 未配置 | Vite、原生 JS、Node、Express 為候選架構 |
| Lint、格式、型別檢查 | NOT_CONFIGURED | 不存在可執行程式與設定 |
| 單元、整合、端到端測試 | NOT_CONFIGURED | 尚無實際測試案例或結果 |
| CI、分支保護、發版 | NOT_CONFIGURED | 尚無此專案工作流程 |
| iPhone 推播 | BLOCKED | 缺少實際 HTTPS 應用、裝置與訂閱測試 |
| 正式環境及密鑰 | 未指定 | 不得憑其他專案既有 VPS 推定可直接使用 |
| 技術債及既有 Bug | NOT_APPLICABLE | 沒有舊程式；僅有已辨識的設計風險 |

**平台能力分級：** ChatGPT 目前可讀取文件、規劃、在工作容器產出獨立檔案；存在 GitHub 連線及隔離執行能力，但尚未確認本專案的 Codex 執行工作區、平台規則自動載入與實機瀏覽器權限。ChatGPT 記憶不是程式庫工程規範的權威來源；未經實測不得宣稱 `AGENTS.md` 或 Skills 已自動生效。

## 1.2 核心功能基準（已確認）

| 模組 | 確認需求 |
|---|---|
| 使用者／載體 | 大學生、行動優先、iPhone PWA、免登入、單裝置 |
| AI 解析 | 單筆／多筆自然語言；擷取品項、金額、消費日期、分類；可修改預覽 |
| 儲存閘門 | **使用者明確確認後**才寫入本機帳本；AI 絕不直接儲存或自行計算統計 |
| 失敗替代 | AI 失敗或離線時保留手動記帳，不阻斷核心功能 |
| 資料來源 | IndexedDB 儲存完整帳本；後端不儲存完整消費明細 |
| 日期 | 統計依 `expenseDate`；`createdAt` 代表新增操作時間且不可隨意更動 |
| 今日完成 | 今日新建／儲存有效紀錄視為完成；若今日新建的紀錄全刪則轉未完成；編輯舊紀錄不算 |
| 提醒 | 可設本地提醒時間；符合條件才發送 Web Push；每日最多一則（含補發） |
| 離線政策 | 狀態未知／不可信時寧可漏發，盡量避免誤發；不可保證零誤發 |
| 跨日補發 | 不補發前一天通知 |
| 匯出／匯入 | JSON、CSV 匯出；JSON 合併匯入，依紀錄 ID 去重、驗證、預覽與確認 |
| 匯入與提醒 | 備份匯入不視為今天新增記帳；可能恢復已刪紀錄，需預覽揭露 |
| 非目標 | 跨裝置同步、登入、OCR、語音、銀行串接、預算、理財建議 |

## 1.3 尚未完成正式決策之事項

第二輪架構審查曾提出 `deviceId＋deviceToken`、`eventId＋revision`、SQLite 發送唯一限制、JSON 版本化與通知狀態新鮮度。這些是**建議設計，不應偽稱已得到逐項正式核准**。本文件先以候選方案保留，列入本計畫的批准附表。

# 2. 設計風險、證據與優先度

風險以影響度、可能性、可偵測性、可逆性判斷；因尚無程式碼，以下均為**依需求推導的風險**，不是已證實的程式 Bug。

| ID／級別 | 設計風險及可觀察情境 | 建議措施 | 驗收證據 |
|---|---|---|---|
| R01／P0 | AI 把未經確認的解析結果寫入帳本 | 儲存 API 僅接受確認後動作、契約與 E2E | 未確認時資料筆數不變；確認後僅新增一次 |
| R02／P0 | 輸入金額、日期或多筆解析錯誤 | Schema、值域驗證、固定測試集 | 無效輸出被拒；部分成功顯示未解析文字 |
| R03／P0 | IndexedDB 寫入或同步中斷 | 交易及 outbox，同步可重試 | 斷網後帳本仍正確；重連不重複 |
| R04／P0 | 事件亂序使提醒完成狀態倒退 | eventId＋revision、伺服器版本控制 | 舊 revision 不覆蓋新狀態 |
| R05／P0 | 排程競爭造成同日多則提醒 | 日唯一鍵、發送權 claim、冪等測試 | 每裝置／當地日期發送嘗試上限符合規則 |
| R06／P0 | 舊備份匯入將已刪記錄恢復 | 預覽、明確提示、使用者確認 | 匯入前可見恢復清單；拒絕則不寫入 |
| R07／P0 | 匯入資料誤觸發今天已記帳 | 將建立事件與匯入來源分離 | 匯入後當日完成狀態不改變 |
| R08／P0 | 匿名裝置被冒用、推播端點遭濫用 | 高強度授權憑證、伺服端雜湊、驗證與速率限制 | 未授權請求被拒、跨裝置隔離 |
| R09／P1 | 關閉 PWA 後無法背景推播 | 早期 iPhone HTTPS 實機 PoC | Home Screen PWA 於關閉頁面後收測試推播 |
| R10／P1 | Codex 不知道規範或未實際跑檢查 | 版本化單一規範、CI、獨立會話驗收 | 新工作階段能找到規範且執行測試 |
| R11／P1 | 機密寫入 Git／日誌 | `.gitignore`、secret scan、日誌最小化 | 測試金鑰示例觸發阻擋 |
| R12／P1 | 同步保守策略造成提醒幾乎不發 | 定義狀態有效期、可觀測指標及產品說明 | 報表能區分送出／略過／未知，不宣稱保證送達 |

# 3. 技術方案與不採用項目

## 3.1 建議選型（待建置批准）

| 層級 | 候選選型 | 選擇理由／取捨 |
|---|---|---|
| 前端 | Vite + 原生 JavaScript（ES Modules） | 規模適中、易展示、低框架成本；需自行維護狀態邊界 |
| PWA | Web App Manifest + Service Worker | iPhone 主畫面安裝與 Push 訂閱基礎；需 HTTPS／實機 |
| 本機資料庫 | IndexedDB | 帳本離線可用；瀏覽器清除資料時需依賴備份 |
| 前端 DB 封裝 | 最小 Repository/transaction layer（可評估 `idb`） | 限制資料庫寫入入口、降低重複邏輯 |
| 後端 | Node.js LTS + Express | AI 代理、裝置管理及推播排程，部署成本可控 |
| 提醒資料 | SQLite + schema migration | 單裝置／小型專題足夠；需交易及唯一鍵 |
| AI 輸出 | Schema-constrained structured JSON + server validation | 不信任模型輸出；避免 AI 直接改資料 |
| 推播 | Web Push（VAPID） | 標準推播流程；結果不能保證使用者實際收到 |
| 測試 | Node test runner 或 Vitest（定案前實測） | 選最少工具滿足測試需求；勿混用多套相近框架 |
| UI E2E | Playwright（少量核心流程） | 覆蓋記帳操作與離線切換；iPhone Push 需實機驗證 |
| 檢查 | ESLint + 格式檢查 + JSON Schema/契約驗證 | 易於負例驗證、回饋快速 |
| CI | GitHub Actions（僅 CI，不自動部署） | 每 PR 提供執行證據；避免憑直覺合併 |

**版本政策：** 批准建置當天，以官方支援的穩定 Node.js LTS、Vite 及套件版本建立 lockfile，將版本紀錄於 README 與 CI。不要在尚未建立程式碼時硬寫不能驗證的精確依賴版本。

## 3.2 此階段不導入

不導入微服務、容器編排、大型前端狀態框架、全面 TypeScript 遷移、TLA+、Lean、多 Agent 自動合併或自動部署。若提醒並發測試出現難以界定的反例，再評估模型檢查；不能把形式化工具當作建置儀式。

# 4. 目標架構、資料流與責任邊界

## 4.1 模組邊界

```text
iPhone Home Screen PWA / mobile web
  ├─ UI + confirmation gate
  ├─ Expense application service
  ├─ IndexedDB (expenses, settings, status, outbox)
  ├─ Backup service (JSON/CSV)
  ├─ Service Worker / Push subscription
  └─ API client
          │ HTTPS
          ▼
Node.js / Express API
  ├─ AI parsing proxy → model provider
  ├─ Anonymous device authorization
  ├─ Reminder settings / completion sync
  ├─ Push subscription management
  ├─ Scheduler / daily send claim
  └─ SQLite (minimal reminder metadata, logs)
          │
          ▼
      Web Push service → device notification
```

**不變量 A：** `client` 不直接呼叫模型商秘密 API；機密留在後端。  
**不變量 B：** 後端不持有完整帳本；後端存取不到的消費項目不得由排程憑空推論。  
**不變量 C：** AI parse → Schema 驗證 → editable preview → explicit confirm → IndexedDB transaction，順序不得跳過。  
**不變量 D：** 月統計依 `expenseDate`；提醒完成條件由建立／刪除事件或可信本機狀態產生，不使用備份匯入紀錄推算。  
**不變量 E：** 每裝置、每當地日期最多一個正式提醒發送名額（常規與補發共用）；實際送達不保證。  
**不變量 F：** 不能將同步成功等同通知已送達。

## 4.2 主要使用流程

1. 使用者輸入「昨天午餐 120、今天咖啡 55」或手動表單。
2. AI 服務只回傳候選紀錄；無效欄位及未解析部分原文需顯示。
3. 使用者編輯並確認；應用服務驗證後以交易寫入 IndexedDB。
4. 若這是當天新建的有效紀錄，更新本機每日完成狀態，將狀態事件加入 outbox。
5. 線上時經裝置授權同步事件；離線時保留 outbox，不影響帳本使用。
6. 排程僅以後端可驗證的狀態及發送限制評估推播；不從 AI、CSV 或匯入筆數推論完成。

## 4.3 資料契約草案

**IndexedDB｜`expenses`**：`id`、`item`、`amount`（正整數 TWD；範圍待定）、`category`、`expenseDate`（本地 YYYY-MM-DD）、`createdAt`（ISO 瞬時時間）、`updatedAt`、`origin`（`manual`／`ai_confirmed`／`import`）、`schemaVersion`。同時需有 `settings`、`dailyActivity`、`syncOutbox`。`createdAt` 不應在一般編輯時覆寫；資料還原保留來源時間。匯入紀錄即使 `createdAt` 為今日也不能計入今日完成。

**SQLite｜候選表**：`devices`、`push_subscriptions`、`reminder_settings`、`daily_statuses`、`processed_events`、`notification_claims`／`notification_logs`。不存完整 `expenses`。權杖雜湊、訂閱端點保護、索引及資料保留政策須在建置前定義。

**API｜候選契約**：`POST /api/ai/parse`；`POST /api/devices/register`；`PUT /api/reminders/settings`；`POST /api/push/subscribe`；`DELETE /api/push/subscribe`；`POST /api/daily-status/sync`；`POST /api/push/test`（僅診斷／受限）、`GET /api/health`。對裝置相關路由一律驗證授權，AI 解析路由限制流量和大小。端點為**建議清單，非已實作 API**。

# 5. 最關鍵的技術決策：智慧提醒的一致性

## 5.1 當日完成規則（已確認）

- 今日新建／確認儲存有效記帳，無論 `expenseDate` 是今天或過去，都可算作今日完成。
- 今日新建的有效記帳全部刪除時，今日轉為未完成；編輯舊紀錄不算新增。
- JSON 匯入不算今日完成；不能只用 `createdAt == today` 判斷，需保存操作來源或每日活動證據。
- 每日最多發一則常規或補發推播；前一天不補發；取消訂閱／權限關閉則不發。

## 5.2 狀態同步候選演算法（未核准細節）

1. 客戶端在單一 IndexedDB transaction 中儲存帳本變更與對應 outbox 事件。
2. 每個事件包含 `eventId`、`deviceId`、`localDate`、`revision`、`completed`、`occurredAt`、`origin`；`revision` 在每裝置／日期內單調遞增。
3. 後端先認證，再驗證 schema；相同 `eventId` 冪等回覆；較舊 revision 不得蓋過較新 revision。
4. 排程以裝置時區計算當地日期，檢查訂閱有效、提醒開啟、當日狀態、新鮮度與發送唯一鍵。
5. 用 SQLite 原子 claim 限制當日一次發送嘗試；對外推播結果未知時不盲目重試。
6. 客戶端重連後同步 outbox；伺服端明確回覆已接收版本，客戶端才清除相應佇列項目。

## 5.3 保守提醒政策的不可避免限制（必讀）

使用者已選擇「狀態未知時優先避免誤提醒，允許漏提醒」。**後端若沒有收到使用者今天的任何新狀態，不能證明他還沒記帳，也無法得知裝置是否離線新增。** 因此：

- 若當天完全沒有開啟 App 或沒有可信同步，採嚴格保守策略可能**整天不提醒**，削弱「容易忘記記帳」這個產品目標。
- 即使某次同步剛回報「未完成」，下一秒也可能離線新增；**單靠有限有效期無法保證零誤提醒**。
- 建議先以**最近可信狀態＋可設定新鮮度上限**設計候選策略，並在介面揭露提醒是「盡力而為」；實際有效期（例如分鐘數）需在實機測試後另行批准。
- 正式採用前，必須針對「完全沒開 App 的一天」及「離線新增但後端仍為未完成」兩個情境做決策。**不能把這個核心產品矛盾藏在技術實作細節中。**

## 5.4 日期、時區及補發

提醒以裝置設定的 IANA 時區及當地日曆日期為準。日期資料不可用 UTC 日期直接截斷當作 `expenseDate`。跨日補發永久禁止；時區變更、夏令時間、日期快速切換需有測試案例。補發延遲去抖（debounce）及狀態有效期尚未核准，不先寫入不可修改的硬限制。

# 6. AI Code Factory 工程規範與防護設計

## 6.1 單一規範來源與平台適配

候選主規範 `docs/PROJECT-ENGINEERING.md`；Codex 入口 `AGENTS.md` 僅連結主規範、架構、需求、測試及部署批准政策。未來若使用其他 AI 平台，可增設簡短適配檔，不複製成多份相互衝突的規範。ChatGPT Memory 只可保存非敏感偏好，不得作為測試、批准或安全規則的唯一依據。

## 6.2 候選目錄與依賴

```text
ai-bookkeeping-assistant/
  AGENTS.md
  README.md
  package.json                 # workspace scripts；實際方案待定
  package-lock.json            # 若採 npm
  .env.example
  .github/workflows/ci.yml
  client/src/{pages,components,features,services,storage,utils}/
  client/public/{manifest.webmanifest,sw.js}
  server/src/{routes,services,middleware,jobs,db}/
  shared/schemas/
  tests/{e2e,fixtures,contracts}/
  docs/{PROJECT-ENGINEERING,REQUIREMENTS,ARCHITECTURE,FEATURE-MAP,TESTING,KNOWN-ISSUES}.md
  docs/DECISIONS/
```

候選依賴方向：UI → application service → storage adapter；API route → service → SQLite adapter；`shared/schemas` 可被兩側引用，但 `client` **不得 import** `server` 模組、模型 SDK 或伺服端密鑰。Service Worker 僅負責其作用域內的推播與快取，不得自行成為帳本的第二個寫入來源。

## 6.3 根因到防護（機器可判定才機器化）

| 失敗類型 | 實作防護 | 正例／負例證明 |
|---|---|---|
| client 直接載入 server 秘密模組 | ESLint import rule 或輕量依賴檢查 | 非法 import FAIL；shared schema PASS |
| AI 回傳不合法金額／日期 | Schema 與值域驗證 | 負數、空字串 FAIL；有效多筆 PASS |
| 未確認前儲存 | 業務 API／整合測試 | 跳過確認 FAIL；確認一次 PASS |
| 同步重送／舊版本覆蓋 | 冪等與狀態機測試 | 亂序、重送測試必須通過 |
| 每日重複推播 | 唯一 constraint＋競爭測試 | 兩個排程同時觸發仍只 claim 一次 |
| JSON 不合法／重複 | 匯入預覽及驗證測試 | 不合法拒絕；相同 ID 跳過 |
| AI 語意解析品質 | 固定評測集＋人工審核 | 報告整筆正確率，不只 schema 通過率 |

不因範例而全面禁止程式註解、timer、hook 或特定語法；不靠增加提示詞替代可執行防護。

# 7. 測試、CI 與品質門檻

## 7.1 分層測試策略

| 測試層 | 內容 | 執行時機 |
|---|---|---|
| 靜態檢查 | ESLint、格式、secret scan、依賴邊界 | 每次 PR |
| 單元 | 金額、日期、分類、統計、完成狀態純邏輯 | 每次 PR |
| 契約 | AI JSON、API request/response、備份版本 | 每次 PR |
| 整合 | IndexedDB CRUD＋outbox；SQLite 原子 claim；API 授權 | 每次 PR／重要變更 |
| 屬性／狀態機 | 重送、亂序、跨日、重試、不變量 | 提醒模組 PR、排程變更 |
| E2E | 手動記帳與 AI 預覽確認、歷史、匯入、離線 | 核心流程改動及合併前 |
| 真機 | iPhone Home Screen PWA、權限、關閉網頁後推播 | 推播里程碑／發版前 |
| AI 評測 | 多筆、模糊語句、相對日期、不完整資料及對抗輸入 | 改模型、Prompt 或 schema 時 |

## 7.2 必測案例（最小集合）

**記帳：** 新增單筆／多筆、取消確認、快速連按確認、修改舊記錄、刪除全部今日新建、跨月統計、昨天消費今日建立、相對日期模糊要求確認。  
**AI：** 合法 JSON、部分解析、無效金額、缺失欄位、錯日期、模型逾時、API key 缺失、異常文字、手動 fallback。  
**備份：** 正常 JSON/CSV 匯出、格式版號、無效檔拒絕、重複 ID、已刪除的舊紀錄預覽、取消匯入、匯入不觸發當日完成。  
**通知：** 完成不提醒、未完成且可信才候選提醒、狀態未知略過、一天一次、補發跨日不送、權限取消、訂閱過期、兩個排程競爭、時區改變、離線事件亂序。  
**資安：** 假 deviceId、無 token、已撤銷 token、跨裝置操作、AI 請求限速、推播訂閱惡意端點、敏感資料不進 log。

## 7.3 建議驗證命令（計畫用，占位非已存在）

```bash
npm ci
npm run lint
npm run format:check
npm run test:unit
npm run test:integration
npm run test:contracts
npm run test:e2e
npm run build
```

正式命令以建置後 `package.json` 為準；**目前不能執行、也沒有 PASS 結果**。CI 至少須在受保護分支的 PR 上執行快速檢查，E2E 可採限縮範圍；不建立任何自動部署 job。

## 7.4 度量與準則

- **帳本：** 已指定的核心不變量測試全部通過（不以泛稱「100% 無 Bug」取代）。
- **CI：** 必要檢查全部 PASS 才允許提出合併；必要檢查缺席屬 NOT_CONFIGURED／BLOCKED，不能當綠燈。
- **AI：** 以固定、已標註案例測量完整解析正確率，先建立基準；先前討論的「≥90%」屬候選目標，需在真實評測與課程要求下定案。
- **提醒：** 記錄排程評估數、因完成略過、因狀態過期略過、發送嘗試及推播服務接受數；不能把服務接受率當實際送達率。
- **安全：** 無已知高風險缺陷未處理且所有權限負例通過，才可申請部署審查。

# 8. 分階段建置工作分解（對應手冊模板 02）

以下均為**提案**，非已授權的工作。Phase 0 是批准後開始的準備工作，不改任何既有專案。

## Phase 0｜開發前條件與工程決策凍結

**前置條件：** 明確批准；確定新 Repository 命名與管理者；確認開發端、Node 套件管理器與隔離工作區；確認第一批僅工程環境。  
**工作：** 完成 ADR 清單；建立「已核准需求 vs 候選技術」對照；列出推播可信度問題與未定選項。  
**交付：** `docs/REQUIREMENTS.md`、`docs/DECISIONS/` 初版、風險登錄表。  
**驗收：** 所有 P0 決策有明確處置（已核准／延後但有隔離措施／阻擋開發）；沒有未授權的服務操作。  
**回滾：** 若尚無實作，以審核版文件退回，不對正式環境產生影響。

## Phase 1｜可重現專案骨架與 AI 規範入口

**問題證據：** 沒有程式、目錄、依賴鎖定、規範入口。  
**工作：** 建立新 Git Repository 與隔離分支、client/server/shared 骨架、README、`AGENTS.md`、主規範、lockfile、環境變數範本及健康檢查。  
**交付：** 最小可啟動前端／後端，模組邊界文件。  
**驗收：** 乾淨環境 `npm ci`、啟動、健康檢查均有實際 PASS；沒有真實密鑰提交。  
**回滾：** 還原本階段獨立分支或提交；不動正式環境。

## Phase 2｜最低有效品質防護

**問題證據：** 無 Lint、契約檢查及 CI。  
**工作：** 加入 ESLint、格式檢查、secret scan、Schema、最小依賴規則、GitHub Actions CI；僅選具價值的規則。  
**交付：** 可執行 `lint`、`format:check`、`test:contracts`、`build` 與 PR CI。  
**驗收：** 每項關鍵規則有隔離負例 FAIL、正例 PASS，PR CI 顯示真實結果。  
**回滾：** 以獨立提交移除或回退錯誤規則；禁止為綠燈偷偷降低門檻。

## Phase 3｜核心資料與狀態測試基礎

**問題證據：** AI 儲存閘門、備份及提醒規則還沒有可執行驗證。  
**工作：** 建立測試 runner、fixtures、日期／金額純函式測試、IndexedDB transaction 測試基礎、API 契約、提醒狀態圖及 property-based 測試。僅建立必要參考實作以證明測試可運作，不提前完成所有業務畫面。  
**交付：** 測試庫、場景矩陣、red/green 證據、開發任務 DoD。  
**驗收：** 至少一個真實回歸案例在錯誤樣本 FAIL、修復樣本 PASS；提醒重送／亂序與匯入不算今日完成的測試可執行。  
**回滾：** 回退隔離測試分支；保留證據並重新設計過度嚴格的規則。

> **建議第一個獨立批准閘門：** Phase 0～3 完成後才審核是否展開更多工作。此批准與正式部署無關。

## Phase 4｜iPhone 推播技術可行性與安全驗證（另核准）

**工作：** 建立隔離 HTTPS 測試站、Home Screen PWA、手動按鈕訂閱、VAPID、最小推播端點與訂閱撤銷；以真 iPhone 驗證關閉頁面後通知。同步檢查 token 授權、推播端點風險與無效訂閱清除。  
**驗收：** 在支援的 iPhone 與系統條件下，實際收到測試推播且點擊可開啟指定頁；保留裝置、作業系統及測試證據；不將推播服務回應視作實際送達。  
**停止條件：** 無可用實機／HTTPS／測試授權時標記 BLOCKED；不得假稱完成。

## Phase 5｜產品功能分批開發（另核准）

**批次 A：** 手動記帳、IndexedDB CRUD、月統計、今日完成判斷。  
**批次 B：** AI 解析、可編輯預覽、明確確認、錯誤 fallback、評測集。  
**批次 C：** JSON/CSV 匯出、JSON 合併匯入及預覽。  
**批次 D：** 匿名裝置、同步 outbox、排程與提醒、取消訂閱。  
**批次 E：** PWA 離線行為、手機 UI 與整合 E2E。  
**每批 DoD：** 明確驗收情境、程式與測試、負例與回歸、文件更新、PR 審查、未部署說明。

## Phase 6｜獨立驗收與發布審查（另核准）

以全新環境重新執行 CI、核心 E2E、API 權限及實機測試；進行資料備份還原演練、效能與安全檢查、部署及回滾演練。提出 Go／No-Go 報告。**正式上線必須在此後再提出單獨部署申請並取得批准。**

# 9. Codex 任務拆分與工作契約

每個任務的固定輸入：目標、來源規格、允許修改路徑、禁止變更、正反例、驗證命令、成功門檻、回滾方式、需請示的高風險操作。每次僅處理一個明確範圍；不得因測試失敗自行修改規格或刪除測試。

| 任務 ID | 建議順序 | 任務 | 必需產出／門檻 |
|---|---|---|---|
| CF-00 | P0 | 新專案基線與規範 | Repo／README／AGENTS／requirements／ADR |
| CF-01 | P1 | client/server/shared 骨架 | 乾淨安裝、啟動及 health PASS |
| CF-02 | P2 | Lint／格式／安全檢查 | 正例、負例及執行證據 |
| CF-03 | P2 | CI 與分支品質門檻 | PR CI 可重現、無自動部署 |
| CF-04 | P3 | Schema 與 API 契約 | 不合法 AI/提醒資料被攔截 |
| CF-05 | P3 | 帳本核心測試 | 金額、日期、createdAt、操作來源 |
| CF-06 | P3 | 提醒狀態模型及測試 | 冪等、亂序、一次／日、跨日 |
| CF-07 | P3 | 備份匯入契約測試 | 去重、預覽、匯入不算完成 |
| CF-08 | P4 | iPhone Push PoC | 關閉 App 推播真機證據 |
| CF-09 | P5 | 完整產品功能迭代 | 每批 DoD 與回歸測試 |
| CF-10 | P6 | 獨立驗收與交接 | 完整證據報告、風險及 Go/No-Go |

**自主修復邊界：** 在已批准隔離分支內可修復非破壞性問題；發現規格互斥、真正個資或密鑰、正式資料、擴權與破壞性變更，必須停止對應步驟並請示。提交 PR 不等於同意合併；合併也不等於同意部署。

# 10. 工程文件與跨工作階段持久化

| 文件 | 主要責任 |
|---|---|
| `AGENTS.md` | Codex 專案入口，只指向權威文件及驗證命令 |
| `README.md` | 最短安裝／啟動／測試步驟及環境條件 |
| `docs/PROJECT-ENGINEERING.md` | 唯一主工程規範，含權限邊界與品質要求 |
| `docs/REQUIREMENTS.md` | 已核准需求、不包含功能及待決事項 |
| `docs/ARCHITECTURE.md` | 依賴方向、資料流、安全與服務責任 |
| `docs/FEATURE-MAP.md` | 功能 → 入口 → 狀態 → 測試案例對應 |
| `docs/TESTING.md` | 真正存在的測試命令與驗證矩陣 |
| `docs/KNOWN-ISSUES.md` | 已知 Bug、重現、根因、修復、回歸測試 |
| `docs/DECISIONS/` | ADR：方案、權衡、批准、變更紀錄 |
| `docs/VERIFICATION.md` | PASS／FAIL／BLOCKED 證據與未測項 |

持久化驗收：以**全新且不帶原對話**的 Codex 工作階段載入同一倉庫，要求指出部署禁止事項、主要檢查命令與模組依賴；再試驗一個隔離違規案例。無法啟動獨立工作階段時標記 BLOCKED，不宣稱跨對話記憶可靠。

# 11. 安全、隱私、測試資料及可逆性

1. **資料最小化：** SQLite 不保存全帳本；模型僅接收完成解析所需的文字，避免不必要的個人資訊。AI 請求內容不得預設進入持久日誌。
2. **密鑰管理：** 模型 API Key、VAPID private key 只在伺服端環境變數或秘密管理；`.env.example` 不含真實密鑰。
3. **裝置授權：** 候選 `deviceId＋deviceToken`，後端雜湊、可撤銷，API 權限驗證及速率限制。
4. **資料寫入：** IndexedDB 使用交易；備份前對當前資料與版本做預覽確認；不覆蓋既有不同 ID 資料。
5. **測試隔離：** 只用人工產生 fixtures，不直接複製正式帳本到 CI；測試資料庫與正式資料庫完全分離。
6. **復原：** JSON 備份是單裝置資料的重要保護措施，但不等於自動雲端同步；明確提醒瀏覽器資料可能被清除。
7. **部署安全：** 需要明確的部署檢查、回滾腳本及批准紀錄後才能進正式環境；本次不執行。

# 12. 最終驗收清單（對應手冊模板 03）

本表在目前階段是**未來驗收規格**；因專案尚未建立，沒有任何運行結果可標成 PASS。

| 驗收項目 | 預期行為／證據 | 目前狀態 |
|---|---|---|
| 專案規範入口 | 新 Codex 可找到權威規範及批准規則 | NOT_CONFIGURED |
| 乾淨環境安裝 | 固定 lockfile、執行成功日誌 | NOT_CONFIGURED |
| 前後端可啟動 | health API 與畫面可用 | NOT_CONFIGURED |
| Lint 負例 | 違規依賴被工具攔截 | NOT_CONFIGURED |
| Lint 正例 | 合法引用與程式通過 | NOT_CONFIGURED |
| AI Schema | 違規輸入被拒、合法解析通過 | NOT_CONFIGURED |
| 儲存確認閘門 | 未確認不寫入，確認一次才新增 | NOT_CONFIGURED |
| 日期與金額 | 跨月、相對日期、不合法值處理正確 | NOT_CONFIGURED |
| 匯入與恢復 | 預覽、合併、去重、取消正確 | NOT_CONFIGURED |
| 完成狀態 | 今天新增／刪除／匯入規則一致 | NOT_CONFIGURED |
| 同步亂序與離線 | 舊版本不覆蓋新版本、outbox 可回復 | NOT_CONFIGURED |
| 推播防重複 | 每裝置每天最多一筆發送 claim | NOT_CONFIGURED |
| 跨日與時區 | 前一天不補發、當地日曆正確 | NOT_CONFIGURED |
| 身分與安全 | 無授權無法修改其他裝置設定 | NOT_CONFIGURED |
| CI | PR 自動執行必要檢查 | NOT_CONFIGURED |
| iPhone 推播真機 | Home Screen PWA 關閉後收到測試推播 | BLOCKED |
| 反例回歸 red/green | 錯誤樣本 FAIL、修正樣本 PASS | NOT_CONFIGURED |
| 規範持久化 | 全新工作階段找得到規範與測試 | BLOCKED |
| 回滾演練 | 確認可回復隔離環境變更 | NOT_CONFIGURED |
| 正式部署批准 | 每次部署前都有獨立明確授權 | 未授權／不執行 |

結果必須記錄命令、版本、執行環境、日期、exit code、log 與必要截圖。`BLOCKED` 及 `NOT_CONFIGURED` 絕不等於 `PASS`。

# 13. 開發批准表、未決決策與變更治理

## 13.1 建議首批核准的範圍（供未來選擇，尚未批准）

**允許候選範圍：** 在新 Repository 與隔離開發環境建置 Phase 0–3，包括專案骨架、工程文件、靜態防護、測試 framework、CI、最小示範或 reference implementation、隔離測試及非破壞性修復。  
**明確排除：** 完整產品功能、真實使用者帳本匯入、正式資料庫改動、伺服器部署、正式推播、任何自動合併與自動發布。  
**授權形式：** 需使用者再次明確表示「批准 Phase 0–3 建置」；本文件本身不是授權。

## 13.2 仍需獨立定案之 ADR

| 決策 ID | 問題 | 建議預設 | 為何未直接定案 |
|---|---|---|---|
| ADR-01 | 新 GitHub Repository 名稱與擁有者 | `ai-bookkeeping-assistant` | 使用者尚未指定 |
| ADR-02 | Package manager／Node LTS | npm workspaces＋支援的 Node LTS | 建置環境尚未確認 |
| ADR-03 | API 裝置授權 | `deviceId＋deviceToken` | 第二輪提議尚未逐項核准 |
| ADR-04 | 狀態事件規則 | `eventId＋revision` | 需定義版本競爭及重設情境 |
| ADR-05 | 狀態有效期 | 保守略過過期資料 | **可能造成整天未開 App 時完全不提醒** |
| ADR-06 | 補發去抖延遲 | 短延遲、跨日不送 | 具體秒數待實測 |
| ADR-07 | AI 模型與費用上限 | 選可回傳結構化 JSON 的模型 | 金額、配額與隱私需求待確認 |
| ADR-08 | 固定分類與值域 | 固定分類、正整數 TWD | 列表、上限及退費情境未定 |
| ADR-09 | 測試／正式網域與 VPS | 新隔離測試環境 | 未授權使用任何既有主機 |
| ADR-10 | 參考實作／測試框架 | 選最少且可驗證者 | 建置前不能硬指定過量工具 |

## 13.3 單次變更證據回報模板

- 任務 ID、授權範圍、分支與提交：＿＿＿＿
- 實際修改檔案／未修改事項：＿＿＿＿
- 根因與選擇防護的理由：＿＿＿＿
- 執行指令、環境、版本、日誌、exit code：＿＿＿＿
- 正例／負例／red-green 結果：＿＿＿＿
- PASS／FAIL／BLOCKED／NOT_CONFIGURED／NOT_APPLICABLE：＿＿＿＿
- 遺留風險、回滾方式、需要批准的事項：＿＿＿＿
- 正式部署：**未執行；待另外批准**。

# 14. 建置前結論與批准閘門

**結論：** 這是一個全新專題，第一步應建立「讓正確改動容易、錯誤可被攔截」的工程環境，而不是先讓 Codex 大量生成程式。首批 Phase 0–3 先驗收可重現建置、有效防護及核心測試，再評估 iPhone Push PoC 與正式功能開發。

**關鍵阻礙：** 尚無程式碼是正常的 Greenfield 狀態；真正需要先解決的是「提醒狀態保守策略與『忘記記帳就提醒』目標間的張力」，以及第二輪技術決策未全部批准。這些問題應公開列入 ADR，不可假裝工具自動消除。

**批准紀錄（待使用者填寫）：**

| 決策 | 結果／日期 |
|---|---|
| 目前計畫審核 | 已確認方向，尚未授權建置 |
| Phase 0–3 首批工程建置 | **未批准** |
| Phase 4 iPhone 推播 PoC | **未批准** |
| Phase 5 完整功能開發 | **未批准** |
| Phase 6 發布審查 | **未批准** |
| 正式部署 | **每次另行批准** |

---

# 附錄 A｜依據與出處

1. 使用者提供：《AI Code Factory Guide v2.0｜單檔閱讀版》，`START-HERE.md`、`modules/01–08`、`templates/01-audit-report.md`、`templates/02-adoption-plan.md`、`templates/03-acceptance-checklist.md` 等。文件自述為審查草案，其案例不是必須安裝的固定工具。
2. 本對話已確認《AI 智慧記帳助手》核心需求、第一輪功能決策及「專案尚未建立程式碼」；第二輪架構建議仍待定案。
3. Apple Developer：*Sending web push notifications in web apps and browsers*，https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers 。Home Screen Web App 的 iOS Web Push 條件須在實機確認。
4. WebKit：*Web Push for Web Apps on iOS and iPadOS*，https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/ 。推播授權應由直接使用者操作觸發。
5. Vite 官方文件：*Getting Started*，https://vite.dev/guide/ 。Node.js 與工具版本以未來建置當日相容性為準。

# 附錄 B｜不變量與驗收優先序速查

| 保護對象 | 不變量 | 最先應寫的測試 |
|---|---|---|
| AI 寫入 | 沒有使用者確認就不新增帳本 | 取消預覽→資料筆數不變 |
| 金額 | 月總額＝指定 `expenseDate` 月份之有效金額總和 | 跨月＋刪除＋編輯 |
| 今日完成 | 匯入不算新增；今日建立全刪回到未完成 | 匯入／刪除組合 |
| 同步 | 重複與過時事件不覆蓋最新狀態 | 亂序事件序列 |
| 提醒 | 每裝置／當地日期上限一次；跨日不補發 | 並發 claim＋跨日邊界 |
| 授權 | 裝置 A 不能修改裝置 B 設定 | 跨 token API 負例 |
| 備份 | 匯入前可預覽，既有 ID 不覆寫 | 合併／取消／恢復已刪紀錄 |
| 部署 | 未取得部署批准不可正式上線 | CI 與文件不存在自動 deploy 路徑 |

**文件結束｜截至 2026 年 11 月 22 日，僅完成規劃，未建置亦未部署。**
