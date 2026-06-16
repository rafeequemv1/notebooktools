# NotebookLM Addon Feature Inventory

This file consolidates the features found in the four reference addons inspected for NotebookTools.

## 1. NotebookLM Web Importer

Source folder: `extension-inspection`

### Core Features

- One-click import from the active browser tab into NotebookLM.
- Add the active page to an existing NotebookLM notebook.
- Create a new NotebookLM notebook and add the current source to it.
- Notebook picker with search.
- Empty-state handling when no notebooks are available.
- Import success screen with an **Open Notebook** action.
- Optional auto-open NotebookLM notebook after import.
- Optional automatic Audio Overview generation after import.
- Install onboarding page opens on first install.

### Supported Import Sources

- Current webpage URL.
- Current YouTube video URL.
- Extracted page text as a pasted text NotebookLM source.
- ChatGPT conversation text extraction.
- Claude conversation text extraction.
- WeChat public article extraction.
- X/Twitter post or article extraction.
- Website body text extraction fallback.
- Website fallback coverage includes publisher/research domains such as NYTimes, WSJ, Washington Post, Financial Times, The Economist, Bloomberg, The Atlantic, Medium, Nature, ScienceDirect, Business Insider, The Information, and Zhihu.
- Manual bulk links pasted into the extension app.
- Browser tabs from the current window.
- YouTube playlist import.
- RSS feed import.
- Page-link extraction from a webpage URL.

### Recognized NotebookLM Source Types

- Google Slides.
- PDF.
- Website.
- Text.
- Email.
- YouTube.
- Google Docs.
- Google Sheets.

### Bulk Import Features

- Bulk links tab.
- Browser tabs tab.
- YouTube playlist tab.
- RSS feed tab.
- Page links tab.
- Existing notebook destination.
- New notebook destination.
- New notebook title entry.
- Link search/filtering.
- Select all links.
- Import progress tracking.
- Success and failure count reporting.
- Continue import flow.
- Open notebook after bulk import.
- Source-limit-aware chunking based on NotebookLM account limits.
- Free user limit for manual links.
- Pro-gated bulk import methods for browser tabs, playlist, RSS, and page links.

### Notebook Management

- Notebook list page.
- Notebook title display.
- Source count display.
- Audio Overview status/actions column.
- Tags column.
- Search notebooks by title.
- Filter notebooks by tag.
- Open notebook action.
- Multi-select notebooks.
- Delete selected notebooks.
- Delete confirmation dialog.
- Edit tags dialog.
- Add notebook tags.
- Remove notebook tags.

### Audio Overview And Podcast Features

- Create Audio Overview automatically after import.
- Generate Audio Overview manually from notebook list.
- Poll Audio Overview status.
- Play Audio Overview.
- Download Audio Overview.
- Fetch NotebookLM Audio Overview audio blob.
- Convert WAV to MP3 in a worker.
- Upload converted audio to podcast backend.
- Create podcast episode from Audio Overview.
- Create podcasts.
- Edit podcasts.
- Delete podcasts.
- List podcast episodes.
- Delete podcast episodes.
- Upload podcast episodes by drag and drop.
- Upload podcast episodes by file picker.
- Supported upload formats: MP3, WAV, M4A, AAC, OGG, FLAC.
- Max 10 episode files per upload.
- Editable episode titles.
- Podcast RSS feed generation.
- Copy podcast RSS feed URL.

### Tags And Labels

- Extension-managed notebook tags.
- Tag creation from edit dialog.
- Tag filtering.
- Tag update success and failure states.
- Tags appear local to the extension rather than native NotebookLM labels.

### Settings

- Auto-create Audio Overview.
- Auto-open notebook after import.
- Google account selector by `authuser` index.
- Persisted options in extension storage.

### Auth And Integration

- Uses the user's signed-in NotebookLM browser session.
- Fetches NotebookLM page data.
- Extracts NotebookLM page tokens such as `SNlM0e` and `cfb2h`.
- Calls private NotebookLM `/_/LabsTailwindUi/data/batchexecute` RPCs.
- Uses internal RPCs for list notebooks, create notebook, add source, add pasted text, get notebook details, create audio overview, refresh stale sources, and delete notebook.
- Uses a separate Clerk account for extension Pro/backend features.
- Backend host: `clerk.notebooklm-web-importer.com`.
- Uses Bearer tokens for backend podcast APIs.

### Monetization

- Free daily import cap.
- Upgrade prompt.
- Pro badge.
- Pro-only bulk browser tabs import.
- Pro-only YouTube playlist import.
- Pro-only RSS import.
- Pro-only page-link import.
- Pro-only podcasts.
- Pricing links with UTM tracking.

