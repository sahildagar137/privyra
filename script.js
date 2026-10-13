const MAX_FILE_SIZE = 15 * 1024 * 1024;

const photoInput = document.getElementById("photoInput");
const pdfInput = document.getElementById("pdfInput");
const scanPhotoBtn = document.getElementById("scanPhotoBtn");
const scanPdfBtn = document.getElementById("scanPdfBtn");
const photoResults = document.getElementById("photoResults");
const pdfResults = document.getElementById("pdfResults");
const textResults = document.getElementById("textResults");

document.getElementById("year").textContent = new Date().getFullYear();

photoInput.addEventListener("change", () => {
  const file = photoInput.files && photoInput.files[0];
  document.getElementById("photoFileName").textContent = file ? file.name : "No file selected";
  scanPhotoBtn.disabled = !file;
  photoResults.innerHTML = "";
});

pdfInput.addEventListener("change", () => {
  const file = pdfInput.files && pdfInput.files[0];
  document.getElementById("pdfFileName").textContent = file ? file.name : "No file selected";
  scanPdfBtn.disabled = !file;
  pdfResults.innerHTML = "";
});

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "Not present";
  if (Array.isArray(value)) return value.map(formatValue).join(", ");
  if (typeof value === "object") {
    try { return JSON.stringify(value); } catch { return "[Complex value]"; }
  }
  return String(value);
}

function renderResults(target, title, rows, note) {
  const body = rows.length
    ? `<table class="result-table"><tbody>${rows.map(([key, value]) =>
        `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(formatValue(value))}</td></tr>`
      ).join("")}</tbody></table>`
    : `<div class="result-empty">No readable metadata fields were found by this basic scan.</div>`;
  target.innerHTML = `<div class="result-box"><div class="result-heading">${escapeHtml(title)}</div><div class="result-note">${escapeHtml(note)}</div>${body}</div>`;
}

function renderError(target, message) {
  target.innerHTML = `<div class="result-box"><div class="result-error">${escapeHtml(message)}</div></div>`;
}

function validateFile(file, kind) {
  if (!file) {
    renderError(kind === "photo" ? photoResults : pdfResults, "Choose a file first.");
    return false;
  }
  if (file.size > MAX_FILE_SIZE) {
    renderError(kind === "photo" ? photoResults : pdfResults, "This file is larger than 15 MB. Choose a smaller file.");
    return false;
  }
  if (kind === "pdf" && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    renderError(pdfResults, "Please choose a PDF file.");
    return false;
  }
  if (kind === "photo" && !file.type.startsWith("image/") && !/\.(jpe?g|tiff?)$/i.test(file.name)) {
    renderError(photoResults, "Please choose an image file.");
    return false;
  }
  return true;
}

function collectExifRows(tags) {
  if (!tags || typeof tags !== "object") return [];
  const preferred = [
    ["Image description", tags.ImageDescription],
    ["Camera make", tags.Make],
    ["Camera model", tags.Model],
    ["Date/time", tags.DateTimeOriginal || tags.DateTime || tags.CreateDate],
    ["Software", tags.Software],
    ["GPS latitude", tags.GPSLatitude],
    ["GPS longitude", tags.GPSLongitude],
    ["Orientation", tags.Orientation],
    ["Image width", tags.ImageWidth || tags["Image Width"]],
    ["Image height", tags.ImageHeight || tags["Image Height"]],
    ["Copyright", tags.Copyright],
    ["Artist", tags.Artist]
  ];
  const rows = preferred
    .filter(([, value]) => value !== undefined && value !== null && value.description !== undefined ? true : value !== undefined && value !== null)
    .map(([label, value]) => [label, value && typeof value === "object" && "description" in value ? value.description : value]);

  // Include a few other available tags so the result remains useful across devices.
  if (rows.length === 0) {
    Object.entries(tags).slice(0, 20).forEach(([key, value]) => {
      if (value && typeof value === "object" && "description" in value) rows.push([key, value.description]);
      else if (["string", "number", "boolean"].includes(typeof value)) rows.push([key, value]);
    });
  }
  return rows;
}

