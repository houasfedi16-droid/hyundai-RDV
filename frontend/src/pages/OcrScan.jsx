import { createWorker, PSM } from "tesseract.js";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Webcam from "react-webcam";

const EMPTY_RESULT = {
  model: "",
  plateNumber: "",
  rawText: "",
  confidence: 0,
  warnings: [],
  debugImages: [],
};

const MODEL_PATTERNS = [
  { model: "Hyundai Grand i10 Xcent", terms: ["grand i10", "grand", "xcent", "ab41ca", "a841ca"] },
  { model: "Hyundai Tucson", terms: ["tucson"] },
  { model: "Hyundai Elantra", terms: ["elantra"] },
  { model: "Hyundai Santa Fe", terms: ["santa fe", "santafe"] },
  { model: "Hyundai Kona", terms: ["kona"] },
  { model: "Hyundai Accent", terms: ["accent"] },
  { model: "Hyundai i20", terms: ["i20"] },
  { model: "Hyundai i10", terms: ["i10"] },
];

const EXCLUDED_PLATE_NUMBERS = new Set([
  "2018",
  "2019",
  "2020",
  "2021",
  "2022",
  "2023",
  "2024",
  "2025",
  "2026",
]);

const OCR_DIRECTIONS = [
  { key: "normal", label: "0 deg", rotate: 0 },
  { key: "clockwise", label: "+90 deg", rotate: Math.PI / 2 },
  { key: "counter", label: "-90 deg", rotate: -Math.PI / 2 },
  { key: "upsideDown", label: "180 deg", rotate: Math.PI },
];

const PLATE_BAND_CROP = { x: 0.04, y: 0.5, width: 0.92, height: 0.42 };

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = typeof file === "string" ? file : URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      if (typeof file !== "string") URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      if (typeof file !== "string") URL.revokeObjectURL(url);
      reject(new Error("Image illisible"));
    };

    img.src = url;
  });
}

