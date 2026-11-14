# HoHo Manager Playwright Audit

- URL: https://hoho-manager.onrender.com/
- Generated: 2026-11-14T07:03:00.268Z
- Responsive widths: 320, 360, 390, 430, 768, 1280px
- Passed: 25
- Failed: 5
- Skipped: 2

| Status | Check | Details |
|---|---|---|
| PASS | LoginScreen 320px horizontal overflow | viewport=320px, LoginScreen client=305px, scroll=305px |
| PASS | LoginScreen 360px horizontal overflow | viewport=360px, LoginScreen client=345px, scroll=345px |
| PASS | LoginScreen 390px horizontal overflow | viewport=390px, LoginScreen client=375px, scroll=375px |
| PASS | LoginScreen 430px horizontal overflow | viewport=430px, LoginScreen client=415px, scroll=415px |
| PASS | LoginScreen 768px horizontal overflow | viewport=768px, LoginScreen client=768px, scroll=768px |
| PASS | LoginScreen 1280px horizontal overflow | viewport=1280px, LoginScreen client=1280px, scroll=1280px |
| PASS | LoginScreen responsive screenshots | Captured widths: 320, 360, 390, 430, 768, 1280px |
| PASS | Application route responds | https://hoho-manager.onrender.com/ |
| PASS | Existing message data snapshot | Existing value captured for restoration |
| PASS | App rendered visible content | HoHo Manager Select Server... ▼ Backups JSON Settings Staff Access 𝑷𝒆𝒂𝒄𝒆 Docs Message 1 CLASSIC THREAD Files Add UR |
| PASS | JSON modal opens | JSON Data title and editor found |
| PASS | Backups modal opens | Dialog detected |
| SKIP | Dispatch dialog opens | Opened for inspection only; no send action is performed |
| PASS | Clear-all confirmation opens | Confirmation is not accepted; existing messages are left intact |
| PASS | Studio 320px horizontal overflow | viewport=320px, document=320px, body=320px |
| FAIL | Header 320px internal overflow | client=320px, scroll=367px |
| PASS | Studio 360px horizontal overflow | viewport=360px, document=360px, body=360px |
| FAIL | Header 360px internal overflow | client=360px, scroll=367px |
| PASS | Studio 390px horizontal overflow | viewport=390px, document=390px, body=390px |
| PASS | Header 390px internal overflow | client=390px, scroll=390px |
| PASS | Studio 430px horizontal overflow | viewport=430px, document=430px, body=430px |
| PASS | Header 430px internal overflow | client=430px, scroll=430px |
| PASS | Studio 768px horizontal overflow | viewport=768px, document=768px, body=768px |
| PASS | Header 768px internal overflow | client=768px, scroll=768px |
| PASS | Studio 1280px horizontal overflow | viewport=1280px, document=1280px, body=1280px |
| PASS | Header 1280px internal overflow | client=1280px, scroll=1280px |
| SKIP | PropertyPanel responsive screenshots | Before pressing Enter, select a message component so the Component Inspector is open; rerun the audit to capture it |
| FAIL | Browser console errors | Permissions policy violation: unload is not allowed in this document. \| Permissions policy violation: unload is not allowed in this document. \| WebSocket connection to 'ws://127.0.0.1:6463/?v=1' failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED \| WebSocket connection to 'ws://127.0.0.1:6464/?v=1' failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED \| WebSocket connection to 'ws://127.0.0.1:6465/?v=1' failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED |
| FAIL | Uncaught page errors | POST /auth/logout [401] \| POST /auth/logout [401] \| Starting password login |
| PASS | Failed network requests | None captured |
| FAIL | HTTP error responses (4xx/5xx) | [{"status":401,"url":"https://discord.com/api/v9/auth/logout"},{"status":401,"url":"https://discord.com/api/v9/users/@me?with_analytics_token=true"},{"status":401,"url":"https://discord.com/api/v9/auth/logout"}] |
| PASS | Message data safety | Saved message data is unchanged |

## Screenshot files
- login-<width>.png: unauthenticated LoginScreen (top)
- login-bottom-<width>.png: LoginScreen scrolled to the bottom when its content is taller than the viewport
- header-<width>.png: authenticated Studio header
- studio-<width>.png: full Studio page
- property-panel-<width>.png: Component Inspector, when it was open before the audit

No Discord message was sent and no destructive confirmation was accepted.