### UI Surfaces

- Browser action popup.
- Internal app page.
- Bulk import page.
- Notebook management page.
- Podcasts page.
- Sidebar navigation.
- Onboarding page.
- No content script was found for normal page UI.
- No context-menu import was found.
- No side panel was found.

### Permissions And Hosts

- `activeTab`.
- `storage`.
- `cookies`.
- `scripting`.
- `declarativeNetRequestWithHostAccess`.
- Optional `tabs`.
- Host access to `notebooklm.google.com`.
- Host access to Clerk backend.
- Optional all HTTP/HTTPS host access.

### Limitations And Risks

- Uses private NotebookLM RPCs, so it can break if NotebookLM changes internals.
- Uses `cookies` permission, which is more sensitive.
- Bulk and podcast features depend on a third-party backend and Pro account.
- No general full notebook export was found.
- No context menu surface was found.

## 2. YouTube To NotebookLM

Source folder: `extension-inspection-2`

### Core Features

- Import YouTube content into NotebookLM.
- Add current browser tab to NotebookLM from popup.
- Small NotebookLM shortcut/icon on non-NotebookLM pages.
- Create a new NotebookLM notebook.
- Add sources to an existing NotebookLM notebook.
- Search existing NotebookLM notebooks.
- Choose notebook from popup.
- Choose notebook from YouTube page button menu.
- Show notebook source counts in popup.
- Open created/imported NotebookLM notebook.
- Install welcome page with usage screenshots.

### YouTube Page Button Placement

- Adds a NotebookLM button into YouTube watch page action row.
- Places the button before YouTube's main menu renderer on video pages.
- Adds a separate button near watch-page playlist panel.
- Adds button near playlist title on playlist pages.
- Special Watch Later playlist placement.
- Adds button on YouTube search results pages.
- Adds button on channel/user/custom handle pages.
- Uses YouTube-like button styling.
- Uses NotebookLM icon.
- Shows loader/spinner.
- Shows progress text like `Generating...`.
- Watches YouTube SPA navigation/title changes and re-renders.

### YouTube Import Sources

- Single YouTube video from `watch?v=`.
- YouTube Shorts URL converted to watch URL.
- YouTube embed URL converted to watch URL.
- YouTube `/v/` URL converted to watch URL.
- Visible playlist panel videos.
- Playlist by `list=` parameter.
- YouTube playlist page videos.
- Watch Later playlist.
- Radio-like `&list=RD` fallback extraction.
- YouTube search result video URLs.
- YouTube channel videos.
- YouTube custom/user/@ channel pages.
- Current tab import from popup for ordinary web pages.

### Bulk YouTube Behavior

- Playlist import uses YouTube internal browse data and continuation tokens.
- Channel import uses YouTube internal browse data and continuation tokens.
- Search import collects currently visible result videos.
- Bulk adds many URLs to NotebookLM.
- Frontend caps sent URLs around hundreds of items.
- Background limits based on detected NotebookLM capacity.
- Coarse progress states for creation/import.
- No per-video selection UI found.
- No duplicate review UI found.

### Notebook Creation And Selection

- Create new notebook from YouTube page menu.
- Type/search notebook name in popup.
- Choose existing notebook from recent NotebookLM list.
- Show more/show less notebook results.
- Keyboard navigation in notebook picker.
- Enter key selection.
- Existing notebook source count display.
- New notebook creation through NotebookLM RPC `CCqFvf`.
- Source addition through NotebookLM RPC `izAoDd`.
- Notebook list through NotebookLM RPC `wXbhsf`.
- Source processing/status polling through NotebookLM RPC `rLM1Ne`.

### Auth And Account Behavior

- No OAuth flow.
- Uses the user's signed-in Google/NotebookLM session.
- Fetches NotebookLM page.
- Extracts NotebookLM tokens `cfb2h` and `SNlM0e`.
- Calls NotebookLM private `batchexecute` RPCs.
- Fetches Google account list from `accounts.google.com/ListAccounts`.
- Shows account avatars/emails.
- Supports switching selected Google account.
- Stores selected account in `chrome.storage.sync`.
- Sends `authuser` when account is selected.
- Opens NotebookLM if authorization is missing.

### Popup Features

- Add current tab to NotebookLM.
- If current tab is YouTube, delegates to content script for page-specific extraction.
- If current tab is not YouTube, adds active tab URL as a source.
- Search or create notebook.
- Notebook list with source counts.
- Show more/show less.
- Loading and error states.
- Dark theme support through URL parameter.

### Ratings, Promo, And Onboarding

