(function () {
  let popupWindow = null,
    currentVideo = null;
  let originalParent = null,
    originalSibling = null,
    placeholder = null,
    originalStyle = "";
  let originalControls = false;

  const ICONS = {
    play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
    pause:
      '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>',
    rewind:
      '<svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>',
    forward:
      '<svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>',
    fullscreen:
      '<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>',
    volumeOn:
      '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>',
    volumeOff:
      '<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>',
  };

  // --- MAIN WORLD SYNC BRIDGE (BVI COMPATIBILITY) ---
  if (!window.__pipAudioInjected) {
    window.__pipAudioInjected = true;
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("inject.js");
    script.onload = function () {
      this.remove();
    };
    (document.head || document.documentElement).appendChild(script);
  }

  const syncVolumeToMainWorld = (vid, newVol, isMuted) => {
    vid.dataset.pipVolume = newVol;
    vid.dataset.pipMuted = isMuted;
    vid.dataset.pipSync = "true";
    document.dispatchEvent(new CustomEvent("BVI_PiP_SyncVolume"));
  };

  // --- BVI PROXY GETTER BYPASS ---
  const getNativeVolume = (vid) => {
    try {
      return Object.getOwnPropertyDescriptor(
        HTMLMediaElement.prototype,
        "volume",
      ).get.call(vid);
    } catch (e) {
      return vid.volume;
    }
  };

  const getNativeMuted = (vid) => {
    try {
      return Object.getOwnPropertyDescriptor(
        HTMLMediaElement.prototype,
        "muted",
      ).get.call(vid);
    } catch (e) {
      return vid.muted;
    }
  };

  // --- 1. GLOBAL UI SYSTEM ---
  let globalPipBtn = null;
  let activeHoverVideo = null;
  const onScreenVideos = new Set();
  let pipMonitorInterval = null;

  function injectStyles() {
    if (document.getElementById("ig-pip-style")) return;
    const style = document.createElement("style");
    style.id = "ig-pip-style";
    style.textContent = `
            #ig-global-pip-btn { position: fixed; z-index: 2147483647; padding: 6px 14px; background: rgba(28,28,30,0.65); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); color: #fff; border: 0.5px solid rgba(255,255,255,0.2); border-radius: 999px; cursor: pointer; font: 500 13px -apple-system, sans-serif; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: opacity 0.2s, transform 0.2s; visibility: hidden; opacity: 0; pointer-events: none; }
            #ig-global-pip-btn.visible { visibility: visible; opacity: 1; pointer-events: auto; }
            #ig-global-pip-btn:hover { background: rgba(44,44,46,0.85); transform: scale(1.05); }
            #ig-global-pip-btn:active { transform: scale(0.95); }
            #ig-global-pip-btn svg { width: 14px; height: 14px; }
        `;
    document.head.appendChild(style);
  }

  function createGlobalButton() {
    if (document.getElementById("ig-global-pip-btn")) return;
    globalPipBtn = document.createElement("button");
    globalPipBtn.id = "ig-global-pip-btn";
    globalPipBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><rect x="12" y="12" width="7" height="7" rx="1" ry="1"></rect></svg> PiP`;

    // Block React traps completely
    ["mousedown", "mouseup", "click", "dblclick"].forEach((evt) => {
      globalPipBtn.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    globalPipBtn.addEventListener("click", () => {
      if (activeHoverVideo) launchPopup(activeHoverVideo);
    });

    document.body.appendChild(globalPipBtn);
  }

  injectStyles();
  createGlobalButton();

  // 🚨 BUG FIX: Add a parameter to control whether the video should pause upon restoration
  function restoreVideo(pauseOnRestore = false) {
    clearInterval(pipMonitorInterval); // Stop the DOM monitor

    if (currentVideo) {
      if (pauseOnRestore) {
        // Pause if we are switching posts or replacing the PiP video
        currentVideo.__isExtensionPausing = true;
        currentVideo.pause();
      } else {
        // Ensure the flag is cleared so it doesn't get blocked
        currentVideo.__isExtensionPausing = false;
      }

      // Simply remove the visual overlay
      if (
        originalParent &&
        placeholder &&
        originalParent.contains(placeholder)
      ) {
        originalParent.removeChild(placeholder);
      }

      // Restore original styles natively
      currentVideo.style.cssText = originalStyle || "";
      currentVideo.controls = originalControls;

      // 🚨 BUG FIX: Force the video to continue playing if it wasn't instructed to pause
      if (!pauseOnRestore && !currentVideo.paused) {
        currentVideo.play().catch(() => {});
      }

      // Clean up ONLY our custom event listeners safely
      if (currentVideo.__pipHandlers) {
        currentVideo.removeEventListener(
          "play",
          currentVideo.__pipHandlers.play,
        );
        currentVideo.removeEventListener(
          "pause",
          currentVideo.__pipHandlers.pause,
        );
        currentVideo.removeEventListener(
          "volumechange",
          currentVideo.__pipHandlers.volumechange,
        );
        currentVideo.removeEventListener(
          "timeupdate",
          currentVideo.__pipHandlers.timeupdate,
        );
        delete currentVideo.__pipHandlers;
      }
    }

    // Purge memory completely
    currentVideo = originalParent = originalSibling = placeholder = null;
    originalStyle = "";
  }

  function setupCustomPlayer(video, doc) {
    const container = doc.getElementById("video-container");
    container.innerHTML = "";

    // --- CANVAS PROXY FIX ---
    const canvas = doc.createElement("canvas");
    canvas.style.cssText =
      "width:100%;height:100%;object-fit:contain;background:#000;";
    container.appendChild(canvas);
    const ctx = canvas.getContext("2d");

    function renderLoop() {
      if (!popupWindow || popupWindow.closed) return;
      if (video.readyState >= 2) {
        if (canvas.width !== video.videoWidth)
          canvas.width = video.videoWidth || 300;
        if (canvas.height !== video.videoHeight)
          canvas.height = video.videoHeight || 150;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
      requestAnimationFrame(renderLoop);
    }
    renderLoop();

    video.controls = false;

    const playBtn = doc.getElementById("play-btn");
    const muteBtn = doc.getElementById("mute-btn");
    const fsBtn = doc.getElementById("fs-btn");
    const progressBar = doc.getElementById("progress-bar");
    const progressArea = doc.getElementById("progress-area");
    const hoverTime = doc.getElementById("hover-time");
    const hoverBar = doc.getElementById("hover-bar");
    const centerIcon = doc.getElementById("center-icon");
    const volumeSlider = doc.getElementById("volume-slider");
    const timeDisplay = doc.getElementById("time-display");

    const formatTime = (time) => {
      if (isNaN(time)) return "0:00";
      let min = Math.floor(time / 60);
      let sec = Math.floor(time % 60);
      return `${min}:${sec < 10 ? "0" : ""}${sec}`;
    };
    const showAnim = (iconKey) => {
      centerIcon.innerHTML = ICONS[iconKey];
      centerIcon.classList.remove("animate");
      void centerIcon.offsetWidth;
      centerIcon.classList.add("animate");
      setTimeout(() => centerIcon.classList.remove("animate"), 400);
    };

    const togglePlay = () => {
      if (video.paused) {
        video.__isExtensionPausing = false;
        video.play();
        showAnim("play");
      } else {
        video.__isExtensionPausing = true;
        video.pause();
        showAnim("pause");
      }
    };
    const toggleFullscreen = () => {
      if (doc.fullscreenElement) doc.exitFullscreen();
      else doc.documentElement.requestFullscreen();
    };
    const updatePlayIcon = () =>
      (playBtn.innerHTML = video.paused ? ICONS.play : ICONS.pause);
    // Replace the existing updateMuteIcon
    const updateMuteIcon = () => {
      const vol = getNativeVolume(video);
      const muted = getNativeMuted(video);
      muteBtn.innerHTML =
        muted || vol === 0 ? ICONS.volumeOff : ICONS.volumeOn;
      volumeSlider.value = muted ? 0 : vol;
    };

    updatePlayIcon();
    updateMuteIcon();
    fsBtn.innerHTML = ICONS.fullscreen;

    const handlePlay = updatePlayIcon;
    const handlePause = () => {
      if (!video.__isExtensionPausing && popupWindow && !popupWindow.closed) {
        setTimeout(() => {
          if (popupWindow && !popupWindow.closed && video.paused) {
            if (video.__pipUrl && window.location.href !== video.__pipUrl)
              return;
            const isAnotherVideoPlaying = Array.from(
              document.querySelectorAll("video"),
            ).some((v) => v !== video && !v.paused);

            if (!isAnotherVideoPlaying) {
              video.play().catch(() => {});
            }
          }
        }, 100);
      } else {
        updatePlayIcon();
      }
    };
    const handleVolumeChange = updateMuteIcon;
    const handleTimeUpdate = () => {
      if (video.duration) {
        progressBar.style.width =
          (video.currentTime / video.duration) * 100 + "%";
        timeDisplay.innerText = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
      }
    };

    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("volumechange", handleVolumeChange);
    video.addEventListener("timeupdate", handleTimeUpdate);

    // Store references for clean removal later
    video.__pipHandlers = {
      play: handlePlay,
      pause: handlePause,
      volumechange: handleVolumeChange,
      timeupdate: handleTimeUpdate,
    };

    let clickTimer = null;
    canvas.onclick = () => {
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
      } else {
        clickTimer = setTimeout(() => {
          togglePlay();
          clickTimer = null;
        }, 250);
      }
    };
    canvas.ondblclick = (e) => {
      e.preventDefault();
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
      }
      toggleFullscreen();
    };

    let isDragging = false;
    let wasPlaying = false;
    const updateTimeFromMouse = (e) => {
      const rect = progressArea.getBoundingClientRect();
      let pos = (e.clientX - rect.left) / rect.width;
      pos = Math.max(0, Math.min(1, pos));
      video.currentTime = pos * video.duration;
      progressBar.style.width = pos * 100 + "%";
      timeDisplay.innerText = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
    };
    progressArea.onmousedown = (e) => {
      isDragging = true;
      wasPlaying = !video.paused;
      video.__isExtensionPausing = true;
      video.pause();
      updateTimeFromMouse(e);
    };
    progressArea.onmousemove = (e) => {
      const rect = progressArea.getBoundingClientRect();
      let pos = (e.clientX - rect.left) / rect.width;
      pos = Math.max(0, Math.min(1, pos));
      hoverBar.style.width = pos * 100 + "%";
      hoverTime.innerText = formatTime(pos * video.duration);
      hoverTime.style.left = pos * 100 + "%";
    };
    doc.onmousemove = (e) => {
      if (isDragging) {
        updateTimeFromMouse(e);
        const rect = progressArea.getBoundingClientRect();
        let pos = (e.clientX - rect.left) / rect.width;
        pos = Math.max(0, Math.min(1, pos));
        hoverBar.style.width = pos * 100 + "%";
        hoverTime.innerText = formatTime(pos * video.duration);
        hoverTime.style.left = pos * 100 + "%";
      }
    };
    doc.onmouseup = () => {
      if (isDragging) {
        isDragging = false;
        if (wasPlaying) {
          video.__isExtensionPausing = false;
          video.play();
        }
      }
    };

    playBtn.onclick = togglePlay;

    // --- MAIN WORLD SYNC BRIDGE (BVI COMPATIBILITY) ---

    // Replace the existing lastVolume initialization (around line 208)
    let lastVolume = getNativeVolume(video) > 0 ? getNativeVolume(video) : 0.5;

    // Unified helper: Decouples UI from the Video element to prevent proxy tug-of-wars
    const applyVolumeChange = (newVol, isMuted) => {
      // 1. Update the PiP UI instantly for a snappy feel (DO NOT set video.volume here)
      volumeSlider.value = isMuted ? 0 : newVol;
      muteBtn.innerHTML =
        isMuted || newVol === 0 ? ICONS.volumeOff : ICONS.volumeOn;

      // 2. Delegate the actual media update to the Main World iframe bridge
      video.dataset.pipVolume = newVol;
      video.dataset.pipMuted = isMuted;
      video.dataset.pipSync = "true";
      document.dispatchEvent(new CustomEvent("BVI_PiP_SyncVolume"));
    };

    // --- FIX: Secure Audio & Mute Controls ---
    muteBtn.onclick = () => {
      // Calculate current state based on UI, not the proxy-locked video element
      const currentVol = parseFloat(volumeSlider.value);
      const isCurrentlyMuted = currentVol === 0;

      if (isCurrentlyMuted) {
        // Unmute and restore to the last known volume (or 50%)
        applyVolumeChange(lastVolume > 0 ? lastVolume : 0.5, false);
      } else {
        // Mute, but save current volume first
        lastVolume = currentVol;
        applyVolumeChange(0, true);
      }
    };

    fsBtn.onclick = toggleFullscreen;

    volumeSlider.addEventListener("input", (e) => {
      const newVol = parseFloat(e.target.value);
      if (newVol > 0) lastVolume = newVol;
      applyVolumeChange(newVol, newVol === 0);
    });

    doc.onkeydown = (e) => {
      if (e.code === "Space" || e.code === "KeyK") {
        e.preventDefault();
        togglePlay();
      }
      if (e.code === "KeyF") {
        e.preventDefault();
        toggleFullscreen();
      }
      if (e.code === "KeyM") {
        e.preventDefault();
        muteBtn.onclick(); // Route through unified mute logic
      }
      if (e.code === "ArrowRight" || e.code === "KeyL") {
        e.preventDefault();
        video.currentTime += 5;
        showAnim("forward");
      }
      if (e.code === "ArrowLeft" || e.code === "KeyJ") {
        e.preventDefault();
        video.currentTime -= 5;
        showAnim("rewind");
      }
      if (e.code === "ArrowUp") {
        e.preventDefault();
        const newVol = Math.min(1, getNativeVolume(video) + 0.1);
        if (newVol > 0) lastVolume = newVol;
        applyVolumeChange(newVol, newVol === 0);
      }
      if (e.code === "ArrowDown") {
        e.preventDefault();
        const newVol = Math.max(0, getNativeVolume(video) - 0.1);
        if (newVol > 0) lastVolume = newVol;
        applyVolumeChange(newVol, newVol === 0);
      }
    };
  }

  async function launchPopup(newVideo) {
    if (!newVideo || newVideo === currentVideo) return;

    // 🚨 BUG FIX: Pass 'true' to pause the OLD video when launching a NEW video in PiP
    if (popupWindow && !popupWindow.closed) restoreVideo(true);

    currentVideo = newVideo; // (From our previous fix)

    originalParent = newVideo.parentElement;
    originalSibling = newVideo.nextSibling;
    originalStyle = newVideo.style.cssText;
    originalControls = newVideo.controls;

    // --- OVERLAY FIX: Do not move the video in DOM to prevent MSE/BVI crashes ---
    originalParent.style.position = "relative";
    placeholder = document.createElement("div");
    placeholder.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100%;background:#000;display:flex;align-items:center;justify-content:center;color:#888;font-size:14px;z-index:10;";
    placeholder.innerText = "Playing in PiP ";
    originalParent.appendChild(placeholder);

    // Hide video visually but keep it buffering in the main DOM
    newVideo.style.setProperty("opacity", "0.01", "important");
    newVideo.style.setProperty("pointer-events", "none", "important");

    if (!popupWindow || popupWindow.closed) {
      popupWindow = window.open(
        "",
        "IG_Popup_Video",
        "popup=yes,width=450,height=800,menubar=no,toolbar=no,location=no,status=no,titlebar=no",
      );
      if (!popupWindow) return restoreVideo();
      popupWindow.document.write(`
                <!DOCTYPE html><html><head><title>IG - Custom Player</title><style>
                body { margin:0; background:#000; display:flex; justify-content:center; align-items:center; height:100vh; overflow:hidden; font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; user-select:none; cursor: default; }
                body.hide-cursor { cursor: none; }
                #video-container { position:absolute; top:0; left:0; width:100%; height:100%; z-index:1; display:flex; }
                #center-icon { position:absolute; top:50%; left:50%; transform:translate(-50%, -50%) scale(1.5); background:rgba(0,0,0,0.6); backdrop-filter:blur(8px); border-radius:50%; padding:20px; color:white; display:flex; justify-content:center; align-items:center; opacity:0; pointer-events:none; transition:opacity 0.2s, transform 0.2s; z-index:3; }
                #center-icon.animate { opacity:1; transform:translate(-50%, -50%) scale(1); }
                #center-icon svg { width:44px; height:44px; fill:white; }
                #controls-wrapper { position:absolute; bottom:0; left:0; width:100%; padding:0 12px 12px; background:linear-gradient(transparent, rgba(0,0,0,0.9) 85%); box-sizing:border-box; z-index:4; opacity:0; transition:opacity 0.25s ease; }
                body:hover #controls-wrapper { opacity:1; }
                .progress-area { width:100%; height:4px; background:rgba(255,255,255,0.2); cursor:pointer; margin-bottom:12px; position:relative; transition:height 0.1s ease; }
                .progress-area:hover { height:6px; }
                .hover-bar { position:absolute; top:0; left:0; height:100%; background:rgba(255,255,255,0.4); width:0%; pointer-events:none; z-index:1; opacity:0; transition:opacity 0.1s ease; }
                .progress-area:hover .hover-bar { opacity:1; }
                .progress-bar { position:absolute; top:0; left:0; height:100%; background:#f00; width:0%; pointer-events:none; z-index:2; }
                .progress-bar::after { content:''; position:absolute; right:-6.5px; top:50%; transform:translateY(-50%) scale(1); width:13px; height:13px; background:#f00; border-radius:50%; transition:transform 0.1s ease; z-index:3; }
                .progress-area:hover .progress-bar::after { transform:translateY(-50%) scale(1.2); }
                #hover-time { position:absolute; bottom:14px; left:0; transform:translateX(-50%); background:rgba(0,0,0,0.8); color:#fff; padding:4px 8px; font-size:12px; font-weight:500; border-radius:4px; pointer-events:none; opacity:0; transition:opacity 0.1s ease; white-space:nowrap; z-index:4; }
                .progress-area:hover #hover-time { opacity:1; }
                .buttons { display:flex; align-items:center; gap:16px; margin-top:4px; }
                .btn { background:none; border:none; color:white; cursor:pointer; padding:0; display:flex; align-items:center; opacity:0.85; transition:opacity 0.2s; }
                .btn:hover { opacity:1; }
                .btn svg { width:26px; height:26px; fill:currentColor; }
                .volume-container { display:flex; align-items:center; gap:4px; }
                .volume-slider { width:0; opacity:0; transition:width 0.25s ease, opacity 0.25s ease; }
                .volume-container:hover .volume-slider { width:65px; opacity:1; margin-left:8px; }
                input[type=range] { -webkit-appearance:none; background:transparent; cursor:pointer; }
                input[type=range]::-webkit-slider-runnable-track { width:100%; height:3px; background:rgba(255,255,255,0.3); border-radius:2px; }
                input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; height:12px; width:12px; border-radius:50%; background:#fff; margin-top:-4.5px; box-shadow: 0 0 2px rgba(0,0,0,0.5); }
                .time-display { color:#fff; font-size:13px; font-weight:400; font-variant-numeric:tabular-nums; margin-left:8px; }
                .spacer { flex-grow:1; }
                </style></head><body>
                <div id="video-container"></div><div id="center-icon"></div>
                <div id="controls-wrapper">
                    <div class="progress-area" id="progress-area"><div class="hover-bar" id="hover-bar"></div><div class="progress-bar" id="progress-bar"></div><div id="hover-time">0:00</div></div>
                    <div class="buttons"><button class="btn" id="play-btn"></button><div class="volume-container"><button class="btn" id="mute-btn"></button><input type="range" class="volume-slider" id="volume-slider" min="0" max="1" step="0.05"></div><div class="time-display" id="time-display">0:00 / 0:00</div><div class="spacer"></div><button class="btn" id="fs-btn"></button></div>
                </div>
                </body></html>
            `);
      popupWindow.document.close();

      let mouseTimer;
      popupWindow.document.body.onmousemove = () => {
        if (!popupWindow || popupWindow.closed) return;
        popupWindow.document.body.classList.remove("hide-cursor");
        clearTimeout(mouseTimer);
        mouseTimer = setTimeout(() => {
          if (
            popupWindow &&
            !popupWindow.closed &&
            popupWindow.document.fullscreenElement
          ) {
            popupWindow.document.body.classList.add("hide-cursor");
          }
        }, 2000);
      };
      // 🚨 BUG FIX: Pass 'false' so the video CONTINUES playing in the main feed when PiP is closed
      popupWindow.onbeforeunload = () => {
        restoreVideo(false);
        popupWindow = null;
      };
    }

    const savedTime = newVideo.currentTime;
    setupCustomPlayer(newVideo, popupWindow.document);
    newVideo.style.display = "none";
    void newVideo.offsetHeight;
    newVideo.style.display = "block";
    newVideo.__isExtensionPausing = false;

    // 🚨 BUG FIX: Track the URL this video started on for pause validation
    newVideo.__pipUrl = window.location.href;

    // Update the sync volume call right before the playPromise
    const canPlayAudio =
      popupWindow.navigator.userActivation &&
      popupWindow.navigator.userActivation.hasBeenActive;
    
    syncVolumeToMainWorld(newVideo, getNativeVolume(newVideo), !canPlayAudio);

    const playPromise = newVideo.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Use getNativeMuted() and getNativeVolume()
        if (!getNativeMuted(newVideo)) {
          syncVolumeToMainWorld(newVideo, getNativeVolume(newVideo), true);
          newVideo.play().catch(() => {});
        }
      });
    }

    let activePopupUrl = window.location.href;

    clearInterval(pipMonitorInterval);
    pipMonitorInterval = setInterval(() => {
      if (popupWindow && !popupWindow.closed) {
        const urlChanged = window.location.href !== activePopupUrl;

        if (urlChanged) {
          activePopupUrl = window.location.href; // Update URL

          // 🚨 BUG FIX: Pass 'true' to pause the old video because the user moved to a new post
          restoreVideo(true);
        }
      } else {
        clearInterval(pipMonitorInterval);
      }
    }, 500);
  }

  // --- 2. OBSERVER SYSTEM (Tracks Videos without modifying their DOM) ---
  const videoVisibilityObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) onScreenVideos.add(entry.target);
        else onScreenVideos.delete(entry.target);
      });
    },
    { threshold: 0.1 },
  );

  function initVideo(video) {
    if (window.location.pathname.includes("/stories/")) return;
    if (video.dataset.pipReady) return;
    video.dataset.pipReady = "true";

    // Simply tag the video and monitor it. Do not append buttons here anymore!
    videoVisibilityObserver.observe(video);

    video.addEventListener("playing", () => {
      if (popupWindow && currentVideo === video && !popupWindow.closed) {
        if (
          popupWindow.navigator.userActivation &&
          popupWindow.navigator.userActivation.hasBeenActive
        ) {
          // Use getNativeVolume() instead of video.volume
          syncVolumeToMainWorld(video, getNativeVolume(video), false);
        }
      } else if (popupWindow && !popupWindow.closed && currentVideo !== video) {
        setTimeout(() => {
          const r = video.getBoundingClientRect();
          if (
            !video.paused &&
            r.top < window.innerHeight &&
            r.bottom > 0 &&
            r.height > 100
          )
            launchPopup(video);
        }, 300);
      }
    });
  }

  // --- 3. MOUSE TRACKING ENGINE ---
  let mouseTrackerTimer = null;
  document.addEventListener("mousemove", (e) => {
    if (!isExtensionEnabled || !globalPipBtn) return;

    if (mouseTrackerTimer) return; // Throttle for performance
    mouseTrackerTimer = setTimeout(() => {
      mouseTrackerTimer = null;

      // Check if mouse is directly over our button
      const btnRect = globalPipBtn.getBoundingClientRect();
      const isHoveringBtn =
        globalPipBtn.classList.contains("visible") &&
        e.clientX >= btnRect.left &&
        e.clientX <= btnRect.right &&
        e.clientY >= btnRect.top &&
        e.clientY <= btnRect.bottom;
      if (isHoveringBtn) return;

      // Find which video the mouse is currently hovering over
      let foundVideo = null;
      for (let v of onScreenVideos) {
        const rect = v.getBoundingClientRect();
        if (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        ) {
          foundVideo = v;
          break;
        }
      }

      if (foundVideo) {
        activeHoverVideo = foundVideo;
        const rect = foundVideo.getBoundingClientRect();
        // Teleport button to top right of hovered video
        globalPipBtn.style.top = Math.max(16, rect.top + 16) + "px";
        globalPipBtn.style.left = rect.right - 90 + "px"; // Offset for button width
        globalPipBtn.classList.add("visible");
      } else {
        activeHoverVideo = null;
        globalPipBtn.classList.remove("visible");
      }
    }, 50);
  });

  // Hide UI cleanly when scrolling
  window.addEventListener(
    "scroll",
    () => {
      if (globalPipBtn) globalPipBtn.classList.remove("visible");
    },
    { passive: true },
  );

  // --- 4. EXTENSION SETTINGS & LIFECYCLE ---
  function getActiveVideo() {
    const centerY = window.innerHeight / 2;
    return (
      [...document.querySelectorAll("video")].reduce((best, v) => {
        const rect = v.getBoundingClientRect();
        if (
          rect.height > 100 &&
          v !== currentVideo &&
          rect.top < window.innerHeight &&
          rect.bottom > 0
        ) {
          const dist = Math.abs(rect.top + rect.height / 2 - centerY);
          if (dist < (best.dist || window.innerHeight * 0.3))
            return { v, dist };
        }
        return best;
      }, {}).v || null
    );
  }

  let isExtensionEnabled = true;
  let isAutoScrollEnabled = true;

  chrome.storage.local.get(["isEnabled", "isAutoScrollEnabled"], (res) => {
    if (res.isEnabled !== undefined) isExtensionEnabled = res.isEnabled;
    if (res.isAutoScrollEnabled !== undefined)
      isAutoScrollEnabled = res.isAutoScrollEnabled;
    if (isExtensionEnabled) startExtensionObservers();
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.isEnabled) {
      isExtensionEnabled = changes.isEnabled.newValue;
      if (isExtensionEnabled) {
        startExtensionObservers();
      } else {
        if (globalPipBtn) globalPipBtn.classList.remove("visible");
        document
          .querySelectorAll("video")
          .forEach((v) => delete v.dataset.pipReady);
        if (popupWindow && !popupWindow.closed) restoreVideo();
      }
    }
    if (changes.isAutoScrollEnabled) {
      isAutoScrollEnabled = changes.isAutoScrollEnabled.newValue;
    }
  });

  function startExtensionObservers() {
    document.querySelectorAll("video").forEach(initVideo);
    const observer = new MutationObserver(() => {
      if (isExtensionEnabled)
        document.querySelectorAll("video").forEach(initVideo);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setInterval(() => {
      if (isExtensionEnabled)
        document.querySelectorAll("video").forEach(initVideo);
    }, 1500);
  }

  let scrollTimeout;
  window.addEventListener("scroll", () => {
    if (!isExtensionEnabled || !isAutoScrollEnabled) return;
    if (!popupWindow || popupWindow.closed) return;
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const nextVideo = getActiveVideo();
      try {
        if (nextVideo && nextVideo !== currentVideo) launchPopup(nextVideo);
      } catch (err) {
        console.warn("Popup Blocker prevented auto-scroll PiP launch.");
      }
    }, 400);
  });

  window.addEventListener("unload", () => {
    if (popupWindow && !popupWindow.closed) popupWindow.close();
  });
  document.addEventListener("visibilitychange", () => {
    if (popupWindow && !popupWindow.closed && currentVideo) {
      if (document.hidden) {
        currentVideo.__isExtensionPausing = true;
        currentVideo.pause();
      } else {
        currentVideo.__isExtensionPausing = false;
        currentVideo.play().catch(() => {});
      }
    }
  });
})();
