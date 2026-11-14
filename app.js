const PREVIEW_VIDEOS_COUNT = 4;

let topicVideosMap = new Map();
let currentDetailTopicId = null;
let selectedDetailChannelId = "all";
let searchQuery = "";
let detailSortBy = "newest";

function buildTopicVideosMap(rawVideos) {
  const map = new Map();
  const maxPerTopic = CONFIG.MAX_VIDEOS_PER_TOPIC || 30;

  for (const topic of CONFIG.TOPICS) {
    map.set(topic.id, []);
  }

  const allowedChannels = new Set(
    (CONFIG.CHANNEL_IDS || []).map(id => id.trim()).filter(Boolean)
  );

  const uniqueVideosMap = new Map();
  for (const video of rawVideos) {
    const vid = video.videoId || video.id;
    if (!vid) continue;
    if (allowedChannels.size > 0 && !allowedChannels.has(video.channelId)) continue;
    if (!uniqueVideosMap.has(vid)) {
      uniqueVideosMap.set(vid, { ...video, videoId: vid });
    }
  }

  const sortedUniqueVideos = Array.from(uniqueVideosMap.values()).sort(
    (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)
  );

  for (const video of sortedUniqueVideos) {
    const tagsStr = Array.isArray(video.tags) ? video.tags.join(" ") : "";
    const fullText = `${video.title || ""} ${tagsStr} ${video.description || ""}`.toLowerCase();

    for (const topic of CONFIG.TOPICS) {
      const list = map.get(topic.id);
      if (list.length >= maxPerTopic) continue;

      const isMatch = (topic.hiddenHashtags || []).some(ruleTag => {
        const cleanRule = ruleTag.trim().toLowerCase();
        if (!cleanRule) return false;
        return fullText.includes(cleanRule);
      });

      if (isMatch) {
        list.push(video);
      }
    }
  }

  return map;
}