- Welcome page opens on install.
- Welcome page explains video, channel, playlist, search result, and popup import.
- Context menu on extension action for rating.
- Opens Chrome Web Store review page.
- After repeated successful saves, shows rating/promo popup.
- Star rating UI.
- Five-star flow links to Chrome Web Store review.
- Firefox review branch exists.

### Analytics And Error Reporting

- Mixpanel tracking.
- Events include install, popup init, NotebookLM click, notebook selection, notebook creation, YouTube save, tab save, open notebook, save errors, list errors, account switch, render YouTube, rating, promo events.
- Sentry error reporting in bundles.

### Permissions And Hosts

- `tabs`.
- `storage`.
- `contextMenus`.
- `scripting`.
- `unlimitedStorage`.
- All URL host access.
- Content script runs on all pages at document start.
- YouTube CSS injected on YouTube.

### Limitations And Risks

- Uses private NotebookLM RPCs.
- Uses broad `<all_urls>` access.
- YouTube selectors are fragile.
- Search import appears limited to visible results.
- No granular bulk video selection.
- Live videos are explicitly unsupported.
- No advanced settings page found beyond the popup/options app.

## 3. NotebookLM Tools

Source folder: `extension-inspection-3`

### Core Features

- Power tools for NotebookLM.
- Browser popup.
- Chrome side panel.
- Full internal extension app.
- Content UI injected into NotebookLM.
- Context menu workflows.
- Notebook management.
- Source management.
- Bulk imports.
- Tags.
- Source folders.
- Native NotebookLM labels.
- Prompt library.
- Studio generation helpers.
- Audio/podcast player.
- Backup/export/import.
- Settings.
- Licensing/profile.

### Main Routes And UI Surfaces

- Home route.
- NotebookLM dashboard route.
- Notebook detail route.
- Tags route.
- Podcast route.
- Prompts route.
- Backup route.
- Settings route.
- Login route.
- Profile route.
- Context-menu preview route.
- NotebookLM configuration route.
- Browser action popup.
- Side panel.
- NotebookLM content overlays.
- NotebookLM card tags.
- NotebookLM all-tags bar.
- Prompt slash suggestions inside NotebookLM.
- Floating language switcher.

### Import Sources

- Current page import.
- Link context import.
- Selected text import.
- Page link extraction.
- Sitemap import.
- YouTube video import.
- YouTube playlist import.
- RSS feed import.
- Atom feed import.
- Open browser tabs import.
- Manual bulk URL import.
- ChatGPT-like page imports through generic page/text source support where detected.

### Page Link And Sitemap Features

- Extract all anchors from current page.
- Deduplicate links.
- Include filters.
- Exclude filters.
- Remove hash fragments.
- Remove query parameters.
- Select all links.
- Bulk add selected links.
- Parse XML sitemaps.
- Follow nested sitemaps.
- Depth limit for sitemap crawl.
- Block private/internal network hosts.

### YouTube And RSS Features

- Parse YouTube playlist pages.
- Parse YouTube `ytInitialData`.
- Show playlist metadata.
- Show playlist videos table.
- Show unavailable videos.
- Select individual videos.
- Select all videos.
- Import selected videos.
- Detect RSS/Atom feed URL.
- Detect alternate feed links.
- Parse RSS channel/items.
- Parse Atom feeds/entries.
- Show article table.
- Import selected feed article URLs.

### Notebook Management

- List notebooks.
- Mine/shared filter.
- Grid view.
- Table view.
- Search notebooks.
- Refresh notebooks.
- Create notebook.
- Delete notebook.
- Rename notebook.
- Copy notebook title.
- Open notebook in NotebookLM.
- Open internal source manager.
- Tag filter.
- Untagged notebook filter.
- Cross-notebook search.
- Search notebook results.
- Search source results.
- Source type filters.
- Read-only shared notebook detection.
- Disable unsafe actions for read-only notebooks.

### Source Management

- Source list.
- Source search.
- Source type filters.
- Source sorting.
- Table selection.
- View source content.
- Rename source.
- Delete source.
- Refresh source.
- Check source freshness.
- Bulk selected-source actions.
- Move sources to folder.
- Remove sources from folder.
- Bulk rename sources.
- Bulk delete sources.
- Bulk download sources as ZIP.
- Copy sources to another notebook.
- Move sources to another notebook.
- Generate Studio outputs from selected sources.
- Delete originals after copy/move.
- Handle non-copyable source types.
- Chunk large copied text.
- URL/YouTube re-add when possible.

### Source Merge And Duplicate Cleanup

