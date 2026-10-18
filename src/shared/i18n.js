/* Localize extension-owned UI only. Roblox labels and user content are separate. */
(() => {
  'use strict';
  const messages = [
    ['Recent servers are not included in full backups.', '完整备份不包含最近服务器。', '完整備份不包含最近伺服器。'],
    ['Recent servers', '最近的服务器', '最近的伺服器'],
    ['View recent servers', '查看最近服务器', '查看最近伺服器'],
    ['Remember recent servers', '记录最近服务器', '記錄最近伺服器'],
    ['Keeps a separate list of up to 6 servers for each game and account, removing that game’s oldest entry when full. Checks Roblox presence while your browser runs, independently of playtime tracking.', '为每个账号的每个游戏单独保存最多 6 个服务器，满额后移除该游戏最旧的记录。浏览器运行时检查 Roblox 状态，与游戏时长记录分开控制。', '為每個帳號的每個遊戲分別儲存最多 6 個伺服器，額滿後移除該遊戲最舊的記錄。瀏覽器執行時檢查 Roblox 狀態，與遊戲時間記錄分開控制。'],
    ['Server history is enabled.', '服务器历史记录已开启。', '伺服器歷史記錄已開啟。'],
    ['Server history is paused. Saved servers are kept.', '服务器历史记录已暂停，已保存的服务器会保留。', '伺服器歷史記錄已暫停，已儲存的伺服器會保留。'],
    ['Sign in to Roblox to view recent servers.', '登录 Roblox 以查看最近服务器。', '登入 Roblox 以查看最近伺服器。'],
    ['Could not load recent servers. Please try again.', '无法加载最近服务器，请重试。', '無法載入最近伺服器，請重試。'],
    ['Your Roblox account changed. Refresh recent servers.', 'Roblox 账号已变更，请刷新最近服务器。', 'Roblox 帳號已變更，請重新整理最近伺服器。'],
    ['This server is no longer in your history.', '此服务器已不在历史记录中。', '此伺服器已不在歷史記錄中。'],
    ['Rejoin', '重新加入', '重新加入'],
    ['Remove', '移除', '移除'],
    ['Check availability', '检查可用性', '檢查可用性'],
    ['Checking server…', '正在检查服务器…', '正在檢查伺服器…'],
    ['Server available.', '服务器可用。', '伺服器可用。'],
    ['Server full. Check again later.', '服务器已满，请稍后再检查。', '伺服器已滿，請稍後再檢查。'],
    ['This public server is no longer available.', '此公共服务器已不可用。', '此公開伺服器已無法使用。'],
    ['Not listed publicly. The server may be private or closed.', '未在公共列表中找到，服务器可能为私人或已关闭。', '未在公開清單中找到，伺服器可能為私人或已關閉。'],
    ['Availability could not be confirmed. You can try rejoining.', '无法确认可用性，你可以尝试重新加入。', '無法確認可用性，你可以嘗試重新加入。'],
    ['Availability not checked.', '尚未检查可用性。', '尚未檢查可用性。'],
    ['No recent servers yet. Play a game while tracking is enabled.', '暂无最近服务器，请在开启记录后游玩游戏。', '尚無最近伺服器，請在開啟記錄後遊玩遊戲。'],
    ['Search recent servers', '搜索最近服务器', '搜尋最近伺服器'],
    ['Rejoin opens Roblox. Closed, full, or restricted servers may reject the join.', '重新加入会打开 Roblox。已关闭、已满或受限制的服务器可能拒绝加入。', '重新加入會開啟 Roblox。已關閉、已滿或受限制的伺服器可能拒絕加入。'],
    ['Delete recent servers', '删除最近服务器', '刪除最近伺服器'],
    ['Delete recent servers for this account?', '删除此账号的最近服务器记录？', '刪除此帳號的最近伺服器記錄？'],
    ['Clear this game', '清空此游戏', '清空此遊戲'],
    ['Delete recent servers for this game?', '删除此游戏的最近服务器记录？', '刪除此遊戲的最近伺服器記錄？'],
    ['Recent servers for all accounts are also deleted.', '也会删除所有账号的最近服务器记录。', '也會刪除所有帳號的最近伺服器記錄。'],
    ['Author:', '作者：', '作者：'],
    ['GitHub repository', 'GitHub 仓库', 'GitHub 儲存庫'],
    ['Terms of Service', '服务条款', '服務條款'],
    ['Privacy Policy', '隐私政策', '隱私權政策'],
    ['Welcome to Roblox Customizer', '欢迎使用 Roblox Customizer', '歡迎使用 Roblox Customizer'],
    ['Please read and accept the Terms of Service for Roblox Customizer.', '请阅读并接受 Roblox Customizer 的服务条款。', '請閱讀並接受 Roblox Customizer 的服務條款。'],
    ['The Privacy Policy explains how the extension handles your data.', '隐私政策说明扩展如何处理你的数据。', '隱私權政策說明擴充功能如何處理你的資料。'],
    ['Accept and continue', '接受并继续', '接受並繼續'],
    ['Not now', '暂不接受', '暫不接受'],
    ['Saving acceptance…', '正在保存接受状态…', '正在儲存接受狀態…'],
    ['Could not save your acceptance. Please try again.', '无法保存你的接受状态，请重试。', '無法儲存你的接受狀態，請重試。'],
    ['Settings categories', '设置分类', '設定分類'],
    ['Settings content', '设置内容', '設定內容'],
    ['Appearance', '外观', '外觀'],
    ['Social', '社交', '社群'],
    ['Language & data', '语言与数据', '語言與資料'],
    ['Backup and restore', '备份与恢复', '備份與還原'],
    ['Export backup', '导出备份', '匯出備份'],
    ['Import backup', '导入备份', '匯入備份'],
    ['Reading backup...', '正在读取备份…', '正在讀取備份…'],
    ['Review backup before importing', '导入前检查备份', '匯入前檢查備份'],
    ['Import and replace', '导入并替换', '匯入並取代'],
    ['Backups include extension appearance, language, Home and social settings, currency preference, pinned games and folders, hidden recommendations, and playtime for every recorded Roblox account. A saved background file or URL is included when present.', '备份包含扩展外观、语言、主页和社交设置、货币偏好、置顶游戏与文件夹、隐藏的推荐内容，以及所有已记录 Roblox 账号的游玩时长。如果有保存的背景文件或网址，也会一并包含。', '備份包含擴充功能外觀、語言、首頁和社群設定、貨幣偏好、釘選遊戲與資料夾、隱藏的推薦內容，以及所有已記錄 Roblox 帳號的遊玩時長。如有儲存的背景檔案或網址，也會一併包含。'],
    ["Import replaces the backed-up settings, pinned games, folders, and playtime histories in this browser; it does not merge them. Playtime remains linked to its original Roblox account and does not become the current account's playtime. Roblox account data, Robux, purchases, and game progress are not included.", '导入会替换此浏览器中对应的设置、置顶游戏、文件夹和游玩记录，不会合并。游玩时长仍属于原 Roblox 账号，不会变成当前账号的游玩时长。备份不包含 Roblox 账号数据、Robux、购买记录或游戏进度。', '匯入會取代此瀏覽器中對應的設定、釘選遊戲、資料夾及遊玩紀錄，不會合併。遊玩時長仍屬於原 Roblox 帳號，不會變成目前帳號的遊玩時長。備份不包含 Roblox 帳號資料、Robux、購買紀錄或遊戲進度。'],
    ['This backup contains your extension appearance, Home and social settings, currency preference, pinned games and folders, and playtime histories.', '此备份包含扩展外观、主页和社交设置、货币偏好、置顶游戏与文件夹以及游玩记录。', '此備份包含擴充功能外觀、首頁和社群設定、貨幣偏好、釘選遊戲與資料夾及遊玩紀錄。'],
    ['This file has {games} pinned games, {folders} folders, and {records} playtime records across {accounts} Roblox accounts.', '此文件包含 {games} 个置顶游戏、{folders} 个文件夹，以及分属 {accounts} 个 Roblox 账号的 {records} 条游玩记录。', '此檔案包含 {games} 個釘選遊戲、{folders} 個資料夾，以及分屬 {accounts} 個 Roblox 帳號的 {records} 筆遊玩紀錄。'],
    ['An uploaded background image or video is included.', '包含上传的背景图片或视频。', '包含上傳的背景圖片或影片。'],
    ['A saved background URL is included; no uploaded file is included.', '包含保存的背景网址，但不包含上传的文件。', '包含儲存的背景網址，但不包含上傳的檔案。'],
    ['No uploaded background file is included.', '不包含上传的背景文件。', '不包含上傳的背景檔案。'],
    ["Playtime stays with the original Roblox accounts listed below. If you sign in to a different account, this history will not appear as that account's Home playtime after the next account check; the records remain stored.", '游玩记录仍属于下列原 Roblox 账号。如果登录其他账号，下次检查账号后，这些记录不会显示为该账号的主页游玩时长；记录本身仍会保留。', '遊玩紀錄仍屬於下列原 Roblox 帳號。如果登入其他帳號，下次檢查帳號後，這些紀錄不會顯示為該帳號的首頁遊玩時長；紀錄本身仍會保留。'],
    ['No playtime history is included.', '不包含游玩记录。', '不包含遊玩紀錄。'],
    ['Unknown account', '未知账号', '未知帳號'],
    ['And {count} more accounts.', '还有 {count} 个账号。', '還有 {count} 個帳號。'],
    ['Roblox account data, Robux, purchases, and game progress cannot be imported.', '无法导入 Roblox 账号数据、Robux、购买记录或游戏进度。', '無法匯入 Roblox 帳號資料、Robux、購買紀錄或遊戲進度。'],
    ['Live playtime samples and exchange-rate or social-feed caches are not imported.', '不会导入正在进行的游玩计时、汇率缓存或社交动态缓存。', '不會匯入正在進行的遊玩計時、匯率快取或社群動態快取。'],
    ['Import replaces saved extension settings, pinned games, folders, and playtime histories in this browser; it does not merge them. Export your current data first if you may want to restore it.', '导入会替换此浏览器中保存的扩展设置、置顶游戏、文件夹和游玩记录，不会合并。如需日后恢复，请先导出当前数据。', '匯入會取代此瀏覽器中儲存的擴充功能設定、釘選遊戲、資料夾及遊玩紀錄，不會合併。如需日後還原，請先匯出目前資料。'],
    ['Only Roblox Customizer JSON backups up to 256 MB can be imported. Live playtime samples and exchange-rate or social-feed caches are not included.', '仅支持不超过 256 MB 的 Roblox Customizer JSON 备份。不包含正在进行的游玩计时、汇率缓存或社交动态缓存。', '僅支援不超過 256 MB 的 Roblox Customizer JSON 備份。不包含正在進行的遊玩計時、匯率快取或社群動態快取。'],
    ['Reset All', '重置全部', '重設全部'],
    ['Reset all extension data?', '重置所有扩展数据？', '重設所有擴充功能資料？'],
    ['This permanently deletes all settings, uploaded backgrounds, pinned games and folders, and playtime history for every account in this browser. This cannot be undone.', '这将永久删除此浏览器中所有账号的设置、上传的背景、置顶游戏和文件夹以及游玩记录。此操作无法撤销。', '這將永久刪除此瀏覽器中所有帳號的設定、上傳的背景、釘選遊戲和資料夾，以及遊玩紀錄。此操作無法復原。'],
    ['Resetting all data...', '正在重置所有数据…', '正在重設所有資料…'],
    ['Reset could not finish. Check your saved data before trying again.', '重置未能完成。请检查已保存的数据后再试。', '重設未能完成。請檢查已儲存的資料後再試。'],
    ['Preparing backup...', '正在准备备份…', '正在準備備份…'],
    ['Importing backup...', '正在导入备份…', '正在匯入備份…'],
    ['Backup exported.', '备份已导出。', '備份已匯出。'],
    ['Backup imported.', '备份已导入。', '備份已匯入。'],
    ['Invalid backup file. No data was imported.', '备份文件无效，未导入任何数据。', '備份檔案無效，未匯入任何資料。'],
    ['This backup version is not supported. No data was imported.', '不支持此备份版本，未导入任何数据。', '不支援此備份版本，未匯入任何資料。'],
    ['Your saved background file is unavailable. Choose it again before exporting.', '无法读取已保存的背景文件，请重新选择后再导出。', '無法讀取已儲存的背景檔案，請重新選擇後再匯出。'],
    ['Backup files must be smaller than 256 MB.', '备份文件须小于 256 MB。', '備份檔案須小於 256 MB。'],
    ['Could not access backup data.', '无法读取备份数据。', '無法讀取備份資料。'],
    ['Could not export backup.', '无法导出备份。', '無法匯出備份。'],
    ['Could not import backup. Your existing data was kept.', '无法导入备份，原有数据已保留。', '無法匯入備份，原有資料已保留。'],
    ['Playtime tracking', '游戏时长记录', '遊戲時長記錄'],
    ['Hidden game status may prevent tracking. Past sessions, long connection gaps, and time while your browser is closed cannot be recovered.', '隐藏游戏状态可能导致无法记录。过去的游玩、长时间连接中断及浏览器关闭期间的时长无法补回。', '隱藏遊戲狀態可能導致無法記錄。過去的遊玩、長時間連線中斷及瀏覽器關閉期間的時長無法補回。'],
    ['Enable playtime tracking', '启用游戏时长记录', '啟用遊戲時長記錄'],
    ['Estimates playtime from Roblox presence while your browser is running. Stored only on this computer, separately for each account.', '在浏览器运行时，根据 Roblox 在线状态估算游戏时长。记录仅保存在此电脑上，各账号分别存储。', '在瀏覽器執行時，根據 Roblox 上線狀態估算遊戲時長。記錄僅儲存在此電腦上，各帳號分別儲存。'],
    ['View playtime history', '查看游戏时长记录', '查看遊戲時長記錄'],
    ['Your playtime', '您的游戏时长', '您的遊戲時長'],
    ['Total playtime', '累计游玩时长', '累計遊玩時長'],
    ['Not recorded yet', '暂无记录', '暫無記錄'],
    ['Local estimate for this game.', '此游戏在本机记录的估算时长。', '此遊戲在本機記錄的估算時長。'],
    ['Enable playtime tracking to start recording this game.', '启用游戏时长记录后，即可开始记录此游戏。', '啟用遊戲時長記錄後，即可開始記錄此遊戲。'],
    ['Your most played', '您最常玩的游戏', '您最常玩的遊戲'],
    ['Previous games', '上一组游戏', '上一組遊戲'],
    ['Next games', '下一组游戏', '下一組遊戲'],
    ['View history', '查看记录', '查看記錄'],
    ['Playtime history', '游戏时长记录', '遊戲時長記錄'],
    ['View all', '查看全部', '查看全部'],
    ['Playing now', '正在游玩', '正在遊玩'],
    ['Tracking is paused. Saved totals are kept.', '记录已暂停，已保存的累计时长会保留。', '記錄已暫停，已儲存的累計時長會保留。'],
    ['Waiting for Roblox status.', '正在等待 Roblox 状态。', '正在等待 Roblox 狀態。'],
    ['No game detected. Waiting for your next session.', '尚未检测到游戏，等待您下次游玩。', '尚未偵測到遊戲，等待您下次遊玩。'],
    ['Sign in to Roblox to track playtime.', '请登录 Roblox 以记录游戏时长。', '請登入 Roblox 以記錄遊戲時長。'],
    ['Roblox status is unavailable. Timing is paused until it returns.', '无法获取 Roblox 状态，恢复后将继续记录。', '無法取得 Roblox 狀態，恢復後將繼續記錄。'],
    ['Could not update playtime. Please try again.', '无法更新游戏时长，请重试。', '無法更新遊戲時長，請重試。'],
    ['Saved for {name}', '{name} 的本地记录', '{name} 的本機記錄'],
    ['{hours}h {minutes}m', '{hours}小时 {minutes}分钟', '{hours}小時 {minutes}分鐘'],
    ['{minutes}m', '{minutes}分钟', '{minutes}分鐘'],
    ['{seconds}s', '{seconds}秒', '{seconds}秒'],
    ['{minutes}m {seconds}s', '{minutes}分{seconds}秒', '{minutes}分{seconds}秒'],
    ['{hours}h {minutes}m {seconds}s', '{hours}时{minutes}分{seconds}秒', '{hours}時{minutes}分{seconds}秒'],
    ['{count} sessions', '{count}次游玩', '{count}次遊玩'],
    ['Last played', '上次游玩', '上次遊玩'],
    ['No playtime recorded yet. Join a game with tracking enabled to start.', '暂无时长记录。启用记录后，加入游戏即可开始。', '暫無時長記錄。啟用記錄後，加入遊戲即可開始。'],
    ['Search games', '搜索游戏', '搜尋遊戲'],
    ['Sort playtime', '时长排序', '時長排序'],
    ['Most time played', '游玩时长最多', '遊玩時長最多'],
    ['Recently played', '最近游玩', '最近遊玩'],
    ['No matching games.', '没有匹配的游戏。', '沒有相符的遊戲。'],
    ['Export JSON', '导出 JSON', '匯出 JSON'],
    ['Clear this account', '清除此账号的记录', '清除此帳號的記錄'],
    ['Delete saved playtime', '删除已保存的游戏时长', '刪除已儲存的遊戲時長'],
    ['Delete all saved playtime for this account? This cannot be undone.', '删除此账号的全部本地游戏时长？此操作无法撤销。', '刪除此帳號的全部本機遊戲時長？此操作無法復原。'],
    ['Roblox Customizer', 'Roblox 自定义工具', 'Roblox 自訂工具'],
    ['Extension language', '扩展语言', '擴充功能語言'],
    ['Unsupported Roblox language', '不支持的 Roblox 语言', '不支援的 Roblox 語言'],
    ['Your Roblox language ({language}) is not supported by Roblox Customizer. Some features may not work correctly.', 'Roblox 自定义工具不支持您当前的 Roblox 语言（{language}），部分功能可能无法正常使用。', 'Roblox 自訂工具不支援您目前的 Roblox 語言（{language}），部分功能可能無法正常使用。'],
    ["For the best experience, switch Roblox's language to English, Simplified Chinese, or Traditional Chinese.", '为获得最佳体验，请将 Roblox 语言切换为英语、简体中文或繁体中文。', '為獲得最佳體驗，請將 Roblox 語言切換為英語、簡體中文或繁體中文。'],
    ['Open Roblox language settings', '打开 Roblox 语言设置', '開啟 Roblox 語言設定'],
    ['Continue anyway', '仍然继续', '仍然繼續'],
    ['Continue with fallback', '继续使用兼容模式', '繼續使用相容模式'],
    ['Your Roblox language ({language}) is not supported. Only image backgrounds and custom colors remain active; all other features are disabled to preserve the Roblox interface.', '不支持您当前的 Roblox 语言（{language}）。仅保留图片背景和自定义颜色，其他功能已停用，以保持 Roblox 原有界面。', '不支援您目前的 Roblox 語言（{language}）。僅保留圖片背景和自訂色彩，其他功能已停用，以維持 Roblox 原有介面。'],
    ['Your Roblox language is not supported yet', '当前 Roblox 语言暂未支持', '目前的 Roblox 語言暫未支援'],
    ['Only image backgrounds and custom colors are available. All other features are disabled.', '目前仅可使用图片背景和自定义颜色，其他功能已停用。', '目前僅可使用圖片背景和自訂色彩，其他功能已停用。'],
    ["To use all features, switch Roblox's language to English, Simplified Chinese, or Traditional Chinese.", '如需使用全部功能，请将 Roblox 语言切换为英语、简体中文或繁体中文。', '如需使用全部功能，請將 Roblox 語言切換為英語、簡體中文或繁體中文。'],
    ['Choose an image or GIF file.', '请选择图片或 GIF 文件。', '請選擇圖片或 GIF 檔案。'],
    ['Automatic (Roblox / browser)', '自动（Roblox / 浏览器）', '自動（Roblox / 瀏覽器）'],
    ['Changes save automatically. Sliders and colors apply when released or after a short pause. GIFs and MP4 videos stay animated.', '更改会自动保存。滑块和颜色会在松开或短暂停顿后生效。GIF 和 MP4 视频会保持动态播放。', '變更會自動儲存。滑桿和顏色會在放開或短暫停頓後生效。GIF 和 MP4 影片會保持動態播放。'],
    ['Roblox default background', 'Roblox 默认背景', 'Roblox 預設背景'],
    ['Local file', '本地文件', '本機檔案'],
    ['Image fit', '图片适应方式', '圖片顯示方式'], ['Fill screen', '填满屏幕', '填滿畫面'],
    ['Show entire image', '显示完整图片', '顯示完整圖片'], ['Dark overlay', '背景暗度', '背景暗度'],
    ['Frosted menus and page panels', '毛玻璃菜单和页面面板', '毛玻璃選單與頁面面板'],
    ["Works with Roblox's default background or your own image or video.", '适用于 Roblox 默认背景，以及您自己的图片或视频。', '適用於 Roblox 預設背景，以及您自己的圖片或影片。'],
    ['Frost blur', '模糊强度', '模糊強度'], ['Glass opacity', '面板不透明度', '面板不透明度'],
    ['Disable transparency', '关闭透明效果', '關閉透明效果'], ['Disable blur', '关闭模糊效果', '關閉模糊效果'],
    ['Your blur and opacity values are kept when effects are disabled.', '关闭效果时会保留您的模糊强度和不透明度设置。', '關閉效果時會保留您的模糊強度與不透明度設定。'],
    ['Custom colors', '自定义颜色', '自訂色彩'], ['Experimental', '实验性', '實驗性'],
    ['Enable custom colors', '启用自定义颜色', '啟用自訂色彩'],
    ['Changes text, page and panel backgrounds, and accents. Some Roblox elements may keep their own colors.', '更改文字、页面和面板背景，以及强调色。部分 Roblox 元素可能保留原有颜色。', '變更文字、頁面與面板背景，以及強調色。部分 Roblox 元素可能保留原有色彩。'],
    ['Color palette', '配色', '配色'], ['Text color', '文字颜色', '文字色彩'],
    ['Background color', '背景颜色', '背景色彩'], ['Accent color', '强调色', '強調色'],
    ['Reset and disable', '重置并停用', '重設並停用'],
    ['Home page', '主页', '首頁'], ['Hide Favorites', '隐藏收藏', '隱藏最愛'],
    ['Hide Standout Games', '隐藏精选游戏', '隱藏精選遊戲'],
    ['Hide upper Recommended Games', '隐藏上方推荐游戏', '隱藏上方推薦遊戲'],
    ['Hide lower Recommended Games', '隐藏下方推荐游戏', '隱藏下方推薦遊戲'],
    ['Hidden recommendations', '已隐藏的推荐游戏', '已隱藏的推薦遊戲'],
    ['Use Hide on a recommended game. Restore it here whenever you want.', '点击推荐游戏上的“隐藏”，之后可随时在这里恢复。', '點擊推薦遊戲上的「隱藏」，之後可隨時在這裡恢復。'],
    ['No games hidden individually.', '尚未单独隐藏任何游戏。', '尚未單獨隱藏任何遊戲。'],
    ['Maximum friend list rows', '好友列表最多行数', '好友清單最多列數'],
    ['1 row', '1 行', '1 列'], ['2 rows', '2 行', '2 列'], ['3 rows', '3 行', '3 列'],
    ['Personal greetings', '自定义问候语', '自訂問候語'],
    ['Shown after your name. Leave blank to use the default greeting.', '显示在您的名字后面。留空则使用默认问候语。', '顯示在您的名字後面。留空則使用預設問候語。'],
    ['Morning', '早上', '早上'], ['Afternoon', '下午', '下午'], ['Evening', '晚上', '晚上'],
    ['good morning!', '早上好！', '早安！'], ['good afternoon!', '下午好！', '午安！'], ['good evening!', '晚上好！', '晚安！'],
    ['Home clock', '主页时钟', '首頁時鐘'], ['Show seconds', '显示秒数', '顯示秒數'],
    ['Show date', '显示日期', '顯示日期'], ['Hour format', '时间格式', '時間格式'],
    ['24-hour', '24 小时制', '24 小時制'], ['12-hour', '12 小时制', '12 小時制'],
    ['Social feed panels', '社交动态面板', '社群動態面板'], ['Hide X feed', '隐藏 X 动态', '隱藏 X 動態'],
    ['Hide YouTube feed', '隐藏 YouTube 动态', '隱藏 YouTube 動態'],
    ['Choose feeds separately for each page type.', '分别选择各类页面要启用的动态。', '分別選擇各類頁面要啟用的動態。'],
    ['Game pages', '游戏页面', '遊戲頁面'], ['Community pages', '社群页面', '社群頁面'],
    ['Profile pages', '个人资料页面', '個人檔案頁面'],
    ['Enable X feed', '启用 X 动态', '啟用 X 動態'], ['Enable YouTube feed', '启用 YouTube 动态', '啟用 YouTube 動態'],
    ['Done', '完成', '完成'], ['Close', '关闭', '關閉'],
    ['Hide', '隐藏', '隱藏'], ['Show', '显示', '顯示'], ['Restore', '恢复', '還原'],
    ['Hide this recommendation', '隐藏此推荐游戏', '隱藏此推薦遊戲'],
    ['Hide {name} from recommendations', '从推荐中隐藏 {name}', '從推薦中隱藏 {name}'],
    ['Show {name} in recommendations', '在推荐中显示 {name}', '在推薦中顯示 {name}'],
    ['Open Roblox Customizer settings', '打开 Roblox 自定义工具设置', '開啟 Roblox 自訂工具設定'],
    ['Current file: {name}', '当前文件：{name}', '目前檔案：{name}'], ['Selected file: {name}', '已选择文件：{name}', '已選擇檔案：{name}'],
    ['Loading background...', '正在加载背景…', '正在載入背景…'],
    ['Choose a local file to use as the background.', '请选择一个本地文件作为背景。', '請選擇一個本機檔案作為背景。'],
    ['Choose an image, GIF, or MP4 file.', '请选择图片、GIF 或 MP4 文件。', '請選擇圖片、GIF 或 MP4 檔案。'],
    ['Saved file is unavailable. Choose it again.', '保存的文件不可用，请重新选择。', '儲存的檔案無法使用，請重新選擇。'],
    ['Could not load the saved background.', '无法加载已保存的背景。', '無法載入已儲存的背景。'],
    ['Could not load this background. Check the file or URL.', '无法加载背景，请检查文件或网址。', '無法載入背景，請檢查檔案或網址。'],
    ['Could not load the selected file.', '无法加载所选文件。', '無法載入所選檔案。'],
    ['Could not save settings.', '无法保存设置。', '無法儲存設定。'],
    ['YOUR HOME', '您的主页', '您的首頁'], ['TIME', '时间', '時間'], ['Personal greeting', '个人问候', '個人問候'],
    ['Player avatar', '玩家头像', '玩家頭像'], ["{name}'s avatar", '{name} 的头像', '{name} 的頭像'],
    ['Pinned Games', '置顶游戏', '釘選遊戲'], ['Pin Game', '置顶游戏', '釘選遊戲'], ['Unpin Game', '取消置顶', '取消釘選'],
    ['Pin game to Home', '将游戏置顶到主页', '將遊戲釘選至首頁'], ['Unpin game from Home', '从主页取消置顶', '從首頁取消釘選'],
    ['Unpin game', '取消置顶游戏', '取消釘選遊戲'], ['Unpin {name}', '取消置顶 {name}', '取消釘選 {name}'],
    ['Join Game', '加入游戏', '加入遊戲'], ['Join', '加入', '加入'], ['Join {name}', '加入 {name}', '加入 {name}'],
    ['Use Pin Game on a game page to add public or private games here.', '使用游戏页面上的“置顶游戏”按钮，将公开或私人游戏添加到这里。', '使用遊戲頁面上的「釘選遊戲」按鈕，將公開或私人遊戲加入這裡。'],
    ['Game unpinned', '已取消置顶游戏', '已取消釘選遊戲'],
    ['Game pinned to Home', '游戏已置顶到主页', '遊戲已釘選至首頁'],
    ['All games', '全部游戏', '所有遊戲'], ['Uncategorized', '未分类', '未分類'],
    ['{count} games', '{count} 个游戏', '{count} 個遊戲'],
    ['New folder', '新建文件夹', '新增資料夾'], ['Rename folder', '重命名文件夹', '重新命名資料夾'],
    ['Delete folder', '删除文件夹', '刪除資料夾'], ['Game folders', '游戏文件夹', '遊戲資料夾'],
    ['Folder name', '文件夹名称', '資料夾名稱'], ['Save folder', '保存文件夹', '儲存資料夾'],
    ['Cancel', '取消', '取消'],
    ['Folder', '文件夹', '資料夾'], ['Folder for {name}', '{name} 的文件夹', '{name} 的資料夾'],
    ['Pinned game folder', '置顶游戏文件夹', '釘選遊戲資料夾'],
    ['Choose a folder, then pin this game.', '选择文件夹，然后置顶此游戏。', '選擇資料夾，然後釘選此遊戲。'],
    ['Changing this folder moves the pinned game.', '更改文件夹会移动此置顶游戏。', '變更資料夾會移動此釘選遊戲。'],
    ['Create folders in Pinned Games on Home.', '在主页的“置顶游戏”中创建文件夹。', '在首頁的「釘選遊戲」中建立資料夾。'],
    ['Pinned game moved.', '已移动置顶游戏。', '已移動釘選遊戲。'],
    ['Show more games', '显示更多游戏', '顯示更多遊戲'],
    ['No games in this folder. Choose a folder on a pinned game to move it here.', '此文件夹中暂无游戏。在置顶游戏的卡片上选择文件夹即可将它移到这里。', '此資料夾尚無遊戲。在釘選遊戲的卡片上選擇資料夾，即可將它移到這裡。'],
    ['Folder deleted. Its games are now Uncategorized.', '文件夹已删除，其中的游戏已移至“未分类”。', '資料夾已刪除，其中的遊戲已移至「未分類」。'],
    ['The game or folder no longer exists.', '游戏或文件夹已不存在。', '遊戲或資料夾已不存在。'],
    ['Could not update pinned games. Please try again.', '无法更新置顶游戏，请重试。', '無法更新釘選遊戲，請重試。'],
    ['Could not join this game. Open its page and try again.', '无法加入游戏，请打开游戏页面后重试。', '無法加入遊戲，請開啟遊戲頁面後重試。'],
    ['This game cannot be pinned right now.', '目前无法置顶此游戏。', '目前無法釘選此遊戲。'],
    ['Game information unavailable. Please try again.', '无法获取游戏信息，请重试。', '無法取得遊戲資訊，請重試。'],
    ['Robux currency converter', 'Robux 货币换算', 'Robux 貨幣換算'],
    ['Show currency equivalents across Roblox', '在 Roblox 中显示对应货币估值', '在 Roblox 中顯示對應貨幣估值'],
    ['Find a currency', '查找货币', '尋找貨幣'], ['Currency name or code', '货币名称或代码', '貨幣名稱或代碼'],
    ['Currency', '货币', '貨幣'], ['Refresh rates', '刷新汇率', '重新整理匯率'],
    ['Displays an estimated purchase equivalent. This does not exchange your Robux.', '显示估算的购买等值金额，不会兑换您的 Robux。', '顯示估算的購買等值金額，不會兌換您的 Robux。'],
    ['Example: {value}', '示例：{value}', '範例：{value}'], ['Your balance: {value}', '您的余额：{value}', '您的餘額：{value}'],
    ['Updating exchange rates…', '正在更新汇率…', '正在更新匯率…'],
    ['Using a reference purchase price. Actual checkout prices may vary.', '使用参考购买价格，实际结算价格可能不同。', '使用參考購買價格，實際結帳價格可能不同。'],
    ['Exchange rates: {date}', '汇率日期：{date}', '匯率日期：{date}'],
    ['Exchange rates: {date} · cached, refresh unavailable', '汇率日期：{date} · 使用缓存，暂时无法刷新', '匯率日期：{date} · 使用快取，暫時無法更新'],
    ['No exchange rate available. Other currencies may still be available.', '暂无此货币的汇率，其他货币可能仍可用。', '暫無此貨幣的匯率，其他貨幣可能仍可用。'],
    ['Rates for this currency are unavailable. Use Refresh rates to try again.', '此货币的汇率不可用，请点击“刷新汇率”重试。', '此貨幣的匯率無法使用，請點擊「重新整理匯率」重試。'],
    ['Could not save. Try changing the currency again.', '无法保存，请重新选择货币。', '無法儲存，請重新選擇貨幣。'],
    ['Refresh', '刷新', '重新整理'], ['Refreshing...', '正在刷新…', '正在重新整理…'],
    ['2D Preview', '2D 预览', '2D 預覽'], ['2D avatar preview', '2D 头像预览', '2D 虛擬人偶預覽'],
    ['2D item preview', '2D 物品预览', '2D 物品預覽'], ['Refresh 3D preview', '刷新 3D 预览', '重新整理 3D 預覽'],
    ['Loading 2D preview...', '正在加载 2D 预览…', '正在載入 2D 預覽…'],
    ['Updating 2D preview...', '正在更新 2D 预览…', '正在更新 2D 預覽…'],
    ['Reloading 3D preview...', '正在重新加载 3D 预览…', '正在重新載入 3D 預覽…'],
    ['2D preview is still being generated. Try Refresh.', '2D 预览仍在生成中，请稍后刷新。', '2D 預覽仍在產生中，請稍後重新整理。'],
    ['2D preview unavailable. Try Refresh.', '2D 预览不可用，请尝试刷新。', '2D 預覽無法使用，請嘗試重新整理。'],
    ['Roblox is generating the 2D preview...', 'Roblox 正在生成 2D 预览…', 'Roblox 正在產生 2D 預覽…'],
    ['Could not display the 2D preview.', '无法显示 2D 预览。', '無法顯示 2D 預覽。'],
    ['Profile details', '个人资料详情', '個人檔案詳細資料'], ['Profile sections', '个人资料分区', '個人檔案區塊'],
    ['Copy ID', '复制 ID', '複製 ID'], ['Copied', '已复制', '已複製'], ['Copy failed', '复制失败', '複製失敗'],
    ['Loading account details...', '正在加载账号详情…', '正在載入帳號詳細資料…'],
    ['User ID', '用户 ID', '使用者 ID'], ['Joined', '加入日期', '加入日期'], ['Joined {date}', '加入日期：{date}', '加入日期：{date}'],
    ['Account age', '账号年龄', '帳號年齡'], ['Verified', '已认证', '已驗證'], ['Yes', '是', '是'], ['No', '否', '否'],
    ['Former usernames', '曾用名', '曾用名稱'], ['Previous usernames', '曾用名', '曾用名稱'],
    ['Social links', '社交链接', '社群連結'], ['No bio yet.', '暂无简介。', '尚無簡介。'],
    ['Currently Wearing', '当前穿戴', '目前穿戴'], ['Store', '商店', '商店'], ['Experiences', '游戏体验', '遊戲體驗'],
    ['Favorites', '收藏', '最愛'], ['Collections', '收藏品', '收藏品'], ['Friends', '好友', '好友'],
    ['Communities', '社区', '社群'], ['Badges', '徽章', '徽章'], ['Limited Items', '限量物品', '限量物品'],
    ['Limited items', '限量物品', '限量物品'], ['Loading Limited inventory...', '正在加载限量物品库存…', '正在載入限量物品庫存…'],
    ["View on Rolimon's", "在 Rolimon's 查看", "在 Rolimon's 查看"], ['Show more', '显示更多', '顯示更多'],
    ['Show more ({count} remaining)', '显示更多（剩余 {count}）', '顯示更多（剩餘 {count}）'],
    ['RAP unavailable', '暂无 RAP', '暫無 RAP'], ['RAP: {value}', 'RAP：{value}', 'RAP：{value}'],
    ['Owned: {value}', '拥有：{value}', '擁有：{value}'], ['Known RAP: {value}', '已知 RAP：{value}', '已知 RAP：{value}'],
    ['Owned: {count} | {total} total', '拥有：{count} | 合计 {total}', '擁有：{count} | 合計 {total}'],
    ['Total RAP: {value}', '总 RAP：{value}', '總 RAP：{value}'], ['Total RAP unavailable', '暂无总 RAP', '暫無總 RAP'],
    ['Total RAP: {rap}  |  {copies} copies  |  {unique} unique', '总 RAP：{rap}  |  {copies} 件  |  {unique} 种', '總 RAP：{rap}  |  {copies} 件  |  {unique} 種'],
    ['Known RAP: {rap}  |  {copies} copies  |  {unique} unique', '已知 RAP：{rap}  |  {copies} 件  |  {unique} 种', '已知 RAP：{rap}  |  {copies} 件  |  {unique} 種'],
    ['Limited inventory unavailable.', '限量物品库存不可用。', '限量物品庫存無法使用。'],
    ["Total RAP uses Roblox recent average prices, not Rolimon's Value. Limited bundles may not appear in this list.", '总 RAP 使用 Roblox 的近期平均价格计算，并非 Rolimon\'s 的估值。部分限量套装可能不会出现在此列表中。', '總 RAP 使用 Roblox 的近期平均價格計算，並非 Rolimon\'s 的估值。部分限量組合可能不會出現在此清單中。'],
    ['No Limited assets found in this inventory.', '此库存中没有限量物品。', '此庫存中沒有限量物品。'],
    ['{count} copies have no RAP and are excluded from the total.', '{count} 件物品没有 RAP，未计入总额。', '{count} 件物品沒有 RAP，未計入總額。'],
    ['This inventory is private or unavailable.', '此库存为私密或暂时不可用。', '此庫存為私人或暫時無法使用。'],
    ['Roblox rate limit reached. Try again later.', '已达到 Roblox 请求限制，请稍后重试。', '已達到 Roblox 請求限制，請稍後重試。'],
    ['Country', '国家 / 地区', '國家 / 地區'], ['All countries', '所有国家 / 地区', '所有國家 / 地區'],
    ['Minimum latency (ms)', '最低延迟（毫秒）', '最低延遲（毫秒）'], ['Maximum ping (ms)', '最高延迟（毫秒）', '最高延遲（毫秒）'],
    ['Minimum players', '最少玩家数', '最少玩家數'], ['Maximum players', '最多玩家数', '最多玩家數'],
    ['Sort players', '玩家数排序', '玩家數排序'], ['Default order', '默认顺序', '預設順序'],
    ['Fewest players first', '玩家最少优先', '玩家最少優先'], ['Most players first', '玩家最多优先', '玩家最多優先'],
    ['Search', '搜索', '搜尋'], ['Stop', '停止', '停止'], ['Reset', '重置', '重設'], ['Any', '不限', '不限'],
    ['Filter servers by country', '按国家 / 地区筛选服务器', '依國家 / 地區篩選伺服器'],
    ['{label} in milliseconds', '{label}（毫秒）', '{label}（毫秒）'],
    ['Public server pages', '公共服务器分页', '公開伺服器分頁'],
    ['← Previous', '← 上一页', '← 上一頁'], ['Next →', '下一页 →', '下一頁 →'],
    ['Previous public server page', '上一页公共服务器', '上一頁公開伺服器'], ['Next public server page', '下一页公共服务器', '下一頁公開伺服器'],
    ['Loading…', '正在加载…', '正在載入…'], ['Loading...', '正在加载…', '正在載入…'],
    ['Searching…', '正在搜索…', '正在搜尋…'], ['Search stopped.', '搜索已停止。', '搜尋已停止。'],
    ['No matching servers found.', '未找到符合条件的服务器。', '找不到符合條件的伺服器。'],
    ['No matching servers.', '没有符合条件的服务器。', '沒有符合條件的伺服器。'],
    ['No servers loaded.', '尚未加载服务器。', '尚未載入伺服器。'],
    ['Minimum players cannot exceed maximum players.', '最少玩家数不能大于最多玩家数。', '最少玩家數不能大於最多玩家數。'],
    ['Minimum latency cannot exceed maximum ping.', '最低延迟不能大于最高延迟。', '最低延遲不能大於最高延遲。'],
    ['{start}–{end} of {count} matches loaded', '已加载 {count} 个匹配结果，显示 {start}–{end}', '已載入 {count} 個符合結果，顯示 {start}–{end}'],
    ['Private server', '私人服务器', '私人伺服器'],
    ['No players online', '暂无在线玩家', '暫無線上玩家'], ['{count} players online', '{count} 位玩家在线', '{count} 位玩家在線上'],
    ['Player', '玩家', '玩家'], ['Unknown country', '未知国家 / 地区', '未知國家 / 地區'], ['Detecting country…', '正在检测地区…', '正在偵測地區…'],
    ['Ping reported by Roblox; your connection may differ.', '延迟由 Roblox 提供，您的实际连接可能不同。', '延遲由 Roblox 提供，您的實際連線可能不同。'],
    ['Detecting the server country automatically.', '正在自动检测服务器所在国家 / 地区。', '正在自動偵測伺服器所在國家 / 地區。'],
    ['Collapse', '收起', '收合'], ['Expand', '展开', '展開'], ['Reload posts', '重新加载帖子', '重新載入貼文'], ['Reload videos', '重新加载视频', '重新載入影片'],
    ['Loading recent posts via FxEmbed...', '正在通过 FxEmbed 加载最新帖子…', '正在透過 FxEmbed 載入最新貼文…'],
    ['Posts unavailable right now. Try again later or open X.', '暂时无法加载帖子，请稍后重试或打开 X。', '暫時無法載入貼文，請稍後重試或開啟 X。'],
    ['View post on X', '在 X 查看帖子', '在 X 查看貼文'], ['Loading image...', '正在加载图片…', '正在載入圖片…'], ['Image unavailable', '图片不可用', '圖片無法使用'],
    ['Loading recent videos from YouTube...', '正在加载 YouTube 最新视频…', '正在載入 YouTube 最新影片…'],
    ['Videos unavailable right now. Try again later or open YouTube.', '暂时无法加载视频，请稍后重试或打开 YouTube。', '暫時無法載入影片，請稍後重試或開啟 YouTube。'],
    ['Latest on YouTube', 'YouTube 最新视频', 'YouTube 最新影片'], ['Latest on YouTube - {name}', 'YouTube 最新视频 - {name}', 'YouTube 最新影片 - {name}'],
    ['Latest on X - @{name}', 'X 最新帖子 - @{name}', 'X 最新貼文 - @{name}'],
    ['Open @{name} on X', '在 X 打开 @{name}', '在 X 開啟 @{name}'],
    ['Open channel on YouTube', '在 YouTube 打开频道', '在 YouTube 開啟頻道'],
    ['Loading thumbnail...', '正在加载缩略图…', '正在載入縮圖…'], ['Thumbnail unavailable', '缩略图不可用', '縮圖無法使用'],
    ['Watch video on YouTube', '在 YouTube 观看视频', '在 YouTube 觀看影片'],
    ['Recent videos from YouTube.', '来自 YouTube 的最新视频。', '來自 YouTube 的最新影片。'],
    ['No public videos available.', '暂无公开视频。', '暫無公開影片。'],
    ['Game Data', '游戏数据', '遊戲資料'], ['Game data', '游戏数据', '遊戲資料'],
    ['Open game data menu', '打开游戏数据菜单', '開啟遊戲資料選單'], ['Close game data menu', '关闭游戏数据菜单', '關閉遊戲資料選單'],
    ['Open on Rolimons', '在 Rolimons 打开', '在 Rolimons 開啟'], ['Overview', '概览', '總覽'],
    ['Players', '玩家', '玩家'], ['Visits', '访问次数', '造訪次數'], ['Rating', '评分', '評分'],
    ['Upvotes', '赞', '讚'], ['Downvotes', '踩', '倒讚'], ['Average Playtime', '平均游玩时长', '平均遊玩時間'],
    ['Game Updated', '游戏更新日期', '遊戲更新日期'], ['All-Time', '历史最高', '歷史最高'],
    ['Current Game Stats', '当前游戏统计', '目前遊戲統計'],
    ['Past 30 Days', '过去 30 天', '過去 30 天'], ['Past 7 Days', '过去 7 天', '過去 7 天'], ['Past 24 Hours', '过去 24 小时', '過去 24 小時'],
    ['Servers', '服务器', '伺服器'], ['Places', '场景', '場景'], ['Passes', '通行证', '通行證'], ['Products', '商品', '商品'],
    ['Server Statistics', '服务器统计', '伺服器統計'], ['Current Roblox Stats', 'Roblox 当前统计', 'Roblox 目前統計'],
    ['Live Public Roblox Servers', 'Roblox 实时公共服务器', 'Roblox 即時公開伺服器'],
    ['Open Roblox server browser', '打开 Roblox 服务器列表', '開啟 Roblox 伺服器清單'],
    ['Load More Servers', '加载更多服务器', '載入更多伺服器'], ['Load More Badges', '加载更多徽章', '載入更多徽章'], ['Load More Places', '加载更多场景', '載入更多場景'],
    ['Loading data from Rolimons…', '正在从 Rolimons 加载数据…', '正在從 Rolimons 載入資料…'],
    ['Loading data from Roblox…', '正在从 Roblox 加载数据…', '正在從 Roblox 載入資料…'],
    ['Rolimons data could not be read.', '无法读取 Rolimons 数据。', '無法讀取 Rolimons 資料。'],
    ['Rolimons data could not be loaded. Try opening the original page.', '无法加载 Rolimons 数据，请尝试打开原始页面。', '無法載入 Rolimons 資料，請嘗試開啟原始頁面。'],
    ['Roblox data could not be loaded.', '无法加载 Roblox 数据。', '無法載入 Roblox 資料。'],
    ['No data is available for this section.', '此分区暂无数据。', '此區塊暫無資料。'],
    ['No server statistics are available for this game.', '此游戏暂无服务器统计。', '此遊戲暫無伺服器統計。'],
    ['These current totals come directly from Roblox. Roblox does not provide public historical chart points here.', '这些当前统计直接来自 Roblox。Roblox 不在此提供公开的历史图表数据。', '這些目前統計直接來自 Roblox。Roblox 不在此提供公開的歷史圖表資料。'],
    ['This list is provided by Roblox and shows current player counts. Use Roblox’s Servers tab to join an instance.', '此列表由 Roblox 提供，显示当前玩家数。请使用 Roblox 的服务器选项卡加入服务器。', '此清單由 Roblox 提供，顯示目前玩家數。請使用 Roblox 的伺服器分頁加入伺服器。'],
    ['Rolimons’ public game page provides current totals and peak counts. Its interactive time-series charts are available on the original analytics page.', 'Rolimons 的公开游戏页面提供当前统计与峰值。交互式历史图表可在原始分析页面查看。', 'Rolimons 的公開遊戲頁面提供目前統計與峰值。互動式歷史圖表可在原始分析頁面查看。'],
    ['Request timed out. Please try again.', '请求超时，请重试。', '請求逾時，請重試。'],
    ['Extension request unavailable.', '扩展请求暂时不可用。', '擴充功能請求暫時無法使用。'],
    ['No response from the extension.', '扩展未响应。', '擴充功能未回應。'],
    ['Verification', '认证状态', '驗證狀態'], ['None listed', '暂无', '暫無'],
    ['Account details', '账号详情', '帳號詳細資料'], ['Unavailable', '不可用', '無法使用'],
    ['View friends', '查看好友', '查看好友'], ['View inventory', '查看库存', '查看庫存'],
    ['{count} years', '{count} 年', '{count} 年'], ['{count} days', '{count} 天', '{count} 天'],
    ['Could not reload the 3D preview. Try Refresh.', '无法重新加载 3D 预览，请尝试刷新。', '無法重新載入 3D 預覽，請嘗試重新整理。'],
    ['Could not display the 2D preview. Try Refresh.', '无法显示 2D 预览，请尝试刷新。', '無法顯示 2D 預覽，請嘗試重新整理。'],
    ['2D preview unavailable. Reload the page and try again.', '2D 预览不可用，请刷新页面后重试。', '2D 預覽無法使用，請重新整理頁面後重試。'],
    ['Your current avatar in 2D', '您当前头像的 2D 预览', '您目前虛擬人偶的 2D 預覽'],
    ['Reload the 3D model', '重新加载 3D 模型', '重新載入 3D 模型'],
    ['Waiting for Roblox to update the 2D image...', '正在等待 Roblox 更新 2D 图片…', '正在等待 Roblox 更新 2D 圖片…'],
    ['Roblox is still updating the 2D image. Use Refresh to check again.', 'Roblox 仍在更新 2D 图片，请点击“刷新”再次检查。', 'Roblox 仍在更新 2D 圖片，請點擊「重新整理」再次檢查。'],
    ['Unknown', '未知', '未知'], ['Minimum latency in milliseconds', '最低延迟（毫秒）', '最低延遲（毫秒）'],
    ['Maximum ping in milliseconds', '最高延迟（毫秒）', '最高延遲（毫秒）'],
    ['Searching...', '正在搜索…', '正在搜尋…'], ['Searching public servers...', '正在搜索公共服务器…', '正在搜尋公開伺服器…'],
    ['Could not sort the servers. Try Search again.', '无法排序服务器，请再次搜索。', '無法排序伺服器，請再次搜尋。'],
    ['Some server details are still loading. Try Search again.', '部分服务器详情仍在加载，请再次搜索。', '部分伺服器詳細資料仍在載入，請再次搜尋。'],
    ['No public servers match all your filters.', '没有满足全部筛选条件的公共服务器。', '沒有符合全部篩選條件的公開伺服器。'],
    ['Roblox is still loading. Try Search again.', 'Roblox 仍在加载，请再次搜索。', 'Roblox 仍在載入，請再次搜尋。'],
    ['Could not load more servers. Try Search again.', '无法加载更多服务器，请再次搜索。', '無法載入更多伺服器，請再次搜尋。'],
    ['Could not complete the search. Try Search again.', '无法完成搜索，请再次尝试。', '無法完成搜尋，請再次嘗試。'],
    ['Roblox is loading servers. Try Next again in a moment.', 'Roblox 正在加载服务器，请稍后再次点击“下一页”。', 'Roblox 正在載入伺服器，請稍後再次點擊「下一頁」。'],
    ['Could not load more servers. Try Next again.', '无法加载更多服务器，请再次点击“下一页”。', '無法載入更多伺服器，請再次點擊「下一頁」。'],
    ['No matching servers in these batches. Select Next to keep searching.', '这几批服务器中没有匹配结果，请点击“下一页”继续搜索。', '這幾批伺服器中沒有符合結果，請點擊「下一頁」繼續搜尋。'],
    ['No more servers match these filters.', '没有更多符合条件的服务器。', '沒有更多符合條件的伺服器。'],
    ['No servers match these filters.', '没有符合这些条件的服务器。', '沒有符合這些條件的伺服器。'],
    ['Found {count} matching server.', '找到 {count} 个符合条件的服务器。', '找到 {count} 個符合條件的伺服器。'],
    ['Found {count} matching servers.', '找到 {count} 个符合条件的服务器。', '找到 {count} 個符合條件的伺服器。'],
    ['Checking country and ping for {count} loaded servers...', '正在检查已加载的 {count} 个服务器的地区和延迟…', '正在檢查已載入的 {count} 個伺服器的地區與延遲…'],
    ['Searching beyond {count} loaded public servers...', '正在继续搜索已加载的 {count} 个公共服务器之后的结果…', '正在繼續搜尋已載入的 {count} 個公開伺服器之後的結果…'],
    ['0 matches in {count} loaded servers', '已加载 {count} 个服务器，暂无匹配结果', '已載入 {count} 個伺服器，暫無符合結果'],
    ['Page {count}', '第 {count} 页', '第 {count} 頁'], ['No matches', '暂无匹配结果', '暫無符合結果'],
    ['Low latency · {value} ms', '低延迟 · {value} 毫秒', '低延遲 · {value} 毫秒'],
    ['Moderate latency · {value} ms', '中等延迟 · {value} 毫秒', '中等延遲 · {value} 毫秒'],
    ['High latency · {value} ms', '高延迟 · {value} 毫秒', '高延遲 · {value} 毫秒'],
    ['Country {name}', '国家 / 地区：{name}', '國家 / 地區：{name}'],
    ['Approx. country {name}', '估算地区：{name}', '估算地區：{name}'],
    ['Finding country...', '正在检测地区…', '正在偵測地區…'],
    ['Estimated from the server address; Roblox routing may differ.', '根据服务器地址估算，Roblox 的实际路由可能不同。', '根據伺服器位址估算，Roblox 的實際路由可能不同。'],
    ['Show More ({count} remaining)', '显示更多（剩余 {count}）', '顯示更多（剩餘 {count}）'],
    ['{count} of {max} people max', '{count} / {max} 人', '{count} / {max} 人'],
    ['Private server details are unavailable. Retrying...', '无法获取私人服务器详情，正在重试…', '無法取得私人伺服器詳細資料，正在重試…'],
    ['Loading private server details...', '正在加载私人服务器详情…', '正在載入私人伺服器詳細資料…'],
    ['Preview', '预览', '預覽'], ['Recent posts via FxEmbed.', '通过 FxEmbed 获取的最新帖子。', '透過 FxEmbed 取得的最新貼文。'],
    ['No public posts available.', '暂无公开帖子。', '暫無公開貼文。'],
    ['Showing saved posts; live updates are unavailable. Via FxEmbed.', '正在显示已保存的帖子，实时更新暂不可用。内容来自 FxEmbed。', '正在顯示已儲存的貼文，即時更新暫時無法使用。內容來自 FxEmbed。'],
    ['Latest posts from @{name} on X', '来自 @{name} 的 X 最新帖子', '來自 @{name} 的 X 最新貼文'],
    ['Latest videos from this game on YouTube', '此游戏的 YouTube 最新视频', '此遊戲的 YouTube 最新影片'],
    ['Latest videos from this profile on YouTube', '此用户的 YouTube 最新视频', '此使用者的 YouTube 最新影片'],
    ['Latest videos from this community on YouTube', '此社区的 YouTube 最新视频', '此社群的 YouTube 最新影片'],
    ['Post image {count}', '帖子图片 {count}', '貼文圖片 {count}'], ['YouTube video thumbnail', 'YouTube 视频缩略图', 'YouTube 影片縮圖'],
    ['Earned {date}', '获得日期：{date}', '獲得日期：{date}'],
    ['Currency estimate unavailable.', '暂无货币估值。', '暫無貨幣估值。'],
    ['Estimated purchase equivalent using a reference price of {value} per 500 Robux. Actual checkout prices may vary.', '按每 500 Robux 对应 {value} 的参考价格估算，实际结算价格可能不同。', '依每 500 Robux 對應 {value} 的參考價格估算，實際結帳價格可能不同。'],
    ['Estimated purchase equivalent using 4.99 USD per 500 Robux and exchange rates dated {date}.', '按每 500 Robux 对应 4.99 美元和 {date} 的汇率估算。', '依每 500 Robux 對應 4.99 美元和 {date} 的匯率估算。'],
    ['Estimated purchase equivalent using 4.99 USD per 500 Robux and exchange rates dated {date} (cached; refresh unavailable).', '按每 500 Robux 对应 4.99 美元和 {date} 的缓存汇率估算，暂时无法刷新。', '依每 500 Robux 對應 4.99 美元和 {date} 的快取匯率估算，暫時無法更新。']
  ];
  const exact = new Map(messages.map(row => [row[0], row]));
  const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const templates = messages.filter(row => /\{\w+\}/.test(row[0])).map(row => {
    const keys = [...row[0].matchAll(/\{(\w+)\}/g)].map(match => match[1]);
    const parts = row[0].split(/\{\w+\}/).map(escape);
    return { row, keys, pattern: new RegExp('^' + parts.join('(.+?)') + '$') };
  }).sort((a, b) => b.row[0].length - a.row[0].length);
  let preference = 'auto';
  let current = 'en';
  let currentRobloxLanguage = '';
  let preferenceVersion = 0;
  const listeners = new Set();
  const robloxLanguageListeners = new Set();
  const bindings = new Map();
  const pending = new Set();
  let timer = null;

  const ROOTS = '#rc-playtime-home, #rc-playtime-game-page, #rc-playtime-dialog, #rc-playtime-settings, #rc-settings-overlay, #rc-terms-dialog, #rc-language-warning-dialog, .rc-settings-menu-entry, .rc-hide-recommended-game, #rc-home-greeting, '
    + '.rc-game-pin-control, .rc-game-pin-folder, #rc-pinned-games, #rc-pinned-games-notification, #rc-avatar-2d, #rc-catalog-item-2d, '
    + '#rc-catalog-item-3d-refresh, #rc-catalog-item-3d-status, #rc-profile-enhancements, #rc-profile-inline-about, '
    + '#rc-x-feed-panel, #rc-youtube-feed-panel, #rc-rolimons-panel, .rc-public-server-filters, '
    + '.rc-public-server-pagination, .rc-private-server-more, .rc-server-metrics, .rc-private-server-summary, '
    + '.rc-private-server-roster, .rc-private-server-proxy, .rc-private-server-loading, .rc-server-view, .rc-badge-earned-date, .rc-robux-equivalent';
  const IGNORE = '[data-rc-i18n-ignore], script, style, textarea, '
    + '.rc-pinned-game-details, .rc-home-greeting-title, .rc-home-greeting-username, .rc-home-greeting-initial, '
    + '.rc-hidden-recommended-game > span, .rc-limited-item-text > strong, .rc-private-server-title, '
    + '.rc-private-server-owner, .rc-rolimons-data-card';
  const attributes = ['aria-label', 'title', 'placeholder', 'alt'];

  function supportedLocale(value) {
    const locale = String(value || '').trim().replaceAll('_', '-').toLowerCase();
    if (/^en(?:-|$)/.test(locale)) return 'en';
    if (/^zh(?:-|$)/.test(locale)) return /(?:^|-)hant(?:-|$)|(?:^|-)(?:tw|hk|mo)(?:-|$)/.test(locale) ? 'zh-TW' : 'zh-CN';
    return null;
  }
  function robloxLanguage() {
    const meta = document.querySelector('meta[name="locale-data"]');
    return String(meta?.getAttribute('data-language-code') || '').trim()
      || String(document.documentElement?.lang || '').trim();
  }
  function detectedLocale() {
    return supportedLocale(robloxLanguage()
      || globalThis.chrome?.i18n?.getUILanguage?.() || globalThis.navigator?.language) || 'en';
  }
  function resolve(source, values) {
    let row = exact.get(source);
    let parameters = values || {};
    if (!row) for (const template of templates) {
      const match = source.match(template.pattern);
      if (!match) continue;
      row = template.row;
      parameters = Object.fromEntries(template.keys.map((key, index) => [key, match[index + 1]]));
      break;
    }
    if (!row) return null;
    const result = row[current === 'zh-CN' ? 1 : current === 'zh-TW' ? 2 : 0];
    return result.replace(/\{(\w+)\}/g, (match, key) => String(parameters[key] ?? match));
  }
  function t(source, values) { return resolve(String(source), values) ?? String(source); }

  function localizeValue(node, attribute = '') {
    const value = attribute ? node.getAttribute(attribute) : node.data;
    if (value === null || !value?.trim()) return;
    let entries = bindings.get(node);
    const old = entries?.get(attribute);
    const source = old?.rendered === value ? old.source : value;
    const trimmed = source.trim();
    const translated = resolve(trimmed);
    if (translated === null) { entries?.delete(attribute); return; }
    const rendered = source.slice(0, source.indexOf(trimmed)) + translated + source.slice(source.indexOf(trimmed) + trimmed.length);
    if (!entries) bindings.set(node, entries = new Map());
    entries.set(attribute, { source, rendered });
    if (value === rendered) return;
    if (attribute) node.setAttribute(attribute, rendered);
    else node.data = rendered;
  }
  function localize(root) {
    if (!root || root.nodeType !== 1 || root.closest(IGNORE)) return;
    if (!root.closest(ROOTS)) {
      for (const owned of root.querySelectorAll(ROOTS)) localize(owned);
      return;
    }
    if (root.matches(ROOTS) && root.getAttribute('lang') !== current) root.setAttribute('lang', current);
    for (const attribute of attributes) if (root.hasAttribute(attribute)) localizeValue(root, attribute);
    for (const node of root.childNodes) {
      if (node.nodeType === 3) localizeValue(node);
      else if (node.nodeType === 1) localize(node);
    }
  }
  function translateAll() {
    for (const [node, entries] of bindings) {
      if (!node.isConnected) { bindings.delete(node); continue; }
      const element = node.nodeType === 1 ? node : node.parentElement;
      if (!element?.closest(ROOTS) || element.closest(IGNORE)) { bindings.delete(node); continue; }
      for (const attribute of entries.keys()) localizeValue(node, attribute);
    }
    for (const root of document.querySelectorAll(ROOTS)) localize(root);
  }
  function syncLocale() {
    const next = preference === 'auto' ? detectedLocale() : preference;
    if (next !== current) {
      current = next;
      translateAll();
      for (const listener of listeners) {
        try { listener(current); } catch (error) { console.warn('Roblox Customizer: Could not update an interface language.', error); }
      }
    }
    const language = robloxLanguage();
    if (language !== currentRobloxLanguage) {
      currentRobloxLanguage = language;
      for (const listener of robloxLanguageListeners) {
        try { listener(language); } catch (error) { console.warn('Roblox Customizer: Could not update Roblox language support.', error); }
      }
    }
  }
  function setLanguage(value) {
    preferenceVersion++;
    preference = ['en', 'zh-CN', 'zh-TW'].includes(value) ? value : 'auto';
    syncLocale();
  }
  function flush() {
    timer = null;
    for (const root of pending) if (root.isConnected) localize(root);
    pending.clear();
    for (const node of bindings.keys()) if (!node.isConnected) bindings.delete(node);
  }
  function queue(root) {
    if (!root || root.nodeType !== 1 || root.closest(IGNORE)) return;
    if (root.closest(ROOTS)) pending.add(root);
    else for (const owned of root.querySelectorAll(ROOTS)) pending.add(owned);
    if (pending.size && timer === null) timer = setTimeout(flush, 0);
  }
  current = detectedLocale();
  currentRobloxLanguage = robloxLanguage();
  globalThis.RobloxCustomizerI18n = Object.freeze({ t, localize, setLanguage,
    robloxLanguage, isSupportedLanguage: value => supportedLocale(value) !== null,
    onRobloxLanguageChange(listener) { robloxLanguageListeners.add(listener); return () => robloxLanguageListeners.delete(listener); },
    matches: (node, source) => node.textContent === (node.closest(IGNORE) ? source : t(source)),
    attribute(node, attribute, source) {
      if (node.getAttribute(attribute) !== t(source)) node.setAttribute(attribute, source);
    },
    locale: () => current, preference: () => preference,
    onChange(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  });
  new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes' && (record.target === document.documentElement
        || record.target.matches('meta[name="locale-data"]'))) syncLocale();
      if (record.type === 'childList') for (const node of record.addedNodes) {
        if (node.nodeType === 1) queue(node);
        else queue(node.parentElement);
      }
      if (record.type === 'childList' && [...record.addedNodes, ...record.removedNodes].some(node =>
        node.nodeType === 1 && (node.matches('html, meta[name="locale-data"]')
          || node.querySelector('meta[name="locale-data"]')))) syncLocale();
      if (record.type !== 'childList') queue(record.target.nodeType === 1 ? record.target : record.target.parentElement);
    }
  }).observe(document, { subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: ['lang', 'data-language-code', ...attributes] });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.customBackground) setLanguage(changes.customBackground.newValue?.uiLanguage);
  });
  const version = preferenceVersion;
  chrome.storage.local.get('customBackground').then(result => {
    if (version === preferenceVersion) setLanguage(result.customBackground?.uiLanguage);
  }).catch(() => {});
  addEventListener('languagechange', syncLocale);
  document.addEventListener('DOMContentLoaded', syncLocale, { once: true });
  globalThis.RobloxCustomizerRuntime?.onResume(syncLocale);
  queue(document.documentElement);
})();
