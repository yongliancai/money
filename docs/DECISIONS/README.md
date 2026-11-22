# 決策紀錄

ADR-13（本批可逆工程決策，已隨第一批發布）：同日沒有可靠消費時間，歷史樣本只取嚴格早於本次 expenseDate 的已確認同群組紀錄，不依 createdAt 判斷購買先後。不同商品群組不隱式合併；需先解除個別錯誤對應、再人工確認。月份沿用本批既有「相同天數」方案，介面列明兩期日期與月底排除區間，避免冒稱含今天。交易金額相對歷史中位數 ±10% 視為接近；兩期完整度均達 90% 時，已記錄支出 ±10% 視為持平。這些是可見的描述性工程分段，不是財務或儲蓄評斷。細節與取捨見 [本批需求](../ANALYSIS-BATCH1.md)。

ADR-12（本次核准）：第一版使用 JavaScript 規則解析取代 AI API。分類規則與七類列表集中維護；同類多關鍵字可建議該類，多類命中或零命中保留空值，必須人工選擇。缺金額／日期不明也保留原行供修正，不丟棄候選。Pages 強制本機模式、只做開啟網站的今日提示；來源存 manual，避免無必要資料庫／備份升版。允許 feature branch 推送與 PR，禁止 main 合併及部署。ADR-07、提醒 policy 的後端設計保留為未來版本，不是本次 BLOCKED 功能。

ADR-11（本次已授權、可逆）：GitHub Pages 前端＋選用獨立 HTTPS 後端。實際目標 `yongliancai/money`；pages mode base `/money/`，workflow 以 `GITHUB_REPOSITORY` 推導，根網域可覆寫 `/`。未配置後端即本機模式；API URL 不是秘密，只允許 `VITE_API_BASE_URL` 這一個前端變數。發布採停用的手動範本，啟用／Pages 權限／發佈另批。完整取捨、回歸與命令見 [Pages 交接](../GITHUB-PAGES.md)。

| ADR   | 狀態                            | 決策／取捨                                                                                                                                      |
| ----- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 01    | 本次採用，可逆                  | 工作區 money 建立全新本機 repo、work/isolated-build 分支；無遠端，不建立外部倉庫                                                                |
| 02    | 本次採用，可逆                  | npm 單一套件管理專案；client/server/shared 清楚分層。無獨立發版需求，不加 npm workspaces。Node 22.23.1 為現有支援 LTS，lockfile 固定依賴        |
| 03    | 本次採用，可逆                  | 隨機 256-bit deviceToken + UUID；伺服器僅存 SHA-256，提供撤銷／重新啟用                                                                         |
| 04    | 本次採用，可逆                  | eventId 冪等＋每日 revision＋設定 revision fence；IDB 交易 outbox＋SQLite unique claim                                                          |
| 05/06 | **待決，正式提醒 BLOCKED**      | [提醒政策](reminder-policy.md)：不擅選有效期／補發延遲；未設定時不送                                                                            |
| 07    | **待決，真實 AI BLOCKED**       | 模型供應商、型號、費用上限、憑證及隱私。只有 disabled／明確 demo 與注入介面，不自動建立費用資源                                                 |
| 08    | 部分待決                        | 自訂分類＋UI 建議；已採正整數 TWD、安全整數表示限制。固定分類、退款、小數及商業上限仍待決                                                       |
| 09    | **待決，HTTPS／iPhone BLOCKED** | 不使用任何既有 VPS、域名、Repository 或正式服務。部署另批                                                                                       |
| 10    | 本次採用，可逆                  | Node test runner＋fake-indexeddb＋Supertest＋fast-check＋Playwright；內建 SQLite 免 native build。若轉 Node 版本先重驗相容性與 experimental API |

本次使用者授權採取安全可逆工程決策，以上「本次採用」是工程選擇，不冒稱附件中的候選方案早已逐項核准。