- Merge selected sources into one text source.
- Build merged Markdown-style output.
- Include source headings.
- Include source URLs/types.
- Split merged content into chunks.
- Optionally delete original sources.
- Fast duplicate scan by same URL.
- Fast duplicate scan by same YouTube ID.
- Similar-title duplicate scan.
- Deep duplicate scan by source content.
- Choose keep oldest.
- Choose keep newest.
- Choose source per duplicate group.
- Delete duplicate sources.
- Remove folder mappings for deleted sources.

### Tags, Labels, And Folders

- Extension-local notebook tags.
- Create tags.
- Search tags.
- Add tags to notebooks.
- Remove tags from notebooks.
- Tag colors.
- Tag usage counts.
- Untagged filter.
- Export/import notebook tags.
- Source folders.
- Create source folders.
- Edit source folders.
- Delete source folders.
- Move sources to folders.
- Remove sources from folders.
- Bulk move sources to folders.
- Export/import source folders.
- Native NotebookLM labels.
- Create native labels.
- Rename native labels.
- Delete native labels.
- Add source labels.
- Remove source labels.
- Bulk label moves.
- AI auto-label remaining sources.
- AI auto-label all sources.
- Regenerate labels.
- Folder-vs-label explanation.

### Studio, Artifacts, Mind Maps, And Audio

- Generate Audio output.
- Generate Report.
- Generate Video.
- Generate Quiz.
- Generate Flashcards.
- Generate Mind Map.
- Generate Infographic.
- Generate Slide Deck.
- Generate Data Table.
- Select source subset for generation.
- Select all/deselect all sources.
- Optional generation instructions.
- Output language override.
- Per-type generation options.
- Batch generation.
- Cancel/retry/error progress states.
- Multi-type generation license gate.
- Audio format/length options.
- Report presets.
- Video format/style options.
- Quiz quantity/difficulty.
- Flashcard quantity/difficulty.
- Infographic orientation/detail/style.
- Slide deck format/length.
- Data table instructions/language.
- Mind map viewer.
- Mind map zoom in/out.
- Fit to view.
- Fullscreen mind map.
- Artifact library.
- Artifact type filters.
- Artifact search.
- Source filters.
- Orphan/deleted-source indicators.
- View artifact content.
- Rename artifact.
- Delete artifact.
- Bulk delete artifacts.
- Export artifacts as ZIP.
- Export source-artifact map CSV.
- Audio `.mp3` export.
- Report/note `.md` export.
- Video `.mp4` export.
- Quiz/flashcards CSV or JSON export.
- Mind map JSON export.
- Infographic PNG export.
- Slide deck PPTX/PDF export.
- Data table CSV export.

### Flashcards And Podcast Player

- Flashcards study mode.
- Flashcards list mode.
- Shuffle flashcards.
- Reveal answer.
- Correct/missed tracking.
- Persist study session.
- Anki-compatible CSV export.
- Podcast player for Audio Overview artifacts.
- Scan notebooks for ready Audio Overview artifacts.
- Group audio by notebook.
- Filter listened/in-progress/unlistened.
- Ownership filter.
- Sort audio list.
- Play audio.
- Persistent progress.
- Playback rate persistence.
- Mark listened.
- Delete podcast/audio item.
- Refresh expired audio URL.
- Download single podcast MP3.
- Download notebook podcast ZIP.
- Download all/selected podcasts ZIP.

### Backup, Export, And Import

- Single notebook backup as JSON.
- Single notebook backup as ZIP.
- Include notebook metadata.
- Include source titles.
- Include source URLs.
- Include full source content.
- Include source folder organization.
- Restore/import JSON backup into current notebook.
- Restore/import ZIP backup into current notebook.
- Bulk notebook export as JSON.
- Bulk notebook export as ZIP.
- Include tags in bulk export.
- Include source folders in bulk export.
- Bulk notebook import from JSON.
- Bulk notebook import from ZIP.
- Create new notebooks during import.
- Restore tags/folders where present.
- Treat ZIP folders as notebooks.
- Prompt backup export/import.
- Source folder backup export/import.
- Notebook tag backup export/import.

### Prompts

- Prompt manager.
- Add prompts.
- Edit prompts.
- Delete prompts.
- Bulk delete prompts.
- Search prompts.
- Categories.
- Custom category creation.
- Optional slash shortcode.
- Prompt title validation.
- Prompt body validation.
- Pin prompts.
- Usage count tracking.
- JSON import/export.
- Sample prompt import.
- Slash insertion inside NotebookLM chat.
- Keyboard navigation for slash suggestions.
- Insert prompt text into NotebookLM textarea.
- Default prompts: TL;DR, essential questions, surprising insights.

