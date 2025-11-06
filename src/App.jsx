import React, { useMemo, useState, useRef, useEffect } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Paper,
  Stack,
  Button,
  IconButton,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  Divider,
  Box,
  Tooltip,
  Autocomplete,
  Alert,
  Snackbar,
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Select,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from "@mui/material";
// FIX: incorrect import path for UploadFileIcon
import UploadFileIcon from "@mui/icons-material/UploadFile";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import SkipNextIcon from "@mui/icons-material/SkipNext";
import SkipPreviousIcon from "@mui/icons-material/SkipPrevious";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ForumIcon from "@mui/icons-material/Forum";
import ContentPasteSearchIcon from "@mui/icons-material/ContentPasteSearch";
import ClearIcon from "@mui/icons-material/Clear";
import SettingsIcon from "@mui/icons-material/Settings";
import ContentCopyIcon from "@mui/icons-material/ContentCopy"; // ADD THIS LINE
import LinkIcon from "@mui/icons-material/Link";
import TuneIcon from "@mui/icons-material/Tune";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import TranslateIcon from "@mui/icons-material/Translate";
import Papa from "papaparse";
import { Octokit } from "@octokit/rest";

/**
 * CSV QA Minimal — client‑side React tool
 *
 * Changelog (per Anson's asks)
 * 2025‑09‑22
 * - Comment column can be created by typing a new name (auto‑create)
 * - TABLE tab: wider columns, all text wraps, horizontal scrolling
 * - ROW QA tab: all text wraps; colored sections for key fields; custom field
 *   name pickers (question / expected / apiResponse / evaluationScore /
 *   evaluationExplanation). Those five appear first; other columns go below.
 * - PASS/FAIL/INVALID/DISCUSS auto‑advance to next row
 * 2025‑09‑22 (add‑on)
 * - Toggle (default ON): preserve original status column; write to `${statusCol}_checked` instead
 * - Extra download options when toggle is ON
 */

function useCsv() {
  const [headers, setHeaders] = useState([]); // string[]
  const [rows, setRows] = useState([]); // Array<Record<string,string>>
  const [filename, setFilename] = useState("");

  const loadCsvFile = (file) => {
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        const data = res.data || [];
        const hdrs = res.meta?.fields || Object.keys(data[0] || {});
        setHeaders(hdrs);
        // normalize values to strings and filter out TOTAL rows
        const normalized = data
          .filter((r) => {
            // Filter out TOTAL rows - check if first column contains "TOTAL"
            const firstCol = hdrs[0];
            const firstValue = String(r[firstCol] || "")
              .trim()
              .toUpperCase();
            return firstValue !== "TOTAL";
          })
          .map((r) => {
            const o = {};
            hdrs.forEach((h) => (o[h] = r[h] == null ? "" : String(r[h])));
            return o;
          });
        setRows(normalized);
        setFilename(file.name.replace(/\.(csv|CSV)$/g, ""));
      },
      error: (err) => alert("CSV parse error: " + err.message),
    });
  };

  const addColumnIfMissing = (colName, defaultValue = "") => {
    const name = (colName || "").trim();
    if (!name) return;
    setHeaders((prev) => {
      if (prev.includes(name)) return prev;
      const nextHeaders = [...prev, name];
      setRows((rowsPrev) =>
        rowsPrev.map((r) => ({ ...r, [name]: defaultValue }))
      );
      return nextHeaders;
    });
  };

  const setCell = (rowIndex, col, value) => {
    setRows((prev) => {
      const next = [...prev];
      next[rowIndex] = { ...next[rowIndex], [col]: value };
      return next;
    });
  };

  const toCsv = (subset) => {
    const data = subset || rows;
    return Papa.unparse({
      fields: headers,
      data: data.map((r) => headers.map((h) => r[h] ?? "")),
    });
  };

  return {
    headers,
    setHeaders,
    rows,
    filename,
    setFilename,
    loadCsvFile,
    addColumnIfMissing,
    setCell,
    toCsv,
    setRows,
  };
}

function StatusChip({ value }) {
  const v = String(value || "")
    .trim()
    .toUpperCase();
  if (v === "TRUE" || v === "PASS")
    return <Chip size="small" color="success" label="PASS" />;
  if (v === "FALSE" || v === "FAIL")
    return <Chip size="small" color="error" label="FAIL" />;
  if (v === "INVALID")
    return <Chip size="small" color="warning" label="INVALID" />;
  if (v === "DISCUSS")
    return <Chip size="small" color="warning" label="DISCUSS" />;
  if (!v) return <Chip size="small" variant="outlined" label="—" />;
  return <Chip size="small" variant="outlined" label={v} />;
}

function HeaderAutocomplete({
  label,
  value,
  options,
  onChange,
  onEnsureCreate,
}) {
  return (
    <Autocomplete
      freeSolo
      options={options}
      value={value}
      onChange={(e, newVal) => {
        const v = (newVal || "").trim();
        onChange(v);
        onEnsureCreate?.(v);
      }}
      fullWidth
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          size="small"
          fullWidth
          onBlur={(e) => onEnsureCreate?.(e.target.value)}
          placeholder="Type a column name or pick one"
        />
      )}
      sx={{ flex: 1, minWidth: 200 }}
    />
  );
}

const wrapSx = {
  "& .MuiInputBase-input": { whiteSpace: "pre-wrap", wordBreak: "break-word" },
  "& textarea": { whiteSpace: "pre-wrap", wordBreak: "break-word" },
};

