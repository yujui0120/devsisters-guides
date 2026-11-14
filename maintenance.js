(function() {
  if (localStorage.getItem("bypass_maintenance") === "true") {
    return;
  }

  const startTime = new Date("2020-01-01T00:00:00+08:00");
  const endTime = new Date("2026-11-15T21:00:00+08:00");
  const now = new Date();
  
//系統維護中
//為了提供更優質的服務，系統目前正在進行維護作業。<br>期間將暫時無法進入與使用各項功能，造成您的不便敬請見諒！<br>維護時間結束後重新整理網頁即可進入。
//預計結束時間：2026/11/17 15:00 (GMT+8)
  
  if (now >= startTime && now <= endTime) {
    window.IS_MAINTENANCE = true;
    document.addEventListener("DOMContentLoaded", () => {
      document.body.innerHTML = `
        <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background-color: #FFFDF9; font-family: 'Noto Sans TC', 'Inter', sans-serif; color: #3E2723; padding: 1rem;">
          <div style="background: white; border: 2px solid #FDE68A; border-radius: 1.5rem; padding: 2.5rem; max-width: 480px; width: 100%; text-align: center; box-shadow: 0 10px 25px -5px rgba(62, 39, 35, 0.1);">
            <div style="width: 64px; height: 64px; background-color: #FEF3C7; color: #D97706; border-radius: 1rem; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem auto; font-size: 28px;">
              <i class="fa-solid fa-triangle-exclamation"></i>
            </div>
            <h1 id="secretTitle" style="font-size: 1.5rem; font-weight: 900; margin-bottom: 0.75rem; color: #3E2723; cursor: default; user-select: none;">即將上架</h1>
            <p style="font-size: 0.875rem; color: #5D4037; line-height: 1.5; margin-bottom: 1.5rem;">
              目前網頁正在進行最後一點的調整與修正🚧<br>於下方時間重新整理網頁就可以進入囉！
            </p>
            <div style="background-color: #FFFBEB; border: 1px solid #FDE68A; border-radius: 1rem; padding: 1rem; font-size: 0.875rem; font-weight: 700; color: #92400E;">
              預計開放時間：2026/11/15 21:00 (GMT+8)
            </div>
          </div>
        </div>
      `;

      setTimeout(() => {
        const titleEl = document.getElementById("secretTitle");
        if (titleEl) {
          titleEl.addEventListener("click", () => {
            const passcode = prompt("");
            if (passcode === "Amigo86380120") {
              localStorage.setItem("bypass_maintenance", "true");
              location.reload();
            }
          });
        }
      }, 100);
    });
  }
})();