### Account And Auth

- No Google OAuth flow found.
- Injects a script into NotebookLM page context.
- Reads `window.WIZ_global_data`.
- Extracts `SNlM0e` token.
- Extracts `qwAQke` app.
- Extracts `cfb2h` build token.
- Extracts `FdrFJe` `f.sid`.
- Extracts `oPEP7c` email.
- Extracts `authuser` from URL.
- Stores payload in local storage.
- Sends payload to background.
- Stores multiple NotebookLM accounts by email.
- Switch active account.
- Disconnect account.
- Disconnect all accounts.
- Add another account by opening NotebookLM in another Google account.
- Calls NotebookLM private `batchexecute` with credentials included.

### Context Menus

- Parent NotebookLM context menu.
- Add Page to Notebook.
- Extract Links to Notebook.
- Import Playlist to Notebook.
- Import RSS Feed to Notebook.
- Add Link to Notebook.
- Add Selection to Notebook.
- Settings.
- Context-menu preview page.

### Settings And Customization

- Theme: system/light/dark.
- Interface language.
- Output language.
- Favorite interface languages.
- Favorite output languages.
- Quick language buttons.
- Auto-apply NotebookLM `hl` language URL.
- Floating language switcher.
- Switcher show/hide.
- Switcher position.
- Switcher orientation.
- Switcher collapsed state.
- Tag display on NotebookLM home cards.
- Tag display on notebook detail.
- All-tags bar display.
- Tab behavior after import.
- Open NotebookLM and extension tab.
- Open NotebookLM only.
- Open extension only.
- Silent behavior.
- Open tabs in background option.

### Monetization And Licensing

- License key activation.
- License validation.
- License deactivation.
- Customer email display.
- Masked license key display.
- Expiration display.
- Last verified display.
- Customer portal link.
- Pricing/purchase links.
- Feedback links.
- Unlicensed banner.
- Continue unlicensed option.
- Buy license option.
- License benefits panel.
- Multi-type Studio generation license gate.

### Diagnostics And Feedback

- Toast notifications.
- Progress bars.
- Error states for invalid files.
- Error states for failed fetch.
- Quota/rate limit messages.
- Stale source messages.
- Expired audio URL handling.
- License API failure handling.
- UserJot feedback links.
- Badge reflects auth state/count.

### Permissions And Hosts

- `storage`.
- `sidePanel`.
- `contextMenus`.
- `unlimitedStorage`.
- `tabs`.
- `scripting`.
- NotebookLM host access.
- All HTTP/HTTPS host access.
- Web-accessible app assets.
- Content script on NotebookLM only.

### Limitations And Risks

- Uses private NotebookLM RPCs.
- Stores NotebookLM page tokens in extension storage.
- NotebookLM DOM and RPC changes can break features.
- Some Studio multi-generation features require license.
- Source folders are extension-local/private, while labels are native NotebookLM.

## 4. FolderLM

Source folder: `extension-inspection-4`

### Core Features

- FolderLM for NotebookLM organization.
- Notebook folders.
- Dashboard workspace.
- Bulk import.
- Merge sources/notebooks.
- Prompt management.
- Fullscreen/layout tools.
- Source tools.
- Citation tools.
- Copy citations.
- Cloud sync.
- Google OAuth for FolderLM account.
- Firebase/Firestore sync.
- NotebookLM direct RPC imports.
- Platform imports from AI chat and YouTube pages.

### UI Surfaces

- Browser popup.
- Auth gate page.
- Dashboard/workspace page.
- NotebookLM injected content UI.
- Platform import content UI.
- Context menu import UI.
- Shadow-DOM link picker.
- NotebookLM folder cards.
- NotebookLM folder modal.
- NotebookLM prompt modal.
- NotebookLM citation/source tools.
- NotebookLM layout controls.

### Popup Features

- Google sign-in.
- Sign-out.
- Switch account.
- Reset account.
- Sync folders CTA.
- Current page import.
- Select target NotebookLM notebook.
- Search cached NotebookLM notebooks.
- Create/import flow.
- Academic import panel.
- Prompt library.
- Prompt search.
- Prompt folder filter.
- Prompt tag filter.
- Favorite prompt toggle.
- Create prompt.
- Edit prompt.
- Delete prompt.
- Copy prompt.
- Rating stars.
- Chrome Web Store review link.
- Feedback form.
- Dark/system/light theme.
- Internationalized copy.

### Dashboard Features

