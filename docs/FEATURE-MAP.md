# 功能地圖

第一版新增：`quick-form` → 本機 parser／集中關鍵字規則 → editable preview → explicit confirm → IndexedDB，包含衝突留空、補填金額、離線／雙擊防重。公開 Pages 只顯示本機今日提示與 PWA 安裝，不使用下列舊 AI／推播入口；舊入口只在 integration regression mode 保留。驗證入口 `tests/unit/quick-entry.test.js`、`tests/pages/quick-entry.spec.js`（Chromium／WebKit）。

| 功能         | 入口／條件                           | 狀態與驗證                                                                       |
| ------------ | ------------------------------------ | -------------------------------------------------------------------------------- |
| 手動 CRUD    | overview → 手動記帳／編輯／刪除      | dialog → validation → IDB transaction → render；ledger、core E2E                 |
| 月與分類統計 | month／search／category filter       | expenseDate 月份、BigInt 累計；domain、CRUD E2E                                  |
| 自然語言     | ai-form；線上＋匿名 token＋demo 設定 | disabled/error／parse／editable preview／cancel／confirm；API、ledger、E2E       |
| JSON／CSV    | backup → export                      | Blob download；CSV 公式注入與引號保護；domain、下載／還原 E2E                    |
| JSON 合併    | import-file                          | schema／新增及恢復清單／取消或確認／重複跳過；ledger、restore E2E                |
| 今日完成     | overview completion                  | 本機 activity 今日仍存在；匯入／歷史編輯排除；ledger 測試                        |
| 提醒設定     | settings-form                        | IDB 設定 revision／snapshot → auth sync；API、sync tests                         |
| 匿名授權     | sync.js identity                     | register／hashed backend token／revoke／explicit reactivate；API、sync tests     |
| 離線同步     | online／visible／60s／立即同步       | atomic outbox → settings fence → ack → clear；sync、offline E2E                  |
| 訂閱通知     | subscribe-push，直接點擊             | capability／permission／PushManager／server allowlist；實際訂閱 BLOCKED          |
| 推播排程     | server index 15s，明確配置 live      | policy gate → transaction claim → send ≤1/day；reminders tests                   |
| PWA          | build output／SW                     | install precache／offline reload／expired payload drop；offline E2E、SW VM tests |

所有消費／匯入文字透過 textContent 顯示；手機 E2E 驗證長文字不溢出，輸入 HTML 不建立節點。
