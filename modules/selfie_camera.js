import { t, getLanguage } from "./i18n.js?v=i18n4";
// selfie_camera.js (MediaPipe-based coaching)
// Option 2: MediaPipe FaceLandmarker for deterministic face box + pose checks.
// Exports: openSelfieCapture({ orderCode, supabaseClient }) -> { file: File, via: "camera"|"qr" } | null

let _styleInjected = false;
let _landmarkerPromise = null;

function injectStyles() {
  if (_styleInjected) return;
  _styleInjected = true;
  const css = `
  .exSelfie_backdrop{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:99999;}
  .exSelfie_card{background:#fff;border-radius:18px;box-shadow:0 18px 60px rgba(0,0,0,.35);width:min(420px,calc(100vw - 24px));max-height:min(92vh,780px);display:flex;flex-direction:column;overflow:hidden;}
  .exSelfie_head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px 12px;border-bottom:1px solid rgba(0,0,0,.08);gap:10px;}
  .exSelfie_titleRow{display:flex;align-items:center;gap:8px;}
  .exSelfie_title{font:700 17px/1.2 Montserrat,system-ui,-apple-system,Segoe UI,Roboto,Arial;margin:0;}
  .exSelfie_close{border:0;background:transparent;font-size:22px;line-height:1;cursor:pointer;padding:6px 10px;border-radius:10px;}
  .exSelfie_close:hover{background:rgba(0,0,0,.06);}
  .exSelfie_body{padding:14px 16px;overflow:auto;min-height:0;}
  .exSelfie_guidanceBox{background:#fdf8f0;border:1px solid rgba(184,154,91,.25);border-radius:10px;padding:10px 12px;margin-bottom:12px;display:flex;gap:8px;align-items:flex-start;}
  .exSelfie_guidanceText{font:500 12px/1.5 Montserrat,system-ui,-apple-system,Segoe UI,Roboto,Arial;color:#92712a;}
  .exSelfie_row{display:flex;gap:14px;flex-wrap:wrap;flex-direction:column;align-items:center;}
  .exSelfie_previewWrap{flex:0 0 auto;}
  .exSelfie_previewFrame{width:280px;height:374px;border-radius:16px;overflow:hidden;position:relative;background:#111;}
  .exSelfie_video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scaleX(-1);z-index:1;}
  .exSelfie_overlay{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:3;}
  .exSelfie_blurMask{position:absolute;inset:0;pointer-events:none;z-index:2;
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    background: rgba(0,0,0,.06);
    mask-image: radial-gradient(ellipse var(--oval-rx,98px) var(--oval-ry,160px) at var(--oval-cx,140px) var(--oval-cy,194px),
      transparent 0 98%, rgba(0,0,0,1) 100%);
    -webkit-mask-image: radial-gradient(ellipse var(--oval-rx,98px) var(--oval-ry,160px) at var(--oval-cx,140px) var(--oval-cy,194px),
      transparent 0 98%, rgba(0,0,0,1) 100%);
  }
  .exSelfie_scanLine{position:absolute;inset:0;pointer-events:none;opacity:0;z-index:4;}
  .exSelfie_scanLine::before{
    content:"";
    position:absolute;left:0;right:0;height:2px;
    background: rgba(0,0,0,.72);
    clip-path: ellipse(var(--oval-rx,98px) var(--oval-ry,160px) at var(--oval-cx,140px) var(--oval-cy,194px));
    -webkit-clip-path: ellipse(var(--oval-rx,98px) var(--oval-ry,160px) at var(--oval-cx,140px) var(--oval-cy,194px));
    transform: translateY(calc(var(--oval-cy,194px) - var(--oval-ry,160px)));
    will-change: transform;
  }
  .exSelfie_previewFrame.scanning-active .exSelfie_scanLine{opacity:1;}
  .exSelfie_previewFrame.scanning-active .exSelfie_scanLine::before{
    animation: exSelfie_scanMove 1.6s linear infinite;
  }
  @keyframes exSelfie_scanMove{
    0%{ transform: translateY(calc(var(--oval-cy,194px) - var(--oval-ry,160px))); }
    100%{ transform: translateY(calc(var(--oval-cy,194px) + var(--oval-ry,160px))); }
  }
  .exSelfie_tip{position:absolute;left:12px;right:12px;bottom:12px;background:rgba(0,0,0,.55);color:#fff;font:600 14px/1.2 system-ui,-apple-system,Segoe UI,Roboto,Arial;padding:10px 12px;border-radius:12px;text-align:center;min-height:38px;display:flex;align-items:center;justify-content:center;z-index:6;}
  .exSelfie_controls{flex:1 1 auto;min-width:220px;width:100%;max-width:440px;}
  .exSelfie_camLabel{font:700 10px/1 Montserrat,system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;margin-bottom:6px;margin-top:10px;}
  .exSelfie_select{width:100%;padding:10px 14px;border-radius:12px;border:1px solid rgba(0,0,0,.18);font:500 14px/1.2 system-ui,-apple-system,Segoe UI,Roboto,Arial;margin-bottom:10px;}
  .exSelfie_takeBtn{width:100%;padding:13px 14px;border-radius:12px;border:none;background:#b89a5b;color:#fff;font:700 15px/1 Montserrat,system-ui,sans-serif;cursor:pointer;margin-bottom:8px;}
  .exSelfie_takeBtn:disabled{opacity:.45;cursor:not-allowed;}
  .exSelfie_btnRow{display:flex;gap:10px;flex-wrap:nowrap;align-items:center;width:100%;}
  .exSelfie_btn{border:1px solid rgba(0,0,0,.18);background:#fff;border-radius:12px;padding:9px 14px;font:600 13px/1 system-ui,-apple-system,Segoe UI,Roboto,Arial;cursor:pointer;}
  .exSelfie_btn:hover{background:rgba(0,0,0,.04);}
  .exSelfie_primary{background:#16a34a;color:#fff;border-color:#16a34a;}
  .exSelfie_primary:disabled{opacity:.45;cursor:not-allowed;}
  .exSelfie_note{margin-top:10px;color:rgba(0,0,0,.68);font:500 10px/1.35 system-ui,-apple-system,Segoe UI,Roboto,Arial;min-height:0;}
  .exSelfie_qrWrap{display:flex;flex-direction:column;align-items:center;gap:12px;padding:10px 0;}
  .exSelfie_qrBox{background:#fff;border-radius:16px;border:1px solid rgba(0,0,0,.12);padding:14px;}
  .exSelfie_qrHint{color:rgba(0,0,0,.72);font:500 13px/1.35 system-ui,-apple-system,Segoe UI,Roboto,Arial;text-align:center;max-width:420px;}
  .exSelfie_guidance{color:rgba(0,0,0,.72);font:500 10px/1.35 system-ui,-apple-system,Segoe UI,Roboto,Arial;text-align:center;}
  .exSelfie_reviewHead{font:700 17px/1.2 Montserrat,system-ui,sans-serif;padding:14px 16px 12px;border-bottom:1px solid rgba(0,0,0,.08);}
  .exSelfie_reviewBtns{display:flex;gap:10px;justify-content:center;padding:14px 16px;border-top:1px solid rgba(0,0,0,.08);}
  @keyframes exSelfie_slide{0%{transform:translateX(-200%)}100%{transform:translateX(350%)}}
  `;
  const st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);
}