function normalizeOcrText(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function detectModel(text) {
  const normalized = normalizeOcrText(text);
  const match = MODEL_PATTERNS.find(({ terms }) =>
    terms.some((term) => normalized.includes(term))
  );

  if (match) return match.model;
  if (normalized.includes("hyundai")) return "Hyundai";
  return "";
}

function isTunisianRegistrationCard(text) {
  const normalized = normalizeOcrText(text);

  return (
    normalized.includes("certificat") ||
    normalized.includes("immatriculation") ||
    normalized.includes("republique tunisienne") ||
    normalized.includes("tunisienne")
  );
}

function cleanPlateCandidate(value) {
  return value
    .toUpperCase()
    .replace(/[OoQ]/g, "0")
    .replace(/[Il|]/g, "1")
    .replace(/S/g, "5")
    .replace(/B/g, "8")
    .replace(/G/g, "6")
    .replace(/Z/g, "2")
    .replace(/[^\dA-Z\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getPlateNumbers(text) {
  const cleaned = cleanPlateCandidate(text);
  const numbers = cleaned.match(/\b\d{2,4}\b/g) || [];
  const compactDigits = cleaned.replace(/\D/g, "");

  if (compactDigits.length >= 2 && compactDigits.length <= 4) {
    numbers.push(compactDigits);
  }

  return [...new Set(numbers)].filter(
    (number) => !EXCLUDED_PLATE_NUMBERS.has(number)
  );
}

function formatPlateParts(first, second) {
  if (!first || !second) return "";

  const parts = [first, second];
  const left = parts.find((number) => number.length >= 2 && number.length <= 3);
  const right = parts.find((number) => number.length === 4);

  if (left && right) return `${left} TUN ${right}`;
  return `${first} TUN ${second}`;
}

function scorePlateCandidate(candidate, expectedLength) {
  const lengthScore = candidate.value.length === expectedLength ? 120 : 0;
  const priorityScore = candidate.priority * 30;
  const confidenceScore = Math.max(0, candidate.confidence || 0);
  const repeatedDigitPenalty = /(\d)\1{2,}/.test(candidate.value) ? 35 : 0;

  return lengthScore + priorityScore + confidenceScore - repeatedDigitPenalty;
}

function bestCandidate(candidates, expectedLength) {
  const candidate = candidates
    .filter((item) => item.value.length === expectedLength)
    .sort((a, b) => scorePlateCandidate(b, expectedLength) - scorePlateCandidate(a, expectedLength))[0];

  return candidate || null;
}

function getCandidatesFromRecognition(recognition, priority, source = "ocr") {
  return getPlateNumbers(recognition.data.text || "").map((value) => ({
    value,
    priority,
    source,
    confidence: recognition.data.confidence || 0,
  }));
}

function getStrictVerticalCandidate(candidates, expectedLengths) {
  const allowedLengths = Array.isArray(expectedLengths) ? expectedLengths : [expectedLengths];
  const filtered = candidates.filter((candidate) =>
    allowedLengths.includes(candidate.value.length)
  );

  if (filtered.length === 0) return "";

  const grouped = filtered.reduce((groups, candidate) => {
    const current = groups.get(candidate.value) || {
      value: candidate.value,
      votes: 0,
      score: 0,
      bestConfidence: 0,
      digitOnlyVotes: 0,
    };

    current.votes += 1;
    current.score += scorePlateCandidate(candidate, candidate.value.length);
    current.bestConfidence = Math.max(current.bestConfidence, candidate.confidence || 0);
    current.digitOnlyVotes += candidate.source.includes("digit") ? 1 : 0;
    groups.set(candidate.value, current);
    return groups;
  }, new Map());

  const best = [...grouped.values()].sort((a, b) => {
    if (b.digitOnlyVotes !== a.digitOnlyVotes) return b.digitOnlyVotes - a.digitOnlyVotes;
    if (b.votes !== a.votes) return b.votes - a.votes;
    return b.score - a.score;
  })[0];

  if (!best) return "";

  const hasConsensus = best.votes >= 2 || best.digitOnlyVotes >= 2;
  const hasStrongDigitRead = best.digitOnlyVotes >= 1 && best.bestConfidence >= 45;

  return hasConsensus || hasStrongDigitRead ? best.value : "";
}

function getContextNumber(text, expectedLength) {
  return getPlateNumbers(text).find((number) => number.length === expectedLength) || "";
}

function reconcileVerticalCandidate(candidate, contextText, expectedLength) {
  if (!candidate) return getContextNumber(contextText, expectedLength);

  const contextNumbers = getPlateNumbers(contextText);
  const contextMatch = contextNumbers.find((number) => number.length === expectedLength);
  const appearsInContext = contextNumbers.includes(candidate.value);

  if (appearsInContext || !contextMatch) {
    return candidate.value;
  }

  return contextMatch;
}

function detectVerticalPlate(topCandidates, bottomCandidates, contextText = "") {
  const topLongCandidate = bestCandidate(topCandidates, 4);
  const bottomShortCandidate =
    bestCandidate(bottomCandidates, 3) || bestCandidate(bottomCandidates, 2);
  const topLong = reconcileVerticalCandidate(topLongCandidate, contextText, 4);
  const bottomShort =
    reconcileVerticalCandidate(bottomShortCandidate, contextText, 3) ||
    reconcileVerticalCandidate(bottomShortCandidate, contextText, 2);

  if (topLong && bottomShort) {
    return `${bottomShort} TUN ${topLong}`;
  }

  const fallback = getPlateNumbers(contextText);
  const fallbackLong = fallback.find((number) => number.length === 4) || "";
  const fallbackShort =
    fallback.find((number) => number.length === 3) ||
    fallback.find((number) => number.length === 2) ||
    "";

  if (fallbackLong && fallbackShort) {
    return `${fallbackShort} TUN ${fallbackLong}`;
  }

  return "";
}

function detectStrictTunisianVerticalPlate(topCandidates, bottomCandidates) {
  const topLong = getStrictVerticalCandidate(topCandidates, 4);
  const bottomShort = getStrictVerticalCandidate(bottomCandidates, [2, 3]);

  return topLong && bottomShort ? `${bottomShort} TUN ${topLong}` : "";
}

function detectPlate(...texts) {
  const combined = cleanPlateCandidate(texts.join(" "));
  const direct = combined.match(/\b(\d{2,4})\s*(?:TUN|TN|TUNIS|TUNISIE)?\s*(\d{3,4})\b/);

  if (
    direct &&
    !EXCLUDED_PLATE_NUMBERS.has(direct[1]) &&
    !EXCLUDED_PLATE_NUMBERS.has(direct[2])
  ) {
    return formatPlateParts(direct[1], direct[2]);
  }

  const numbers = getPlateNumbers(combined);
  const left = numbers.find((number) => number.length >= 2 && number.length <= 3) || "";
  const right = numbers.find((number) => number.length === 4) || "";

  return formatPlateParts(left, right);
}

function confidenceLabel(value) {
  if (value >= 82) return "Haute";
  if (value >= 60) return "Moyenne";
  if (value > 0) return "A verifier";
  return "En attente";
}

function buildCanvas(source, options = {}) {
  const {
    crop = { x: 0, y: 0, width: 1, height: 1 },
    rotate = 0,
    scaleTarget = 1900,
    threshold = false,
    trimDark = false,
    padding = 24,
  } = options;

  const sx = source.width * crop.x;
  const sy = source.height * crop.y;
  const sw = source.width * crop.width;
  const sh = source.height * crop.height;
  const scale = Math.min(3, Math.max(1.4, scaleTarget / Math.max(sw, 1)));
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const outputWidth = sw * scale;
  const outputHeight = sh * scale;
  const isQuarterTurn = Math.abs(Math.sin(rotate)) > 0.5;

  canvas.width = isQuarterTurn ? outputHeight : outputWidth;
  canvas.height = isQuarterTurn ? outputWidth : outputHeight;

  ctx.save();
  ctx.filter = "grayscale(100%) contrast(185%) brightness(108%)";

  if (rotate) {
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(rotate);
    ctx.drawImage(source, sx, sy, sw, sh, -outputWidth / 2, -outputHeight / 2, outputWidth, outputHeight);
  } else {
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, outputWidth, outputHeight);
  }

  ctx.restore();

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;

  for (let index = 0; index < data.length; index += 4) {
    const gray = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
    const value = threshold ? (gray > 132 ? 255 : 0) : Math.max(0, Math.min(255, (gray - 118) * 1.55 + 138));
    data[index] = value;
    data[index + 1] = value;
    data[index + 2] = value;
  }

  ctx.putImageData(imageData, 0, 0);

  if (!trimDark) return canvas;

  return trimDarkPixels(canvas, padding);
}

function trimDarkPixels(canvas, padding = 24) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const index = (y * canvas.width + x) * 4;
      const value = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;

      if (value < 120) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (minX >= maxX || minY >= maxY) return canvas;

  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const output = document.createElement("canvas");
  const outputCtx = output.getContext("2d", { willReadFrequently: true });

  output.width = width + padding * 2;
  output.height = height + padding * 2;
  outputCtx.fillStyle = "white";
  outputCtx.fillRect(0, 0, output.width, output.height);
  outputCtx.drawImage(canvas, minX, minY, width, height, padding, padding, width, height);

  return output;
}

function canvasDebugImage(label, canvas) {
  return {
    label,
    src: canvas.toDataURL("image/jpeg", 0.86),
  };
}

function getRecognitionText(recognition) {
  return recognition?.data?.text || "";
}

function getRecognitionConfidence(recognitions) {
  const values = recognitions.map(({ recognition }) => recognition.data.confidence || 0);
  return Math.max(0, ...values);
}

function formatDirectionalText(recognitions) {
  return recognitions
    .map(({ label, recognition }) => `[${label}]\n${getRecognitionText(recognition).trim()}`)
    .join("\n\n")
    .trim();
}

async function preprocessImage(file) {
  const source = await loadImage(file);
  const fullDirectional = OCR_DIRECTIONS.map((direction) => ({
    ...direction,
    canvas: buildCanvas(source, {
      rotate: direction.rotate,
      scaleTarget: 2100,
    }),
  }));
  const plateDirectional = OCR_DIRECTIONS.map((direction) => ({
    ...direction,
    canvas: buildCanvas(source, {
      crop: PLATE_BAND_CROP,
      rotate: direction.rotate,
      scaleTarget: 1800,
      threshold: true,
    }),
  }));

  const canvases = {
    full: fullDirectional[0].canvas,
    fullDirectional,
    plateBand: plateDirectional[0].canvas,
    plateDirectional,
    leftStrip: buildCanvas(source, {
      crop: { x: 0, y: 0.04, width: 0.2, height: 0.92 },
      rotate: -Math.PI / 2,
      scaleTarget: 1600,
      threshold: true,
    }),
    verticalTopDigitClockwise: buildCanvas(source, {
      crop: { x: 0.052, y: 0.02, width: 0.072, height: 0.3 },
      rotate: Math.PI / 2,
      scaleTarget: 2200,
      threshold: true,
      trimDark: true,
      padding: 36,
    }),
    verticalTopDigitCounter: buildCanvas(source, {
      crop: { x: 0.052, y: 0.02, width: 0.072, height: 0.3 },
      rotate: -Math.PI / 2,
      scaleTarget: 2200,
      threshold: true,
      trimDark: true,
      padding: 36,
    }),
    verticalTopTightClockwise: buildCanvas(source, {
      crop: { x: 0.025, y: 0.02, width: 0.12, height: 0.29 },
      rotate: Math.PI / 2,
      scaleTarget: 1900,
      threshold: true,
      trimDark: true,
    }),
    verticalTopTightCounter: buildCanvas(source, {
      crop: { x: 0.025, y: 0.02, width: 0.12, height: 0.29 },
      rotate: -Math.PI / 2,
      scaleTarget: 1900,
      threshold: true,
      trimDark: true,
    }),
    verticalTopClockwise: buildCanvas(source, {
      crop: { x: 0.015, y: 0.015, width: 0.16, height: 0.34 },
      rotate: Math.PI / 2,
      scaleTarget: 1800,
      threshold: true,
      trimDark: true,
    }),
    verticalTopCounter: buildCanvas(source, {
      crop: { x: 0.015, y: 0.015, width: 0.16, height: 0.34 },
      rotate: -Math.PI / 2,
      scaleTarget: 1800,
      threshold: true,
      trimDark: true,
    }),
    verticalBottomDigitClockwise: buildCanvas(source, {
      crop: { x: 0.052, y: 0.68, width: 0.072, height: 0.28 },
      rotate: Math.PI / 2,
      scaleTarget: 2200,
      threshold: true,
      trimDark: true,
      padding: 36,
    }),
    verticalBottomDigitCounter: buildCanvas(source, {
      crop: { x: 0.052, y: 0.68, width: 0.072, height: 0.28 },
      rotate: -Math.PI / 2,
      scaleTarget: 2200,
      threshold: true,
      trimDark: true,
      padding: 36,
    }),
    verticalBottomTightClockwise: buildCanvas(source, {
      crop: { x: 0.025, y: 0.68, width: 0.12, height: 0.28 },
      rotate: Math.PI / 2,
      scaleTarget: 1900,
      threshold: true,
      trimDark: true,
    }),
    verticalBottomTightCounter: buildCanvas(source, {
      crop: { x: 0.025, y: 0.68, width: 0.12, height: 0.28 },
      rotate: -Math.PI / 2,
      scaleTarget: 1900,
      threshold: true,
      trimDark: true,
    }),
    verticalBottomClockwise: buildCanvas(source, {
      crop: { x: 0.015, y: 0.62, width: 0.16, height: 0.36 },
      rotate: Math.PI / 2,
      scaleTarget: 1800,
      threshold: true,
      trimDark: true,
    }),
    verticalBottomCounter: buildCanvas(source, {
      crop: { x: 0.015, y: 0.62, width: 0.16, height: 0.36 },
      rotate: -Math.PI / 2,
      scaleTarget: 1800,
      threshold: true,
      trimDark: true,
    }),
  };

  return {
    ...canvases,
    debugImages: [
      canvasDebugImage("Document 0 deg", canvases.fullDirectional[0].canvas),
      canvasDebugImage("Document +90 deg", canvases.fullDirectional[1].canvas),
      canvasDebugImage("Document -90 deg", canvases.fullDirectional[2].canvas),
      canvasDebugImage("Document 180 deg", canvases.fullDirectional[3].canvas),
      canvasDebugImage("Top digits only +90", canvases.verticalTopDigitClockwise),
      canvasDebugImage("Top digits only -90", canvases.verticalTopDigitCounter),
      canvasDebugImage("Bottom digits only +90", canvases.verticalBottomDigitClockwise),
      canvasDebugImage("Bottom digits only -90", canvases.verticalBottomDigitCounter),
      canvasDebugImage("Top vertical tight +90", canvases.verticalTopTightClockwise),
      canvasDebugImage("Top vertical tight -90", canvases.verticalTopTightCounter),
      canvasDebugImage("Bottom vertical tight +90", canvases.verticalBottomTightClockwise),
      canvasDebugImage("Bottom vertical tight -90", canvases.verticalBottomTightCounter),
    ],
  };
}

export default function OcrScan() {
  const navigate = useNavigate();
  const webcamRef = useRef(null);
  const inputRef = useRef(null);
  const [mode, setMode] = useState("upload");
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState("");
  const [result, setResult] = useState(EMPTY_RESULT);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ label: "Pret", percent: 0 });
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState("");

  const resetResult = () => {
    setResult(EMPTY_RESULT);
    setProgress({ label: "Pret", percent: 0 });
    setError("");
  };

  const setSelectedFile = (file, previewUrl = "") => {
    if (!file) return;

    setImage(file);
    setPreview(previewUrl || URL.createObjectURL(file));
    resetResult();
  };

  const handleImageChange = (event) => {
    setSelectedFile(event.target.files?.[0]);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    setSelectedFile(event.dataTransfer.files?.[0]);
  };

  const captureImage = async () => {
    const imageSrc = webcamRef.current?.getScreenshot();

    if (!imageSrc) {
      setError("Camera indisponible. Verifiez l'autorisation du navigateur.");
      return;
    }

    const response = await fetch(imageSrc);
    const blob = await response.blob();
    setSelectedFile(new File([blob], "vehicle-scan.jpg", { type: "image/jpeg" }), imageSrc);
  };

  const handleScan = async () => {
    if (!image) {
      setError("Choisissez ou capturez une image avant de lancer l'analyse.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(EMPTY_RESULT);
    setProgress({ label: "Preparation de l'image", percent: 8 });

    let worker;

    try {
      const canvases = await preprocessImage(image);

      worker = await createWorker("eng+fra+ara", 1, {
        logger: (message) => {
          if (message.status) {
            setProgress({
              label: message.status.replace(/_/g, " "),
              percent: Math.max(12, Math.round((message.progress || 0) * 100)),
            });
          }
        },
      });

      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        preserve_interword_spaces: "1",
      });

      setProgress({ label: "Lecture du document toutes orientations", percent: 28 });
      const fullRecognitions = [];

      for (const direction of canvases.fullDirectional) {
        const recognition = await worker.recognize(direction.canvas);
        fullRecognitions.push({ ...direction, recognition });
      }

      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        tessedit_char_whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ",
        preserve_interword_spaces: "1",
      });

      setProgress({ label: "Lecture de la plaque toutes orientations", percent: 56 });
      const plateRecognitions = [];

      for (const direction of canvases.plateDirectional) {
        const recognition = await worker.recognize(direction.canvas);
        plateRecognitions.push({ ...direction, recognition });
      }

      const leftStrip = await worker.recognize(canvases.leftStrip);

      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_WORD,
        tessedit_char_whitelist: "0123456789",
        classify_bln_numeric_mode: "1",
        user_defined_dpi: "300",
        tessedit_do_invert: "0",
      });

      setProgress({ label: "Lecture plaque verticale", percent: 78 });
      const verticalTopDigitClockwise = await worker.recognize(canvases.verticalTopDigitClockwise);
      const verticalTopDigitCounter = await worker.recognize(canvases.verticalTopDigitCounter);
      const verticalTopTightClockwise = await worker.recognize(canvases.verticalTopTightClockwise);
      const verticalTopTightCounter = await worker.recognize(canvases.verticalTopTightCounter);
      const verticalTopClockwise = await worker.recognize(canvases.verticalTopClockwise);
      const verticalTopCounter = await worker.recognize(canvases.verticalTopCounter);
      const verticalBottomDigitClockwise = await worker.recognize(canvases.verticalBottomDigitClockwise);
      const verticalBottomDigitCounter = await worker.recognize(canvases.verticalBottomDigitCounter);
      const verticalBottomTightClockwise = await worker.recognize(canvases.verticalBottomTightClockwise);
      const verticalBottomTightCounter = await worker.recognize(canvases.verticalBottomTightCounter);
      const verticalBottomClockwise = await worker.recognize(canvases.verticalBottomClockwise);
      const verticalBottomCounter = await worker.recognize(canvases.verticalBottomCounter);

      const fullText = fullRecognitions
        .map(({ recognition }) => getRecognitionText(recognition))
        .join("\n");
      const plateText = plateRecognitions
        .map(({ recognition }) => getRecognitionText(recognition))
        .join("\n");
      const sideText = leftStrip.data.text || "";
      const topRecognitions = [
        verticalTopDigitClockwise,
        verticalTopDigitCounter,
        verticalTopTightClockwise,
        verticalTopTightCounter,
        verticalTopClockwise,
        verticalTopCounter,
      ];
      const bottomRecognitions = [
        verticalBottomDigitClockwise,
        verticalBottomDigitCounter,
        verticalBottomTightClockwise,
        verticalBottomTightCounter,
        verticalBottomClockwise,
        verticalBottomCounter,
      ];
      const topCandidates = topRecognitions.flatMap((recognition, index) =>
        getCandidatesFromRecognition(
          recognition,
          index < 2 ? 6 : index < 4 ? 3 : 1,
          index < 2 ? "digit-top" : "top"
        )
      );
      const bottomCandidates = bottomRecognitions.flatMap((recognition, index) =>
        getCandidatesFromRecognition(
          recognition,
          index < 2 ? 6 : index < 4 ? 3 : 1,
          index < 2 ? "digit-bottom" : "bottom"
        )
      );
      const verticalTexts = [
        verticalTopDigitClockwise.data.text || "",
        verticalTopDigitCounter.data.text || "",
        verticalTopTightClockwise.data.text || "",
        verticalTopTightCounter.data.text || "",
        verticalTopClockwise.data.text || "",
        verticalTopCounter.data.text || "",
        verticalBottomDigitClockwise.data.text || "",
        verticalBottomDigitCounter.data.text || "",
        verticalBottomTightClockwise.data.text || "",
        verticalBottomTightCounter.data.text || "",
        verticalBottomClockwise.data.text || "",
        verticalBottomCounter.data.text || "",
        sideText,
      ];
      const model = detectModel(fullText);
      const plateContextText = [sideText, plateText, fullText].join(" ");
      const strictVerticalPlate = detectStrictTunisianVerticalPlate(
        topCandidates,
        bottomCandidates
      );
      const tunisianCard = isTunisianRegistrationCard(fullText);
      const verticalPlate =
        strictVerticalPlate ||
        detectVerticalPlate(topCandidates, bottomCandidates, plateContextText);
      const plateNumber =
        verticalPlate || detectPlate(plateText, sideText, fullText);
      const fullConfidence = getRecognitionConfidence(fullRecognitions);
      const plateConfidence = getRecognitionConfidence(plateRecognitions);
      const topConfidence = Math.max(
        verticalTopDigitClockwise.data.confidence || 0,
        verticalTopDigitCounter.data.confidence || 0,
        verticalTopTightClockwise.data.confidence || 0,
        verticalTopTightCounter.data.confidence || 0,
        verticalTopClockwise.data.confidence || 0,
        verticalTopCounter.data.confidence || 0
      );
      const bottomConfidence = Math.max(
        verticalBottomDigitClockwise.data.confidence || 0,
        verticalBottomDigitCounter.data.confidence || 0,
        verticalBottomTightClockwise.data.confidence || 0,
        verticalBottomTightCounter.data.confidence || 0,
        verticalBottomClockwise.data.confidence || 0,
        verticalBottomCounter.data.confidence || 0
      );
      const confidence = Math.round(
        (
          fullConfidence +
          plateConfidence +
          (leftStrip.data.confidence || 0) +
          topConfidence +
          bottomConfidence
        ) / 5
      );
      const warnings = [];

      if (!model) warnings.push("Modele non detecte");
      if (!plateNumber) warnings.push("Plaque non detectee");
      if (tunisianCard && !plateNumber) {
        warnings.push("Plaque verticale a verifier");
      }
      if (confidence < 60) warnings.push("Image a verifier");

      setResult({
        model,
        plateNumber,
        confidence,
        warnings,
        debugImages: canvases.debugImages,
        rawText: [
          "DOCUMENT",
          formatDirectionalText(fullRecognitions),
          "",
          "PLAQUE",
          formatDirectionalText(plateRecognitions),
          "",
          "ZONE ROTATIVE",
          sideText.trim(),
          "",
          "PLAQUE VERTICALE",
          verticalTexts.join("\n").trim(),
          "",
          "CANDIDATS TOP",
          topCandidates.map((candidate) => candidate.value).join(", "),
          "",
          "CANDIDATS BOTTOM",
          bottomCandidates.map((candidate) => candidate.value).join(", "),
        ].join("\n"),
      });
      setProgress({ label: "Analyse terminee", percent: 100 });
    } catch (scanError) {
      console.error(scanError);
      setError(scanError.message || "Analyse OCR impossible.");
      setProgress({ label: "Erreur", percent: 0 });
    } finally {
      if (worker) await worker.terminate();
      setLoading(false);
    }
  };

  const useForBooking = () => {
    navigate("/book", {
      state: {
        ocrText: result.model.trim(),
        plateNumber: result.plateNumber.trim(),
      },
    });
  };

  const canUseResult = result.model.trim() || result.plateNumber.trim();

  return (
    <div className="ocr-page">
      <header className="rdv-topbar">
        <div className="app-brand">
          <div className="brand-mark">H</div>
          <div>Hyundai RDV</div>
        </div>
        <div className="progress-steps">
          <div className="pstep done"><span className="pstep-num">1</span> Connexion</div>
          <span className="pstep-sep" />
          <div className="pstep active"><span className="pstep-num">2</span> Scan</div>
          <span className="pstep-sep" />
          <div className="pstep"><span className="pstep-num">3</span> RDV</div>
        </div>
        <button className="btn-light" type="button" onClick={() => navigate("/client-dashboard")}>
          Dashboard
        </button>
      </header>

      <main className="ocr-shell">
        <section className="ocr-capture-panel">
          <div className="ocr-title-row">
            <div>
              <h1>Scanner vehicule</h1>
              <p>Carte grise, plaque ou document vehicule.</p>
            </div>
            <div className={`ocr-score ${result.confidence >= 60 ? "good" : ""}`}>
              <span>{confidenceLabel(result.confidence)}</span>
              <strong>{result.confidence ? `${result.confidence}%` : "--"}</strong>
            </div>
          </div>

          <div className="ocr-mode-tabs">
            <button
              type="button"
              className={mode === "upload" ? "active" : ""}
              onClick={() => setMode("upload")}
            >
              Import
            </button>
            <button
              type="button"
              className={mode === "camera" ? "active" : ""}
              onClick={() => setMode("camera")}
            >
              Camera
            </button>
          </div>

          {mode === "upload" ? (
            <button
              type="button"
              className={`ocr-dropzone ${dragActive ? "active" : ""}`}
              onClick={() => inputRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                hidden
              />
              <span className="ocr-drop-icon">IMG</span>
              <strong>{image ? image.name : "Choisir une image"}</strong>
              <small>JPG, PNG ou capture depuis telephone</small>
            </button>
          ) : (
            <div className="ocr-camera">
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode: "environment" }}
                className="ocr-webcam"
              />
              <button className="btn-secondary" type="button" onClick={captureImage}>
                Capturer
              </button>
            </div>
          )}

          {preview ? (
            <div className="ocr-preview-wrap">
              <img src={preview} alt="Document a analyser" className="ocr-preview" />
              <div className="ocr-frame">
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>
          ) : (
            <div className="ocr-empty-preview">
              <strong>Aucune image</strong>
              <span>Placez la plaque ou le document bien droit, avec une lumiere uniforme.</span>
            </div>
          )}

          <div className="ocr-progress">
            <div>
              <strong>{progress.label}</strong>
              <span>{progress.percent}%</span>
            </div>
            <progress value={progress.percent} max="100" />
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <div className="ocr-actions">
            <button className="btn-primary" type="button" onClick={handleScan} disabled={loading || !image}>
              {loading ? "Analyse..." : "Lancer OCR"}
            </button>
            <button className="btn-light" type="button" onClick={resetResult} disabled={loading}>
              Reinitialiser
            </button>
          </div>
        </section>

        <aside className="ocr-result-panel">
          <section className="section-card">
            <h2 className="section-title">
              <span className="section-num">1</span> Donnees extraites
            </h2>

            <div className="field">
              <label>Modele</label>
              <input
                value={result.model}
                onChange={(event) => setResult((current) => ({ ...current, model: event.target.value }))}
                placeholder="Hyundai Tucson"
              />
            </div>

            <div className="field">
              <label>Plaque</label>
              <input
                value={result.plateNumber}
                onChange={(event) =>
                  setResult((current) => ({ ...current, plateNumber: event.target.value.toUpperCase() }))
                }
                placeholder="204 TUN 3613"
              />
            </div>

            <div className="ocr-checklist">
              {(result.warnings.length ? result.warnings : ["Pret pour verification"]).map((item) => (
                <span key={item} className={result.warnings.length ? "warn" : "ok"}>
                  {item}
                </span>
              ))}
            </div>

            <button className="btn-primary" type="button" onClick={useForBooking} disabled={!canUseResult}>
              Utiliser pour le RDV
            </button>
          </section>

          <section className="section-card">
            <h2 className="section-title">
              <span className="section-num">2</span> Texte OCR
            </h2>
            {result.debugImages.length > 0 && (
              <div className="ocr-debug-grid">
                {result.debugImages.map((item) => (
                  <figure key={item.label}>
                    <img src={item.src} alt={item.label} />
                    <figcaption>{item.label}</figcaption>
                  </figure>
                ))}
              </div>
            )}
            <pre className="ocr-raw-text">{result.rawText || "Le texte detecte apparaitra ici."}</pre>
          </section>
        </aside>
      </main>
    </div>
  );
}