- Sidebar pages for notebooks.
- Sidebar pages for sources.
- Sidebar pages for folders.
- Sidebar page for merge notebooks.
- Sidebar page for prompts.
- Sidebar page for bulk import.
- Sidebar page for notebook controls.
- Help/support page.
- Workspace search.
- Command palette.
- Account menu.
- Appearance menu.
- Language menu.
- Beta banner.
- Product Hunt promo.
- FAQ link.
- Troubleshooting link.
- Roadmap link.
- Privacy/permissions link.
- Contact/bug report link.

### Notebook Registry And Cache

- Capture notebook IDs.
- Capture canonical notebook URLs.
- Capture source counts.
- Capture notebook titles.
- Track title quality/source.
- Track `authuser`.
- Track created timestamp.
- Track updated timestamp.
- Track opened timestamp.
- Track activity timestamp.
- First NotebookLM sync flow.
- Open/refresh NotebookLM home to populate cache.
- Recovery states: Open NotebookLM / Check again.
- Notebook snapshot retry pipeline.
- Placeholder title rejection.
- Verified title sources.

### Notebook Dashboard

- List view.
- Grid view.
- Notebook rows/cards.
- Source count pills.
- Created date display.
- Empty notebook state.
- Refresh controls.
- Pin notebooks.
- Unpin notebooks.
- Bulk pin.
- Bulk unpin.
- Folder filter.
- Sort menu.
- Global search.
- Open notebook in NotebookLM.
- Create notebook CTA.
- Create notebook lifecycle reconciliation.

### Folders

- Create folders.
- Folder name.
- Folder emoji.
- Folder color.
- Folder cards.
- Theme-aware folder cards.
- Folder modal.
- Show notebooks inside folder.
- Grid/list/table-like folder views.
- Rename/edit folder.
- Delete folder.
- Remove notebook from folder.
- Drag notebooks into folders.
- Dashboard folder page.
- Folder tiles.
- Bulk apply folder to notebooks.
- Bulk apply folder to sources.
- Stale notebook cleanup.

### NotebookLM Direct RPC Integration

- Fetches NotebookLM bootstrap tokens from NotebookLM HTML.
- Uses `SNlM0e` token.
- Uses `cfb2h` build token.
- Calls `https://notebooklm.google.com/_/LabsTailwindUi/data/batchexecute`.
- Uses `credentials: include`.
- Caches NotebookLM tokens briefly.
- Detects `authuser` from NotebookLM tabs.
- RPC `CCqFvf` for create notebook.
- RPC `rLM1Ne` for source/project status.
- RPC `hizoJc` for source content.
- RPC `izAoDd` for add text/GDoc/URL source.
- RPC `o4cbdc` for PDF upload init.
- RPC `WWINqb` for delete notebook.

### NotebookLM Network Watching

- Injects `notebook-network-hook.js`.
- Intercepts page `fetch`.
- Intercepts `XMLHttpRequest`.
- Watches NotebookLM `batchexecute` mutation RPCs.
- Detects notebook creation.
- Detects notebook deletion.
- Detects source added.
- Detects source deleted.
- Detects source synced/refreshed.
- Ignores noisy read-only RPCs.
- Posts mutation events to content script.
- Refreshes local notebook/folder cache after mutations.

### Notebook Import, Export, Merge

- Create NotebookLM notebook via RPC.
- Fallback UI creation path.
- Delete NotebookLM notebook via RPC.
- Merge two or more notebooks.
- Read sources from selected notebooks.
- Create merged notebook.
- Import Google Docs directly.
- Import readable sources as text.
- Confirm imported source count.
- Finalize title.
- Preserve merge metadata.
- Progress feedback.
- Workspace backup.
- Workspace restore.
- Folder backup.
- Folder restore.
- Download selected sources.
- Export chat.
- Math-aware exports.
- Citation-aware exports.

### Source Tools

- Dashboard source index.
- Filter by notebook.
- Filter by folder.
- Filter by source type.
- Quick source views.
- Sort by recent.
- Sort by oldest.
- Sort by name.
- Sort by notebook.
- Sort by type.
- Sort by duplicates.
- Open source.
- Preview source.
- Download source.
- Delete source.
- Bulk sync Google Docs.
- Bulk delete bad sources.
- Bulk add tags.
- Bulk remove tags.
- Bulk move to folder.
- Bulk download.
- Bulk delete.
- Track live source content.
- Track source metadata.
- Track added dates.
- Track source URLs.
- Track bibliography metadata.
- Track PDF locators.
- Track web page locators.
- Track YouTube timestamps.
- Track Google Doc sections.

### Citations And Math

