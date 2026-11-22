# 消費分析第一批（MNY-01～MNY-05）

第一批已由使用者獨立批准，將 PR #3 的已驗收 1f1591d 合併 main，並正式發布 7551d96。以下隔離開發／Draft 範圍為前次收尾的歷史紀錄；最新發布及正式站 14 個雙瀏覽器驗收結果見 [發布紀錄](RELEASE.md)。後續發布及第二批仍需獨立授權。

本次接手 baseline：PR #3 為 Draft、head `fa222a612fc96f7fc627e31fc985b9b499837d47`，main `a6f45df`。先 fetch 並確認本機乾淨後才切換既有分支，沒有重建功能或覆蓋其他工作階段的提交。授權只含本批修復、測試、提交與 PR 更新；第一版已完成的發布授權不適用本批。

本機最終驗收 **PASS**：80 個程式測試、6 個原有 Chromium E2E、26 個 Pages Chromium／WebKit E2E，失敗 0。乾淨安裝、lint、format、guardrails、docs、兩種建置、各 E2E、統一 verify、red/green 與相依套件 audit 全部 exit 0，audit 0 漏洞。命令、版本、時間、原始日誌與結果見 [summary.json](evidence/batch1/summary.json)。本次提交的雲端狀態以 [PR #3 Checks](https://github.com/yongliancai/money/pull/3/checks) 與 PR 交付報告連結的實際 run 為準，不沿用 baseline 的 CI 當作新提交證據。

| 工作   | 本機狀態 | 驗收依據                                                                     |
| ------ | -------- | ---------------------------------------------------------------------------- |
| MNY-01 | PASS     | 帶資料 v1→v2、CRUD／createdAt、v1/v2 JSON、合併保留、跨分頁原子性／回滾      |
| MNY-02 | PASS     | 明確人工確認、同日排除、五筆門檻、中位數、刪改重算、群組隔離                 |
| MNY-03 | PASS     | 7 日與月同期、分類／總額／筆數／百分比、70/90 門檻、跨年／閏年／月底／零基期 |
| MNY-04 | PASS     | 零支出不造零元交易、衝突失效、取消重算、匯入來源、同步契約不變               |
| MNY-05 | PASS     | 純 Mock Provider、有效價格／商家去重、中位數／差額、示範與限制標示           |

上述 PASS 僅涵蓋可自主執行的本機與模擬瀏覽器驗收；iPhone 真機仍 BLOCKED。未合併 main、未部署、未使用正式市場 API 或背景推播。

## 範圍

- 增加消費分析主分頁、消費紀錄獨立分頁；原記帳與備份不變。
- 本機 IndexedDB v1 → v2 升級，新增 `dailyStatus`（明確確認零支出）與 `productLinks`（使用者確認同商品對應）；保留原 `expenses` 結構。
- 「今天沒有消費」或指定過去日期零支出：有當日消費紀錄則拒絕；同日新增／修改／匯入支出會解除對應零支出標記。當天零支出算今日完成，同步仍只傳布林完成狀態。
- 日期覆蓋率：有消費紀錄日期與明確確認零支出日期之聯集 / 期間天數。兩期 >=90% 可呈現支出趨勢觀察；兩期 >=70% 則只呈現初步變化；任一期 <70% 不評級。
- 期間：最近 7 天與前 7 天、本月同期與上月同期；月份天數不同時取可比較的同等天數。
- 使用者確認商品與規格相同後才連結兩筆紀錄，不將同名、類似文字自動判定相同商品；至少 5 筆較早的**已確認相同**歷史紀錄才給評級。因舊帳本沒有容量及數量欄位，目前只比較整筆交易金額，UI 必須聲明限制。
- 市場比價目前只有清楚標示的固定模擬報價，不呼叫 Google、第三方 API 或任何付費端點。

## 升級與備份

- 原 v1 IndexedDB 自動升級至 v2，不刪除既有 `expenses`。
- JSON 匯出 v2 保存 `zeroDays`、`productLinks`，繼續接受 v1 備份。
- 合併匯入保留既有 ID；只有實際新增的紀錄可帶入商品對應。
- 匯入不能計入今日完成；匯入今天的零支出確認也不作為今日完成；不覆蓋使用者既有的零支出確認。
- 本版不進行真實市場搜尋，不建置或購買 API 服務。

## 風險及後續

- 目前缺少明確的單品數量、包裝、規格資料。即使使用者確認為同商品，交易總價也不等於單價；第二批前需要先設計可驗證的單價資料模型。
- 「有當天紀錄」只是日期覆蓋，不能保證每筆消費完整。
- 當日完成基於本機 activity 或零支出；正式推播仍受原提醒政策限制。
- 錯誤分類／文字匹配未使用 AI；Google 比價仍屬下一批需獨立批准的付費 API。
- 不得藉此 PR 啟動 Pages 部署、合併 main 或建立付費資源。

## 驗收

- `npm run verify` 及 `npm run build:pages`；實際執行證據依 GitHub Actions。
- 新增單元／整合測試：日期交界、90/70 完整度、歷史 >=5、三商家模擬報價、IDB v1 升級、v1/v2 備份、零支出取消及同日消費衝突。
- 使用模擬市場資料時，畫面必須始終標示「示範」，不可宣稱實際市場平均。

## 明確行為與交易規則

- 消費日期是比較依據，createdAt 僅表示本機建立時間且一般編輯不能改動。同一天缺少實際消費時間，不互為歷史；同日多筆各自保留，可作為未來日期消費的獨立樣本。補記依 expenseDate，不依建立順序。樣本依 expenseDate／createdAt／ID 排序，排除本次、同日、未來、不同群組、非正安全整數價格。五筆門檻與中位數在每次讀取重新計算。
- 商品關係只由人工確認商品、數量、容量、規格後建立，取消不寫入。不以文字正規化或相似名稱自動配對。改品項解除該筆關係，須重新確認；僅改金額／日期保留關係並重算。不同群組不自動合併，先解除錯誤成員再確認，其他成員不會被連帶移動。UI 全程稱「交易金額」，不冒稱單價。
- 月同期沿用本批既有相同天數規則：例如 3 月 31 日比較 3/1–3/28 與非閏年 2/1–2/28；畫面明列排除 3/29–3/31。原帳本月統計仍包含完整月份。零元前期不除以零，百分比顯示無法計算。低完整度仍是「已記錄支出」，不能把未記帳視為零消費。
- 分析總額與分類使用 BigInt 精確累計，百分比是顯示用近似值。分類鍵含 `__proto__`／`constructor` 也不能影響統計。已記錄支出與歷史交易的 ±10% 分段在介面明示，只是描述性分段，不推定儲蓄或真正市場價值。
- 所有修改 expenses／dailyStatus／activity／productLinks／revision／outbox 的業務操作都在同一 readwrite transaction；交易失敗完整回滾，匯入 token 可重試。編輯或匯入解除零支出後，同交易寫入完成快照，不等待下次 heartbeat 才反映。
- `analysisSnapshot` 用單一 readonly transaction，避免備份或分析讀到「刪除前紀錄＋刪除後商品對應」。JSON v1 可匯入，v2 匯出 expenses／zeroDays／productLinks。商品對應須唯一且指向備份中的紀錄；拒絕矛盾／孤兒對應。只對實際新增紀錄匯入關係，重複 ID 或預覽後被別分頁新增的 ID 都保留本機內容。匯入群組撞到既有 UUID 時為新增成員重新配置，不能偷偷加入既有群組。
- 匯入零支出保留 import 來源且 confirmedAt=null；不論跨日、時區變化，都不能取得本機完成資格。當天零支出候選略過；人工重新確認才可完成。匯入只可保留已有的本機完成資格或使失效狀態下降，不新增 activity。來源識別不靠備份所帶的 origin 欄位判斷。
- Mock PriceProvider 僅提供 `getOffers(record)` 候選報價，不可寫帳本；目前沒有 HTTP Provider。忽略空值、無商家、非正安全整數及非 exact 示範匹配；商家經 NFKC／去頭尾空白／小寫去重，同商家採第一個有效報價。至少三個不同示範商家才標示樣本足夠，沒有樣本不算中位數；不論樣本數都不提供真正市場評級。改選紀錄立即清除前一次示範結果。
- 主選單只有快速記帳、消費紀錄、消費分析；備份與提醒設定保留於工具區。320／390／768 寬度、鍵盤 Enter 導覽與可辨識 combobox 標籤納入 E2E。

## 修正與證據對照

| 問題／原因                                                       | 修改                                                   | 回歸證據                                                                |
| ---------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------- |
| 編輯／匯入零支出失效卻未 snapshot，後端可能仍保留 completed=true | ledger.update／confirmImport 同交易 snapshot           | integration analysis-regression：舊紀錄移入今天、匯入衝突與 eventSchema |
| 匯入未來零支出跨日取得完成資格，來源未區分                       | dailyStatus origin 與 legacy confirmedAt:null 防護     | integration imported zero／clock advance                                |
| 改品項仍保留商品身份，備份群組碰撞誤連既有商品                   | 改名解除、匯入碰撞重配、拒絕孤兒／重複對應             | integration rename／collision／schema／multi-tab                        |
| 多交易讀取可能造成備份／分析不一致                               | 單交易 analysisSnapshot、exportJSON                    | concurrent export/delete 與 quota rollback/retry                        |
| 原升版測試只有空資料庫                                           | 新增帶真實合成舊紀錄／activity 的升版與 CRUD／備份測試 | integration 與 Chromium／WebKit real browser v1 upgrade                 |
| 非有效歷史金額仍計樣本，排序及同日規則不明                       | 正安全整數過濾、明確日期排序與同日排除                 | unit history 邊界、Pages 五筆→編輯→刪除重算                             |
| 趨勢缺日期、筆數、百分比，Number 累計精度與物件分類鍵問題        | 日期／月底排除提示、BigInt、null-prototype 分類表      | unit 金額／日期／70/90 邊界、Pages 月底 UI                              |
| Mock 商家空值／不同大小寫重複、換紀錄顯示舊結果                  | 有效示範報價清單、商家正規化與清除結果                 | unit mock 負例、Pages 改選清空                                          |
| 五主分頁造成手機導覽擠壓                                         | 三主分頁＋獨立工具區，維持原設計                       | Pages 320/390/768 溢出與按鈕間距檢查                                    |
| 操作尚未完成就做下一步，對話框／初始化造成測試競態               | 等待日期完成、操作期間禁重入、等儲存與 503 response    | 原有效斷言保留；Pages 首兩輪失敗日誌與後續完整通過                      |

原始 red：`evidence/batch1/red-before.txt`（15 案、10 失敗／5 通過）；對應 green：`green-after.txt`（15/15）。後續額外跨分頁與升版測試納入最終全集。所有最終命令、版本、時間與 exit code 將記錄於 `evidence/batch1/summary.json`；完成前不將待驗工作記 PASS。

最終驗證的修復紀錄：格式檢查攔截 ledger 換行後已重新格式化（`final-format-repair.txt`）；新增跨日測試的 latest helper 曾只按 revision 排序，因 revision 每日重置，UUID 讀取順序會選錯日期事件。改為 localDate 再 revision，並明確斷言事件日期，沒有放寬 completed=false。原失敗日誌保留於 `verify-clock-order-failure.txt`，之後重新執行完整驗收。

## CI 盤點與暫時設定

接手時查閱此分支全部 41 次 Actions，包含 push、pull_request 與臨時格式化 workflow，28 次失敗 job 的日誌均讀取。明細見 `evidence/batch1/historical-ci.json`。歷史問題為 await 作為預設參數的語法錯誤、未使用 normaliseItem 匯入、Prettier 未格式化，以及 run 45028277936 的 AI 503 E2E 操作競態。前幾項已由先前工作修正，本次保留這些提交，不放寬 lint／format；競態增加成功儲存與實際 503 response 等待。

`.github/workflows/temp-format-review.yml` 在接手前的 `b9a1434` 已移除，本次確認不存在，不重新加入。現有 ci.yml 保持測試與預覽 artifact；pages-release.yml 沿用既有手動發布流程，這次不修改、觸發或調權。

## 第二批前置條件（本次不執行）

Google 或第三方市場報價須先決定商品識別／規格、單位數量與換算、同商家多筆與運費／稅／優惠計價、報價時間與幣別、可信匹配及資料不足策略。API Key 應只存獨立後端，不能放 Pages；還需來源服務條款／資料使用權、快取期限、速率限制、超時／重試、配額、月費與逐請求成本上限、監控及停用機制。沒有本次取得的新供應商報價，不列假定費用數字，也不建立帳號、購買服務或發出正式 API 請求。

BLOCKED：iPhone 真機 Safari／加入主畫面／離線行為，以及全新無對話工作階段的規範自動載入驗證。桌面 Chromium／WebKit 手機模擬不能取代真機。真實市場 API／背景推播為本批明確不實作範圍，不能以示範結果冒充已完成。