scanPhotoBtn.addEventListener("click", async () => {
  const file = photoInput.files && photoInput.files[0];
  if (!validateFile(file, "photo")) return;
  scanPhotoBtn.disabled = true;
  scanPhotoBtn.textContent = "Scanning…";
  photoResults.innerHTML = "";
  try {
    if (!window.ExifReader || typeof window.ExifReader.load !== "function") {
      throw new Error("The metadata library did not load. Check your internet connection and try again.");
    }
    const tags = await window.ExifReader.load(file, { expanded: true });
    const rows = collectExifRows(tags);
    const gpsFound = rows.some(([label]) => /gps latitude|gps longitude/i.test(label));
    const note = gpsFound
      ? "Possible location metadata was found. Confirm the values before sharing."
      : "This scan did not find common GPS fields. That does not guarantee the image contains no location information.";
    renderResults(photoResults, "Photo scan complete", rows, note);
  } catch (error) {
    renderError(photoResults, error && error.message ? error.message : "Could not read metadata from this file. It may be unsupported or have no readable metadata.");
  } finally {
    scanPhotoBtn.disabled = false;
    scanPhotoBtn.textContent = "Scan photo";
  }
});

scanPdfBtn.addEventListener("click", async () => {
  const file = pdfInput.files && pdfInput.files[0];
  if (!validateFile(file, "pdf")) return;
  scanPdfBtn.disabled = true;
  scanPdfBtn.textContent = "Scanning…";
  pdfResults.innerHTML = "";
  let pdfDocument;
  try {
    if (!window.pdfjsLib) {
      throw new Error("The PDF library did not load. Check your internet connection and try again.");
    }
    const buffer = await file.arrayBuffer();
    const loadingTask = window.pdfjsLib.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false });
    pdfDocument = await loadingTask.promise;
    const metadataResult = await pdfDocument.getMetadata();
    const info = metadataResult && metadataResult.info ? metadataResult.info : {};
    const rows = [
      ["Title", info.Title],
      ["Author", info.Author],
      ["Subject", info.Subject],
      ["Creator", info.Creator],
      ["Producer", info.Producer],
      ["Creation date", info.CreationDate],
      ["Modification date", info.ModDate],
      ["PDF version", info.PDFFormatVersion],
      ["Page count", pdfDocument.numPages],
      ["Encrypted", pdfDocument.isEncrypted ? "Yes" : "No"]
    ].filter(([, value]) => value !== undefined && value !== null && value !== "");
    renderResults(pdfResults, "PDF scan complete", rows,
      "Only document properties exposed by the PDF reader are shown. This is not a full content or malware scan.");
  } catch (error) {
    renderError(pdfResults, error && error.message ? error.message : "Could not read this PDF. It may be damaged, encrypted or unsupported.");
  } finally {
    if (pdfDocument && typeof pdfDocument.destroy === "function") {
      try { await pdfDocument.destroy(); } catch {}
    }
    scanPdfBtn.disabled = false;
    scanPdfBtn.textContent = "Scan PDF";
  }
});

document.getElementById("scanTextBtn").addEventListener("click", () => {
  const text = document.getElementById("textInput").value;
  if (!text.trim()) {
    renderError(textResults, "Paste some text to check.");
    return;
  }
  const patterns = [
    ["Email-like addresses", /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi],
    ["Phone-like numbers", /(?:\+?\d[\d\s().-]{7,}\d)/g],
    ["API-key-like strings", /\b(?:sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9_]{20,})\b/g]
  ];
  const rows = patterns.map(([label, pattern]) => {
    const matches = text.match(pattern) || [];
    return [label, matches.length ? `${matches.length} possible match(es) found` : "No matches found"];
  });
  renderResults(textResults, "Text pattern check complete", rows,
    "Matches are only pattern-based clues. The scanner does not send this text to a server and cannot verify whether a secret is valid.");
});

// Optional drag-and-drop for the two file areas.
function setupDropzone(zoneId, input, resultsTarget, nameId, button) {
  const zone = document.getElementById(zoneId);
  ["dragenter", "dragover"].forEach(eventName => zone.addEventListener(eventName, event => {
    event.preventDefault();
    zone.classList.add("dragover");
  }));
  ["dragleave", "drop"].forEach(eventName => zone.addEventListener(eventName, event => {
    event.preventDefault();
    zone.classList.remove("dragover");
  }));
  zone.addEventListener("drop", event => {
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    if (!file) return;
    try {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
      input.dispatchEvent(new Event("change"));
    } catch {
      renderError(resultsTarget, "Drag-and-drop was not supported by this browser. Use the Choose file control instead.");
    }
  });
}
setupDropzone("photoDropzone", photoInput, photoResults, "photoFileName", scanPhotoBtn);
setupDropzone("pdfDropzone", pdfInput, pdfResults, "pdfFileName", scanPdfBtn);