async function getLandmarker() {
  if (_landmarkerPromise) return _landmarkerPromise;
  _landmarkerPromise = (async () => {
    // Load MediaPipe Tasks Vision bundle (ESM) and create a FaceLandmarker.
    const vision = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs");
    const FilesetResolver = vision.FilesetResolver;
    const FaceLandmarker = vision.FaceLandmarker;
    const resolver = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
    const lm = await FaceLandmarker.createFromOptions(resolver, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
      },
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
      numFaces: 1,
      runningMode: "VIDEO",
    });
    return lm;
  })();
  return _landmarkerPromise;
}

function ellipseContains(cx, cy, rx, ry, x, y) {
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  return (dx*dx + dy*dy) <= 1.0;
}

function computeLumaMean(imageData) {
  const d = imageData.data;
  let sum = 0;
  // sample every 4th pixel for speed
  for (let i = 0; i < d.length; i += 16) {
    // Rec. 709 luma approx
    sum += (0.2126 * d[i] + 0.7152 * d[i+1] + 0.0722 * d[i+2]);
  }
  const n = Math.max(1, Math.floor(d.length / 16));
  return sum / n;
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

// Compute mean luma inside a pixel-space box on an ImageData (box: {x,y,w,h}).
function computeLumaMeanInBox(imageData, box) {
  const d = imageData.data;
  const W = imageData.width, H = imageData.height;

  const x0 = clamp(Math.floor(box.x), 0, W-1);
  const y0 = clamp(Math.floor(box.y), 0, H-1);
  const x1 = clamp(Math.ceil(box.x + box.w), 0, W);
  const y1 = clamp(Math.ceil(box.y + box.h), 0, H);

  let sum = 0;
  let n = 0;

  // sample every 4th pixel horizontally/vertically for speed
  const step = 4;
  for (let y = y0; y < y1; y += step) {
    let row = (y * W + x0) * 4;
    for (let x = x0; x < x1; x += step) {
      const i = row + (x - x0) * 4;
      sum += (0.2126 * d[i] + 0.7152 * d[i+1] + 0.0722 * d[i+2]);
      n++;
    }
  }

  return sum / Math.max(1, n);
}


function bboxFromLandmarks(landmarks, w, h) {
  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  for (const p of landmarks) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const x = minX * w;
  const y = minY * h;
  const bw = (maxX - minX) * w;
  const bh = (maxY - minY) * h;
  return { x, y, w: bw, h: bh, cx: x + bw/2, cy: y + bh/2, minX: x, minY: y, maxX: x+bw, maxY: y+bh };
}

function bboxFromLandmarksToPreview(landmarks, videoW, videoH, previewW, previewH) {
  // MediaPipe landmarks are normalized to the underlying video frame.
  // Our preview uses object-fit: cover into a fixed 3:4 box (previewW x previewH),
  // so we must map video coords -> preview coords (including crop offsets).
  const scale = Math.max(previewW / videoW, previewH / videoH);
  const dispW = videoW * scale;
  const dispH = videoH * scale;
  const offsetX = (previewW - dispW) / 2; // typically negative
  const offsetY = (previewH - dispH) / 2; // typically negative

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of landmarks) {
    const x = p.x * videoW * scale + offsetX;
    const y = p.y * videoH * scale + offsetY;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  // Clamp to preview bounds to avoid negatives from crop.
  minX = Math.max(0, Math.min(previewW, minX));
  maxX = Math.max(0, Math.min(previewW, maxX));
  minY = Math.max(0, Math.min(previewH, minY));
  maxY = Math.max(0, Math.min(previewH, maxY));

  const bw = Math.max(0, maxX - minX);
  const bh = Math.max(0, maxY - minY);
  const cx = minX + bw / 2;
  const cy = minY + bh / 2;
  return { x: minX, y: minY, w: bw, h: bh, cx, cy, minX, minY, maxX, maxY };
}


function chooseMessage(state) {
  // Priority order aligned to PerfectCorp expectations.
  if (!state.hasFace) return t("selfie.center_face");
  if (state.offX) return state.offX < 0 ? t("selfie.move_left") : t("selfie.move_right");
  if (state.offY) return state.offY < 0 ? t("selfie.move_down") : t("selfie.move_up");
  if (state.tooSmall) return t("selfie.move_closer");
  if (state.tooLarge) return t("selfie.move_back");
  if (state.foreheadHigh) return t("selfie.lower_chin");
  if (state.dark) return t("selfie.improve_lighting");
  if (state.moving) return t("selfie.hold_still");
  return t("selfie.perfect_hold");
}

function nowMs() { return (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now(); }
function isPerfectHoldMsg(msg) {
  const s = String(msg || "").trim();
  return s === t("selfie.perfect_hold") || /perfect\s*[,–—-]?\s*hold\s*still/i.test(s) || /τέλεια/i.test(s);
}

async function buildQrCanvas(url) {
  const QR = await import("https://cdn.jsdelivr.net/npm/qrcode@1.5.3/+esm");
  const canvas = document.createElement("canvas");
  // Dense URLs need a decent size and quiet zone
  await QR.toCanvas(canvas, url, {
    errorCorrectionLevel: "M",
    margin: 3,
    scale: 6,
    color: { dark: "#000000", light: "#ffffff" }
  });
  // constrain display size
  canvas.style.width = "220px";
  canvas.style.height = "220px";
  canvas.style.imageRendering = "pixelated";
  return canvas;
}

async function captureToFile(videoEl, targetShortSide = 1440, jpegQuality = 0.9) {
  const vw = videoEl.videoWidth || 0;
  const vh = videoEl.videoHeight || 0;
  if (!vw || !vh) throw new Error("Video not ready");
  // We capture a 3:4 portrait crop centered.
  const outW = Math.round(targetShortSide * 0.75); // if short side is height (portrait), width is 0.75
  const outH = targetShortSide;
  // Determine crop rectangle on source video to match 3:4 ratio.
  const targetRatio = outW / outH; // 0.75
  const srcRatio = vw / vh;
  let sx=0, sy=0, sw=vw, sh=vh;
  if (srcRatio > targetRatio) {
    // source wider: crop width
    sw = Math.round(vh * targetRatio);
    sx = Math.round((vw - sw)/2);
  } else {
    // source taller: crop height
    sh = Math.round(vw / targetRatio);
    sy = Math.round((vh - sh)/2);
  }
  const c = document.createElement("canvas");
  c.width = outW;
  c.height = outH;
  const ctx = c.getContext("2d");
  ctx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, outW, outH);
  const blob = await new Promise((resolve) => c.toBlob(resolve, "image/jpeg", jpegQuality));
  if (!blob) throw new Error("toBlob failed");
  const file = new File([blob], "selfie.jpg", { type: "image/jpeg" });
  return file;
}


// Capture current frame to JPEG File + a dataUrl preview (for in-modal review)
async function captureToFileWithPreview(videoEl, targetShortSide = 1440, jpegQuality = 0.9) {
  const vw = videoEl.videoWidth || 0;
  const vh = videoEl.videoHeight || 0;
  if (!vw || !vh) throw new Error("Video not ready");

  // 3:4 portrait crop centered (same logic as captureToFile)
  const outW = Math.round(targetShortSide * 0.75);
  const outH = targetShortSide;
  const targetRatio = outW / outH;
  const srcRatio = vw / vh;

  let sx = 0, sy = 0, sw = vw, sh = vh;
  if (srcRatio > targetRatio) {
    sw = Math.round(vh * targetRatio);
    sx = Math.round((vw - sw) / 2);
  } else {
    sh = Math.round(vw / targetRatio);
    sy = Math.round((vh - sh) / 2);
  }

  const c = document.createElement("canvas");
  c.width = outW;
  c.height = outH;
  const ctx = c.getContext("2d");
  ctx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, outW, outH);

  const dataUrl = c.toDataURL("image/jpeg", jpegQuality);
  const blob = await new Promise((resolve) => c.toBlob(resolve, "image/jpeg", jpegQuality));
  if (!blob) throw new Error("toBlob failed");

  const file = new File([blob], "selfie.jpg", { type: "image/jpeg" });
  return { file, dataUrl };
}


