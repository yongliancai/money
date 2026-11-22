# 問題、修復與風險

本批最新範圍與修復見 [第一批交接](ANALYSIS-BATCH1.md)。下方「無遠端／公開 HTTPS／GitHub CI BLOCKED」為初始版本的歷史限制，現已有遠端與第一版正式網址；本批仍禁止部署。iPhone 實機、真正市場 API、背景推播與跨裝置同步仍未驗證／未啟用，不以 Mock 替代。

第一批修復：編輯／匯入未同步零支出失效後的完成快照；匯入未來零支出跨日取得完成資格；改名保留錯誤商品關係；匯入群組碰撞；備份／分析多交易讀取；無效歷史價格、精度與特殊分類鍵；模擬商家去重與空值；趨勢日期／筆數／百分比缺漏；五主選單的手機擠壓。回歸先在 baseline 重現，再記錄修復後結果。完整問題原因、檔案與對應測試見本批交接表。

| ID  | 狀態  | 重現、根因與防護                                                                                                                                    |
| --- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| F01 | FIXED | 第一輪 storage 測試以 outbox `.at(-1)` 當最新；IDB key 為隨機 UUID，不具時間順序。測試改依 revision 排序；產品 sync 同樣按 revision，保留原斷言門檻 |
| F02 | FIXED | 首輪 ESLint 偵測 build regex 無必要 escape；修正 regex 並重跑 lint／build                                                                           |
| F03 | FIXED | 審查發現同步途中設定 revision 改變可能錯處理新事件；新增同步前 snapshot fence＋新版本事件停止重試；sync race 測試                                   |
| F04 | FIXED | npm start 同來源 3001 與 dev 5173 的 Origin 不同；後端由實際 port 預設 origin，dev runner 明設 5173；E2E 同來源 HTTP 及啟動檢查                     |
| F05 | FIXED | 撤銷後若只留失效 token，重載無法恢復；持久化撤銷標記＋明確重新啟用，避免靜默重建授權；sync revoke 測試                                              |
| F06 | FIXED | 固定 SW cache 名稱可能沿用舊 shell；改由 html／SW hash 命名，activate 清舊 app cache；offline E2E                                                   |

未解／限制：真實 AI 供應商、憑證、費用與品質評測 BLOCKED；demo 只是有限格式解析，不宣稱完整中文自然語言品質。提醒核心 freshness／debounce 未定，預設不發。公開 HTTPS、iPhone Push 與實際通知送達 BLOCKED。無遠端因此 GitHub 實際 CI／PR、保護分支設定 BLOCKED。

SQLite 內建 API 在 Node 22 為 experimental；lock Node 版本並保留測試。訂閱端點隔離 SQLite 未做磁碟加密。單機 in-memory rate limiter 不支援多節點；正式設計另審。瀏覽器資料清除會遺失帳本；JSON 備份由使用者保管。恢復匯入保留帳本資料但不恢復今日活動資格，符合匯入不算新建需求。

本機 storage 大量資料／真實手機效能尚無量測，不宣稱已達效能 SLA。核心寫入正確性與離線流程以具體測試為證，不推論完全無 Bug。

## 追加驗收修復

F07（FIXED，測試）：撤銷後立即 reload 未等待非同步完成，E2E 失敗；改先等待成功訊息，再驗持久化可見性，單案與全套通過。

F08（FIXED）：驗收 script 動態 require 被防護攔截；改 readFileSync＋JSON.parse，未放寬規則，完整 verify 通過。原始輸出見 evidence/initial-guardrail-failure.txt。

全新 CLI 會話可見規範但終端機發生 registered Core launch requires an installed app，替代 Node runtime 也退出；完整新會話驗收 BLOCKED。
