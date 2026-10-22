/* Localize extension-owned UI only. Roblox labels and user content are separate. */
(() => {
  'use strict';
  // Columns: English, Simplified Chinese, Traditional Chinese, Bahasa Indonesia, Japanese, Thai, Korean.
  const messages = [
    ["Friend actions","好友操作","好友操作","Tindakan teman","フレンドの操作","การจัดการเพื่อน","친구 작업"],
    ["Chat","聊天","聊天","Obrolan","チャット","แชต","채팅"],
    ["View Profile","查看个人资料","檢視個人檔案","Lihat Profil","プロフィールを見る","ดูโปรไฟล์","프로필 보기"],
    ["{name} is playing","{name} 正在游玩","{name} 正在遊玩","{name} sedang bermain","{name}はプレイ中","{name} กำลังเล่น","{name} 플레이 중"],
    ["Offline","离线","離線","Offline","オフライン","ออฟไลน์","오프라인"],
    ["Online","在线","在線","Online","オンライン","ออนไลน์","온라인"],
    ["In Studio","正在使用 Studio","正在使用 Studio","Di Studio","Studioを使用中","กำลังใช้ Studio","Studio 사용 중"],
    ["Could not load friend activity. Please try again.","无法加载好友状态，请重试。","無法載入好友狀態，請重試。","Tidak dapat memuat aktivitas teman. Coba lagi.","フレンドの状態を読み込めませんでした。再試行してください。","โหลดสถานะเพื่อนไม่ได้ โปรดลองอีกครั้ง","친구 활동을 불러올 수 없습니다. 다시 시도하세요."],
    ["This friend is no longer pinned.","这位好友已取消置顶。","這位好友已取消置頂。","Teman ini tidak lagi disematkan.","このフレンドのピン留めは解除されています。","เพื่อนคนนี้ไม่ได้ปักหมุดแล้ว","이 친구는 더 이상 고정되어 있지 않습니다."],
    ["Roblox has not shared a joinable game for this friend.","Roblox 未提供这位好友可加入的游戏信息。","Roblox 未提供這位好友可加入的遊戲資訊。","Roblox belum membagikan game teman ini yang dapat diikuti.","Robloxからこのフレンドに参加できるゲーム情報が提供されていません。","Roblox ไม่ได้แสดงข้อมูลเกมของเพื่อนคนนี้ที่เข้าร่วมได้","Roblox에서 이 친구와 함께할 수 있는 게임 정보를 제공하지 않았습니다."],
    ["Roblox could not open chat. Try again after the page finishes loading.","Roblox 未能打开聊天，请在页面加载完成后重试。","Roblox 未能開啟聊天，請在頁面載入完成後重試。","Roblox tidak dapat membuka obrolan. Coba lagi setelah halaman selesai dimuat.","Robloxでチャットを開けませんでした。ページの読み込み完了後に再試行してください。","Roblox เปิดแชตไม่ได้ โปรดลองอีกครั้งหลังหน้าโหลดเสร็จ","Roblox 채팅을 열 수 없습니다. 페이지를 모두 불러온 후 다시 시도하세요."],
    ["Roblox could not join this friend. Check their game status and try again.","Roblox 未能加入这位好友，请检查游戏状态后重试。","Roblox 未能加入這位好友，請檢查遊戲狀態後重試。","Roblox tidak dapat bergabung dengan teman ini. Periksa status game mereka dan coba lagi.","このフレンドに参加できませんでした。ゲームの状態を確認して再試行してください。","Roblox เข้าร่วมเพื่อนคนนี้ไม่ได้ โปรดตรวจสอบสถานะเกมแล้วลองอีกครั้ง","이 친구와 함께할 수 없습니다. 게임 상태를 확인하고 다시 시도하세요."],
    ["{count} pinned friends across {accounts} accounts are included. Import replaces saved friend pins, including when this backup contains none.","包含 {accounts} 个账号的 {count} 位置顶好友。导入会替换现有置顶列表，即使备份中没有置顶好友。","包含 {accounts} 個帳號的 {count} 位置頂好友。匯入會取代現有置頂清單，即使備份中沒有置頂好友。","Berisi {count} teman disematkan dari {accounts} akun. Impor mengganti sematan tersimpan, termasuk jika cadangan ini tidak berisi sematan.","{accounts}件のアカウントのピン留めしたフレンド{count}人を含みます。バックアップが空の場合も、インポートは保存済みのピン留めを置き換えます。","มีเพื่อนที่ปักหมุด {count} คนจาก {accounts} บัญชี การนำเข้าจะแทนที่รายการเดิม แม้ข้อมูลสำรองนี้ไม่มีรายการปักหมุด","{accounts}개 계정의 고정한 친구 {count}명이 포함됩니다. 백업에 고정한 친구가 없어도 가져오기는 저장된 목록을 대체합니다."],
    ["Pinned friends","置顶好友","置頂好友","Teman disematkan","ピン留めしたフレンド","เพื่อนที่ปักหมุด","고정한 친구"],
    ["Home friends","首页好友","首頁好友","Teman di Beranda","ホームのフレンド","เพื่อนบนหน้าหลัก","홈 친구"],
    ["Show Roblox friends list","显示原版好友列表","顯示原版好友清單","Tampilkan daftar teman Roblox","Roblox標準のフレンド一覧を表示","แสดงรายชื่อเพื่อนเดิมของ Roblox","Roblox 기본 친구 목록 표시"],
    ["Show pinned friends","显示置顶好友","顯示置頂好友","Tampilkan teman disematkan","ピン留めしたフレンドを表示","แสดงเพื่อนที่ปักหมุด","고정한 친구 표시"],
    ["Hidden Home sections keep your friendships and saved pins.","隐藏首页模块不会删除好友关系或已保存的置顶名单。","隱藏首頁區塊不會刪除好友關係或已儲存的置頂清單。","Menyembunyikan bagian Beranda tidak menghapus pertemanan atau sematan tersimpan.","ホームの項目を非表示にしても、フレンド関係や保存済みのピン留めは保持されます。","การซ่อนส่วนต่าง ๆ บนหน้าหลักจะไม่ลบเพื่อนหรือรายการปักหมุดที่บันทึกไว้","홈 영역을 숨겨도 친구 관계와 저장된 고정 목록은 유지됩니다."],
    ["Manage pinned friends","管理置顶好友","管理置頂好友","Kelola teman disematkan","ピン留めしたフレンドを管理","จัดการเพื่อนที่ปักหมุด","고정한 친구 관리"],
    ["Friend tools","好友工具","好友工具","Alat teman","フレンドツール","เครื่องมือเพื่อน","친구 도구"],
    ["All statuses","全部状态","全部狀態","Semua status","すべての状態","ทุกสถานะ","모든 상태"],
    ["In game","游戏中","遊戲中","Dalam game","ゲーム中","อยู่ในเกม","게임 중"],
    ["Status unavailable","状态未知","狀態未知","Status tidak tersedia","状態不明","ไม่ทราบสถานะ","상태 알 수 없음"],
    ["Filter friends","筛选好友","篩選好友","Filter teman","フレンドを絞り込み","กรองเพื่อน","친구 필터"],
    ["Sort friends","好友排序","好友排序","Urutkan teman","フレンドの並べ替え","เรียงเพื่อน","친구 정렬"],
    ["Online first","在线优先","在線優先","Online dahulu","オンラインを優先","ออนไลน์ก่อน","온라인 우선"],
    ["Display name A–Z","按显示名称排序","依顯示名稱排序","Nama tampilan A–Z","表示名順","เรียงตามชื่อที่แสดง","표시 이름순"],
    ["Username A–Z","按用户名排序","依使用者名稱排序","Nama pengguna A–Z","ユーザー名順","เรียงตามชื่อผู้ใช้","사용자 이름순"],
    ["Pinned first","置顶优先","置頂優先","Sematan dahulu","ピン留めを優先","ที่ปักหมุดก่อน","고정 우선"],
    ["Refresh list","刷新列表","重新整理清單","Muat ulang daftar","一覧を更新","รีเฟรชรายการ","목록 새로 고침"],
    ["Select users","选择用户","選擇使用者","Pilih pengguna","ユーザーを選択","เลือกผู้ใช้","사용자 선택"],
    ["Select this page","选择当前页","選擇目前頁面","Pilih halaman ini","このページを選択","เลือกหน้านี้","현재 페이지 선택"],
    ["Select all filtered","全选筛选结果","全選篩選結果","Pilih semua hasil","絞り込み結果をすべて選択","เลือกผลที่กรองทั้งหมด","필터 결과 모두 선택"],
    ["Select all filtered ({count})","全选筛选结果（{count}）","全選篩選結果（{count}）","Pilih semua hasil ({count})","絞り込み結果をすべて選択（{count}）","เลือกผลที่กรองทั้งหมด ({count})","필터 결과 모두 선택 ({count})"],
    ["Clear selection","取消选择","取消選取","Hapus pilihan","選択を解除","ล้างการเลือก","선택 해제"],
    ["{count} selected","已选 {count} 人","已選 {count} 人","{count} dipilih","{count}人を選択中","เลือกแล้ว {count} คน","{count}명 선택됨"],
    ["Select {name}","选择 {name}","選取 {name}","Pilih {name}","{name}を選択","เลือก {name}","{name} 선택"],
    ["Showing {shown} of {total}","显示 {shown} / {total} 人","顯示 {shown} / {total} 人","Menampilkan {shown} dari {total}","{total}人中{shown}人を表示","แสดง {shown} จาก {total} คน","{total}명 중 {shown}명 표시"],
    ["No people found.","没有找到符合条件的用户。","找不到符合條件的使用者。","Tidak ada pengguna ditemukan.","該当するユーザーはいません。","ไม่พบผู้ใช้ที่ตรงกัน","조건에 맞는 사용자가 없습니다."],
    ["Unfriend selected","解除所选好友关系","解除所選好友關係","Hapus pertemanan terpilih","選択したフレンドを解除","เลิกเป็นเพื่อนกับคนที่เลือก","선택한 친구 삭제"],
    ["Unfollow selected","取消关注所选用户","取消追蹤所選使用者","Berhenti mengikuti pilihan","選択したユーザーのフォローを解除","เลิกติดตามคนที่เลือก","선택한 사용자 팔로우 해제"],
    ["Accept selected requests","接受所选好友请求","接受所選好友請求","Terima permintaan terpilih","選択した申請を承認","ยอมรับคำขอที่เลือก","선택한 요청 수락"],
    ["Ignore selected requests","忽略所选好友请求","忽略所選好友請求","Abaikan permintaan terpilih","選択した申請を無視","เพิกเฉยคำขอที่เลือก","선택한 요청 무시"],
    ["These people will be removed from your Roblox friends.","这些用户将从你的 Roblox 好友中移除。","這些使用者將從你的 Roblox 好友中移除。","Pengguna ini akan dihapus dari teman Roblox Anda.","これらのユーザーとのRobloxのフレンド関係を解除します。","ผู้ใช้เหล่านี้จะถูกนำออกจากเพื่อน Roblox ของคุณ","이 사용자들이 Roblox 친구 목록에서 삭제됩니다."],
    ["This action cannot be undone. Restoring the friendship requires a new friend request and acceptance.","此操作无法撤销。若要恢复好友关系，需要重新发送好友请求，并由对方接受。","此操作無法復原。若要恢復好友關係，需要重新傳送好友請求，並由對方接受。","Tindakan ini tidak dapat dibatalkan. Untuk berteman lagi, Anda perlu mengirim permintaan pertemanan baru dan menunggu persetujuan penerima.","この操作は取り消せません。フレンド関係を復元するには、新しいフレンド申請を送信し、承認してもらう必要があります。","การดำเนินการนี้ไม่สามารถย้อนกลับได้ หากต้องการกลับมาเป็นเพื่อน ต้องส่งคำขอเป็นเพื่อนใหม่และได้รับการยอมรับ","이 작업은 되돌릴 수 없습니다. 친구 관계를 복원하려면 새 친구 요청을 보내고 상대방이 수락해야 합니다."],
    ["You will stop following these people on Roblox.","你将取消关注这些 Roblox 用户。","你將取消追蹤這些 Roblox 使用者。","Anda akan berhenti mengikuti pengguna ini di Roblox.","これらのRobloxユーザーのフォローを解除します。","คุณจะเลิกติดตามผู้ใช้เหล่านี้บน Roblox","Roblox에서 이 사용자들의 팔로우를 해제합니다."],
    ["These people will be added to your Roblox friends.","这些用户将被添加为你的 Roblox 好友。","這些使用者將被新增為你的 Roblox 好友。","Pengguna ini akan ditambahkan ke teman Roblox Anda.","これらのユーザーをRobloxのフレンドに追加します。","ผู้ใช้เหล่านี้จะถูกเพิ่มเป็นเพื่อน Roblox ของคุณ","이 사용자들이 Roblox 친구로 추가됩니다."],
    ["These friend requests will be ignored on Roblox.","这些 Roblox 好友请求将被忽略。","這些 Roblox 好友請求將被忽略。","Permintaan pertemanan ini akan diabaikan di Roblox.","これらのRobloxのフレンド申請を無視します。","คำขอเป็นเพื่อนเหล่านี้จะถูกเพิกเฉยบน Roblox","Roblox에서 이 친구 요청들을 무시합니다."],
    ["Review selected people","确认所选用户","確認所選使用者","Tinjau pengguna terpilih","選択したユーザーを確認","ตรวจสอบผู้ใช้ที่เลือก","선택한 사용자 확인"],
    ["Confirm","确认","確認","Konfirmasi","確認","ยืนยัน","확인"],
    ["Stop after current action","完成当前操作后停止","完成目前操作後停止","Berhenti setelah tindakan ini","現在の操作後に停止","หยุดหลังการดำเนินการนี้","현재 작업 후 중지"],
    ["Processed {done} of {total}. Roblox actions are paced.","已处理 {done} / {total} 人，正在按间隔执行。","已處理 {done} / {total} 人，正在按間隔執行。","Diproses {done} dari {total}. Tindakan Roblox diberi jeda.","{total}人中{done}人を処理済み。間隔を空けて実行しています。","ดำเนินการแล้ว {done} จาก {total} คน โดยเว้นระยะการทำงาน","{total}명 중 {done}명 처리됨. 일정 간격으로 실행합니다."],
    ["Finished: {done} succeeded; {remaining} still selected.","已结束：成功 {done} 人，仍选中 {remaining} 人。","已結束：成功 {done} 人，仍選取 {remaining} 人。","Selesai: {done} berhasil; {remaining} masih dipilih.","終了：{done}人に成功、{remaining}人は選択されたままです。","เสร็จสิ้น: สำเร็จ {done} คน ยังเลือกอยู่ {remaining} คน","종료: {done}명 성공, {remaining}명은 선택된 상태입니다."],
    ["This person is no longer in this list. Refresh and try again.","此用户已不在当前列表，请刷新后重试。","此使用者已不在目前清單，請重新整理後再試。","Pengguna ini sudah tidak ada dalam daftar. Muat ulang dan coba lagi.","このユーザーは一覧にいません。更新して再試行してください。","ผู้ใช้นี้ไม่อยู่ในรายการแล้ว โปรดรีเฟรชแล้วลองอีกครั้ง","이 사용자는 목록에 없습니다. 새로 고침 후 다시 시도하세요."],
    ["Roblox asked you to wait. Try again later.","Roblox 要求稍后操作，请稍后重试。","Roblox 要求稍後操作，請稍後再試。","Roblox meminta Anda menunggu. Coba lagi nanti.","Robloxから待機を求められました。後でもう一度お試しください。","Roblox ขอให้รอ โปรดลองอีกครั้งภายหลัง","Roblox에서 대기를 요청했습니다. 나중에 다시 시도하세요."],
    ["Roblox requires verification. Complete it on Roblox, then try again.","Roblox 要求验证，请在 Roblox 完成验证后重试。","Roblox 要求驗證，請在 Roblox 完成驗證後再試。","Roblox meminta verifikasi. Selesaikan di Roblox lalu coba lagi.","Robloxでの認証が必要です。Robloxで認証を完了してから再試行してください。","Roblox ต้องการการยืนยัน โปรดยืนยันบน Roblox แล้วลองอีกครั้ง","Roblox에서 인증이 필요합니다. Roblox에서 인증 후 다시 시도하세요."],
    ["Roblox could not complete this action. Refresh the list before trying again.","Roblox 未能完成此操作，请刷新列表后重试。","Roblox 未能完成此操作，請重新整理清單後再試。","Roblox tidak dapat menyelesaikan tindakan ini. Muat ulang daftar sebelum mencoba lagi.","Robloxで操作を完了できませんでした。一覧を更新してから再試行してください。","Roblox ดำเนินการนี้ไม่สำเร็จ โปรดรีเฟรชรายการก่อนลองอีกครั้ง","Roblox에서 작업을 완료하지 못했습니다. 목록을 새로 고친 후 다시 시도하세요."],
    ["The action succeeded, but local friend pins could not be updated.","操作成功，但本地置顶好友未能更新。","操作成功，但本機置頂好友未能更新。","Tindakan berhasil, tetapi sematan teman lokal tidak dapat diperbarui.","操作は成功しましたが、ローカルのフレンドのピン留めを更新できませんでした。","ดำเนินการสำเร็จ แต่อัปเดตเพื่อนที่ปักหมุดในเครื่องไม่ได้","작업은 성공했지만 로컬에 고정한 친구를 업데이트하지 못했습니다."],
    ["Pin friend","置顶好友","置頂好友","Sematkan teman","フレンドをピン留め","ปักหมุดเพื่อน","친구 고정"],
    ["Unpin friend","取消置顶","取消置頂","Lepas sematan","ピン留めを解除","เลิกปักหมุดเพื่อน","친구 고정 해제"],
    ["Search friends","搜索好友","搜尋好友","Cari teman","フレンドを検索","ค้นหาเพื่อน","친구 검색"],
    ["Loading friends…","正在加载好友…","正在載入好友…","Memuat teman…","フレンドを読み込み中…","กำลังโหลดเพื่อน…","친구 불러오는 중…"],
    ["No friends found.","没有找到好友。","沒有找到好友。","Tidak ada teman ditemukan.","フレンドが見つかりません。","ไม่พบเพื่อน","친구를 찾을 수 없습니다."],
    ["Choose friends to keep them together here, including when they are offline.","选择好友后，他们会集中显示在这里，离线时也能找到。","選擇好友後，他們會集中顯示在這裡，離線時也能找到。","Pilih teman agar terkumpul di sini, termasuk saat offline.","フレンドを選ぶと、オフラインのときもここにまとめて表示されます。","เลือกเพื่อนเพื่อรวมไว้ที่นี่ แม้เพื่อนจะออฟไลน์","친구를 선택하면 오프라인일 때도 여기에 모아 표시합니다."],
    ["Pins are saved on this browser for each Roblox account.","置顶列表保存在当前浏览器中，并按 Roblox 账号分别记录。","置頂清單儲存在目前瀏覽器中，並按 Roblox 帳號分別記錄。","Sematan disimpan di browser ini secara terpisah untuk setiap akun Roblox.","ピン留めはRobloxアカウントごとに、このブラウザに保存されます。","รายการปักหมุดจะบันทึกในเบราว์เซอร์นี้ แยกตามบัญชี Roblox","고정 목록은 이 브라우저에 Roblox 계정별로 저장됩니다."],
    ["Could not load friends. Please try again.","无法加载好友，请重试。","無法載入好友，請重試。","Tidak dapat memuat teman. Coba lagi.","フレンドを読み込めませんでした。再試行してください。","โหลดเพื่อนไม่ได้ โปรดลองอีกครั้ง","친구를 불러올 수 없습니다. 다시 시도하세요."],
    ["Sign in to manage pinned friends.","请登录后管理置顶好友。","請登入後管理置頂好友。","Masuk untuk mengelola teman disematkan.","ログインしてピン留めしたフレンドを管理してください。","เข้าสู่ระบบเพื่อจัดการเพื่อนที่ปักหมุด","로그인하여 고정한 친구를 관리하세요."],
    ["Your Roblox account changed. Please reload this page.","Roblox 账号已切换，请刷新页面。","Roblox 帳號已切換，請重新整理頁面。","Akun Roblox Anda berubah. Muat ulang halaman ini.","Robloxアカウントが変わりました。ページを再読み込みしてください。","บัญชี Roblox เปลี่ยนแล้ว โปรดโหลดหน้านี้ใหม่","Roblox 계정이 변경되었습니다. 페이지를 새로 고침하세요."],
    ["This user is no longer in your friends list.","这位用户已不在你的好友列表中。","這位使用者已不在你的好友清單中。","Pengguna ini sudah tidak ada dalam daftar teman Anda.","このユーザーはフレンド一覧にいません。","ผู้ใช้นี้ไม่อยู่ในรายชื่อเพื่อนของคุณแล้ว","이 사용자는 더 이상 친구 목록에 없습니다."],
    ["This request does not match the current item page.","物品页面已切换，请重试当前物品。","物品頁面已切換，請重試目前物品。","Halaman item telah berubah. Coba lagi pada item saat ini.","アイテムページが変わりました。現在のアイテムで再試行してください。","หน้าไอเท็มเปลี่ยนแล้ว โปรดลองอีกครั้งกับไอเท็มปัจจุบัน","아이템 페이지가 변경되었습니다. 현재 아이템에서 다시 시도하세요."],
    ["Loading diagnostics","加载诊断","載入診斷","Diagnostik pemuatan","読み込み診断","การวินิจฉัยการโหลด","불러오기 진단"],
    ["Copy diagnostics","复制诊断","複製診斷","Salin diagnostik","診断をコピー","คัดลอกการวินิจฉัย","진단 복사"],
    ["Diagnostics stay in this tab. No account details or avatar contents are included.","诊断记录仅保留在当前标签页，不包含账号资料或模型内容。","診斷記錄僅保留在目前分頁，不包含帳號資料或模型內容。","Catatan diagnostik hanya disimpan di tab ini, tanpa detail akun atau isi avatar.","診断記録はこのタブ内にのみ保持され、アカウント情報やアバターの内容は含まれません。","บันทึกการวินิจฉัยจะอยู่ในแท็บนี้เท่านั้น ไม่รวมรายละเอียดบัญชีหรือเนื้อหาอวาตาร์","진단 기록은 이 탭에만 보관되며 계정 정보나 아바타 콘텐츠는 포함하지 않습니다."],
    ["Select the text and copy it.","请选择文字并复制。","請選取文字並複製。","Pilih teks lalu salin.","テキストを選択してコピーしてください。","เลือกข้อความแล้วคัดลอก","텍스트를 선택하여 복사하세요."],
    ["Other Roblox extensions detected","检测到其他 Roblox 插件","偵測到其他 Roblox 擴充功能","Ekstensi Roblox lain terdeteksi","他のRoblox拡張機能が検出されました","ตรวจพบส่วนขยาย Roblox อื่น","다른 Roblox 확장 프로그램이 감지되었습니다"],
    ["The following extensions were detected running on this page:","当前页面检测到以下插件正在运行：","目前頁面偵測到以下擴充功能正在執行：","Ekstensi berikut terdeteksi berjalan di halaman ini:","このページで次の拡張機能が動作していることが検出されました：","ตรวจพบส่วนขยายต่อไปนี้กำลังทำงานในหน้านี้:","이 페이지에서 다음 확장 프로그램이 실행 중인 것으로 감지되었습니다:"],
    ["Detected extensions","检测到的插件","偵測到的擴充功能","Ekstensi yang terdeteksi","検出された拡張機能","ส่วนขยายที่ตรวจพบ","감지된 확장 프로그램"],
    ["Extension compatibility information","插件兼容性说明","擴充功能相容性說明","Informasi kompatibilitas ekstensi","拡張機能の互換性について","ข้อมูลความเข้ากันได้ของส่วนขยาย","확장 프로그램 호환성 안내"],
    ["Roblox Customizer makes extensive changes to the Roblox website's layout, styles, and some interactions. When another extension changes the same areas, these changes may affect one another, causing duplicate buttons or features, overlapping elements, misplaced content, or problems displaying or loading some content.","Roblox Customizer 会对 Roblox 官网的布局、样式和部分交互界面进行较大范围的调整。当其他插件也修改相同区域时，双方的修改可能相互影响，导致按钮或功能重复出现、元素重叠、布局错位，或部分内容显示与加载异常。","Roblox Customizer 會對 Roblox 官網的版面配置、樣式及部分互動介面進行較大範圍的調整。當其他擴充功能也修改相同區域時，雙方的修改可能互相影響，導致按鈕或功能重複出現、元素重疊、版面錯位，或部分內容顯示與載入異常。","Roblox Customizer melakukan perubahan besar pada tata letak, gaya, dan sebagian interaksi situs Roblox. Jika ekstensi lain mengubah bagian yang sama, perubahan tersebut dapat saling memengaruhi sehingga tombol atau fitur muncul ganda, elemen bertumpuk, tata letak bergeser, atau sebagian konten bermasalah saat ditampilkan atau dimuat.","Roblox Customizerは、Roblox公式サイトのレイアウト、スタイル、一部の操作画面を広範囲に変更します。他の拡張機能も同じ部分を変更すると、それぞれの変更が影響し合い、ボタンや機能の重複、要素の重なり、レイアウトのずれ、一部コンテンツの表示や読み込みの問題が起こる場合があります。","Roblox Customizer ปรับเปลี่ยนเค้าโครง รูปแบบ และส่วนติดต่อบางส่วนของเว็บไซต์ Roblox อย่างครอบคลุม หากส่วนขยายอื่นปรับเปลี่ยนบริเวณเดียวกัน การเปลี่ยนแปลงอาจส่งผลต่อกัน ทำให้ปุ่มหรือฟีเจอร์แสดงซ้ำ องค์ประกอบซ้อนทับ เค้าโครงคลาดเคลื่อน หรือเนื้อหาบางส่วนแสดงผลหรือโหลดผิดปกติ","Roblox Customizer는 Roblox 공식 웹사이트의 레이아웃, 스타일 및 일부 상호작용 화면을 광범위하게 변경합니다. 다른 확장 프로그램도 같은 영역을 변경하면 서로 영향을 주어 버튼이나 기능 중복, 요소 겹침, 레이아웃 어긋남 또는 일부 콘텐츠의 표시나 로딩 문제가 발생할 수 있습니다."],
    ["You can keep using these extensions together. You do not have to choose just one.","你可以继续同时使用这些插件，无需二选一。","你可以繼續同時使用這些擴充功能，無需二選一。","Anda dapat terus menggunakan ekstensi ini bersama-sama. Anda tidak harus memilih salah satu saja.","これらの拡張機能は引き続き併用できます。どれか1つだけを選ぶ必要はありません。","คุณสามารถใช้ส่วนขยายเหล่านี้ร่วมกันต่อไปได้ ไม่จำเป็นต้องเลือกใช้เพียงตัวเดียว","이 확장 프로그램들을 계속 함께 사용할 수 있습니다. 하나만 선택할 필요는 없습니다."],
    ["You decide which extensions and features to keep. Roblox Customizer will not automatically disable other extensions or change their settings because of this notice.","是否保留多个插件、使用哪些功能，完全由你决定。Roblox Customizer 不会因为这条提醒自动关闭其他插件，也不会修改它们的设置。","是否保留多個擴充功能、使用哪些功能，完全由你決定。Roblox Customizer 不會因為這則提醒自動關閉其他擴充功能，也不會修改它們的設定。","Anda yang menentukan ekstensi dan fitur mana yang ingin tetap digunakan. Roblox Customizer tidak akan otomatis menonaktifkan ekstensi lain atau mengubah pengaturannya karena pemberitahuan ini.","残す拡張機能や使う機能は、ご自身で自由に選べます。この通知によってRoblox Customizerが他の拡張機能を自動的に無効にしたり、設定を変更したりすることはありません。","คุณเป็นผู้ตัดสินใจว่าจะเก็บส่วนขยายใดและใช้ฟีเจอร์ใด Roblox Customizer จะไม่ปิดส่วนขยายอื่นโดยอัตโนมัติหรือเปลี่ยนการตั้งค่าของส่วนขยายเหล่านั้นเพราะการแจ้งเตือนนี้","유지할 확장 프로그램과 사용할 기능은 직접 결정할 수 있습니다. Roblox Customizer는 이 알림을 이유로 다른 확장 프로그램을 자동으로 끄거나 설정을 변경하지 않습니다."],
    ["Detecting another extension does not mean a conflict will occur. If the page looks and works normally, you can continue without changing anything.","检测到其他插件并不代表一定会发生冲突。如果页面显示正常，可以直接继续使用，无需进行任何调整。","偵測到其他擴充功能並不代表一定會發生衝突。如果頁面顯示正常，可以直接繼續使用，無需進行任何調整。","Terdeteksinya ekstensi lain bukan berarti konflik pasti terjadi. Jika halaman tampil dan berfungsi normal, Anda dapat melanjutkan tanpa mengubah apa pun.","他の拡張機能が検出されても、必ず競合が起きるわけではありません。ページの表示や動作に問題がなければ、何も変更せずにそのまま使用できます。","การตรวจพบส่วนขยายอื่นไม่ได้หมายความว่าจะเกิดข้อขัดแย้งเสมอไป หากหน้าเว็บแสดงผลและทำงานตามปกติ คุณสามารถใช้งานต่อได้โดยไม่ต้องปรับเปลี่ยนอะไร","다른 확장 프로그램이 감지되었다고 해서 반드시 충돌이 발생하는 것은 아닙니다. 페이지가 정상적으로 표시되고 작동한다면 아무것도 변경하지 않고 계속 사용할 수 있습니다."],
    ["If you notice a problem, you can try refreshing the page first. If it continues, you can choose to temporarily turn off overlapping features in an extension's settings, then refresh the page to check the result. You decide which extension's features to adjust; you do not need to uninstall an entire extension.","如果遇到异常，可以先尝试刷新网页；若问题持续出现，也可以按需在相关插件的设置中暂时关闭部分重复功能，再刷新页面查看效果。你可以自行决定调整哪一个插件的功能，无需直接卸载整个插件。","如果遇到異常，可以先嘗試重新整理網頁；若問題持續出現，也可以視需要在相關擴充功能的設定中暫時關閉部分重複功能，再重新整理頁面查看效果。你可以自行決定調整哪一個擴充功能的功能，無需直接解除安裝整個擴充功能。","Jika mengalami masalah, Anda dapat mencoba memuat ulang halaman terlebih dahulu. Jika masalah berlanjut, Anda dapat memilih untuk sementara mematikan fitur yang tumpang tindih di pengaturan ekstensi, lalu memuat ulang halaman untuk memeriksa hasilnya. Anda menentukan fitur ekstensi mana yang ingin disesuaikan; tidak perlu menghapus seluruh ekstensi.","問題が起きた場合は、まずページの再読み込みを試せます。問題が続く場合は、必要に応じて拡張機能の設定で重複する機能を一時的にオフにしてから、ページを再読み込みして結果を確認できます。どの拡張機能の機能を調整するかは自由に選べます。拡張機能全体をアンインストールする必要はありません。","หากพบปัญหา คุณสามารถลองรีเฟรชหน้าเว็บก่อน หากยังมีปัญหา คุณสามารถเลือกปิดฟีเจอร์ที่ซ้ำกันชั่วคราวในการตั้งค่าของส่วนขยาย แล้วรีเฟรชหน้าเว็บเพื่อดูผล คุณเลือกได้เองว่าจะปรับฟีเจอร์ของส่วนขยายใด โดยไม่จำเป็นต้องถอนการติดตั้งส่วนขยายทั้งตัว","문제가 발생하면 먼저 페이지를 새로 고침해 볼 수 있습니다. 문제가 계속되면 확장 프로그램 설정에서 중복 기능을 필요에 따라 일시적으로 끈 뒤 페이지를 새로 고침하여 결과를 확인할 수 있습니다. 어떤 확장 프로그램의 기능을 조정할지는 직접 선택할 수 있으며, 확장 프로그램 전체를 삭제할 필요는 없습니다."],
    ["Got it, continue using Roblox","我已了解，继续使用 Roblox","我已瞭解，繼續使用 Roblox","Saya mengerti, lanjutkan menggunakan Roblox","了解してRobloxの使用を続ける","เข้าใจแล้ว ใช้ Roblox ต่อ","확인했습니다. Roblox 계속 사용"],
    ["Server performance: {value}%","服务器性能：{value}%","伺服器效能：{value}%","Performa server: {value}%","サーバー性能：{value}%","ประสิทธิภาพเซิร์ฟเวอร์: {value}%","서버 성능: {value}%"],
    ["{count} {language} language matches","{count} 位{language}语言匹配玩家","{count} 位{language}語言相符玩家","{count} pemain dengan kecocokan bahasa {language}","{language}の言語一致プレイヤー：{count}人","ผู้เล่นที่ตรงกับภาษา{language} {count} คน","{language} 언어 일치 플레이어 {count}명"],
    ["Place version: {value}","地图版本：{value}","地圖版本：{value}","Versi place: {value}","プレースのバージョン：{value}","เวอร์ชันสถานที่: {value}","장소 버전: {value}"],
    ["Server FPS relative to 60 FPS. This is not CPU usage or your display frame rate.","以 60 FPS 为基准换算的服务器运行帧率，不代表 CPU 使用率或你的画面帧率。","以 60 FPS 為基準換算的伺服器運行影格率，不代表 CPU 使用率或你的畫面影格率。","FPS server dibandingkan dengan 60 FPS. Ini bukan penggunaan CPU atau frame rate layar Anda.","60 FPSを基準にしたサーバーの動作フレームレートです。CPU使用率や画面のフレームレートではありません。","อัตราเฟรมของเซิร์ฟเวอร์เทียบกับ 60 FPS ไม่ใช่การใช้ CPU หรืออัตราเฟรมบนหน้าจอของคุณ","60 FPS를 기준으로 환산한 서버 프레임 속도입니다. CPU 사용률이나 화면 프레임 속도가 아닙니다."],
    ["Language matches reported by Roblox for your Roblox language setting; this does not verify what players speak.","Roblox 根据你的 Roblox 语言设置提供的匹配人数，不代表已确认玩家实际使用的语言。","Roblox 根據你的 Roblox 語言設定提供的相符人數，不代表已確認玩家實際使用的語言。","Jumlah kecocokan bahasa dari Roblox berdasarkan pengaturan bahasa Roblox Anda; ini tidak memastikan bahasa yang digunakan pemain.","Robloxの言語設定に対してRobloxが返した一致人数です。プレイヤーが実際に話す言語を確認したものではありません。","จำนวนผู้เล่นที่ภาษาตรงกันตามที่ Roblox รายงานสำหรับการตั้งค่าภาษา Roblox ของคุณ ไม่ได้ยืนยันภาษาที่ผู้เล่นใช้จริง","Roblox 언어 설정을 기준으로 Roblox가 제공한 언어 일치 인원입니다. 플레이어가 실제로 사용하는 언어를 확인한 것은 아닙니다."],
    ["The published place version running on this server, not the Roblox client version.","这台服务器正在运行的地图发布版本，不是 Roblox 客户端版本。","這台伺服器正在運行的地圖發布版本，不是 Roblox 用戶端版本。","Versi place yang diterbitkan dan berjalan di server ini, bukan versi aplikasi Roblox.","このサーバーで動作中の公開済みプレースのバージョンです。Robloxクライアントのバージョンではありません。","เวอร์ชันสถานที่ที่เผยแพร่และกำลังทำงานบนเซิร์ฟเวอร์นี้ ไม่ใช่เวอร์ชันแอป Roblox","이 서버에서 실행 중인 게시된 장소 버전이며 Roblox 클라이언트 버전이 아닙니다."],
    ["The avatar editor is taking longer to load. Refresh the page to try again.","头像编辑器加载时间较长，请刷新页面重试。","虛擬人偶編輯器載入時間較長，請重新整理頁面再試。","Editor avatar membutuhkan waktu lebih lama untuk dimuat. Muat ulang halaman untuk mencoba lagi.","アバターエディターの読み込みに時間がかかっています。ページを更新して再試行してください。","ตัวแก้ไขอวาตาร์ใช้เวลาโหลดนานกว่าปกติ โปรดรีเฟรชหน้าเพื่อลองอีกครั้ง","아바타 편집기를 불러오는 데 시간이 걸립니다. 페이지를 새로 고침하고 다시 시도하세요."],
    ["Animation preview","动画预览","動畫預覽","Pratinjau animasi","アニメーションプレビュー","ตัวอย่างแอนิเมชัน","애니메이션 미리 보기"],
    ["Your avatar animation","我的模型动画","我的模型動畫","Animasi avatarmu","自分のアバターのアニメーション","แอนิเมชันอวาตาร์ของคุณ","내 아바타 애니메이션"],
    ["Preview on my avatar","在我的模型上预览","在我的模型上預覽","Pratinjau di avatarku","自分のアバターでプレビュー","ดูตัวอย่างบนอวาตาร์ของฉัน","내 아바타로 미리 보기"],
    ["Reload avatar","重新加载模型","重新載入模型","Muat ulang avatar","アバターを再読み込み","โหลดอวาตาร์ใหม่","아바타 다시 불러오기"],
    ["Preview this animation on your avatar.","在你的模型上预览此动画。","在你的模型上預覽此動畫。","Lihat animasi ini di avatarmu.","このアニメーションを自分のアバターでプレビューします。","ดูตัวอย่างแอนิเมชันนี้บนอวาตาร์ของคุณ","내 아바타로 이 애니메이션을 미리 보세요."],
    ["Preview only. Your equipped avatar is not changed.","仅用于网页预览，不会更改当前穿戴。","僅供網頁預覽，不會變更目前穿戴。","Hanya pratinjau. Avatar yang dipakai tidak berubah.","プレビューのみです。装着中のアバターは変更されません。","เป็นเพียงตัวอย่างบนเว็บ อวาตาร์ที่สวมอยู่จะไม่เปลี่ยน","미리 보기만 제공하며 현재 착용한 아바타는 변경되지 않습니다."],
    ["Loading your avatar animation...","正在加载模型和动画…","正在載入模型與動畫…","Memuat avatar dan animasi...","アバターとアニメーションを読み込み中…","กำลังโหลดอวาตาร์และแอนิเมชัน…","아바타와 애니메이션 불러오는 중…"],
    ["Reset camera","重置视角","重設視角","Atur ulang kamera","カメラをリセット","รีเซ็ตมุมมอง","카메라 초기화"],
    ["Play animation","播放动画","播放動畫","Putar animasi","アニメーションを再生","เล่นแอนิเมชัน","애니메이션 재생"],
    ["Pause animation","暂停动画","暫停動畫","Jeda animasi","アニメーションを一時停止","หยุดแอนิเมชันชั่วคราว","애니메이션 일시 정지"],
    ["Idle","待机","待機","Diam","待機","ยืนนิ่ง","대기"],
    ["Walk","行走","行走","Berjalan","歩く","เดิน","걷기"],
    ["Run","奔跑","奔跑","Berlari","走る","วิ่ง","달리기"],
    ["Jump","跳跃","跳躍","Melompat","ジャンプ","กระโดด","점프"],
    ["Fall","下落","下落","Jatuh","落下","ตก","낙하"],
    ["Climb","攀爬","攀爬","Memanjat","登る","ปีน","오르기"],
    ["Swim","游泳","游泳","Berenang","泳ぐ","ว่ายน้ำ","수영"],
    ["This animation is previewed using an R15 rig.","此动画使用 R15 模型进行预览。","此動畫使用 R15 模型進行預覽。","Animasi ini dipratinjau dengan rig R15.","このアニメーションはR15リグでプレビューします。","แอนิเมชันนี้แสดงตัวอย่างด้วยโมเดล R15","이 애니메이션은 R15 모델로 미리 봅니다."],
    ["Some avatar items could not be displayed.","部分穿戴物品未能显示。","部分穿戴物品無法顯示。","Beberapa item avatar tidak dapat ditampilkan.","一部のアバターアイテムを表示できませんでした。","ไม่สามารถแสดงไอเท็มอวาตาร์บางรายการได้","일부 아바타 아이템을 표시하지 못했습니다."],
    ["Could not load the avatar preview. Try again.","模型预览加载失败，请重试。","模型預覽載入失敗，請重試。","Pratinjau avatar gagal dimuat. Coba lagi.","アバターのプレビューを読み込めませんでした。もう一度お試しください。","โหลดตัวอย่างอวาตาร์ไม่สำเร็จ โปรดลองอีกครั้ง","아바타 미리 보기를 불러오지 못했습니다. 다시 시도하세요."],
    ["This animation is not available in this bundle.","此套装中没有可用的这类动画。","此套裝中沒有可用的這類動畫。","Animasi ini tidak tersedia dalam bundel ini.","このバンドルにはこの種類のアニメーションがありません。","ไม่มีแอนิเมชันประเภทนี้ในชุดนี้","이 번들에는 해당 애니메이션이 없습니다."],
    ["This bundle has no supported animations.","此套装没有支持的动画。","此套裝沒有支援的動畫。","Bundel ini tidak memiliki animasi yang didukung.","このバンドルには対応するアニメーションがありません。","ชุดนี้ไม่มีแอนิเมชันที่รองรับ","이 번들에는 지원되는 애니메이션이 없습니다."],
    ["If loading causes unexpected pop-ups, chat window issues, or other errors, refresh the page and try again.","加载时如出现异常弹窗、聊天窗口异常或其他错误，请刷新网页后重试。","載入時如出現異常彈窗、聊天視窗異常或其他錯誤，請重新整理網頁後再試。","Jika pemuatan menyebabkan pop-up tak terduga, masalah jendela obrolan, atau kesalahan lain, muat ulang halaman dan coba lagi.","読み込み中に予期しないポップアップ、チャットウィンドウの不具合、その他のエラーが発生した場合は、ページを再読み込みしてお試しください。","หากระหว่างโหลดมีป๊อปอัปที่ไม่คาดคิด หน้าต่างแชทมีปัญหา หรือเกิดข้อผิดพลาดอื่น ให้รีเฟรชหน้าเว็บแล้วลองอีกครั้ง","불러오는 중 예기치 않은 팝업, 채팅 창 문제 또는 다른 오류가 발생하면 페이지를 새로고침한 후 다시 시도하세요."],
    ["Explorer","对象浏览器","物件瀏覽器","Penjelajah","エクスプローラー","ตัวสำรวจ","탐색기"],
    ["Properties","属性","屬性","Properti","プロパティ","คุณสมบัติ","속성"],
    ["Read only","只读","唯讀","Hanya baca","読み取り専用","อ่านอย่างเดียว","읽기 전용"],
    ["Filter model","筛选模型对象","篩選模型物件","Filter objek model","モデルを絞り込む","กรองวัตถุในโมเดล","모델 개체 필터"],
    ["Filter properties","筛选属性","篩選屬性","Filter properti","プロパティを絞り込む","กรองคุณสมบัติ","속성 필터"],
    ["Model objects","模型对象","模型物件","Objek model","モデルのオブジェクト","วัตถุในโมเดล","모델 개체"],
    ["Resize explorer","调整浏览器栏宽","調整瀏覽器欄寬","Ubah lebar penjelajah","エクスプローラーの幅を調整","ปรับความกว้างตัวสำรวจ","탐색기 너비 조절"],
    ["Collapse all","全部折叠","全部收合","Ciutkan semua","すべて折りたたむ","ยุบทั้งหมด","모두 접기"],
    ["Expand all","全部展开","全部展開","Perluas semua","すべて展開","ขยายทั้งหมด","모두 펼치기"],
    ["No objects found.","没有找到对象。","找不到物件。","Tidak ada objek ditemukan.","オブジェクトが見つかりません。","ไม่พบวัตถุ","개체가 없습니다."],
    ["Select an object to view its properties.","选择对象以查看属性。","選取物件以查看屬性。","Pilih objek untuk melihat propertinya.","オブジェクトを選択するとプロパティを表示します。","เลือกวัตถุเพื่อดูคุณสมบัติ","개체를 선택하면 속성이 표시됩니다."],
    ["Expand property","展开属性分量","展開屬性分量","Perluas komponen properti","プロパティの成分を展開","ขยายองค์ประกอบคุณสมบัติ","속성 구성 요소 펼치기"],
    ["Copy value","复制值","複製值","Salin nilai","値をコピー","คัดลอกค่า","값 복사"],
    ["View value","查看完整值","查看完整值","Lihat nilai lengkap","値の全体を表示","ดูค่าทั้งหมด","전체 값 보기"],
    ["Property value","属性值","屬性值","Nilai properti","プロパティの値","ค่าคุณสมบัติ","속성 값"],
    ["Download text","下载文本","下載文字","Unduh teks","テキストをダウンロード","ดาวน์โหลดข้อความ","텍스트 다운로드"],
    ["{count} objects","{count} 个对象","{count} 個物件","{count} objek","{count} 個のオブジェクト","{count} วัตถุ","개체 {count}개"],
    ["Data","数据","資料","Data","データ","ข้อมูล","데이터"],
    ["Transform","变换","變換","Transformasi","変換","การแปลง","변환"],
    ["Pivot","枢轴","樞紐","Pivot","ピボット","จุดหมุน","피벗"],
    ["Behavior","行为","行為","Perilaku","動作","พฤติกรรม","동작"],
    ["Collision","碰撞","碰撞","Tabrakan","衝突","การชน","충돌"],
    ["Part","部件","零件","Bagian","パーツ","ชิ้นส่วน","파트"],
    ["Surface","表面","表面","Permukaan","サーフェス","พื้นผิว","표면"],
    ["Assembly","程序集","組件","Rakitan","アセンブリ","ชุดประกอบ","어셈블리"],
    ["Tags","标签","標籤","Tag","タグ","แท็ก","태그"],
    ["Attributes","自定义属性","自訂屬性","Atribut","属性","แอตทริบิวต์","특성"],
    ["Permissions","权限","權限","Izin","権限","สิทธิ์","권한"],
    ["Surface Inputs","表面输入","表面輸入","Input permukaan","サーフェス入力","อินพุตพื้นผิว","표면 입력"],
    ["Showing the first {count} characters.","正在显示前 {count} 个字符。","正在顯示前 {count} 個字元。","Menampilkan {count} karakter pertama.","最初の{count}文字を表示しています。","แสดง {count} อักขระแรก","처음 {count}자를 표시합니다."],
    ["No changes","没有更改","沒有變更","Tidak ada perubahan","変更はありません","ไม่มีการเปลี่ยนแปลง","변경 사항 없음"],
    ["Roblox request failed ({status}).","Roblox 请求失败（{status}）。","Roblox 請求失敗（{status}）。","Permintaan Roblox gagal ({status}).","Robloxへのリクエストに失敗しました（{status}）。","คำขอ Roblox ล้มเหลว ({status})","Roblox 요청 실패 ({status})."],
    ["Resource exceeds the 32 MB preview limit.","资源超过 32 MB 加载限制。","資源超過 32 MB 載入限制。","Sumber daya melebihi batas pemuatan 32 MB.","リソースが32 MBの読み込み上限を超えています。","ทรัพยากรเกินขีดจำกัดการโหลด 32 MB","리소스가 32 MB 로딩 제한을 초과합니다."],
    ["Roblox did not provide downloadable content for this resource.","Roblox 没有为此资源提供可下载内容。","Roblox 未為此資源提供可下載內容。","Roblox tidak menyediakan konten yang dapat diunduh untuk sumber daya ini.","このリソースにはダウンロード可能なコンテンツがありません。","Roblox ไม่มีเนื้อหาที่ดาวน์โหลดได้สำหรับทรัพยากรนี้","Roblox가 이 리소스의 다운로드 가능한 콘텐츠를 제공하지 않았습니다."],
    ["This avatar format is not supported by the editor.","编辑器暂不支持此头像格式。","編輯器暫不支援此虛擬人偶格式。","Format avatar ini tidak didukung editor.","このアバター形式はエディターに対応していません。","ตัวแก้ไขไม่รองรับรูปแบบอวาตาร์นี้","편집기가 이 아바타 형식을 지원하지 않습니다."],
    ["Roblox could not apply the avatar changes.","Roblox 无法应用头像更改。","Roblox 無法套用虛擬人偶變更。","Roblox tidak dapat menerapkan perubahan avatar.","Robloxがアバターの変更を適用できませんでした。","Roblox ไม่สามารถใช้การเปลี่ยนแปลงอวาตาร์ได้","Roblox가 아바타 변경 사항을 적용하지 못했습니다."],
    ["The accessory is no longer equipped. Reload the editor.","此饰品已不在穿戴列表中，请重新加载编辑器。","此配件已不在穿戴清單中，請重新載入編輯器。","Aksesori tidak lagi dipakai. Muat ulang editor.","このアクセサリーは装着されていません。エディターを再読み込みしてください。","ไม่ได้สวมใส่อุปกรณ์เสริมนี้แล้ว โปรดโหลดตัวแก้ไขใหม่","액세서리가 더 이상 장착되어 있지 않습니다. 편집기를 다시 불러오세요."],
    ["Unsupported or damaged resource.","资源格式不受支持或文件已损坏。","資源格式不受支援或檔案已損壞。","Sumber daya tidak didukung atau rusak.","未対応または破損したリソースです。","ทรัพยากรไม่รองรับหรือเสียหาย","지원되지 않거나 손상된 리소스입니다."],
    ["Resource is too large to explore.","资源过大，无法浏览。","資源過大，無法瀏覽。","Sumber daya terlalu besar untuk dijelajahi.","リソースが大きすぎるため表示できません。","ทรัพยากรใหญ่เกินกว่าจะสำรวจได้","리소스가 너무 커서 탐색할 수 없습니다."],
    ["This model contains too many instances to explore.","模型中的对象过多，无法浏览。","模型中的物件過多，無法瀏覽。","Model berisi terlalu banyak objek untuk dijelajahi.","モデルのインスタンスが多すぎるため表示できません。","โมเดลนี้มีอินสแตนซ์มากเกินกว่าจะสำรวจได้","모델의 인스턴스가 너무 많아 탐색할 수 없습니다."],
    ["Server filters","服务器筛选","伺服器篩選","Filter server","サーバーフィルター","ตัวกรองเซิร์ฟเวอร์","서버 필터"],
    ["Item tools","物品工具","物品工具","Alat item","アイテムツール","เครื่องมือไอเท็ม","아이템 도구"],
    ["Avatar tools","头像工具","虛擬人偶工具","Alat avatar","アバターツール","เครื่องมืออวาตาร์","아바타 도구"],
    ["3D preview","3D 预览","3D 預覽","Pratinjau 3D","3Dプレビュー","ตัวอย่าง 3D","3D 미리 보기"],
    ["Try on / animation","试穿／动画","試穿／動畫","Coba / animasi","試着・アニメーション","ลองสวม / แอนิเมชัน","착용 / 애니메이션"],
    ["Creator Store","创作者商店","創作者商店","Toko Kreator","クリエーターストア","ร้านค้าผู้สร้าง","크리에이터 스토어"],
    ["Uses Roblox’s preview controls for items, animations and try-on when available.","使用 Roblox 为此物品提供的物品、动画和试穿预览控件。","使用 Roblox 為此物品提供的物品、動畫和試穿預覽控制項。","Menggunakan kontrol pratinjau Roblox untuk item, animasi, dan mencoba jika tersedia.","利用可能なRobloxのアイテム・アニメーション・試着プレビューを使用します。","ใช้ตัวควบคุมตัวอย่างไอเท็ม แอนิเมชัน และการลองสวมของ Roblox เมื่อมีให้ใช้","지원되는 Roblox 아이템·애니메이션·착용 미리 보기 기능을 사용합니다."],
    ["Refresh details","刷新详情","重新整理詳情","Muat ulang detail","詳細を更新","รีเฟรชรายละเอียด","상세 정보 새로 고침"],
    ["Export details","导出详情","匯出詳情","Ekspor detail","詳細をエクスポート","ส่งออกรายละเอียด","상세 정보 내보내기"],
    ["Values are reported by Roblox. Unavailable sales and quantity fields are not estimated.","数据来自 Roblox；未提供的销售或数量字段不会自行估算。","資料來自 Roblox；未提供的銷售或數量欄位不會自行估算。","Data dilaporkan Roblox. Penjualan dan jumlah yang tidak tersedia tidak diperkirakan.","Robloxが提供する値です。非公開の販売数や数量は推定しません。","ข้อมูลมาจาก Roblox ไม่มีการประมาณยอดขายหรือจำนวนที่ไม่พร้อมใช้งาน","Roblox가 제공한 값입니다. 제공되지 않는 판매량이나 수량은 추정하지 않습니다."],
    ["Resource explorer","资源浏览器","資源瀏覽器","Penjelajah sumber daya","リソースエクスプローラー","ตัวสำรวจทรัพยากร","리소스 탐색기"],
    ["Load resource","加载资源","載入資源","Muat sumber daya","リソースを読み込む","โหลดทรัพยากร","리소스 불러오기"],
    ["Download file","下载文件","下載檔案","Unduh file","ファイルをダウンロード","ดาวน์โหลดไฟล์","파일 다운로드"],
    ["Search objects and properties","搜索对象与属性","搜尋物件與屬性","Cari objek dan properti","オブジェクト・プロパティを検索","ค้นหาวัตถุและคุณสมบัติ","개체 및 속성 검색"],
    ["Supports accessible XML, JSON and RBXM resources. File loading is limited to 32 MB.","支持可访问的 XML、JSON 和 RBXM 资源，文件加载上限为 32 MB。","支援可存取的 XML、JSON 和 RBXM 資源，檔案載入上限為 32 MB。","Mendukung XML, JSON, dan RBXM yang dapat diakses. Batas pemuatan file 32 MB.","アクセス可能なXML・JSON・RBXMに対応。ファイル読み込みは32 MBまでです。","รองรับ XML, JSON และ RBXM ที่เข้าถึงได้ โหลดไฟล์ได้สูงสุด 32 MB","접근 가능한 XML·JSON·RBXM을 지원합니다. 파일 불러오기 한도는 32 MB입니다."],
    ["Open resource","打开资源","開啟資源","Buka sumber daya","リソースを開く","เปิดทรัพยากร","리소스 열기"],
    ["Resource preview","资源预览","資源預覽","Pratinjau sumber daya","リソースプレビュー","ตัวอย่างทรัพยากร","리소스 미리 보기"],
    ["Asset ID","资源 ID","資源 ID","ID aset","アセットID","ID แอสเซท","에셋 ID"],
    ["Creator","创建者","建立者","Kreator","作成者","ผู้สร้าง","제작자"],
    ["Created","创建时间","建立時間","Dibuat","作成日時","สร้างเมื่อ","생성일"],
    ["Updated","更新时间","更新時間","Diperbarui","更新日時","อัปเดตเมื่อ","업데이트"],
    ["Reported sales","接口提供的销量","介面提供的銷量","Penjualan dilaporkan","報告された販売数","ยอดขายที่รายงาน","보고된 판매량"],
    ["Issued quantity","发放数量","發放數量","Jumlah diterbitkan","発行数","จำนวนที่ออก","발행 수량"],
    ["Remaining","剩余数量","剩餘數量","Tersisa","残数","จำนวนคงเหลือ","남은 수량"],
    ["Some binary properties are shown as raw type information.","部分二进制属性仅显示类型信息；不支持的压缩块仅显示块信息。","部分二進位屬性僅顯示類型資訊；不支援的壓縮區塊僅顯示區塊資訊。","Sebagian properti biner hanya menampilkan tipe; kompresi yang tidak didukung menampilkan info blok.","一部のバイナリ属性は型情報のみ表示します。未対応の圧縮はチャンク情報を表示します。","คุณสมบัติไบนารีบางส่วนแสดงเฉพาะชนิด การบีบอัดที่ไม่รองรับแสดงข้อมูลบล็อก","일부 바이너리 속성은 형식 정보만 표시하며 미지원 압축은 블록 정보를 표시합니다."],
    ["This tool is unavailable.","此工具暂不可用。","此工具暫時無法使用。","Alat ini tidak tersedia.","このツールは利用できません。","เครื่องมือนี้ไม่พร้อมใช้งาน","이 도구를 사용할 수 없습니다."],
    ["Use Roblox’s preview when it is available for this item.","此物品未提供可用控件，请使用 Roblox 提供的预览。","此物品未提供可用控制項，請使用 Roblox 提供的預覽。","Gunakan pratinjau Roblox jika tersedia untuk item ini.","このアイテムで利用可能なRobloxのプレビューを使用してください。","ใช้ตัวอย่างของ Roblox เมื่อไอเท็มนี้รองรับ","이 아이템에 지원되는 Roblox 미리 보기를 사용하세요."],
    ["Load current avatar","加载当前头像","載入目前虛擬人偶","Muat avatar saat ini","現在のアバターを読み込む","โหลดอวาตาร์ปัจจุบัน","현재 아바타 불러오기"],
    ["Changes apply to your Roblox avatar only after you select Apply.","点击「应用」后才会更改你的 Roblox 头像。","點選「套用」後才會更改你的 Roblox 虛擬人偶。","Perubahan avatar Roblox diterapkan hanya setelah memilih Terapkan.","「適用」を選択した場合のみRobloxアバターを変更します。","อวาตาร์ Roblox จะเปลี่ยนหลังจากคุณเลือกใช้เท่านั้น","적용을 선택한 후에만 Roblox 아바타가 변경됩니다."],
    ["Body colors","身体颜色","身體顏色","Warna tubuh","体の色","สีร่างกาย","신체 색상"],
    ["Head","头部","頭部","Kepala","頭","ศีรษะ","머리"],
    ["Torso","躯干","軀幹","Torso","胴体","ลำตัว","몸통"],
    ["Left arm","左臂","左臂","Lengan kiri","左腕","แขนซ้าย","왼팔"],
    ["Right arm","右臂","右臂","Lengan kanan","右腕","แขนขวา","오른팔"],
    ["Left leg","左腿","左腿","Kaki kiri","左脚","ขาซ้าย","왼쪽 다리"],
    ["Right leg","右腿","右腿","Kaki kanan","右脚","ขาขวา","오른쪽 다리"],
    ["Body color preview","身体颜色预览","身體顏色預覽","Pratinjau warna tubuh","体の色のプレビュー","ตัวอย่างสีร่างกาย","신체 색상 미리 보기"],
    ["Apply colors","应用颜色","套用顏色","Terapkan warna","色を適用","ใช้สี","색상 적용"],
    ["Reset preview","重置预览","重設預覽","Atur ulang pratinjau","プレビューをリセット","รีเซ็ตตัวอย่าง","미리 보기 초기화"],
    ["Accessory adjustments","饰品调整","飾品調整","Penyesuaian aksesori","アクセサリー調整","ปรับแต่งเครื่องประดับ","액세서리 조정"],
    ["Equipped accessory","已穿戴饰品","已穿戴飾品","Aksesori dipakai","装着中のアクセサリー","เครื่องประดับที่สวมอยู่","착용 중인 액세서리"],
    ["Position","位置","位置","Posisi","位置","ตำแหน่ง","위치"],
    ["Rotation","旋转","旋轉","Rotasi","回転","การหมุน","회전"],
    ["Scale","缩放","縮放","Skala","拡大率","ขนาด","크기"],
    ["No adjustable accessories are currently equipped.","当前没有可调整的已穿戴饰品。","目前沒有可調整的已穿戴飾品。","Tidak ada aksesori yang dapat disesuaikan sedang dipakai.","現在、調整可能なアクセサリーを装着していません。","ขณะนี้ไม่มีเครื่องประดับที่ปรับแต่งได้สวมอยู่","현재 조정 가능한 액세서리를 착용하지 않았습니다."],
    ["Apply accessory","应用饰品调整","套用飾品調整","Terapkan aksesori","アクセサリーに適用","ใช้การปรับแต่ง","액세서리 적용"],
    ["Available accessories and adjustment limits follow Roblox’s current rules.","可调整的饰品和范围遵循 Roblox 当前规则。","可調整的飾品與範圍遵循 Roblox 目前規則。","Aksesori dan batas penyesuaian mengikuti aturan Roblox saat ini.","調整可能なアクセサリーと範囲はRobloxの現在のルールに従います。","เครื่องประดับและขอบเขตการปรับแต่งเป็นไปตามกฎปัจจุบันของ Roblox","조정 가능한 액세서리와 범위는 현재 Roblox 규칙을 따릅니다."],
    ["Saved. Refresh the Roblox page to update its preview.","已保存。刷新 Roblox 页面以更新预览。","已儲存。重新整理 Roblox 頁面以更新預覽。","Disimpan. Muat ulang halaman Roblox untuk memperbarui pratinjau.","保存しました。Robloxページを更新するとプレビューに反映されます。","บันทึกแล้ว รีเฟรชหน้า Roblox เพื่ออัปเดตตัวอย่าง","저장되었습니다. Roblox 페이지를 새로 고치면 미리 보기에 반영됩니다."],
    ["Refresh page","刷新页面","重新整理頁面","Muat ulang halaman","ページを更新","รีเฟรชหน้า","페이지 새로 고침"],
    ["Load your avatar first.","请先加载当前头像。","請先載入目前虛擬人偶。","Muat avatar terlebih dahulu.","先にアバターを読み込んでください。","โปรดโหลดอวาตาร์ก่อน","먼저 아바타를 불러오세요."],
    ["Invalid body colors.","颜色格式无效，请输入完整 HEX 颜色。","顏色格式無效，請輸入完整 HEX 顏色。","Warna tidak valid. Masukkan warna HEX lengkap.","色が無効です。完全なHEXカラーを入力してください。","สีไม่ถูกต้อง โปรดป้อนสี HEX ให้ครบ","잘못된 색상입니다. 전체 HEX 색상을 입력하세요."],
    ["Accessory values are outside Roblox limits.","饰品参数超出 Roblox 允许范围。","飾品參數超出 Roblox 允許範圍。","Nilai aksesori di luar batas Roblox.","アクセサリーの値がRobloxの範囲外です。","ค่าเครื่องประดับเกินขอบเขตของ Roblox","액세서리 값이 Roblox 허용 범위를 벗어났습니다."],
    ["Sign in to Roblox to use this tool.","请登录 Roblox 后使用此工具。","請登入 Roblox 後使用此工具。","Masuk ke Roblox untuk menggunakan alat ini.","このツールを使うにはRobloxにログインしてください。","เข้าสู่ระบบ Roblox เพื่อใช้เครื่องมือนี้","이 도구를 사용하려면 Roblox에 로그인하세요."],
    ["Roblox did not allow access to this resource.","Roblox 未允许访问此资源。","Roblox 未允許存取此資源。","Roblox tidak mengizinkan akses ke sumber daya ini.","Robloxがこのリソースへのアクセスを許可していません。","Roblox ไม่อนุญาตให้เข้าถึงทรัพยากรนี้","Roblox가 이 리소스 접근을 허용하지 않았습니다."],
    ["Your Roblox account changed. Reload the editor.","Roblox 账号已更换，请重新加载编辑器。","Roblox 帳號已更換，請重新載入編輯器。","Akun Roblox berubah. Muat ulang editor.","Robloxアカウントが変更されました。エディターを読み込み直してください。","บัญชี Roblox เปลี่ยนแล้ว โปรดโหลดตัวแก้ไขใหม่","Roblox 계정이 변경되었습니다. 편집기를 다시 불러오세요."],
    ["Server location","服务器地区","伺服器地區","Lokasi server","サーバーの地域","ตำแหน่งเซิร์ฟเวอร์","서버 위치"],
    ["Connection","连接","連線","Koneksi","接続","การเชื่อมต่อ","연결"],
    ["Order and availability","排序与空位","排序與空位","Urutan dan ketersediaan","並び順と空き状況","ลำดับและที่ว่าง","정렬 및 빈자리"],
    ["About server data","服务器数据说明","伺服器資料說明","Tentang data server","サーバーデータについて","เกี่ยวกับข้อมูลเซิร์ฟเวอร์","서버 데이터 안내"],
    ["Filter options","筛选选项","篩選選項","Opsi filter","絞り込み設定","ตัวเลือกตัวกรอง","필터 옵션"],
    ["Not full","未满服务器","未滿伺服器","Belum penuh","満員以外","ยังไม่เต็ม","빈자리가 있는 서버"],
    ["Best connection","最佳连接","最佳連線","Koneksi terbaik","接続品質順","การเชื่อมต่อดีที่สุด","최적 연결"],
    ["Random shuffle","随机打乱","隨機排序","Acak urutan","ランダム表示","สุ่มลำดับ","무작위 정렬"],
    ["City","城市","城市","Kota","都市","เมือง","도시"],
    ["City: {city}","城市：{city}","城市：{city}","Kota: {city}","都市：{city}","เมือง: {city}","도시: {city}"],
    ["All cities","所有城市","所有城市","Semua kota","すべての都市","ทุกเมือง","모든 도시"],
    ["Only selected location","仅选定地区","僅選定地區","Hanya lokasi dipilih","選択した地域のみ","เฉพาะตำแหน่งที่เลือก","선택한 위치만"],
    ["Preferred city, then nearest","优先此城市，其次最近城市","優先此城市，其次最近城市","Utamakan kota ini, lalu terdekat","指定都市を優先し、次に近い都市","เมืองที่ต้องการก่อน แล้วเมืองใกล้ที่สุด","선호 도시 우선, 다음으로 가까운 도시"],
    ["Location preference","地区偏好","地區偏好","Preferensi lokasi","地域の優先設定","การตั้งค่าตำแหน่ง","위치 선호도"],
    ["Sort servers","服务器排序","伺服器排序","Urutkan server","サーバーの並び順","เรียงเซิร์ฟเวอร์","서버 정렬"],
    ["Newest servers","最新服务器","最新伺服器","Server terbaru","新しいサーバー順","เซิร์ฟเวอร์ใหม่ที่สุด","최신 서버"],
    ["Oldest servers","最旧服务器","最舊伺服器","Server terlama","古いサーバー順","เซิร์ฟเวอร์เก่าที่สุด","가장 오래된 서버"],
    ["Exclude full servers","排除已满服务器","排除已滿伺服器","Kecualikan server penuh","満員のサーバーを除外","ไม่รวมเซิร์ฟเวอร์ที่เต็ม","가득 찬 서버 제외"],
    ["Random server","随机加入服务器","隨機加入伺服器","Gabung server acak","ランダムなサーバーに参加","เข้าร่วมเซิร์ฟเวอร์แบบสุ่ม","무작위 서버 참가"],
    ["City map","城市分布图","城市分布圖","Peta kota","都市マップ","แผนที่เมือง","도시 지도"],
    ["Server globe","服务器地球仪","伺服器地球儀","Globe server","サーバー地球儀","ลูกโลกเซิร์ฟเวอร์","서버 지구본"],
    ["Interactive server globe","交互式服务器地球仪","互動式伺服器地球儀","Globe server interaktif","操作できるサーバー地球儀","ลูกโลกเซิร์ฟเวอร์แบบโต้ตอบ","대화형 서버 지구본"],
    ["Zoom in","放大","放大","Perbesar","拡大","ซูมเข้า","확대"],
    ["Zoom out","缩小","縮小","Perkecil","縮小","ซูมออก","축소"],
    ["Reset globe view","重置地球视角","重設地球視角","Atur ulang tampilan globe","地球儀の表示をリセット","รีเซ็ตมุมมองลูกโลก","지구본 보기 초기화"],
    ["On the globe","当前指向","目前指向","Di globe","カーソル位置","บนลูกโลก","지구본에서 가리킨 위치"],
    ["Selected location","选定地区","選定地區","Lokasi dipilih","選択中の地域","ตำแหน่งที่เลือก","선택한 위치"],
    ["{count} loaded servers","{count} 个已加载服务器","{count} 個已載入伺服器","{count} server dimuat","読み込み済みサーバー {count}件","โหลดแล้ว {count} เซิร์ฟเวอร์","불러온 서버 {count}개"],
    ["Countries / regions","国家／地区","國家／地區","Negara / wilayah","国・地域","ประเทศ / ภูมิภาค","국가 / 지역"],
    ["Search countries","搜索国家或地区","搜尋國家或地區","Cari negara atau wilayah","国・地域を検索","ค้นหาประเทศหรือภูมิภาค","국가 또는 지역 검색"],
    ["No countries found.","未找到国家或地区。","找不到國家或地區。","Negara atau wilayah tidak ditemukan.","国・地域が見つかりません。","ไม่พบประเทศหรือภูมิภาค","국가 또는 지역을 찾을 수 없습니다."],
    ["{count} countries with loaded servers","{count} 个地区有已加载服务器","{count} 個地區有已載入伺服器","{count} wilayah dengan server dimuat","読み込み済みサーバーがある地域：{count}","{count} ภูมิภาคมีเซิร์ฟเวอร์ที่โหลดแล้ว","불러온 서버가 있는 지역 {count}개"],
    ["No loaded servers here. Use Search to load more servers.","此地区暂无已加载服务器，点击「搜索」可继续查找。","此地區暫無已載入伺服器，點選「搜尋」可繼續尋找。","Belum ada server dimuat di sini. Gunakan Cari untuk memuat lebih banyak.","この地域のサーバーは未読み込みです。「検索」で追加を探せます。","ยังไม่มีเซิร์ฟเวอร์ที่โหลดในบริเวณนี้ กดค้นหาเพื่อโหลดเพิ่ม","이 지역에 불러온 서버가 없습니다. 검색으로 더 불러오세요."],
    ["Loading globe…","正在加载地球仪…","正在載入地球儀…","Memuat globe…","地球儀を読み込み中…","กำลังโหลดลูกโลก…","지구본 불러오는 중…"],
    ["Could not load the globe. Country filters still work.","地球仪加载失败，仍可使用国家筛选下拉框。","地球儀載入失敗，仍可使用國家篩選下拉選單。","Globe gagal dimuat. Filter negara tetap berfungsi.","地球儀を読み込めません。国の選択欄は引き続き使えます。","โหลดลูกโลกไม่ได้ แต่ยังใช้ตัวกรองประเทศได้","지구본을 불러오지 못했습니다. 국가 필터는 계속 사용할 수 있습니다."],
    ["Drag to rotate. Click a country to filter. Arrow keys rotate; + and − zoom.","拖动旋转，点击国家筛选。方向键旋转，+ 和 − 缩放。","拖曳旋轉，點選國家篩選。方向鍵旋轉，+ 和 − 縮放。","Seret untuk memutar. Klik negara untuk memfilter. Tombol panah memutar; + dan − memperbesar atau memperkecil.","ドラッグで回転、国をクリックして絞り込み。矢印キーで回転、+ と − で拡大・縮小。","ลากเพื่อหมุน คลิกประเทศเพื่อกรอง ปุ่มลูกศรใช้หมุน + และ − ใช้ซูม","드래그로 회전하고 국가를 클릭해 필터링하세요. 방향키로 회전, +와 −로 확대·축소합니다."],
    ["Locations and counts are based on loaded servers. City locations are approximate.","位置和数量仅统计已加载的服务器，城市位置为估算。","位置與數量僅統計已載入的伺服器，城市位置為估算。","Lokasi dan jumlah berdasarkan server yang dimuat. Lokasi kota adalah perkiraan.","読み込み済みサーバーの位置と件数です。都市の位置は推定です。","ตำแหน่งและจำนวนมาจากเซิร์ฟเวอร์ที่โหลดแล้ว ตำแหน่งเมืองเป็นค่าประมาณ","위치와 개수는 불러온 서버 기준이며 도시 위치는 추정치입니다."],
    ["Filters combine. Unknown values sort last. Location fallback uses only loaded servers.","筛选可组合，未知数据排在最后。地区回退仅比较已加载的服务器。","篩選可組合，未知資料排在最後。地區回退僅比較已載入的伺服器。","Filter dapat digabung. Nilai tak diketahui di akhir. Lokasi cadangan hanya memakai server yang dimuat.","条件は組み合わせ可能です。不明な値は最後に表示し、地域の代替は読み込み済みサーバーから選びます。","ใช้ตัวกรองร่วมกันได้ ค่าที่ไม่ทราบอยู่ท้ายสุด ตำแหน่งสำรองใช้เฉพาะเซิร์ฟเวอร์ที่โหลดแล้ว","필터를 조합할 수 있습니다. 알 수 없는 값은 마지막에 정렬되며 대체 위치는 불러온 서버에서 선택합니다."],
    ["Filters combine. Newest and oldest need verified server start times, which are unavailable for this list.","筛选可组合。此列表缺少可靠的服务器启动时间，暂不能按新旧排序。","篩選可組合。此清單缺少可靠的伺服器啟動時間，暫不能按新舊排序。","Filter dapat digabung. Urutan terbaru dan terlama memerlukan waktu mulai server yang belum tersedia untuk daftar ini.","条件は組み合わせ可能です。この一覧には確認済みの起動時刻がなく、新旧順では並べ替えできません。","ใช้ตัวกรองร่วมกันได้ รายการนี้ไม่มีเวลาเริ่มเซิร์ฟเวอร์ที่ยืนยันแล้ว จึงเรียงตามใหม่หรือเก่าไม่ได้","필터를 조합할 수 있습니다. 이 목록에는 확인된 서버 시작 시간이 없어 최신·오래된 순 정렬을 사용할 수 없습니다."],
    ["No joinable servers match these filters.","没有符合筛选条件且可以加入的服务器。","沒有符合篩選條件且可加入的伺服器。","Tidak ada server yang dapat dimasuki sesuai filter.","条件に一致する参加可能なサーバーがありません。","ไม่มีเซิร์ฟเวอร์ที่เข้าร่วมได้ตรงกับตัวกรอง","필터에 맞는 참가 가능한 서버가 없습니다."],
    ["Search limit reached. Select Search again to check more servers.","已达到本次搜索上限，再次点击搜索可继续查找。","已達本次搜尋上限，再次點選搜尋可繼續尋找。","Batas pencarian tercapai. Pilih Cari lagi untuk memeriksa server lainnya.","今回の検索上限に達しました。再度検索すると続きを確認できます。","ถึงขีดจำกัดการค้นหาครั้งนี้แล้ว กดค้นหาอีกครั้งเพื่อตรวจสอบเซิร์ฟเวอร์เพิ่ม","검색 한도에 도달했습니다. 검색을 다시 선택하면 더 많은 서버를 확인합니다."],
    ["Game notes","游戏备注","遊戲備註","Catatan game","ゲームのメモ","บันทึกเกม","게임 메모"],
    ["Private to this browser. Notes are shared across your Roblox accounts and are not posted to Roblox.","备注仅保存在此浏览器，所有 Roblox 账号共用，不会发布到 Roblox。","備註僅儲存在此瀏覽器，所有 Roblox 帳號共用，不會發佈到 Roblox。","Catatan hanya disimpan di browser ini, digunakan bersama oleh akun Roblox Anda, dan tidak dipublikasikan ke Roblox.","メモはこのブラウザー内でRobloxアカウント間で共有され、Robloxには公開されません。","บันทึกเก็บไว้ในเบราว์เซอร์นี้ ใช้ร่วมกันระหว่างบัญชี Roblox ของคุณ และไม่เผยแพร่บน Roblox","메모는 이 브라우저에만 저장되고 Roblox 계정 간에 공유되며 Roblox에 게시되지 않습니다."],
    ["Add note","添加备注","新增備註","Tambah catatan","メモを追加","เพิ่มบันทึก","메모 추가"],
    ["Edit note","编辑备注","編輯備註","Edit catatan","メモを編集","แก้ไขบันทึก","메모 편집"],
    ["No note for this game yet.","还没有为此游戏写备注。","尚未為此遊戲撰寫備註。","Belum ada catatan untuk game ini.","このゲームのメモはまだありません。","ยังไม่มีบันทึกสำหรับเกมนี้","아직 이 게임의 메모가 없습니다."],
    ["Private note","私人备注","私人備註","Catatan pribadi","自分用のメモ","บันทึกส่วนตัว","개인 메모"],
    ["Write a reminder, strategy, or anything you want to remember…","记下提醒、攻略或任何想记住的内容…","記下提醒、攻略或任何想記住的內容…","Tulis pengingat, strategi, atau hal lain yang ingin Anda ingat…","覚えておきたいことや攻略などを記入…","เขียนสิ่งเตือนความจำ เทคนิค หรือสิ่งที่อยากจำ…","기억할 내용이나 공략 등을 적어 보세요…"],
    ["{count}/{max} characters","{count}/{max} 字符","{count}/{max} 字元","{count}/{max} karakter","{count}/{max}文字","{count}/{max} ตัวอักษร","{count}/{max}자"],
    ["Delete note","删除备注","刪除備註","Hapus catatan","メモを削除","ลบบันทึก","메모 삭제"],
    ["Save now","立即保存","立即儲存","Simpan sekarang","今すぐ保存","บันทึกตอนนี้","지금 저장"],
    ["Could not load game notes. Try again.","无法加载游戏备注，请重试。","無法載入遊戲備註，請重試。","Tidak dapat memuat catatan game. Coba lagi.","ゲームのメモを読み込めませんでした。もう一度お試しください。","ไม่สามารถโหลดบันทึกเกมได้ โปรดลองอีกครั้ง","게임 메모를 불러올 수 없습니다. 다시 시도하세요."],
    ["Loading game notes…","正在加载游戏备注…","正在載入遊戲備註…","Memuat catatan game…","ゲームのメモを読み込み中…","กำลังโหลดบันทึกเกม…","게임 메모 불러오는 중…"],
    ["Notes can contain up to {max} characters.","每条备注最多 {max} 个字符。","每則備註最多 {max} 個字元。","Catatan dapat berisi hingga {max} karakter.","メモは最大{max}文字です。","บันทึกมีได้สูงสุด {max} ตัวอักษร","메모는 최대 {max}자까지 작성할 수 있습니다."],
    ["You can save notes for up to {max} games.","最多可为 {max} 个游戏保存备注。","最多可為 {max} 個遊戲儲存備註。","Anda dapat menyimpan catatan untuk hingga {max} game.","最大{max}個のゲームにメモを保存できます。","บันทึกได้สูงสุด {max} เกม","최대 {max}개 게임의 메모를 저장할 수 있습니다."],
    ["Could not save note. Your text is kept. Try again.","无法保存备注，已保留输入内容，请重试。","無法儲存備註，已保留輸入內容，請重試。","Tidak dapat menyimpan catatan. Teks Anda tetap ada. Coba lagi.","メモを保存できませんでした。入力内容は残っています。もう一度お試しください。","ไม่สามารถบันทึกได้ ข้อความยังอยู่ โปรดลองอีกครั้ง","메모를 저장할 수 없습니다. 입력한 내용은 유지됩니다. 다시 시도하세요."],
    ["Saving note…","正在保存备注…","正在儲存備註…","Menyimpan catatan…","メモを保存中…","กำลังบันทึก…","메모 저장 중…"],
    ["Changes save automatically.","更改会自动保存。","變更會自動儲存。","Perubahan disimpan otomatis.","変更は自動的に保存されます。","การเปลี่ยนแปลงจะบันทึกอัตโนมัติ","변경 사항은 자동으로 저장됩니다."],
    ["Note saved.","备注已保存。","備註已儲存。","Catatan tersimpan.","メモを保存しました。","บันทึกแล้ว","메모를 저장했습니다."],
    ["Note deleted.","备注已删除。","備註已刪除。","Catatan dihapus.","メモを削除しました。","ลบบันทึกแล้ว","메모를 삭제했습니다."],
    ["Try again","重试","重試","Coba lagi","再試行","ลองอีกครั้ง","다시 시도"],
    ["{count} game notes are included. Import replaces saved notes, including when the backup contains none.","包含 {count} 条游戏备注。导入会替换已保存的备注，即使此备份没有备注。","包含 {count} 則遊戲備註。匯入會取代已儲存的備註，即使此備份沒有備註。","Berisi {count} catatan game. Impor mengganti catatan tersimpan, termasuk jika cadangan tidak berisi catatan.","ゲームのメモが{count}件含まれています。メモがないバックアップでも、読み込むと保存済みメモが置き換わります。","มีบันทึกเกม {count} รายการ การนำเข้าจะแทนที่บันทึกที่มีอยู่ แม้ข้อมูลสำรองจะไม่มีบันทึก","게임 메모 {count}개가 포함되어 있습니다. 백업에 메모가 없어도 가져오면 저장된 메모를 교체합니다."],
    ["Saved game notes are also deleted.","已保存的游戏备注也会被删除。","已儲存的遊戲備註也會被刪除。","Catatan game tersimpan juga dihapus.","保存済みのゲームのメモも削除されます。","บันทึกเกมที่บันทึกไว้จะถูกลบด้วย","저장한 게임 메모도 삭제됩니다."],
    ["Game notes are included in backups and replaced when importing.","备份包含游戏备注，导入时会替换已保存的备注。","備份包含遊戲備註，匯入時會取代已儲存的備註。","Catatan game disertakan dalam cadangan dan diganti saat impor.","ゲームのメモはバックアップに含まれ、読み込むと置き換わります。","บันทึกเกมรวมอยู่ในข้อมูลสำรองและจะถูกแทนที่เมื่อนำเข้า","게임 메모는 백업에 포함되며 가져올 때 교체됩니다."],
    ["Enable Pinned Games","启用置顶游戏","啟用釘選遊戲","Aktifkan Game yang Disematkan","ゲームのピン留めを有効にする","เปิดใช้การปักหมุดเกม","게임 고정 기능 사용"],
    ["Turn off to remove Pinned Games from Home and the pin buttons on game pages. Your saved games and folders remain available here.","关闭后，首页置顶区域和游戏页面的置顶按钮都会消失。已保存的游戏和文件夹仍可在这里查看。","關閉後，首頁釘選區域和遊戲頁面的釘選按鈕都會消失。已儲存的遊戲和資料夾仍可在這裡查看。","Nonaktifkan untuk menghapus Game yang Disematkan dari Beranda dan tombol sematkan di halaman game. Game dan folder yang tersimpan tetap dapat dilihat di sini.","オフにすると、ホームのピン留め欄とゲームページのピン留めボタンが消えます。保存したゲームとフォルダーは、ここで引き続き確認できます。","เมื่อปิด ส่วนเกมที่ปักหมุดบนหน้าหลักและปุ่มปักหมุดบนหน้าเกมจะหายไป คุณยังดูเกมและโฟลเดอร์ที่บันทึกไว้ได้ที่นี่","끄면 홈의 고정 게임 영역과 게임 페이지의 고정 버튼이 사라집니다. 저장한 게임과 폴더는 여기에서 계속 확인할 수 있습니다."],
    ["Saved games and folders","已保存的游戏和文件夹","已儲存的遊戲和資料夾","Game dan folder tersimpan","保存したゲームとフォルダー","เกมและโฟลเดอร์ที่บันทึกไว้","저장한 게임 및 폴더"],
    ["Loading saved games and folders…","正在加载已保存的游戏和文件夹…","正在載入已儲存的遊戲和資料夾…","Memuat game dan folder tersimpan…","保存したゲームとフォルダーを読み込み中…","กำลังโหลดเกมและโฟลเดอร์ที่บันทึกไว้…","저장한 게임과 폴더 불러오는 중…"],
    ["Could not load saved games and folders.","无法加载已保存的游戏和文件夹。","無法載入已儲存的遊戲和資料夾。","Tidak dapat memuat game dan folder tersimpan.","保存したゲームとフォルダーを読み込めませんでした。","ไม่สามารถโหลดเกมและโฟลเดอร์ที่บันทึกไว้ได้","저장한 게임과 폴더를 불러올 수 없습니다."],
    ["No pinned games yet.","尚未保存置顶游戏。","尚未儲存釘選遊戲。","Belum ada game yang disematkan.","ピン留めしたゲームはまだありません。","ยังไม่มีเกมที่ปักหมุด","아직 고정한 게임이 없습니다."],
    ["No games in this folder.","此文件夹中暂无游戏。","此資料夾尚無遊戲。","Tidak ada game dalam folder ini.","このフォルダーにゲームはありません。","ไม่มีเกมในโฟลเดอร์นี้","이 폴더에 게임이 없습니다."],
    ["{count} folders","{count} 个文件夹","{count} 個資料夾","{count} folder","{count}個のフォルダー","{count} โฟลเดอร์","폴더 {count}개"],
    ["Home banner","首页横幅","首頁橫幅","Banner beranda","ホームバナー","แบนเนอร์หน้าหลัก","홈 배너"],
    ["Show Home banner","显示首页横幅","顯示首頁橫幅","Tampilkan banner beranda","ホームバナーを表示","แสดงแบนเนอร์หน้าหลัก","홈 배너 표시"],
    ["Show banner background and border","显示横幅背景框","顯示橫幅背景框","Tampilkan latar belakang dan bingkai banner","バナーの背景と枠線を表示","แสดงพื้นหลังและกรอบแบนเนอร์","배너 배경과 테두리 표시"],
    ["Banner contents","横幅内容","橫幅內容","Isi banner","バナーの表示内容","เนื้อหาในแบนเนอร์","배너 내용"],
    ["Show avatar","显示头像","顯示頭像","Tampilkan avatar","アバターを表示","แสดงอวาตาร์","아바타 표시"],
    ["Show Home label","显示「你的主页」标题","顯示「你的首頁」標題","Tampilkan label beranda","ホームの見出しを表示","แสดงหัวข้อหน้าหลัก","홈 제목 표시"],
    ["Show display name","显示昵称","顯示暱稱","Tampilkan nama tampilan","表示名を表示","แสดงชื่อที่แสดง","표시 이름 표시"],
    ["Show username","显示用户名","顯示使用者名稱","Tampilkan nama pengguna","ユーザー名を表示","แสดงชื่อผู้ใช้","사용자 이름 표시"],
    ["Show greeting","显示问候语","顯示問候語","Tampilkan sapaan","あいさつを表示","แสดงคำทักทาย","인사말 표시"],
    ["Show clock","显示时间","顯示時間","Tampilkan jam","時計を表示","แสดงนาฬิกา","시계 표시"],
    ["Show most played","显示最常玩游戏","顯示最常玩的遊戲","Tampilkan game paling sering dimainkan","よく遊ぶゲームを表示","แสดงเกมที่เล่นบ่อย","가장 많이 플레이한 게임 표시"],
    ["Choose what appears in the banner. Hidden parts keep their settings and playtime history.","选择横幅中显示的内容。隐藏后会保留对应设置和游戏时长记录。","選擇橫幅中顯示的內容。隱藏後會保留對應設定和遊戲時間紀錄。","Pilih isi banner yang ditampilkan. Bagian tersembunyi tetap menyimpan pengaturan dan riwayat waktu bermain.","バナーに表示する内容を選びます。非表示にしても設定やプレイ時間の記録は残ります。","เลือกเนื้อหาที่จะแสดงในแบนเนอร์ การซ่อนจะไม่ลบการตั้งค่าหรือประวัติเวลาเล่น","배너에 표시할 내용을 선택하세요. 숨긴 항목의 설정과 플레이 시간 기록은 유지됩니다."],
    ["Website font","网页字体","網頁字體","Font situs web","ウェブサイトのフォント","แบบอักษรของเว็บไซต์","웹사이트 글꼴"],
    ["Font file","字体文件","字體檔案","File font","フォントファイル","ไฟล์แบบอักษร","글꼴 파일"],
    ["Use custom font","使用自定义字体","使用自訂字體","Gunakan font kustom","カスタムフォントを使用","ใช้แบบอักษรที่กำหนดเอง","사용자 지정 글꼴 사용"],
    ["Font preview","字体预览","字體預覽","Pratinjau font","フォントのプレビュー","ตัวอย่างแบบอักษร","글꼴 미리 보기"],
    ["Restore default font","恢复默认字体","恢復預設字體","Pulihkan font bawaan","標準フォントに戻す","คืนค่าแบบอักษรเริ่มต้น","기본 글꼴로 복원"],
    ["Choose a local font file to change text across Roblox. Your file stays in this browser.","选择本地字体文件，替换 Roblox 网页文字的字体。文件仅保存在此浏览器中。","選擇本機字體檔案，變更 Roblox 網頁文字的字體。檔案僅儲存在此瀏覽器中。","Pilih file font lokal untuk mengubah teks di Roblox. File Anda tetap tersimpan di browser ini.","ローカルのフォントファイルを選ぶと、Roblox内の文字に適用されます。ファイルはこのブラウザー内に保存されます。","เลือกไฟล์แบบอักษรในเครื่องเพื่อเปลี่ยนตัวอักษรบน Roblox ไฟล์จะเก็บไว้ในเบราว์เซอร์นี้เท่านั้น","로컬 글꼴 파일을 선택하여 Roblox 전체의 글꼴을 변경하세요. 파일은 이 브라우저에만 저장됩니다."],
    ["TTF, OTF, WOFF, or WOFF2, up to 32 MB. Missing characters use a fallback font.","支持 TTF、OTF、WOFF、WOFF2，最大 32 MB。字体中缺少的字符会使用备用字体。","支援 TTF、OTF、WOFF、WOFF2，最大 32 MB。字體中缺少的字元會使用備用字體。","TTF, OTF, WOFF, atau WOFF2, hingga 32 MB. Karakter yang tidak tersedia menggunakan font cadangan.","TTF、OTF、WOFF、WOFF2に対応。最大32 MB。含まれない文字には代替フォントを使用します。","รองรับ TTF, OTF, WOFF และ WOFF2 ขนาดไม่เกิน 32 MB ตัวอักษรที่ไม่มีในไฟล์จะใช้แบบอักษรสำรอง","TTF, OTF, WOFF, WOFF2를 지원하며 최대 32 MB입니다. 파일에 없는 문자는 대체 글꼴로 표시됩니다."],
    ["Loading font...","正在加载字体…","正在載入字體…","Memuat font...","フォントを読み込み中…","กำลังโหลดแบบอักษร…","글꼴 불러오는 중…"],
    ["Custom font is active.","自定义字体已启用。","自訂字體已啟用。","Font kustom aktif.","カスタムフォントを使用中です。","กำลังใช้แบบอักษรที่กำหนดเอง","사용자 지정 글꼴을 사용 중입니다."],
    ["The default Roblox font is active.","正在使用 Roblox 默认字体。","正在使用 Roblox 預設字體。","Font bawaan Roblox aktif.","Robloxの標準フォントを使用中です。","กำลังใช้แบบอักษรเริ่มต้นของ Roblox","Roblox 기본 글꼴을 사용 중입니다."],
    ["Choose a TTF, OTF, WOFF, or WOFF2 font file up to 32 MB.","请选择不超过 32 MB 的 TTF、OTF、WOFF 或 WOFF2 字体文件。","請選擇不超過 32 MB 的 TTF、OTF、WOFF 或 WOFF2 字體檔案。","Pilih file font TTF, OTF, WOFF, atau WOFF2 hingga 32 MB.","32 MB以下のTTF、OTF、WOFF、WOFF2ファイルを選んでください。","เลือกไฟล์แบบอักษร TTF, OTF, WOFF หรือ WOFF2 ขนาดไม่เกิน 32 MB","32 MB 이하의 TTF, OTF, WOFF 또는 WOFF2 글꼴 파일을 선택하세요."],
    ["This font file could not be loaded. Try another font file.","无法加载此字体文件，请尝试其他字体文件。","無法載入此字體檔案，請嘗試其他字體檔案。","File font ini tidak dapat dimuat. Coba file font lain.","このフォントを読み込めませんでした。別のファイルをお試しください。","ไม่สามารถโหลดไฟล์แบบอักษรนี้ได้ โปรดลองไฟล์อื่น","이 글꼴 파일을 불러올 수 없습니다. 다른 파일을 선택하세요."],
    ["Your saved font file is unavailable. Choose it again.","已保存的字体文件不可用，请重新选择。","已儲存的字體檔案無法使用，請重新選擇。","File font tersimpan tidak tersedia. Pilih kembali.","保存したフォントファイルが見つかりません。もう一度選んでください。","ไม่พบไฟล์แบบอักษรที่บันทึกไว้ โปรดเลือกอีกครั้ง","저장한 글꼴 파일을 사용할 수 없습니다. 다시 선택하세요."],
    ["A custom font file is included.","此备份包含自定义字体文件。","此備份包含自訂字體檔案。","File font kustom disertakan.","カスタムフォントファイルが含まれています。","มีไฟล์แบบอักษรที่กำหนดเองรวมอยู่ด้วย","사용자 지정 글꼴 파일이 포함되어 있습니다."],
    ["Low latency","低延迟","低延遲","Latensi rendah","低遅延","ความหน่วงต่ำ","낮은 지연 시간"],
    ["Moderate latency","中等延迟","中等延遲","Latensi sedang","中程度の遅延","ความหน่วงปานกลาง","보통 지연 시간"],
    ["High latency","高延迟","高延遲","Latensi tinggi","高遅延","ความหน่วงสูง","높은 지연 시간"],
    ["Latency unavailable","延迟暂不可用","延遲暫不可用","Latensi tidak tersedia","遅延情報なし","ไม่มีข้อมูลความหน่วง","지연 시간 확인 불가"],
    ["Checking latency...","正在获取延迟…","正在取得延遲…","Memeriksa latensi...","遅延を確認中…","กำลังตรวจสอบความหน่วง…","지연 시간 확인 중…"],
    ["Game {id}","游戏 {id}","遊戲 {id}","Game {id}","ゲーム {id}","เกม {id}","게임 {id}"],
    ["Recent servers are not included in full backups.","完整备份不包含最近服务器。","完整備份不包含最近伺服器。","Server terbaru tidak disertakan dalam cadangan lengkap.","最近のサーバーは全体バックアップには含まれません。","เซิร์ฟเวอร์ล่าสุดจะไม่รวมอยู่ในข้อมูลสำรองทั้งหมด","최근 서버는 전체 백업에 포함되지 않습니다."],
    ["Recent servers","最近的服务器","最近的伺服器","Server terbaru","最近のサーバー","เซิร์ฟเวอร์ล่าสุด","최근 서버"],
    ["View recent servers","查看最近服务器","查看最近伺服器","Lihat server terbaru","最近のサーバーを表示","ดูเซิร์ฟเวอร์ล่าสุด","최근 서버 보기"],
    ["Remember recent servers","记录最近服务器","記錄最近伺服器","Catat server terbaru","最近のサーバーを記録","จดจำเซิร์ฟเวอร์ล่าสุด","최근 서버 기록"],
    ["Keeps a separate list of up to 6 servers for each game and account, removing that game’s oldest entry when full. Checks Roblox presence while your browser runs, independently of playtime tracking.","为每个账号的每个游戏单独保存最多 6 个服务器，满额后移除该游戏最旧的记录。浏览器运行时检查 Roblox 状态，与游戏时长记录分开控制。","為每個帳號的每個遊戲分別儲存最多 6 個伺服器，額滿後移除該遊戲最舊的記錄。瀏覽器執行時檢查 Roblox 狀態，與遊戲時間記錄分開控制。","Menyimpan daftar terpisah berisi hingga 6 server untuk setiap game dan akun. Saat penuh, entri terlama dari game tersebut dihapus. Memeriksa status Roblox selama browser berjalan, terpisah dari pencatatan waktu bermain.","アカウントとゲームごとに最大6件のサーバーを保存し、上限を超えるとそのゲームの最も古い記録を削除します。ブラウザーの実行中にRobloxのステータスを確認します。プレイ時間の記録とは別に動作します。","เก็บรายชื่อแยกตามเกมและบัญชี เกมละไม่เกิน 6 เซิร์ฟเวอร์ เมื่อเต็มจะลบรายการที่เก่าที่สุดของเกมนั้น ตรวจสอบสถานะ Roblox ระหว่างที่เบราว์เซอร์ทำงาน โดยแยกจากการบันทึกเวลาเล่น","계정별로 각 게임의 서버를 최대 6개까지 따로 저장하며, 가득 차면 해당 게임의 가장 오래된 기록을 삭제합니다. 브라우저가 실행되는 동안 Roblox 접속 상태를 확인하며, 플레이 시간 기록과 별도로 작동합니다."],
    ["Server history is enabled.","服务器历史记录已开启。","伺服器歷史記錄已開啟。","Riwayat server diaktifkan.","サーバー履歴の記録は有効です。","เปิดใช้งานประวัติเซิร์ฟเวอร์แล้ว","서버 기록이 켜져 있습니다."],
    ["Server history is paused. Saved servers are kept.","服务器历史记录已暂停，已保存的服务器会保留。","伺服器歷史記錄已暫停，已儲存的伺服器會保留。","Riwayat server dijeda. Server yang tersimpan tetap disimpan.","サーバー履歴の記録を一時停止しています。保存済みのサーバーは残ります。","พักการบันทึกประวัติเซิร์ฟเวอร์ไว้ รายการที่บันทึกแล้วยังคงอยู่","서버 기록이 일시 중지되었습니다. 저장된 서버는 유지됩니다."],
    ["Sign in to Roblox to view recent servers.","登录 Roblox 以查看最近服务器。","登入 Roblox 以查看最近伺服器。","Masuk ke Roblox untuk melihat server terbaru.","最近のサーバーを見るにはRobloxにログインしてください。","เข้าสู่ระบบ Roblox เพื่อดูเซิร์ฟเวอร์ล่าสุด","최근 서버를 보려면 Roblox에 로그인하세요."],
    ["Could not load recent servers. Please try again.","无法加载最近服务器，请重试。","無法載入最近伺服器，請重試。","Tidak dapat memuat server terbaru. Coba lagi.","最近のサーバーを読み込めませんでした。もう一度お試しください。","ไม่สามารถโหลดเซิร์ฟเวอร์ล่าสุดได้ โปรดลองอีกครั้ง","최근 서버를 불러올 수 없습니다. 다시 시도하세요."],
    ["Your Roblox account changed. Refresh recent servers.","Roblox 账号已变更，请刷新最近服务器。","Roblox 帳號已變更，請重新整理最近伺服器。","Akun Roblox Anda berubah. Muat ulang server terbaru.","Robloxアカウントが変わりました。最近のサーバーを更新してください。","บัญชี Roblox ของคุณเปลี่ยนไป โปรดรีเฟรชเซิร์ฟเวอร์ล่าสุด","Roblox 계정이 변경되었습니다. 최근 서버를 새로 고치세요."],
    ["This server is no longer in your history.","此服务器已不在历史记录中。","此伺服器已不在歷史記錄中。","Server ini tidak lagi ada dalam riwayat Anda.","このサーバーは履歴にありません。","เซิร์ฟเวอร์นี้ไม่อยู่ในประวัติของคุณแล้ว","이 서버는 더 이상 기록에 없습니다."],
    ["Rejoin","重新加入","重新加入","Gabung kembali","再参加","เข้าร่วมอีกครั้ง","다시 참가"],
    ["Remove","移除","移除","Hapus","削除","ลบ","삭제"],
    ["Check availability","检查可用性","檢查可用性","Periksa ketersediaan","参加可否を確認","ตรวจสอบว่าเข้าร่วมได้หรือไม่","참가 가능 여부 확인"],
    ["Checking server…","正在检查服务器…","正在檢查伺服器…","Memeriksa server…","サーバーを確認中…","กำลังตรวจสอบเซิร์ฟเวอร์…","서버 확인 중…"],
    ["Server available.","服务器可用。","伺服器可用。","Server tersedia.","このサーバーに参加できます。","เซิร์ฟเวอร์นี้พร้อมให้เข้าร่วม","참가할 수 있는 서버입니다."],
    ["Server full. Check again later.","服务器已满，请稍后再检查。","伺服器已滿，請稍後再檢查。","Server penuh. Periksa lagi nanti.","このサーバーは満員です。後でもう一度確認してください。","เซิร์ฟเวอร์เต็ม โปรดตรวจสอบอีกครั้งภายหลัง","서버가 가득 찼습니다. 나중에 다시 확인하세요."],
    ["This public server is no longer available.","此公共服务器已不可用。","此公開伺服器已無法使用。","Server publik ini tidak lagi tersedia.","この公開サーバーは利用できなくなりました。","เซิร์ฟเวอร์สาธารณะนี้ไม่พร้อมใช้งานแล้ว","이 공개 서버는 더 이상 사용할 수 없습니다."],
    ["Not listed publicly. The server may be private or closed.","未在公共列表中找到，服务器可能为私人或已关闭。","未在公開清單中找到，伺服器可能為私人或已關閉。","Tidak tercantum dalam daftar publik. Server mungkin privat atau sudah ditutup.","公開一覧にありません。プライベートサーバーか、終了したサーバーの可能性があります。","ไม่พบในรายชื่อสาธารณะ เซิร์ฟเวอร์อาจเป็นส่วนตัวหรือปิดไปแล้ว","공개 목록에 없습니다. 비공개 서버이거나 종료된 서버일 수 있습니다."],
    ["Availability could not be confirmed. You can try rejoining.","无法确认可用性，你可以尝试重新加入。","無法確認可用性，你可以嘗試重新加入。","Ketersediaan belum dapat dipastikan. Anda dapat mencoba bergabung kembali.","参加可否を確認できませんでした。再参加を試すことができます。","ไม่สามารถยืนยันสถานะได้ คุณสามารถลองเข้าร่วมอีกครั้ง","참가 가능 여부를 확인하지 못했습니다. 다시 참가를 시도할 수 있습니다."],
    ["Availability not checked.","尚未检查可用性。","尚未檢查可用性。","Ketersediaan belum diperiksa.","参加可否は未確認です。","ยังไม่ได้ตรวจสอบสถานะ","참가 가능 여부를 확인하지 않았습니다."],
    ["No recent servers yet. Play a game while tracking is enabled.","暂无最近服务器，请在开启记录后游玩游戏。","尚無最近伺服器，請在開啟記錄後遊玩遊戲。","Belum ada server terbaru. Mainkan game saat pencatatan diaktifkan.","最近のサーバーはまだありません。記録を有効にしてゲームをプレイしてください。","ยังไม่มีเซิร์ฟเวอร์ล่าสุด เล่นเกมขณะที่เปิดใช้การบันทึกเพื่อเริ่มเก็บประวัติ","최근 서버가 없습니다. 기록을 켠 상태로 게임을 플레이하세요."],
    ["Search recent servers","搜索最近服务器","搜尋最近伺服器","Cari server terbaru","最近のサーバーを検索","ค้นหาเซิร์ฟเวอร์ล่าสุด","최근 서버 검색"],
    ["Rejoin opens Roblox. Closed, full, or restricted servers may reject the join.","重新加入会打开 Roblox。已关闭、已满或受限制的服务器可能拒绝加入。","重新加入會開啟 Roblox。已關閉、已滿或受限制的伺服器可能拒絕加入。","Gabung kembali akan membuka Roblox. Server yang ditutup, penuh, atau dibatasi mungkin menolak permintaan bergabung.","再参加するとRobloxが開きます。終了済み、満員、参加制限のあるサーバーには参加できない場合があります。","การเข้าร่วมอีกครั้งจะเปิด Roblox เซิร์ฟเวอร์ที่ปิด เต็ม หรือมีข้อจำกัดอาจไม่อนุญาตให้เข้าร่วม","다시 참가를 누르면 Roblox가 열립니다. 종료되었거나 가득 찼거나 접근이 제한된 서버에는 참가하지 못할 수 있습니다."],
    ["Delete recent servers","删除最近服务器","刪除最近伺服器","Hapus server terbaru","最近のサーバーを削除","ลบเซิร์ฟเวอร์ล่าสุด","최근 서버 삭제"],
    ["Delete recent servers for this account?","删除此账号的最近服务器记录？","刪除此帳號的最近伺服器記錄？","Hapus riwayat server terbaru untuk akun ini?","このアカウントの最近のサーバーを削除しますか？","ลบเซิร์ฟเวอร์ล่าสุดของบัญชีนี้หรือไม่?","이 계정의 최근 서버를 삭제할까요?"],
    ["Clear this game","清空此游戏","清空此遊戲","Kosongkan game ini","このゲームの履歴を消去","ล้างประวัติเกมนี้","이 게임 기록 삭제"],
    ["Delete recent servers for this game?","删除此游戏的最近服务器记录？","刪除此遊戲的最近伺服器記錄？","Hapus riwayat server terbaru untuk game ini?","このゲームの最近のサーバーを削除しますか？","ลบเซิร์ฟเวอร์ล่าสุดของเกมนี้หรือไม่?","이 게임의 최근 서버를 삭제할까요?"],
    ["Recent servers for all accounts are also deleted.","也会删除所有账号的最近服务器记录。","也會刪除所有帳號的最近伺服器記錄。","Riwayat server terbaru untuk semua akun juga dihapus.","すべてのアカウントの最近のサーバーも削除されます。","ประวัติเซิร์ฟเวอร์ล่าสุดของทุกบัญชีจะถูกลบด้วย","모든 계정의 최근 서버 기록도 삭제됩니다."],
    ["Author:","作者：","作者：","Pembuat:","作者：","ผู้สร้าง:","제작자:"],
    ["GitHub repository","GitHub 仓库","GitHub 儲存庫","Repositori GitHub","GitHubリポジトリ","ที่เก็บโค้ด GitHub","GitHub 저장소"],
    ["Terms of Service","服务条款","服務條款","Ketentuan Layanan","利用規約","ข้อกำหนดการใช้งาน","이용 약관"],
    ["Privacy Policy","隐私政策","隱私權政策","Kebijakan Privasi","プライバシーポリシー","นโยบายความเป็นส่วนตัว","개인정보 처리방침"],
    ["Welcome to Roblox Customizer","欢迎使用 Roblox Customizer","歡迎使用 Roblox Customizer","Selamat datang di Roblox Customizer","Roblox Customizerへようこそ","ยินดีต้อนรับสู่ Roblox Customizer","Roblox Customizer에 오신 것을 환영합니다"],
    ["Find your Customizer settings","找到插件设置","找到擴充功能設定","Temukan pengaturan Customizer","Customizer設定の開き方","เปิดการตั้งค่า Customizer","Customizer 설정 찾기"],
    ["Open settings in either of these two ways.","你可以通过以下两种方式打开设置。","你可以透過以下兩種方式開啟設定。","Buka pengaturan dengan salah satu dari dua cara berikut.","次の2つの方法で設定を開けます。","คุณสามารถเปิดการตั้งค่าได้สองวิธีต่อไปนี้","다음 두 가지 방법으로 설정을 열 수 있습니다."],
    ["From the Roblox website","从 Roblox 网页打开","從 Roblox 網頁開啟","Dari situs web Roblox","Robloxのウェブサイトから","จากเว็บไซต์ Roblox","Roblox 웹사이트에서 열기"],
    ["Click the gear in Roblox's top-right corner, then choose Roblox Customizer.","点击 Roblox 网页右上角的齿轮，再选择 Roblox Customizer。","點擊 Roblox 網頁右上角的齒輪，再選擇 Roblox Customizer。","Klik roda gigi di sudut kanan atas Roblox, lalu pilih Roblox Customizer.","Robloxの右上にある歯車をクリックし、Roblox Customizerを選びます。","คลิกรูปเฟืองที่มุมขวาบนของ Roblox แล้วเลือก Roblox Customizer","Roblox 오른쪽 위의 톱니바퀴를 클릭한 다음 Roblox Customizer를 선택하세요."],
    ["From your browser toolbar","从浏览器工具栏打开","從瀏覽器工具列開啟","Dari bilah alat browser","ブラウザーのツールバーから","จากแถบเครื่องมือของเบราว์เซอร์","브라우저 도구 모음에서 열기"],
    ["On a Roblox page, click the Roblox Customizer icon in your browser's top-right toolbar.","在 Roblox 网页中，点击浏览器右上角工具栏里的 Roblox Customizer 图标。","在 Roblox 網頁中，點擊瀏覽器右上角工具列裡的 Roblox Customizer 圖示。","Saat berada di halaman Roblox, klik ikon Roblox Customizer di bilah alat kanan atas browser.","Robloxのページで、ブラウザー右上のツールバーにあるRoblox Customizerアイコンをクリックします。","ขณะอยู่บนหน้า Roblox ให้คลิกไอคอน Roblox Customizer ที่แถบเครื่องมือมุมขวาบนของเบราว์เซอร์","Roblox 페이지에서 브라우저 오른쪽 위 도구 모음의 Roblox Customizer 아이콘을 클릭하세요."],
    ["If the icon is hidden, open your browser's Extensions menu and pin Roblox Customizer.","如果找不到图标，请打开浏览器的扩展菜单，并将 Roblox Customizer 固定到工具栏。","如果找不到圖示，請開啟瀏覽器的擴充功能選單，並將 Roblox Customizer 釘選到工具列。","Jika ikon tidak terlihat, buka menu Ekstensi browser dan sematkan Roblox Customizer.","アイコンが見つからない場合は、ブラウザーの拡張機能メニューからRoblox Customizerをツールバーに固定してください。","หากไม่พบไอคอน ให้เปิดเมนูส่วนขยายของเบราว์เซอร์แล้วปักหมุด Roblox Customizer","아이콘이 보이지 않으면 브라우저의 확장 프로그램 메뉴에서 Roblox Customizer를 도구 모음에 고정하세요."],
    ["Got it","知道了","知道了","Mengerti","わかりました","เข้าใจแล้ว","알겠습니다"],
    ["Update Changelog","更新公告","更新公告","Catatan pembaruan","更新のお知らせ","ประกาศอัปเดต","업데이트 안내"],
    ["Open settings","打开设置","開啟設定","Buka pengaturan","設定を開く","เปิดการตั้งค่า","설정 열기"],
    ["Please read and accept the Terms of Service for Roblox Customizer.","请阅读并接受 Roblox Customizer 的服务条款。","請閱讀並接受 Roblox Customizer 的服務條款。","Silakan baca dan setujui Ketentuan Layanan Roblox Customizer.","Roblox Customizerの利用規約をお読みのうえ、同意してください。","โปรดอ่านและยอมรับข้อกำหนดการใช้งานของ Roblox Customizer","Roblox Customizer 이용 약관을 읽고 동의해 주세요."],
    ["The Privacy Policy explains how the extension handles your data.","隐私政策说明扩展如何处理你的数据。","隱私權政策說明擴充功能如何處理你的資料。","Kebijakan Privasi menjelaskan cara ekstensi menangani data Anda.","データの取り扱いについては、プライバシーポリシーをご確認ください。","นโยบายความเป็นส่วนตัวอธิบายวิธีที่ส่วนขยายจัดการข้อมูลของคุณ","개인정보 처리방침에서 확장 프로그램의 데이터 처리 방식을 확인할 수 있습니다."],
    ["Accept and continue","接受并继续","接受並繼續","Setujui dan lanjutkan","同意して続ける","ยอมรับและดำเนินการต่อ","동의하고 계속"],
    ["Not now","暂不接受","暫不接受","Nanti saja","今はしない","ไว้ภายหลัง","나중에"],
    ["Saving acceptance…","正在保存接受状态…","正在儲存接受狀態…","Menyimpan persetujuan…","同意を保存中…","กำลังบันทึกการยอมรับ…","동의 내역 저장 중…"],
    ["Could not save your acceptance. Please try again.","无法保存你的接受状态，请重试。","無法儲存你的接受狀態，請重試。","Tidak dapat menyimpan persetujuan. Coba lagi.","同意を保存できませんでした。もう一度お試しください。","ไม่สามารถบันทึกการยอมรับได้ โปรดลองอีกครั้ง","동의 내역을 저장할 수 없습니다. 다시 시도하세요."],
    ["Settings categories","设置分类","設定分類","Kategori pengaturan","設定カテゴリー","หมวดหมู่การตั้งค่า","설정 카테고리"],
    ["Settings content","设置内容","設定內容","Isi pengaturan","設定内容","เนื้อหาการตั้งค่า","설정 내용"],
    ["Appearance","外观","外觀","Tampilan","外観","รูปลักษณ์","모양"],
    ["Social","社交","社群","Sosial","ソーシャル","โซเชียล","소셜"],
    ["Language & data","语言与数据","語言與資料","Bahasa & data","言語とデータ","ภาษาและข้อมูล","언어 및 데이터"],
    ["Backup and restore","备份与恢复","備份與還原","Cadangkan dan pulihkan","バックアップと復元","สำรองและกู้คืนข้อมูล","백업 및 복원"],
    ["Export backup","导出备份","匯出備份","Ekspor cadangan","バックアップを書き出す","ส่งออกข้อมูลสำรอง","백업 내보내기"],
    ["Import backup","导入备份","匯入備份","Impor cadangan","バックアップを読み込む","นำเข้าข้อมูลสำรอง","백업 가져오기"],
    ["Reading backup...","正在读取备份…","正在讀取備份…","Membaca cadangan...","バックアップを読み取り中…","กำลังอ่านข้อมูลสำรอง…","백업 읽는 중…"],
    ["Review backup before importing","导入前检查备份","匯入前檢查備份","Tinjau cadangan sebelum mengimpor","読み込み前にバックアップを確認","ตรวจสอบข้อมูลสำรองก่อนนำเข้า","가져오기 전에 백업 확인"],
    ["Import and replace","导入并替换","匯入並取代","Impor dan ganti","読み込んで置き換える","นำเข้าและแทนที่","가져와서 교체"],
    ["Backups include extension appearance, language, Home and social settings, currency preference, pinned games and folders, hidden recommendations, and playtime for every recorded Roblox account. A saved background file or URL is included when present.","备份包含扩展外观、语言、主页和社交设置、货币偏好、置顶游戏与文件夹、隐藏的推荐内容，以及所有已记录 Roblox 账号的游玩时长。如果有保存的背景文件或网址，也会一并包含。","備份包含擴充功能外觀、語言、首頁和社群設定、貨幣偏好、釘選遊戲與資料夾、隱藏的推薦內容，以及所有已記錄 Roblox 帳號的遊玩時長。如有儲存的背景檔案或網址，也會一併包含。","Cadangan mencakup tampilan, bahasa, pengaturan Beranda dan sosial ekstensi, preferensi mata uang, game dan folder yang disematkan, rekomendasi tersembunyi, serta waktu bermain untuk setiap akun Roblox yang tercatat. File atau URL latar belakang yang tersimpan juga disertakan jika ada.","バックアップには、外観、言語、ホームとソーシャルの設定、通貨設定、ピン留めしたゲームとフォルダー、非表示にしたおすすめ、記録された全Robloxアカウントのプレイ時間が含まれます。保存した背景ファイルやURLがあれば、それも含まれます。","ข้อมูลสำรองรวมรูปลักษณ์ ภาษา การตั้งค่าหน้าหลักและโซเชียล สกุลเงิน เกมและโฟลเดอร์ที่ปักหมุด รายการแนะนำที่ซ่อน และเวลาเล่นของทุกบัญชี Roblox ที่มีการบันทึก รวมถึงไฟล์หรือ URL พื้นหลังที่บันทึกไว้ หากมี","백업에는 확장 프로그램의 모양, 언어, 홈 및 소셜 설정, 통화 설정, 고정한 게임과 폴더, 숨긴 추천 항목과 기록된 모든 Roblox 계정의 플레이 시간이 포함됩니다. 저장한 배경 파일이나 URL이 있으면 함께 포함됩니다."],
    ["Import replaces the backed-up settings, pinned games, folders, and playtime histories in this browser; it does not merge them. Playtime remains linked to its original Roblox account and does not become the current account's playtime. Roblox account data, Robux, purchases, and game progress are not included.","导入会替换此浏览器中对应的设置、置顶游戏、文件夹和游玩记录，不会合并。游玩时长仍属于原 Roblox 账号，不会变成当前账号的游玩时长。备份不包含 Roblox 账号数据、Robux、购买记录或游戏进度。","匯入會取代此瀏覽器中對應的設定、釘選遊戲、資料夾及遊玩紀錄，不會合併。遊玩時長仍屬於原 Roblox 帳號，不會變成目前帳號的遊玩時長。備份不包含 Roblox 帳號資料、Robux、購買紀錄或遊戲進度。","Impor mengganti pengaturan, game yang disematkan, folder, dan riwayat waktu bermain yang dicadangkan di browser ini; data tidak digabungkan. Waktu bermain tetap terkait dengan akun Roblox asalnya dan tidak menjadi waktu bermain akun saat ini. Data akun Roblox, Robux, pembelian, dan progres game tidak disertakan.","読み込むと、このブラウザーの該当する設定、ピン留めしたゲーム、フォルダー、プレイ履歴が置き換わります。統合はされません。プレイ時間は元のRobloxアカウントに紐づいたままで、現在のアカウントの時間にはなりません。Robloxのアカウントデータ、Robux、購入履歴、ゲームの進行状況は含まれません。","การนำเข้าจะแทนที่การตั้งค่า เกมที่ปักหมุด โฟลเดอร์ และประวัติการเล่นที่เกี่ยวข้องในเบราว์เซอร์นี้ โดยไม่รวมข้อมูลเข้าด้วยกัน เวลาเล่นยังผูกกับบัญชี Roblox เดิม ไม่กลายเป็นเวลาเล่นของบัญชีปัจจุบัน ข้อมูลบัญชี Roblox, Robux, การซื้อ และความคืบหน้าในเกมไม่รวมอยู่ด้วย","가져오기는 이 브라우저에 저장된 해당 설정, 고정 게임, 폴더, 플레이 기록을 교체하며 병합하지 않습니다. 플레이 시간은 원래 Roblox 계정에 연결된 상태로 유지되며 현재 계정의 기록으로 바뀌지 않습니다. Roblox 계정 데이터, Robux, 구매 내역, 게임 진행 상황은 포함되지 않습니다."],
    ["This backup contains your extension appearance, Home and social settings, currency preference, pinned games and folders, and playtime histories.","此备份包含扩展外观、主页和社交设置、货币偏好、置顶游戏与文件夹以及游玩记录。","此備份包含擴充功能外觀、首頁和社群設定、貨幣偏好、釘選遊戲與資料夾及遊玩紀錄。","Cadangan ini berisi tampilan ekstensi, pengaturan Beranda dan sosial, preferensi mata uang, game dan folder yang disematkan, serta riwayat waktu bermain.","このバックアップには、拡張機能の外観、ホームとソーシャルの設定、通貨設定、ピン留めしたゲームとフォルダー、プレイ履歴が含まれます。","ข้อมูลสำรองนี้รวมรูปลักษณ์ของส่วนขยาย การตั้งค่าหน้าหลักและโซเชียล สกุลเงิน เกมและโฟลเดอร์ที่ปักหมุด และประวัติการเล่น","이 백업에는 확장 프로그램의 모양, 홈 및 소셜 설정, 통화 설정, 고정한 게임과 폴더, 플레이 기록이 포함되어 있습니다."],
    ["This file has {games} pinned games, {folders} folders, and {records} playtime records across {accounts} Roblox accounts.","此文件包含 {games} 个置顶游戏、{folders} 个文件夹，以及分属 {accounts} 个 Roblox 账号的 {records} 条游玩记录。","此檔案包含 {games} 個釘選遊戲、{folders} 個資料夾，以及分屬 {accounts} 個 Roblox 帳號的 {records} 筆遊玩紀錄。","File ini berisi {games} game yang disematkan, {folders} folder, dan {records} catatan waktu bermain dari {accounts} akun Roblox.","このファイルには、ピン留めしたゲーム{games}件、フォルダー{folders}個、Robloxアカウント{accounts}件に属するプレイ記録{records}件が含まれています。","ไฟล์นี้มีเกมที่ปักหมุด {games} เกม โฟลเดอร์ {folders} โฟลเดอร์ และบันทึกเวลาเล่น {records} รายการจากบัญชี Roblox {accounts} บัญชี","이 파일에는 고정 게임 {games}개, 폴더 {folders}개와 Roblox 계정 {accounts}개의 플레이 기록 {records}개가 있습니다."],
    ["An uploaded background image or video is included.","包含上传的背景图片或视频。","包含上傳的背景圖片或影片。","Gambar atau video latar belakang yang diunggah disertakan.","アップロードした背景画像または動画が含まれています。","มีภาพหรือวิดีโอพื้นหลังที่อัปโหลดรวมอยู่ด้วย","업로드한 배경 이미지 또는 동영상이 포함되어 있습니다."],
    ["A saved background URL is included; no uploaded file is included.","包含保存的背景网址，但不包含上传的文件。","包含儲存的背景網址，但不包含上傳的檔案。","URL latar belakang yang tersimpan disertakan; file yang diunggah tidak disertakan.","保存した背景URLが含まれています。アップロードしたファイルは含まれません。","มี URL พื้นหลังที่บันทึกไว้ แต่ไม่มีไฟล์ที่อัปโหลด","저장한 배경 URL이 포함되어 있으며 업로드한 파일은 없습니다."],
    ["No uploaded background file is included.","不包含上传的背景文件。","不包含上傳的背景檔案。","Tidak ada file latar belakang yang diunggah dalam cadangan.","アップロードした背景ファイルは含まれていません。","ไม่มีไฟล์พื้นหลังที่อัปโหลดรวมอยู่ด้วย","업로드한 배경 파일이 포함되어 있지 않습니다."],
    ["Playtime stays with the original Roblox accounts listed below. If you sign in to a different account, this history will not appear as that account's Home playtime after the next account check; the records remain stored.","游玩记录仍属于下列原 Roblox 账号。如果登录其他账号，下次检查账号后，这些记录不会显示为该账号的主页游玩时长；记录本身仍会保留。","遊玩紀錄仍屬於下列原 Roblox 帳號。如果登入其他帳號，下次檢查帳號後，這些紀錄不會顯示為該帳號的首頁遊玩時長；紀錄本身仍會保留。","Waktu bermain tetap terkait dengan akun Roblox asal yang tercantum di bawah. Jika Anda masuk dengan akun lain, riwayat ini tidak akan muncul sebagai waktu bermain akun tersebut di Beranda setelah pemeriksaan akun berikutnya; catatannya tetap disimpan.","プレイ時間は以下の元のRobloxアカウントに紐づいたままです。別のアカウントでログインすると、次回のアカウント確認後、そのアカウントのホームにこの時間は表示されません。記録自体は保存されたままです。","เวลาเล่นยังผูกกับบัญชี Roblox เดิมตามรายการด้านล่าง หากคุณเข้าสู่ระบบด้วยบัญชีอื่น หลังการตรวจสอบบัญชีครั้งถัดไป ประวัตินี้จะไม่แสดงเป็นเวลาเล่นของบัญชีนั้นบนหน้าหลัก แต่ข้อมูลยังคงบันทึกอยู่","플레이 시간은 아래에 나열된 원래 Roblox 계정에 연결됩니다. 다른 계정으로 로그인하면 다음 계정 확인 후 이 기록이 해당 계정의 홈 플레이 시간으로 표시되지 않습니다. 기록 자체는 저장된 상태로 유지됩니다."],
    ["No playtime history is included.","不包含游玩记录。","不包含遊玩紀錄。","Riwayat waktu bermain tidak disertakan.","プレイ履歴は含まれていません。","ไม่มีประวัติการเล่นรวมอยู่ด้วย","플레이 기록이 포함되어 있지 않습니다."],
    ["Unknown account","未知账号","未知帳號","Akun tidak dikenal","不明なアカウント","บัญชีที่ไม่ทราบชื่อ","알 수 없는 계정"],
    ["And {count} more accounts.","还有 {count} 个账号。","還有 {count} 個帳號。","Dan {count} akun lainnya.","ほか{count}件のアカウント。","และอีก {count} บัญชี","외 계정 {count}개"],
    ["Roblox account data, Robux, purchases, and game progress cannot be imported.","无法导入 Roblox 账号数据、Robux、购买记录或游戏进度。","無法匯入 Roblox 帳號資料、Robux、購買紀錄或遊戲進度。","Data akun Roblox, Robux, pembelian, dan progres game tidak dapat diimpor.","Robloxのアカウントデータ、Robux、購入履歴、ゲームの進行状況は読み込めません。","ไม่สามารถนำเข้าข้อมูลบัญชี Roblox, Robux, การซื้อ หรือความคืบหน้าในเกมได้","Roblox 계정 데이터, Robux, 구매 내역, 게임 진행 상황은 가져올 수 없습니다."],
    ["Live playtime samples and exchange-rate or social-feed caches are not imported.","不会导入正在进行的游玩计时、汇率缓存或社交动态缓存。","不會匯入正在進行的遊玩計時、匯率快取或社群動態快取。","Sampel waktu bermain yang sedang berjalan serta cache kurs atau feed sosial tidak diimpor.","進行中のプレイ時間サンプルや、為替レート、ソーシャルフィードのキャッシュは読み込みません。","จะไม่นำเข้าตัวอย่างเวลาเล่นที่กำลังบันทึก หรือแคชอัตราแลกเปลี่ยนและฟีดโซเชียล","실시간 플레이 시간 샘플과 환율 및 소셜 피드 캐시는 가져오지 않습니다."],
    ["Import replaces saved extension settings, pinned games, folders, and playtime histories in this browser; it does not merge them. Export your current data first if you may want to restore it.","导入会替换此浏览器中保存的扩展设置、置顶游戏、文件夹和游玩记录，不会合并。如需日后恢复，请先导出当前数据。","匯入會取代此瀏覽器中儲存的擴充功能設定、釘選遊戲、資料夾及遊玩紀錄，不會合併。如需日後還原，請先匯出目前資料。","Impor mengganti pengaturan ekstensi, game yang disematkan, folder, dan riwayat waktu bermain yang tersimpan di browser ini; data tidak digabungkan. Ekspor data saat ini terlebih dahulu jika Anda ingin memulihkannya nanti.","読み込むと、このブラウザーに保存された設定、ピン留めしたゲーム、フォルダー、プレイ履歴が置き換わります。統合はされません。後で元に戻す可能性がある場合は、先に現在のデータを書き出してください。","การนำเข้าจะแทนที่การตั้งค่าส่วนขยาย เกมที่ปักหมุด โฟลเดอร์ และประวัติการเล่นในเบราว์เซอร์นี้ โดยไม่รวมข้อมูลเข้าด้วยกัน หากอาจต้องการย้อนกลับ โปรดส่งออกข้อมูลปัจจุบันก่อน","가져오기는 이 브라우저에 저장된 확장 프로그램 설정, 고정 게임, 폴더, 플레이 기록을 교체하며 병합하지 않습니다. 나중에 복원할 수 있도록 현재 데이터를 먼저 내보내세요."],
    ["Only Roblox Customizer JSON backups up to 256 MB can be imported. Live playtime samples and exchange-rate or social-feed caches are not included.","仅支持不超过 256 MB 的 Roblox Customizer JSON 备份。不包含正在进行的游玩计时、汇率缓存或社交动态缓存。","僅支援不超過 256 MB 的 Roblox Customizer JSON 備份。不包含正在進行的遊玩計時、匯率快取或社群動態快取。","Hanya cadangan JSON Roblox Customizer hingga 256 MB yang dapat diimpor. Sampel waktu bermain yang sedang berjalan serta cache kurs atau feed sosial tidak disertakan.","256 MB以下のRoblox CustomizerのJSONバックアップのみ読み込めます。進行中のプレイ時間サンプルや為替レート、ソーシャルフィードのキャッシュは含まれません。","นำเข้าได้เฉพาะข้อมูลสำรอง JSON ของ Roblox Customizer ขนาดไม่เกิน 256 MB ไม่รวมตัวอย่างเวลาเล่นที่กำลังบันทึกหรือแคชอัตราแลกเปลี่ยนและฟีดโซเชียล","256 MB 이하의 Roblox Customizer JSON 백업만 가져올 수 있습니다. 실시간 플레이 시간 샘플과 환율 및 소셜 피드 캐시는 포함되지 않습니다."],
    ["Reset All","重置全部","重設全部","Reset semua","すべてリセット","รีเซ็ตทั้งหมด","모두 초기화"],
    ["Reset all extension data?","重置所有扩展数据？","重設所有擴充功能資料？","Reset semua data ekstensi?","拡張機能のデータをすべてリセットしますか？","รีเซ็ตข้อมูลส่วนขยายทั้งหมดหรือไม่?","확장 프로그램의 모든 데이터를 초기화할까요?"],
    ["This permanently deletes all settings, uploaded backgrounds, pinned games and folders, and playtime history for every account in this browser. This cannot be undone.","这将永久删除此浏览器中所有账号的设置、上传的背景、置顶游戏和文件夹以及游玩记录。此操作无法撤销。","這將永久刪除此瀏覽器中所有帳號的設定、上傳的背景、釘選遊戲和資料夾，以及遊玩紀錄。此操作無法復原。","Tindakan ini menghapus secara permanen semua pengaturan, latar belakang yang diunggah, game dan folder yang disematkan, serta riwayat waktu bermain untuk setiap akun di browser ini. Tindakan ini tidak dapat dibatalkan.","このブラウザー内の全アカウントについて、設定、アップロードした背景、ピン留めしたゲームとフォルダー、プレイ履歴を完全に削除します。この操作は取り消せません。","การดำเนินการนี้จะลบการตั้งค่า พื้นหลังที่อัปโหลด เกมและโฟลเดอร์ที่ปักหมุด และประวัติการเล่นของทุกบัญชีในเบราว์เซอร์นี้อย่างถาวร ไม่สามารถยกเลิกได้","이 브라우저에 있는 모든 계정의 설정, 업로드한 배경, 고정 게임과 폴더, 플레이 기록을 영구 삭제합니다. 이 작업은 취소할 수 없습니다."],
    ["Resetting all data...","正在重置所有数据…","正在重設所有資料…","Mereset semua data...","すべてのデータをリセット中…","กำลังรีเซ็ตข้อมูลทั้งหมด…","모든 데이터 초기화 중…"],
    ["Reset could not finish. Check your saved data before trying again.","重置未能完成。请检查已保存的数据后再试。","重設未能完成。請檢查已儲存的資料後再試。","Reset belum selesai. Periksa data yang tersimpan sebelum mencoba lagi.","リセットを完了できませんでした。保存データを確認してから再試行してください。","รีเซ็ตไม่สำเร็จ โปรดตรวจสอบข้อมูลที่บันทึกไว้ก่อนลองอีกครั้ง","초기화를 완료하지 못했습니다. 다시 시도하기 전에 저장된 데이터를 확인하세요."],
    ["Preparing backup...","正在准备备份…","正在準備備份…","Menyiapkan cadangan...","バックアップを準備中…","กำลังเตรียมข้อมูลสำรอง…","백업 준비 중…"],
    ["Importing backup...","正在导入备份…","正在匯入備份…","Mengimpor cadangan...","バックアップを読み込み中…","กำลังนำเข้าข้อมูลสำรอง…","백업 가져오는 중…"],
    ["Backup exported.","备份已导出。","備份已匯出。","Cadangan diekspor.","バックアップを書き出しました。","ส่งออกข้อมูลสำรองแล้ว","백업을 내보냈습니다."],
    ["Backup imported.","备份已导入。","備份已匯入。","Cadangan diimpor.","バックアップを読み込みました。","นำเข้าข้อมูลสำรองแล้ว","백업을 가져왔습니다."],
    ["Invalid backup file. No data was imported.","备份文件无效，未导入任何数据。","備份檔案無效，未匯入任何資料。","File cadangan tidak valid. Tidak ada data yang diimpor.","バックアップファイルが無効です。データは読み込まれていません。","ไฟล์สำรองไม่ถูกต้อง ไม่มีการนำเข้าข้อมูล","올바른 백업 파일이 아닙니다. 데이터를 가져오지 않았습니다."],
    ["This backup version is not supported. No data was imported.","不支持此备份版本，未导入任何数据。","不支援此備份版本，未匯入任何資料。","Versi cadangan ini tidak didukung. Tidak ada data yang diimpor.","このバックアップのバージョンには対応していません。データは読み込まれていません。","ไม่รองรับข้อมูลสำรองเวอร์ชันนี้ ไม่มีการนำเข้าข้อมูล","지원하지 않는 백업 버전입니다. 데이터를 가져오지 않았습니다."],
    ["Your saved background file is unavailable. Choose it again before exporting.","无法读取已保存的背景文件，请重新选择后再导出。","無法讀取已儲存的背景檔案，請重新選擇後再匯出。","File latar belakang yang tersimpan tidak tersedia. Pilih lagi sebelum mengekspor.","保存した背景ファイルが見つかりません。書き出す前にもう一度選んでください。","ไม่พบไฟล์พื้นหลังที่บันทึกไว้ โปรดเลือกอีกครั้งก่อนส่งออก","저장한 배경 파일을 사용할 수 없습니다. 내보내기 전에 다시 선택하세요."],
    ["Backup files must be smaller than 256 MB.","备份文件须小于 256 MB。","備份檔案須小於 256 MB。","File cadangan harus lebih kecil dari 256 MB.","バックアップファイルは256 MB未満にしてください。","ไฟล์สำรองต้องมีขนาดเล็กกว่า 256 MB","백업 파일은 256 MB보다 작아야 합니다."],
    ["Could not access backup data.","无法读取备份数据。","無法讀取備份資料。","Tidak dapat mengakses data cadangan.","バックアップデータにアクセスできませんでした。","ไม่สามารถเข้าถึงข้อมูลสำรองได้","백업 데이터에 접근할 수 없습니다."],
    ["Could not export backup.","无法导出备份。","無法匯出備份。","Tidak dapat mengekspor cadangan.","バックアップを書き出せませんでした。","ไม่สามารถส่งออกข้อมูลสำรองได้","백업을 내보낼 수 없습니다."],
    ["Could not import backup. Your existing data was kept.","无法导入备份，原有数据已保留。","無法匯入備份，原有資料已保留。","Tidak dapat mengimpor cadangan. Data yang ada tetap disimpan.","バックアップを読み込めませんでした。既存のデータは保持されています。","ไม่สามารถนำเข้าข้อมูลสำรองได้ ข้อมูลเดิมของคุณยังคงอยู่","백업을 가져올 수 없습니다. 기존 데이터는 유지되었습니다."],
    ["Playtime tracking","游戏时长记录","遊戲時長記錄","Pencatatan waktu bermain","プレイ時間の記録","การบันทึกเวลาเล่น","플레이 시간 기록"],
    ["Hidden game status may prevent tracking. Past sessions, long connection gaps, and time while your browser is closed cannot be recovered.","隐藏游戏状态可能导致无法记录。过去的游玩、长时间连接中断及浏览器关闭期间的时长无法补回。","隱藏遊戲狀態可能導致無法記錄。過去的遊玩、長時間連線中斷及瀏覽器關閉期間的時長無法補回。","Status game yang disembunyikan dapat menghalangi pencatatan. Sesi sebelumnya, jeda koneksi yang panjang, dan waktu saat browser ditutup tidak dapat dipulihkan.","プレイ中のゲームを非公開にしていると記録できない場合があります。過去のプレイ、長時間の接続切れ、ブラウザーを閉じていた間の時間は復元できません。","การซ่อนสถานะเกมอาจทำให้บันทึกเวลาไม่ได้ ไม่สามารถกู้คืนเวลาเล่นในอดีต ช่วงขาดการเชื่อมต่อนาน หรือเวลาที่ปิดเบราว์เซอร์ได้","게임 상태를 숨기면 기록하지 못할 수 있습니다. 이전 세션, 긴 연결 공백, 브라우저가 닫혀 있던 시간은 복구할 수 없습니다."],
    ["Enable playtime tracking","启用游戏时长记录","啟用遊戲時長記錄","Aktifkan pencatatan waktu bermain","プレイ時間の記録を有効にする","เปิดใช้การบันทึกเวลาเล่น","플레이 시간 기록 사용"],
    ["Estimates playtime from Roblox presence while your browser is running. Stored only on this computer, separately for each account.","在浏览器运行时，根据 Roblox 在线状态估算游戏时长。记录仅保存在此电脑上，各账号分别存储。","在瀏覽器執行時，根據 Roblox 上線狀態估算遊戲時長。記錄僅儲存在此電腦上，各帳號分別儲存。","Memperkirakan waktu bermain dari status Roblox selama browser berjalan. Disimpan hanya di komputer ini, terpisah untuk setiap akun.","ブラウザーの実行中にRobloxのステータスからプレイ時間を推定します。アカウントごとに、この端末内のみに保存されます。","ประมาณเวลาเล่นจากสถานะ Roblox ขณะที่เบราว์เซอร์ทำงาน เก็บไว้ในคอมพิวเตอร์เครื่องนี้เท่านั้น โดยแยกตามบัญชี","브라우저가 실행되는 동안 Roblox 접속 상태를 바탕으로 플레이 시간을 추정합니다. 이 컴퓨터에만 계정별로 저장됩니다."],
    ["View playtime history","查看游戏时长记录","查看遊戲時長記錄","Lihat riwayat waktu bermain","プレイ履歴を見る","ดูประวัติการเล่น","플레이 기록 보기"],
    ["Your playtime","您的游戏时长","您的遊戲時長","Waktu bermain Anda","あなたのプレイ時間","เวลาเล่นของคุณ","내 플레이 시간"],
    ["Total playtime","累计游玩时长","累計遊玩時長","Total waktu bermain","合計プレイ時間","เวลาเล่นรวม","총 플레이 시간"],
    ["Not recorded yet","暂无记录","暫無記錄","Belum tercatat","記録はまだありません","ยังไม่มีบันทึก","아직 기록 없음"],
    ["Local estimate for this game.","此游戏在本机记录的估算时长。","此遊戲在本機記錄的估算時長。","Perkiraan lokal untuk game ini.","このゲームのローカル推定値です。","ค่าประมาณในเครื่องสำหรับเกมนี้","이 게임의 로컬 추정 기록입니다."],
    ["Enable playtime tracking to start recording this game.","启用游戏时长记录后，即可开始记录此游戏。","啟用遊戲時長記錄後，即可開始記錄此遊戲。","Aktifkan pencatatan waktu bermain untuk mulai mencatat game ini.","このゲームを記録するにはプレイ時間の記録を有効にしてください。","เปิดใช้การบันทึกเวลาเล่นเพื่อเริ่มบันทึกเกมนี้","이 게임의 시간을 기록하려면 플레이 시간 기록을 켜세요."],
    ["Your most played","您最常玩的游戏","您最常玩的遊戲","Paling sering Anda mainkan","よく遊ぶゲーム","เกมที่คุณเล่นบ่อย","가장 많이 플레이한 게임"],
    ["Previous games","上一组游戏","上一組遊戲","Game sebelumnya","前のゲーム","เกมก่อนหน้า","이전 게임"],
    ["Next games","下一组游戏","下一組遊戲","Game berikutnya","次のゲーム","เกมถัดไป","다음 게임"],
    ["View history","查看记录","查看記錄","Lihat riwayat","履歴を見る","ดูประวัติ","기록 보기"],
    ["Playtime history","游戏时长记录","遊戲時長記錄","Riwayat waktu bermain","プレイ履歴","ประวัติการเล่น","플레이 기록"],
    ["View all","查看全部","查看全部","Lihat semua","すべて表示","ดูทั้งหมด","모두 보기"],
    ["Playing now","正在游玩","正在遊玩","Sedang bermain","プレイ中","กำลังเล่น","플레이 중"],
    ["Tracking is paused. Saved totals are kept.","记录已暂停，已保存的累计时长会保留。","記錄已暫停，已儲存的累計時長會保留。","Pencatatan dijeda. Total yang tersimpan tetap disimpan.","記録を一時停止しています。保存済みの合計時間は残ります。","พักการบันทึกไว้ ยอดเวลาที่บันทึกแล้วยังคงอยู่","기록이 일시 중지되었습니다. 저장된 합계는 유지됩니다."],
    ["Waiting for Roblox status.","正在等待 Roblox 状态。","正在等待 Roblox 狀態。","Menunggu status Roblox.","Robloxのステータスを待機中です。","กำลังรอสถานะ Roblox","Roblox 상태를 기다리는 중입니다."],
    ["No game detected. Waiting for your next session.","尚未检测到游戏，等待您下次游玩。","尚未偵測到遊戲，等待您下次遊玩。","Tidak ada game terdeteksi. Menunggu sesi berikutnya.","ゲームが検出されていません。次のプレイを待機中です。","ไม่พบเกมที่กำลังเล่น กำลังรอการเล่นครั้งถัดไป","플레이 중인 게임이 없습니다. 다음 세션을 기다리는 중입니다."],
    ["Sign in to Roblox to track playtime.","请登录 Roblox 以记录游戏时长。","請登入 Roblox 以記錄遊戲時長。","Masuk ke Roblox untuk mencatat waktu bermain.","プレイ時間を記録するにはRobloxにログインしてください。","เข้าสู่ระบบ Roblox เพื่อบันทึกเวลาเล่น","플레이 시간을 기록하려면 Roblox에 로그인하세요."],
    ["Roblox status is unavailable. Timing is paused until it returns.","无法获取 Roblox 状态，恢复后将继续记录。","無法取得 Roblox 狀態，恢復後將繼續記錄。","Status Roblox tidak tersedia. Penghitungan dijeda hingga status kembali tersedia.","Robloxのステータスを取得できません。取得できるまで計測を一時停止します。","ไม่สามารถรับสถานะ Roblox ได้ พักการจับเวลาจนกว่าจะใช้งานได้อีกครั้ง","Roblox 상태를 확인할 수 없습니다. 다시 확인할 수 있을 때까지 기록을 일시 중지합니다."],
    ["Could not update playtime. Please try again.","无法更新游戏时长，请重试。","無法更新遊戲時長，請重試。","Tidak dapat memperbarui waktu bermain. Coba lagi.","プレイ時間を更新できませんでした。もう一度お試しください。","ไม่สามารถอัปเดตเวลาเล่นได้ โปรดลองอีกครั้ง","플레이 시간을 업데이트할 수 없습니다. 다시 시도하세요."],
    ["Saved for {name}","{name} 的本地记录","{name} 的本機記錄","Disimpan untuk {name}","{name}の記録","บันทึกสำหรับ {name}","{name} 계정에 저장됨"],
    ["{hours}h {minutes}m","{hours}小时 {minutes}分钟","{hours}小時 {minutes}分鐘","{hours}j {minutes}m","{hours}時間{minutes}分","{hours} ชม. {minutes} นาที","{hours}시간 {minutes}분"],
    ["{minutes}m","{minutes}分钟","{minutes}分鐘","{minutes}m","{minutes}分","{minutes} นาที","{minutes}분"],
    ["{seconds}s","{seconds}秒","{seconds}秒","{seconds}d","{seconds}秒","{seconds} วินาที","{seconds}초"],
    ["{minutes}m {seconds}s","{minutes}分{seconds}秒","{minutes}分{seconds}秒","{minutes}m {seconds}d","{minutes}分{seconds}秒","{minutes} นาที {seconds} วินาที","{minutes}분 {seconds}초"],
    ["{hours}h {minutes}m {seconds}s","{hours}时{minutes}分{seconds}秒","{hours}時{minutes}分{seconds}秒","{hours}j {minutes}m {seconds}d","{hours}時間{minutes}分{seconds}秒","{hours} ชม. {minutes} นาที {seconds} วินาที","{hours}시간 {minutes}분 {seconds}초"],
    ["{count} sessions","{count}次游玩","{count}次遊玩","{count} sesi","{count}回のプレイ","เล่น {count} ครั้ง","세션 {count}회"],
    ["Last played","上次游玩","上次遊玩","Terakhir dimainkan","最終プレイ","เล่นล่าสุด","마지막 플레이"],
    ["No playtime recorded yet. Join a game with tracking enabled to start.","暂无时长记录。启用记录后，加入游戏即可开始。","暫無時長記錄。啟用記錄後，加入遊戲即可開始。","Belum ada waktu bermain tercatat. Gabung ke game saat pencatatan aktif untuk memulai.","プレイ時間の記録はまだありません。記録を有効にしてゲームに参加してください。","ยังไม่มีบันทึกเวลาเล่น เข้าร่วมเกมขณะที่เปิดใช้การบันทึกเพื่อเริ่มต้น","아직 플레이 기록이 없습니다. 기록을 켜고 게임에 참가하여 시작하세요."],
    ["Search games","搜索游戏","搜尋遊戲","Cari game","ゲームを検索","ค้นหาเกม","게임 검색"],
    ["Sort playtime","时长排序","時長排序","Urutkan waktu bermain","プレイ時間の並び順","จัดเรียงเวลาเล่น","플레이 시간 정렬"],
    ["Most time played","游玩时长最多","遊玩時長最多","Waktu bermain terbanyak","プレイ時間が長い順","เวลาเล่นมากที่สุด","플레이 시간순"],
    ["Recently played","最近游玩","最近遊玩","Baru dimainkan","最近プレイした順","เล่นล่าสุด","최근 플레이순"],
    ["No matching games.","没有匹配的游戏。","沒有相符的遊戲。","Tidak ada game yang cocok.","一致するゲームはありません。","ไม่พบเกมที่ตรงกัน","일치하는 게임이 없습니다."],
    ["Export JSON","导出 JSON","匯出 JSON","Ekspor JSON","JSONを書き出す","ส่งออก JSON","JSON 내보내기"],
    ["Clear this account","清除此账号的记录","清除此帳號的記錄","Kosongkan akun ini","このアカウントの記録を消去","ล้างบันทึกของบัญชีนี้","이 계정 기록 지우기"],
    ["Delete saved playtime","删除已保存的游戏时长","刪除已儲存的遊戲時長","Hapus waktu bermain tersimpan","保存したプレイ時間を削除","ลบเวลาเล่นที่บันทึกไว้","저장된 플레이 시간 삭제"],
    ["Delete all saved playtime for this account? This cannot be undone.","删除此账号的全部本地游戏时长？此操作无法撤销。","刪除此帳號的全部本機遊戲時長？此操作無法復原。","Hapus semua waktu bermain yang tersimpan untuk akun ini? Tindakan ini tidak dapat dibatalkan.","このアカウントのプレイ時間をすべて削除しますか？この操作は取り消せません。","ลบเวลาเล่นทั้งหมดของบัญชีนี้หรือไม่? ไม่สามารถยกเลิกได้","이 계정의 저장된 플레이 시간을 모두 삭제할까요? 이 작업은 취소할 수 없습니다."],
    ["Roblox Customizer","Roblox 自定义工具","Roblox 自訂工具","Roblox Customizer","Roblox Customizer","Roblox Customizer","Roblox Customizer"],
    ["Extension language","扩展语言","擴充功能語言","Bahasa ekstensi","拡張機能の言語","ภาษาของส่วนขยาย","확장 프로그램 언어"],
    ["Unsupported Roblox language","不支持的 Roblox 语言","不支援的 Roblox 語言","Bahasa Roblox tidak didukung","未対応のRoblox言語","ภาษา Roblox ที่ยังไม่รองรับ","지원하지 않는 Roblox 언어"],
    ["Your Roblox language ({language}) is not supported by Roblox Customizer. Some features may not work correctly.","Roblox 自定义工具不支持您当前的 Roblox 语言（{language}），部分功能可能无法正常使用。","Roblox 自訂工具不支援您目前的 Roblox 語言（{language}），部分功能可能無法正常使用。","Bahasa Roblox Anda ({language}) tidak didukung oleh Roblox Customizer. Beberapa fitur mungkin tidak berfungsi dengan benar.","Roblox Customizerは現在のRobloxの言語（{language}）に対応していません。一部の機能が正しく動作しない可能性があります。","Roblox Customizer ยังไม่รองรับภาษา Roblox ของคุณ ({language}) บางฟังก์ชันอาจทำงานไม่ถูกต้อง","Roblox 언어({language})는 Roblox Customizer에서 지원하지 않습니다. 일부 기능이 제대로 작동하지 않을 수 있습니다."],
    ["For the best experience, switch Roblox's language to English, Simplified Chinese, Traditional Chinese, Indonesian, Japanese, Thai, or Korean.","为获得最佳体验，请将 Roblox 语言切换为英语、简体中文、繁体中文、印尼语、日语、泰语或韩语。","為獲得最佳體驗，請將 Roblox 語言切換為英語、簡體中文、繁體中文、印尼語、日語、泰語或韓語。","Untuk pengalaman terbaik, ubah bahasa Roblox ke bahasa Inggris, Mandarin Sederhana, Mandarin Tradisional, Bahasa Indonesia, bahasa Jepang, bahasa Thai, atau bahasa Korea.","快適に使用するには、Robloxの言語を英語、簡体字中国語、繁体字中国語、インドネシア語、日本語、タイ語、韓国語のいずれかに変更してください。","เพื่อประสบการณ์ที่ดีที่สุด ให้เปลี่ยนภาษา Roblox เป็นอังกฤษ จีนตัวย่อ จีนตัวเต็ม อินโดนีเซีย ญี่ปุ่น ไทย หรือเกาหลี","모든 기능을 사용하려면 Roblox 언어를 영어, 중국어 간체, 중국어 번체, 인도네시아어, 일본어, 태국어 또는 한국어로 변경하세요."],
    ["Open Roblox language settings","打开 Roblox 语言设置","開啟 Roblox 語言設定","Buka pengaturan bahasa Roblox","Robloxの言語設定を開く","เปิดการตั้งค่าภาษา Roblox","Roblox 언어 설정 열기"],
    ["Continue anyway","仍然继续","仍然繼續","Tetap lanjutkan","そのまま続ける","ดำเนินการต่ออยู่ดี","계속 진행"],
    ["Continue with fallback","继续使用兼容模式","繼續使用相容模式","Lanjutkan dalam mode terbatas","制限モードで続ける","ดำเนินการต่อในโหมดจำกัด","제한 모드로 계속"],
    ["Your Roblox language ({language}) is not supported. Only image backgrounds, custom colors, and custom fonts remain active; all other features are disabled to preserve the Roblox interface.","不支持您当前的 Roblox 语言（{language}）。仅保留图片背景、自定义颜色和自定义字体，其他功能已停用，以保持 Roblox 原有界面。","不支援您目前的 Roblox 語言（{language}）。僅保留圖片背景、自訂色彩和自訂字體，其他功能已停用，以維持 Roblox 原有介面。","Bahasa Roblox Anda ({language}) tidak didukung. Hanya latar belakang gambar, warna kustom, dan font kustom yang tetap aktif; semua fitur lainnya dinonaktifkan untuk mempertahankan antarmuka Roblox.","現在のRobloxの言語（{language}）には対応していません。Robloxの画面を維持するため、画像背景、カスタムカラー、カスタムフォントのみ有効にし、その他の機能は無効にします。","ยังไม่รองรับภาษา Roblox ของคุณ ({language}) จะเปิดใช้เฉพาะพื้นหลังภาพ สีและแบบอักษรที่กำหนดเอง ส่วนฟังก์ชันอื่นจะปิดไว้เพื่อรักษาหน้าตาเดิมของ Roblox","Roblox 언어({language})는 지원하지 않습니다. 이미지 배경, 사용자 지정 색상 및 글꼴만 활성화되며, Roblox 인터페이스를 유지하기 위해 다른 기능은 비활성화됩니다."],
    ["Your Roblox language is not supported yet","当前 Roblox 语言暂未支持","目前的 Roblox 語言暫未支援","Bahasa Roblox Anda belum didukung","現在のRobloxの言語は未対応です","ภาษา Roblox ของคุณยังไม่รองรับ","아직 지원하지 않는 Roblox 언어입니다"],
    ["Only image backgrounds, custom colors, and custom fonts are available. All other features are disabled.","目前仅可使用图片背景、自定义颜色和自定义字体，其他功能已停用。","目前僅可使用圖片背景、自訂色彩和自訂字體，其他功能已停用。","Hanya latar belakang gambar, warna kustom, dan font kustom yang tersedia. Semua fitur lainnya dinonaktifkan.","画像背景、カスタムカラー、カスタムフォントのみ利用できます。その他の機能は無効です。","ใช้ได้เฉพาะพื้นหลังภาพ สีและแบบอักษรที่กำหนดเอง ฟังก์ชันอื่นทั้งหมดถูกปิดไว้","이미지 배경, 사용자 지정 색상 및 글꼴만 사용할 수 있습니다. 다른 기능은 모두 비활성화됩니다."],
    ["To use all features, switch Roblox's language to English, Simplified Chinese, Traditional Chinese, Indonesian, Japanese, Thai, or Korean.","如需使用全部功能，请将 Roblox 语言切换为英语、简体中文、繁体中文、印尼语、日语、泰语或韩语。","如需使用全部功能，請將 Roblox 語言切換為英語、簡體中文、繁體中文、印尼語、日語、泰語或韓語。","Untuk menggunakan semua fitur, ubah bahasa Roblox ke bahasa Inggris, Mandarin Sederhana, Mandarin Tradisional, Bahasa Indonesia, bahasa Jepang, bahasa Thai, atau bahasa Korea.","すべての機能を使うには、Robloxの言語を英語、簡体字中国語、繁体字中国語、インドネシア語、日本語、タイ語、韓国語のいずれかに変更してください。","หากต้องการใช้ทุกฟังก์ชัน ให้เปลี่ยนภาษา Roblox เป็นอังกฤษ จีนตัวย่อ จีนตัวเต็ม อินโดนีเซีย ญี่ปุ่น ไทย หรือเกาหลี","모든 기능을 사용하려면 Roblox 언어를 영어, 중국어 간체, 중국어 번체, 인도네시아어, 일본어, 태국어 또는 한국어로 변경하세요."],
    ["Choose an image or GIF file.","请选择图片或 GIF 文件。","請選擇圖片或 GIF 檔案。","Pilih file gambar atau GIF.","画像またはGIFファイルを選んでください。","เลือกไฟล์ภาพหรือ GIF","이미지 또는 GIF 파일을 선택하세요."],
    ["Automatic (Roblox / browser)","自动（Roblox / 浏览器）","自動（Roblox / 瀏覽器）","Otomatis (Roblox / browser)","自動（Roblox／ブラウザー）","อัตโนมัติ (Roblox / เบราว์เซอร์)","자동(Roblox / 브라우저)"],
    ["Changes save automatically. Sliders and colors apply when released or after a short pause. GIFs and MP4 videos stay animated.","更改会自动保存。滑块和颜色会在松开或短暂停顿后生效。GIF 和 MP4 视频会保持动态播放。","變更會自動儲存。滑桿和顏色會在放開或短暫停頓後生效。GIF 和 MP4 影片會保持動態播放。","Perubahan disimpan otomatis. Penggeser dan warna diterapkan setelah dilepas atau setelah jeda singkat. GIF dan video MP4 tetap bergerak.","変更は自動保存されます。スライダーと色は操作を終えるか、少し停止すると反映されます。GIFとMP4動画は再生を続けます。","การเปลี่ยนแปลงจะบันทึกอัตโนมัติ แถบเลื่อนและสีจะมีผลเมื่อปล่อยหรือหยุดชั่วครู่ GIF และวิดีโอ MP4 จะเล่นต่อเนื่อง","변경 사항은 자동으로 저장됩니다. 슬라이더와 색상은 조작을 마치거나 잠시 기다리면 적용됩니다. GIF와 MP4 동영상은 계속 재생됩니다."],
    ["Roblox default background","Roblox 默认背景","Roblox 預設背景","Latar belakang bawaan Roblox","Roblox標準の背景","พื้นหลังเริ่มต้นของ Roblox","Roblox 기본 배경"],
    ["Local file","本地文件","本機檔案","File lokal","ローカルファイル","ไฟล์ในเครื่อง","로컬 파일"],
    ["Image fit","图片适应方式","圖片顯示方式","Penyesuaian gambar","画像の表示方法","การจัดวางภาพ","이미지 맞춤"],
    ["Fill screen","填满屏幕","填滿畫面","Penuhi layar","画面全体に表示","เต็มหน้าจอ","화면 채우기"],
    ["Show entire image","显示完整图片","顯示完整圖片","Tampilkan seluruh gambar","画像全体を表示","แสดงภาพทั้งหมด","이미지 전체 표시"],
    ["Dark overlay","背景暗度","背景暗度","Lapisan gelap","暗さの調整","ความมืดของพื้นหลัง","어둡게 하기"],
    ["Frosted menus and page panels","毛玻璃菜单和页面面板","毛玻璃選單與頁面面板","Menu dan panel dengan efek kaca buram","すりガラス風メニューとパネル","เมนูและแผงแบบกระจกฝ้า","반투명 메뉴 및 페이지 패널"],
    ["Works with Roblox's default background or your own image or video.","适用于 Roblox 默认背景，以及您自己的图片或视频。","適用於 Roblox 預設背景，以及您自己的圖片或影片。","Dapat digunakan dengan latar belakang bawaan Roblox atau gambar dan video Anda sendiri.","Roblox標準の背景でも、自分の画像や動画でも使用できます。","ใช้ได้ทั้งพื้นหลังเริ่มต้นของ Roblox และภาพหรือวิดีโอของคุณเอง","Roblox 기본 배경이나 원하는 이미지 또는 동영상과 함께 사용할 수 있습니다."],
    ["Frost blur","模糊强度","模糊強度","Keburaman kaca","ぼかしの強さ","ความเบลอของกระจกฝ้า","흐림 강도"],
    ["Glass opacity","面板不透明度","面板不透明度","Opasitas kaca","ガラスの不透明度","ความทึบของกระจก","패널 불투명도"],
    ["Disable transparency","关闭透明效果","關閉透明效果","Nonaktifkan transparansi","透明効果を無効にする","ปิดความโปร่งใส","투명 효과 끄기"],
    ["Disable blur","关闭模糊效果","關閉模糊效果","Nonaktifkan keburaman","ぼかしを無効にする","ปิดความเบลอ","흐림 효과 끄기"],
    ["Your blur and opacity values are kept when effects are disabled.","关闭效果时会保留您的模糊强度和不透明度设置。","關閉效果時會保留您的模糊強度與不透明度設定。","Nilai keburaman dan opasitas tetap disimpan saat efek dinonaktifkan.","効果を無効にしても、ぼかしと不透明度の設定値は保持されます。","ค่าความเบลอและความทึบจะยังคงอยู่เมื่อปิดเอฟเฟกต์","효과를 꺼도 흐림 강도와 불투명도 값은 유지됩니다."],
    ["Custom colors","自定义颜色","自訂色彩","Warna kustom","カスタムカラー","สีที่กำหนดเอง","사용자 지정 색상"],
    ["Experimental","实验性","實驗性","Eksperimental","試験的機能","ฟังก์ชันทดลอง","실험적 기능"],
    ["Enable custom colors","启用自定义颜色","啟用自訂色彩","Aktifkan warna kustom","カスタムカラーを有効にする","เปิดใช้สีที่กำหนดเอง","사용자 지정 색상 사용"],
    ["Changes text, page and panel backgrounds, and accents. Some Roblox elements may keep their own colors.","更改文字、页面和面板背景，以及强调色。部分 Roblox 元素可能保留原有颜色。","變更文字、頁面與面板背景，以及強調色。部分 Roblox 元素可能保留原有色彩。","Mengubah warna teks, latar belakang halaman dan panel, serta aksen. Beberapa elemen Roblox mungkin tetap menggunakan warnanya sendiri.","文字、ページとパネルの背景、アクセントの色を変更します。Robloxの一部の要素は元の色のままになる場合があります。","เปลี่ยนสีข้อความ พื้นหลังหน้าและแผง รวมถึงสีเน้น องค์ประกอบบางส่วนของ Roblox อาจยังใช้สีเดิม","텍스트, 페이지 및 패널 배경, 강조 색상을 변경합니다. 일부 Roblox 요소는 자체 색상을 유지할 수 있습니다."],
    ["Color palette","配色","配色","Palet warna","カラーパレット","ชุดสี","색상 팔레트"],
    ["Text color","文字颜色","文字色彩","Warna teks","文字の色","สีข้อความ","텍스트 색상"],
    ["Background color","背景颜色","背景色彩","Warna latar belakang","背景の色","สีพื้นหลัง","배경 색상"],
    ["Accent color","强调色","強調色","Warna aksen","アクセントカラー","สีเน้น","강조 색상"],
    ["Reset and disable","重置并停用","重設並停用","Reset dan nonaktifkan","リセットして無効にする","รีเซ็ตและปิดใช้งาน","초기화하고 끄기"],
    ["Home page","主页","首頁","Beranda","ホーム","หน้าหลัก","홈 페이지"],
    ["Home page visibility","主页显示","首頁顯示","Tampilan bagian Beranda","ホームの表示設定","การแสดงผลหน้าหลัก","홈 페이지 표시 설정"],
    ["Hide Favorites","隐藏收藏","隱藏最愛","Sembunyikan Favorit","お気に入りを非表示","ซ่อนรายการโปรด","즐겨찾기 숨기기"],
    ["Hide Standout Games","隐藏精选游戏","隱藏精選遊戲","Sembunyikan Game Unggulan","注目のゲームを非表示","ซ่อนเกมที่โดดเด่น","주목할 만한 게임 숨기기"],
    ["Hide upper recommendations","隐藏上方推荐","隱藏上方推薦","Sembunyikan rekomendasi di atas","上部のおすすめを非表示","ซ่อนรายการแนะนำด้านบน","상단 추천 숨기기"],
    ["Hide lower recommendations","隐藏下方推荐","隱藏下方推薦","Sembunyikan rekomendasi di bawah","下部のおすすめを非表示","ซ่อนรายการแนะนำด้านล่าง","하단 추천 숨기기"],
    ["Hidden recommendations","已隐藏的推荐游戏","已隱藏的推薦遊戲","Rekomendasi tersembunyi","非表示にしたおすすめ","รายการแนะนำที่ซ่อนไว้","숨긴 추천 항목"],
    ["Use Hide on a recommended game. Restore it here whenever you want.","点击推荐游戏上的“隐藏”，之后可随时在这里恢复。","點擊推薦遊戲上的「隱藏」，之後可隨時在這裡恢復。","Gunakan Sembunyikan pada game yang direkomendasikan. Pulihkan di sini kapan saja.","おすすめゲームの「非表示」を使ってください。ここからいつでも元に戻せます。","กดซ่อนบนเกมที่แนะนำ แล้วนำกลับมาแสดงได้ที่นี่ทุกเมื่อ","추천 게임의 숨기기를 누르세요. 언제든지 여기에서 복원할 수 있습니다."],
    ["No games hidden individually.","尚未单独隐藏任何游戏。","尚未單獨隱藏任何遊戲。","Tidak ada game yang disembunyikan satu per satu.","個別に非表示にしたゲームはありません。","ไม่มีเกมที่ซ่อนเป็นรายเกม","개별적으로 숨긴 게임이 없습니다."],
    ["Maximum friend list rows","好友列表最多行数","好友清單最多列數","Jumlah maksimum baris daftar teman","フレンド一覧の最大行数","จำนวนแถวสูงสุดของรายชื่อเพื่อน","친구 목록 최대 행 수"],
    ["1 row","1 行","1 列","1 baris","1行","1 แถว","1행"],
    ["2 rows","2 行","2 列","2 baris","2行","2 แถว","2행"],
    ["3 rows","3 行","3 列","3 baris","3行","3 แถว","3행"],
    ["Personal greetings","自定义问候语","自訂問候語","Sapaan pribadi","あいさつのカスタマイズ","คำทักทายส่วนตัว","사용자 지정 인사말"],
    ["Shown after your name. Leave blank to use the default greeting.","显示在您的名字后面。留空则使用默认问候语。","顯示在您的名字後面。留空則使用預設問候語。","Ditampilkan setelah nama Anda. Biarkan kosong untuk menggunakan sapaan bawaan.","名前の後に表示されます。空欄にすると標準のあいさつを使用します。","แสดงต่อท้ายชื่อ เว้นว่างเพื่อใช้คำทักทายเริ่มต้น","이름 뒤에 표시됩니다. 비워 두면 기본 인사말을 사용합니다."],
    ["Morning","早上","早上","Pagi","朝","เช้า","아침"],
    ["Afternoon","下午","下午","Siang","昼","บ่าย","오후"],
    ["Evening","晚上","晚上","Malam","夜","เย็น","저녁"],
    ["good morning!","早上好！","早安！","selamat pagi!","おはようございます！","สวัสดีตอนเช้า!","좋은 아침이에요!"],
    ["good afternoon!","下午好！","午安！","selamat siang!","こんにちは！","สวัสดีตอนบ่าย!","좋은 오후예요!"],
    ["good evening!","晚上好！","晚安！","selamat malam!","こんばんは！","สวัสดีตอนเย็น!","좋은 저녁이에요!"],
    ["Home clock","主页时钟","首頁時鐘","Jam Beranda","ホームの時計","นาฬิกาหน้าหลัก","홈 시계"],
    ["Show seconds","显示秒数","顯示秒數","Tampilkan detik","秒を表示","แสดงวินาที","초 표시"],
    ["Show date","显示日期","顯示日期","Tampilkan tanggal","日付を表示","แสดงวันที่","날짜 표시"],
    ["Hour format","时间格式","時間格式","Format jam","時刻の形式","รูปแบบเวลา","시간 형식"],
    ["24-hour","24 小时制","24 小時制","24 jam","24時間制","24 ชั่วโมง","24시간"],
    ["12-hour","12 小时制","12 小時制","12 jam","12時間制","12 ชั่วโมง","12시간"],
    ["Social feed panels","社交动态面板","社群動態面板","Panel feed sosial","ソーシャルフィードのパネル","แผงฟีดโซเชียล","소셜 피드 패널"],
    ["Hide X feed","隐藏 X 动态","隱藏 X 動態","Sembunyikan feed X","Xフィードを非表示","ซ่อนฟีด X","X 피드 숨기기"],
    ["Hide YouTube feed","隐藏 YouTube 动态","隱藏 YouTube 動態","Sembunyikan feed YouTube","YouTubeフィードを非表示","ซ่อนฟีด YouTube","YouTube 피드 숨기기"],
    ["Choose feeds separately for each page type.","分别选择各类页面要启用的动态。","分別選擇各類頁面要啟用的動態。","Pilih feed secara terpisah untuk setiap jenis halaman.","ページの種類ごとに表示するフィードを選べます。","เลือกฟีดแยกตามประเภทหน้าได้","페이지 종류별로 피드를 따로 선택하세요."],
    ["Game pages","游戏页面","遊戲頁面","Halaman game","ゲームページ","หน้าเกม","게임 페이지"],
    ["Community pages","社群页面","社群頁面","Halaman komunitas","コミュニティページ","หน้าชุมชน","커뮤니티 페이지"],
    ["Profile pages","个人资料页面","個人檔案頁面","Halaman profil","プロフィールページ","หน้าโปรไฟล์","프로필 페이지"],
    ["Enable X feed","启用 X 动态","啟用 X 動態","Aktifkan feed X","Xフィードを有効にする","เปิดใช้ฟีด X","X 피드 사용"],
    ["Enable YouTube feed","启用 YouTube 动态","啟用 YouTube 動態","Aktifkan feed YouTube","YouTubeフィードを有効にする","เปิดใช้ฟีด YouTube","YouTube 피드 사용"],
    ["Done","完成","完成","Selesai","完了","เสร็จสิ้น","완료"],
    ["Close","关闭","關閉","Tutup","閉じる","ปิด","닫기"],
    ["Hide","隐藏","隱藏","Sembunyikan","非表示","ซ่อน","숨기기"],
    ["Show","显示","顯示","Tampilkan","表示","แสดง","표시"],
    ["Restore","恢复","還原","Pulihkan","元に戻す","คืนค่า","복원"],
    ["Hide this recommendation","隐藏此推荐游戏","隱藏此推薦遊戲","Sembunyikan rekomendasi ini","このおすすめを非表示","ซ่อนรายการแนะนำนี้","이 추천 숨기기"],
    ["Hide {name} from recommendations","从推荐中隐藏 {name}","從推薦中隱藏 {name}","Sembunyikan {name} dari rekomendasi","おすすめから{name}を非表示にする","ซ่อน {name} จากรายการแนะนำ","추천에서 {name} 숨기기"],
    ["Show {name} in recommendations","在推荐中显示 {name}","在推薦中顯示 {name}","Tampilkan {name} dalam rekomendasi","おすすめに{name}を表示する","แสดง {name} ในรายการแนะนำ","추천에 {name} 표시"],
    ["Open Roblox Customizer settings","打开 Roblox 自定义工具设置","開啟 Roblox 自訂工具設定","Buka pengaturan Roblox Customizer","Roblox Customizerの設定を開く","เปิดการตั้งค่า Roblox Customizer","Roblox Customizer 설정 열기"],
    ["Current file: {name}","当前文件：{name}","目前檔案：{name}","File saat ini: {name}","現在のファイル：{name}","ไฟล์ปัจจุบัน: {name}","현재 파일: {name}"],
    ["Selected file: {name}","已选择文件：{name}","已選擇檔案：{name}","File dipilih: {name}","選択したファイル：{name}","ไฟล์ที่เลือก: {name}","선택한 파일: {name}"],
    ["Loading background...","正在加载背景…","正在載入背景…","Memuat latar belakang...","背景を読み込み中…","กำลังโหลดพื้นหลัง…","배경 불러오는 중…"],
    ["Choose a local file to use as the background.","请选择一个本地文件作为背景。","請選擇一個本機檔案作為背景。","Pilih file lokal untuk digunakan sebagai latar belakang.","背景に使用するローカルファイルを選んでください。","เลือกไฟล์ในเครื่องเพื่อใช้เป็นพื้นหลัง","배경으로 사용할 로컬 파일을 선택하세요."],
    ["Choose an image, GIF, or MP4 file.","请选择图片、GIF 或 MP4 文件。","請選擇圖片、GIF 或 MP4 檔案。","Pilih file gambar, GIF, atau MP4.","画像、GIF、MP4ファイルを選んでください。","เลือกไฟล์ภาพ GIF หรือ MP4","이미지, GIF 또는 MP4 파일을 선택하세요."],
    ["Saved file is unavailable. Choose it again.","保存的文件不可用，请重新选择。","儲存的檔案無法使用，請重新選擇。","File tersimpan tidak tersedia. Pilih lagi.","保存したファイルが見つかりません。もう一度選んでください。","ไม่พบไฟล์ที่บันทึกไว้ โปรดเลือกอีกครั้ง","저장된 파일을 사용할 수 없습니다. 다시 선택하세요."],
    ["Could not load the saved background.","无法加载已保存的背景。","無法載入已儲存的背景。","Tidak dapat memuat latar belakang yang tersimpan.","保存した背景を読み込めませんでした。","ไม่สามารถโหลดพื้นหลังที่บันทึกไว้ได้","저장된 배경을 불러올 수 없습니다."],
    ["Could not load this background. Check the file or URL.","无法加载背景，请检查文件或网址。","無法載入背景，請檢查檔案或網址。","Tidak dapat memuat latar belakang ini. Periksa file atau URL.","この背景を読み込めませんでした。ファイルまたはURLを確認してください。","ไม่สามารถโหลดพื้นหลังนี้ได้ โปรดตรวจสอบไฟล์หรือ URL","이 배경을 불러올 수 없습니다. 파일이나 URL을 확인하세요."],
    ["Could not load the selected file.","无法加载所选文件。","無法載入所選檔案。","Tidak dapat memuat file yang dipilih.","選択したファイルを読み込めませんでした。","ไม่สามารถโหลดไฟล์ที่เลือกได้","선택한 파일을 불러올 수 없습니다."],
    ["Could not save settings.","无法保存设置。","無法儲存設定。","Tidak dapat menyimpan pengaturan.","設定を保存できませんでした。","ไม่สามารถบันทึกการตั้งค่าได้","설정을 저장할 수 없습니다."],
    ["YOUR HOME","您的主页","您的首頁","BERANDA ANDA","あなたのホーム","หน้าหลักของคุณ","내 홈"],
    ["TIME","时间","時間","WAKTU","時刻","เวลา","시간"],
    ["Personal greeting","个人问候","個人問候","Sapaan pribadi","カスタムあいさつ","คำทักทายส่วนตัว","인사말"],
    ["Player avatar","玩家头像","玩家頭像","Avatar pemain","プレイヤーのアバター","อวาตาร์ของผู้เล่น","플레이어 아바타"],
    ["{name}'s avatar","{name} 的头像","{name} 的頭像","Avatar {name}","{name}のアバター","อวาตาร์ของ {name}","{name}의 아바타"],
    ["Pinned Games","置顶游戏","釘選遊戲","Game yang Disematkan","ピン留めしたゲーム","เกมที่ปักหมุด","고정 게임"],
    ["Pin Game","置顶游戏","釘選遊戲","Sematkan Game","ゲームをピン留め","ปักหมุดเกม","게임 고정"],
    ["Unpin Game","取消置顶","取消釘選","Lepas Sematan Game","ピン留めを解除","เลิกปักหมุดเกม","게임 고정 해제"],
    ["Pin game to Home","将游戏置顶到主页","將遊戲釘選至首頁","Sematkan game ke Beranda","ゲームをホームにピン留め","ปักหมุดเกมบนหน้าหลัก","홈에 게임 고정"],
    ["Unpin game from Home","从主页取消置顶","從首頁取消釘選","Lepas sematan game dari Beranda","ホームのピン留めを解除","เลิกปักหมุดเกมจากหน้าหลัก","홈에서 게임 고정 해제"],
    ["Unpin game","取消置顶游戏","取消釘選遊戲","Lepas sematan game","ピン留めを解除","เลิกปักหมุดเกม","게임 고정 해제"],
    ["Unpin {name}","取消置顶 {name}","取消釘選 {name}","Lepas sematan {name}","{name}のピン留めを解除","เลิกปักหมุด {name}","{name} 고정 해제"],
    ["Join Game","加入游戏","加入遊戲","Gabung ke Game","ゲームに参加","เข้าร่วมเกม","게임 참가"],
    ["Join","加入","加入","Gabung","参加","เข้าร่วม","참가"],
    ["Join {name}","加入 {name}","加入 {name}","Gabung ke {name}","{name}に参加","เข้าร่วม {name}","{name} 참가"],
    ["Use Pin Game on a game page to add public or private games here.","使用游戏页面上的“置顶游戏”按钮，将公开或私人游戏添加到这里。","使用遊戲頁面上的「釘選遊戲」按鈕，將公開或私人遊戲加入這裡。","Gunakan Sematkan Game di halaman game untuk menambahkan game publik atau privat di sini.","ゲームページの「ゲームをピン留め」から、公開・非公開のゲームをここに追加できます。","ใช้ปุ่มปักหมุดเกมบนหน้าเกมเพื่อเพิ่มเกมสาธารณะหรือส่วนตัวไว้ที่นี่","게임 페이지의 게임 고정을 눌러 공개 또는 비공개 게임을 여기에 추가하세요."],
    ["Game unpinned","已取消置顶游戏","已取消釘選遊戲","Sematan game dilepas","ピン留めを解除しました","เลิกปักหมุดเกมแล้ว","게임 고정을 해제했습니다"],
    ["Game pinned to Home","游戏已置顶到主页","遊戲已釘選至首頁","Game disematkan ke Beranda","ゲームをホームにピン留めしました","ปักหมุดเกมบนหน้าหลักแล้ว","홈에 게임을 고정했습니다"],
    ["All games","全部游戏","所有遊戲","Semua game","すべてのゲーム","เกมทั้งหมด","모든 게임"],
    ["Uncategorized","未分类","未分類","Tanpa kategori","未分類","ยังไม่จัดหมวดหมู่","미분류"],
    ["{count} games","{count} 个游戏","{count} 個遊戲","{count} game","{count}件のゲーム","{count} เกม","게임 {count}개"],
    ["New folder","新建文件夹","新增資料夾","Folder baru","新しいフォルダー","โฟลเดอร์ใหม่","새 폴더"],
    ["Rename folder","重命名文件夹","重新命名資料夾","Ubah nama folder","フォルダー名を変更","เปลี่ยนชื่อโฟลเดอร์","폴더 이름 변경"],
    ["Delete folder","删除文件夹","刪除資料夾","Hapus folder","フォルダーを削除","ลบโฟลเดอร์","폴더 삭제"],
    ["Game folders","游戏文件夹","遊戲資料夾","Folder game","ゲームのフォルダー","โฟลเดอร์เกม","게임 폴더"],
    ["Folder name","文件夹名称","資料夾名稱","Nama folder","フォルダー名","ชื่อโฟลเดอร์","폴더 이름"],
    ["Save folder","保存文件夹","儲存資料夾","Simpan folder","フォルダーを保存","บันทึกโฟลเดอร์","폴더 저장"],
    ["Cancel","取消","取消","Batal","キャンセル","ยกเลิก","취소"],
    ["Folder","文件夹","資料夾","Folder","フォルダー","โฟลเดอร์","폴더"],
    ["Folder for {name}","{name} 的文件夹","{name} 的資料夾","Folder untuk {name}","{name}のフォルダー","โฟลเดอร์สำหรับ {name}","{name}의 폴더"],
    ["Pinned game folder","置顶游戏文件夹","釘選遊戲資料夾","Folder game yang disematkan","ピン留めしたゲームのフォルダー","โฟลเดอร์ของเกมที่ปักหมุด","고정 게임 폴더"],
    ["Choose a folder, then pin this game.","选择文件夹，然后置顶此游戏。","選擇資料夾，然後釘選此遊戲。","Pilih folder, lalu sematkan game ini.","フォルダーを選んでから、このゲームをピン留めしてください。","เลือกโฟลเดอร์ แล้วปักหมุดเกมนี้","폴더를 선택한 후 이 게임을 고정하세요."],
    ["Changing this folder moves the pinned game.","更改文件夹会移动此置顶游戏。","變更資料夾會移動此釘選遊戲。","Mengubah folder ini akan memindahkan game yang disematkan.","フォルダーを変更すると、ピン留めしたゲームが移動します。","การเปลี่ยนโฟลเดอร์จะย้ายเกมที่ปักหมุด","폴더를 변경하면 고정한 게임이 이동합니다."],
    ["Create folders in Pinned Games on Home.","在主页的“置顶游戏”中创建文件夹。","在首頁的「釘選遊戲」中建立資料夾。","Buat folder di Game yang Disematkan pada Beranda.","ホームの「ピン留めしたゲーム」でフォルダーを作成してください。","สร้างโฟลเดอร์ในส่วนเกมที่ปักหมุดบนหน้าหลัก","홈의 고정 게임에서 폴더를 만드세요."],
    ["Pinned game moved.","已移动置顶游戏。","已移動釘選遊戲。","Game yang disematkan dipindahkan.","ピン留めしたゲームを移動しました。","ย้ายเกมที่ปักหมุดแล้ว","고정한 게임을 이동했습니다."],
    ["Show more games","显示更多游戏","顯示更多遊戲","Tampilkan game lainnya","ゲームをもっと表示","แสดงเกมเพิ่มเติม","게임 더 보기"],
    ["No games in this folder. Choose a folder on a pinned game to move it here.","此文件夹中暂无游戏。在置顶游戏的卡片上选择文件夹即可将它移到这里。","此資料夾尚無遊戲。在釘選遊戲的卡片上選擇資料夾，即可將它移到這裡。","Tidak ada game dalam folder ini. Pilih folder pada game yang disematkan untuk memindahkannya ke sini.","このフォルダーにゲームはありません。ピン留めしたゲームのカードでこのフォルダーを選ぶと移動できます。","ไม่มีเกมในโฟลเดอร์นี้ เลือกโฟลเดอร์บนการ์ดเกมที่ปักหมุดเพื่อย้ายเกมมาที่นี่","이 폴더에 게임이 없습니다. 고정한 게임에서 이 폴더를 선택하여 이동하세요."],
    ["Folder deleted. Its games are now Uncategorized.","文件夹已删除，其中的游戏已移至“未分类”。","資料夾已刪除，其中的遊戲已移至「未分類」。","Folder dihapus. Game di dalamnya kini berada di Tanpa kategori.","フォルダーを削除しました。中のゲームは未分類になりました。","ลบโฟลเดอร์แล้ว เกมในโฟลเดอร์ถูกย้ายไปยังหมวดที่ยังไม่จัดหมวดหมู่","폴더를 삭제했습니다. 해당 게임은 미분류로 이동했습니다."],
    ["The game or folder no longer exists.","游戏或文件夹已不存在。","遊戲或資料夾已不存在。","Game atau folder ini sudah tidak ada.","ゲームまたはフォルダーが見つかりません。","ไม่พบเกมหรือโฟลเดอร์นี้แล้ว","게임 또는 폴더가 더 이상 존재하지 않습니다."],
    ["Could not update pinned games. Please try again.","无法更新置顶游戏，请重试。","無法更新釘選遊戲，請重試。","Tidak dapat memperbarui game yang disematkan. Coba lagi.","ピン留めしたゲームを更新できませんでした。もう一度お試しください。","ไม่สามารถอัปเดตเกมที่ปักหมุดได้ โปรดลองอีกครั้ง","고정 게임을 업데이트할 수 없습니다. 다시 시도하세요."],
    ["Could not join this game. Open its page and try again.","无法加入游戏，请打开游戏页面后重试。","無法加入遊戲，請開啟遊戲頁面後重試。","Tidak dapat bergabung ke game ini. Buka halamannya dan coba lagi.","このゲームに参加できませんでした。ゲームページを開いて再試行してください。","ไม่สามารถเข้าร่วมเกมนี้ได้ เปิดหน้าเกมแล้วลองอีกครั้ง","이 게임에 참가할 수 없습니다. 게임 페이지를 열고 다시 시도하세요."],
    ["This game cannot be pinned right now.","目前无法置顶此游戏。","目前無法釘選此遊戲。","Game ini belum dapat disematkan.","現在、このゲームはピン留めできません。","ขณะนี้ไม่สามารถปักหมุดเกมนี้ได้","지금은 이 게임을 고정할 수 없습니다."],
    ["Game information unavailable. Please try again.","无法获取游戏信息，请重试。","無法取得遊戲資訊，請重試。","Informasi game tidak tersedia. Coba lagi.","ゲーム情報を取得できません。もう一度お試しください。","ไม่สามารถรับข้อมูลเกมได้ โปรดลองอีกครั้ง","게임 정보를 사용할 수 없습니다. 다시 시도하세요."],
    ["Robux currency converter","Robux 货币换算","Robux 貨幣換算","Konverter mata uang Robux","Robuxの通貨換算","ตัวแปลงสกุลเงิน Robux","Robux 통화 환산"],
    ["Show currency equivalents across Roblox","在 Roblox 中显示对应货币估值","在 Roblox 中顯示對應貨幣估值","Tampilkan nilai mata uang di seluruh Roblox","Roblox内に通貨換算の目安を表示","แสดงมูลค่าเทียบเท่าสกุลเงินทั่ว Roblox","Roblox에서 통화 환산액 표시"],
    ["Find a currency","查找货币","尋找貨幣","Cari mata uang","通貨を検索","ค้นหาสกุลเงิน","통화 찾기"],
    ["Currency name or code","货币名称或代码","貨幣名稱或代碼","Nama atau kode mata uang","通貨名または通貨コード","ชื่อหรือรหัสสกุลเงิน","통화 이름 또는 코드"],
    ["Currency","货币","貨幣","Mata uang","通貨","สกุลเงิน","통화"],
    ["Refresh rates","刷新汇率","重新整理匯率","Perbarui kurs","為替レートを更新","รีเฟรชอัตราแลกเปลี่ยน","환율 새로 고침"],
    ["Displays an estimated purchase equivalent. This does not exchange your Robux.","显示估算的购买等值金额，不会兑换您的 Robux。","顯示估算的購買等值金額，不會兌換您的 Robux。","Menampilkan perkiraan nilai pembelian. Fitur ini tidak menukar Robux Anda.","購入価格の推定額を表示します。Robuxを両替する機能ではありません。","แสดงมูลค่าซื้อโดยประมาณ ไม่ใช่การแลก Robux เป็นเงินจริง","추정 구매 금액을 표시합니다. Robux를 실제로 환전하지 않습니다."],
    ["Example: {value}","示例：{value}","範例：{value}","Contoh: {value}","例：{value}","ตัวอย่าง: {value}","예: {value}"],
    ["Your balance: {value}","您的余额：{value}","您的餘額：{value}","Saldo Anda: {value}","残高：{value}","ยอดคงเหลือ: {value}","내 잔액: {value}"],
    ["Updating exchange rates…","正在更新汇率…","正在更新匯率…","Memperbarui kurs…","為替レートを更新中…","กำลังอัปเดตอัตราแลกเปลี่ยน…","환율 업데이트 중…"],
    ["Using a reference purchase price. Actual checkout prices may vary.","使用参考购买价格，实际结算价格可能不同。","使用參考購買價格，實際結帳價格可能不同。","Menggunakan harga pembelian acuan. Harga saat pembayaran dapat berbeda.","参考購入価格を使用しています。実際の決済価格は異なる場合があります。","ใช้ราคาอ้างอิงในการซื้อ ราคาที่ชำระจริงอาจแตกต่างกัน","참고용 구매 가격을 사용합니다. 실제 결제 가격은 다를 수 있습니다."],
    ["Exchange rates: {date}","汇率日期：{date}","匯率日期：{date}","Kurs: {date}","為替レート：{date}","อัตราแลกเปลี่ยน: {date}","환율 기준일: {date}"],
    ["Exchange rates: {date} · cached, refresh unavailable","汇率日期：{date} · 使用缓存，暂时无法刷新","匯率日期：{date} · 使用快取，暫時無法更新","Kurs: {date} · dari cache, pembaruan tidak tersedia","為替レート：{date} · キャッシュを使用、更新できません","อัตราแลกเปลี่ยน: {date} · ใช้แคช ไม่สามารถรีเฟรชได้","환율 기준일: {date} · 캐시 사용, 새로 고침 불가"],
    ["No exchange rate available. Other currencies may still be available.","暂无此货币的汇率，其他货币可能仍可用。","暫無此貨幣的匯率，其他貨幣可能仍可用。","Kurs tidak tersedia. Mata uang lain mungkin masih tersedia.","利用できる為替レートがありません。他の通貨は使用できる場合があります。","ไม่มีอัตราแลกเปลี่ยน สกุลเงินอื่นอาจยังใช้งานได้","사용 가능한 환율이 없습니다. 다른 통화는 사용할 수 있습니다."],
    ["Rates for this currency are unavailable. Use Refresh rates to try again.","此货币的汇率不可用，请点击“刷新汇率”重试。","此貨幣的匯率無法使用，請點擊「重新整理匯率」重試。","Kurs untuk mata uang ini tidak tersedia. Gunakan Perbarui kurs untuk mencoba lagi.","この通貨のレートを取得できません。「為替レートを更新」で再試行してください。","ไม่สามารถรับอัตราแลกเปลี่ยนของสกุลเงินนี้ได้ กดรีเฟรชอัตราแลกเปลี่ยนเพื่อลองอีกครั้ง","이 통화의 환율을 사용할 수 없습니다. 환율 새로 고침을 눌러 다시 시도하세요."],
    ["Could not save. Try changing the currency again.","无法保存，请重新选择货币。","無法儲存，請重新選擇貨幣。","Tidak dapat menyimpan. Coba ubah mata uang lagi.","保存できませんでした。もう一度通貨を変更してください。","บันทึกไม่สำเร็จ โปรดลองเปลี่ยนสกุลเงินอีกครั้ง","저장할 수 없습니다. 통화를 다시 변경해 보세요."],
    ["Refresh","刷新","重新整理","Muat ulang","更新","รีเฟรช","새로 고침"],
    ["Refreshing...","正在刷新…","正在重新整理…","Memuat ulang...","更新中…","กำลังรีเฟรช…","새로 고치는 중…"],
    ["2D Preview","2D 预览","2D 預覽","Pratinjau 2D","2Dプレビュー","ตัวอย่าง 2D","2D 미리 보기"],
    ["2D avatar preview","2D 头像预览","2D 虛擬人偶預覽","Pratinjau avatar 2D","アバターの2Dプレビュー","ตัวอย่างอวาตาร์ 2D","2D 아바타 미리 보기"],
    ["2D item preview","2D 物品预览","2D 物品預覽","Pratinjau item 2D","アイテムの2Dプレビュー","ตัวอย่างไอเท็ม 2D","2D 아이템 미리 보기"],
    ["Refresh 3D preview","刷新 3D 预览","重新整理 3D 預覽","Muat ulang pratinjau 3D","3Dプレビューを再読み込み","โหลดตัวอย่าง 3D ใหม่","3D 미리 보기 새로 고침"],
    ["Loading 2D preview...","正在加载 2D 预览…","正在載入 2D 預覽…","Memuat pratinjau 2D...","2Dプレビューを読み込み中…","กำลังโหลดตัวอย่าง 2D…","2D 미리 보기 불러오는 중…"],
    ["Updating 2D preview...","正在更新 2D 预览…","正在更新 2D 預覽…","Memperbarui pratinjau 2D...","2Dプレビューを更新中…","กำลังอัปเดตตัวอย่าง 2D…","2D 미리 보기 업데이트 중…"],
    ["Reloading 3D preview...","正在重新加载 3D 预览…","正在重新載入 3D 預覽…","Memuat ulang pratinjau 3D...","3Dプレビューを再読み込み中…","กำลังโหลดตัวอย่าง 3D ใหม่…","3D 미리 보기 다시 불러오는 중…"],
    ["2D preview is still being generated. Try Refresh.","2D 预览仍在生成中，请稍后刷新。","2D 預覽仍在產生中，請稍後重新整理。","Pratinjau 2D masih dibuat. Coba Muat ulang.","2Dプレビューを生成中です。「更新」をお試しください。","ยังสร้างตัวอย่าง 2D ไม่เสร็จ โปรดลองรีเฟรช","2D 미리 보기를 생성 중입니다. 새로 고침을 눌러 보세요."],
    ["2D preview unavailable. Try Refresh.","2D 预览不可用，请尝试刷新。","2D 預覽無法使用，請嘗試重新整理。","Pratinjau 2D tidak tersedia. Coba Muat ulang.","2Dプレビューを利用できません。「更新」をお試しください。","ไม่สามารถใช้ตัวอย่าง 2D ได้ โปรดลองรีเฟรช","2D 미리 보기를 사용할 수 없습니다. 새로 고침을 눌러 보세요."],
    ["Roblox is generating the 2D preview...","Roblox 正在生成 2D 预览…","Roblox 正在產生 2D 預覽…","Roblox sedang membuat pratinjau 2D...","Robloxが2Dプレビューを生成しています…","Roblox กำลังสร้างตัวอย่าง 2D…","Roblox에서 2D 미리 보기를 생성하고 있습니다…"],
    ["Could not display the 2D preview.","无法显示 2D 预览。","無法顯示 2D 預覽。","Tidak dapat menampilkan pratinjau 2D.","2Dプレビューを表示できませんでした。","ไม่สามารถแสดงตัวอย่าง 2D ได้","2D 미리 보기를 표시할 수 없습니다."],
    ["Profile details","个人资料详情","個人檔案詳細資料","Detail profil","プロフィールの詳細","รายละเอียดโปรไฟล์","프로필 상세 정보"],
    ["Profile sections","个人资料分区","個人檔案區塊","Bagian profil","プロフィールのセクション","ส่วนต่าง ๆ ของโปรไฟล์","프로필 섹션"],
    ["Copy ID","复制 ID","複製 ID","Salin ID","IDをコピー","คัดลอก ID","ID 복사"],
    ["Copied","已复制","已複製","Disalin","コピーしました","คัดลอกแล้ว","복사됨"],
    ["Copy failed","复制失败","複製失敗","Gagal menyalin","コピーできませんでした","คัดลอกไม่สำเร็จ","복사 실패"],
    ["Loading account details...","正在加载账号详情…","正在載入帳號詳細資料…","Memuat detail akun...","アカウントの詳細を読み込み中…","กำลังโหลดรายละเอียดบัญชี…","계정 정보 불러오는 중…"],
    ["User ID","用户 ID","使用者 ID","ID pengguna","ユーザーID","ID ผู้ใช้","사용자 ID"],
    ["Joined","加入日期","加入日期","Bergabung","登録日","วันที่เข้าร่วม","가입일"],
    ["Joined {date}","加入日期：{date}","加入日期：{date}","Bergabung pada {date}","登録日：{date}","เข้าร่วมเมื่อ {date}","가입일: {date}"],
    ["Account age","账号年龄","帳號年齡","Usia akun","アカウントの経過日数","อายุบัญชี","가입 후 기간"],
    ["Verified","已认证","已驗證","Terverifikasi","認証済み","ยืนยันแล้ว","인증됨"],
    ["Yes","是","是","Ya","はい","ใช่","예"],
    ["No","否","否","Tidak","いいえ","ไม่ใช่","아니요"],
    ["Former usernames","曾用名","曾用名稱","Nama pengguna terdahulu","以前のユーザー名","ชื่อผู้ใช้เดิม","이전 사용자 이름"],
    ["Previous usernames","曾用名","曾用名稱","Nama pengguna sebelumnya","過去のユーザー名","ชื่อผู้ใช้ก่อนหน้า","이전 사용자 이름"],
    ["Social links","社交链接","社群連結","Tautan sosial","ソーシャルリンク","ลิงก์โซเชียล","소셜 링크"],
    ["No bio yet.","暂无简介。","尚無簡介。","Belum ada bio.","自己紹介はまだありません。","ยังไม่มีประวัติส่วนตัว","아직 소개가 없습니다."],
    ["Currently Wearing","当前穿戴","目前穿戴","Sedang Dipakai","現在着用中","กำลังสวมใส่","현재 착용 중"],
    ["Store","商店","商店","Toko","ストア","ร้านค้า","상점"],
    ["Experiences","游戏体验","遊戲體驗","Pengalaman Virtual","体験","ประสบการณ์","체험"],
    ["Favorites","收藏","最愛","Favorit","お気に入り","รายการโปรด","즐겨찾기"],
    ["Collections","收藏品","收藏品","Koleksi","コレクション","คอลเลกชัน","컬렉션"],
    ["Friends","好友","好友","Teman","フレンド","เพื่อน","친구"],
    ["Communities","社区","社群","Komunitas","コミュニティ","ชุมชน","커뮤니티"],
    ["Badges","徽章","徽章","Lencana","バッジ","เหรียญตรา","배지"],
    ["Limited Items","限量物品","限量物品","Item Terbatas","限定アイテム","ไอเท็มลิมิเต็ด","한정판 아이템"],
    ["Limited items","限量物品","限量物品","Item terbatas","限定アイテム","ไอเท็มลิมิเต็ด","한정판 아이템"],
    ["Loading Limited inventory...","正在加载限量物品库存…","正在載入限量物品庫存…","Memuat inventaris item terbatas...","限定アイテムのインベントリを読み込み中…","กำลังโหลดช่องเก็บไอเท็มลิมิเต็ด…","한정판 인벤토리 불러오는 중…"],
    ["View on Rolimon's","在 Rolimon's 查看","在 Rolimon's 查看","Lihat di Rolimon's","Rolimon'sで見る","ดูบน Rolimon's","Rolimon's에서 보기"],
    ["Show more","显示更多","顯示更多","Tampilkan lainnya","もっと表示","แสดงเพิ่มเติม","더 보기"],
    ["Show more ({count} remaining)","显示更多（剩余 {count}）","顯示更多（剩餘 {count}）","Tampilkan lainnya (tersisa {count})","もっと表示（残り{count}件）","แสดงเพิ่มเติม (เหลือ {count})","더 보기({count}개 남음)"],
    ["RAP unavailable","暂无 RAP","暫無 RAP","RAP tidak tersedia","RAP情報なし","ไม่มีข้อมูล RAP","RAP 확인 불가"],
    ["RAP: {value}","RAP：{value}","RAP：{value}","RAP: {value}","RAP：{value}","RAP: {value}","RAP: {value}"],
    ["Owned: {value}","拥有：{value}","擁有：{value}","Dimiliki: {value}","所持数：{value}","เป็นเจ้าของ: {value}","보유: {value}"],
    ["Known RAP: {value}","已知 RAP：{value}","已知 RAP：{value}","RAP diketahui: {value}","確認済みRAP：{value}","RAP ที่ทราบ: {value}","확인된 RAP: {value}"],
    ["Owned: {count} | {total} total","拥有：{count} | 合计 {total}","擁有：{count} | 合計 {total}","Dimiliki: {count} | total {total}","所持数：{count} | 合計{total}","เป็นเจ้าของ: {count} | ทั้งหมด {total}","보유: {count}개 | 총 {total}개"],
    ["Total RAP: {value}","总 RAP：{value}","總 RAP：{value}","Total RAP: {value}","合計RAP：{value}","RAP รวม: {value}","총 RAP: {value}"],
    ["Total RAP unavailable","暂无总 RAP","暫無總 RAP","Total RAP tidak tersedia","合計RAPを取得できません","ไม่มีข้อมูล RAP รวม","총 RAP 확인 불가"],
    ["Total RAP: {rap}  |  {copies} copies  |  {unique} unique","总 RAP：{rap}  |  {copies} 件  |  {unique} 种","總 RAP：{rap}  |  {copies} 件  |  {unique} 種","Total RAP: {rap}  |  {copies} salinan  |  {unique} unik","合計RAP：{rap} | 個数：{copies} | 種類：{unique}","RAP รวม: {rap} | จำนวน {copies} ชิ้น | {unique} ประเภท","총 RAP: {rap} | {copies}개 | 고유 아이템 {unique}종"],
    ["Known RAP: {rap}  |  {copies} copies  |  {unique} unique","已知 RAP：{rap}  |  {copies} 件  |  {unique} 种","已知 RAP：{rap}  |  {copies} 件  |  {unique} 種","RAP diketahui: {rap}  |  {copies} salinan  |  {unique} unik","確認済みRAP：{rap} | 個数：{copies} | 種類：{unique}","RAP ที่ทราบ: {rap} | จำนวน {copies} ชิ้น | {unique} ประเภท","확인된 RAP: {rap} | {copies}개 | 고유 아이템 {unique}종"],
    ["Limited inventory unavailable.","限量物品库存不可用。","限量物品庫存無法使用。","Inventaris item terbatas tidak tersedia.","限定アイテムのインベントリを取得できません。","ไม่สามารถเข้าถึงช่องเก็บไอเท็มลิมิเต็ดได้","한정판 인벤토리를 사용할 수 없습니다."],
    ["Total RAP uses Roblox recent average prices, not Rolimon's Value. Limited bundles may not appear in this list.","总 RAP 使用 Roblox 的近期平均价格计算，并非 Rolimon's 的估值。部分限量套装可能不会出现在此列表中。","總 RAP 使用 Roblox 的近期平均價格計算，並非 Rolimon's 的估值。部分限量組合可能不會出現在此清單中。","Total RAP menggunakan harga rata-rata terbaru Roblox, bukan Value dari Rolimon's. Bundel terbatas mungkin tidak muncul dalam daftar ini.","合計RAPはRobloxの最近の平均取引価格を使用し、Rolimon'sのValueではありません。限定バンドルはこの一覧に表示されない場合があります。","RAP รวมใช้ราคาขายเฉลี่ยล่าสุดของ Roblox ไม่ใช่ค่า Value ของ Rolimon's บันเดิลลิมิเต็ดอาจไม่ปรากฏในรายการนี้","총 RAP는 Rolimon's의 Value가 아닌 Roblox의 최근 평균 가격을 사용합니다. 한정판 번들은 이 목록에 표시되지 않을 수 있습니다."],
    ["No Limited assets found in this inventory.","此库存中没有限量物品。","此庫存中沒有限量物品。","Tidak ada aset terbatas dalam inventaris ini.","このインベントリに限定アセットは見つかりませんでした。","ไม่พบแอสเซ็ตลิมิเต็ดในช่องเก็บนี้","이 인벤토리에 한정판 애셋이 없습니다."],
    ["{count} copies have no RAP and are excluded from the total.","{count} 件物品没有 RAP，未计入总额。","{count} 件物品沒有 RAP，未計入總額。","{count} salinan tidak memiliki RAP dan tidak dihitung dalam total.","{count}個のアイテムにはRAPがないため、合計から除外しています。","ไอเท็ม {count} ชิ้นไม่มี RAP จึงไม่นำมารวมยอด","아이템 {count}개는 RAP가 없어 합계에서 제외됩니다."],
    ["This inventory is private or unavailable.","此库存为私密或暂时不可用。","此庫存為私人或暫時無法使用。","Inventaris ini privat atau tidak tersedia.","このインベントリは非公開か、利用できません。","ช่องเก็บไอเท็มนี้เป็นส่วนตัวหรือไม่สามารถเข้าถึงได้","이 인벤토리는 비공개이거나 사용할 수 없습니다."],
    ["Roblox rate limit reached. Try again later.","已达到 Roblox 请求限制，请稍后重试。","已達到 Roblox 請求限制，請稍後重試。","Batas permintaan Roblox tercapai. Coba lagi nanti.","Robloxのリクエスト上限に達しました。後でもう一度お試しください。","ถึงขีดจำกัดคำขอของ Roblox แล้ว โปรดลองอีกครั้งภายหลัง","Roblox 요청 한도에 도달했습니다. 나중에 다시 시도하세요."],
    ["Country","国家 / 地区","國家 / 地區","Negara","国","ประเทศ","국가"],
    ["All countries","所有国家 / 地区","所有國家 / 地區","Semua negara","すべての国","ทุกประเทศ","모든 국가"],
    ["Minimum latency (ms)","最低延迟（毫秒）","最低延遲（毫秒）","Latensi minimum (ms)","最小遅延（ms）","ความหน่วงต่ำสุด (ms)","최소 지연 시간(ms)"],
    ["Maximum ping (ms)","最高延迟（毫秒）","最高延遲（毫秒）","Ping maksimum (ms)","最大Ping（ms）","ค่า Ping สูงสุด (ms)","최대 핑(ms)"],
    ["Minimum players","最少玩家数","最少玩家數","Pemain minimum","最小プレイヤー数","ผู้เล่นขั้นต่ำ","최소 플레이어 수"],
    ["Maximum players","最多玩家数","最多玩家數","Pemain maksimum","最大プレイヤー数","ผู้เล่นสูงสุด","최대 플레이어 수"],
    ["Sort players","玩家数排序","玩家數排序","Urutkan pemain","プレイヤー数の並び順","จัดเรียงจำนวนผู้เล่น","플레이어 수 정렬"],
    ["Default order","默认顺序","預設順序","Urutan bawaan","標準の順序","ลำดับเริ่มต้น","기본 순서"],
    ["Fewest players first","玩家最少优先","玩家最少優先","Pemain paling sedikit dahulu","プレイヤーが少ない順","ผู้เล่นน้อยที่สุดก่อน","플레이어 적은 순"],
    ["Most players first","玩家最多优先","玩家最多優先","Pemain paling banyak dahulu","プレイヤーが多い順","ผู้เล่นมากที่สุดก่อน","플레이어 많은 순"],
    ["Search","搜索","搜尋","Cari","検索","ค้นหา","검색"],
    ["Stop","停止","停止","Hentikan","停止","หยุด","중지"],
    ["Reset","重置","重設","Reset","リセット","รีเซ็ต","초기화"],
    ["Any","不限","不限","Apa saja","指定なし","ทั้งหมด","제한 없음"],
    ["Filter servers by country","按国家 / 地区筛选服务器","依國家 / 地區篩選伺服器","Filter server berdasarkan negara","国でサーバーを絞り込み","กรองเซิร์ฟเวอร์ตามประเทศ","국가별 서버 필터"],
    ["{label} in milliseconds","{label}（毫秒）","{label}（毫秒）","{label} dalam milidetik","{label}（ミリ秒）","{label} หน่วยมิลลิวินาที","{label}(밀리초)"],
    ["Public server pages","公共服务器分页","公開伺服器分頁","Halaman server publik","公開サーバーのページ","หน้าเซิร์ฟเวอร์สาธารณะ","공개 서버 페이지"],
    ["← Previous","← 上一页","← 上一頁","← Sebelumnya","← 前へ","← ก่อนหน้า","← 이전"],
    ["Next →","下一页 →","下一頁 →","Berikutnya →","次へ →","ถัดไป →","다음 →"],
    ["Previous public server page","上一页公共服务器","上一頁公開伺服器","Halaman server publik sebelumnya","前の公開サーバーページ","หน้าเซิร์ฟเวอร์สาธารณะก่อนหน้า","이전 공개 서버 페이지"],
    ["Next public server page","下一页公共服务器","下一頁公開伺服器","Halaman server publik berikutnya","次の公開サーバーページ","หน้าเซิร์ฟเวอร์สาธารณะถัดไป","다음 공개 서버 페이지"],
    ["Loading…","正在加载…","正在載入…","Memuat…","読み込み中…","กำลังโหลด…","불러오는 중…"],
    ["Loading...","正在加载…","正在載入…","Memuat...","読み込み中…","กำลังโหลด…","불러오는 중…"],
    ["Searching…","正在搜索…","正在搜尋…","Mencari…","検索中…","กำลังค้นหา…","검색 중…"],
    ["Search stopped.","搜索已停止。","搜尋已停止。","Pencarian dihentikan.","検索を停止しました。","หยุดค้นหาแล้ว","검색을 중지했습니다."],
    ["No matching servers found.","未找到符合条件的服务器。","找不到符合條件的伺服器。","Tidak ditemukan server yang cocok.","条件に合うサーバーは見つかりませんでした。","ไม่พบเซิร์ฟเวอร์ที่ตรงกัน","일치하는 서버를 찾지 못했습니다."],
    ["No matching servers.","没有符合条件的服务器。","沒有符合條件的伺服器。","Tidak ada server yang cocok.","条件に合うサーバーはありません。","ไม่มีเซิร์ฟเวอร์ที่ตรงกัน","일치하는 서버가 없습니다."],
    ["No servers loaded.","尚未加载服务器。","尚未載入伺服器。","Belum ada server yang dimuat.","サーバーは読み込まれていません。","ยังไม่มีเซิร์ฟเวอร์ที่โหลด","불러온 서버가 없습니다."],
    ["Minimum players cannot exceed maximum players.","最少玩家数不能大于最多玩家数。","最少玩家數不能大於最多玩家數。","Jumlah pemain minimum tidak boleh melebihi maksimum.","最小プレイヤー数は最大プレイヤー数以下にしてください。","จำนวนผู้เล่นขั้นต่ำต้องไม่เกินจำนวนผู้เล่นสูงสุด","최소 플레이어 수는 최대 플레이어 수보다 클 수 없습니다."],
    ["Minimum latency cannot exceed maximum ping.","最低延迟不能大于最高延迟。","最低延遲不能大於最高延遲。","Latensi minimum tidak boleh melebihi ping maksimum.","最小遅延は最大Ping以下にしてください。","ความหน่วงต่ำสุดต้องไม่เกินค่า Ping สูงสุด","최소 지연 시간은 최대 핑보다 클 수 없습니다."],
    ["{start}–{end} of {count} matches loaded","已加载 {count} 个匹配结果，显示 {start}–{end}","已載入 {count} 個符合結果，顯示 {start}–{end}","{start}–{end} dari {count} hasil yang cocok dimuat","{count}件中{start}～{end}件を読み込み済み","โหลดรายการที่ตรงกัน {start}–{end} จาก {count} รายการแล้ว","일치하는 결과 {count}개 중 {start}–{end}개 불러옴"],
    ["Private server","私人服务器","私人伺服器","Server privat","プライベートサーバー","เซิร์ฟเวอร์ส่วนตัว","비공개 서버"],
    ["No players online","暂无在线玩家","暫無線上玩家","Tidak ada pemain online","オンラインのプレイヤーはいません","ไม่มีผู้เล่นออนไลน์","접속 중인 플레이어 없음"],
    ["{count} players online","{count} 位玩家在线","{count} 位玩家在線上","{count} pemain online","{count}人がオンライン","ผู้เล่นออนไลน์ {count} คน","플레이어 {count}명 접속 중"],
    ["Player","玩家","玩家","Pemain","プレイヤー","ผู้เล่น","플레이어"],
    ["Unknown country","未知国家 / 地区","未知國家 / 地區","Negara tidak diketahui","不明な国","ไม่ทราบประเทศ","알 수 없는 국가"],
    ["Detecting country…","正在检测地区…","正在偵測地區…","Mendeteksi negara…","国を検出中…","กำลังตรวจหาประเทศ…","국가 확인 중…"],
    ["Ping reported by Roblox; your connection may differ.","延迟由 Roblox 提供，您的实际连接可能不同。","延遲由 Roblox 提供，您的實際連線可能不同。","Ping dilaporkan oleh Roblox; koneksi Anda mungkin berbeda.","Robloxが報告するPingです。実際の接続とは異なる場合があります。","ค่า Ping ที่ Roblox รายงาน การเชื่อมต่อของคุณอาจแตกต่างกัน","Roblox에서 보고한 핑입니다. 실제 연결 상태는 다를 수 있습니다."],
    ["Detecting the server country automatically.","正在自动检测服务器所在国家 / 地区。","正在自動偵測伺服器所在國家 / 地區。","Mendeteksi negara server secara otomatis.","サーバーの国を自動検出しています。","กำลังตรวจหาประเทศของเซิร์ฟเวอร์อัตโนมัติ","서버 국가를 자동으로 확인합니다."],
    ["Collapse","收起","收合","Ciutkan","折りたたむ","ย่อ","접기"],
    ["Expand","展开","展開","Perluas","展開","ขยาย","펼치기"],
    ["Reload posts","重新加载帖子","重新載入貼文","Muat ulang postingan","投稿を再読み込み","โหลดโพสต์ใหม่","게시물 다시 불러오기"],
    ["Reload videos","重新加载视频","重新載入影片","Muat ulang video","動画を再読み込み","โหลดวิดีโอใหม่","동영상 다시 불러오기"],
    ["Loading recent posts via FxEmbed...","正在通过 FxEmbed 加载最新帖子…","正在透過 FxEmbed 載入最新貼文…","Memuat postingan terbaru melalui FxEmbed...","FxEmbed経由で最新の投稿を読み込み中…","กำลังโหลดโพสต์ล่าสุดผ่าน FxEmbed…","FxEmbed를 통해 최근 게시물 불러오는 중…"],
    ["Posts unavailable right now. Try again later or open X.","暂时无法加载帖子，请稍后重试或打开 X。","暫時無法載入貼文，請稍後重試或開啟 X。","Postingan belum tersedia. Coba lagi nanti atau buka X.","現在、投稿を取得できません。後でもう一度お試しになるか、Xを開いてください。","ขณะนี้ไม่สามารถโหลดโพสต์ได้ โปรดลองภายหลังหรือเปิด X","지금은 게시물을 사용할 수 없습니다. 나중에 다시 시도하거나 X를 여세요."],
    ["View post on X","在 X 查看帖子","在 X 查看貼文","Lihat postingan di X","Xで投稿を見る","ดูโพสต์บน X","X에서 게시물 보기"],
    ["Loading image...","正在加载图片…","正在載入圖片…","Memuat gambar...","画像を読み込み中…","กำลังโหลดภาพ…","이미지 불러오는 중…"],
    ["Image unavailable","图片不可用","圖片無法使用","Gambar tidak tersedia","画像を利用できません","ไม่สามารถแสดงภาพได้","이미지 사용 불가"],
    ["Loading recent videos from YouTube...","正在加载 YouTube 最新视频…","正在載入 YouTube 最新影片…","Memuat video terbaru dari YouTube...","YouTubeの最新動画を読み込み中…","กำลังโหลดวิดีโอล่าสุดจาก YouTube…","YouTube에서 최근 동영상 불러오는 중…"],
    ["Videos unavailable right now. Try again later or open YouTube.","暂时无法加载视频，请稍后重试或打开 YouTube。","暫時無法載入影片，請稍後重試或開啟 YouTube。","Video belum tersedia. Coba lagi nanti atau buka YouTube.","現在、動画を取得できません。後でもう一度お試しになるか、YouTubeを開いてください。","ขณะนี้ไม่สามารถโหลดวิดีโอได้ โปรดลองภายหลังหรือเปิด YouTube","지금은 동영상을 사용할 수 없습니다. 나중에 다시 시도하거나 YouTube를 여세요."],
    ["Latest on YouTube","YouTube 最新视频","YouTube 最新影片","Terbaru di YouTube","YouTubeの最新動画","ล่าสุดบน YouTube","YouTube 최신 동영상"],
    ["Latest on YouTube - {name}","YouTube 最新视频 - {name}","YouTube 最新影片 - {name}","Terbaru di YouTube - {name}","YouTubeの最新動画 - {name}","ล่าสุดบน YouTube - {name}","YouTube 최신 동영상 - {name}"],
    ["Latest on X - @{name}","X 最新帖子 - @{name}","X 最新貼文 - @{name}","Terbaru di X - @{name}","Xの最新投稿 - @{name}","ล่าสุดบน X - @{name}","X 최신 게시물 - @{name}"],
    ["Open @{name} on X","在 X 打开 @{name}","在 X 開啟 @{name}","Buka @{name} di X","Xで@{name}を開く","เปิด @{name} บน X","X에서 @{name} 열기"],
    ["Open channel on YouTube","在 YouTube 打开频道","在 YouTube 開啟頻道","Buka channel di YouTube","YouTubeでチャンネルを開く","เปิดช่องบน YouTube","YouTube에서 채널 열기"],
    ["Loading thumbnail...","正在加载缩略图…","正在載入縮圖…","Memuat thumbnail...","サムネイルを読み込み中…","กำลังโหลดภาพขนาดย่อ…","썸네일 불러오는 중…"],
    ["Thumbnail unavailable","缩略图不可用","縮圖無法使用","Thumbnail tidak tersedia","サムネイルを利用できません","ไม่สามารถแสดงภาพขนาดย่อได้","썸네일 사용 불가"],
    ["Watch video on YouTube","在 YouTube 观看视频","在 YouTube 觀看影片","Tonton video di YouTube","YouTubeで動画を見る","ดูวิดีโอบน YouTube","YouTube에서 동영상 보기"],
    ["Recent videos from YouTube.","来自 YouTube 的最新视频。","來自 YouTube 的最新影片。","Video terbaru dari YouTube.","YouTubeの最近の動画。","วิดีโอล่าสุดจาก YouTube","YouTube의 최근 동영상입니다."],
    ["No public videos available.","暂无公开视频。","暫無公開影片。","Tidak ada video publik yang tersedia.","公開動画はありません。","ไม่มีวิดีโอสาธารณะ","공개 동영상이 없습니다."],
    ["Game Data","游戏数据","遊戲資料","Data Game","ゲームデータ","ข้อมูลเกม","게임 데이터"],
    ["Game data","游戏数据","遊戲資料","Data game","ゲームデータ","ข้อมูลเกม","게임 데이터"],
    ["Open game data menu","打开游戏数据菜单","開啟遊戲資料選單","Buka menu data game","ゲームデータメニューを開く","เปิดเมนูข้อมูลเกม","게임 데이터 메뉴 열기"],
    ["Close game data menu","关闭游戏数据菜单","關閉遊戲資料選單","Tutup menu data game","ゲームデータメニューを閉じる","ปิดเมนูข้อมูลเกม","게임 데이터 메뉴 닫기"],
    ["Open on Rolimons","在 Rolimons 打开","在 Rolimons 開啟","Buka di Rolimons","Rolimonsで開く","เปิดบน Rolimons","Rolimons에서 열기"],
    ["Overview","概览","總覽","Ringkasan","概要","ภาพรวม","개요"],
    ["Players","玩家","玩家","Pemain","プレイヤー","ผู้เล่น","플레이어"],
    ["Visits","访问次数","造訪次數","Kunjungan","訪問数","จำนวนการเข้าชม","방문 수"],
    ["Rating","评分","評分","Penilaian","評価","คะแนน","평점"],
    ["Upvotes","赞","讚","Suara positif","高評価","ถูกใจ","좋아요"],
    ["Downvotes","踩","倒讚","Suara negatif","低評価","ไม่ถูกใจ","싫어요"],
    ["Average Playtime","平均游玩时长","平均遊玩時間","Rata-rata Waktu Bermain","平均プレイ時間","เวลาเล่นเฉลี่ย","평균 플레이 시간"],
    ["Game Updated","游戏更新日期","遊戲更新日期","Game Diperbarui","ゲームの更新日","อัปเดตเกมล่าสุด","게임 업데이트"],
    ["All-Time","历史最高","歷史最高","Sepanjang Waktu","全期間","ตลอดเวลา","전체 기간"],
    ["Current Game Stats","当前游戏统计","目前遊戲統計","Statistik Game Saat Ini","現在のゲーム統計","สถิติเกมปัจจุบัน","현재 게임 통계"],
    ["Past 30 Days","过去 30 天","過去 30 天","30 Hari Terakhir","過去30日間","30 วันที่ผ่านมา","지난 30일"],
    ["Past 7 Days","过去 7 天","過去 7 天","7 Hari Terakhir","過去7日間","7 วันที่ผ่านมา","지난 7일"],
    ["Past 24 Hours","过去 24 小时","過去 24 小時","24 Jam Terakhir","過去24時間","24 ชั่วโมงที่ผ่านมา","지난 24시간"],
    ["Servers","服务器","伺服器","Server","サーバー","เซิร์ฟเวอร์","서버"],
    ["Places","场景","場景","Tempat","プレース","สถานที่","장소"],
    ["Passes","通行证","通行證","Pass","パス","พาส","패스"],
    ["Products","商品","商品","Produk","商品","ผลิตภัณฑ์","상품"],
    ["Server Statistics","服务器统计","伺服器統計","Statistik Server","サーバーの統計","สถิติเซิร์ฟเวอร์","서버 통계"],
    ["Current Roblox Stats","Roblox 当前统计","Roblox 目前統計","Statistik Roblox Saat Ini","現在のRoblox統計","สถิติ Roblox ปัจจุบัน","현재 Roblox 통계"],
    ["Live Public Roblox Servers","Roblox 实时公共服务器","Roblox 即時公開伺服器","Server Publik Roblox Aktif","稼働中の公開Robloxサーバー","เซิร์ฟเวอร์สาธารณะของ Roblox ที่กำลังทำงาน","현재 공개 Roblox 서버"],
    ["Open Roblox server browser","打开 Roblox 服务器列表","開啟 Roblox 伺服器清單","Buka daftar server Roblox","Robloxのサーバー一覧を開く","เปิดรายการเซิร์ฟเวอร์ Roblox","Roblox 서버 목록 열기"],
    ["Load More Servers","加载更多服务器","載入更多伺服器","Muat Server Lainnya","サーバーをさらに読み込む","โหลดเซิร์ฟเวอร์เพิ่มเติม","서버 더 불러오기"],
    ["Load More Badges","加载更多徽章","載入更多徽章","Muat Lencana Lainnya","バッジをさらに読み込む","โหลดเหรียญตราเพิ่มเติม","배지 더 불러오기"],
    ["Load More Places","加载更多场景","載入更多場景","Muat Tempat Lainnya","プレースをさらに読み込む","โหลดสถานที่เพิ่มเติม","장소 더 불러오기"],
    ["Loading data from Rolimons…","正在从 Rolimons 加载数据…","正在從 Rolimons 載入資料…","Memuat data dari Rolimons…","Rolimonsからデータを読み込み中…","กำลังโหลดข้อมูลจาก Rolimons…","Rolimons에서 데이터 불러오는 중…"],
    ["Loading data from Roblox…","正在从 Roblox 加载数据…","正在從 Roblox 載入資料…","Memuat data dari Roblox…","Robloxからデータを読み込み中…","กำลังโหลดข้อมูลจาก Roblox…","Roblox에서 데이터 불러오는 중…"],
    ["Rolimons data could not be read.","无法读取 Rolimons 数据。","無法讀取 Rolimons 資料。","Data Rolimons tidak dapat dibaca.","Rolimonsのデータを読み取れませんでした。","ไม่สามารถอ่านข้อมูล Rolimons ได้","Rolimons 데이터를 읽을 수 없습니다."],
    ["Rolimons data could not be loaded. Try opening the original page.","无法加载 Rolimons 数据，请尝试打开原始页面。","無法載入 Rolimons 資料，請嘗試開啟原始頁面。","Data Rolimons tidak dapat dimuat. Coba buka halaman aslinya.","Rolimonsのデータを読み込めませんでした。元のページを開いてみてください。","ไม่สามารถโหลดข้อมูล Rolimons ได้ โปรดลองเปิดหน้าต้นฉบับ","Rolimons 데이터를 불러올 수 없습니다. 원본 페이지를 열어 보세요."],
    ["Roblox data could not be loaded.","无法加载 Roblox 数据。","無法載入 Roblox 資料。","Data Roblox tidak dapat dimuat.","Robloxのデータを読み込めませんでした。","ไม่สามารถโหลดข้อมูล Roblox ได้","Roblox 데이터를 불러올 수 없습니다."],
    ["No data is available for this section.","此分区暂无数据。","此區塊暫無資料。","Tidak ada data yang tersedia untuk bagian ini.","このセクションのデータはありません。","ไม่มีข้อมูลสำหรับส่วนนี้","이 섹션에 사용 가능한 데이터가 없습니다."],
    ["No server statistics are available for this game.","此游戏暂无服务器统计。","此遊戲暫無伺服器統計。","Tidak ada statistik server yang tersedia untuk game ini.","このゲームのサーバー統計はありません。","ไม่มีสถิติเซิร์ฟเวอร์สำหรับเกมนี้","이 게임의 서버 통계가 없습니다."],
    ["These current totals come directly from Roblox. Roblox does not provide public historical chart points here.","这些当前统计直接来自 Roblox。Roblox 不在此提供公开的历史图表数据。","這些目前統計直接來自 Roblox。Roblox 不在此提供公開的歷史圖表資料。","Total saat ini berasal langsung dari Roblox. Roblox tidak menyediakan data grafik historis publik di sini.","この合計値はRobloxから直接取得しています。Robloxはここで公開の過去チャートデータを提供していません。","ยอดปัจจุบันเหล่านี้มาจาก Roblox โดยตรง Roblox ไม่มีจุดข้อมูลกราฟย้อนหลังแบบสาธารณะให้ที่นี่","현재 합계는 Roblox에서 직접 제공됩니다. Roblox는 여기에서 과거 차트 데이터를 공개하지 않습니다."],
    ["This list is provided by Roblox and shows current player counts. Use Roblox’s Servers tab to join an instance.","此列表由 Roblox 提供，显示当前玩家数。请使用 Roblox 的服务器选项卡加入服务器。","此清單由 Roblox 提供，顯示目前玩家數。請使用 Roblox 的伺服器分頁加入伺服器。","Daftar ini disediakan oleh Roblox dan menampilkan jumlah pemain saat ini. Gunakan tab Server Roblox untuk bergabung ke server.","この一覧はRobloxが提供する現在のプレイヤー数です。参加するにはRobloxの「サーバー」タブを使用してください。","รายการนี้มาจาก Roblox และแสดงจำนวนผู้เล่นปัจจุบัน ใช้แท็บเซิร์ฟเวอร์ของ Roblox เพื่อเข้าร่วม","Roblox에서 제공하는 목록으로 현재 플레이어 수를 표시합니다. 서버에 참가하려면 Roblox의 서버 탭을 사용하세요."],
    ["Rolimons’ public game page provides current totals and peak counts. Its interactive time-series charts are available on the original analytics page.","Rolimons 的公开游戏页面提供当前统计与峰值。交互式历史图表可在原始分析页面查看。","Rolimons 的公開遊戲頁面提供目前統計與峰值。互動式歷史圖表可在原始分析頁面查看。","Halaman game publik Rolimons menyediakan total saat ini dan jumlah tertinggi. Grafik interaktif berdasarkan waktu tersedia di halaman analisis aslinya.","Rolimonsの公開ゲームページには、現在の合計値と最大値が掲載されています。操作可能な時系列チャートは元の分析ページで利用できます。","หน้าเกมสาธารณะของ Rolimons แสดงยอดปัจจุบันและยอดสูงสุด สามารถดูกราฟตามช่วงเวลาแบบโต้ตอบได้บนหน้าวิเคราะห์ต้นฉบับ","Rolimons 공개 게임 페이지는 현재 합계와 최고 수치를 제공합니다. 시간에 따른 대화형 차트는 원본 분석 페이지에서 볼 수 있습니다."],
    ["Request timed out. Please try again.","请求超时，请重试。","請求逾時，請重試。","Permintaan kehabisan waktu. Coba lagi.","リクエストがタイムアウトしました。もう一度お試しください。","คำขอหมดเวลา โปรดลองอีกครั้ง","요청 시간이 초과되었습니다. 다시 시도하세요."],
    ["Extension request unavailable.","扩展请求暂时不可用。","擴充功能請求暫時無法使用。","Permintaan ekstensi tidak tersedia.","拡張機能にリクエストできません。","ไม่สามารถส่งคำขอไปยังส่วนขยายได้","확장 프로그램 요청을 사용할 수 없습니다."],
    ["No response from the extension.","扩展未响应。","擴充功能未回應。","Tidak ada respons dari ekstensi.","拡張機能から応答がありません。","ไม่มีการตอบกลับจากส่วนขยาย","확장 프로그램에서 응답이 없습니다."],
    ["Verification","认证状态","驗證狀態","Verifikasi","認証","การยืนยัน","인증"],
    ["None listed","暂无","暫無","Tidak ada yang tercantum","記載なし","ไม่มีในรายการ","등록된 항목 없음"],
    ["Account details","账号详情","帳號詳細資料","Detail akun","アカウントの詳細","รายละเอียดบัญชี","계정 정보"],
    ["Unavailable","不可用","無法使用","Tidak tersedia","利用できません","ไม่พร้อมใช้งาน","사용 불가"],
    ["View friends","查看好友","查看好友","Lihat teman","フレンドを見る","ดูเพื่อน","친구 보기"],
    ["View inventory","查看库存","查看庫存","Lihat inventaris","インベントリを見る","ดูช่องเก็บไอเท็ม","인벤토리 보기"],
    ["{count} years","{count} 年","{count} 年","{count} tahun","{count}年","{count} ปี","{count}년"],
    ["{count} days","{count} 天","{count} 天","{count} hari","{count}日","{count} วัน","{count}일"],
    ["Could not reload the 3D preview. Try Refresh.","无法重新加载 3D 预览，请尝试刷新。","無法重新載入 3D 預覽，請嘗試重新整理。","Tidak dapat memuat ulang pratinjau 3D. Coba Muat ulang.","3Dプレビューを再読み込みできませんでした。「更新」をお試しください。","ไม่สามารถโหลดตัวอย่าง 3D ใหม่ได้ โปรดลองรีเฟรช","3D 미리 보기를 다시 불러올 수 없습니다. 새로 고침을 눌러 보세요."],
    ["Could not display the 2D preview. Try Refresh.","无法显示 2D 预览，请尝试刷新。","無法顯示 2D 預覽，請嘗試重新整理。","Tidak dapat menampilkan pratinjau 2D. Coba Muat ulang.","2Dプレビューを表示できませんでした。「更新」をお試しください。","ไม่สามารถแสดงตัวอย่าง 2D ได้ โปรดลองรีเฟรช","2D 미리 보기를 표시할 수 없습니다. 새로 고침을 눌러 보세요."],
    ["2D preview unavailable. Reload the page and try again.","2D 预览不可用，请刷新页面后重试。","2D 預覽無法使用，請重新整理頁面後重試。","Pratinjau 2D tidak tersedia. Muat ulang halaman dan coba lagi.","2Dプレビューを利用できません。ページを再読み込みしてからお試しください。","ไม่สามารถใช้ตัวอย่าง 2D ได้ โหลดหน้าใหม่แล้วลองอีกครั้ง","2D 미리 보기를 사용할 수 없습니다. 페이지를 새로 고친 후 다시 시도하세요."],
    ["Your current avatar in 2D","您当前头像的 2D 预览","您目前虛擬人偶的 2D 預覽","Avatar Anda saat ini dalam 2D","現在のアバターの2D表示","อวาตาร์ปัจจุบันของคุณในรูปแบบ 2D","내 아바타의 2D 모습"],
    ["Reload the 3D model","重新加载 3D 模型","重新載入 3D 模型","Muat ulang model 3D","3Dモデルを再読み込み","โหลดโมเดล 3D ใหม่","3D 모델 다시 불러오기"],
    ["Waiting for Roblox to update the 2D image...","正在等待 Roblox 更新 2D 图片…","正在等待 Roblox 更新 2D 圖片…","Menunggu Roblox memperbarui gambar 2D...","Robloxによる2D画像の更新を待機中…","กำลังรอ Roblox อัปเดตภาพ 2D…","Roblox에서 2D 이미지를 업데이트하기를 기다리는 중…"],
    ["Roblox is still updating the 2D image. Use Refresh to check again.","Roblox 仍在更新 2D 图片，请点击“刷新”再次检查。","Roblox 仍在更新 2D 圖片，請點擊「重新整理」再次檢查。","Roblox masih memperbarui gambar 2D. Gunakan Muat ulang untuk memeriksa lagi.","Robloxが2D画像を更新しています。「更新」で再確認してください。","Roblox ยังอัปเดตภาพ 2D อยู่ กดรีเฟรชเพื่อตรวจสอบอีกครั้ง","Roblox에서 아직 2D 이미지를 업데이트하고 있습니다. 새로 고침을 눌러 다시 확인하세요."],
    ["Unknown","未知","未知","Tidak diketahui","不明","ไม่ทราบ","알 수 없음"],
    ["Minimum latency in milliseconds","最低延迟（毫秒）","最低延遲（毫秒）","Latensi minimum dalam milidetik","最小遅延（ミリ秒）","ความหน่วงต่ำสุด หน่วยมิลลิวินาที","최소 지연 시간(밀리초)"],
    ["Maximum ping in milliseconds","最高延迟（毫秒）","最高延遲（毫秒）","Ping maksimum dalam milidetik","最大Ping（ミリ秒）","ค่า Ping สูงสุด หน่วยมิลลิวินาที","최대 핑(밀리초)"],
    ["Searching...","正在搜索…","正在搜尋…","Mencari...","検索中…","กำลังค้นหา…","검색 중…"],
    ["Searching public servers...","正在搜索公共服务器…","正在搜尋公開伺服器…","Mencari server publik...","公開サーバーを検索中…","กำลังค้นหาเซิร์ฟเวอร์สาธารณะ…","공개 서버 검색 중…"],
    ["Could not sort the servers. Try Search again.","无法排序服务器，请再次搜索。","無法排序伺服器，請再次搜尋。","Tidak dapat mengurutkan server. Coba Cari lagi.","サーバーを並べ替えられませんでした。もう一度検索してください。","ไม่สามารถจัดเรียงเซิร์ฟเวอร์ได้ โปรดค้นหาอีกครั้ง","서버를 정렬할 수 없습니다. 다시 검색해 보세요."],
    ["Some server details are still loading. Try Search again.","部分服务器详情仍在加载，请再次搜索。","部分伺服器詳細資料仍在載入，請再次搜尋。","Beberapa detail server masih dimuat. Coba Cari lagi.","一部のサーバー詳細を読み込み中です。もう一度検索してください。","รายละเอียดเซิร์ฟเวอร์บางส่วนยังโหลดอยู่ โปรดค้นหาอีกครั้ง","일부 서버 정보를 아직 불러오는 중입니다. 다시 검색해 보세요."],
    ["No public servers match all your filters.","没有满足全部筛选条件的公共服务器。","沒有符合全部篩選條件的公開伺服器。","Tidak ada server publik yang cocok dengan semua filter Anda.","すべての条件に合う公開サーバーはありません。","ไม่มีเซิร์ฟเวอร์สาธารณะที่ตรงกับตัวกรองทั้งหมด","모든 필터 조건과 일치하는 공개 서버가 없습니다."],
    ["Roblox is still loading. Try Search again.","Roblox 仍在加载，请再次搜索。","Roblox 仍在載入，請再次搜尋。","Roblox masih memuat. Coba Cari lagi.","Robloxはまだ読み込み中です。もう一度検索してください。","Roblox ยังโหลดอยู่ โปรดค้นหาอีกครั้ง","Roblox를 아직 불러오는 중입니다. 다시 검색해 보세요."],
    ["Could not load more servers. Try Search again.","无法加载更多服务器，请再次搜索。","無法載入更多伺服器，請再次搜尋。","Tidak dapat memuat server lainnya. Coba Cari lagi.","追加のサーバーを読み込めませんでした。もう一度検索してください。","ไม่สามารถโหลดเซิร์ฟเวอร์เพิ่มเติมได้ โปรดค้นหาอีกครั้ง","서버를 더 불러올 수 없습니다. 다시 검색해 보세요."],
    ["Could not complete the search. Try Search again.","无法完成搜索，请再次尝试。","無法完成搜尋，請再次嘗試。","Tidak dapat menyelesaikan pencarian. Coba Cari lagi.","検索を完了できませんでした。もう一度検索してください。","ไม่สามารถค้นหาให้เสร็จได้ โปรดค้นหาอีกครั้ง","검색을 완료할 수 없습니다. 다시 검색해 보세요."],
    ["Roblox is loading servers. Try Next again in a moment.","Roblox 正在加载服务器，请稍后再次点击“下一页”。","Roblox 正在載入伺服器，請稍後再次點擊「下一頁」。","Roblox sedang memuat server. Coba Berikutnya lagi sesaat lagi.","Robloxがサーバーを読み込んでいます。少し待ってから「次へ」をお試しください。","Roblox กำลังโหลดเซิร์ฟเวอร์ รอสักครู่แล้วกดถัดไปอีกครั้ง","Roblox에서 서버를 불러오는 중입니다. 잠시 후 다음을 다시 누르세요."],
    ["Could not load more servers. Try Next again.","无法加载更多服务器，请再次点击“下一页”。","無法載入更多伺服器，請再次點擊「下一頁」。","Tidak dapat memuat server lainnya. Coba Berikutnya lagi.","追加のサーバーを読み込めませんでした。もう一度「次へ」をお試しください。","ไม่สามารถโหลดเซิร์ฟเวอร์เพิ่มเติมได้ โปรดกดถัดไปอีกครั้ง","서버를 더 불러올 수 없습니다. 다음을 다시 누르세요."],
    ["No matching servers in these batches. Select Next to keep searching.","这几批服务器中没有匹配结果，请点击“下一页”继续搜索。","這幾批伺服器中沒有符合結果，請點擊「下一頁」繼續搜尋。","Tidak ada server yang cocok dalam kumpulan ini. Pilih Berikutnya untuk melanjutkan pencarian.","今回の読み込み分に一致するサーバーはありません。「次へ」で検索を続けてください。","ไม่มีเซิร์ฟเวอร์ที่ตรงกันในชุดนี้ เลือกถัดไปเพื่อค้นหาต่อ","불러온 서버 중 일치하는 항목이 없습니다. 다음을 눌러 계속 검색하세요."],
    ["No more servers match these filters.","没有更多符合条件的服务器。","沒有更多符合條件的伺服器。","Tidak ada lagi server yang cocok dengan filter ini.","これ以上、条件に合うサーバーはありません。","ไม่มีเซิร์ฟเวอร์ที่ตรงกับตัวกรองเพิ่มเติมแล้ว","이 필터와 일치하는 서버가 더 이상 없습니다."],
    ["No servers match these filters.","没有符合这些条件的服务器。","沒有符合這些條件的伺服器。","Tidak ada server yang cocok dengan filter ini.","この条件に合うサーバーはありません。","ไม่มีเซิร์ฟเวอร์ที่ตรงกับตัวกรองเหล่านี้","이 필터와 일치하는 서버가 없습니다."],
    ["Found {count} matching server.","找到 {count} 个符合条件的服务器。","找到 {count} 個符合條件的伺服器。","Ditemukan {count} server yang cocok.","条件に合うサーバーが{count}件見つかりました。","พบเซิร์ฟเวอร์ที่ตรงกัน {count} เซิร์ฟเวอร์","일치하는 서버 {count}개를 찾았습니다."],
    ["Found {count} matching servers.","找到 {count} 个符合条件的服务器。","找到 {count} 個符合條件的伺服器。","Ditemukan {count} server yang cocok.","条件に合うサーバーが{count}件見つかりました。","พบเซิร์ฟเวอร์ที่ตรงกัน {count} เซิร์ฟเวอร์","일치하는 서버 {count}개를 찾았습니다."],
    ["Checking country and ping for {count} loaded servers...","正在检查已加载的 {count} 个服务器的地区和延迟…","正在檢查已載入的 {count} 個伺服器的地區與延遲…","Memeriksa negara dan ping untuk {count} server yang dimuat...","読み込み済みサーバー{count}件の国とPingを確認中…","กำลังตรวจสอบประเทศและ Ping ของเซิร์ฟเวอร์ที่โหลดแล้ว {count} เซิร์ฟเวอร์…","불러온 서버 {count}개의 국가와 핑 확인 중…"],
    ["Searching beyond {count} loaded public servers...","正在继续搜索已加载的 {count} 个公共服务器之后的结果…","正在繼續搜尋已載入的 {count} 個公開伺服器之後的結果…","Mencari di luar {count} server publik yang telah dimuat...","読み込み済みの公開サーバー{count}件より先を検索中…","กำลังค้นหาต่อจากเซิร์ฟเวอร์สาธารณะที่โหลดแล้ว {count} เซิร์ฟเวอร์…","불러온 공개 서버 {count}개를 넘어 추가 검색 중…"],
    ["0 matches in {count} loaded servers","已加载 {count} 个服务器，暂无匹配结果","已載入 {count} 個伺服器，暫無符合結果","0 hasil yang cocok dalam {count} server yang dimuat","読み込み済みサーバー{count}件中、一致は0件","ไม่พบรายการที่ตรงกันในเซิร์ฟเวอร์ที่โหลดแล้ว {count} เซิร์ฟเวอร์","불러온 서버 {count}개 중 일치하는 항목 0개"],
    ["Page {count}","第 {count} 页","第 {count} 頁","Halaman {count}","ページ{count}","หน้า {count}","{count}페이지"],
    ["No matches","暂无匹配结果","暫無符合結果","Tidak ada hasil yang cocok","一致なし","ไม่พบรายการที่ตรงกัน","일치하는 항목 없음"],
    ["Low latency · {value} ms","低延迟 · {value} 毫秒","低延遲 · {value} 毫秒","Latensi rendah · {value} ms","低遅延 · {value} ms","ความหน่วงต่ำ · {value} ms","낮은 지연 시간 · {value} ms"],
    ["Moderate latency · {value} ms","中等延迟 · {value} 毫秒","中等延遲 · {value} 毫秒","Latensi sedang · {value} ms","中程度の遅延 · {value} ms","ความหน่วงปานกลาง · {value} ms","보통 지연 시간 · {value} ms"],
    ["High latency · {value} ms","高延迟 · {value} 毫秒","高延遲 · {value} 毫秒","Latensi tinggi · {value} ms","高遅延 · {value} ms","ความหน่วงสูง · {value} ms","높은 지연 시간 · {value} ms"],
    ["Country {name}","国家 / 地区：{name}","國家 / 地區：{name}","Negara {name}","国：{name}","ประเทศ {name}","국가: {name}"],
    ["Approx. country {name}","估算地区：{name}","估算地區：{name}","Perkiraan negara {name}","推定国：{name}","ประเทศโดยประมาณ {name}","추정 국가: {name}"],
    ["Finding country...","正在检测地区…","正在偵測地區…","Mendeteksi negara...","国を確認中…","กำลังค้นหาประเทศ…","국가 확인 중…"],
    ["Estimated from the server address; Roblox routing may differ.","根据服务器地址估算，Roblox 的实际路由可能不同。","根據伺服器位址估算，Roblox 的實際路由可能不同。","Diperkirakan dari alamat server; perutean Roblox mungkin berbeda.","サーバーのアドレスからの推定です。Robloxの経路とは異なる場合があります。","ประมาณจากที่อยู่เซิร์ฟเวอร์ เส้นทางเครือข่ายของ Roblox อาจแตกต่างกัน","서버 주소를 바탕으로 한 추정치입니다. Roblox의 라우팅은 다를 수 있습니다."],
    ["Show More ({count} remaining)","显示更多（剩余 {count}）","顯示更多（剩餘 {count}）","Tampilkan Lainnya (tersisa {count})","もっと表示（残り{count}件）","แสดงเพิ่มเติม (เหลือ {count})","더 보기({count}개 남음)"],
    ["{count} of {max} people max","{count} / {max} 人","{count} / {max} 人","{count} dari maksimum {max} orang","最大{max}人中{count}人","{count} จากสูงสุด {max} คน","최대 {max}명 중 {count}명"],
    ["Private server details are unavailable. Retrying...","无法获取私人服务器详情，正在重试…","無法取得私人伺服器詳細資料，正在重試…","Detail server privat tidak tersedia. Mencoba lagi...","プライベートサーバーの詳細を取得できません。再試行中…","ยังรับรายละเอียดเซิร์ฟเวอร์ส่วนตัวไม่ได้ กำลังลองอีกครั้ง…","비공개 서버 정보를 사용할 수 없습니다. 다시 시도하는 중…"],
    ["Loading private server details...","正在加载私人服务器详情…","正在載入私人伺服器詳細資料…","Memuat detail server privat...","プライベートサーバーの詳細を読み込み中…","กำลังโหลดรายละเอียดเซิร์ฟเวอร์ส่วนตัว…","비공개 서버 정보 불러오는 중…"],
    ["Preview","预览","預覽","Pratinjau","プレビュー","ตัวอย่าง","미리 보기"],
    ["Recent posts via FxEmbed.","通过 FxEmbed 获取的最新帖子。","透過 FxEmbed 取得的最新貼文。","Postingan terbaru melalui FxEmbed.","FxEmbed経由の最近の投稿。","โพสต์ล่าสุดผ่าน FxEmbed","FxEmbed를 통한 최근 게시물입니다."],
    ["No public posts available.","暂无公开帖子。","暫無公開貼文。","Tidak ada postingan publik yang tersedia.","公開投稿はありません。","ไม่มีโพสต์สาธารณะ","공개 게시물이 없습니다."],
    ["Showing saved posts; live updates are unavailable. Via FxEmbed.","正在显示已保存的帖子，实时更新暂不可用。内容来自 FxEmbed。","正在顯示已儲存的貼文，即時更新暫時無法使用。內容來自 FxEmbed。","Menampilkan postingan tersimpan; pembaruan langsung tidak tersedia. Melalui FxEmbed.","保存済みの投稿を表示しています。最新情報は取得できません。FxEmbed経由。","แสดงโพสต์ที่บันทึกไว้ ไม่สามารถอัปเดตล่าสุดได้ ผ่าน FxEmbed","저장된 게시물을 표시하고 있습니다. 실시간 업데이트를 사용할 수 없습니다. FxEmbed 제공."],
    ["Latest posts from @{name} on X","来自 @{name} 的 X 最新帖子","來自 @{name} 的 X 最新貼文","Postingan terbaru dari @{name} di X","Xの@{name}による最新投稿","โพสต์ล่าสุดจาก @{name} บน X","X의 @{name} 최신 게시물"],
    ["Latest videos from this game on YouTube","此游戏的 YouTube 最新视频","此遊戲的 YouTube 最新影片","Video terbaru dari game ini di YouTube","このゲームのYouTubeの最新動画","วิดีโอล่าสุดของเกมนี้บน YouTube","이 게임의 YouTube 최신 동영상"],
    ["Latest videos from this profile on YouTube","此用户的 YouTube 最新视频","此使用者的 YouTube 最新影片","Video terbaru dari profil ini di YouTube","このプロフィールのYouTubeの最新動画","วิดีโอล่าสุดของโปรไฟล์นี้บน YouTube","이 프로필의 YouTube 최신 동영상"],
    ["Latest videos from this community on YouTube","此社区的 YouTube 最新视频","此社群的 YouTube 最新影片","Video terbaru dari komunitas ini di YouTube","このコミュニティのYouTubeの最新動画","วิดีโอล่าสุดของชุมชนนี้บน YouTube","이 커뮤니티의 YouTube 최신 동영상"],
    ["Post image {count}","帖子图片 {count}","貼文圖片 {count}","Gambar postingan {count}","投稿画像{count}","ภาพในโพสต์ {count}","게시물 이미지 {count}"],
    ["YouTube video thumbnail","YouTube 视频缩略图","YouTube 影片縮圖","Thumbnail video YouTube","YouTube動画のサムネイル","ภาพขนาดย่อของวิดีโอ YouTube","YouTube 동영상 썸네일"],
    ["Earned {date}","获得日期：{date}","獲得日期：{date}","Diperoleh pada {date}","獲得日：{date}","ได้รับเมื่อ {date}","획득일: {date}"],
    ["Currency estimate unavailable.","暂无货币估值。","暫無貨幣估值。","Perkiraan mata uang tidak tersedia.","通貨換算の目安を取得できません。","ไม่มีข้อมูลมูลค่าเทียบเท่าสกุลเงินโดยประมาณ","통화 추정액을 사용할 수 없습니다."],
    ["Estimated purchase equivalent using a reference price of {value} per 500 Robux. Actual checkout prices may vary.","按每 500 Robux 对应 {value} 的参考价格估算，实际结算价格可能不同。","依每 500 Robux 對應 {value} 的參考價格估算，實際結帳價格可能不同。","Perkiraan nilai pembelian menggunakan harga acuan {value} per 500 Robux. Harga saat pembayaran dapat berbeda.","500 Robuxあたり{value}の参考価格による購入相当額の目安です。実際の決済価格は異なる場合があります。","มูลค่าซื้อเทียบเท่าโดยประมาณจากราคาอ้างอิง {value} ต่อ 500 Robux ราคาที่ชำระจริงอาจแตกต่างกัน","500 Robux당 {value}의 참고 가격으로 계산한 추정 구매 금액입니다. 실제 결제 가격은 다를 수 있습니다."],
    ["Estimated purchase equivalent using 4.99 USD per 500 Robux and exchange rates dated {date}.","按每 500 Robux 对应 4.99 美元和 {date} 的汇率估算。","依每 500 Robux 對應 4.99 美元和 {date} 的匯率估算。","Perkiraan nilai pembelian menggunakan 4,99 USD per 500 Robux dan kurs tanggal {date}.","500 Robuxあたり4.99 USDと、{date}の為替レートによる購入相当額の目安です。","มูลค่าซื้อเทียบเท่าโดยประมาณจากราคา 4.99 USD ต่อ 500 Robux และอัตราแลกเปลี่ยนวันที่ {date}","500 Robux당 4.99 USD와 {date} 기준 환율로 계산한 추정 구매 금액입니다."],
    ["Estimated purchase equivalent using 4.99 USD per 500 Robux and exchange rates dated {date} (cached; refresh unavailable).","按每 500 Robux 对应 4.99 美元和 {date} 的缓存汇率估算，暂时无法刷新。","依每 500 Robux 對應 4.99 美元和 {date} 的快取匯率估算，暫時無法更新。","Perkiraan nilai pembelian menggunakan 4,99 USD per 500 Robux dan kurs tanggal {date} (dari cache; pembaruan tidak tersedia).","500 Robuxあたり4.99 USDと、{date}の為替レートによる購入相当額の目安です（キャッシュを使用、更新できません）。","มูลค่าซื้อเทียบเท่าโดยประมาณจากราคา 4.99 USD ต่อ 500 Robux และอัตราแลกเปลี่ยนวันที่ {date} (ใช้แคช ไม่สามารถรีเฟรชได้)","500 Robux당 4.99 USD와 {date} 기준 환율로 계산한 추정 구매 금액입니다(캐시 사용, 새로 고침 불가)."]
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
  const localization = new Set();
  const discoveries = [];
  let timer = null;
  let localeDirty = false;

  const ROOTS = '#rc-playtime-home, #rc-playtime-game-page, #rc-playtime-dialog, #rc-playtime-settings, #rc-settings-overlay, #rc-terms-dialog, #rc-language-warning-dialog, #rc-extension-warning-dialog, #rc-settings-guide-dialog, #rc-update-announcement-dialog, .rc-settings-menu-entry, .rc-hide-recommended-game, #rc-home-greeting, '
    + '#rc-asset-tools, .rc-asset-owned, #rc-avatar-enhancements, #rc-avatar-loading, #rc-avatar-diagnostics, .rc-game-pin-control, .rc-game-pin-folder, #rc-pinned-games, #rc-pinned-games-notification, #rc-avatar-2d, #rc-catalog-item-2d, '
    + '#rc-pinned-friends, #rc-pinned-friends-dialog, #rc-pinned-friend-menu, .rc-friend-pin, .rc-friend-pin-profile, .rc-profile-pin-error, '
    + '#rc-friends-manager, #rc-friends-bulk-dialog, '
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
    if (/^id(?:-|$)/.test(locale)) return 'id';
    if (/^ja(?:-|$)/.test(locale)) return 'ja';
    if (/^th(?:-|$)/.test(locale)) return 'th';
    if (/^ko(?:-|$)/.test(locale)) return 'ko';
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
    const result = row[{ en: 0, 'zh-CN': 1, 'zh-TW': 2, id: 3, ja: 4, th: 5, ko: 6 }[current] ?? 0];
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
    preference = ['en', 'zh-CN', 'zh-TW', 'id', 'ja', 'th', 'ko'].includes(value) ? value : 'auto';
    syncLocale();
  }
  function* discoverRoots(roots) {
    // The parser reports both new wrappers and their children. Discover each
    // subtree once, outside the observer, rather than scanning every record.
    for (const root of roots) {
      yield;
      if (!root.isConnected || root.closest(IGNORE)) continue;
      let ancestor = root.parentElement;
      while (ancestor && !roots.has(ancestor)) ancestor = ancestor.parentElement;
      if (ancestor) continue;
      if (root.closest(ROOTS)) localization.add(root);
      else for (const owned of root.querySelectorAll(ROOTS)) localization.add(owned);
    }
  }
  function flush() {
    timer = null;
    const start = performance.now();
    if (localeDirty) { localeDirty = false; syncLocale(); }
    if (pending.size) {
      discoveries.push(discoverRoots(new Set(pending)));
      pending.clear();
    }
    while (discoveries.length && performance.now() - start < 3) {
      if (discoveries[0].next().done) discoveries.shift();
    }
    for (const root of localization) {
      if (performance.now() - start >= 6) break;
      localization.delete(root);
      if (root.isConnected) localize(root);
    }
    if (discoveries.length || localization.size) timer = setTimeout(flush, 0);
    else for (const node of bindings.keys()) if (!node.isConnected) bindings.delete(node);
  }
  function queue(root) {
    if (!root || root.nodeType !== 1) return;
    pending.add(root);
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
      // Metadata can arrive late or be removed. One document lookup per batch
      // detects either case without searching every new card subtree for meta.
      if (record.type === 'childList') localeDirty = true;
      if (record.type !== 'childList') queue(record.target.nodeType === 1 ? record.target : record.target.parentElement);
    }
    if (localeDirty && timer === null) timer = setTimeout(flush, 0);
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