export async function openSelfieCapture({ orderCode, supabaseClient } = {}) {
  injectStyles();

  return await new Promise(async (resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "exSelfie_backdrop";

    const card = document.createElement("div");
    card.className = "exSelfie_card";

    const head = document.createElement("div");
    head.className = "exSelfie_head";
    head.innerHTML = `
      <div class="exSelfie_titleRow">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b89a5b" stroke-width="2"><path d="M2 7V5a2 2 0 0 1 2-2h2M2 17v2a2 2 0 0 0 2 2h2M22 7V5a2 2 0 0 0-2-2h-2M22 17v2a2 2 0 0 1-2 2h-2"/><ellipse cx="12" cy="12" rx="4" ry="5.5"/></svg>
        <h3 class="exSelfie_title">${t("selfie.capture_title")}</h3>
      </div>`;
    const closeBtn = document.createElement("button");
    closeBtn.className = "exSelfie_close";
    closeBtn.type = "button";
    closeBtn.textContent = "×";
    head.appendChild(closeBtn);

    const body = document.createElement("div");
    body.className = "exSelfie_body";

    const guidanceBox = document.createElement("div");
    guidanceBox.className = "exSelfie_guidanceBox";
    guidanceBox.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b89a5b" stroke-width="2" style="flex-shrink:0;margin-top:1px;"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
      <div class="exSelfie_guidanceText">${t("selfie.guidance")}</div>`;
    body.appendChild(guidanceBox);

    const row = document.createElement("div");
    row.className = "exSelfie_row";

    // Preview
    const previewWrap = document.createElement("div");
    previewWrap.className = "exSelfie_previewWrap";
    const frame = document.createElement("div");
    frame.className = "exSelfie_previewFrame";
    const video = document.createElement("video");
    video.className = "exSelfie_video";
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    const overlay = document.createElement("canvas");
    overlay.className = "exSelfie_overlay";
    const pill = document.createElement("div"); // kept for retake restore compatibility but hidden
    pill.className = "exSelfie_pill";
    pill.style.display = "none";
    const tip = document.createElement("div");
    tip.className = "exSelfie_tip";
    tip.textContent = t("selfie.center_face");
    frame.appendChild(video);
    const blurMask = document.createElement("div");
    blurMask.className = "exSelfie_blurMask";
    const scanLine = document.createElement("div");
    scanLine.className = "exSelfie_scanLine";
    frame.appendChild(blurMask);
    frame.appendChild(scanLine);
    frame.appendChild(overlay);
    frame.appendChild(pill);
    frame.appendChild(tip);
    previewWrap.appendChild(frame);

    // Controls
    const controls = document.createElement("div");
    controls.className = "exSelfie_controls";
    const select = document.createElement("select");
    select.className = "exSelfie_select";
    const camLabel = document.createElement("div");
    camLabel.className = "exSelfie_camLabel";
    camLabel.textContent = t("selfie.camera");

    const btnRow = document.createElement("div");
    btnRow.className = "exSelfie_btnRow";
    const refreshBtn = document.createElement("button");
    refreshBtn.className = "exSelfie_btn";
    refreshBtn.type = "button";
    refreshBtn.textContent = t("selfie.refresh_cameras");
    const qrBtn = document.createElement("button");
    qrBtn.className = "exSelfie_btn";
    qrBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:5px;"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/><rect x="18" y="18" width="3" height="3"/></svg>${t("selfie.use_phone_qr")}`;
    const takeBtn = document.createElement("button");
    takeBtn.className = "exSelfie_takeBtn";
    takeBtn.type = "button";
    takeBtn.textContent = t("selfie.take_photo");
    takeBtn.disabled = true;
    btnRow.appendChild(refreshBtn);
    const qrBtnSpacer = document.createElement("div");
    qrBtnSpacer.style.flex = "1";
    btnRow.appendChild(qrBtnSpacer);
    btnRow.appendChild(qrBtn);

    const note = document.createElement("div");
    note.className = "exSelfie_note";
    note.textContent = ""; note.style.display = "none";

    controls.appendChild(camLabel);
    controls.appendChild(select);
    // Manual Take Photo is intentionally not shown: capture happens automatically when coaching conditions are met.
    controls.appendChild(btnRow);
    controls.appendChild(note);

    row.appendChild(previewWrap);
    row.appendChild(controls);
    body.appendChild(row);

    card.appendChild(head);
    card.appendChild(body);
    backdrop.appendChild(card);
    document.body.appendChild(backdrop);

    // Prevent page scroll behind modal
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    let stream = null;
    let running = true;
    let coachingTimer = null;
    let lastCenter = null;
    let lastCenterAt = 0;
    let lastMessage = "";
    let allowCapture = false;
    let stableCount = 0;
    let perfectSince = 0;
    let autoFired = false;
    const AUTO_SNAP_MS = 1500;
  const DARK_LUMA_THRESHOLD = 85; // stricter than previous 65

  let inReview = false;

  function showReviewUI({ file, dataUrl }) {
    inReview = true;

    // Stop coaching loop and camera stream; keep modal open for review
    try {
      if (coachingTimer) {
        cancelAnimationFrame(coachingTimer);
        coachingTimer = null;
      }
    } catch (_e) {}

    stopStream();

    const img = document.createElement("img");
    img.src = dataUrl;
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "cover";
    img.style.transform = "scaleX(-1)"; // match mirrored live preview

    // Replace live view with preview
    frame.innerHTML = "";
    frame.appendChild(img);

    tip.textContent = t("selfie.review_photo");

    // Hide capture controls during review
    select.style.display = "none";
    camLabel.style.display = "none";
    refreshBtn.style.display = "none";
    qrBtn.style.display = "none";
    takeBtn.style.display = "none";

    // Update heading to "Scan completed"
    head.innerHTML = `<div class="exSelfie_titleRow"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg><h3 class="exSelfie_title">${t("selfie.scan_completed")}</h3></div>`;

    const reviewRow = document.createElement("div");
    reviewRow.className = "exSelfie_reviewBtns";

    const retakeBtn = document.createElement("button");
    retakeBtn.className = "exSelfie_btn";
    retakeBtn.type = "button";
    retakeBtn.textContent = t("selfie.retake");

    const useBtn = document.createElement("button");
    useBtn.className = "exSelfie_btn exSelfie_primary";
    useBtn.type = "button";
    useBtn.textContent = t("selfie.use_this_photo");

    reviewRow.appendChild(retakeBtn);
    reviewRow.appendChild(useBtn);
    card.appendChild(reviewRow);

    retakeBtn.onclick = async () => {
      try { reviewRow.remove(); } catch (_e) {}
      inReview = false;

      // Restore heading
      head.innerHTML = `<div class="exSelfie_titleRow"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b89a5b" stroke-width="2"><path d="M2 7V5a2 2 0 0 1 2-2h2M2 17v2a2 2 0 0 0 2 2h2M22 7V5a2 2 0 0 0-2-2h-2M22 17v2a2 2 0 0 1-2 2h-2"/><ellipse cx="12" cy="12" rx="4" ry="5.5"/></svg><h3 class="exSelfie_title">${t("selfie.capture_title")}</h3></div>`;
      head.appendChild(closeBtn);

      // Restore controls
      select.style.display = "";
      camLabel.style.display = "";
      refreshBtn.style.display = "";
      qrBtn.style.display = "";
      takeBtn.style.display = "";

      // Restore live elements
      frame.innerHTML = "";
      frame.appendChild(video);
      frame.appendChild(overlay);
      frame.appendChild(pill);
      frame.appendChild(tip);

      // Restore live elements
      frame.innerHTML = "";
      frame.appendChild(video);
      frame.appendChild(overlay);
      frame.appendChild(pill);
      frame.appendChild(tip);

      const id = select.value;
      if (id) {
        await startCamera(id);
      } else {
        tip.textContent = t("selfie.no_camera_qr");
        takeBtn.disabled = true;
      }
    };

    useBtn.onclick = () => {
      close({ file, via: "camera" });
    };
  }

    // Oval geometry: 70% width target
    function getOval() {
      const w = overlay.width || 300;
      const h = overlay.height || 400;
      const cx = w / 2;
      const cy = h * 0.52; // slightly down
      const rx = (w * 0.70) / 2;
      const ry = (h * 0.86) / 2;
      return { cx, cy, rx, ry };
    }

    function drawOverlay(faceBox, ok, scanActive, scanY) {
      const ctx = overlay.getContext("2d");
      const w = overlay.width, h = overlay.height;
      ctx.clearRect(0,0,w,h);

      const { cx, cy, rx, ry } = getOval();

      // Sync CSS vars for blur visuals (kept for blurMask)
      try {
        frame.style.setProperty("--oval-cx", cx + "px");
        frame.style.setProperty("--oval-cy", cy + "px");
        frame.style.setProperty("--oval-rx", rx + "px");
        frame.style.setProperty("--oval-ry", ry + "px");
      } catch(_e) {}

      // Darken outside oval
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(0,0,w,h);
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();

      // Oval borders
      ctx.save();
      ctx.lineWidth = 4;
      ctx.strokeStyle = ok ? "rgba(0,180,90,0.95)" : "rgba(255,255,255,0.80)";
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI*2);
      ctx.stroke();

      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx*0.82, ry*0.82, 0, 0, Math.PI*2);
      ctx.stroke();
      ctx.restore();

      // Animated scan line (drawn on canvas so it always works, no CSS clip-path dependency)
      if (scanActive) {
        const y = (typeof scanY === "number" && isFinite(scanY)) ? scanY : (cy - ry);
        ctx.save();
        // Clip to oval
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.clip();

        ctx.strokeStyle = "rgba(0,0,0,.72)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - rx, y);
        ctx.lineTo(cx + rx, y);
        ctx.stroke();
        ctx.restore();
      }

      // Optional face box outline (debug-light)
      if (faceBox) {
        ctx.save();
        ctx.strokeStyle = "rgba(0,0,0,0.12)";
        ctx.lineWidth = 2;
        ctx.strokeRect(faceBox.x, faceBox.y, faceBox.w, faceBox.h);
        ctx.restore();
      }
    }

    async function stopStream() {
      try {
        if (stream) {
          for (const t of stream.getTracks()) t.stop();
        }
      } catch (_e) {}
      stream = null;
      video.srcObject = null;
    }

    function close(result) {
      running = false;
      if (coachingTimer) {
        cancelAnimationFrame(coachingTimer);
        coachingTimer = null;
      }
      stopStream();
      document.documentElement.style.overflow = prevOverflow;
      backdrop.remove();
      resolve(result ?? null);
    }

    closeBtn.addEventListener("click", () => close(null));
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) close(null);
    });

    // Devices
    async function listCams() {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(d => d.kind === "videoinput");
    }

    function isProbablyPhoneLink(label) {
      const s = String(label || "").toLowerCase();
      return s.includes("phone") || s.includes("link") || s.includes("virtual") || s.includes("continuity");
    }

    async function populateSelect() {
      select.innerHTML = "";
      let cams = [];
      try { cams = await listCams(); } catch (_e) {}
      if (!cams.length) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = t("selfie.no_camera_found");
        select.appendChild(opt);
        return;
      }
      // Prefer non-PhoneLink first if possible
      cams.sort((a,b) => {
        const ap = isProbablyPhoneLink(a.label) ? 1 : 0;
        const bp = isProbablyPhoneLink(b.label) ? 1 : 0;
        return ap - bp;
      });
      for (const c of cams) {
        const opt = document.createElement("option");
        opt.value = c.deviceId;
        opt.textContent = c.label || ("Camera " + c.deviceId.slice(0,6));
        select.appendChild(opt);
      }
    }

    async function startCamera(deviceId) {
      try { head.style.display = ""; } catch(_e) {}
      await stopStream();
      takeBtn.disabled = true;
      // Keep guidance visible in desktop camera mode
      try { head.style.display = ""; } catch(_e) {}
      allowCapture = false;
      tip.textContent = t("selfie.requesting_permission");
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            deviceId: deviceId ? { exact: deviceId } : undefined,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false
        });
        video.srcObject = stream;
        await video.play();

        // Ensure overlay canvas matches frame CSS size (avoid scaling blur)
        overlay.width = frame.clientWidth;
        overlay.height = frame.clientHeight;

        tip.textContent = t("selfie.center_face");
        runCoachingLoop();
      } catch (e) {
        console.warn(e);
        tip.textContent = t("selfie.camera_blocked_qr");
        takeBtn.disabled = true;
      }
    }

    refreshBtn.addEventListener("click", async () => {
      await populateSelect();
      const id = select.value;
      if (id) startCamera(id);
    });
    select.addEventListener("change", () => {
      if (select.value) startCamera(select.value);
    });

    // Coaching loop (MediaPipe)
    async function runCoachingLoop() {
      let landmarker = null;
      try {
        landmarker = await getLandmarker();
      } catch (e) {
        console.warn("MediaPipe init failed:", e);
      }

      const tiny = document.createElement("canvas");
      const tctx = tiny.getContext("2d", { willReadFrequently: true });

      const loop = async () => {
        if (!running) return;
        coachingTimer = requestAnimationFrame(loop);

        const w = overlay.width, h = overlay.height;
        if (!w || !h || !video.videoWidth) return;

        // Draw base overlay first
        let faceBox = null;
        let hasFace = false;
        let tooSmall = false, tooLarge = false;
        let offX = 0, offY = 0;
        let foreheadHigh = false;
        let moving = false;
        let dark = false;

        // Lighting: compute luma on a tiny frame, preferably inside the detected face box
        let tinyImg = null;
        try {
          const tw = 160;
          const th = Math.round(160 * (h / w));
          tiny.width = tw; tiny.height = th;
          tctx.drawImage(video, 0, 0, tw, th);
          tinyImg = tctx.getImageData(0,0,tw,th);
        } catch (_e) {
          tinyImg = null;
        }

        // Face detection
        if (landmarker) {
          try {
            const res = landmarker.detectForVideo(video, nowMs());
            if (res && res.faceLandmarks && res.faceLandmarks.length) {
              hasFace = true;
              faceBox = bboxFromLandmarksToPreview(res.faceLandmarks[0], video.videoWidth, video.videoHeight, w, h);

              // Prefer lighting check on face region (mapped to tiny frame), fallback to full-frame mean
              try {
                if (tinyImg) {
                  const fbTiny = bboxFromLandmarks(res.faceLandmarks[0], tiny.width, tiny.height);
                  const meanFace = computeLumaMeanInBox(tinyImg, fbTiny);
                  const meanAll = computeLumaMean(tinyImg);
                  const mean = (isFinite(meanFace) && meanFace > 0) ? meanFace : meanAll;
                  dark = mean < DARK_LUMA_THRESHOLD;
                }
              } catch (_e) {}

              // Landmarks bbox is often slightly narrower than the true face width
              // (it may exclude ears). Apply a small padding factor so our
              // PerfectCorp-style 60–80% rule behaves as users expect.
              const paddedFaceW = faceBox.w * 1.10;
              const ratio = paddedFaceW / w; // face width ratio of preview frame
              tooSmall = ratio < 0.60;
              tooLarge = ratio > 0.80;

              const { cx, cy, rx, ry } = getOval();

      // Sync CSS vars for blur/scan visuals
      try {
        frame.style.setProperty("--oval-cx", cx + "px");
        frame.style.setProperty("--oval-cy", cy + "px");
        frame.style.setProperty("--oval-rx", rx + "px");
        frame.style.setProperty("--oval-ry", ry + "px");
      } catch(_e) {}
              const dx = (faceBox.cx - cx) / rx; // normalized to ellipse radius
              const dy = (faceBox.cy - cy) / ry;
              offX = Math.abs(dx) > 0.22 ? dx : 0;
              offY = Math.abs(dy) > 0.22 ? dy : 0;

              // Forehead inside oval: top of bbox should not be above oval top too much
              const ovalTop = cy - ry;
              foreheadHigh = faceBox.minY < (ovalTop + 8); // too high in frame

              // Motion: bbox center delta over time
              const t = nowMs();
              if (lastCenter && (t - lastCenterAt) < 650) {
                const dd = Math.hypot(faceBox.cx - lastCenter.x, faceBox.cy - lastCenter.y);
                moving = dd > 10;
              }
              lastCenter = { x: faceBox.cx, y: faceBox.cy };
              lastCenterAt = t;

              // Ellipse bound check:
              // Do NOT use bbox corners (too strict). Use midpoints so a rectangular bbox
              // around an oval face can still pass when properly aligned.
              const midOk =
                ellipseContains(cx, cy, rx, ry, faceBox.minX, faceBox.cy) &&
                ellipseContains(cx, cy, rx, ry, faceBox.maxX, faceBox.cy) &&
                ellipseContains(cx, cy, rx, ry, faceBox.cx, faceBox.minY) &&
                ellipseContains(cx, cy, rx, ry, faceBox.cx, faceBox.maxY);

              // Capture readiness (PerfectCorp-aligned):
              // - face width ratio 60–80%
              // - centered within tolerance
              // - not dark, not moving
              // - bbox midpoints inside oval
              {
              const okNow = hasFace && !tooSmall && !tooLarge && !offX && !offY && !foreheadHigh && !dark && !moving && midOk;
              stableCount = okNow ? (stableCount + 1) : 0;
              allowCapture = stableCount >= 4;
              }
            } else {
              hasFace = false;
              stableCount = 0;
              allowCapture = false;
            }
          } catch (e) {
            // If detection errors, fall back to basic checks (don't ever show "Perfect")
            stableCount = 0;
            allowCapture = false;
          }
        } else {
          // No landmarker available: fall back to lighting + motion only; require user to use QR for strict framing
          stableCount = 0;
          allowCapture = false;
        }

        // If we don't have a face box yet, still enforce a conservative lighting threshold on the whole frame
        if (!hasFace) {
          try {
            if (tinyImg) {
              const meanAll = computeLumaMean(tinyImg);
              dark = meanAll < DARK_LUMA_THRESHOLD;
            }
          } catch (_e) {}
        }


        const msg = chooseMessage({
          hasFace, tooSmall, tooLarge,
          offX: offX || 0,
          offY: offY || 0,
          foreheadHigh,
          dark, moving
        });
        const isPerfectHold = !!(allowCapture && isPerfectHoldMsg(msg));
        try { frame.classList.toggle("scanning-active", isPerfectHold); } catch(_e) {}
        if (msg !== lastMessage) {
          tip.textContent = msg;
          lastMessage = msg;
        }

        // Auto-snap on desktop: when conditions are Perfect for ~1.5s, capture automatically
        const now = nowMs();
        const perfectNow = isPerfectHold;
        if (perfectNow) {
          if (!perfectSince) perfectSince = now;
          if (!autoFired && (now - perfectSince) >= AUTO_SNAP_MS) {
            autoFired = true;
            takeBtn.disabled = true;
            tip.textContent = t("selfie.perfect_capturing");
          try { frame.classList.remove("scanning-active"); } catch(_e) {}
            lastMessage = tip.textContent;
            try {
              const { file, dataUrl } = await captureToFileWithPreview(video, 1440, 0.9);
              showReviewUI({ file, dataUrl });
              return;
            } catch (e) {
              console.warn(e);
              autoFired = false;
              perfectSince = 0;
              tip.textContent = t("selfie.capture_failed");
              lastMessage = tip.textContent;
            }
          }
        } else {
          perfectSince = 0;
          autoFired = false;
        }


        // Note line stable
        note.textContent = allowCapture
          ? "Ready to capture."
          : "Target face width ~70% (acceptable 60–80%). Remove glasses if possible. Bright, even lighting.";

        const _oval = getOval();
        const _scanPeriod = 1600; // ms
        const _scanY = (isPerfectHold ? (_oval.cy - _oval.ry + ((now % _scanPeriod) / _scanPeriod) * (2 * _oval.ry)) : null);

        drawOverlay(faceBox, allowCapture, isPerfectHold, _scanY);
      };

      coachingTimer = requestAnimationFrame(loop);
    }

    takeBtn.addEventListener("click", async () => {
      try {
        if (inReview) return;
        const { file, dataUrl } = await captureToFileWithPreview(video, 1440, 0.9);
        showReviewUI({ file, dataUrl });
      } catch (e) {
        console.warn(e);
        tip.textContent = t("selfie.capture_failed");
      }
    });
