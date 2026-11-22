# 已確認需求與狀態

最新第一版基準由本次使用者任務核准：多行快速記帳，每行一筆；JavaScript 規則提取品項／正整數 TWD，集中關鍵字分類為餐飲、交通、購物、娛樂、學習、生活、其他。衝突／未知必須留待人工選擇，可編輯預覽、明確確認才存 IndexedDB。保留 CRUD、日期、月份統計、查詢、JSON／CSV 與合併匯入。Pages `/money/` 版完全離線解析，即使殘留後端 URL 也不發 API 請求；只提供開啟網站的當日完成提示，不提供背景定時 Web Push。這替代第一版的真實 AI／推播需求，相關伺服器僅保留獨立回歸測試，不是第一版對外功能。

本次使用者新增交付架構：GitHub Pages 前端＋未來獨立後端；先完成前端相容性與發布前測試，不啟用 Pages、不推送、不部署。未接後端時保留帳本／統計／備份並明示 AI／推播不可用；原儲存確認與提醒規則不變。

基準為附件 v1.2 §1.2、§5.1 及本次使用者指令。原對話中未附上的第二輪審查沒有被推定成正式規則。

| ID  | 已確認規則                                               | 實作位置／驗證                                                        |
| --- | -------------------------------------------------------- | --------------------------------------------------------------------- |
| R1  | 大學生、行動優先、iPhone PWA、免登入、單裝置             | client、manifest；Chromium 手機尺寸測試，iPhone BLOCKED               |
| R2  | 自然語言單／多筆，品項／金額／消費日期／分類，可修改預覽 | 展示 adapter、Zod、preview dialog；真實模型 BLOCKED                   |
| R3  | AI 未經使用者明確確認不得儲存或計算統計                  | ledger.preview／confirm；取消、重複確認與 E2E                         |
| R4  | AI 失敗或離線時可手動記帳                                | UI、本機 storage、離線 E2E                                            |
| R5  | 完整帳本僅在 IndexedDB                                   | expenses/activity/settings/outbox/meta/tombstones；伺服器只收狀態契約 |
| R6  | 月統計依 expenseDate，createdAt 表示建立時間且編輯不變   | monthStats、update；跨月與 createdAt 測試                             |
| R7  | 今日新建有效紀錄算完成；全刪即未完成；編輯舊紀錄不算     | activity 為本裝置新增操作的證據，不單靠來源時間推算                   |
| R8  | 本地提醒時間、每天最多一則正式通知、前一天不補發         | scheduler unique(device,date)、SW 過日丟棄；模擬測試                  |
| R9  | 狀態不可信優先漏發，無法保證零誤發                       | 無當日／過期／時區版本不符略過；政策未定停用                          |
| R10 | JSON／CSV 匯出，JSON 驗證、預覽、合併、ID 去重           | backupSchema、previewImport、confirmImport；existing ID 不覆蓋        |
| R11 | 匯入不計入今日完成；可能恢復曾刪除資料，需揭露           | origin import、無 activity；tombstone 恢復清單                        |

可逆工程決策（不是宣稱已逐項正式核准）：npm、Node 22 LTS、內建 SQLite、idb、Zod、匿名高熵 token／雜湊、eventId／revision、SQLite 唯一 claim。詳見 ADR。

分類清單未定：提供可自訂的字串及非約束性建議。單筆金額採已提出的正整數 TWD；最大安全整數為表示層限制，非商業費用上限。模型、預算、提醒有效期／去抖、域名、真實推播服務與正式部署未定。

非目標：登入、跨裝置帳本同步、OCR、語音、銀行串接、預算與理財建議。