- Observe NotebookLM response DOM.
- Build citation state.
- Map response citations to source records.
- Cache citation preferences/state.
- Copy response with citations.
- Open citation action menu.
- Source legend.
- Bibliography output.
- Resolved/unresolved citation status.
- Pending/partial/mapped states.
- Citation trace panel.
- Citation legend panel.
- Clipboard text payload.
- Clipboard HTML payload.
- KaTeX math rendering.
- Math parser.
- Math serializer.
- Math runtime.
- Math export.
- HTML export with KaTeX CSS/fonts.

### Prompts

- Popup prompt library.
- Dashboard prompt library.
- Prompt folders.
- Prompt tags.
- Favorite prompts.
- Create prompt.
- Edit prompt.
- Delete prompt.
- Search prompts.
- Copy prompt.
- Import prompts.
- Export prompts.
- Sample prompts.
- Inject prompt tools into NotebookLM.
- Insert prompt into NotebookLM chat input.
- Prompt modal inside NotebookLM.
- Prompt folders inside injected UI.
- Prompt favorites inside injected UI.
- Prompt search inside injected UI.

### Layout And Fullscreen

- Fullscreen NotebookLM.
- Exit fullscreen.
- Wide content mode.
- Compact panels mode.
- Focus workspace mode.
- Small-screen assist.
- Managed action button sync.
- Layout state persistence.
- Notebook screen UI.
- Browser fullscreen helper.
- Notebook controls settings.
- Toggle prompts control.
- Toggle fullscreen control.
- Toggle citations/sources control.
- Toggle ChatGPT import control.
- Toggle Gemini import control.
- Toggle Claude import control.
- Toggle Grok import control.
- Toggle DeepSeek import control.
- Toggle YouTube import control.
- Some broader import/export controls marked coming soon.

### Platform Imports

- Shared import extraction engine.
- Stable source IDs.
- Canonical source URLs.
- Source fingerprints.
- Markdown export of chat conversations.
- Plain text export of chat conversations.
- ChatGPT import.
- Gemini import.
- Claude import.
- Grok import.
- DeepSeek import.
- YouTube import.
- Google Docs URL import.
- Ordinary web link import.
- Context link import.
- Perplexity support removed.

### ChatGPT Import

- Supports `chatgpt.com`.
- Supports `chat.openai.com`.
- Extracts conversation messages.
- Extracts user/assistant roles.
- Extracts title.
- Extracts canonical `/c/{id}` URL.
- Direct text import as `[CHATGPT]`.
- Auto-sync supported.

### Gemini Import

- Supports `gemini.google.com`.
- Extracts conversation messages.
- Extracts title.
- Extracts canonical `/app/{id}` URL.
- Dark mode detection.
- Auto-sync timing.
- Direct text import as `[GEMINI]`.

### Claude Import

- Supports `claude.ai/chat/*`.
- Extracts user/assistant messages.
- Extracts title.
- Extracts canonical chat URL.
- Floating/header fallback UI.
- Dark mode support.
- Direct text import as `[CLAUDE]`.

### Grok Import

- Supports `grok.com`.
- Supports conversation pages.
- Supports shared conversation pages.
- Extracts messages.
- Extracts linked sources.
- Dark mode support.
- Direct text import as `[GROK]`.

### DeepSeek Import

- Supports `chat.deepseek.com/a/chat/s/*`.
- Extracts conversation title.
- Extracts messages.
- Extracts canonical URL.
- Direct text import as `[DEEPSEEK]`.

### YouTube Import

- Supports `youtube.com`.
- Supports `m.youtube.com`.
- Supports `youtu.be`.
- Supports `youtube-nocookie.com`.
- Supports single video.
- Supports watch page with playlist context.
- Supports playlist.
- Supports search results.
- Supports channel.
- Extracts canonical video URLs.
- Extracts playlist URLs.
- Batches videos into NotebookLM URL-source imports.
- Deduplicates already imported videos per notebook.
- Respects NotebookLM source limit.
- Manual-only import.
- Rejects auto-sync for YouTube.
- Max video URL constant around 50.

### Academic Import

- Detects arXiv pages.
- Detects arXiv PDF pages.
- Detects PubMed pages.
- Detects Semantic Scholar pages.
- Detects Google Scholar pages.
- arXiv metadata extraction.
- PubMed metadata extraction.
- Semantic Scholar metadata extraction.
- Formats academic paper import as Markdown.
- Imports academic data as direct text source.
- Google Scholar manual import panel.
- Google Scholar paste fields for title/citation/BibTeX/DOI/arXiv ID/PMID/paper URL.
- Context menu metadata from Google Scholar result cards.

### Bulk Import