async function refreshVideoData() {
  const loadingEl = document.getElementById("loadingState");
  const alertBox = document.getElementById("statusAlertBox");
  const updateTimeEl = document.getElementById("updateTimeDisplay");

  alertBox.classList.add("hidden");
  const validChannels = (CONFIG.CHANNEL_IDS || []).map(id => id.trim()).filter(Boolean);

  if (!CONFIG.GAS_URL || validChannels.length === 0) {
    topicVideosMap = buildTopicVideosMap([]);
    renderCurrentView();
    return;
  }

  loadingEl.classList.remove("hidden");
  document.getElementById("overviewContainer").classList.add("hidden");
  document.getElementById("topicDetailContainer").classList.add("hidden");

  try {
    const url = `${CONFIG.GAS_URL}?channels=${encodeURIComponent(validChannels.join(","))}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`伺服器連線失敗 (HTTP ${response.status})`);
    }
    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    if (data.lastUpdated) {
      updateTimeEl.innerHTML = `<i class="fa-regular fa-clock text-amber-400"></i><span>上次更新時間：${escapeHtml(data.lastUpdated)}（每15分鐘更新一次）</span>`;
    }

    topicVideosMap = buildTopicVideosMap(data.items || []);
  } catch (error) {
    console.error("影片資料載入錯誤：", error);
    alertBox.className = "mb-6 rounded-2xl p-4 border border-red-300 bg-red-50 text-red-900 text-sm flex items-start gap-3";
    alertBox.innerHTML = `
      <i class="fa-solid fa-circle-exclamation text-red-600 mt-0.5 text-base"></i>
      <div>
        <p class="font-bold">目前無法連線讀取頻道影片</p>
        <p class="text-xs text-red-700 mt-0.5">錯誤訊息：${escapeHtml(error.message)}</p>
      </div>
    `;
    alertBox.classList.remove("hidden");
    topicVideosMap = buildTopicVideosMap([]);
  } finally {
    loadingEl.classList.add("hidden");
    renderCurrentView();
  }
}

function openTopicDetail(topicId) {
  currentDetailTopicId = topicId;
  selectedDetailChannelId = "all";
  detailSortBy = "newest";
  document.getElementById("detailSortSelect").value = "newest";
  window.location.hash = `topic-${topicId}`;
  renderCurrentView();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function backToOverview() {
  currentDetailTopicId = null;
  selectedDetailChannelId = "all";
  if (window.location.hash) {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }
  renderCurrentView();
}

function renderCurrentView() {
  const overviewEl = document.getElementById("overviewContainer");
  const detailEl = document.getElementById("topicDetailContainer");

  if (currentDetailTopicId) {
    overviewEl.classList.add("hidden");
    detailEl.classList.remove("hidden");
    renderTopicDetailView(currentDetailTopicId);
  } else {
    detailEl.classList.add("hidden");
    overviewEl.classList.remove("hidden");
    renderOverviewSections();
  }
}

function renderOverviewSections() {
  const container = document.getElementById("overviewContainer");
  const q = searchQuery.trim().toLowerCase();

  container.innerHTML = CONFIG.TOPICS.map(topic => {
    let videos = topicVideosMap.get(topic.id) || [];

    if (q !== "") {
      videos = videos.filter(
        v =>
          v.title.toLowerCase().includes(q) ||
          v.channelTitle.toLowerCase().includes(q)
      );
    }

    const previewVideos = videos.slice(0, PREVIEW_VIDEOS_COUNT);

    const bodyHtml =
      previewVideos.length > 0
        ? `
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            ${previewVideos.map(v => createVideoCardHtml(v)).join("")}
          </div>
        `
        : `
          <div class="py-8 px-4 rounded-2xl bg-amber-50/50 border border-dashed border-amber-200 text-center">
            <p class="text-xs sm:text-sm font-semibold text-cookie-cocoa/75">
              ${
                q !== ""
                  ? `「${escapeHtml(topic.name)}」中沒有符合「${escapeHtml(searchQuery)}」的影片`
                  : `目前尚無影片`
              }
            </p>
          </div>
        `;

    return `
      <section
        id="section-${topic.id}"
        class="bg-white rounded-3xl border border-amber-900/10 shadow-xs p-5 sm:p-6 transition hover:border-amber-300/80"
      >
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-5 border-b border-amber-100">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <i class="fa-solid ${topic.icon} text-base"></i>
            </div>
            <div class="flex items-center gap-2.5 flex-wrap">
              <h2
                data-open-topic="${topic.id}"
                class="open-topic-trigger text-lg sm:text-xl font-black text-cookie-choco hover:text-amber-700 transition cursor-pointer"
              >
                ${escapeHtml(topic.name)}
              </h2>
              ${
                previewVideos.length > 0
                  ? `<span class="text-[11px] font-medium text-cookie-cocoa/70">顯示最新 ${previewVideos.length} 部預覽（共 ${videos.length} 部）</span>`
                  : ""
              }
            </div>
          </div>

          <button
            type="button"
            data-open-topic="${topic.id}"
            class="open-topic-trigger inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-amber-950 font-extrabold text-xs sm:text-sm shadow-xs transition cursor-pointer self-start sm:self-center shrink-0"
          >
            <span>查看全部</span>
            <i class="fa-solid fa-arrow-right text-xs"></i>
          </button>
        </div>

        ${bodyHtml}
      </section>
    `;
  }).join("");

  container.querySelectorAll(".open-topic-trigger").forEach(el => {
    el.addEventListener("click", () => {
      const tid = el.getAttribute("data-open-topic");
      if (tid) openTopicDetail(tid);
    });
  });

  bindVideoCardClickEvents(container);
}

function renderTopicDetailView(topicId) {
  const topic = CONFIG.TOPICS.find(t => t.id === topicId);
  if (!topic) {
    backToOverview();
    return;
  }

  const rawTopicVideos = topicVideosMap.get(topic.id) || [];

  document.getElementById("detailTopicTitle").textContent = topic.name;
  document.getElementById("detailTopicIconBox").innerHTML = `<i class="fa-solid ${topic.icon} text-xl"></i>`;

  const activeChannelMap = new Map();
  for (const v of rawTopicVideos) {
    if (!activeChannelMap.has(v.channelId)) {
      activeChannelMap.set(v.channelId, {
        channelId: v.channelId,
        channelTitle: v.channelTitle,
        channelAvatar: v.channelAvatar || "",
        count: 0
      });
    }
    activeChannelMap.get(v.channelId).count += 1;
  }
  const activeChannels = Array.from(activeChannelMap.values()).sort((a, b) => b.count - a.count);

  if (selectedDetailChannelId !== "all" && !activeChannelMap.has(selectedDetailChannelId)) {
    selectedDetailChannelId = "all";
  }

  document.getElementById("detailChannelCountText").textContent = `共 ${activeChannels.length} 個頻道有影片`;

  const channelsListEl = document.getElementById("detailChannelsList");
  const footerChannelsEl = document.getElementById("detailFooterChannelLinks");

  if (activeChannels.length === 0) {
    channelsListEl.innerHTML = `<span class="text-xs text-cookie-cocoa/60">目前尚無影片</span>`;
    footerChannelsEl.innerHTML = "";
  } else {
    const allChipHtml = `
      <button
        type="button"
        data-filter-channel="all"
        class="detail-channel-filter-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
          selectedDetailChannelId === "all"
            ? "bg-cookie-choco text-white shadow-xs"
            : "bg-amber-50 hover:bg-amber-100 text-cookie-choco border border-amber-200"
        }"
      >
        <span>全部頻道 (${rawTopicVideos.length})</span>
      </button>
    `;

    const channelChipsHtml = activeChannels
      .map(ch => {
        const isSelected = selectedDetailChannelId === ch.channelId;
        const avatarHtml = ch.channelAvatar
          ? `<img src="${escapeHtml(ch.channelAvatar)}" alt="" class="w-4 h-4 rounded-full object-cover shrink-0" onerror="this.style.display='none'" />`
          : `<i class="fa-brands fa-youtube text-red-500 text-xs shrink-0"></i>`;

        return `
          <div class="inline-flex items-center rounded-xl border overflow-hidden ${
            isSelected
              ? "border-cookie-choco bg-cookie-choco text-white shadow-xs"
              : "border-amber-200 bg-white text-cookie-choco"
          }">
            <button
              type="button"
              data-filter-channel="${escapeHtml(ch.channelId)}"
              class="detail-channel-filter-btn px-3 py-1.5 text-xs font-bold hover:opacity-90 transition cursor-pointer flex items-center gap-1.5"
              title="僅顯示此頻道的影片"
            >
              ${avatarHtml}
              <span>${escapeHtml(ch.channelTitle)} (${ch.count})</span>
            </button>
            <a
              href="https://www.youtube.com/channel/${encodeURIComponent(ch.channelId)}"
              target="_blank"
              rel="noopener noreferrer"
              title="前往「${escapeHtml(ch.channelTitle)}」YouTube 頻道搜尋"
              class="px-2.5 py-1.5 text-xs border-l ${
                isSelected
                  ? "border-white/20 text-amber-300 hover:bg-white/10"
                  : "border-amber-100 text-red-600 hover:bg-red-50"
              } transition"
            >
              <i class="fa-solid fa-arrow-up-right-from-square text-[11px]"></i>
            </a>
          </div>
        `;
      })
      .join("");

    channelsListEl.innerHTML = allChipHtml + channelChipsHtml;

    footerChannelsEl.innerHTML = activeChannels
      .map(
        ch => `
          <a
            href="https://www.youtube.com/channel/${encodeURIComponent(ch.channelId)}/videos"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-amber-100/70 text-cookie-choco border border-amber-300/80 text-xs font-bold shadow-2xs transition"
          >
            <i class="fa-brands fa-youtube text-red-600"></i>
            <span>${escapeHtml(ch.channelTitle)}</span>
            <i class="fa-solid fa-magnifying-glass text-[10px] text-amber-700"></i>
          </a>
        `
      )
      .join("");

    channelsListEl.querySelectorAll(".detail-channel-filter-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        selectedDetailChannelId = btn.getAttribute("data-filter-channel");
        renderTopicDetailView(topicId);
      });
    });
  }

  let filtered = [...rawTopicVideos];

  if (selectedDetailChannelId !== "all") {
    filtered = filtered.filter(v => v.channelId === selectedDetailChannelId);
  }

  if (searchQuery.trim() !== "") {
    const q = searchQuery.trim().toLowerCase();
    filtered = filtered.filter(
      v =>
        v.title.toLowerCase().includes(q) ||
        v.channelTitle.toLowerCase().includes(q)
    );
  }

  filtered.sort((a, b) => {
    if (detailSortBy === "newest") {
      return new Date(b.publishedAt) - new Date(a.publishedAt);
    } else if (detailSortBy === "oldest") {
      return new Date(a.publishedAt) - new Date(b.publishedAt);
    } else if (detailSortBy === "channel") {
      return a.channelTitle.localeCompare(b.channelTitle, "zh-Hant");
    }
    return 0;
  });

  const gridEl = document.getElementById("detailVideoGrid");
  const emptyEl = document.getElementById("detailEmptyState");

  if (filtered.length === 0) {
    gridEl.classList.add("hidden");
    emptyEl.classList.remove("hidden");
    return;
  }

  emptyEl.classList.add("hidden");
  gridEl.classList.remove("hidden");
  gridEl.innerHTML = filtered.map(v => createVideoCardHtml(v)).join("");
  bindVideoCardClickEvents(gridEl);
}

function createVideoCardHtml(video) {
  const formattedDate = formatRelativeDate(video.publishedAt);
  const durationBadge = video.duration
    ? `<span class="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/80 text-white text-[11px] font-mono font-semibold backdrop-blur-xs">${escapeHtml(video.duration)}</span>`
    : "";
  const avatarHtml = video.channelAvatar
    ? `<img src="${escapeHtml(video.channelAvatar)}" alt="" class="w-5 h-5 rounded-full object-cover shrink-0 border border-amber-200" onerror="this.style.display='none'" />`
    : `<i class="fa-brands fa-youtube text-red-600 shrink-0"></i>`;

  return `
    <article
      data-video-id="${escapeHtml(video.videoId)}"
      class="video-card group bg-white rounded-2xl overflow-hidden border border-amber-900/10 shadow-2xs flex flex-col cursor-pointer"
    >
      <div class="relative aspect-video bg-stone-900 overflow-hidden">
        <img
          src="${escapeHtml(video.thumbnail)}"
          alt="${escapeHtml(video.title)}"
          loading="lazy"
          onerror="this.onerror=null;this.src='https://placehold.co/640x360/3E2723/FDE68A?text=Devsisters+Guide';"
          class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80 group-hover:opacity-95 transition"></div>

        <div class="absolute inset-0 flex items-center justify-center">
          <div class="w-11 h-11 rounded-full bg-red-600/95 text-white flex items-center justify-center shadow-lg transform scale-90 opacity-90 group-hover:scale-105 group-hover:opacity-100 transition">
            <i class="fa-solid fa-play text-sm ml-0.5"></i>
          </div>
        </div>

        <span class="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/70 text-amber-100 text-[11px] font-medium backdrop-blur-xs">
          ${formattedDate}
        </span>
        ${durationBadge}
      </div>

      <div class="p-3.5 sm:p-4 flex-1 flex flex-col justify-between">
        <h3 class="font-bold text-sm text-cookie-choco line-clamp-2 group-hover:text-amber-700 transition leading-snug">
          ${escapeHtml(video.title)}
        </h3>

        <div class="mt-3 pt-2.5 border-t border-stone-100 flex items-center justify-between text-xs text-cookie-cocoa/80">
          <span class="inline-flex items-center gap-1.5 font-medium truncate">
            ${avatarHtml}
            <span class="truncate">${escapeHtml(video.channelTitle)}</span>
          </span>
          <span class="text-amber-700 font-bold shrink-0 ml-2 group-hover:translate-x-0.5 transition-transform">
            觀看 <i class="fa-solid fa-chevron-right text-[10px]"></i>
          </span>
        </div>
      </div>
    </article>
  `;
}

function bindVideoCardClickEvents(rootElement) {
  rootElement.querySelectorAll(".video-card").forEach(card => {
    card.addEventListener("click", () => {
      const vid = card.getAttribute("data-video-id");
      let foundVideo = null;
      for (const list of topicVideosMap.values()) {
        foundVideo = list.find(v => v.videoId === vid);
        if (foundVideo) break;
      }
      if (foundVideo) {
        openVideoModal(foundVideo);
      }
    });
  });
}

function openVideoModal(video) {
  const modal = document.getElementById("videoModal");
  const iframe = document.getElementById("youtubeIframe");
  const titleEl = document.getElementById("modalVideoTitle");
  const channelEl = document.getElementById("modalChannelInfo");
  const publishEl = document.getElementById("modalPublishInfo");
  const extLink = document.getElementById("modalExternalLink");

  titleEl.textContent = video.title;
  channelEl.textContent = `頻道：${video.channelTitle}`;
  publishEl.textContent = `發布時間：${new Date(video.publishedAt).toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  })}`;
  extLink.href = `https://www.youtube.com/watch?v=${encodeURIComponent(video.videoId)}`;
  iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(video.videoId)}?autoplay=1&rel=0`;

  modal.classList.remove("hidden");
  modal.classList.add("flex");
  document.body.style.overflow = "hidden";
}

function closeVideoModal() {
  const modal = document.getElementById("videoModal");
  const iframe = document.getElementById("youtubeIframe");
  iframe.src = "";
  modal.classList.add("hidden");
  modal.classList.remove("flex");
  document.body.style.overflow = "";
}

function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatRelativeDate(isoString) {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "";
  const now = new Date();
  const diffMs = now - date;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return "剛剛發布";
  if (diffHours < 24) return `${diffHours} 小時前`;
  if (diffDays < 7) return `${diffDays} 天前`;
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

document.addEventListener("DOMContentLoaded", () => {
  if (window.location.hash.startsWith("#topic-")) {
    const hashTopicId = window.location.hash.replace("#topic-", "");
    if (CONFIG.TOPICS.some(t => t.id === hashTopicId)) {
      currentDetailTopicId = hashTopicId;
    }
  }

  document.getElementById("brandHomeBtn").addEventListener("click", backToOverview);
  document.getElementById("headerTitleLink").addEventListener("click", e => {
    e.preventDefault();
    backToOverview();
  });
  document.getElementById("backToOverviewBtn").addEventListener("click", backToOverview);

  const searchInput = document.getElementById("searchInput");
  const clearSearchBtn = document.getElementById("clearSearchBtn");

  searchInput.addEventListener("input", e => {
    searchQuery = e.target.value;
    clearSearchBtn.classList.toggle("hidden", searchQuery === "");
    renderCurrentView();
  });

  clearSearchBtn.addEventListener("click", () => {
    searchQuery = "";
    searchInput.value = "";
    clearSearchBtn.classList.add("hidden");
    renderCurrentView();
  });

  document.getElementById("detailSortSelect").addEventListener("change", e => {
    detailSortBy = e.target.value;
    if (currentDetailTopicId) {
      renderTopicDetailView(currentDetailTopicId);
    }
  });

  document.getElementById("closeVideoModalBtn").addEventListener("click", closeVideoModal);
  document.getElementById("videoModal").addEventListener("click", e => {
    if (e.target.id === "videoModal") closeVideoModal();
  });

  window.addEventListener("hashchange", () => {
    if (window.location.hash.startsWith("#topic-")) {
      const hashTopicId = window.location.hash.replace("#topic-", "");
      if (CONFIG.TOPICS.some(t => t.id === hashTopicId)) {
        currentDetailTopicId = hashTopicId;
        renderCurrentView();
        return;
      }
    }
    currentDetailTopicId = null;
    renderCurrentView();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      closeVideoModal();
    }
  });

  refreshVideoData();
});