function FieldBlock({
  title,
  color,
  value,
  onChange,
  multiline = true,
  rowIdx,
  fieldName,
  onTranslate,
  translation,
  isTranslating,
}) {
  const [copyFeedback, setCopyFeedback] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value || "").then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 1500);
    });
  };

  return (
    <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: color }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 0.5 }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontWeight: 600 }}
        >
          {title}
        </Typography>
        <Stack direction="row" spacing={0.5}>
          {/* NEW: Translate button */}
          {onTranslate && (
            <Tooltip
              title={
                translation
                  ? "Hide translation"
                  : "Translate to Traditional Chinese"
              }
            >
              <IconButton
                size="small"
                onClick={() => onTranslate(value, rowIdx, fieldName)}
                disabled={isTranslating}
                sx={{
                  opacity: translation ? 1 : 0.6,
                  color: translation ? "primary.main" : "inherit",
                  "&:hover": { opacity: 1 },
                }}
              >
                {isTranslating ? (
                  <CircularProgress size={16} />
                ) : (
                  <TranslateIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={copyFeedback ? "Copied!" : "Copy to clipboard"}>
            <IconButton
              size="small"
              onClick={handleCopy}
              sx={{
                opacity: copyFeedback ? 1 : 0.6,
                color: copyFeedback ? "success.main" : "inherit",
                "&:hover": { opacity: 1 },
              }}
            >
              {copyFeedback ? (
                <CheckIcon fontSize="small" />
              ) : (
                <ContentCopyIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
      <TextField
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        fullWidth
        size="small"
        multiline={multiline}
        minRows={3}
        sx={wrapSx}
      />
      {/* NEW: Translation display */}
      {translation && (
        <Box
          sx={{
            mt: 1,
            p: 1.5,
            borderRadius: 1,
            bgcolor: "rgba(25, 118, 210, 0.08)",
            border: "1px solid rgba(25, 118, 210, 0.2)",
          }}
        >
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mb: 0.5 }}
          >
            <Typography
              variant="caption"
              color="primary"
              sx={{ fontWeight: 600 }}
            >
              繁體中文翻譯
            </Typography>
            <Tooltip title="Copy translation">
              <IconButton
                size="small"
                onClick={() => {
                  navigator.clipboard.writeText(translation);
                  setSnack("Translation copied!");
                }}
                sx={{ opacity: 0.6, "&:hover": { opacity: 1 } }}
              >
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
          <Typography
            variant="body2"
            sx={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              color: "text.primary",
            }}
          >
            {translation}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

// --- helpers for projections/downloads ---
function projectChecked(checkedVal, originalVal, fillMissing) {
  const c = (checkedVal ?? "").trim();
  if (fillMissing && !c) return originalVal ?? "";
  return checkedVal ?? "";
}

function buildCsvFromColumns(headersOut, rows, mapper = (r) => r) {
  const fields = headersOut;
  const data = rows.map((r) => fields.map((h) => mapper(r, h)));
  return Papa.unparse({ fields, data });
}

// New helper to reorder headers so checked column is next to original status column
function reorderHeadersWithCheckedColumn(headers, statusCol, checkedCol) {
  if (!statusCol || !checkedCol || !headers.includes(statusCol)) {
    return headers;
  }

  const result = [...headers];
  const statusIndex = result.indexOf(statusCol);
  const checkedIndex = result.indexOf(checkedCol);

  if (statusIndex === -1) return result;

  // Remove checked column from its current position
  if (checkedIndex !== -1) {
    result.splice(checkedIndex, 1);
  }

  // Insert checked column right after status column
  result.splice(statusIndex + 1, 0, checkedCol);

  return result;
}

// --- tiny dev self‑tests (smoke) ---
function runDevTests(env, api) {
  const results = [];
  try {
    // 1) icon import should exist (the original bug)
    results.push({ name: "UploadFileIcon import", pass: !!UploadFileIcon });

    // 2) header ordering helper (pure)
    const primary = ["question", "expectedAnswer", "llmAnswer"];
    const headers = ["qaPass", "expectedAnswer", "id", "question", "llmAnswer"];
    const other = computeOtherHeaders(headers, primary);
    results.push({
      name: "computeOtherHeaders",
      pass: JSON.stringify(other) === JSON.stringify(["qaPass", "id"]),
    });

    // 3) projectChecked tests
    const pc1 = projectChecked("", "FALSE", true); // should take original when empty + fill
    const pc2 = projectChecked("", "FALSE", false); // should stay empty when no fill
    const pc3 = projectChecked("TRUE", "FALSE", true); // prefer checked if present
    results.push({ name: "projectChecked fill true", pass: pc1 === "FALSE" });
    results.push({ name: "projectChecked fill false", pass: pc2 === "" });
    results.push({
      name: "projectChecked prefer checked",
      pass: pc3 === "TRUE",
    });

    // 4) simple status mapping visibility via StatusChip – ensure component callable
    results.push({
      name: "StatusChip callable",
      pass: typeof StatusChip === "function",
    });
  } catch (e) {
    results.push({ name: "unexpected error", pass: false, message: String(e) });
  }
  if (env) console.table(results);
  const failed = results.find((r) => !r.pass);
  return failed
    ? `❌ Self-tests: ${results
        .filter((r) => !r.pass)
        .map((r) => r.name)
        .join(", ")}`
    : "✅ Self-tests passed";
}

function computeOtherHeaders(headers, primaryOrder) {
  const primaryLower = (primaryOrder || []).map((x) => x.toLowerCase());
  return headers.filter((h) => !primaryLower.includes(h.toLowerCase()));
}

export default function App() {
  const {
    headers,
    setHeaders,
    rows,
    filename,
    setFilename,
    loadCsvFile,
    addColumnIfMissing,
    setCell,
    toCsv,
    setRows,
  } = useCsv();

  const [statusCol, setStatusCol] = useState("");
  const [commentCol, setCommentCol] = useState("");

  // Primary field columns (customizable)
  const [questionCol, setQuestionCol] = useState("");
  const [expectedCol, setExpectedCol] = useState("");
  const [apiResponseCol, setApiResponseCol] = useState("");
  const [evalScoreCol, setEvalScoreCol] = useState("");
  const [evalExplainCol, setEvalExplainCol] = useState("");

  // New: citations feature
  const [citationsCol, setCitationsCol] = useState("");
  const [useCitations, setUseCitations] = useState(true);

  // New: use _checked column toggle (default ON)
  const [useCheckedStatus, setUseCheckedStatus] = useState(true);
  const [showFailedOnly, setShowFailedOnly] = useState(false);
  const [showFailAndDiscuss, setShowFailAndDiscuss] = useState(false);
  const [filterByCheckedCol, setFilterByCheckedCol] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [hideFieldTitles, setHideFieldTitles] = useState(false);

  // New: Settings dialog state
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState(0); // 0=Options, 1=Import/Export, 2=Load CSV
  const [settingsJson, setSettingsJson] = useState("");
  const [settingsMode, setSettingsMode] = useState("text"); // 'text' or 'url'
  const [csvUrlInput, setCsvUrlInput] = useState("");

  // New: Track URLs loaded from parameters
  const [loadedJsonUrl, setLoadedJsonUrl] = useState("");
  const [loadedCsvUrl, setLoadedCsvUrl] = useState("");

  // NEW: GitHub Gist upload states
  const [githubToken, setGithubToken] = useState(
    localStorage.getItem("github_token") || ""
  );
  const [uploading, setUploading] = useState(false);
  const [uploadedGistUrl, setUploadedGistUrl] = useState("");
  const [showGistDialog, setShowGistDialog] = useState(false);
  const [includeTokenInLink, setIncludeTokenInLink] = useState(false); // NEW: Default false

  // Moved UP so it exists before any helper referencing it
  const checkedColName = useMemo(
    () => (statusCol ? `${statusCol}_checked` : ""),
    [statusCol]
  );

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [tab, setTab] = useState(0); // 0=Table, 1=Row QA
  const [snack, setSnack] = useState("");
  const [testMsg, setTestMsg] = useState("");

  const [dlAnchor, setDlAnchor] = useState(null);

  // NEW: Google Translate integration
  const [googleApiKey, setGoogleApiKey] = useState(
    localStorage.getItem("google_translate_key") || ""
  );
  const [translations, setTranslations] = useState({}); // { "rowIdx-fieldName": "translated text" }
  const [translating, setTranslating] = useState({}); // { "rowIdx-fieldName": true/false }

  const inputRef = useRef(null);

  const hasData = rows.length > 0;
  // Updated helpers for fail filtering - always use original status column for filtering
  const getEffectiveStatus = (row) => {
    if (!row || !statusCol) return "";
    const raw =
      useCheckedStatus && checkedColName ? row[checkedColName] : row[statusCol];
    return String(raw || "")
      .trim()
      .toUpperCase();
  };

  // New helper specifically for filtering - uses either original or checked column based on toggle
  const getFilterStatus = (row) => {
    if (!row || !statusCol) return "";
    const raw =
      filterByCheckedCol && checkedColName
        ? row[checkedColName]
        : row[statusCol];
    return String(raw || "")
      .trim()
      .toUpperCase();
  };

  const getOriginalStatus = (row) => {
    if (!row || !statusCol) return "";
    const raw = row[statusCol];
    return String(raw || "")
      .trim()
      .toUpperCase();
  };

  const isFailStatus = (s) => s === "FALSE" || s === "FAIL";
  const isFailOrDiscussStatus = (s) =>
    s === "FALSE" || s === "FAIL" || s === "DISCUSS";

  const failingIndices = useMemo(() => {
    if (!statusCol) return [];
    return rows
      .map((r, i) => (isFailStatus(getFilterStatus(r)) ? i : -1))
      .filter((i) => i >= 0);
  }, [rows, statusCol, filterByCheckedCol, checkedColName]);

  // New: indices for FAIL and DISCUSS
  const failAndDiscussIndices = useMemo(() => {
    if (!statusCol) return [];
    return rows
      .map((r, i) => (isFailOrDiscussStatus(getFilterStatus(r)) ? i : -1))
      .filter((i) => i >= 0);
  }, [rows, statusCol, filterByCheckedCol, checkedColName]);

  const displayedIndices = useMemo(() => {
    if (showFailAndDiscuss) return failAndDiscussIndices;
    if (showFailedOnly) return failingIndices;
    return rows.map((_, i) => i);
  }, [
    showFailedOnly,
    showFailAndDiscuss,
    failingIndices,
    failAndDiscussIndices,
    rows,
  ]);

  // Adjust current row if filtered view hides it
  useEffect(() => {
    if (showFailAndDiscuss) {
      if (!isFailOrDiscussStatus(getFilterStatus(rows[currentIdx]))) {
        const next =
          failAndDiscussIndices.find((i) => i > currentIdx) ??
          failAndDiscussIndices[0];
        if (next != null) setCurrentIdx(next);
      }
    } else if (showFailedOnly) {
      if (!isFailStatus(getFilterStatus(rows[currentIdx]))) {
        const next =
          failingIndices.find((i) => i > currentIdx) ?? failingIndices[0];
        if (next != null) setCurrentIdx(next);
      }
    }
  }, [
    showFailedOnly,
    showFailAndDiscuss,
    rows,
    currentIdx,
    failingIndices,
    failAndDiscussIndices,
    statusCol,
    filterByCheckedCol,
  ]);

  // Pagination now based on displayedIndices
  const pagedRows = useMemo(() => {
    const start = page * rowsPerPage;
    const slice = displayedIndices.slice(start, start + rowsPerPage);
    return slice.map((gi) => ({ row: rows[gi], globalIdx: gi }));
  }, [displayedIndices, rows, page, rowsPerPage]);

  const totalDisplayed = displayedIndices.length;

  const ensureCol = (name) => {
    if (!name) return;
    addColumnIfMissing(name, "");
  };

  // When toggle ON and status column picked, auto-create the checked column
  useEffect(() => {
    if (useCheckedStatus && checkedColName) {
      // Only create if it doesn't already exist
      if (!headers.includes(checkedColName)) {
        ensureCol(checkedColName);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useCheckedStatus, checkedColName]);

  // Guess defaults when headers change and custom fields are empty
  useEffect(() => {
    if (!headers.length) return;
    const lower = headers.map((h) => h.toLowerCase());

    if (!statusCol) {
      // Look for "isResponseAcceptable" first, then fall back to "qapass"
      let i = lower.indexOf("isresponseacceptable");
      if (i === -1) i = lower.indexOf("qapass");
      if (i >= 0) setStatusCol(headers[i]);
    }
    if (!commentCol) {
      // Updated: Look for multiple comment column variations
      const commentCandidates = [
        "comment",
        "comments",
        "qaremarks",
        "remarks",
        "notes",
      ];
      let commentIndex = -1;
      for (const candidate of commentCandidates) {
        commentIndex = lower.indexOf(candidate);
        if (commentIndex >= 0) break;
      }
      if (commentIndex >= 0) {
        setCommentCol(headers[commentIndex]);
      } else {
        // If no existing column found, set default name that will be created when used
        setCommentCol("comment");
      }
    }

    // Auto-detect existing checked columns when status column is set
    if (statusCol && useCheckedStatus) {
      const potentialCheckedCol = `${statusCol}_checked`;
      if (headers.includes(potentialCheckedCol)) {
        // Already exists, no need to create
        console.log(`Found existing checked column: ${potentialCheckedCol}`);
      }
    }

    const maybeSet = (setter, current, candidates) => {
      if (current) return;
      const idx = headers.findIndex((h) =>
        candidates.includes(h.toLowerCase())
      );
      if (idx >= 0) setter(headers[idx]);
    };

    maybeSet(setQuestionCol, questionCol, [
      "question",
      "user_question",
      "prompt",
    ]);
    maybeSet(setExpectedCol, expectedCol, [
      "expectedanswer",
      "expected_answer",
      "groundtruth",
      "ground_truth",
    ]);
    maybeSet(setApiResponseCol, apiResponseCol, [
      "apiresponse",
      "llmanswer",
      "response",
      "answer",
      "modelanswer",
    ]);
    maybeSet(setEvalScoreCol, evalScoreCol, [
      "evaluationscore",
      "score",
      "gptscore",
    ]);
    maybeSet(setEvalExplainCol, evalExplainCol, [
      "evaluationexplanation",
      "explanation",
      "evaluationreason",
      "gptcomment",
    ]);

    // Auto-detect citations column
    if (useCitations) {
      maybeSet(setCitationsCol, citationsCol, [
        "citations",
        "citation",
        "sources",
        "references",
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers, useCitations]);

  const applyStatus = (val) => {
    if (!statusCol) {
      setSnack("Pick or create a Status column first");
      return;
    }
    if (useCheckedStatus) {
      // write to _checked only
      if (!checkedColName) return;
      ensureCol(checkedColName);
      setCell(currentIdx, checkedColName, val);
    } else {
      // legacy: write to original status column
      ensureCol(statusCol);
      setCell(currentIdx, statusCol, val);
    }
    // auto-advance to next row
    setCurrentIdx((i) => Math.min(rows.length - 1, i + 1));
    // keep pagination in sync
    const next = currentIdx + 1;
    const targetPage = Math.floor(next / rowsPerPage);
    setPage(targetPage);
  };

  const clearStatus = () => {
    if (!statusCol) {
      setSnack("Pick or create a Status column first");
      return;
    }
    if (useCheckedStatus) {
      // clear the _checked column
      if (!checkedColName) return;
      ensureCol(checkedColName);
      setCell(currentIdx, checkedColName, "");
    } else {
      // legacy: clear the original status column
      ensureCol(statusCol);
      setCell(currentIdx, statusCol, "");
    }
    // auto-advance to next row
    setCurrentIdx((i) => Math.min(rows.length - 1, i + 1));
    // keep pagination in sync
    const next = currentIdx + 1;
    const targetPage = Math.floor(next / rowsPerPage);
    setPage(targetPage);
  };

  const setCommentForCurrent = (text) => {
    if (!commentCol) return;
    ensureCol(commentCol);
    setCell(currentIdx, commentCol, text);
  };

  // Ensure comment column is created immediately when user types a new name
  useEffect(() => {
    if (commentCol && !headers.includes(commentCol))
      addColumnIfMissing(commentCol, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commentCol]);

  const currentRow = rows[currentIdx] || {};
  const currentStatus = statusCol ? currentRow?.[statusCol] : "";
  const currentChecked = checkedColName ? currentRow?.[checkedColName] : "";
  const effectiveStatus =
    useCheckedStatus && checkedColName ? currentChecked : currentStatus;
  const currentComment = commentCol ? currentRow?.[commentCol] || "" : "";

  // existing downloads
  const download = (onlyFailures = false) => {
    if (!hasData) return;
    let subset = rows;
    const colForFilter =
      useCheckedStatus && checkedColName ? checkedColName : statusCol;
    if (onlyFailures && colForFilter) {
      subset = rows.filter((r) => {
        const v = String(r[colForFilter] || "")
          .trim()
          .toUpperCase();
        return v === "FALSE" || v === "DISCUSS"; // export FAIL & DISCUSS
      });
    }

    // Use reordered headers when checked status is enabled
    const exportHeaders =
      useCheckedStatus && checkedColName
        ? reorderHeadersWithCheckedColumn(headers, statusCol, checkedColName)
        : headers;

    const csv = Papa.unparse({
      fields: exportHeaders,
      data: subset.map((r) => exportHeaders.map((h) => r[h] ?? "")),
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const base = filename || "qa";
    a.download = onlyFailures ? `${base}_fail_only.csv` : `${base}_updated.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // new download variations when toggle is ON
  const downloadCheckedOnly = (fillMissing) => {
    if (!hasData || !statusCol) return;
    const col = checkedColName || `${statusCol}_checked`;
    ensureCol(col);

    // Behavior 1: Keep both columns, fill missing checked values from original
    const reorderedHeaders = reorderHeadersWithCheckedColumn(
      headers,
      statusCol,
      col
    );
    const csv = buildCsvFromColumns(reorderedHeaders, rows, (r, h) => {
      if (h === col) return projectChecked(r[col], r[statusCol], fillMissing);
      return r[h] ?? "";
    });

    triggerDownload(
      csv,
      `${filename || "qa"}_both_columns${fillMissing ? "_autofill" : ""}.csv`
    );
  };

  const downloadCheckedWithOriginal = (fillMissing) => {
    if (!hasData || !statusCol) return;
    const col = checkedColName || `${statusCol}_checked`;
    ensureCol(col);

    // Behavior 2: Replace original status column with filled checked values
    const csv = buildCsvFromColumns(headers, rows, (r, h) => {
      if (h === statusCol) {
        // Replace original status column with checked values (filled if missing)
        return projectChecked(r[col], r[statusCol], fillMissing);
      }
      if (h === col) {
        // Skip the checked column entirely in this export
        return "";
      }
      return r[h] ?? "";
    });

    // Remove the checked column from headers for this export
    const exportHeaders = headers.filter((h) => h !== col);
    const finalCsv = Papa.unparse({
      fields: exportHeaders,
      data: rows.map((r) =>
        exportHeaders.map((h) => {
          if (h === statusCol) {
            return projectChecked(r[col], r[statusCol], fillMissing);
          }
          return r[h] ?? "";
        })
      ),
    });

    triggerDownload(
      finalCsv,
      `${filename || "qa"}_merged_to_${statusCol}${
        fillMissing ? "_autofill" : ""
      }.csv`
    );
  };

  const triggerDownload = (csv, name) => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const jumpTo = (n) => {
    if (!hasData) return;
    const idx = Math.max(0, Math.min(rows.length - 1, Number(n) - 1));
    setCurrentIdx(idx);
    const p = Math.floor(idx / rowsPerPage);
    setPage(p);
  };

  const loadDemo = () => {
    const demo = `question,expectedAnswer,llmAnswer,qaPass,qaRemarks,evaluationScore,evaluationExplanation
Who are you?,I am a demo expected answer,Model: I am a bot,, ,4,Related but incomplete
What is your art?,Performance about memory and relations,Something else,, ,2,Off-topic`;
    Papa.parse(demo, {
      header: true,
      complete: (res) => {
        const hdrs = res.meta.fields;
        const data = res.data.map((r) => {
          const o = {};
          hdrs.forEach((h) => (o[h] = r[h] || ""));
          return o;
        });
        setRows(data);
        setFilename("demo");
        setHeaders(hdrs);
      },
    });
  };

  // Primary fields ordering helper
  const primaryOrder = [
    questionCol,
    expectedCol,
    apiResponseCol,
    evalScoreCol,
    evalExplainCol,
    ...(useCitations && citationsCol ? [citationsCol] : []),
  ].filter(Boolean);
  const otherHeaders = computeOtherHeaders(headers, primaryOrder);

  // attach quick self-tests
  const handleRunTests = () => {
    const msg = runDevTests(typeof window !== "undefined" && window.__DEV__, {
      computeOtherHeaders,
    });
    setTestMsg(msg);
  };

  // Add new helper function to fetch from URL
  async function fetchFromUrl(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      throw new Error(`Failed to fetch from URL: ${error.message}`);
    }
  }

  // New: Generate settings JSON
  const generateSettingsJson = () => {
    const settings = {
      statusCol,
      commentCol,
      questionCol,
      expectedCol,
      apiResponseCol,
      evalScoreCol,
      evalExplainCol,
      citationsCol,
      useCitations,
      useCheckedStatus,
      showFailedOnly,
      showFailAndDiscuss,
      filterByCheckedCol,
      hideFieldTitles, // NEW
    };
    return JSON.stringify(settings, null, 2);
  };

  // New: Export settings as JSON
  const exportSettings = () => {
    const json = generateSettingsJson();
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${filename || "qa"}_settings.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setSnack("Settings exported successfully");
  };

  // New: Import settings from JSON
  const importSettings = async (jsonText) => {
    try {
      const settings = JSON.parse(jsonText);
      if (settings.statusCol !== undefined) setStatusCol(settings.statusCol);
      if (settings.commentCol !== undefined) setCommentCol(settings.commentCol);
      if (settings.questionCol !== undefined)
        setQuestionCol(settings.questionCol);
      if (settings.expectedCol !== undefined)
        setExpectedCol(settings.expectedCol);
      if (settings.apiResponseCol !== undefined)
        setApiResponseCol(settings.apiResponseCol);
      if (settings.evalScoreCol !== undefined)
        setEvalScoreCol(settings.evalScoreCol);
      if (settings.evalExplainCol !== undefined)
        setEvalExplainCol(settings.evalExplainCol);
      if (settings.citationsCol !== undefined)
        setCitationsCol(settings.citationsCol);
      if (settings.useCitations !== undefined)
        setUseCitations(settings.useCitations);
      if (settings.useCheckedStatus !== undefined)
        setUseCheckedStatus(settings.useCheckedStatus);
      if (settings.showFailedOnly !== undefined)
        setShowFailedOnly(settings.showFailedOnly);
      if (settings.showFailAndDiscuss !== undefined)
        setShowFailAndDiscuss(settings.showFailAndDiscuss);
      if (settings.filterByCheckedCol !== undefined)
        setFilterByCheckedCol(settings.filterByCheckedCol);
      if (settings.hideFieldTitles !== undefined)
        setHideFieldTitles(settings.hideFieldTitles); // NEW

      setSnack("Settings imported successfully");
      setSettingsDialogOpen(false);
    } catch (error) {
      setSnack(`Failed to import settings: ${error.message}`);
    }
  };

  // New: Handle settings import
  const handleSettingsImport = async () => {
    try {
      if (settingsMode === "text") {
        await importSettings(settingsJson);
      } else {
        const jsonText = await fetchFromUrl(settingsJson);
        await importSettings(jsonText);
        setLoadedJsonUrl(settingsJson); // Track the loaded URL
      }
    } catch (error) {
      setSnack(`Error: ${error.message}`);
    }
  };

  // New: Load CSV from URL
  const loadCsvFromUrl = async (url) => {
    try {
      const csvText = await fetchFromUrl(url);
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim(),
        complete: (res) => {
          const data = res.data || [];
          const hdrs = res.meta?.fields || Object.keys(data[0] || {});
          setHeaders(hdrs);
          const normalized = data
            .filter((r) => {
              const firstCol = hdrs[0];
              const firstValue = String(r[firstCol] || "")
                .trim()
                .toUpperCase();
              return firstValue !== "TOTAL";
            })
            .map((r) => {
              const o = {};
              hdrs.forEach((h) => (o[h] = r[h] == null ? "" : String(r[h])));
              return o;
            });
          setRows(normalized);
          const urlFilename = url
            .split("/")
            .pop()
            .replace(/\.(csv|CSV)$/g, "");
          setFilename(urlFilename);
          setSnack(`CSV loaded from URL: ${normalized.length} rows`);
          // setCsvUrlDialogOpen(false);
          setLoadedCsvUrl(url); // Track the loaded URL
        },
        error: (err) => setSnack("CSV parse error: " + err.message),
      });
    } catch (error) {
      setSnack(`Error loading CSV: ${error.message}`);
    }
  };

  // NEW: Save Google API key
  const saveGoogleApiKey = (key) => {
    setGoogleApiKey(key);
    localStorage.setItem("google_translate_key", key);
  };

  // NEW: Translate text to Traditional Chinese
  const translateText = async (text, rowIdx, fieldName) => {
    if (!googleApiKey) {
      setSnack("Please set your Google API key in settings");
      setSettingsDialogOpen(true);
      setSettingsTab(4); // Google Translate tab
      return;
    }

    if (!text || text.trim() === "") {
      setSnack("No text to translate");
      return;
    }

    const translationKey = `${rowIdx}-${fieldName}`;

    // Toggle off if already showing translation
    if (translations[translationKey]) {
      setTranslations((prev) => {
        const next = { ...prev };
        delete next[translationKey];
        return next;
      });
      return;
    }

    setTranslating((prev) => ({ ...prev, [translationKey]: true }));

    try {
      const response = await fetch(
        `https://translation.googleapis.com/language/translate/v2?key=${googleApiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            q: text,
            target: "zh-TW", // Traditional Chinese
            format: "text",
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const translatedText = data.data?.translations?.[0]?.translatedText || "";

      setTranslations((prev) => ({
        ...prev,
        [translationKey]: translatedText,
      }));
    } catch (error) {
      console.error("Translation failed:", error);
      setSnack(`Translation failed: ${error.message}`);
    } finally {
      setTranslating((prev) => {
        const next = { ...prev };
        delete next[translationKey];
        return next;
      });
    }
  };

  // New: Parse URL parameters on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const jsonUrl = params.get("json");
    const csvUrl = params.get("csv");
    const token = params.get("token"); // NEW: Get token from URL

    // NEW: Set token from URL if provided
    if (token) {
      saveGitHubToken(token);
      setSnack("GitHub token loaded from URL");
    }

    const loadFromUrls = async () => {
      try {
        // Load settings first if provided
        if (jsonUrl) {
          setLoadedJsonUrl(jsonUrl);
          const jsonText = await fetchFromUrl(jsonUrl);
          await importSettings(jsonText);
        }

        // Then load CSV if provided
        if (csvUrl) {
          setLoadedCsvUrl(csvUrl);
          setCsvUrlInput(csvUrl);
          await loadCsvFromUrl(csvUrl);
        }
      } catch (error) {
        setSnack(`Error loading from URL parameters: ${error.message}`);
      }
    };

    if (jsonUrl || csvUrl) {
      loadFromUrls();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // New: Copy shareable link
  const copyShareableLink = () => {
    const baseUrl = window.location.origin + window.location.pathname;
    const params = new URLSearchParams();

    if (loadedJsonUrl) {
      params.append("json", loadedJsonUrl);
    }
    if (loadedCsvUrl) {
      params.append("csv", loadedCsvUrl);
    }
    // UPDATED: Only include token if toggle is ON
    if (includeTokenInLink && githubToken) {
      params.append("token", githubToken);
    }

    const shareUrl = params.toString()
      ? `${baseUrl}?${params.toString()}`
      : baseUrl;

    navigator.clipboard.writeText(shareUrl).then(() => {
      const message =
        includeTokenInLink && githubToken
          ? "Shareable link copied to clipboard (includes token)"
          : "Shareable link copied to clipboard";
      setSnack(message);
    });
  };

  // NEW: Upload to GitHub Gist
  const uploadToGitHub = async () => {
    if (!hasData || !statusCol) {
      setSnack("Please load data and configure columns first");
      return;
    }

    if (!githubToken) {
      setSnack("Please set your GitHub token in settings");
      setSettingsDialogOpen(true);
      setSettingsTab(3); // GitHub tab
      return;
    }

    setUploading(true);
    try {
      const octokit = new Octokit({ auth: githubToken });

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const csv = toCsv(rows);
      const settingsJson = generateSettingsJson();

      // Create a gist with both files
      const response = await octokit.gists.create({
        description: `CSV QA - ${filename || "data"} - ${timestamp}`,
        public: false, // Set to true if you want public gists
        files: {
          [`${filename || "data"}-${timestamp}.csv`]: {
            content: csv,
          },
          [`settings-${timestamp}.json`]: {
            content: settingsJson,
          },
        },
      });

      const gistId = response.data.id;
      const gistUrl = response.data.html_url;
      const csvFile =
        response.data.files[`${filename || "data"}-${timestamp}.csv`];
      const jsonFile = response.data.files[`settings-${timestamp}.json`];

      const csvUrl = csvFile.raw_url;
      const jsonUrl = jsonFile.raw_url;

      // Generate shareable link
      const shareableLink = `${window.location.origin}${
        window.location.pathname
      }?json=${encodeURIComponent(jsonUrl)}&csv=${encodeURIComponent(csvUrl)}${
        includeTokenInLink && githubToken
          ? `&token=${encodeURIComponent(githubToken)}`
          : ""
      }`;

      setLoadedJsonUrl(jsonUrl);
      setLoadedCsvUrl(csvUrl);
      setUploadedGistUrl(shareableLink);
      setShowGistDialog(true);
      setSnack("Files uploaded to GitHub Gist successfully!");

      console.log("Gist created:", { gistUrl, gistId, shareableLink });
    } catch (error) {
      console.error("Upload failed:", error);
      setSnack(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  // NEW: Save GitHub token
  const saveGitHubToken = (token) => {
    setGithubToken(token);
    localStorage.setItem("github_token", token);
  };

  // Add beforeunload event listener to warn users before closing
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasData) {
        e.preventDefault();
        e.returnValue = ""; // Chrome requires returnValue to be set
        return ""; // Some browsers require a return value
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasData]);

  return (
    <Box sx={{ bgcolor: "#f6f8fb", minHeight: "100vh" }}>
      <AppBar position="static" color="default" elevation={0}>
        <Toolbar>
          <Typography variant="h6" sx={{ flex: 1 }}>
            CSV QA Tool
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              startIcon={<UploadFileIcon />}
              variant="contained"
              onClick={() => inputRef.current?.click()}
            >
              Upload CSV
            </Button>
            {/* NEW: GitHub Upload Button */}
            <Button
              startIcon={
                uploading ? <CircularProgress size={16} /> : <CloudUploadIcon />
              }
              variant="contained"
              color="secondary"
              onClick={uploadToGitHub}
              disabled={!hasData || uploading}
            >
              {uploading ? "Uploading..." : "Share to Cloud"}
            </Button>
            <Button
              startIcon={<SettingsIcon />}
              variant="outlined"
              onClick={() => {
                setSettingsTab(0);
                setSettingsDialogOpen(true);
              }}
            >
              Settings
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: "none" }}
              onChange={(e) => loadCsvFile(e.target.files?.[0])}
            />
            {useCheckedStatus ? (
              <>
                <Button
                  variant="outlined"
                  onClick={(e) => setDlAnchor(e.currentTarget)}
                  disabled={!hasData}
                >
                  Download
                </Button>
                <Menu
                  anchorEl={dlAnchor}
                  open={!!dlAnchor}
                  onClose={() => setDlAnchor(null)}
                >
                  <MenuItem
                    onClick={() => {
                      setDlAnchor(null);
                      download(false);
                    }}
                  >
                    <ListItemIcon>
                      <FileDownloadIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Full CSV (current view)"
                      secondary={`Export all data with ${
                        checkedColName || statusCol + "_checked"
                      } positioned next to ${statusCol}`}
                    />
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      setDlAnchor(null);
                      downloadCheckedOnly(true);
                    }}
                  >
                    <ListItemIcon>
                      <FileDownloadIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={`Keep both ${statusCol} and ${
                        checkedColName || statusCol + "_checked"
                      }`}
                      secondary="Fill missing checked values from original"
                    />
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      setDlAnchor(null);
                      downloadCheckedWithOriginal(true);
                    }}
                  >
                    <ListItemIcon>
                      <FileDownloadIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={`Merge checked values into ${statusCol}`}
                      secondary="Replace original column, remove checked column"
                    />
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      setDlAnchor(null);
                      download(true);
                    }}
                  >
                    <ListItemIcon>
                      <ContentPasteSearchIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Export FAIL/DISCUSS only"
                      secondary="Export only rows marked as FAIL or DISCUSS"
                    />
                  </MenuItem>
                </Menu>
              </>
            ) : (
              <>
                <Button
                  variant="outlined"
                  onClick={(e) => setDlAnchor(e.currentTarget)}
                  disabled={!hasData}
                >
                  Download
                </Button>
                <Menu
                  anchorEl={dlAnchor}
                  open={!!dlAnchor}
                  onClose={() => setDlAnchor(null)}
                >
                  <MenuItem
                    onClick={() => {
                      setDlAnchor(null);
                      download(false);
                    }}
                  >
                    <ListItemIcon>
                      <FileDownloadIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Full CSV"
                      secondary="Export all data"
                    />
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      setDlAnchor(null);
                      download(true);
                    }}
                  >
                    <ListItemIcon>
                      <ContentPasteSearchIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Export FAIL/DISCUSS only"
                      secondary="Export only rows marked as FAIL or DISCUSS"
                    />
                  </MenuItem>
                </Menu>
              </>
            )}
          </Stack>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: 2 }}>
        <Paper sx={{ p: 0, mb: 2 }}>
          <Tabs value={tab} onChange={(e, v) => setTab(v)} variant="fullWidth">
            <Tab label="Row QA" />
            <Tab label="Table" />
          </Tabs>
        </Paper>
        {tab === 0 && (
          <Paper sx={{ p: 2, pb: 12 }}>
            {" "}
            {/* Add bottom padding for fixed bar */}
            {!hasData ? (
              <Box sx={{ p: 1 }}>
                <Alert severity="info">
                  {" "}
                  Upload a CSV with headers to begin. Everything runs locally in
                  your browser. Tip: choose your status/comment columns above.
                  If a name you type doesn't exist, it will be created
                  automatically.
                </Alert>
              </Box>
            ) : (
              <Stack spacing={2}>
                {/* Status + Comment with Translate All button */}
                <Stack
                  direction="row"
                  spacing={2}
                  alignItems="flex-start"
                  flexWrap="wrap"
                  justifyContent="space-between" // ADD THIS
                >
                  {statusCol && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      {useCheckedStatus && checkedColName ? (
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          flexWrap="wrap"
                        >
                          <Stack
                            direction="row"
                            spacing={0.5}
                            alignItems="center"
                          >
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              Checked
                            </Typography>
                            <StatusChip value={currentChecked} />
                          </Stack>
                          <Stack
                            direction="row"
                            spacing={0.5}
                            alignItems="center"
                          >
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              Original
                            </Typography>
                            <Box sx={{ opacity: 0.3 }}>
                              <StatusChip value={currentStatus} />
                            </Box>
                          </Stack>
                        </Stack>
                      ) : (
                        <StatusChip value={effectiveStatus} />
                      )}
                    </Stack>
                  )}

                  {/* NEW: Translate All button */}
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={
                      Object.values(translating).some((v) => v) ? (
                        <CircularProgress size={16} color="inherit" />
                      ) : (
                        <TranslateIcon />
                      )
                    }
                    onClick={async () => {
                      const fieldsToTranslate = [
                        { col: questionCol, name: "question" },
                        { col: expectedCol, name: "expected" },
                        { col: apiResponseCol, name: "apiResponse" },
                        { col: evalExplainCol, name: "evalExplain" },
                      ].filter((f) => f.col && currentRow[f.col]);

                      for (const field of fieldsToTranslate) {
                        const text = currentRow[field.col];
                        if (text && text.trim()) {
                          await translateText(text, currentIdx, field.col);
                        }
                      }
                    }}
                    disabled={
                      !googleApiKey ||
                      Object.values(translating).some((v) => v) ||
                      ![
                        questionCol,
                        expectedCol,
                        apiResponseCol,
                        evalExplainCol,
                      ].some(
                        (col) =>
                          col && currentRow[col] && currentRow[col].trim()
                      )
                    }
                    size="small"
                    sx={{ ml: "auto" }} // ADD THIS to push button to the right
                  >
                    Translate All
                  </Button>
                </Stack>

                {/* ...existing comment field code... */}
                {commentCol && (
                  <Box>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      sx={{ mb: 0.5 }}
                    >
                      <Typography variant="body2" fontWeight={600}>
                        Comment ({commentCol})
                      </Typography>
                      <Tooltip title="Copy to clipboard">
                        <IconButton
                          size="small"
                          onClick={() => {
                            navigator.clipboard.writeText(currentComment);
                            setSnack("Comment copied!");
                          }}
                          sx={{ opacity: 0.6, "&:hover": { opacity: 1 } }}
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                    <TextField
                      value={currentComment}
                      onChange={(e) => setCommentForCurrent(e.target.value)}
                      multiline
                      minRows={3}
                      fullWidth
                      sx={wrapSx}
                    />
                  </Box>
                )}

                {/* Primary fields with colors */}
                <Stack spacing={1.5}>
                  {questionCol && (
                    <FieldBlock
                      title={
                        hideFieldTitles
                          ? questionCol
                          : `Question (${questionCol})`
                      }
                      color="#e3f2fd"
                      value={currentRow[questionCol]}
                      onChange={(v) => setCell(currentIdx, questionCol, v)}
                      rowIdx={currentIdx}
                      fieldName={questionCol}
                      onTranslate={translateText}
                      translation={translations[`${currentIdx}-${questionCol}`]}
                      isTranslating={
                        translating[`${currentIdx}-${questionCol}`]
                      }
                    />
                  )}
                  {expectedCol && (
                    <FieldBlock
                      title={
                        hideFieldTitles
                          ? expectedCol
                          : `Expected Answer (${expectedCol})`
                      }
                      color="#e8f5e9"
                      value={currentRow[expectedCol]}
                      onChange={(v) => setCell(currentIdx, expectedCol, v)}
                      rowIdx={currentIdx}
                      fieldName={expectedCol}
                      onTranslate={translateText}
                      translation={translations[`${currentIdx}-${expectedCol}`]}
                      isTranslating={
                        translating[`${currentIdx}-${expectedCol}`]
                      }
                    />
                  )}
                  {apiResponseCol && (
                    <FieldBlock
                      title={
                        hideFieldTitles
                          ? apiResponseCol
                          : `API Response (${apiResponseCol})`
                      }
                      color="#ffebee"
                      value={currentRow[apiResponseCol]}
                      onChange={(v) => setCell(currentIdx, apiResponseCol, v)}
                      rowIdx={currentIdx}
                      fieldName={apiResponseCol}
                      onTranslate={translateText}
                      translation={
                        translations[`${currentIdx}-${apiResponseCol}`]
                      }
                      isTranslating={
                        translating[`${currentIdx}-${apiResponseCol}`]
                      }
                    />
                  )}
                  {/* Evaluation Score and Explanation in same row */}
                  {(evalScoreCol || evalExplainCol) && (
                    <Stack direction="row" spacing={1.5}>
                      {evalScoreCol && (
                        <Box sx={{ width: 200, flexShrink: 0 }}>
                          <FieldBlock
                            title={
                              hideFieldTitles
                                ? evalScoreCol
                                : `Evaluation Score (${evalScoreCol})`
                            }
                            color="#f5f5f5"
                            value={currentRow[evalScoreCol]}
                            onChange={(v) =>
                              setCell(currentIdx, evalScoreCol, v)
                            }
                            multiline={false}
                            rowIdx={currentIdx}
                            fieldName={evalScoreCol}
                            onTranslate={translateText}
                            translation={
                              translations[`${currentIdx}-${evalScoreCol}`]
                            }
                            isTranslating={
                              translating[`${currentIdx}-${evalScoreCol}`]
                            }
                          />
                        </Box>
                      )}
                      {evalExplainCol && (
                        <Box sx={{ flex: 1 }}>
                          <FieldBlock
                            title={
                              hideFieldTitles
                                ? evalExplainCol
                                : `Evaluation Explanation (${evalExplainCol})`
                            }
                            color="#f5f5f5"
                            value={currentRow[evalExplainCol]}
                            onChange={(v) =>
                              setCell(currentIdx, evalExplainCol, v)
                            }
                            rowIdx={currentIdx}
                            fieldName={evalExplainCol}
                            onTranslate={translateText}
                            translation={
                              translations[`${currentIdx}-${evalExplainCol}`]
                            }
                            isTranslating={
                              translating[`${currentIdx}-${evalExplainCol}`]
                            }
                          />
                        </Box>
                      )}
                    </Stack>
                  )}

                  {/* Citations JSON display - read-only */}
                  {useCitations && citationsCol && currentRow[citationsCol] && (
                    <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "#f8f9fa" }}>
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        sx={{ mb: 1 }}
                      >
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ fontWeight: 600 }}
                        >
                          {hideFieldTitles
                            ? citationsCol
                            : `Citations (${citationsCol})`}{" "}
                          - Read Only
                        </Typography>
                        <Tooltip title="Copy to clipboard">
                          <IconButton
                            size="small"
                            onClick={() => {
                              navigator.clipboard.writeText(
                                currentRow[citationsCol] || ""
                              );
                              setSnack("Citations copied!");
                            }}
                            sx={{ opacity: 0.6, "&:hover": { opacity: 1 } }}
                          >
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                      <Box
                        component="pre"
                        sx={{
                          backgroundColor: "#2d3748",
                          color: "#e2e8f0",
                          padding: 2,
                          borderRadius: 1,
                          fontSize: "0.875rem",
                          fontFamily: "Monaco, Menlo, 'Ubuntu Mono', monospace",
                          overflow: "auto",
                          maxHeight: "300px",
                          margin: 0,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                      >
                        {(() => {
                          try {
                            const parsed = JSON.parse(currentRow[citationsCol]);
                            return JSON.stringify(parsed, null, 2);
                          } catch {
                            return currentRow[citationsCol];
                          }
                        })()}
                      </Box>
                    </Box>
                  )}
                </Stack>

                {/* Other columns below */}
                {otherHeaders.length > 0 && (
                  <>
                    <Divider />
                    <Typography variant="subtitle2" color="text.secondary">
                      Other columns
                    </Typography>
                    <Stack spacing={1.2}>
                      {otherHeaders.map((h) => (
                        <Box key={h}>
                          <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                            sx={{ mb: 0.5 }}
                          >
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {h}
                            </Typography>
                            <Stack direction="row" spacing={0.5}>
                              {/* NEW: Translate button for other columns */}
                              <Tooltip
                                title={
                                  translations[`${currentIdx}-${h}`]
                                    ? "Hide translation"
                                    : "Translate to Traditional Chinese"
                                }
                              >
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    translateText(currentRow[h], currentIdx, h)
                                  }
                                  disabled={
                                    translating[`${currentIdx}-${h}`] ||
                                    !currentRow[h]?.trim()
                                  }
                                  sx={{
                                    opacity: translations[`${currentIdx}-${h}`]
                                      ? 1
                                      : 0.6,
                                    color: translations[`${currentIdx}-${h}`]
                                      ? "primary.main"
                                      : "inherit",
                                    "&:hover": { opacity: 1 },
                                  }}
                                >
                                  {translating[`${currentIdx}-${h}`] ? (
                                    <CircularProgress size={16} />
                                  ) : (
                                    <TranslateIcon fontSize="small" />
                                  )}
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Copy to clipboard">
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    navigator.clipboard.writeText(
                                      currentRow[h] || ""
                                    );
                                    setSnack(`${h} copied!`);
                                  }}
                                  sx={{
                                    opacity: 0.6,
                                    "&:hover": { opacity: 1 },
                                  }}
                                >
                                  <ContentCopyIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </Stack>
                          <TextField
                            value={currentRow[h] ?? ""}
                            onChange={(e) =>
                              setCell(currentIdx, h, e.target.value)
                            }
                            fullWidth
                            size="small"
                            multiline
                            minRows={2}
                            sx={wrapSx}
                          />
                          {/* NEW: Translation display for other columns */}
                          {translations[`${currentIdx}-${h}`] && (
                            <Box
                              sx={{
                                mt: 1,
                                p: 1.5,
                                borderRadius: 1,
                                bgcolor: "rgba(25, 118, 210, 0.08)",
                                border: "1px solid rgba(25, 118, 210, 0.2)",
                              }}
                            >
                              <Stack
                                direction="row"
                                justifyContent="space-between"
                                alignItems="center"
                                sx={{ mb: 0.5 }}
                              >
                                <Typography
                                  variant="caption"
                                  color="primary"
                                  sx={{ fontWeight: 600 }}
                                >
                                  繁體中文翻譯
                                </Typography>
                                <Tooltip title="Copy translation">
                                  <IconButton
                                    size="small"
                                    onClick={() => {
                                      navigator.clipboard.writeText(
                                        translations[`${currentIdx}-${h}`]
                                      );
                                      setSnack("Translation copied!");
                                    }}
                                    sx={{
                                      opacity: 0.6,
                                      "&:hover": { opacity: 1 },
                                    }}
                                  >
                                    <ContentCopyIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                              <Typography
                                variant="body2"
                                sx={{
                                  whiteSpace: "pre-wrap",
                                  wordBreak: "break-word",
                                  color: "text.primary",
                                }}
                              >
                                {translations[`${currentIdx}-${h}`]}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      ))}
                    </Stack>
                  </>
                )}

                {!!testMsg && (
                  <Alert
                    severity={/passed/i.test(testMsg) ? "success" : "error"}
                  >
                    {testMsg}
                  </Alert>
                )}
              </Stack>
            )}
          </Paper>
        )}
        {tab === 1 && (
          <Paper sx={{ p: 0 }}>
            {!hasData ? (
              <Box sx={{ p: 3 }}>
                <Alert severity="info" sx={{ mb: 1 }}>
                  Upload a CSV with headers to begin. Everything runs locally in
                  your browser. Tip: choose your status/comment columns above.
                  If a name you type doesn’t exist, it will be created
                  automatically.
                </Alert>
              </Box>
            ) : (
              <>
                <TableContainer sx={{ overflowX: "auto" }}>
                  <Table
                    size="small"
                    stickyHeader
                    sx={{ minWidth: Math.max(1200, headers.length * 360) }}
                  >
                    <TableHead>
                      <TableRow>
                        <TableCell
                          sx={{
                            width: 80,
                            fontWeight: 700,
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          #
                        </TableCell>
                        {headers.map((h) => (
                          <TableCell
                            key={h}
                            sx={{
                              fontWeight: 700,
                              minWidth: 320,
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {h}
                          </TableCell>
                        ))}
                        {statusCol && (
                          <TableCell
                            sx={{
                              width: 180,
                              fontWeight: 700,
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            Status{" "}
                            {useCheckedStatus && checkedColName
                              ? `(editing ${checkedColName})`
                              : ""}
                          </TableCell>
                        )}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pagedRows.map(({ row, globalIdx }) => {
                        return (
                          <TableRow
                            key={globalIdx}
                            hover
                            selected={globalIdx === currentIdx}
                            onClick={() => setCurrentIdx(globalIdx)}
                            sx={{ cursor: "pointer" }}
                          >
                            <TableCell sx={{ minWidth: 80 }}>
                              {globalIdx + 1}
                            </TableCell>
                            {headers.map((h) => (
                              <TableCell
                                key={h}
                                sx={{
                                  verticalAlign: "top",
                                  minWidth: 320,
                                  whiteSpace: "pre-wrap",
                                }}
                              >
                                <TextField
                                  value={row[h] ?? ""}
                                  onChange={(e) =>
                                    setCell(globalIdx, h, e.target.value)
                                  }
                                  variant="outlined"
                                  size="small"
                                  fullWidth
                                  multiline
                                  minRows={2}
                                  sx={wrapSx}
                                />
                              </TableCell>
                            ))}
                            {statusCol && (
                              <TableCell sx={{ minWidth: 180 }}>
                                {useCheckedStatus && checkedColName ? (
                                  <Stack
                                    direction="row"
                                    spacing={0.5}
                                    alignItems="center"
                                    flexWrap="wrap"
                                  >
                                    <Tooltip title="Checked">
                                      <span>
                                        <StatusChip
                                          value={row[checkedColName]}
                                        />
                                      </span>
                                    </Tooltip>
                                    <Tooltip title="Original">
                                      <span style={{ opacity: 0.3 }}>
                                        <StatusChip value={row[statusCol]} />
                                      </span>
                                    </Tooltip>
                                  </Stack>
                                ) : (
                                  <StatusChip value={row[statusCol]} />
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination
                  component="div"
                  count={totalDisplayed} // changed
                  page={page}
                  onPageChange={(e, p) => setPage(p)}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={(e) => {
                    setRowsPerPage(parseInt(e.target.value, 10));
                    setPage(0);
                  }}
                  rowsPerPageOptions={[10, 20, 50, 100]}
                />
              </>
            )}
          </Paper>
        )}
      </Container>

      {/* Fixed bottom navigation bar for Row QA tab */}
      {tab === 0 && hasData && (
        <Paper
          sx={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1200,
            borderRadius: 0,
            borderTop: 1,
            borderColor: "divider",
            boxShadow: "0 -2px 8px rgba(0,0,0,0.15)",
          }}
        >
          <Container maxWidth="xl">
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              alignItems={{ sm: "center" }}
              sx={{ py: 1.5, px: 1 }}
            >
              <Tooltip title="Previous">
                <span>
                  <IconButton
                    disabled={
                      (showFailAndDiscuss &&
                        displayedIndices.filter((i) => i < currentIdx)
                          .length === 0) ||
                      (showFailedOnly &&
                        displayedIndices.filter((i) => i < currentIdx)
                          .length === 0) ||
                      (!showFailedOnly &&
                        !showFailAndDiscuss &&
                        currentIdx <= 0)
                    }
                    onClick={() => {
                      if (showFailAndDiscuss || showFailedOnly) {
                        const prev = [...displayedIndices]
                          .filter((i) => i < currentIdx)
                          .pop();
                        if (prev != null) setCurrentIdx(prev);
                      } else {
                        setCurrentIdx((i) => Math.max(0, i - 1));
                      }
                    }}
                  >
                    <SkipPreviousIcon />
                  </IconButton>
                </span>
              </Tooltip>
              <TextField
                label="Row #"
                size="small"
                type="number"
                value={currentIdx + 1}
                onChange={(e) => jumpTo(e.target.value)}
                sx={{ width: 120 }}
              />
              <Typography variant="body2" color="text.secondary">
                / {rows.length}
              </Typography>
              <Tooltip title="Next">
                <span>
                  <IconButton
                    disabled={
                      (showFailAndDiscuss &&
                        displayedIndices.filter((i) => i > currentIdx)
                          .length === 0) ||
                      (showFailedOnly &&
                        displayedIndices.filter((i) => i > currentIdx)
                          .length === 0) ||
                      (!showFailedOnly &&
                        !showFailAndDiscuss &&
                        currentIdx >= rows.length - 1)
                    }
                    onClick={() => {
                      if (showFailAndDiscuss || showFailedOnly) {
                        const next = displayedIndices.find(
                          (i) => i > currentIdx
                        );
                        if (next != null) setCurrentIdx(next);
                      } else {
                        setCurrentIdx((i) => Math.min(rows.length - 1, i + 1));
                      }
                    }}
                  >
                    <SkipNextIcon />
                  </IconButton>
                </span>
              </Tooltip>
              <Box sx={{ flex: 1 }} />
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<CheckIcon />}
                  onClick={() => applyStatus("TRUE")}
                  size="small"
                >
                  Pass
                </Button>
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<CloseIcon />}
                  onClick={() => applyStatus("FALSE")}
                  size="small"
                >
                  Fail
                </Button>
                <Button
                  variant="contained"
                  color="warning"
                  startIcon={<WarningAmberIcon />}
                  onClick={() => applyStatus("INVALID")}
                  size="small"
                >
                  Invalid
                </Button>
                <Button
                  variant="contained"
                  color="warning"
                  startIcon={<ForumIcon />}
                  onClick={() => applyStatus("DISCUSS")}
                  size="small"
                >
                  Discuss
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<ClearIcon />}
                  onClick={clearStatus}
                  size="small"
                >
                  Clear
                </Button>
              </Stack>
            </Stack>
          </Container>
        </Paper>
      )}

      <Snackbar
        open={!!snack}
        autoHideDuration={2500}
        onClose={() => setSnack("")}
      >
        <Alert severity="warning" onClose={() => setSnack("")}>
          {snack}
        </Alert>
      </Snackbar>

      {/* Unified Settings Dialog */}
      <Dialog
        open={settingsDialogOpen}
        onClose={() => setSettingsDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6">Settings</Typography>
            <IconButton
              size="small"
              onClick={() => setSettingsDialogOpen(false)}
            >
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Tabs
            value={settingsTab}
            onChange={(e, v) => {
              setSettingsTab(v);
              // Update appropriate state when switching to Import/Export tab
              if (v === 1) {
                if (settingsMode === "url") {
                  setSettingsJson(loadedJsonUrl || "");
                } else {
                  setSettingsJson(generateSettingsJson());
                }
              }
            }}
            sx={{ mb: 2 }}
          >
            <Tab label="Options" />
            <Tab label="Import/Export Settings" />
            <Tab label="Load CSV from URL" />
            <Tab label="GitHub Integration" /> {/* NEW TAB */}
            <Tab label="Google Translate" /> {/* NEW TAB */}
          </Tabs>

          {/* Tab 0: Options */}
          {settingsTab === 0 && (
            <Stack spacing={3}>
              {/* File name and column selectors */}
              <Stack spacing={2}>
                <Typography
                  variant="subtitle2"
                  color="text.secondary"
                  sx={{ fontWeight: 600 }}
                >
                  Basic Settings
                </Typography>
                <TextField
                  label="File name"
                  size="small"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  fullWidth
                />
                <HeaderAutocomplete
                  label="Status column (TRUE/FALSE/INVALID/DISCUSS)"
                  value={statusCol}
                  options={headers}
                  onChange={(v) => setStatusCol(v)}
                  onEnsureCreate={(v) => ensureCol(v)}
                />
                <HeaderAutocomplete
                  label="Comment column (type to create new)"
                  value={commentCol}
                  options={headers}
                  onChange={(v) => setCommentCol(v)}
                  onEnsureCreate={(v) => ensureCol(v)}
                />
              </Stack>

              <Divider />

              {/* Column mappings */}
              <Stack spacing={2}>
                <Typography
                  variant="subtitle2"
                  color="text.secondary"
                  sx={{ fontWeight: 600 }}
                >
                  Column Mappings
                </Typography>
                <HeaderAutocomplete
                  label="Question column"
                  value={questionCol}
                  options={headers}
                  onChange={(v) => setQuestionCol(v)}
                  onEnsureCreate={(v) => ensureCol(v)}
                />
                <HeaderAutocomplete
                  label="Expected answer column"
                  value={expectedCol}
                  options={headers}
                  onChange={(v) => setExpectedCol(v)}
                  onEnsureCreate={(v) => ensureCol(v)}
                />
                <HeaderAutocomplete
                  label="API response column"
                  value={apiResponseCol}
                  options={headers}
                  onChange={(v) => setApiResponseCol(v)}
                  onEnsureCreate={(v) => ensureCol(v)}
                />
                <HeaderAutocomplete
                  label="Evaluation score column"
                  value={evalScoreCol}
                  options={headers}
                  onChange={(v) => setEvalScoreCol(v)}
                  onEnsureCreate={(v) => ensureCol(v)}
                />
                <HeaderAutocomplete
                  label="Evaluation explanation column"
                  value={evalExplainCol}
                  options={headers}
                  onChange={(v) => setEvalExplainCol(v)}
                  onEnsureCreate={(v) => ensureCol(v)}
                />
                {useCitations && (
                  <HeaderAutocomplete
                    label="Citations column"
                    value={citationsCol}
                    options={headers}
                    onChange={(v) => setCitationsCol(v)}
                    onEnsureCreate={(v) => ensureCol(v)}
                  />
                )}
              </Stack>

              <Divider />

              {/* Toggles and filters */}
              <Stack spacing={2}>
                <Typography
                  variant="subtitle2"
                  color="text.secondary"
                  sx={{ fontWeight: 600 }}
                >
                  View Options
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={useCheckedStatus}
                      onChange={(e) => setUseCheckedStatus(e.target.checked)}
                    />
                  }
                  label="Use checked column"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={useCitations}
                      onChange={(e) => setUseCitations(e.target.checked)}
                    />
                  }
                  label="Enable citations"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={hideFieldTitles}
                      onChange={(e) => setHideFieldTitles(e.target.checked)}
                    />
                  }
                  label="Hide field titles"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={showFailedOnly}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setShowFailAndDiscuss(false);
                        }
                        setShowFailedOnly(e.target.checked);
                        setPage(0);
                      }}
                    />
                  }
                  label="Show only FAIL"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={showFailAndDiscuss}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setShowFailedOnly(false);
                        }
                        setShowFailAndDiscuss(e.target.checked);
                        setPage(0);
                      }}
                    />
                  }
                  label="Show FAIL + DISCUSS"
                />
                <FormControl fullWidth size="small">
                  <InputLabel>Filter by column</InputLabel>
                  <Select
                    value={filterByCheckedCol ? "checked" : "original"}
                    onChange={(e) => {
                      setFilterByCheckedCol(e.target.value === "checked");
                      setPage(0);
                    }}
                    label="Filter by column"
                    disabled={
                      (!showFailedOnly && !showFailAndDiscuss) ||
                      !checkedColName
                    }
                  >
                    <MenuItem value="original">Original</MenuItem>
                    <MenuItem value="checked">Checked</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            </Stack>
          )}

          {/* Tab 1: Import/Export Settings */}
          {settingsTab === 1 && (
            <Stack spacing={2}>
              <Tabs
                value={settingsMode}
                onChange={(e, v) => {
                  setSettingsMode(v);
                  if (v === "url") {
                    setSettingsJson(loadedJsonUrl || "");
                  } else {
                    setSettingsJson(generateSettingsJson());
                  }
                }}
              >
                <Tab label="Text/Paste JSON" value="text" />
                <Tab label="Load from URL" value="url" />
              </Tabs>

              <TextField
                label={settingsMode === "text" ? "Settings JSON" : "JSON URL"}
                value={settingsJson}
                onChange={(e) => setSettingsJson(e.target.value)}
                multiline={settingsMode === "text"}
                minRows={settingsMode === "text" ? 10 : 1}
                fullWidth
                sx={wrapSx}
                placeholder={
                  settingsMode === "text"
                    ? "Paste settings JSON here or click Export to see current settings"
                    : "https://example.com/settings.json"
                }
              />

              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button
                  onClick={exportSettings}
                  startIcon={<FileDownloadIcon />}
                >
                  Export Current
                </Button>
                <Button onClick={copyShareableLink} startIcon={<LinkIcon />}>
                  Copy Share Link
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSettingsImport}
                  disabled={!settingsJson.trim()}
                >
                  Import Settings
                </Button>
              </Stack>
            </Stack>
          )}

          {/* Tab 2: Load CSV from URL */}
          {settingsTab === 2 && (
            <Stack spacing={2}>
              <Alert severity="info">
                Load a CSV file directly from a URL. The file will be parsed and
                loaded into the application.
              </Alert>

              <TextField
                label="CSV URL"
                value={csvUrlInput}
                onChange={(e) => setCsvUrlInput(e.target.value)}
                fullWidth
                placeholder="https://example.com/data.csv"
              />

              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button
                  variant="contained"
                  onClick={() => {
                    loadCsvFromUrl(csvUrlInput);
                    setSettingsDialogOpen(false);
                  }}
                  disabled={!csvUrlInput.trim()}
                  startIcon={<LinkIcon />}
                >
                  Load CSV
                </Button>
              </Stack>
            </Stack>
          )}

          {/* Tab 3: GitHub Integration */}
          {settingsTab === 3 && (
            <Stack spacing={2}>
              <Alert severity="info">
                To upload files to GitHub Gist, you need a Personal Access
                Token.
                <br />
                <strong>Steps:</strong>
                <ol style={{ marginTop: 8, paddingLeft: 20 }}>
                  <li>
                    Go to GitHub Settings → Developer settings → Personal access
                    tokens → Tokens (classic)
                  </li>
                  <li>Click "Generate new token (classic)"</li>
                  <li>
                    Give it a name and select only the <strong>gist</strong>{" "}
                    scope
                  </li>
                  <li>Generate and copy the token</li>
                  <li>
                    Paste it below OR add <code>?token=YOUR_TOKEN</code> to the
                    URL
                  </li>
                </ol>
                <a
                  href="https://github.com/settings/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#1976d2" }}
                >
                  → Open GitHub Token Settings
                </a>
              </Alert>

              <TextField
                label="GitHub Personal Access Token"
                type="password"
                value={githubToken}
                onChange={(e) => saveGitHubToken(e.target.value)}
                fullWidth
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                helperText={
                  githubToken
                    ? "Token saved (stored in browser)"
                    : "Enter your token to enable cloud uploads"
                }
              />

              {/* NEW: Toggle for including token in shareable links */}
              <FormControlLabel
                control={
                  <Switch
                    checked={includeTokenInLink}
                    onChange={(e) => setIncludeTokenInLink(e.target.checked)}
                  />
                }
                label="Include token in shareable links"
              />

              {githubToken && (
                <Alert severity="success">
                  Token configured! You can now use the "Share to Cloud" button.
                </Alert>
              )}

              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button
                  color="error"
                  onClick={() => {
                    saveGitHubToken("");
                    setSnack("GitHub token cleared");
                  }}
                  disabled={!githubToken}
                >
                  Clear Token
                </Button>
              </Stack>
            </Stack>
          )}

          {/* Tab 4: Google Translate */}
          {settingsTab === 4 && (
            <Stack spacing={2}>
              <Alert severity="info">
                To use Google Translate, you need a Google Cloud API key.
                <br />
                <strong>Steps:</strong>
                <ol style={{ marginTop: 8, paddingLeft: 20 }}>
                  <li>Go to Google Cloud Console</li>
                  <li>Enable "Cloud Translation API"</li>
                  <li>Create an API key with Translation API access</li>
                  <li>Copy and paste the key below</li>
                </ol>
                <strong>Free Quota:</strong> 500,000 characters/month (FREE)
                <br />
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#1976d2" }}
                >
                  → Open Google Cloud Credentials
                </a>
              </Alert>

              <TextField
                label="Google Cloud API Key"
                type="password"
                value={googleApiKey}
                onChange={(e) => saveGoogleApiKey(e.target.value)}
                fullWidth
                placeholder="AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXX"
                helperText={
                  googleApiKey
                    ? "API key saved (stored in browser)"
                    : "Enter your API key to enable translations"
                }
              />

              {googleApiKey && (
                <Alert severity="success">
                  API key configured! You can now translate text to Traditional
                  Chinese by clicking the translate icon next to any field.
                </Alert>
              )}

              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button
                  color="error"
                  onClick={() => {
                    saveGoogleApiKey("");
                    setSnack("Google API key cleared");
                  }}
                  disabled={!googleApiKey}
                >
                  Clear Key
                </Button>
              </Stack>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* NEW: Gist Upload Success Dialog */}
      <Dialog
        open={showGistDialog}
        onClose={() => setShowGistDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6">
              Files Uploaded Successfully! 🎉
            </Typography>
            <IconButton size="small" onClick={() => setShowGistDialog(false)}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Alert severity="success">
              Your CSV and settings have been uploaded to GitHub Gist and a
              shareable link has been generated.
            </Alert>

            <TextField
              label="Shareable Link (Anyone with this link can load your data)"
              value={uploadedGistUrl}
              fullWidth
              multiline
              rows={3}
              InputProps={{
                readOnly: true,
              }}
              sx={wrapSx}
            />

            <Alert severity="info">
              <strong>How to use:</strong>
              <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                <li>
                  Share this link with anyone who needs to review the data
                </li>
                <li>
                  The link will automatically load the CSV, settings, and token
                </li>
                <li>Files are stored privately in your GitHub Gist</li>
              </ul>
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              navigator.clipboard.writeText(uploadedGistUrl);
              setSnack("Link copied to clipboard!");
            }}
          >
            Copy Link
          </Button>
          <Button
            variant="outlined"
            onClick={() => window.open(uploadedGistUrl, "_blank")}
          >
            Open Link
          </Button>
          <Button onClick={() => setShowGistDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