// QR fallback (phone capture)
    async function showQrFallback() {
      // Stop camera to avoid confusion
      await stopStream();
      takeBtn.disabled = true;

      // Replace head with QR-specific header
      head.innerHTML = `
        <div class="exSelfie_titleRow">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b89a5b" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/><rect x="18" y="18" width="3" height="3"/></svg>
          <h3 class="exSelfie_title">${t("selfie.scan_with_phone")}</h3>
        </div>`;
      head.appendChild(closeBtn);

      body.innerHTML = "";
      const wrap = document.createElement("div");
      wrap.className = "exSelfie_qrWrap";

      // Instruction line above QR
      const topHint = document.createElement("div");
      topHint.style.cssText = "font:500 13px/1.5 Montserrat,system-ui,sans-serif;color:#6b7280;text-align:center;";
      topHint.textContent = t("selfie.phone_open_camera");
      wrap.appendChild(topHint);

      const qrBox = document.createElement("div");
      qrBox.className = "exSelfie_qrBox";
      qrBox.style.cssText = "background:#fff;border-radius:16px;border:2px solid rgba(184,154,91,0.3);padding:16px;box-shadow:0 4px 20px rgba(0,0,0,.08);";

      const sid = "sc_" + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
      const baseUrl = (() => {
        const u = new URL(window.location.href);
        u.pathname = u.pathname.replace(/\/[^\/]*$/, "/selfie_qr.html");
        u.search = "";
        u.hash = "";
        return u.toString();
      })();
      const su = supabaseClient?.supabaseUrl || "";
      const ak = supabaseClient?.supabaseKey || "";
      const url = baseUrl + `?sid=${encodeURIComponent(sid)}&oc=${encodeURIComponent(orderCode || "")}&su=${encodeURIComponent(su)}&ak=${encodeURIComponent(ak)}&lang=${encodeURIComponent(getLanguage())}`;

      try {
        const qrCanvas = await buildQrCanvas(url);
        qrBox.appendChild(qrCanvas);
      } catch (e) {
        console.warn("QR generation failed:", e);
        qrBox.textContent = t("selfie.qr_generation_failed");
      }

      const hint = document.createElement("div");
      hint.className = "exSelfie_qrHint";
      hint.style.cssText = "font:600 14px/1.5 Montserrat,system-ui,sans-serif;color:#1a1a1a;text-align:center;max-width:320px;";
      hint.textContent = t("selfie.phone_send_auto");

      const status = document.createElement("div");
      status.className = "exSelfie_note";
      status.style.cssText = "width:100%;max-width:280px;margin-top:4px;";
      status.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:8px;font:500 12px/1 system-ui,sans-serif;color:#6b7280;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#b89a5b" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          <span id="exSelfie_statusText">${t("selfie.waiting_phone")}</span>
        </div>
        <div style="width:100%;height:4px;background:rgba(184,154,91,0.15);border-radius:999px;overflow:hidden;">
          <div style="height:100%;width:40%;background:#b89a5b;border-radius:999px;animation:exSelfie_slide 1.4s ease-in-out infinite;"></div>
        </div>`;

      const cancel = document.createElement("button");
      cancel.className = "exSelfie_btn";
      cancel.type = "button";
      cancel.style.cssText = "margin-top:4px;padding:10px 28px;";
      cancel.textContent = t("common.cancel");
      cancel.addEventListener("click", () => close(null));

      wrap.appendChild(qrBox);
      wrap.appendChild(hint);
      wrap.appendChild(status);
      wrap.appendChild(cancel);
      body.appendChild(wrap);

      // Listen for phone upload via Realtime channel
      if (!supabaseClient) {
        const _st3 = status.querySelector('#exSelfie_statusText'); if(_st3) _st3.textContent = 'Supabase client missing.'; else status.textContent = 'Supabase client missing.';
        return;
      }
      try {
        const ch = supabaseClient.channel("selfie_" + sid, { config: { broadcast: { self: true } } });
        let received = null;

        ch.on("broadcast", { event: "selfie_chunk" }, (payload) => {
          // base64 chunks
          const { idx, total, data } = payload?.payload || {};
          if (typeof idx !== "number" || typeof total !== "number" || typeof data !== "string") return;
          if (!received) received = { total, parts: Array(total).fill(null) };
          received.parts[idx] = data;
          const done = received.parts.filter(Boolean).length;
          const _st = status.querySelector('#exSelfie_statusText'); if(_st) _st.textContent = `Receiving… ${done}/${total}`; else status.textContent = `Receiving… ${done}/${total}`;
          if (done === total) {
            const b64 = received.parts.join("");
            const bin = atob(b64);
            const bytes = new Uint8Array(bin.length);
            for (let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
            const blob = new Blob([bytes], { type: "image/jpeg" });
            const file = new File([blob], "selfie.jpg", { type: "image/jpeg" });
            const _st2 = status.querySelector('#exSelfie_statusText'); if(_st2) _st2.textContent = 'Received. Continuing…'; else status.textContent = 'Received. Continuing…';
            try { ch.unsubscribe(); } catch(_e) {}
            close({ file, via: "qr" });
          }
        });

        ch.subscribe((st) => {
          if (st === "SUBSCRIBED") {
            // ok
          }
        });
      } catch (e) {
        console.warn(e);
        const _st4 = status.querySelector('#exSelfie_statusText'); if(_st4) _st4.textContent = 'Realtime error — please rescan QR.'; else status.textContent = 'Realtime error.';
      }
    }

    qrBtn.addEventListener("click", () => {
      showQrFallback();
    });

    // Init
    try {
      try {
        const pre = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        pre.getTracks().forEach(t => t.stop());
      } catch(_e) {}

      await populateSelect();

      if (select.options.length && select.value) {
        await startCamera(select.value);
      } else {
        try {
          await startCamera("");
        } catch(_e) {
          tip.textContent = t("selfie.no_camera_qr");
        }
      }
    } catch (e) {
      console.warn(e);
      tip.textContent = t("selfie.camera_unavailable_qr");
    }
  });
}