- Bulk links textarea.
- Browser tabs import.
- RSS URL import.
- CSV import.
- Crawler URL import.
- YouTube URL/list import.
- Book import.
- Existing notebook target.
- Create new notebook target.
- Progress card.
- Total/completed/success/failed/skipped counts.
- NotebookLM auth failure handling.
- NotebookLM refresh-required handling.
- NotebookLM source-limit handling.

### Book Import

- PDF import.
- EPUB import.
- EPUB ZIP parsing.
- EPUB package/nav/NCX/spine parsing.
- PDF parsing with pdf.js when available.
- Raw PDF text fallback.
- Extract book title.
- Extract author.
- Extract publisher.
- Extract language.
- Extract identifiers.
- Extract published date.
- Extract page count.
- Detect table of contents.
- Build TOC tree.
- Build chapter candidates.
- Build section candidates.
- Select split level.
- Select chapter/section nodes.
- Create chapter artifacts.
- Duplicate keys/checksums.
- Upload PDF chapter artifacts.
- Upload text chapters.
- Batch size for book import.

### Context Menus

- Parent link import menu.
- Import to selected notebook.
- Choose notebook/create new.
- Supports normal web links.
- Supports Google Scholar result metadata.
- Shadow-DOM picker.
- Toasts on page.
- Recent notebook picker.
- All notebooks search.
- Save default selected notebook.

### Cloud Sync And Auth

- Google OAuth via `chrome.identity.getAuthToken`.
- Fallback web auth flow via `chrome.identity.launchWebAuthFlow`.
- Google userinfo API.
- Firebase Identity Toolkit sign-in.
- Refreshable Firebase session.
- Local persisted auth state.
- Silent session restore.
- Firestore project sync.
- Collections for snapshots, sync state, merge history.
- Sync folders snapshot.
- Sync prompts snapshot.
- Sync notebook metadata snapshot.
- Sync preferences snapshot.
- Legacy root-doc folder mirror/migration.
- Local-first architecture.
- Device ID.
- Last writer metadata.

### Settings And Internationalization

- Theme: system/light/dark.
- Language selection.
- Large locale registry.
- Dashboard i18n.
- Popup i18n.
- Injected UI i18n.
- Folder UI i18n.
- Auth gate i18n.
- Sort preference.
- Notebook view preference.
- Notebook controls preferences.
- Favorites preferences.

### Feedback, Ratings, And Support

- Rating stars.
- Chrome Web Store review link.
- General feedback form.
- Low-rating feedback form.
- Help/support page.
- FAQ.
- Troubleshooting.
- Roadmap.
- Privacy/permissions links.
- Contact/bug report.

### Explicit Limitations

- YouTube auto-sync disabled; manual import only.
- Book import supports only PDF and EPUB.
- NotebookLM login/session required for RPC operations.
- NotebookLM source limit constrains import/merge/book flows.
- Google Scholar academic import is manual-only.
- Some Notebook controls are coming soon/unavailable.
- Perplexity support removed.
- NotebookLM DOM/RPC token changes can break features.

## Cross-Addon Feature Groups For NotebookTools Planning

### Safe MVP Features To Copy First

- No `cookies` permission.
- Use signed-in NotebookLM session with `credentials: include`.
- Fetch NotebookLM HTML and parse `SNlM0e` / `cfb2h`.
- Keep all private NotebookLM RPC logic in one client file.
- List notebooks.
- Create notebook.
- Add YouTube URL source.
- Add selected text source.
- Add current webpage URL source.
- Add local fallback storage/export.
- Add YouTube in-page button.
- Add popup import flow.
- Add clear sign-in/refresh error states.

### Medium-Term Features

- Page link extraction.
- RSS import.
- Playlist import with selection.
- Open tabs import.
- Context menu link import.
- Context menu selected text import.
- Notebook search.
- Source count display.
- Recently used notebook.
- Default notebook selection.
- Import progress.
- Duplicate prevention.
- Source limit detection.
- Import retry.

### Advanced Features

- Notebook dashboard.
- Tags.
- Source folders.
- Native NotebookLM labels.
- Bulk export/import.
- Source management.
- Source merge.
- Duplicate cleanup.
- Citation tools.
- Prompt library.
- ChatGPT/Gemini/Claude/Grok/DeepSeek import.
- Academic import.
- Book import.
- Cloud sync.
- Account system.
- Licensing.

### Highest-Risk Features

- Private NotebookLM RPC expansion.
- NotebookLM DOM injection.
- NotebookLM network interception.
- YouTube internal API browsing.
- Cloud sync of user data.
- Token storage.
- Audio/podcast backend.
- Large all-sites content scripts.
- Paid licensing system.
