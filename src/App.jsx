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
import Papa from "papaparse";

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

function FieldBlock({ title, color, value, onChange, multiline = true }) {
  return (
    <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: color }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontWeight: 600 }}
      >
        {title}
      </Typography>
      <TextField
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        fullWidth
        size="small"
        multiline={multiline}
        minRows={3}
        sx={wrapSx}
      />
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
  const [showFailedOnly, setShowFailedOnly] = useState(false); // NEW
  const [showFailAndDiscuss, setShowFailAndDiscuss] = useState(false); // NEW toggle
  const [filterByCheckedCol, setFilterByCheckedCol] = useState(false); // NEW: filter source toggle
  const [showOptions, setShowOptions] = useState(false); // NEW: toggle to show/hide options

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
            <Button
              variant="outlined"
              size="small"
              onClick={() => setShowOptions(!showOptions)}
              sx={{ minWidth: 120 }}
            >
              {showOptions ? "Hide Options" : "Show Options"}
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: "none" }}
              onChange={(e) => loadCsvFile(e.target.files?.[0])}
            />
            {/* Updated: consolidated download options */}
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
        {showOptions && (
          <Paper sx={{ p: 2, mb: 2 }}>
            <Stack spacing={2}>
              {/* First row: File name and column selectors */}
              <Stack
                direction="row"
                spacing={2}
                useFlexGap
                flexWrap="nowrap"
                alignItems="stretch"
              >
                <TextField
                  label="File name"
                  size="small"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  sx={{ flex: 1, minWidth: 200 }}
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

              {/* Second row: All toggles and filter selector */}
              <Stack
                direction="row"
                spacing={2}
                useFlexGap
                flexWrap="nowrap"
                alignItems="stretch"
              >
                <FormControlLabel
                  control={
                    <Switch
                      checked={useCheckedStatus}
                      onChange={(e) => setUseCheckedStatus(e.target.checked)}
                    />
                  }
                  label="Use checked column"
                  sx={{ minWidth: 150, whiteSpace: "nowrap" }}
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={useCitations}
                      onChange={(e) => setUseCitations(e.target.checked)}
                    />
                  }
                  label="Enable citations"
                  sx={{ minWidth: 150, whiteSpace: "nowrap" }}
                />
                {/* Show only FAIL toggle */}
                <FormControlLabel
                  control={
                    <Switch
                      checked={showFailedOnly}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setShowFailAndDiscuss(false); // Disable the other filter
                        }
                        setShowFailedOnly(e.target.checked);
                        setPage(0);
                      }}
                    />
                  }
                  label="Show only FAIL"
                  sx={{ minWidth: 140, whiteSpace: "nowrap" }}
                />
                {/* Show FAIL and DISCUSS toggle */}
                <FormControlLabel
                  control={
                    <Switch
                      checked={showFailAndDiscuss}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setShowFailedOnly(false); // Disable the other filter
                        }
                        setShowFailAndDiscuss(e.target.checked);
                        setPage(0);
                      }}
                    />
                  }
                  label="Show FAIL + DISCUSS"
                  sx={{ minWidth: 160, whiteSpace: "nowrap" }}
                />
                {/* Fixed filter source selector */}
                <FormControl sx={{ minWidth: 180 }} size="small">
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
          </Paper>
        )}
        {showOptions && (
          <Paper sx={{ p: 2, mb: 2 }}>
            <Stack
              direction="row"
              spacing={2}
              useFlexGap
              flexWrap="nowrap"
              alignItems="stretch"
            >
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
          </Paper>
        )}

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
                {/* Status + Comment */}
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
                          <Typography variant="caption" color="text.secondary">
                            Checked
                          </Typography>
                          <StatusChip value={currentChecked} />
                        </Stack>
                        <Stack
                          direction="row"
                          spacing={0.5}
                          alignItems="center"
                        >
                          <Typography variant="caption" color="text.secondary">
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

                {commentCol && (
                  <TextField
                    label={`Comment (${commentCol})`}
                    value={currentComment}
                    onChange={(e) => setCommentForCurrent(e.target.value)}
                    multiline
                    minRows={3}
                    fullWidth
                    sx={wrapSx}
                  />
                )}

                {/* Primary fields with colors */}
                <Stack spacing={1.5}>
                  {questionCol && (
                    <FieldBlock
                      title={`Question (${questionCol})`}
                      color="#e3f2fd" // light blue
                      value={currentRow[questionCol]}
                      onChange={(v) => setCell(currentIdx, questionCol, v)}
                    />
                  )}
                  {expectedCol && (
                    <FieldBlock
                      title={`Expected Answer (${expectedCol})`}
                      color="#e8f5e9" // light green
                      value={currentRow[expectedCol]}
                      onChange={(v) => setCell(currentIdx, expectedCol, v)}
                    />
                  )}
                  {apiResponseCol && (
                    <FieldBlock
                      title={`API Response (${apiResponseCol})`}
                      color="#ffebee" // light red
                      value={currentRow[apiResponseCol]}
                      onChange={(v) => setCell(currentIdx, apiResponseCol, v)}
                    />
                  )}
                  <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                    {evalScoreCol && (
                      <FieldBlock
                        title={`Evaluation Score (${evalScoreCol})`}
                        color="#f5f5f5" // light grey
                        value={currentRow[evalScoreCol]}
                        onChange={(v) => setCell(currentIdx, evalScoreCol, v)}
                      />
                    )}
                    {evalExplainCol && (
                      <FieldBlock
                        title={`Evaluation Explanation (${evalExplainCol})`}
                        color="#f5f5f5" // light grey
                        value={currentRow[evalExplainCol]}
                        onChange={(v) => setCell(currentIdx, evalExplainCol, v)}
                      />
                    )}
                  </Stack>

                  {/* Citations JSON display - read-only */}
                  {useCitations && citationsCol && currentRow[citationsCol] && (
                    <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "#f8f9fa" }}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ fontWeight: 600, mb: 1, display: "block" }}
                      >
                        Citations ({citationsCol}) - Read Only
                      </Typography>
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
                          "& .json-key": { color: "#81c7d4" },
                          "& .json-string": { color: "#a8e6cf" },
                          "& .json-number": { color: "#ffd3a5" },
                          "& .json-boolean": { color: "#ffaaa5" },
                          "& .json-null": { color: "#ff8b94" },
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
                          <Typography variant="caption" color="text.secondary">
                            {h}
                          </Typography>
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
    </Box>
  );
}
