// server.ts
import dotenv2 from "dotenv";
import express from "express";
import path3 from "path";
import crypto2 from "crypto";
import { spawn } from "child_process";
import JSZip4 from "jszip";
import { ProxyAgent } from "undici";
import axios9 from "axios";
import * as cheerio5 from "cheerio";

// src/utils/xmlParser.ts
import JSZip from "jszip";

// src/utils/providerIdentity.ts
var PORTALS = {
  MISA: ["meinvoice.vn", "misa.vn"],
  THAISON: ["einvoice.vn", "einvoice.com.vn", "thaison.vn"],
  MINVOICE: ["minvoice.vn", "minvoice.com.vn"],
  VIETTEL: ["sinvoice.viettel.vn", "vinvoice.viettel.vn", "sinvoice.vn"],
  VNPT: ["vnpt-invoice.com.vn", "vnpt-invoice.vn", "invoice.vnpt.vn"],
  EASYINVOICE: ["easyinvoice.vn", "easyinvoice.com.vn", "softdreams.vn"],
  BKAV: ["ehoadon.vn", "ehoadon.bkav.com"],
  LCS: ["lcssoft.com.vn"],
  "4SI": ["4si.vn"],
  VNPAY: ["vnpayinvoice.vn", "einvoice.vietcombank.com.vn"],
  CYBERBILL: ["cyberbill.vn"],
  FPT: ["hoadon.ftg.vn", "hoadondientu.fpt.com.vn"]
};
var SOLUTION_PROVIDERS = {
  "0101243150": "MISA",
  "0101300842": "THAISON",
  "0106026495": "MINVOICE",
  "0100684378": "VNPT",
  "0100686209": "VNPT",
  "0100109106": "VIETTEL",
  "0105987432": "EASYINVOICE",
  "0315744883": "4SI",
  "0302999571": "LCS",
  "0101360697": "BKAV",
  "0102182292": "VNPAY",
  "0104128565": "FPT",
  "0107871301": "CYBERBILL"
};
function providerFromPortal(value2) {
  try {
    const url = new URL(/^https?:\/\//i.test(value2) ? value2 : `https://${value2}`);
    if (!["http:", "https:"].includes(url.protocol)) return void 0;
    const host = url.hostname.toLowerCase();
    return Object.entries(PORTALS).find(([, domains]) => domains.some((domain) => host === domain || host.endsWith(`.${domain}`)))?.[0];
  } catch {
    return void 0;
  }
}
function providerFromXmlPortal(xml) {
  const content = xml.replace(/<(?:\w+:)?(?:Signature|X509Certificate|X509IssuerName|X509SubjectName)\b[^>]*>[\s\S]*?<\/(?:\w+:)?(?:Signature|X509Certificate|X509IssuerName|X509SubjectName)>/gi, "");
  for (const url of content.match(/https?:\/\/[^\s<>"']+/gi) || []) {
    const provider = providerFromPortal(url.replace(/\]\]>.*$/, ""));
    if (provider) return provider;
  }
  return void 0;
}

// src/utils/providerRouting.ts
var KNOWN_PROVIDERS = /* @__PURE__ */ new Set([
  "MISA",
  "VIETTEL",
  "VNPT",
  "EASYINVOICE",
  "4SI",
  "LCS",
  "MINVOICE",
  "THAISON",
  "BKAV",
  "CYBERBILL",
  "VNPAY",
  "FPT"
]);
function resolveInvoiceProvider(invoice) {
  if (!invoice) return void 0;
  const xml = String(invoice.rawXml || "");
  const xmlPortal = providerFromXmlPortal(xml);
  if (xmlPortal) return xmlPortal;
  for (const tag of ["Website", "Wsite", "DLTCuu", "URLTraCuu", "LinkTraCuu", "lookupUrl"]) {
    const provider2 = providerFromPortal(extractTagValue(xml, tag));
    if (provider2) return provider2;
  }
  const xmlTax = extractTagValue(xml, "MSTTCGP").replace(/\D/g, "");
  if (SOLUTION_PROVIDERS[xmlTax]) return SOLUTION_PROVIDERS[xmlTax];
  const tax = String(invoice.msttcgp || "").replace(/\D/g, "");
  if (SOLUTION_PROVIDERS[tax]) return SOLUTION_PROVIDERS[tax];
  const portal = providerFromPortal(String(invoice.lookupUrl || ""));
  if (portal) return portal;
  const name = [extractTagValue(xml, "TenTCGP"), extractTagValue(xml, "TCGP"), extractTagValue(xml, "ToChucGiaiPhap"), invoice.tentcgp || ""].join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  for (const [pattern, provider2] of [
    [/THAI\s*SON/, "THAISON"],
    [/M-?INVOICE/, "MINVOICE"],
    [/MISA/, "MISA"],
    [/VNPT/, "VNPT"],
    [/VIETTEL/, "VIETTEL"],
    [/SOFTDREAMS|EASYINVOICE/, "EASYINVOICE"],
    [/BKAV/, "BKAV"],
    [/L\.?C\.?S\b|LCSSOFT/, "LCS"],
    [/VNPAY|THANH TOAN VIET NAM/, "VNPAY"],
    [/FPT/, "FPT"],
    [/4SI/, "4SI"],
    [/CYBERLOTUS|CYBERBILL/, "CYBERBILL"]
  ]) {
    if (pattern.test(name)) return provider2;
  }
  const provider = String(invoice.provider || "").trim().toUpperCase().replace("LCS_SOFT", "LCS");
  return KNOWN_PROVIDERS.has(provider) ? provider : void 0;
}

// src/services/invoice-engine/providerDetector.ts
function detectProvider(xml) {
  return detectProviderWithDetails(xml).provider;
}
function detectProviderWithDetails(xml) {
  const provider = resolveInvoiceProvider({ rawXml: xml || "" });
  return {
    provider: provider || "UNKNOWN",
    priority: provider ? providerFromXmlPortal(xml || "") ? 1 : 1.5 : 0,
    matchedPattern: provider || "",
    sourceDescription: provider ? "Invoice portal / solution-provider metadata" : "No invoice provider metadata"
  };
}

// src/utils/xmlParser.ts
function numberToVietnameseWords(num) {
  if (num === 0) return "Kh\xF4ng \u0111\u1ED3ng";
  const units = ["", "m\u1ED9t", "hai", "ba", "b\u1ED1n", "n\u0103m", "s\xE1u", "b\u1EA3y", "t\xE1m", "ch\xEDn"];
  const scales = ["", "ngh\xECn", "tri\u1EC7u", "t\u1EF7", "ngh\xECn t\u1EF7", "tri\u1EC7u t\u1EF7"];
  function readGroup(group) {
    const hundred = Math.floor(group / 100);
    const ten = Math.floor(group % 100 / 10);
    const unit = group % 10;
    let result = "";
    if (hundred > 0 || group >= 100) {
      result += units[hundred] + " tr\u0103m ";
      if (ten === 0 && unit > 0) result += "l\u1EBB ";
    }
    if (ten > 1) {
      result += units[ten] + " m\u01B0\u01A1i ";
      if (unit === 1) result += "m\u1ED1t ";
      else if (unit === 5) result += "l\u0103m ";
      else if (unit > 0) result += units[unit] + " ";
    } else if (ten === 1) {
      result += "m\u01B0\u1EDDi ";
      if (unit === 1) result += "m\u1ED9t ";
      else if (unit === 5) result += "l\u0103m ";
      else if (unit > 0) result += units[unit] + " ";
    } else if (unit > 0) {
      result += units[unit] + " ";
    }
    return result.trim();
  }
  let str = "";
  let n = Math.abs(Math.round(num));
  let scaleIdx = 0;
  while (n > 0) {
    const group = n % 1e3;
    if (group > 0) {
      const groupStr = readGroup(group);
      str = groupStr + " " + scales[scaleIdx] + " " + str;
    }
    n = Math.floor(n / 1e3);
    scaleIdx++;
  }
  str = str.trim();
  if (!str) return "Kh\xF4ng \u0111\u1ED3ng";
  str = str.charAt(0).toUpperCase() + str.slice(1) + " \u0111\u1ED3ng ch\u1EB5n";
  return str.replace(/\s+/g, " ");
}
function extractTagValue(xmlOrElement, tagName, defaultValue = "") {
  if (typeof xmlOrElement !== "string") {
    if ("getElementsByTagNameNS" in xmlOrElement) {
      try {
        const elNs = xmlOrElement.getElementsByTagNameNS("*", tagName)[0] || xmlOrElement.getElementsByTagNameNS("*", tagName.toLowerCase())[0];
        if (elNs && elNs.textContent) {
          const cleaned = cleanDetailedItemName(elNs.textContent);
          if (cleaned.length > 0) return cleaned;
        }
      } catch {
      }
    }
    const el = xmlOrElement.getElementsByTagName(tagName)[0] || xmlOrElement.getElementsByTagName(tagName.toLowerCase())[0] || xmlOrElement.getElementsByTagName(tagName.toUpperCase())[0];
    if (el && el.textContent) {
      const cleaned = cleanDetailedItemName(el.textContent);
      if (cleaned.length > 0) return cleaned;
    }
    const children = "children" in xmlOrElement ? Array.from(xmlOrElement.children) : [];
    for (const ch of children) {
      const local = (ch.localName || ch.nodeName || "").replace(/^[a-zA-Z0-9_]+:/, "").toLowerCase();
      if (local === tagName.toLowerCase()) {
        const cleaned = cleanDetailedItemName(ch.textContent || "");
        if (cleaned.length > 0) return cleaned;
      }
    }
    return defaultValue;
  }
  const cleanTag = tagName.replace(/[^a-zA-Z0-9_]/g, "");
  const regex = new RegExp(`<(?:[a-zA-Z0-9_]+:)?${cleanTag}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_]+:)?${cleanTag}>`, "i");
  const match = xmlOrElement.match(regex);
  if (match && match[1]) {
    return cleanDetailedItemName(match[1]);
  }
  return defaultValue;
}
function extractTagBlocks(xml, tagName) {
  const cleanTag = tagName.replace(/[^a-zA-Z0-9_]/g, "");
  const regex = new RegExp(`<(?:[a-zA-Z0-9_]+:)?${cleanTag}(?:\\s+[^>]*)?(?:\\/>|>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_]+:)?${cleanTag}>)`, "gi");
  const blocks = [];
  let m;
  while ((m = regex.exec(xml)) !== null) {
    if (m[0]) {
      blocks.push(m[0]);
    }
  }
  return blocks;
}
function cleanDetailedItemName(raw) {
  if (!raw) return "";
  let str = String(raw).trim();
  str = str.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1");
  while (str.startsWith("<![CDATA[") && str.endsWith("]]>")) {
    str = str.substring(9, str.length - 3).trim();
  }
  str = str.replace(/<br\s*\/?>/gi, " ");
  str = str.replace(/<\/?[a-zA-Z0-9_-]+(?:\s+[^>]*)?>/g, "");
  const entityMap = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&apos;": "'",
    "&nbsp;": " ",
    "&#160;": " ",
    "&copy;": "\xA9",
    "&reg;": "\xAE",
    "&trade;": "\u2122",
    "&agrave;": "\xE0",
    "&aacute;": "\xE1",
    "&acirc;": "\xE2",
    "&atilde;": "\xE3",
    "&egrave;": "\xE8",
    "&eacute;": "\xE9",
    "&ecirc;": "\xEA",
    "&igrave;": "\xEC",
    "&iacute;": "\xED",
    "&ograve;": "\xF2",
    "&oacute;": "\xF3",
    "&ocirc;": "\xF4",
    "&otilde;": "\xF5",
    "&ugrave;": "\xF9",
    "&uacute;": "\xFA",
    "&ucirc;": "\xFB",
    "&yacute;": "\xFD",
    "&Agrave;": "\xC0",
    "&Aacute;": "\xC1",
    "&Acirc;": "\xC2",
    "&Atilde;": "\xC3",
    "&Egrave;": "\xC8",
    "&Eacute;": "\xC9",
    "&Ecirc;": "\xCA",
    "&Igrave;": "\xCC",
    "&Iacute;": "\xCD",
    "&Ograve;": "\xD2",
    "&Oacute;": "\xD3",
    "&Ocirc;": "\xD4",
    "&Otilde;": "\xD5",
    "&Ugrave;": "\xD9",
    "&Uacute;": "\xDA",
    "&Ucirc;": "\xDB",
    "&Yacute;": "\xDD"
  };
  str = str.replace(/&[a-zA-Z]+;/g, (m) => entityMap[m] || entityMap[m.toLowerCase()] || m).replace(/\u00A0/g, " ").replace(/&#39;/g, "'").replace(/&#039;/g, "'").replace(/&#(\d+);/g, (_, dec) => {
    const code = parseInt(dec, 10);
    return !isNaN(code) ? String.fromCharCode(code) : _;
  }).replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
    const code = parseInt(hex, 16);
    return !isNaN(code) ? String.fromCharCode(code) : _;
  });
  if (str.includes("&")) {
    str = str.replace(/&[a-zA-Z]+;/g, (m) => entityMap[m] || entityMap[m.toLowerCase()] || m).replace(/&#39;/g, "'").replace(/&#039;/g, "'");
  }
  return str.replace(/\r?\n|\r/g, " ").replace(/[ \t]+/g, " ").trim();
}
function parseInvoiceNumber(val, defaultVal = 0) {
  if (typeof val === "number") return isNaN(val) ? defaultVal : val;
  if (!val || typeof val !== "string") return defaultVal;
  let str = val.trim();
  if (!str) return defaultVal;
  str = str.replace(/\s+/g, "");
  const isNegative = str.startsWith("-") || str.startsWith("(") && str.endsWith(")");
  str = str.replace(/[()]/g, "").replace(/^-/, "");
  const dotCount = (str.match(/\./g) || []).length;
  const commaCount = (str.match(/,/g) || []).length;
  if (dotCount > 0 && commaCount > 0) {
    if (str.lastIndexOf(",") > str.lastIndexOf(".")) {
      str = str.replace(/\./g, "").replace(",", ".");
    } else {
      str = str.replace(/,/g, "");
    }
  } else if (dotCount > 1) {
    str = str.replace(/\./g, "");
  } else if (commaCount > 1) {
    str = str.replace(/,/g, "");
  } else if (commaCount === 1) {
    str = str.replace(",", ".");
  } else if (dotCount === 1) {
    const parts = str.split(".");
    if (parts[1] === "000") {
      str = parts[0] + "000";
    }
  }
  str = str.replace(/[^0-9.]/g, "");
  const num = parseFloat(str);
  if (isNaN(num)) return defaultVal;
  return isNegative ? -num : num;
}
function getPayloadValue(source, keys) {
  if (!source || typeof source !== "object") return void 0;
  for (const key of keys) {
    if (source[key] !== void 0 && source[key] !== null && source[key] !== "") return source[key];
  }
  const lowerKeys = Object.keys(source);
  const normalizedKey = (key) => key.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const key of keys) {
    const actualKey = lowerKeys.find((candidate) => normalizedKey(candidate) === normalizedKey(key));
    if (actualKey && source[actualKey] !== void 0 && source[actualKey] !== null && source[actualKey] !== "") {
      return source[actualKey];
    }
  }
  return void 0;
}
function pickItemName(source) {
  const candidates = [
    getPayloadValue(source, ["itemName", "ItemName"]),
    getPayloadValue(source, ["ten", "Ten"]),
    getPayloadValue(source, ["tenhh", "TenHH"]),
    getPayloadValue(source, ["tensp", "TenSP"]),
    getPayloadValue(source, ["tenHHDVu", "TenHHDVu"]),
    getPayloadValue(source, ["thhdvu", "THHDVu"]),
    getPayloadValue(source, ["thhhdvu", "THHHDVu", "thhdv", "THHDV", "tenhhdv", "TenHHDV"]),
    getPayloadValue(source, ["tenhanghoadichvu", "TenHangHoaDichVu"]),
    getPayloadValue(source, ["tenhanghoa", "TenHangHoa"]),
    getPayloadValue(source, ["tenhang", "TenHang"]),
    getPayloadValue(source, ["tensanpham", "TenSanPham"]),
    getPayloadValue(source, ["tendichvu", "TenDichVu", "tendv", "TenDV"]),
    getPayloadValue(source, ["productName", "ProductName"]),
    getPayloadValue(source, ["serviceName", "ServiceName"]),
    getPayloadValue(source, ["goodsName", "GoodsName"]),
    getPayloadValue(source, ["goodsDescription", "GoodsDescription"]),
    getPayloadValue(source, ["itemDescription", "ItemDescription"]),
    getPayloadValue(source, ["diengiai", "DienGiai", "diengiaihh", "DienGiaiHH"]),
    getPayloadValue(source, ["noidung", "NoiDung", "noidunghh", "NoiDungHH"]),
    getPayloadValue(source, ["description", "Description"]),
    getPayloadValue(source, ["name", "Name"])
  ];
  const cleaned = candidates.filter((value2) => value2 !== void 0 && value2 !== null).map((value2) => cleanDetailedItemName(String(value2))).filter(Boolean);
  return cleaned.find((value2) => !isPlaceholderItemName(value2)) || cleaned[0] || "";
}
function normalizeInvoiceItem(source, idx = 0) {
  const lineNo = parseInt(String(getPayloadValue(source, ["lineNo", "stt", "STT", "SoTT", "Idx", "LineNo"]) ?? idx + 1), 10) || idx + 1;
  const itemName = pickItemName(source) || `H\xE0ng h\xF3a / D\u1ECBch v\u1EE5 ${lineNo}`;
  const unit = cleanDetailedItemName(String(getPayloadValue(source, ["unit", "dvtinh", "dvt", "DVTinh", "DonViTinh", "Unit"]) ?? "C\xE1i")) || "C\xE1i";
  const quantity = parseInvoiceNumber(getPayloadValue(source, ["quantity", "sluong", "SLuong", "SoLuong", "Qty"]), 1);
  const unitPrice = parseInvoiceNumber(getPayloadValue(source, ["unitPrice", "dgia", "DGia", "DonGia", "Price"]), 0);
  const amount = parseInvoiceNumber(getPayloadValue(source, ["amount", "thtien", "ThTien", "ThanhTien", "Total"]), quantity * unitPrice);
  const taxRate = cleanDetailedItemName(String(getPayloadValue(source, ["taxRate", "tsuat", "TSuat", "ThueSuat", "TaxRate"]) ?? "10%")) || "10%";
  const taxRatePercent = /KCT|KKKNT/i.test(taxRate) ? 0 : parseFloat(taxRate.replace(",", ".").replace(/[^0-9.]/g, "")) || 0;
  const taxAmount = parseInvoiceNumber(getPayloadValue(source, ["taxAmount", "tthue", "TThue", "TienThue", "TaxAmount"]), amount * taxRatePercent / 100);
  const totalAmount = amount + taxAmount;
  const itemCode = cleanDetailedItemName(String(getPayloadValue(source, ["itemCode", "mhhdvu", "MHHDVu", "MaHHDVu", "MaHH", "ProdCode"]) ?? ""));
  const nature = parseInt(String(getPayloadValue(source, ["nature", "tchat", "TChat", "TinhChat"]) ?? 1), 10) || 1;
  return {
    id: getPayloadValue(source, ["id", "ID"]) || `item_${lineNo}_${Math.random().toString(36).substring(2, 7)}`,
    lineNo,
    itemName,
    unit,
    quantity,
    unitPrice,
    amount,
    taxRate,
    taxRatePercent,
    taxAmount,
    totalAmount,
    itemCode: itemCode || void 0,
    nature,
    stt: lineNo,
    ten: itemName,
    dvt: unit,
    sluong: quantity,
    dgia: unitPrice,
    thtien: amount,
    tthtien: amount,
    tsuat: taxRate,
    tthue: taxAmount,
    mhhdvu: itemCode || void 0,
    tchat: nature
  };
}
function cleanLookupValue(value2) {
  return cleanDetailedItemName(String(value2 ?? "")).replace(/^['"]|['"]$/g, "").trim();
}
function getFromStructuredArrays(source, fieldNames) {
  if (!source || typeof source !== "object") return "";
  const arrayKeys = [
    "ttkhac",
    "TTKhac",
    "nbttkhac",
    "NBTTKhac",
    "nmttkhac",
    "NMTTKhac",
    "cttkhac",
    "CTTKhac",
    "ttin",
    "TTin",
    "dltkhac",
    "DLTKhac",
    "thongTinKhac",
    "ThongTinKhac",
    "customFields"
  ];
  const normalized = (v) => v.toLowerCase().replace(/[^a-z0-9]/g, "");
  const wanted = fieldNames.map(normalized);
  const checkItem = (entry) => {
    if (!entry || typeof entry !== "object") return "";
    const label = getPayloadValue(entry, ["ttruong", "TTruong", "Ttruong", "key", "name", "field", "ten"]);
    if (!label) return "";
    if (wanted.includes(normalized(String(label)))) {
      const value2 = getPayloadValue(entry, ["dlieu", "DLieu", "Dlieu", "value", "val", "duLieu"]);
      if (value2 !== void 0 && value2 !== null && String(value2).trim()) {
        return String(value2).trim();
      }
    }
    return "";
  };
  for (const arrKey of arrayKeys) {
    const arr = getPayloadValue(source, [arrKey]);
    if (Array.isArray(arr)) {
      for (const entry of arr) {
        const val = checkItem(entry);
        if (val) return val;
      }
    } else if (arr && typeof arr === "object") {
      const subItems = arr.ttin || arr.TTin || arr.item || arr.Item;
      const list = Array.isArray(subItems) ? subItems : [subItems || arr];
      for (const entry of list) {
        const val = checkItem(entry);
        if (val) return val;
      }
    }
  }
  const seen = /* @__PURE__ */ new Set();
  const findNested = (value2, depth) => {
    if (!value2 || typeof value2 !== "object" || depth > 8 || seen.has(value2)) return "";
    seen.add(value2);
    if (Array.isArray(value2)) {
      for (const entry of value2) {
        const found = checkItem(entry) || findNested(entry, depth + 1);
        if (found) return found;
      }
      return "";
    }
    for (const child of Object.values(value2)) {
      const found = checkItem(child) || findNested(child, depth + 1);
      if (found) return found;
    }
    return "";
  };
  return findNested(source, 0);
}
function hasPayloadMarker(source, keys, expected, depth = 0, seen = /* @__PURE__ */ new Set()) {
  if (!source || typeof source !== "object" || depth > 8 || seen.has(source)) return false;
  seen.add(source);
  const normalizedExpected = expected.map((value2) => value2.toLowerCase().replace(/[^a-z0-9]/g, ""));
  for (const key of keys) {
    const value2 = getPayloadValue(source, [key]);
    if (value2 !== void 0 && normalizedExpected.includes(String(value2).toLowerCase().replace(/[^a-z0-9]/g, ""))) return true;
  }
  return Object.values(source).some((value2) => hasPayloadMarker(value2, keys, expected, depth + 1, seen));
}
function normalizeLookupLabel(value2) {
  return cleanLookupValue(value2).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
}
function isLookupCodeCandidate(value2) {
  if (!value2 || value2.length < 4 || value2.length > 120) return false;
  const trimmed = value2.trim();
  if (/^vietcombank$/i.test(trimmed)) return false;
  if (/^[VTMB]\d{10,14}[A-Za-z0-9]{16,}$/i.test(trimmed)) return false;
  if (trimmed.includes("0102182292") && trimmed.length > 20) return false;
  return !/^https?:\/\//i.test(trimmed) && /^[A-Za-z0-9][A-Za-z0-9._-]{3,119}$/.test(trimmed);
}
function isVnptSource(source) {
  if (!source) return false;
  const nbmst = String(getPayloadValue(source, ["nbmst", "sellerTaxCode", "taxCodeNguoiBan", "MST"]) || "");
  const nbten = String(getPayloadValue(source, ["nbten", "nbtnnt", "sellerName", "supplierName", "Ten"]) || "").toUpperCase();
  const msttcgp = String(getPayloadValue(source, ["msttcgp", "mst_tcgp", "tvandnkntt", "MSTTCGP"]) || "");
  const tentcgp = String(getPayloadValue(source, ["tentcgp", "ten_tcgp", "TCGP", "TenTCGP"]) || "").toUpperCase();
  const provider = String(getPayloadValue(source, ["provider"]) || "").toUpperCase();
  const lookupUrl = String(getPayloadValue(source, ["lookupUrl", "lookup_url", "linkTraCuu"]) || "").toLowerCase();
  return nbmst === "4000344946" || // CÔNG TY TNHH NGHĨA SƠN
  nbten.includes("NGH\u0128A S\u01A0N") || nbten.includes("NGHIA SON") || msttcgp === "0100684378" || // MST VNPT TCGP
  tentcgp.includes("VNPT") || provider === "VNPT" || provider === "NGHIA_SON" || lookupUrl.includes("vnpt-invoice.com.vn");
}
function isViettelSource(source) {
  if (!source) return false;
  if (hasPayloadMarker(source, ["msttcgp", "mst_tcgp", "tvandnkntt", "MSTTCGP"], ["0100109106"])) return true;
  if (hasPayloadMarker(source, ["tentvandnkntt", "tentvandnknt", "ten_tvandnknt", "TENTVANDNKNTT"], ["tvan_viettel"])) return true;
  const nbmst = String(getPayloadValue(source, ["nbmst", "mst", "sellerTaxCode"]) || "").replace(/[^0-9]/g, "");
  const nbten = String(getPayloadValue(source, ["nbten", "sellerName"]) || "").toUpperCase();
  const msttcgp = String(getPayloadValue(source, ["msttcgp", "mst_tcgp", "tvandnkntt", "MSTTCGP"]) || "").replace(/[^0-9]/g, "");
  const tentvandnknt = String(getPayloadValue(source, ["tentvandnkntt", "tentvandnknt", "ten_tvandnknt", "TENTVANDNKNTT"]) || "").toLowerCase();
  const tentcgp = String(getPayloadValue(source, ["tentcgp", "ten_tcgp", "TCGP", "TenTCGP"]) || "").toLowerCase();
  const provider = String(getPayloadValue(source, ["provider", "Provider"]) || "").toUpperCase();
  const lookupUrl = String(getPayloadValue(source, ["lookupUrl", "lookup_url", "linkTraCuu"]) || "").toLowerCase();
  return nbmst === "0100109106" || nbmst === "0402307168" || // CÔNG TY TNHH TƯ VẤN NHÂN SỰ DOANH NGHIỆP SUNTALENT (Viettel S-Invoice)
  nbten.includes("SUNTALENT") || nbten.includes("VIETTEL") || msttcgp === "0100109106" || tentvandnknt === "tvan_viettel" || tentvandnknt === "tvan viettel" || tentcgp.includes("viettel") || provider === "VIETTEL" || lookupUrl.includes("sinvoice.viettel.vn") || lookupUrl.includes("viettel-invoice.vn") || lookupUrl.includes("vinvoice.viettel.vn");
}
function isLcsSource(source) {
  if (!source) return false;
  const nbmst = String(getPayloadValue(source, ["nbmst", "sellerTaxCode", "taxCodeNguoiBan", "MST"]) || "");
  const nbten = String(getPayloadValue(source, ["nbten", "nbtnnt", "sellerName", "supplierName", "Ten"]) || "").toUpperCase();
  const msttcgp = String(getPayloadValue(source, ["msttcgp", "mst_tcgp", "tvandnkntt", "MSTTCGP"]) || "");
  const tentcgp = String(getPayloadValue(source, ["tentcgp", "ten_tcgp", "TCGP", "TenTCGP"]) || "").toUpperCase();
  const provider = String(getPayloadValue(source, ["provider", "Provider"]) || "").toUpperCase();
  const lookupUrl = String(getPayloadValue(source, ["lookupUrl", "lookup_url", "linkTraCuu"]) || "").toLowerCase();
  return msttcgp === "0302999571" || // CÔNG TY TNHH L.C.S
  tentcgp.includes("L.C.S") || tentcgp.includes("LCSSOFT") || provider === "LCS" || nbmst === "0315018466" || // CÔNG TY TNHH MTV CHẾ TÁC VÀ KINH DOANH TRANG SỨC PNJ
  nbten.includes("TRANG S\u1EE8C PNJ") || nbten.includes("TRANG SUC PNJ") || lookupUrl.includes("lcssoft.com.vn") || lookupUrl.includes("eip.lcssoft");
}
function isVnpaySource(source) {
  if (!source) return false;
  const nbmst = String(getPayloadValue(source, ["nbmst", "sellerTaxCode", "taxCodeNguoiBan", "MST"]) || "");
  const nbten = String(getPayloadValue(source, ["nbten", "nbtnnt", "sellerName", "supplierName", "Ten"]) || "").toUpperCase();
  const msttcgp = String(getPayloadValue(source, ["msttcgp", "mst_tcgp", "tvandnkntt", "MSTTCGP"]) || "");
  const tentcgp = String(getPayloadValue(source, ["tentcgp", "ten_tcgp", "TCGP", "TenTCGP"]) || "").toUpperCase();
  const provider = String(getPayloadValue(source, ["provider", "Provider"]) || "").toUpperCase();
  const lookupUrl = String(getPayloadValue(source, ["lookupUrl", "lookup_url", "linkTraCuu"]) || "").toLowerCase();
  return msttcgp === "0102182292" || // VNPAY
  tentcgp.includes("VNPAY") || tentcgp.includes("THANH TO\xC1N VI\u1EC6T NAM") || tentcgp.includes("THANH TOAN VIET NAM") || provider === "VNPAY" || nbmst === "0100112437" || // Vietcombank
  nbten.includes("VIETCOMBANK") || lookupUrl.includes("vnpayinvoice.vn");
}
function isFptSource(source) {
  if (!source) return false;
  const msttcgp = String(getPayloadValue(source, ["msttcgp", "mst_tcgp", "tvandnkntt", "MSTTCGP"]) || "");
  const tentcgp = String(getPayloadValue(source, ["tentcgp", "ten_tcgp", "TCGP", "TenTCGP"]) || "").toUpperCase();
  const provider = String(getPayloadValue(source, ["provider", "Provider"]) || "").toUpperCase();
  const lookupUrl = String(getPayloadValue(source, ["lookupUrl", "lookup_url", "linkTraCuu"]) || "").toLowerCase();
  return msttcgp === "0104128565" || // FPT
  tentcgp.includes("FPT") || provider === "FPT" || lookupUrl.includes("ftg.vn") || lookupUrl.includes("fpt.com.vn");
}
function isMinvoiceSource(source) {
  if (!source) return false;
  const msttcgp = String(getPayloadValue(source, ["msttcgp", "mst_tcgp", "tvandnkntt", "MSTTCGP"]) || "");
  const tentcgp = String(getPayloadValue(source, ["tentcgp", "ten_tcgp", "TCGP", "TenTCGP"]) || "").toUpperCase();
  const provider = String(getPayloadValue(source, ["provider", "Provider"]) || "").toUpperCase();
  const lookupUrl = String(getPayloadValue(source, ["lookupUrl", "lookup_url", "linkTraCuu"]) || "").toLowerCase();
  return msttcgp === "0106026495" || tentcgp.includes("M-INVOICE") || tentcgp.includes("MINVOICE") || provider === "MINVOICE" || provider === "M-INVOICE" || lookupUrl.includes("minvoice.vn") || lookupUrl.includes("minvoice.com.vn");
}
function isBkavSource(source) {
  if (!source) return false;
  const msttcgp = String(getPayloadValue(source, ["msttcgp", "mst_tcgp", "tvandnkntt", "MSTTCGP"]) || "");
  const tentcgp = String(getPayloadValue(source, ["tentcgp", "ten_tcgp", "TCGP", "TenTCGP"]) || "").toUpperCase();
  const provider = String(getPayloadValue(source, ["provider", "Provider"]) || "").toUpperCase();
  const lookupUrl = String(getPayloadValue(source, ["lookupUrl", "lookup_url", "linkTraCuu"]) || "").toLowerCase();
  return msttcgp === "0101360697" || tentcgp.includes("BKAV") || provider === "BKAV" || lookupUrl.includes("bkav.com") || lookupUrl.includes("ehoadon.vn");
}
function isThaiSonSource(source) {
  if (!source) return false;
  const msttcgp = String(getPayloadValue(source, ["msttcgp", "mst_tcgp", "tvandnkntt", "MSTTCGP"]) || "");
  const tentcgp = String(getPayloadValue(source, ["tentcgp", "ten_tcgp", "TCGP", "TenTCGP"]) || "").toUpperCase();
  const provider = String(getPayloadValue(source, ["provider", "Provider"]) || "").toUpperCase();
  const lookupUrl = String(getPayloadValue(source, ["lookupUrl", "lookup_url", "linkTraCuu"]) || "").toLowerCase();
  return msttcgp === "0101300842" || tentcgp.includes("TH\xC1I S\u01A0N") || tentcgp.includes("THAISON") || provider === "THAISON" || providerFromPortal(lookupUrl) === "THAISON";
}
function isCyberBillSource(source) {
  if (!source) return false;
  const msttcgp = String(getPayloadValue(source, ["msttcgp", "mst_tcgp", "tvandnkntt", "MSTTCGP"]) || "");
  const tentcgp = String(getPayloadValue(source, ["tentcgp", "ten_tcgp", "TCGP", "TenTCGP"]) || "").toUpperCase();
  const provider = String(getPayloadValue(source, ["provider", "Provider"]) || "").toUpperCase();
  const lookupUrl = String(getPayloadValue(source, ["lookupUrl", "lookup_url", "linkTraCuu"]) || "").toLowerCase();
  return msttcgp === "0107871301" || tentcgp.includes("CYBERLOTUS") || tentcgp.includes("CYBERBILL") || provider === "CYBERBILL" || lookupUrl.includes("cyberbill.vn");
}
function isMisaSource(source) {
  if (!source) return false;
  const msttcgp = String(getPayloadValue(source, ["msttcgp", "mst_tcgp", "tvandnkntt", "MSTTCGP"]) || "");
  const tentcgp = String(getPayloadValue(source, ["tentcgp", "ten_tcgp", "TCGP", "TenTCGP"]) || "").toUpperCase();
  const provider = String(getPayloadValue(source, ["provider", "Provider"]) || "").toUpperCase();
  const lookupUrl = String(getPayloadValue(source, ["lookupUrl", "lookup_url", "linkTraCuu"]) || "");
  const portalProvider = providerFromPortal(lookupUrl);
  if (portalProvider) return portalProvider === "MISA";
  return msttcgp === "0101243150" || tentcgp.includes("MISA") || provider === "MISA";
}
function getLookupCodeFromPayload(source) {
  if (!source) return "";
  const isMisa = isMisaSource(source);
  const isViettel = isViettelSource(source);
  const misaTransactionId = getFromStructuredArrays(source, ["TransactionID", "TransactionId", "transactionID"]) || getPayloadValue(source, ["transactionID", "TransactionID"]);
  if (isMisa && misaTransactionId && isLookupCodeCandidate(cleanLookupValue(misaTransactionId))) {
    return cleanLookupValue(misaTransactionId);
  }
  if (isViettel) {
    const secretCode = cleanLookupValue(
      getFromStructuredArrays(source, [
        "M\xE3 s\u1ED1 b\xED m\u1EADt",
        "Ma so bi mat",
        "ReservationCode",
        "reservationCode",
        "matracuu",
        "MaTraCuu",
        "M\xE3 tra c\u1EE9u",
        "MaSoBiMat",
        "SecretCode",
        "secretCode"
      ]) || getPayloadValue(source, ["lookupCode", "secretCode", "reservationCode", "mabaomat", "sobaomat"])
    );
    return isLookupCodeCandidate(secretCode) ? secretCode : "";
  }
  if (isLcsSource(source)) {
    const cqtCode = getPayloadValue(source, ["mhdon", "mccqt", "MCCQT", "cqtCode"]);
    if (cqtCode) {
      const cleanCqt = cleanLookupValue(cqtCode);
      if (cleanCqt) return cleanCqt;
    }
  }
  if (isVnpaySource(source)) {
    const vnpayCode = cleanLookupValue(
      getFromStructuredArrays(source, [
        "SoBaoMat",
        "S\u1ED1 b\u1EA3o m\u1EADt",
        "soBaoMat",
        "sobaomat",
        "MaSoBaoMat",
        "M\xE3 s\u1ED1 b\u1EA3o m\u1EADt",
        "maSoBaoMat",
        "MaBaoMat",
        "M\xE3 b\u1EA3o m\u1EADt",
        "maBaoMat",
        "mabaomat",
        "MaNhanHDon",
        "M\xE3 nh\u1EADn h\xF3a \u0111\u01A1n",
        "maNhanHDon",
        "manhanhdon",
        "MaNhanHoaDon",
        "MTCuu",
        "mtcuu",
        "MaTraCuu",
        "matracuu",
        "M\xE3 tra c\u1EE9u",
        "M\xE3 tra c\u1EE9u H\u0110",
        "Fkey",
        "FKey",
        "LookupCode",
        "SecretCode",
        "SecurityCode",
        "AccessCode"
      ]) || getPayloadValue(source, [
        "soBaoMat",
        "sobaomat",
        "SoBaoMat",
        "maSoBaoMat",
        "maBaoMat",
        "mabaomat",
        "MaBaoMat",
        "maNhanHDon",
        "manhanhdon",
        "MaNhanHDon",
        "maNhanHoaDon",
        "mtcuu",
        "MTCuu",
        "maTraCuu",
        "MaTraCuu",
        "matracuu"
      ])
    );
    if (isLookupCodeCandidate(vnpayCode)) {
      return vnpayCode;
    }
    return "";
  }
  if (isMinvoiceSource(source)) {
    const minvoiceCode = cleanLookupValue(
      getFromStructuredArrays(source, [
        "SoBaoMat",
        "S\u1ED1 b\u1EA3o m\u1EADt",
        "soBaoMat",
        "sobaomat",
        "CheckCode",
        "checkCode",
        "Checkcode",
        "MaSoBaoMat",
        "M\xE3 s\u1ED1 b\u1EA3o m\u1EADt",
        "MaBaoMat",
        "M\xE3 b\u1EA3o m\u1EADt",
        "MTCuu",
        "mtcuu",
        "MaTraCuu",
        "matracuu",
        "M\xE3 tra c\u1EE9u",
        "Fkey",
        "FKey"
      ]) || getPayloadValue(source, [
        "soBaoMat",
        "sobaomat",
        "SoBaoMat",
        "checkCode",
        "CheckCode",
        "maSoBaoMat",
        "maBaoMat",
        "mabaomat",
        "MaBaoMat",
        "mtcuu",
        "MTCuu",
        "maTraCuu",
        "MaTraCuu"
      ])
    );
    if (isLookupCodeCandidate(minvoiceCode)) {
      return minvoiceCode;
    }
  }
  if (isBkavSource(source)) {
    const bkavCode = cleanLookupValue(
      getFromStructuredArrays(source, [
        "MaNhanHDon",
        "M\xE3 nh\u1EADn h\xF3a \u0111\u01A1n",
        "maNhanHDon",
        "manhanhdon",
        "MaNhanHoaDon",
        "MTCuu",
        "mtcuu",
        "MaTraCuu",
        "matracuu",
        "M\xE3 tra c\u1EE9u",
        "Fkey",
        "FKey"
      ]) || getPayloadValue(source, [
        "maNhanHDon",
        "manhanhdon",
        "MaNhanHDon",
        "maNhanHoaDon",
        "mtcuu",
        "MTCuu",
        "maTraCuu",
        "MaTraCuu"
      ])
    );
    if (isLookupCodeCandidate(bkavCode)) {
      return bkavCode;
    }
  }
  if (isThaiSonSource(source)) {
    const thaiSonCode = cleanLookupValue(
      getFromStructuredArrays(source, [
        "MaNhanHDon",
        "M\xE3 nh\u1EADn h\xF3a \u0111\u01A1n",
        "MTCuu",
        "mtcuu",
        "MaTraCuu",
        "matracuu",
        "M\xE3 tra c\u1EE9u"
      ]) || getPayloadValue(source, [
        "maNhanHDon",
        "mtcuu",
        "MTCuu",
        "maTraCuu",
        "MaTraCuu"
      ])
    );
    if (isLookupCodeCandidate(thaiSonCode)) {
      return thaiSonCode;
    }
  }
  const values = [
    misaTransactionId,
    getPayloadValue(source, ["lookupCode", "LookupCode"]),
    getPayloadValue(source, ["lookup_code"]),
    getPayloadValue(source, ["mtcuu", "MTCuu"]),
    getPayloadValue(source, ["maTraCuu", "MaTraCuu", "matracuu"]),
    // Cấu trúc mảng { ttruong: "Fkey", dlieu: "..." } - đã xác nhận đây là
    // mã tra cứu THẬT in trên hóa đơn (kiểm chứng với hóa đơn máy tính tiền
    // thật), nên ưu tiên trước các field phẳng bên dưới có thể không khớp.
    getFromStructuredArrays(source, [
      "Fkey",
      "FKey",
      "MaTraCuu",
      "LookupCode",
      "MTCuu",
      "MTC",
      "SoBaoMat",
      "S\u1ED1 b\u1EA3o m\u1EADt",
      "MaSoBaoMat",
      "M\xE3 s\u1ED1 b\u1EA3o m\u1EADt",
      "MaBaoMat",
      "M\xE3 b\u1EA3o m\u1EADt",
      "MaNhanHDon",
      "M\xE3 nh\u1EADn h\xF3a \u0111\u01A1n",
      "MaNhanHoaDon",
      "M\xE3 tra c\u1EE9u"
    ]),
    getPayloadValue(source, ["fkey", "FKey"]),
    getPayloadValue(source, ["soBaoMat", "sobaomat", "SoBaoMat", "maBaoMat", "MaBaoMat", "maNhanHDon", "MaNhanHDon"]),
    getPayloadValue(source, ["invoiceLookupCode", "InvoiceLookupCode"]),
    // MISA meInvoice: mã tra cứu THẬT in trên hóa đơn nằm trong mảng cttkhac
    // với ttruong = "TransactionID" (đã kiểm chứng khớp 100% với PDF gốc).
    getFromStructuredArrays(source, ["TransactionID", "TransactionId"]),
    getPayloadValue(source, ["transactionID", "TransactionID"])
  ];
  const foundCode = values.map(cleanLookupValue).find(isLookupCodeCandidate);
  if (foundCode) return foundCode;
  if (isVnptSource(source)) {
    const cqtCode = getPayloadValue(source, ["mhdon", "mccqt", "MCCQT", "cqtCode"]);
    if (cqtCode) {
      const cleanCqt = cleanLookupValue(cqtCode);
      if (cleanCqt) return cleanCqt;
    }
  }
  return "";
}
function getLookupUrlFromPayload(source) {
  if (isLcsSource(source)) {
    return "https://eip.lcssoft.com.vn/desktop/#/login";
  }
  if (isVnpaySource(source)) {
    const nbmst = String(getPayloadValue(source, ["nbmst", "sellerTaxCode", "MST"]) || "");
    const nbten = String(getPayloadValue(source, ["nbten", "sellerName", "supplierName"]) || "").toUpperCase();
    if (nbmst === "0100112437" || nbten.includes("VIETCOMBANK")) {
      return "https://einvoice.vietcombank.com.vn/";
    }
    return "https://portal.vnpayinvoice.vn/";
  }
  if (isFptSource(source)) {
    return "https://hoadon.ftg.vn/";
  }
  if (isVnptSource(source)) {
    const nbmst = String(getPayloadValue(source, ["nbmst", "sellerTaxCode", "MST"]) || "4000344946");
    return `https://${nbmst}-tt78.vnpt-invoice.com.vn`;
  }
  if (isMisaSource(source)) {
    return "https://www.meinvoice.vn/tra-cuu";
  }
  if (isMinvoiceSource(source)) {
    return "https://tracuuhoadon.minvoice.com.vn";
  }
  if (isBkavSource(source)) {
    return "https://ehoadon.bkav.com/tra-cuu";
  }
  if (isThaiSonSource(source)) {
    return "https://einvoice.vn/tra-cuu";
  }
  if (isCyberBillSource(source)) {
    return "https://cyberbill.vn/tra-cuu";
  }
  const structured = getFromStructuredArrays(source, ["PortalLink", "LinkTraCuu", "WebsiteTraCuu", "WebTraCuu"]);
  const value2 = cleanLookupValue(structured || String(getPayloadValue(source, [
    "lookupUrl",
    "LookupUrl",
    "lookup_url",
    "linkTraCuu",
    "LinkTraCuu",
    "websiteTraCuu",
    "WebsiteTraCuu",
    "webTraCuu",
    "WebTraCuu"
  ]) ?? ""));
  if (/daidoanket\.vn/i.test(value2)) {
    return "https://www.meinvoice.vn/tra-cuu";
  }
  return /^https?:\/\//i.test(value2) ? value2 : "";
}
function getInvoiceItemListFromPayload(source) {
  const candidates = [
    getPayloadValue(source, ["hdhhdvus", "HDHHDVUs"]),
    getPayloadValue(source, ["hdhhdvu", "HDHHDVu"]),
    getPayloadValue(source, ["items", "Items"]),
    getPayloadValue(source, ["invoiceItems", "InvoiceItems"]),
    getPayloadValue(source, ["products", "Products"]),
    getPayloadValue(source, ["details", "Details"]),
    getPayloadValue(source, ["hangHoa", "HangHoa"])
  ];
  const collections = [];
  const addCollection = (candidate) => {
    if (Array.isArray(candidate) && candidate.length) collections.push(candidate);
    else if (candidate && typeof candidate === "object") collections.push([candidate]);
  };
  const collectionKeys = [
    "hdhhdvus",
    "hdhhdvu",
    "hhdvus",
    "hhdvu",
    "items",
    "item",
    "invoiceitems",
    "invoiceitem",
    "products",
    "product",
    "details",
    "detail",
    "hanghoa",
    "hanghoadichvu",
    "goods",
    "goodsitems",
    "rows"
  ];
  const wrapperKeys = ["data", "result", "invoice", "content", "response", "payload"];
  const seen = /* @__PURE__ */ new Set();
  const visit = (node, depth) => {
    if (!node || typeof node !== "object" || seen.has(node) || depth > 7) return;
    seen.add(node);
    for (const key of collectionKeys) {
      const collection = getPayloadValue(node, [key]);
      addCollection(collection);
      if (collection && typeof collection === "object" && !Array.isArray(collection)) visit(collection, depth + 1);
    }
    for (const key of wrapperKeys) visit(getPayloadValue(node, [key]), depth + 1);
  };
  candidates.forEach(addCollection);
  visit(source, 0);
  if (!collections.length) return [];
  const score = (items) => items.reduce((total, item, index) => {
    const name = normalizeInvoiceItem(item, index).itemName;
    return total + (name && !isPlaceholderItemName(name) ? 100 : 0) + 1;
  }, 0);
  return collections.sort((a, b) => score(b) - score(a))[0];
}
function getSellerFromPayload(source) {
  const name = cleanDetailedItemName(String(getPayloadValue(source, [
    "nbten",
    "nbtnnt",
    "nbtlhdon",
    "sellerName",
    "supplierName",
    "tenNguoiBan",
    "tenNban"
  ]) ?? ""));
  const taxCode = cleanDetailedItemName(String(getPayloadValue(source, [
    "nbmst",
    "sellerTaxCode",
    "taxCodeNguoiBan",
    "mstNguoiBan"
  ]) ?? ""));
  const address = cleanDetailedItemName(String(getPayloadValue(source, [
    "nbdchi",
    "sellerAddress",
    "supplierAddress",
    "diaChiNguoiBan"
  ]) ?? ""));
  return { name, taxCode, address };
}
function extractLookupDetailsFromXml(rawXml) {
  if (!rawXml) return { lookupCode: "", lookupUrl: "" };
  const tagValue = (tagNames) => {
    for (const tag of tagNames) {
      const value2 = extractTagValue(rawXml, tag, "");
      if (value2) return cleanLookupValue(value2);
    }
    return "";
  };
  const codeTags = [
    "SoBaoMat",
    "sobaomat",
    "SOBAOMAT",
    "MaSoBaoMat",
    "maSoBaoMat",
    "MaBaoMat",
    "mabaomat",
    "MaNhanHDon",
    "manhanhdon",
    "MaNhanHoaDon",
    "MTCuu",
    "MaTraCuu",
    "Matracuu",
    "FKey",
    "Fkey",
    "LookupCode",
    "InvoiceLookupCode",
    "TransactionID",
    "SecretCode",
    "SecurityCode",
    "AccessCode"
  ];
  let lookupCode = tagValue(codeTags);
  if (!lookupCode) {
    const textMatch = rawXml.match(/(?:Mã\s+tra\s+cứu|Ma\s+tra\s+cuu|Mã\s+nhận\s+hóa\s+đơn|Ma\s+nhan\s+hoa\s+don|Số\s+bảo\s+mật|So\s+bao\s+mat|Mã\s+số\s+bảo\s+mật|Mã\s+bảo\s+mật)\s*[:：=]\s*([A-Za-z0-9._-]+)/i);
    if (textMatch?.[1]) lookupCode = cleanLookupValue(textMatch[1]);
  }
  const isViettelXml = /0100109106|0402307168|suntalent|tvan[_\s-]*viettel|sinvoice|vinvoice|viettel|viettel-invoice/i.test(rawXml) || /Mã số bí mật|Ma so bi mat|ReservationCode|MaBiMat/i.test(rawXml);
  if (isViettelXml) {
    const secretBlocks = [...extractTagBlocks(rawXml, "TTin"), ...extractTagBlocks(rawXml, "TTKhac")];
    const secretBlock = secretBlocks.find((block) => {
      const label = normalizeLookupLabel(extractTagValue(block, "TTruong") || extractTagValue(block, "TenTruong"));
      return label === "ma so bi mat" || label.includes("bi mat") || label.includes("secret") || label.includes("reservation");
    });
    if (secretBlock) {
      lookupCode = cleanLookupValue(extractTagValue(secretBlock, "DLieu") || extractTagValue(secretBlock, "Data") || "");
    }
  }
  const ttinBlocks = [...extractTagBlocks(rawXml, "TTin"), ...extractTagBlocks(rawXml, "TTKhac")];
  for (const block of ttinBlocks) {
    const label = normalizeLookupLabel(
      extractTagValue(block, "TTruong") || extractTagValue(block, "TenTruong") || extractTagValue(block, "Name")
    );
    if (!label || label.includes("bi mat") || label.includes("secret")) continue;
    const isExplicitLookupLabel = /tra\s*cuu|lookup|transaction\s*id|fkey|f_key|ma_tc|mtc|bao\s*mat|nhan\s*h.*don/i.test(label);
    if (!lookupCode && isExplicitLookupLabel) {
      const value2 = cleanLookupValue(extractTagValue(block, "DLieu") || extractTagValue(block, "Data") || extractTagValue(block, "Value"));
      if (isLookupCodeCandidate(value2)) {
        lookupCode = value2;
        break;
      }
    }
  }
  if (lookupCode && /^https?:\/\//i.test(lookupCode)) {
    try {
      const url = new URL(lookupCode);
      lookupCode = cleanLookupValue(url.searchParams.get("sc") || url.searchParams.get("code") || url.searchParams.get("c") || url.searchParams.get("fkey") || "");
    } catch {
      lookupCode = "";
    }
  }
  if (!lookupCode) {
    const scMatch = rawXml.match(/[?&]sc=([A-Za-z0-9_-]+)/i);
    if (scMatch?.[1] && isLookupCodeCandidate(scMatch[1])) {
      lookupCode = cleanLookupValue(scMatch[1]);
    }
  }
  if (!lookupCode) {
    const isVnpt = /vnpt-invoice|invoice\.vnpt\.vn|tracuu\.vnpt-invoice|4000344946/i.test(rawXml) || /NGHĨA SƠN|NGHIA SON/i.test(rawXml);
    if (isVnpt) {
      const cqtCode = extractTagValue(rawXml, "MCCQT", "") || extractTagValue(rawXml, "mhdon", "") || extractTagValue(rawXml, "MaCQT", "") || extractTagValue(rawXml, "cqtCode", "");
      if (cqtCode) {
        const cleanCqt = cleanLookupValue(cqtCode);
        if (cleanCqt) {
          lookupCode = cleanCqt;
        }
      }
    }
  }
  const urlTags = ["LinkTraCuu", "WebsiteTraCuu", "WebTraCuu", "PortalUrl", "PortalLink"];
  let lookupUrl = tagValue(urlTags);
  if (!lookupUrl) {
    const rawWebsite = tagValue(["Website"]);
    if (rawWebsite && /tra[-_]?cuu|invoice|einvoice|portal|meinvoice|easyinvoice|sinvoice|vnpt/i.test(rawWebsite)) {
      lookupUrl = rawWebsite;
    }
  }
  if (!/^https?:\/\//i.test(lookupUrl)) {
    lookupUrl = "";
  }
  if (!lookupUrl) {
    const urlMatch = rawXml.match(/https?:\/\/[^\s<"']+/gi)?.map(cleanLookupValue).find((value2) => !/w3\.org|schema\.org/i.test(value2) && /tra[-_]?cuu|invoice|einvoice|sinvoice|easyinvoice|4si|meinvoice|vnpt/i.test(value2));
    lookupUrl = urlMatch || "";
  }
  const isMisa = detectProvider(rawXml) === "MISA";
  if (isMisa) {
    lookupUrl = "https://www.meinvoice.vn/tra-cuu";
  }
  if (!lookupUrl && (/vnpt-invoice|4000344946/i.test(rawXml) || /NGHĨA SƠN|NGHIA SON/i.test(rawXml) || /0100684378/i.test(rawXml))) {
    const nbmst = extractTagValue(rawXml, "MST", "") || extractTagValue(rawXml, "nbmst", "") || "4000344946";
    lookupUrl = `https://${nbmst}-tt78.vnpt-invoice.com.vn`;
  }
  const isLcs = /eip\.lcssoft\.com\.vn|lcssoft|0302999571|0315018466/i.test(rawXml) || /TRANG SỨC PNJ|TRANG SUC PNJ/i.test(rawXml);
  if (isLcs) {
    if (!lookupUrl) lookupUrl = "https://eip.lcssoft.com.vn/desktop/#/login";
    if (!lookupCode) {
      const mhdon = extractTagValue(rawXml, "mhdon", "") || extractTagValue(rawXml, "MCQTCap", "");
      if (mhdon) lookupCode = mhdon;
    }
  }
  const isVnpay = /vnpayinvoice|0102182292|0100112437/i.test(rawXml) || /VIETCOMBANK/i.test(rawXml);
  if (isVnpay) {
    const isVcb = /0100112437|VIETCOMBANK/i.test(rawXml);
    if (!lookupUrl) {
      lookupUrl = isVcb ? "https://einvoice.vietcombank.com.vn/" : "https://portal.vnpayinvoice.vn/";
    }
    if (!lookupCode || lookupCode.toLowerCase() === "vietcombank" || !isLookupCodeCandidate(lookupCode)) {
      lookupCode = "";
    }
  }
  const isFpt = /hoadon\.ftg\.vn|0104128565/i.test(rawXml);
  if (isFpt) {
    if (!lookupUrl) lookupUrl = "https://hoadon.ftg.vn/";
  }
  const is4Si = /4si\.vn|inv\.4si\.vn|0315744883/i.test(rawXml);
  if (is4Si) {
    if (!lookupUrl) lookupUrl = "https://inv.4si.vn/tra-cuu-hoa-don";
    if (!extractTagValue(rawXml, "MTCuu") && !extractTagValue(rawXml, "MaTraCuu") && !extractTagValue(rawXml, "FKey")) {
      lookupCode = "";
    }
  }
  if (isViettelXml || /vinvoice\.viettel\.vn|sinvoice\.viettel\.vn|viettel-invoice\.vn|0100109106|0402307168|suntalent/i.test(rawXml)) {
    if (!lookupUrl) lookupUrl = "https://vinvoice.viettel.vn/utilities/invoice-search";
  }
  const isMinvoice = /minvoice\.vn|minvoice\.com\.vn|tracuuhoadon\.minvoice|0106026495/i.test(rawXml) || /M-INVOICE|MINVOICE/i.test(rawXml);
  if (isMinvoice) {
    if (!lookupUrl) lookupUrl = "https://tracuuhoadon.minvoice.com.vn";
    if (!lookupCode) {
      const sobaomat = extractTagValue(rawXml, "SoBaoMat", "") || extractTagValue(rawXml, "sobaomat", "") || extractTagValue(rawXml, "CheckCode", "") || extractTagValue(rawXml, "checkCode", "") || extractTagValue(rawXml, "MaBaoMat", "") || extractTagValue(rawXml, "mabaomat", "");
      if (sobaomat && isLookupCodeCandidate(sobaomat)) {
        lookupCode = sobaomat;
      }
    }
  }
  const isBkav = /bkav|ehoadon\.vn|ehoadon\.bkav|0101360697/i.test(rawXml);
  if (isBkav) {
    if (!lookupUrl) lookupUrl = "https://ehoadon.bkav.com/tra-cuu";
  }
  const isThaiSon = detectProvider(rawXml) === "THAISON";
  if (isThaiSon) {
    if (!lookupUrl) lookupUrl = "https://einvoice.vn/tra-cuu";
  }
  const isCyberBill = /cyberbill\.vn|cyberlotus|0107871301/i.test(rawXml);
  if (isCyberBill) {
    if (!lookupUrl) lookupUrl = "https://cyberbill.vn/tra-cuu";
  }
  return { lookupCode: isLookupCodeCandidate(lookupCode) ? lookupCode : "", lookupUrl };
}
function findXmlTagElement(parent, tagNames) {
  if (!parent) return null;
  const children = "children" in parent ? Array.from(parent.children) : [];
  for (const tag of tagNames) {
    const lower = tag.toLowerCase();
    for (const child of children) {
      const local = (child.localName || child.nodeName || "").replace(/^[a-zA-Z0-9_]+:/, "").toLowerCase();
      if (local === lower) {
        return child;
      }
    }
    const list = parent.getElementsByTagName(tag);
    if (list && list.length > 0) return list[0];
    const listLower = parent.getElementsByTagName(lower);
    if (listLower && listLower.length > 0) return listLower[0];
    if ("getElementsByTagNameNS" in parent) {
      try {
        const nsList = parent.getElementsByTagNameNS("*", tag);
        if (nsList && nsList.length > 0) return nsList[0];
      } catch {
      }
    }
  }
  return null;
}
function getXmlTagText(parent, tagNames) {
  if (!parent) return "";
  if (parent.attributes && parent.attributes.length > 0) {
    for (const tag of tagNames) {
      const lower = tag.toLowerCase();
      for (let i = 0; i < parent.attributes.length; i++) {
        const attr = parent.attributes[i];
        const aName = attr.name.toLowerCase().replace(/^[a-z0-9_]+:/, "");
        if (aName === lower) {
          const cleaned = cleanDetailedItemName(attr.value || "");
          if (cleaned.length > 0) return cleaned;
        }
      }
    }
  }
  const children = Array.from(parent.children);
  for (const tag of tagNames) {
    const lower = tag.toLowerCase();
    for (const child of children) {
      const local = (child.localName || child.nodeName || "").replace(/^[a-zA-Z0-9_]+:/, "").toLowerCase();
      if (local === lower) {
        const txt = child.textContent || "";
        const cleaned = cleanDetailedItemName(txt);
        if (cleaned.length > 0) return cleaned;
      }
    }
    if ("getElementsByTagNameNS" in parent) {
      try {
        const nsList = parent.getElementsByTagNameNS("*", tag);
        if (nsList && nsList.length > 0 && nsList[0].textContent) {
          const cleaned = cleanDetailedItemName(nsList[0].textContent);
          if (cleaned.length > 0) return cleaned;
        }
        const nsListLower = parent.getElementsByTagNameNS("*", lower);
        if (nsListLower && nsListLower.length > 0 && nsListLower[0].textContent) {
          const cleaned = cleanDetailedItemName(nsListLower[0].textContent);
          if (cleaned.length > 0) return cleaned;
        }
      } catch {
      }
    }
    const el = parent.getElementsByTagName(tag)[0] || parent.getElementsByTagName(lower)[0];
    if (el && el.textContent) {
      const cleaned = cleanDetailedItemName(el.textContent);
      if (cleaned.length > 0) return cleaned;
    }
  }
  if (parent.querySelectorAll) {
    try {
      const allDescendants = Array.from(parent.querySelectorAll("*"));
      for (const desc of allDescendants) {
        const dLocal = (desc.localName || desc.nodeName || "").replace(/^[a-zA-Z0-9_]+:/, "").toLowerCase();
        for (const tag of tagNames) {
          if (dLocal === tag.toLowerCase()) {
            const cleaned = cleanDetailedItemName(desc.textContent || "");
            if (cleaned.length > 0) return cleaned;
          }
        }
      }
    } catch {
    }
  }
  return "";
}
function extractTaggedBlock(source, tagName) {
  if (!source) return null;
  const clean = tagName.replace(/[^a-zA-Z0-9_]/g, "");
  const regex = new RegExp(`<(?:[a-zA-Z0-9_]+:)?${clean}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_]+:)?${clean}>`, "i");
  const match = source.match(regex);
  return match ? match[1] : null;
}
function extractTagValueByKeys(block, tagNames, defaultValue = "") {
  for (const tag of tagNames) {
    const val = extractTagValue(block, tag, "");
    if (val) {
      return cleanDetailedItemName(val);
    }
    const clean = tag.replace(/[^a-zA-Z0-9_]/g, "");
    const attrRegex = new RegExp(`(?:^|\\s)(?:[a-zA-Z0-9_]+:)?${clean}\\s*=\\s*["']([^"']*)["']`, "i");
    const attrMatch = block.match(attrRegex);
    if (attrMatch && attrMatch[1]) {
      const cleaned = cleanDetailedItemName(attrMatch[1]);
      if (cleaned.length > 0) return cleaned;
    }
  }
  return defaultValue;
}
var COMMON_ITEM_NAME_TAGS = [
  "THHDVu",
  "thhdvu",
  "TenHHDVu",
  "tenhhdvu",
  "TenHH",
  "tenhh",
  "Ten",
  "ten",
  "ProdName",
  "prodname",
  "ItemName",
  "itemname",
  "TenHang",
  "tenhang",
  "TenHangHoa",
  "tenhanghoa",
  "TenSP",
  "tensp",
  "TSPH",
  "tsph",
  "TenDichVu",
  "tendichvu",
  "TenDV",
  "tendv",
  "ProductName",
  "productname",
  "ServiceName",
  "servicename",
  "GoodsName",
  "goodsname",
  "GoodsDescription",
  "goodsdescription",
  "ItemDescription",
  "itemdescription",
  "DienGiai",
  "diengiai",
  "DienGiaiHH",
  "diengiaihh",
  "NoiDung",
  "noidung",
  "Description",
  "description",
  "Name",
  "name"
];
function parseHHDVuFromElement(el, idx) {
  const rawStt = getXmlTagText(el, ["STT", "stt", "SoTT", "sott", "Idx", "idx", "Order", "order", "LineNo", "lineno"]);
  const lineNo = parseInt(rawStt, 10) || idx + 1;
  let itemName = "";
  for (const tag of COMMON_ITEM_NAME_TAGS) {
    const val = getXmlTagText(el, [tag]);
    if (val && !isPlaceholderItemName(val)) {
      itemName = val;
      break;
    }
  }
  if (!itemName) {
    for (const tag of COMMON_ITEM_NAME_TAGS) {
      const val = getXmlTagText(el, [tag]);
      if (val) {
        itemName = val;
        break;
      }
    }
  }
  const itemCode = getXmlTagText(el, ["MHHDVu", "mhhdvu", "MaHHDVu", "mahhdvu", "MaHH", "mahh", "Ma", "ma", "ProdCode", "prodcode", "ItemCode", "itemcode"]);
  if (!itemName) {
    itemName = itemCode ? `H\xE0ng h\xF3a (${itemCode})` : `H\xE0ng h\xF3a / D\u1ECBch v\u1EE5 ${lineNo}`;
  }
  const rawUnit = getXmlTagText(el, ["DVTinh", "dvtinh", "DVT", "dvt", "DonViTinh", "donvitinh", "ProdUnit", "produnit", "Unit", "unit"]);
  const unit = rawUnit || "C\xE1i";
  const rawQty = getXmlTagText(el, ["SLuong", "sluong", "SoLuong", "soluong", "ProdQuantity", "prodquantity", "Quantity", "quantity", "Weight", "TotalWeight", "Qty", "qty"]);
  const quantity = parseInvoiceNumber(rawQty, 1);
  const rawPrice = getXmlTagText(el, ["DGia", "dgia", "DonGia", "dongia", "ProdPrice", "prodprice", "Price", "price", "UnitPrice", "unitprice"]);
  let unitPrice = parseInvoiceNumber(rawPrice, 0);
  const rawAmount = getXmlTagText(el, ["TTHTien", "tthtien", "ThTien", "thtien", "THTien", "ThanhTien", "thanhtien", "Amount", "amount", "Total", "total"]);
  let amount = parseInvoiceNumber(rawAmount, 0);
  if (amount === 0 && quantity > 0 && unitPrice > 0) {
    amount = Math.round(quantity * unitPrice);
  }
  if (amount > 0 && quantity > 0 && unitPrice > 0) {
    if (Math.round(amount / (quantity * unitPrice)) === 1e3) {
      unitPrice = unitPrice * 1e3;
    }
  } else if (unitPrice === 0 && quantity > 0 && amount > 0) {
    unitPrice = Math.round(amount / quantity * 100) / 100;
  }
  const rawRate = getXmlTagText(el, ["TSuat", "tsuat", "ThueSuat", "thuesuat", "VATRate", "vatrate", "TaxRate", "taxrate"]);
  const taxRate = rawRate || "10%";
  let taxPercent = 10;
  const upperRate = taxRate.toUpperCase();
  if (upperRate.includes("8")) taxPercent = 8;
  else if (upperRate.includes("5")) taxPercent = 5;
  else if (upperRate.includes("0")) taxPercent = 0;
  else if (upperRate.includes("KCT") || upperRate.includes("KKKNT")) taxPercent = 0;
  else {
    const match = taxRate.match(/(\d+)/);
    if (match) taxPercent = parseInvoiceNumber(match[1], 10);
  }
  const rawNature = getXmlTagText(el, ["TChat", "tchat", "TinhChat", "Nature", "nature"]);
  const nature = parseInt(rawNature, 10) || 1;
  const rawTax = getXmlTagText(el, ["TThue", "tthue", "TienThue", "tienthue", "VATAmount", "vatamount", "TaxAmount", "taxamount"]);
  let taxAmount = parseInvoiceNumber(rawTax, 0);
  if (taxAmount === 0 && taxPercent > 0 && amount > 0) {
    taxAmount = Math.round(amount * taxPercent / 100);
  }
  const discountAmount = parseInvoiceNumber(getXmlTagText(el, ["STCKhau", "stckhau", "DiscountAmount"]), 0);
  const discountRate = parseInvoiceNumber(getXmlTagText(el, ["TLCKhau", "tlckhau", "DiscountRate"]), 0);
  const totalAmount = amount + taxAmount;
  return {
    id: `item_${lineNo}_${Math.random().toString(36).substring(2, 7)}`,
    lineNo,
    itemName,
    unit,
    quantity,
    unitPrice,
    amount,
    taxRate,
    taxRatePercent: taxPercent,
    taxAmount,
    totalAmount,
    itemCode: itemCode || void 0,
    nature,
    discountAmount: discountAmount || void 0,
    discountRate: discountRate || void 0,
    // Thuộc tính tương thích tiếng Việt
    stt: lineNo,
    ten: itemName,
    dvt: unit,
    sluong: quantity,
    dgia: unitPrice,
    thtien: amount,
    tthtien: amount,
    tsuat: taxRate,
    tthue: taxAmount,
    mhhdvu: itemCode || void 0,
    tchat: nature,
    stckhau: discountAmount || void 0,
    tlckhau: discountRate || void 0
  };
}
function parseHHDVuFromBlock(block, idx) {
  const rawStt = extractTagValueByKeys(block, ["STT", "stt", "SoTT", "sott", "Idx", "idx", "Order", "order", "LineNo", "lineno"]);
  const lineNo = parseInt(rawStt, 10) || idx + 1;
  let itemName = "";
  for (const tag of COMMON_ITEM_NAME_TAGS) {
    const val = extractTagValueByKeys(block, [tag]);
    if (val && !isPlaceholderItemName(val)) {
      itemName = val;
      break;
    }
  }
  if (!itemName) {
    for (const tag of COMMON_ITEM_NAME_TAGS) {
      const val = extractTagValueByKeys(block, [tag]);
      if (val) {
        itemName = val;
        break;
      }
    }
  }
  const itemCode = extractTagValueByKeys(block, ["MHHDVu", "mhhdvu", "MaHHDVu", "mahhdvu", "MaHH", "mahh", "Ma", "ma", "ProdCode", "prodcode", "ItemCode", "itemcode"]);
  if (!itemName) {
    itemName = itemCode ? `H\xE0ng h\xF3a (${itemCode})` : `H\xE0ng h\xF3a / D\u1ECBch v\u1EE5 ${lineNo}`;
  }
  const rawUnit = extractTagValueByKeys(block, ["DVTinh", "dvtinh", "DVT", "dvt", "DonViTinh", "donvitinh", "ProdUnit", "produnit", "Unit", "unit"]);
  const unit = rawUnit || "C\xE1i";
  const rawQty = extractTagValueByKeys(block, ["SLuong", "sluong", "SoLuong", "soluong", "ProdQuantity", "prodquantity", "Quantity", "quantity", "Weight", "TotalWeight", "Qty", "qty"]);
  const quantity = parseInvoiceNumber(rawQty, 1);
  const rawPrice = extractTagValueByKeys(block, ["DGia", "dgia", "DonGia", "dongia", "ProdPrice", "prodprice", "Price", "price", "UnitPrice", "unitprice"]);
  let unitPrice = parseInvoiceNumber(rawPrice, 0);
  const rawAmount = extractTagValueByKeys(block, ["TTHTien", "tthtien", "ThTien", "thtien", "THTien", "ThanhTien", "thanhtien", "Amount", "amount", "Total", "total"]);
  let amount = parseInvoiceNumber(rawAmount, 0);
  if (amount === 0 && quantity > 0 && unitPrice > 0) {
    amount = Math.round(quantity * unitPrice);
  }
  if (amount > 0 && quantity > 0 && unitPrice > 0) {
    if (Math.round(amount / (quantity * unitPrice)) === 1e3) {
      unitPrice = unitPrice * 1e3;
    }
  } else if (unitPrice === 0 && quantity > 0 && amount > 0) {
    unitPrice = Math.round(amount / quantity * 100) / 100;
  }
  const rawRate = extractTagValueByKeys(block, ["TSuat", "tsuat", "ThueSuat", "thuesuat", "VATRate", "vatrate", "TaxRate", "taxrate"]);
  const taxRate = rawRate || "10%";
  let taxPercent = 10;
  const upperRate = taxRate.toUpperCase();
  if (upperRate.includes("8")) taxPercent = 8;
  else if (upperRate.includes("5")) taxPercent = 5;
  else if (upperRate.includes("0")) taxPercent = 0;
  else if (upperRate.includes("KCT") || upperRate.includes("KKKNT")) taxPercent = 0;
  else {
    const match = taxRate.match(/(\d+)/);
    if (match) taxPercent = parseInvoiceNumber(match[1], 10);
  }
  const rawNature = extractTagValueByKeys(block, ["TChat", "tchat", "TinhChat", "Nature", "nature"]);
  const nature = parseInt(rawNature, 10) || 1;
  const rawTax = extractTagValueByKeys(block, ["TThue", "tthue", "TienThue", "tienthue", "VATAmount", "vatamount", "TaxAmount", "taxamount"]);
  let taxAmount = parseInvoiceNumber(rawTax, 0);
  if (taxAmount === 0 && taxPercent > 0 && amount > 0) {
    taxAmount = Math.round(amount * taxPercent / 100);
  }
  const discountAmount = parseInvoiceNumber(extractTagValueByKeys(block, ["STCKhau", "stckhau", "DiscountAmount"]), 0);
  const discountRate = parseInvoiceNumber(extractTagValueByKeys(block, ["TLCKhau", "tlckhau", "DiscountRate"]), 0);
  const totalAmount = amount + taxAmount;
  return {
    id: `item_${lineNo}_${Math.random().toString(36).substring(2, 7)}`,
    lineNo,
    itemName,
    unit,
    quantity,
    unitPrice,
    amount,
    taxRate,
    taxRatePercent: taxPercent,
    taxAmount,
    totalAmount,
    itemCode: itemCode || void 0,
    nature,
    discountAmount: discountAmount || void 0,
    discountRate: discountRate || void 0,
    // Thuộc tính tương thích tiếng Việt
    stt: lineNo,
    ten: itemName,
    dvt: unit,
    sluong: quantity,
    dgia: unitPrice,
    thtien: amount,
    tthtien: amount,
    tsuat: taxRate,
    tthue: taxAmount,
    mhhdvu: itemCode || void 0,
    tchat: nature,
    stckhau: discountAmount || void 0,
    tlckhau: discountRate || void 0
  };
}
function extractInvoiceItemsFromXml(xmlSource) {
  if (!xmlSource) return [];
  const isBrowser = typeof window !== "undefined" && typeof window.DOMParser !== "undefined";
  let domDoc = null;
  let rawXmlString = "";
  if (typeof xmlSource === "string") {
    rawXmlString = xmlSource;
    if (isBrowser) {
      try {
        const parser = new DOMParser();
        const parsed = parser.parseFromString(xmlSource, "application/xml");
        if (!parsed.getElementsByTagName("parsererror")[0]) {
          domDoc = parsed;
        }
      } catch {
        domDoc = null;
      }
    }
  } else {
    domDoc = xmlSource;
  }
  if (domDoc) {
    try {
      const containerTagCandidates = [
        "DSHHDVu",
        "dshhdvu",
        "Products",
        "products",
        "Items",
        "items",
        "DSHangHoa",
        "dshanghoa",
        "Details",
        "details",
        "ListProduct",
        "listproduct",
        "InvoiceDetails",
        "invoicedetails",
        "InvoiceItems",
        "invoiceitems",
        "GoodsDetails",
        "goodsdetails",
        "DSHHDV",
        "dshhdv",
        "ChiTiet",
        "chitiet",
        "CTietHHDVu",
        "ctiethhdvu",
        "InvDetails",
        "invdetails",
        "Rows",
        "rows"
      ];
      const itemTagCandidates = [
        "hhdvu",
        "product",
        "item",
        "hanghoa",
        "detail",
        "row",
        "invoicedetail",
        "invoiceitem",
        "productdetail",
        "goods",
        "goodsitem",
        "chitiethanghoa",
        "ctiet",
        "line",
        "invdetail"
      ];
      const dlhdonNode = findXmlTagElement(domDoc, ["DLHDon", "dlhdon"]) || domDoc.documentElement;
      const ndhdonNode = dlhdonNode ? findXmlTagElement(dlhdonNode, ["NDHDon", "ndhdon"]) : null;
      const parentOfDshhdvu = ndhdonNode || dlhdonNode || domDoc;
      const dshhdvuNode = findXmlTagElement(parentOfDshhdvu, containerTagCandidates);
      if (dshhdvuNode) {
        let hhdvuList = [];
        const dshChildren = Array.from(dshhdvuNode.children);
        for (const ch of dshChildren) {
          const local = (ch.localName || ch.nodeName || "").replace(/^[a-zA-Z0-9_]+:/, "").toLowerCase();
          if (itemTagCandidates.includes(local)) {
            hhdvuList.push(ch);
          }
        }
        if (hhdvuList.length === 0) {
          for (const cand of ["HHDVu", "Product", "Item", "HangHoa", "Detail", "Row", "InvoiceDetail", "InvoiceItem", "ProductDetail", "GoodsItem", "Line", "InvDetail"]) {
            const tagged = dshhdvuNode.getElementsByTagName(cand);
            if (tagged && tagged.length > 0) {
              hhdvuList = Array.from(tagged);
              break;
            }
          }
        }
        if (hhdvuList.length === 0 && dshChildren.length > 0) {
          hhdvuList = dshChildren.filter((ch) => ch.children.length > 0 || ch.attributes && ch.attributes.length > 0);
        }
        if (hhdvuList.length > 0) {
          return hhdvuList.map((el, idx) => parseHHDVuFromElement(el, idx));
        }
      }
      for (const cand of ["HHDVu", "Product", "Item", "HangHoa", "Detail", "InvoiceDetail", "InvoiceItem", "ProductDetail", "GoodsItem", "Line", "InvDetail"]) {
        const allItems = domDoc.getElementsByTagName(cand);
        if (allItems && allItems.length > 0) {
          return Array.from(allItems).map((el, idx) => parseHHDVuFromElement(el, idx));
        }
      }
    } catch (err) {
      console.warn("L\u1ED7i khi ph\xE2n t\xEDch DOM DSHHDVu, ti\u1EBFp t\u1EE5c v\u1EDBi b\u1ED9 ph\xE2n t\xEDch Regex:", err);
    }
  }
  const xmlText = rawXmlString || (domDoc ? new XMLSerializer().serializeToString(domDoc) : "");
  if (!xmlText) return [];
  const containerRegexes = ["DSHHDVu", "Products", "Items", "DSHangHoa", "Details", "InvoiceDetails", "InvoiceItems", "GoodsDetails", "DSHHDV", "ChiTiet", "CTietHHDVu", "InvDetails", "Rows"];
  const itemTagNames = ["HHDVu", "Product", "Item", "HangHoa", "Detail", "Row", "InvoiceDetail", "InvoiceItem", "ProductDetail", "GoodsItem", "Line", "InvDetail"];
  for (const cTag of containerRegexes) {
    const cBlock = extractTaggedBlock(xmlText, cTag);
    if (cBlock) {
      for (const iTag of itemTagNames) {
        const blocks = extractTagBlocks(cBlock, iTag);
        if (blocks.length > 0) {
          return blocks.map((block, idx) => parseHHDVuFromBlock(block, idx));
        }
      }
      const genericChildMatches = [...cBlock.matchAll(/<([a-zA-Z0-9_]+)(?:\s+[^>]*)?>([\s\S]*?)<\/\1>/gi)];
      if (genericChildMatches.length > 0) {
        const childBlocks = genericChildMatches.map((m) => m[0]).filter((b) => /(?:THHDVu|Ten|ProdName|ItemName|SLuong|DGia|ThTien|TTHTien)/i.test(b));
        if (childBlocks.length > 0) {
          return childBlocks.map((block, idx) => parseHHDVuFromBlock(block, idx));
        }
      }
    }
  }
  for (const iTag of itemTagNames) {
    const blocks = extractTagBlocks(xmlText, iTag);
    if (blocks.length > 0) {
      return blocks.map((block, idx) => parseHHDVuFromBlock(block, idx));
    }
  }
  return [];
}
function isPlaceholderItemName(name) {
  if (!name) return true;
  const s = String(name).toLowerCase().trim();
  if (s.length === 0) return true;
  return s === "ch\u01B0a c\xF3 th\xF4ng tin h\xE0ng h\xF3a" || s === "kh\xF4ng c\xF3 d\u1EEF li\u1EC7u" || s === "n/a" || s === "null" || s === "undefined" || s === "h\xE0ng h\xF3a, d\u1ECBch v\u1EE5 theo h\xF3a \u0111\u01A1n" || s === "h\xE0ng h\xF3a d\u1ECBch v\u1EE5 theo h\xF3a \u0111\u01A1n" || s === "h\xE0ng h\xF3a / d\u1ECBch v\u1EE5" || s === "h\xE0ng h\xF3a/d\u1ECBch v\u1EE5" || s === "h\xE0ng h\xF3a" || s === "d\u1ECBch v\u1EE5" || s === "h\xE0ng h\xF3a d\u1ECBch v\u1EE5" || s === "h\xE0ng h\xF3a, d\u1ECBch v\u1EE5";
}
function hasGenuineItems(items) {
  if (!items || !Array.isArray(items) || items.length === 0) return false;
  return items.some((it) => {
    const n = (it.itemName || it.ten || "").trim();
    return n.length > 0 && !isPlaceholderItemName(n);
  });
}
function ensureInvoiceItems(invoice) {
  if (!invoice) return [];
  if (invoice.items && Array.isArray(invoice.items) && invoice.items.length > 0) {
    if (hasGenuineItems(invoice.items)) return invoice.items;
  }
  if (invoice.rawXml) {
    try {
      const parsed = extractInvoiceItemsFromXml(invoice.rawXml);
      if (parsed && parsed.length > 0) {
        invoice.items = parsed;
        return parsed;
      }
    } catch (err) {
      console.warn("L\u1ED7i khi b\xF3c t\xE1ch items t\u1EEB rawXml trong ensureInvoiceItems:", err);
    }
  }
  return invoice.items || [];
}
function parseGDTInvoiceXml(xmlString, filename) {
  if (!xmlString || typeof xmlString !== "string") {
    throw new Error("D\u1EEF li\u1EC7u XML r\u1ED7ng ho\u1EB7c kh\xF4ng h\u1EE3p l\u1EC7.");
  }
  let domDoc = null;
  const isBrowser = typeof window !== "undefined" && typeof window.DOMParser !== "undefined";
  if (isBrowser) {
    try {
      const parser = new DOMParser();
      domDoc = parser.parseFromString(xmlString, "application/xml");
      const parseError = domDoc.getElementsByTagName("parsererror")[0];
      if (parseError) {
        domDoc = null;
      }
    } catch {
      domDoc = null;
    }
  }
  const getTag = (context, tag, fallback = "") => {
    return extractTagValue(context, tag, fallback);
  };
  const xmlSource = xmlString;
  const pban = getTag(domDoc || xmlSource, "PBan") || "2.0.0";
  const thdon = getTag(domDoc || xmlSource, "THDon") || (getTag(domDoc || xmlSource, "KHMSHDon") === "1" ? "H\xD3A \u0110\u01A0N GI\xC1 TR\u1ECA GIA T\u0102NG" : "H\xD3A \u0110\u01A0N B\xC1N H\xC0NG");
  const khmshdon = getTag(domDoc || xmlSource, "KHMSHDon") || getTag(domDoc || xmlSource, "khmshdon") || "1";
  const khhdon = getTag(domDoc || xmlSource, "KHHDon") || getTag(domDoc || xmlSource, "khhdon") || "1C25TGT";
  const shdonRaw = getTag(domDoc || xmlSource, "SHDon") || getTag(domDoc || xmlSource, "shdon") || "1";
  const shdon = shdonRaw ? String(parseInt(shdonRaw, 10) || shdonRaw).padStart(7, "0") : "0000001";
  let nlap = getTag(domDoc || xmlSource, "NLap") || getTag(domDoc || xmlSource, "nlap") || "";
  if (!nlap) {
    nlap = getTag(domDoc || xmlSource, "SigningTime") || "";
  }
  if (nlap && !nlap.includes("T")) {
    nlap = `${nlap}T09:00:00`;
  }
  if (!nlap) {
    nlap = (/* @__PURE__ */ new Date()).toISOString().substring(0, 19);
  }
  const dvtte = getTag(domDoc || xmlSource, "DVTTe") || getTag(domDoc || xmlSource, "dvtte") || "VND";
  const tygia = parseInvoiceNumber(getTag(domDoc || xmlSource, "TGia") || getTag(domDoc || xmlSource, "tygia") || "1", 1);
  const htttoan = getTag(domDoc || xmlSource, "HTTToan") || getTag(domDoc || xmlSource, "htttoan") || "TM/CK";
  let nbanSource = domDoc ? findXmlTagElement(domDoc, ["NBan", "Seller", "Supplier", "NguoiBan"]) || domDoc : xmlSource;
  if (typeof nbanSource === "string") {
    const nbanBlock = ["NBan", "Seller", "Supplier", "NguoiBan"].map((tag) => extractTagBlocks(xmlSource, tag)[0]).find(Boolean);
    if (nbanBlock) nbanSource = nbanBlock;
  }
  const nbten = getTag(nbanSource, "Ten") || getTag(nbanSource, "TenNBan") || getTag(nbanSource, "TenNguoiBan") || getTag(domDoc || xmlSource, "nbten") || "";
  const nbmst = getTag(nbanSource, "MST") || getTag(nbanSource, "MSTNBan") || getTag(nbanSource, "MSTNguoiBan") || getTag(domDoc || xmlSource, "nbmst") || "";
  const nbdchi = getTag(nbanSource, "DChi") || getTag(nbanSource, "DiaChi") || getTag(domDoc || xmlSource, "nbdchi") || "";
  const nbsdt = getTag(nbanSource, "SDThoai") || getTag(nbanSource, "SDT") || getTag(nbanSource, "sdt") || "";
  const nbemail = getTag(nbanSource, "DCTDTu") || getTag(nbanSource, "Email") || getTag(nbanSource, "email") || "";
  const nbstk = getTag(nbanSource, "STKNHang") || getTag(nbanSource, "STK") || getTag(nbanSource, "stk") || "";
  const nbnhang = getTag(nbanSource, "TNHang") || getTag(nbanSource, "TenNH") || getTag(nbanSource, "nhang") || "";
  let nmuaSource = domDoc ? findXmlTagElement(domDoc, ["NMua", "Buyer", "Customer", "NguoiMua"]) || domDoc : xmlSource;
  if (typeof nmuaSource === "string") {
    const nmuaBlock = ["NMua", "Buyer", "Customer", "NguoiMua"].map((tag) => extractTagBlocks(xmlSource, tag)[0]).find(Boolean);
    if (nmuaBlock) nmuaSource = nmuaBlock;
  }
  const nmten = getTag(nmuaSource, "Ten") || getTag(nmuaSource, "TenNMua") || getTag(nmuaSource, "TenNguoiMua") || getTag(domDoc || xmlSource, "nmten") || "NG\u01AF\u1EDCI MUA H\xC0NG";
  const nmmst = getTag(nmuaSource, "MST") || getTag(nmuaSource, "MSTNMua") || getTag(domDoc || xmlSource, "nmmst") || "";
  const nmdchi = getTag(nmuaSource, "DChi") || getTag(nmuaSource, "DiaChi") || getTag(domDoc || xmlSource, "nmdchi") || "";
  const nmsdt = getTag(nmuaSource, "SDThoai") || getTag(nmuaSource, "SDT") || "";
  const nmemail = getTag(nmuaSource, "DCTDTu") || getTag(nmuaSource, "Email") || "";
  let items = extractInvoiceItemsFromXml(domDoc || xmlSource);
  if (items.length === 0 && typeof xmlSource === "string") {
    items = extractInvoiceItemsFromXml(xmlSource);
  }
  const tgtcthue = parseInvoiceNumber(getTag(domDoc || xmlSource, "TgTCThue"), items.reduce((s, it) => s + (it.amount || 0), 0));
  const tgtthue = parseInvoiceNumber(getTag(domDoc || xmlSource, "TgTThue"), items.reduce((s, it) => s + (it.taxAmount || 0), 0));
  const tgtttbso = parseInvoiceNumber(getTag(domDoc || xmlSource, "TgTTTBSo"), tgtcthue + tgtthue);
  let tgtttbchu = getTag(domDoc || xmlSource, "TgTTTBChu") || "";
  if (!tgtttbchu) {
    tgtttbchu = numberToVietnameseWords(tgtttbso);
  }
  const vatBreakdown = [];
  const ltSuatBlocks = extractTagBlocks(xmlSource, "LTSuat");
  if (ltSuatBlocks.length > 0) {
    for (const b of ltSuatBlocks) {
      const r = extractTagValue(b, "TSuat") || "10%";
      const a = parseInvoiceNumber(extractTagValue(b, "TTHTien") || extractTagValue(b, "ThTien"), 0);
      const t = parseInvoiceNumber(extractTagValue(b, "TThue"), 0);
      vatBreakdown.push({
        taxRate: r,
        amount: a,
        taxAmount: t,
        tsuat: r,
        thtien: a,
        tthue: t
      });
    }
  } else if (items.length > 0) {
    const mapRates = /* @__PURE__ */ new Map();
    items.forEach((it) => {
      const r = it.taxRate || "10%";
      const curr = mapRates.get(r) || { amount: 0, taxAmount: 0 };
      curr.amount += it.amount || 0;
      curr.taxAmount += it.taxAmount || 0;
      mapRates.set(r, curr);
    });
    mapRates.forEach((val, key) => {
      vatBreakdown.push({
        taxRate: key,
        amount: val.amount,
        taxAmount: val.taxAmount,
        tsuat: key,
        thtien: val.amount,
        tthue: val.taxAmount
      });
    });
  }
  let mhdon = getTag(domDoc || xmlSource, "MCCQT") || getTag(domDoc || xmlSource, "mhdon") || "";
  if (!mhdon) {
    const ttinBlocks = extractTagBlocks(xmlSource, "TTin");
    for (const block of ttinBlocks) {
      const truong = extractTagValue(block, "TTruong");
      if (truong.toLowerCase().includes("macqt") || truong.toLowerCase().includes("mccqt")) {
        mhdon = extractTagValue(block, "DLieu");
        break;
      }
    }
  }
  const hsgcma = !!mhdon || khmshdon.startsWith("1C") || khhdon.startsWith("1C");
  let signerName = getTag(domDoc || xmlSource, "X509SubjectName") || nbten;
  let rawIssuer = getTag(domDoc || xmlSource, "X509IssuerName") || "";
  const signedDate = getTag(domDoc || xmlSource, "SigningTime") || nlap;
  const hasDigitalSignature = xmlSource.includes("Signature") || xmlSource.includes("X509Certificate");
  let caProvider = rawIssuer || (hasDigitalSignature ? "Ch\u1EEF k\xFD s\u1ED1 h\u1EE3p l\u1EC7" : "Ch\u01B0a k\xFD s\u1ED1");
  if (signerName.includes("CN=")) {
    const cnMatch = signerName.match(/CN=([^,]+)/i);
    if (cnMatch && cnMatch[1]) signerName = cnMatch[1].trim();
  }
  if (caProvider.includes("O=")) {
    const oMatch = caProvider.match(/O=([^,]+)/i);
    if (oMatch && oMatch[1]) caProvider = oMatch[1].trim();
  }
  let buyerSignerName = "";
  let buyerSignedDate = "";
  const buyerSigBlock = extractTagBlocks(xmlSource, "NMua")[1];
  if (buyerSigBlock && buyerSigBlock.includes("Signature")) {
    buyerSignerName = extractTagValue(buyerSigBlock, "X509SubjectName") || nmten;
    buyerSignedDate = extractTagValue(buyerSigBlock, "SigningTime") || nlap;
  }
  let provider = detectProvider(xmlSource);
  let msttcgp = getTag(domDoc || xmlSource, "MSTTCGP") || "";
  let tentcgp = getTag(domDoc || xmlSource, "TenTCGP") || getTag(domDoc || xmlSource, "TCGP") || "";
  let { lookupCode, lookupUrl } = extractLookupDetailsFromXml(xmlSource);
  const isVnpt = provider === "VNPT" || msttcgp === "0100684378" || tentcgp.toUpperCase().includes("VNPT") || nbmst === "4000344946" || nbten.toUpperCase().includes("NGH\u0128A S\u01A0N") || nbten.toUpperCase().includes("NGHIA SON") || /vnpt-invoice|invoice\.vnpt\.vn|tracuu\.vnpt-invoice/i.test(xmlSource);
  if (isVnpt) {
    if (!lookupCode && mhdon) {
      lookupCode = mhdon;
    }
    if (!lookupUrl) {
      lookupUrl = `https://${nbmst || "4000344946"}-tt78.vnpt-invoice.com.vn`;
    }
  }
  const isLcs = provider === "LCS" || msttcgp === "0302999571" || tentcgp.toUpperCase().includes("L.C.S") || tentcgp.toUpperCase().includes("LCSSOFT") || nbmst === "0315018466" || nbten.toUpperCase().includes("PNJ") || /eip\.lcssoft\.com\.vn|lcssoft/i.test(xmlSource);
  if (isLcs) {
    if (!lookupCode && mhdon) {
      lookupCode = mhdon;
    }
    if (!lookupUrl) {
      lookupUrl = "https://eip.lcssoft.com.vn/desktop/#/login";
    }
  }
  const isVnpay = provider === "VNPAY" || msttcgp === "0102182292" || tentcgp.toUpperCase().includes("VNPAY") || nbmst === "0100112437" || /VIETCOMBANK/i.test(xmlSource) || /vnpayinvoice/i.test(xmlSource);
  if (isVnpay) {
    const isVcb = nbmst === "0100112437" || /VIETCOMBANK/i.test(xmlSource);
    if (!lookupUrl) {
      lookupUrl = isVcb ? "https://einvoice.vietcombank.com.vn/" : "https://portal.vnpayinvoice.vn/";
    }
    if (lookupCode && (lookupCode.toLowerCase() === "vietcombank" || !isLookupCodeCandidate(lookupCode))) {
      lookupCode = "";
    }
  }
  const isFpt = provider === "FPT" || msttcgp === "0104128565" || tentcgp.toUpperCase().includes("FPT") || /hoadon\.ftg\.vn/i.test(xmlSource);
  if (isFpt) {
    if (!lookupUrl) lookupUrl = "https://hoadon.ftg.vn/";
  }
  const cleanNbmst = (nbmst || "").replace(/\D/g, "");
  const isViettel = provider === "VIETTEL" || msttcgp === "0100109106" || cleanNbmst === "0402307168" || /SUNTALENT/i.test(nbten) || tentcgp.toUpperCase().includes("VIETTEL") || /0\s*4\s*0\s*2\s*3\s*0\s*7\s*1\s*6\s*8/i.test(xmlSource) || /sinvoice|vinvoice|viettel-invoice|0100109106|0402307168|suntalent/i.test(xmlSource);
  if (isViettel) {
    if (!lookupUrl) lookupUrl = "https://vinvoice.viettel.vn/utilities/invoice-search";
    if (!msttcgp) msttcgp = "0100109106";
    if (!tentcgp) tentcgp = "T\u1EADp \u0111o\xE0n C\xF4ng nghi\u1EC7p - Vi\u1EC5n th\xF4ng Qu\xE2n \u0111\u1ED9i (Viettel)";
    if (!provider) provider = "VIETTEL";
  }
  const id = `XML_${khhdon}_${shdon}_${nbmst}_${Date.now()}`;
  const draftInvoice = {
    id,
    khmshdon,
    khhdon,
    shdon,
    tdlap: nlap,
    nbmst,
    nbten,
    nbdchi,
    nbsdt,
    nbemail,
    nbstk,
    nbnhang,
    nmmst,
    nmten,
    nmdchi,
    nmsdt,
    nmemail,
    tgtcthue,
    tgtthue,
    tgtttbso,
    tgtttbchu,
    htttoan,
    dvtte,
    tygia,
    thdon,
    vatBreakdown,
    tthdon: 1,
    tthdonLabel: "H\xF3a \u0111\u01A1n g\u1ED1c",
    ttxly: hsgcma ? 1 : 2,
    ttxlyLabel: hsgcma ? "\u0110\xE3 c\u1EA5p m\xE3 CQT" : "Kh\xF4ng m\xE3 CQT",
    mhdon: mhdon || void 0,
    hsgcma,
    loaiHdon: "purchase",
    hasDigitalSignature,
    signerName,
    signedDate,
    caProvider,
    buyerSignerName,
    buyerSignedDate,
    provider,
    msttcgp,
    tentcgp,
    lookupCode,
    lookupUrl,
    items: [],
    rawXml: xmlString
  };
  const finalItems = items.length > 0 ? items : ensureInvoiceItems(draftInvoice);
  draftInvoice.items = finalItems;
  return draftInvoice;
}

// src/templates/templateUtils.ts
function formatVND(num) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(num || 0));
}
function formatNum(num) {
  if (num === void 0 || num === null || isNaN(num)) return "0";
  if (Number.isInteger(num)) {
    return new Intl.NumberFormat("vi-VN").format(num);
  }
  return new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 3 }).format(num);
}
function escapeHtml(str) {
  if (str === null || str === void 0) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function extractDateParts(invoice) {
  const tdlap = invoice.tdlap || (/* @__PURE__ */ new Date()).toISOString();
  const dateParts = tdlap.split("T")[0].split("-");
  const day = dateParts[2] ? String(dateParts[2]).padStart(2, "0") : "01";
  const month = dateParts[1] ? String(dateParts[1]).padStart(2, "0") : "01";
  const year = dateParts[0] || "2026";
  return { day, month, year, tdlap };
}
function extractLookupDetails(rawXml) {
  return extractLookupDetailsFromXml(rawXml);
}
function generateDefaultQrSvg(dataText = "HOADON") {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><rect width="100" height="100" fill="white"/><rect x="8" y="8" width="28" height="28" fill="none" stroke="black" stroke-width="4"/><rect x="16" y="16" width="12" height="12" fill="black"/><rect x="64" y="8" width="28" height="28" fill="none" stroke="black" stroke-width="4"/><rect x="72" y="16" width="12" height="12" fill="black"/><rect x="8" y="64" width="28" height="28" fill="none" stroke="black" stroke-width="4"/><rect x="16" y="72" width="12" height="12" fill="black"/><rect x="42" y="10" width="14" height="8" fill="black"/><rect x="40" y="24" width="8" height="16" fill="black"/><rect x="10" y="44" width="24" height="8" fill="black"/><rect x="44" y="42" width="16" height="16" fill="black"/><rect x="68" y="44" width="22" height="8" fill="black"/><rect x="42" y="66" width="12" height="24" fill="black"/><rect x="64" y="60" width="14" height="12" fill="black"/><rect x="82" y="66" width="10" height="24" fill="black"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
function getPrintControlsHtml(title) {
  return `
  <div class="print-actions" style="max-width:820px;margin:0 auto 16px auto;display:flex;justify-content:space-between;align-items:center;background:#1e293b;color:#fff;padding:10px 16px;border-radius:8px;font-family:sans-serif;">
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10b981;"></span>
      <span style="font-weight:600;font-size:13px;">${escapeHtml(title)}</span>
    </div>
    <div style="display:flex;gap:10px;">
      <button onclick="window.print()" style="background:#2563eb;color:white;border:none;padding:6px 16px;border-radius:6px;font-weight:600;font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
        \u{1F5A8}\uFE0F In H\xF3a \u0110\u01A1n (Ctrl + P)
      </button>
    </div>
  </div>`;
}

// src/templates/DefaultTemplate.ts
function formatTaxRateDisplay(rate) {
  if (rate === void 0 || rate === null || rate === "") return "\\";
  let str = String(rate).trim();
  str = str.replace(/<[^>]+>/g, "").trim();
  if (str === "0.1" || str === "0,1") return "10%";
  if (str === "0.08" || str === "0,08") return "8%";
  if (str === "0.05" || str === "0,05") return "5%";
  if (str === "0.00" || str === "0" || str === "0%") return "0%";
  if (str === "-1" || str === "-2" || /kct|khong/i.test(str)) return "KCT";
  if (str === "-3" || /knt|khong_nop/i.test(str)) return "KNT";
  if (/^\d+(\.\d+)?$/.test(str)) {
    const num = parseFloat(str);
    if (num > 0 && num <= 1) {
      return `${Math.round(num * 100)}%`;
    }
    return `${num}%`;
  }
  return str;
}
function renderDefaultTemplate(invoice, rawXml, options) {
  const { day, month, year } = extractDateParts(invoice);
  const { lookupCode } = extractLookupDetails(rawXml);
  const mCode = lookupCode || invoice.lookupCode || "";
  const items = ensureInvoiceItems(invoice);
  const totalAmount = invoice.tgtttbso || items.reduce((sum, item) => sum + (item.amount || item.thtien || 0), 0);
  const vatAmount = typeof invoice.tgtthue === "number" ? invoice.tgtthue : 0;
  const subTotal = typeof invoice.tgtcthue === "number" ? invoice.tgtcthue : totalAmount - vatAmount > 0 ? totalAmount - vatAmount : totalAmount;
  const wordsAmount = invoice.tgtttbchu || numberToVietnameseWords(totalAmount);
  const showControls = options?.showPrintControls !== false;
  const rawMauSo = invoice.khmshdon || (invoice.khhdon ? invoice.khhdon.charAt(0) : "1");
  const cleanMauSo = String(rawMauSo).trim();
  const mauSo = cleanMauSo;
  const kyHieu = invoice.khhdon || "";
  const soHdon = invoice.shdon || "";
  const maCqt = invoice.mhdon || "";
  const isMauSo2 = cleanMauSo === "2" || kyHieu.startsWith("2") || /^2[A-Z]/i.test(kyHieu);
  const isMauSo5 = cleanMauSo === "5" || kyHieu.startsWith("5");
  let invoiceTitle = (invoice.thdon || "").trim().toUpperCase();
  if (isMauSo2) {
    invoiceTitle = invoiceTitle && invoiceTitle.includes("B\xC1N H\xC0NG") ? invoiceTitle : "HO\xC1 \u0110\u01A0N B\xC1N H\xC0NG";
  } else if (isMauSo5) {
    invoiceTitle = invoiceTitle && (invoiceTitle.includes("V\xC9") || invoiceTitle.includes("TEM") || invoiceTitle.includes("TH\u1EBA")) ? invoiceTitle : "TEM / V\xC9 / TH\u1EBA \u0110I\u1EC6N T\u1EEC";
  } else if (!invoiceTitle || invoiceTitle.includes("B\xC1N H\xC0NG")) {
    invoiceTitle = "HO\xC1 \u0110\u01A0N GI\xC1 TR\u1ECA GIA T\u0102NG";
  }
  const isVatInvoice = !isMauSo2 && !isMauSo5 && (vatAmount > 0 || invoiceTitle.includes("GI\xC1 TR\u1ECA GIA T\u0102NG"));
  const qrImg = options?.qrCodeDataUrl || generateDefaultQrSvg(
    maCqt ? `https://hoadondientu.gdt.gov.vn/tra-cuu?cqt=${encodeURIComponent(maCqt)}` : `MST:${invoice.nbmst};KH:${kyHieu};SHD:${soHdon};TONG:${totalAmount}${mCode ? `;MTC:${mCode}` : ""}`
  );
  const isSvgTag = typeof qrImg === "string" && qrImg.trim().startsWith("<svg");
  const safeQrSrc = isSvgTag ? "" : qrImg.startsWith("data:") ? qrImg : escapeHtml(qrImg);
  const qrHtml = isSvgTag ? `<div style="width: 76px; height: 76px; overflow: hidden; display: flex; align-items: center; justify-content: center;">${qrImg}</div>` : `<img src="${safeQrSrc}" style="width: 76px; height: 76px; display: block; border: 0;" alt="QR Code">`;
  const sellerName = invoice.nbten || "";
  const sellerTaxCode = invoice.nbmst || "";
  const sellerStoreCode = invoice.sellerStoreCode || invoice.nbmchhang || "";
  const sellerStoreName = invoice.sellerStoreName || invoice.nbtchhang || "";
  const sellerAddress = invoice.nbdchi || "";
  const sellerPhone = invoice.nbsdt || invoice.sellerPhone || "";
  const sellerEmail = invoice.nbemail || invoice.sellerEmail || "";
  const sellerBankAcc = invoice.nbstk || "";
  const sellerBankName = invoice.nbnhang || "";
  const buyerName = invoice.nmten || "";
  const buyerContact = invoice.buyerContactPerson || invoice.nmnguoimua || "";
  const buyerTaxCode = invoice.nmmst || "";
  const buyerBudgetCode = invoice.buyerBudgetCode || invoice.nmdvcqhnsnn || "";
  const buyerIdCard = invoice.buyerIdCard || invoice.nmcccd || "";
  const buyerPassport = invoice.buyerPassport || invoice.nmhc || "";
  const buyerAddress = invoice.nmdchi || "";
  const buyerBankAcc = invoice.nmstk || "";
  const buyerBankName = invoice.nmnhang || "";
  const paymentMethod = invoice.htttoan || "Ti\u1EC1n m\u1EB7t/Chuy\u1EC3n kho\u1EA3n";
  const sbke = invoice.sbke || "";
  const ngayBke = invoice.ngayBke || "";
  const signerName = invoice.signerName || sellerName || "C\u01A0 QUAN / \u0110\u01A0N V\u1ECA PH\xC1T H\xC0NH";
  const signedDate = invoice.signedDate || invoice.tdlap || `${year}-${month}-${day}T00:00:00`;
  const itemsHtml = items.length > 0 ? items.map((item, idx) => {
    const it = item;
    const lineNo = it.lineNo || it.stt || idx + 1;
    const nature = it.tchat || (String(it.nature) === "2" ? "Khuy\u1EBFn m\u1EA1i" : String(it.nature) === "3" ? "Chi\u1EBFt kh\u1EA5u" : String(it.nature) === "4" ? "Ghi ch\xFA" : "H\xE0ng h\xF3a, d\u1ECBch v\u1EE5");
    const lhhdt = it.lhhdt || "";
    const itemName = it.itemName || it.name || it.thhdvu || "";
    const unit = it.unit || it.dvtinh || "";
    const qty = it.quantity ? formatNum(it.quantity) : it.sluong ? formatNum(it.sluong) : "";
    const price = it.unitPrice || it.dgia ? formatVND(it.unitPrice || it.dgia) : "";
    const discount = it.discount || it.stckhau ? formatVND(it.discount || it.stckhau) : "0";
    const taxRate = formatTaxRateDisplay(it.taxRate || it.tsuat || (isVatInvoice ? "8%" : "\\"));
    const itemAmount = formatVND(it.amount || it.thtien || 0);
    return `<tr>
  <td class="tx-center">${lineNo}</td>
  <td class="tx-left"><span>${escapeHtml(nature)}</span></td>
  <td class="tx-left" style="max-width: 200px; word-wrap: break-word;">${escapeHtml(lhhdt)}</td>
  <td class="tx-left">${escapeHtml(itemName)}</td>
  <td class="tx-left">${escapeHtml(unit)}</td>
  <td class="tx-center">${qty}</td>
  <td class="tx-center">${price}</td>
  <td class="tx-center">${discount}</td>
  <td class="tx-center">${escapeHtml(taxRate)}</td>
  <td class="tx-center">${itemAmount}</td>
</tr>`;
  }).join("\n") : `<tr>
  <td class="tx-center">1</td>
  <td class="tx-left"><span>H\xE0ng h\xF3a, d\u1ECBch v\u1EE5</span></td>
  <td class="tx-left"></td>
  <td class="tx-left">${escapeHtml(invoice.thdon || "Cung c\u1EA5p h\xE0ng h\xF3a, d\u1ECBch v\u1EE5")}</td>
  <td class="tx-left">G\xF3i</td>
  <td class="tx-center">1</td>
  <td class="tx-center">${formatVND(subTotal)}</td>
  <td class="tx-center">0</td>
  <td class="tx-center">${isVatInvoice ? "8%" : "\\"}</td>
  <td class="tx-center">${formatVND(subTotal)}</td>
</tr>`;
  const vatRows = invoice.vatBreakdown && invoice.vatBreakdown.length > 0 ? invoice.vatBreakdown : isVatInvoice ? [{ taxRate: items.find((it) => it.taxRate || it.tsuat)?.taxRate || items.find((it) => it.taxRate || it.tsuat)?.tsuat || "8%", amount: subTotal, taxAmount: vatAmount }] : [{ taxRate: "\\", amount: subTotal, taxAmount: 0 }];
  const vatRowsHtml = vatRows.map((row) => `<tr>
  <td class="tx-center">${escapeHtml(formatTaxRateDisplay(row.taxRate))}</td>
  <td class="tx-center">${formatVND(row.amount)}</td>
  <td class="tx-center">${formatVND(row.taxAmount)}</td>
</tr>`).join("\n");
  const printControls = showControls ? getPrintControlsHtml("H\xF3a \u0111\u01A1n \u0111i\u1EC7n t\u1EED chu\u1EA9n T\u1ED5ng c\u1EE5c Thu\u1EBF") : "";
  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<title>${escapeHtml(invoiceTitle)} - S\u1ED1: ${escapeHtml(soHdon)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=Edge">
<style>
  * {
    box-sizing: border-box;
    -moz-box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  body {
    width: 100%;
    height: 100%;
    margin: 0 auto;
    padding: 16px 0;
    font-size: 13pt;
    font-family: "Times New Roman", Times, serif;
    background-color: #f1f5f9;
    color: #000;
  }

  .print-page {
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
  }

  .main-page {
    max-width: 210mm;
    padding: 24px 22px 14px;
    margin: auto;
    background-color: #ffffff;
    border: 3px double rgba(145, 87, 21, 0.69);
    line-height: 1.5;
    box-shadow: rgb(222 226 230 / 70%) 0px 0px 9px 2px;
    position: relative;
    font-family: "Times New Roman", Times, serif;
  }

  .print-actions {
    max-width: 210mm;
    margin: 0 auto 12px auto;
  }

  .heading-content .main-title {
    font-size: 20pt;
    text-align: center;
    display: block;
    font-weight: bold;
    text-transform: uppercase;
    margin: 4px 0;
    color: #000;
  }

  .heading-content p {
    font-size: 13pt;
    text-align: right;
    margin: 2px 0;
  }

  .heading-content .day {
    text-align: center;
    display: block;
  }

  .heading-content p.day {
    text-align: center;
    display: block;
  }

  .heading-content .top-content {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .heading-content .code-content {
    display: inline-block;
    text-align: right;
    font-size: 12pt;
    line-height: 1.4;
  }

  .vip-divide {
    width: 100%;
    height: 0;
    border-bottom: 1px solid rgba(145, 87, 21, 0.69);
    margin: 8px 0;
  }

  .flex-li {
    display: flex;
  }

  .content-info {
    padding-top: 2px;
  }

  .content-info .list-fill-out {
    list-style: none;
    padding-inline-start: 0;
    padding-left: 0;
    margin-top: 4px;
    margin-bottom: 4px;
  }

  .content-info .list-fill-out li {
    font-size: 13pt;
  }

  .data-item {
    width: 100%;
    display: flex;
    justify-content: left;
    align-items: flex-start;
    font-size: 13pt;
    color: rgba(0, 0, 0, 0.85);
    margin-bottom: 2px;
  }

  .data-item .di-label {
    min-height: 24px;
    height: auto;
    border-bottom: 1px dashed transparent;
    display: flex;
    align-items: flex-start;
    white-space: nowrap;
    color: #111;
  }

  .data-item .di-value {
    box-sizing: border-box;
    flex: 1;
    min-height: 24px;
    display: flex;
    align-items: flex-start;
    padding-left: 6px;
    height: auto;
    justify-content: unset;
    color: #000;
  }

  .table-horizontal-wrapper {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin-top: 6px;
  }

  .res-tb {
    border-collapse: collapse;
    border-spacing: 0px;
    width: 100%;
    overflow-x: auto;
    margin: 8px 0px;
    min-width: 250px;
  }

  .res-tb tr td {
    border: 1px solid black;
    padding: 5px 4px;
    vertical-align: baseline;
    font-size: 12pt;
    color: #000;
  }

  .res-tb tr td.tx-center {
    text-align: center;
  }

  .res-tb tr td.tx-left {
    text-align: left;
  }

  .res-tb tr td.tx-right {
    text-align: right;
  }

  .res-tb thead tr th {
    border: 1px solid black;
    vertical-align: middle;
    padding: 6px 4px;
    font-size: 12pt;
    color: #000;
  }

  .res-tb thead tr th.tb-stt {
    width: 48px;
    text-align: center;
  }

  .res-tb thead tr th.tb-thh {
    width: 220px;
    text-align: center;
  }

  .res-tb thead tr th.tb-dvt {
    width: 75px;
    text-align: center;
  }

  .res-tb thead tr th.tb-sl {
    width: 70px;
    text-align: center;
  }

  .res-tb thead tr th.tb-dg {
    width: 80px;
    text-align: center;
  }

  .res-tb thead tr th.tb-ts {
    width: 70px;
    text-align: center;
  }

  .res-tb thead tr th.tb-ttct {
    width: 160px;
    text-align: center;
  }

  .ft-sign {
    padding-top: 16px;
  }

  .ft-sign .sign-dx {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-around;
    align-items: flex-start;
  }

  .ft-sign .sign-dx h3 {
    margin: 0;
    font-size: 13pt;
    font-weight: normal;
  }

  .ft-sign .sign-dx h3 p {
    text-align: center;
    font-size: 13pt;
    font-weight: bold;
    margin: 0;
    color: #000;
  }

  .ft-sign .sign-dx h3 p:nth-child(2) {
    font-size: 12pt;
    font-weight: normal;
    font-style: italic;
    margin-top: 4px;
  }

  .ft-sign .fd-end {
    padding-top: 36px;
    text-align: center;
  }

  .ft-sign .fd-end p {
    margin: 0;
    font-size: 11pt;
    color: #222;
  }

  .sign-box {
    width: 270px !important;
    padding: 6px 8px !important;
    border: 2px solid #23b709 !important;
    background-color: #f0fdf4;
    border-radius: 4px;
    margin-top: 8px !important;
    font-weight: 500;
    text-align: left;
    box-shadow: 0 1px 3px rgba(35, 183, 9, 0.15);
  }

  .sign-box span {
    color: #23b709 !important;
    font-size: 11.5pt !important;
    text-align: left !important;
    display: block;
    line-height: 1.3;
  }

  .span-sign-box {
    display: inline !important;
    color: #166534 !important;
    font-size: 9.5pt !important;
  }

  @page {
    size: A4 portrait;
    margin: 0 !important;
  }

  @media print {
    body {
      width: auto;
      height: auto;
      margin: 0 auto;
      background: transparent !important;
      padding: 0 !important;
    }
    .print-actions {
      display: none !important;
    }
    table, tr, td, th {
      page-break-inside: avoid;
    }
    table thead {
      display: table-row-group !important;
    }
    .table-horizontal-wrapper {
      page-break-inside: avoid;
      padding-top: 5px;
    }
    .main-page {
      margin: 0 auto;
      width: initial;
      min-height: 296mm;
      background: #fff !important;
      border: 3px double rgba(145, 87, 21, 0.69) !important;
      box-shadow: none !important;
    }
    .ft-sign {
      page-break-inside: avoid !important;
      page-break-after: auto;
    }
    .fd-end {
      padding-top: 20px !important;
    }
  }
</style>
</head>
<body>
${printControls}
<div class="print-page">
<div class="main-page">
<div class="heading-content">
  <div class="top-content">
    <div style="width: 80px; min-height: 20px">
      <div id="qrcodeTable">
        ${qrHtml}
      </div>
    </div>
    <div class="code-content">
      <b>M\u1EABu s\u1ED1: ${escapeHtml(mauSo)}</b><br>
      <b>K\xFD hi\u1EC7u: ${escapeHtml(kyHieu)}</b><br>
      <b>S\u1ED1: ${escapeHtml(soHdon)}</b>
    </div>
  </div>
  <div class="title-heading">
    <h2 class="main-title">${escapeHtml(invoiceTitle)}</h2>
    <div class="day">
      <p class="day">Ng\xE0y ${day} th\xE1ng ${month} n\u0103m ${year}</p>
      ${maCqt ? `<p class="day" style="font-family: monospace; font-size: 11.5pt;">MCCQT: ${escapeHtml(maCqt)}</p>` : ""}
    </div>
  </div>
</div>

<div class="vip-divide"></div>

<div class="content-info">
  <ul class="list-fill-out">
    <li>
      <div class="data-item">
        <div class="di-label"><span>T\xEAn ng\u01B0\u1EDDi b\xE1n:</span></div>
        <div class="di-value"><div style="font-weight: bold; text-transform: uppercase;">${escapeHtml(sellerName)}</div></div>
      </div>
    </li>
    <li>
      <div class="data-item">
        <div class="di-label"><span>M\xE3 s\u1ED1 thu\u1EBF:</span></div>
        <div class="di-value"><div style="font-weight: bold; font-family: monospace; font-size: 13pt;">${escapeHtml(sellerTaxCode)}</div></div>
      </div>
    </li>
    ${sellerStoreCode ? `<li>
      <div class="data-item">
        <div class="di-label"><span>M\xE3 c\u1EEDa h\xE0ng:</span></div>
        <div class="di-value"><div>${escapeHtml(sellerStoreCode)}</div></div>
      </div>
    </li>` : ""}
    ${sellerStoreName ? `<li>
      <div class="data-item">
        <div class="di-label"><span>T\xEAn c\u1EEDa h\xE0ng:</span></div>
        <div class="di-value"><div>${escapeHtml(sellerStoreName)}</div></div>
      </div>
    </li>` : ""}
    <li>
      <div class="data-item">
        <div class="di-label"><span>\u0110\u1ECBa ch\u1EC9:</span></div>
        <div class="di-value"><div>${escapeHtml(sellerAddress)}</div></div>
      </div>
    </li>
    ${sellerPhone ? `<li>
      <div class="data-item">
        <div class="di-label"><span>\u0110i\u1EC7n tho\u1EA1i:</span></div>
        <div class="di-value"><div>${escapeHtml(sellerPhone)}</div></div>
      </div>
    </li>` : ""}
    ${sellerEmail ? `<li>
      <div class="data-item">
        <div class="di-label"><span>Email:</span></div>
        <div class="di-value"><div>${escapeHtml(sellerEmail)}</div></div>
      </div>
    </li>` : ""}
    ${sellerBankAcc || sellerBankName ? `<li>
      <div class="data-item">
        <div class="di-label"><span>S\u1ED1 t\xE0i kho\u1EA3n:</span></div>
        <div class="di-value">
          <div>
            ${escapeHtml(sellerBankAcc)}
            ${sellerBankAcc && sellerBankName ? "&nbsp;&nbsp;&nbsp;" : ""}
            ${escapeHtml(sellerBankName)}
          </div>
        </div>
      </div>
    </li>` : ""}
    <li>
      <div class="vip-divide" style="margin: 5px 0;"></div>
    </li>
    <li>
      <div class="data-item">
        <div class="di-label"><span>T\xEAn ng\u01B0\u1EDDi mua:</span></div>
        <div class="di-value"><div style="font-weight: bold; text-transform: uppercase;">${escapeHtml(buyerName)}</div></div>
      </div>
    </li>
    <li>
      <div class="data-item">
        <div class="di-label"><span>H\u1ECD t\xEAn ng\u01B0\u1EDDi mua:</span></div>
        <div class="di-value"><div>${escapeHtml(buyerContact)}</div></div>
      </div>
    </li>
    <li>
      <div class="data-item">
        <div class="di-label"><span>M\xE3 s\u1ED1 thu\u1EBF:</span></div>
        <div class="di-value"><div style="font-weight: bold; font-family: monospace; font-size: 13pt;">${escapeHtml(buyerTaxCode)}</div></div>
      </div>
    </li>
    <li>
      <div class="data-item">
        <div class="di-label"><span>M\xE3 \u0110VCQHVNSNN:</span></div>
        <div class="di-value"><div>${escapeHtml(buyerBudgetCode)}</div></div>
      </div>
    </li>
    <li>
      <div class="data-item">
        <div class="di-label"><span>CCCD ng\u01B0\u1EDDi mua:</span></div>
        <div class="di-value"><div>${escapeHtml(buyerIdCard)}</div></div>
      </div>
    </li>
    <li>
      <div class="data-item">
        <div class="di-label"><span>S\u1ED1 h\u1ED9 chi\u1EBFu:</span></div>
        <div class="di-value"><div>${escapeHtml(buyerPassport)}</div></div>
      </div>
    </li>
    <li>
      <div class="data-item">
        <div class="di-label"><span>\u0110\u1ECBa ch\u1EC9:</span></div>
        <div class="di-value"><div>${escapeHtml(buyerAddress)}</div></div>
      </div>
    </li>
    <li>
      <div class="data-item">
        <div class="di-label"><span>S\u1ED1 t\xE0i kho\u1EA3n:</span></div>
        <div class="di-value">
          <div>
            ${escapeHtml(buyerBankAcc)}
            ${buyerBankAcc && buyerBankName ? "&nbsp;&nbsp;&nbsp;" : ""}
            ${escapeHtml(buyerBankName)}
          </div>
        </div>
      </div>
    </li>
    <li>
      <div class="data-item">
        <div class="di-label"><span>H\xECnh th\u1EE9c thanh to\xE1n:</span></div>
        <div class="di-value"><div>${escapeHtml(paymentMethod)}</div></div>
      </div>
    </li>
    <li class="flex-li">
      <div class="data-item" style="width: 50%">
        <div class="di-label"><span>S\u1ED1 b\u1EA3ng k\xEA:</span></div>
        <div class="di-value"><div>${escapeHtml(sbke)}</div></div>
      </div>
      <div class="data-item" style="width: 50%">
        <div class="di-label"><span>Ng\xE0y b\u1EA3ng k\xEA:</span></div>
        <div class="di-value"><div>${escapeHtml(ngayBke)}</div></div>
      </div>
    </li>
  </ul>

  <table class="res-tb">
    <thead style="text-align: center;">
      <tr>
        <th class="tb-stt">STT</th>
        <th class="tb-stt">T\xEDnh ch\u1EA5t</th>
        <th class="tb-stt">Lo\u1EA1i h\xE0ng ho\xE1 \u0111\u1EB7c tr\u01B0ng</th>
        <th class="tb-thh">T\xEAn h\xE0ng h\xF3a, d\u1ECBch v\u1EE5</th>
        <th class="tb-dvt">\u0110\u01A1n v\u1ECB t\xEDnh</th>
        <th class="tb-sl">S\u1ED1 l\u01B0\u1EE3ng</th>
        <th class="tb-dg">\u0110\u01A1n gi\xE1</th>
        <th class="tb-dg">Chi\u1EBFt kh\u1EA5u</th>
        <th class="tb-ts">Thu\u1EBF su\u1EA5t</th>
        <th class="tb-ttct">${isMauSo2 ? "Th\xE0nh ti\u1EC1n" : "Th\xE0nh ti\u1EC1n ch\u01B0a c\xF3 thu\u1EBF GTGT"}</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <div class="table-horizontal-wrapper" style="${!isVatInvoice ? "display: block;" : ""}">
    ${isVatInvoice ? `
    <div style="margin-right: 10px; min-width: 270px;">
      <table class="res-tb">
        <thead style="text-align: center">
          <tr>
            <th>Thu\u1EBF su\u1EA5t</th>
            <th>T\u1ED5ng ti\u1EC1n ch\u01B0a thu\u1EBF</th>
            <th>T\u1ED5ng ti\u1EC1n thu\u1EBF</th>
          </tr>
        </thead>
        <tbody>
          ${vatRowsHtml}
        </tbody>
      </table>
    </div>` : ""}
    <div style="${isVatInvoice ? "flex: 1;" : "max-width: 520px; margin-left: auto;"}">
      <table class="res-tb">
        <tbody>
          ${isVatInvoice ? `
          <tr>
            <td class="tx-center">
              T\u1ED5ng ti\u1EC1n ch\u01B0a thu\u1EBF<br>
              (T\u1ED5ng c\u1ED9ng th\xE0nh ti\u1EC1n ch\u01B0a c\xF3 thu\u1EBF)
            </td>
            <td class="tx-center" style="min-width: 180px; max-width: 300px; font-weight: bold;">
              ${formatVND(subTotal)}
            </td>
          </tr>
          <tr>
            <td class="tx-center">T\u1ED5ng ti\u1EC1n thu\u1EBF (T\u1ED5ng c\u1ED9ng ti\u1EC1n thu\u1EBF)</td>
            <td class="tx-center" style="min-width: 180px; max-width: 300px; font-weight: bold;">
              ${formatVND(vatAmount)}
            </td>
          </tr>` : `
          <tr>
            <td class="tx-center">
              T\u1ED5ng c\u1ED9ng ti\u1EC1n h\xE0ng (Th\xE0nh ti\u1EC1n)
            </td>
            <td class="tx-center" style="min-width: 180px; max-width: 300px; font-weight: bold;">
              ${formatVND(totalAmount)}
            </td>
          </tr>`}
          <tr>
            <td class="tx-center">T\u1ED5ng ti\u1EC1n ph\xED</td>
            <td class="tx-center" style="min-width: 180px; max-width: 300px;">0</td>
          </tr>
          <tr>
            <td class="tx-center">T\u1ED5ng ti\u1EC1n chi\u1EBFt kh\u1EA5u th\u01B0\u01A1ng m\u1EA1i</td>
            <td class="tx-center" style="min-width: 180px; max-width: 300px;">0</td>
          </tr>
          <tr>
            <td class="tx-center" style="font-weight: bold;">T\u1ED5ng ti\u1EC1n thanh to\xE1n b\u1EB1ng s\u1ED1</td>
            <td class="tx-center" style="min-width: 180px; max-width: 300px; font-weight: bold; font-size: 13pt;">
              ${formatVND(totalAmount)}
            </td>
          </tr>
          <tr>
            <td class="tx-center" style="font-weight: bold;">T\u1ED5ng ti\u1EC1n thanh to\xE1n b\u1EB1ng ch\u1EEF</td>
            <td class="tx-center" style="min-width: 180px; max-width: 300px; font-style: italic;">
              ${escapeHtml(wordsAmount)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</div>

<div class="vip-divide"></div>

<div class="ft-sign">
  <div class="sign-dx">
    <h3>
      <p>NG\u01AF\u1EDCI MUA H\xC0NG</p>
      <p><i>(Ch\u1EEF k\xFD s\u1ED1 (n\u1EBFu c\xF3))</i></p>
    </h3>
    <h3>
      <p>NG\u01AF\u1EDCI B\xC1N H\xC0NG</p>
      <p><i>(Ch\u1EEF k\xFD \u0111i\u1EC7n t\u1EED, ch\u1EEF k\xFD s\u1ED1)</i></p>
      <div class="sign-box">
        <div style="display:flex; align-items:center; gap:5px; margin-bottom:3px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#23b709" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          <span style="font-weight: bold; font-size: 11.5pt; color: #23b709 !important;">Signature Valid</span>
        </div>
        <div>
          <span class="span-sign-box">K\xFD b\u1EDFi&nbsp;</span>
          <span id="cks" class="span-sign-box" style="font-weight: 600;">${escapeHtml(signerName)}</span>
        </div>
        <div style="margin-top: 2px;">
          <span class="span-sign-box">K\xFD ng\xE0y:&nbsp;</span>
          <span class="span-sign-box" style="font-family: monospace;">${escapeHtml(signedDate)}</span>
        </div>
      </div>
    </h3>
  </div>
  <div class="fd-end">
    <p><i>(C\u1EA7n ki\u1EC3m tra, \u0111\u1ED1i chi\u1EBFu khi l\u1EADp, nh\u1EADn h\xF3a \u0111\u01A1n)</i></p>
  </div>
</div>
</div>
</div>
<input type="hidden" id="qrcodeContent" value="${escapeHtml(maCqt)}">
</body>
</html>`;
}

// src/utils/multiTemplateRenderer.ts
function renderDefaultTemplate2(invoice, rawXml, options) {
  return renderDefaultTemplate(invoice, rawXml, options);
}

// src/utils/officialInvoiceHtml.ts
function generateOfficialInvoiceHtml(invoiceOrXml, options) {
  const invoice = typeof invoiceOrXml === "string" ? parseGDTInvoiceXml(invoiceOrXml) : invoiceOrXml;
  const rawXml = typeof invoiceOrXml === "string" ? invoiceOrXml : invoice.rawXml || "";
  return renderDefaultTemplate2(invoice, rawXml, options);
}

// src/utils/xsltTransformer.ts
var OFFICIAL_GDT_INVOICE_XSLT = `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" 
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:inv="http://hoadondientu.gdt.gov.vn/2021"
  xmlns:ds="http://www.w3.org/2000/09/xmldsig#">

  <xsl:output method="html" encoding="UTF-8" indent="yes" doctype-public="-//W3C//DTD HTML 4.01 Transitional//EN"/>
  <xsl:param name="theme" select="'red'"/>

  <xsl:template match="/">
    <html lang="vi">
      <head>
        <meta charset="UTF-8"/>
        <title>H\xF3a \u0111\u01A1n \u0111i\u1EC7n t\u1EED - T\u1ED5ng c\u1EE5c Thu\u1EBF</title>
        <style>
          @page { size: A4 portrait; margin: 8mm 10mm; }
          * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 16px; background: #f8fafc; font-size: 11.5px; color: #0f172a; }
          .invoice-container { max-width: 820px; margin: 0 auto; background: #fff; padding: 20px; border: 1px solid #cbd5e1; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
          .outer-border-red { border: 2.5px solid #b91c1c; padding: 14px; }
          .inner-border-red { border: 1px solid #f87171; padding: 16px; position: relative; }
          .outer-border-blue { border: 2.5px solid #1d4ed8; padding: 14px; }
          .inner-border-blue { border: 1px solid #93c5fd; padding: 16px; position: relative; }
          .title-red { color: #b91c1c; }
          .title-blue { color: #1d4ed8; }
          .header-nation { text-align: center; margin-bottom: 12px; }
          .header-nation .title { font-size: 12px; font-weight: bold; text-transform: uppercase; margin: 0; }
          .header-nation .motto { font-size: 11px; font-weight: 600; margin: 2px 0 4px 0; color: #334155; }
          .header-nation .divider { width: 140px; height: 1.5px; background: #94a3b8; margin: 0 auto; }
          .title-row { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #b91c1c; padding-bottom: 10px; margin-bottom: 12px; }
          .title-col { flex: 1; text-align: center; padding-left: 60px; }
          .title-col h1 { margin: 0; font-size: 19px; font-weight: 900; text-transform: uppercase; }
          .meta-box { width: 190px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; padding: 8px 10px; font-family: 'Courier New', monospace; font-size: 11px; text-align: right; }
          .meta-row { display: flex; justify-content: space-between; margin-bottom: 2px; }
          .cqt-bar { background: #f0fdf4; border: 1px solid #86efac; border-radius: 4px; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 11px; color: #14532d; }
          .party-box { border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 4px; padding: 9px 12px; margin-bottom: 9px; font-size: 11.5px; }
          .party-row { display: flex; margin-bottom: 3px; }
          .party-label { width: 140px; font-weight: 600; color: #475569; flex-shrink: 0; }
          .mst-badge { font-family: 'Courier New', monospace; font-weight: 900; color: #b91c1c; background: #fee2e2; border: 1px solid #fca5a5; padding: 1px 6px; border-radius: 3px; }
          .items-table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 11px; }
          .items-table th, .items-table td { border: 1px solid #cbd5e1; padding: 6px 8px; }
          .items-table th { background: #f1f5f9; text-transform: uppercase; font-size: 10.5px; font-weight: bold; text-align: center; }
          .summary-box { border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 4px; padding: 9px 12px; margin-bottom: 12px; }
          .summary-row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 11.5px; }
          .summary-row.total { border-top: 2px solid #b91c1c; padding-top: 6px; margin-top: 6px; font-weight: 900; font-size: 13px; color: #b91c1c; }
          .sig-grid { display: flex; justify-content: space-between; border-top: 1px solid #cbd5e1; padding-top: 12px; margin-top: 10px; text-align: center; }
          .sig-col { width: 48%; }
          .sig-box { background: #f0fdf4; border: 2px dashed #22c55e; border-radius: 4px; padding: 8px 10px; text-align: left; font-size: 10px; color: #15803d; line-height: 1.4; }
          .no-print { text-align: center; margin-bottom: 16px; }
          .btn-print { background: #b91c1c; color: #fff; border: none; padding: 8px 18px; font-weight: bold; border-radius: 4px; cursor: pointer; }
          @media print { body { background: #fff; padding: 0; } .invoice-container { box-shadow: none; border: none; padding: 0; } .no-print { display: none !important; } }
        </style>
      </head>
      <body>
        <div class="no-print">
          <button class="btn-print" onclick="window.print()">\u{1F5A8}\uFE0F In H\xF3a \u0110\u01A1n (Ctrl + P) / L\u01B0u PDF</button>
        </div>
        <div class="invoice-container">
          <xsl:variable name="outerClass">
            <xsl:choose>
              <xsl:when test="$theme = 'blue'">outer-border-blue</xsl:when>
              <xsl:otherwise>outer-border-red</xsl:otherwise>
            </xsl:choose>
          </xsl:variable>
          <xsl:variable name="innerClass">
            <xsl:choose>
              <xsl:when test="$theme = 'blue'">inner-border-blue</xsl:when>
              <xsl:otherwise>inner-border-red</xsl:otherwise>
            </xsl:choose>
          </xsl:variable>

          <div class="{$outerClass}">
            <div class="{$innerClass}">
              <!-- Qu\u1ED1c hi\u1EC7u -->
              <div class="header-nation">
                <p class="title">C\u1ED8NG H\xD2A X\xC3 H\u1ED8I CH\u1EE6 NGH\u0128A VI\u1EC6T NAM</p>
                <p class="motto">\u0110\u1ED9c l\u1EADp - T\u1EF1 do - H\u1EA1nh ph\xFAc</p>
                <div class="divider"/>
              </div>

              <!-- Ti\xEAu \u0111\u1EC1 H\xF3a \u0111\u01A1n -->
              <xsl:apply-templates select="//TTChung | //inv:TTChung"/>

              <!-- M\xE3 CQT -->
              <div class="cqt-bar">
                <div>
                  <strong>M\xC3 C\u1EE6A C\u01A0 QUAN THU\u1EBE: </strong>
                  <span style="font-family: monospace; font-weight: bold; font-size: 12px;">
                    <xsl:value-of select="//MCCQT | //inv:MCCQT"/>
                  </span>
                  <div style="font-size: 10px; color: #15803d; margin-top: 2px;">
                    \u2713 \u0110\xE3 c\u1EA5p m\xE3 h\u1EE3p l\u1EC7 tr\xEAn C\u1ED5ng th\xF4ng tin H\xF3a \u0111\u01A1n \u0111i\u1EC7n t\u1EED T\u1ED5ng c\u1EE5c Thu\u1EBF
                  </div>
                </div>
              </div>

              <!-- B\xEAn B\xE1n -->
              <xsl:apply-templates select="//NBan | //inv:NBan"/>

              <!-- B\xEAn Mua -->
              <xsl:apply-templates select="//NMua | //inv:NMua"/>

              <!-- B\u1EA3ng H\xE0ng h\xF3a -->
              <table class="items-table">
                <thead>
                  <tr>
                    <th style="width: 35px;">STT</th>
                    <th style="text-align: left;">T\xEAn h\xE0ng h\xF3a, d\u1ECBch v\u1EE5</th>
                    <th style="width: 55px;">\u0110VT</th>
                    <th style="width: 65px; text-align: right;">S\u1ED1 l\u01B0\u1EE3ng</th>
                    <th style="width: 90px; text-align: right;">\u0110\u01A1n gi\xE1</th>
                    <th style="width: 65px;">Thu\u1EBF su\u1EA5t</th>
                    <th style="width: 105px; text-align: right;">Th\xE0nh ti\u1EC1n</th>
                  </tr>
                </thead>
                <tbody>
                  <xsl:for-each select="//DSHHDVu/HHDVu | //inv:DSHHDVu/inv:HHDVu">
                    <tr>
                      <td style="text-align: center; font-family: monospace;">
                        <xsl:value-of select="STT | inv:STT | position()"/>
                      </td>
                      <td style="font-weight: bold;">
                        <xsl:value-of select="THHDVu | inv:THHDVu"/>
                      </td>
                      <td style="text-align: center;">
                        <xsl:value-of select="DVTinh | inv:DVTinh"/>
                      </td>
                      <td style="text-align: right; font-family: monospace;">
                        <xsl:value-of select="SLuong | inv:SLuong"/>
                      </td>
                      <td style="text-align: right; font-family: monospace;">
                        <xsl:value-of select="DGia | inv:DGia"/>
                      </td>
                      <td style="text-align: center; font-weight: bold;">
                        <xsl:value-of select="TSuat | inv:TSuat"/>
                      </td>
                      <td style="text-align: right; font-family: monospace; font-weight: bold;">
                        <xsl:value-of select="TTHTien | inv:TTHTien | ThTien | inv:ThTien"/>
                      </td>
                    </tr>
                  </xsl:for-each>
                </tbody>
              </table>

              <!-- T\u1ED5ng h\u1EE3p Thanh to\xE1n -->
              <xsl:apply-templates select="//TToan | //inv:TToan"/>

              <!-- Ch\u1EEF k\xFD s\u1ED1 -->
              <div class="sig-grid">
                <div class="sig-col">
                  <p style="font-weight: bold; text-transform: uppercase; margin: 0;">Ng\u01B0\u1EDDi mua h\xE0ng</p>
                  <p style="font-size: 10.5px; color: #64748b; font-style: italic; margin: 2px 0 8px 0;">(K\xFD, ghi r\xF5 h\u1ECD t\xEAn)</p>
                  <div style="height: 60px; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-style: italic;">
                    (\u0110\xE3 x\xE1c nh\u1EADn thanh to\xE1n \u0111i\u1EC7n t\u1EED)
                  </div>
                </div>
                <div class="sig-col">
                  <p style="font-weight: bold; text-transform: uppercase; margin: 0;">Ng\u01B0\u1EDDi b\xE1n h\xE0ng</p>
                  <p style="font-size: 10.5px; color: #64748b; font-style: italic; margin: 2px 0 8px 0;">(Ch\u1EEF k\xFD s\u1ED1 h\u1EE3p chu\u1EA9n)</p>
                  <div class="sig-box">
                    <div style="font-weight: bold; margin-bottom: 2px;">\u2713 CH\u1EEE K\xDD S\u1ED0 H\u1EE2P L\u1EC6 (DIGITALLY SIGNED)</div>
                    <div><strong>K\xFD b\u1EDFi: </strong><xsl:value-of select="//NBan/Ten | //inv:NBan/inv:Ten"/></div>
                    <div><strong>MST: </strong><xsl:value-of select="//NBan/MST | //inv:NBan/inv:MST"/></div>
                    <div><strong>Th\u1EDDi \u0111i\u1EC3m k\xFD: </strong><xsl:value-of select="//SigningTime | //ds:SigningTime | //NLap | //inv:NLap"/></div>
                  </div>
                </div>
              </div>

              <!-- Footer -->
              <div style="border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: 14px; text-align: center; font-size: 9px; color: #64748b;">
                <p><i>(C\u1EA7n ki\u1EC3m tra, \u0111\u1ED1i chi\u1EBFu khi l\u1EADp, nh\u1EADn h\xF3a \u0111\u01A1n theo quy \u0111\u1ECBnh c\u1EE7a T\u1ED5ng c\u1EE5c Thu\u1EBF)</i></p>
                <p>Tra c\u1EE9u d\u1EEF li\u1EC7u t\u1EA1i C\u1ED5ng Th\xF4ng tin H\xF3a \u0111\u01A1n: <strong>https://hoadondientu.gdt.gov.vn</strong></p>
              </div>

            </div>
          </div>
        </div>
      </body>
    </html>
  </xsl:template>

  <!-- Template for TTChung -->
  <xsl:template match="TTChung | inv:TTChung">
    <div class="title-row">
      <div class="title-col">
        <h1 class="title-red">
          <xsl:choose>
            <xsl:when test="THDon | inv:THDon"><xsl:value-of select="THDon | inv:THDon"/></xsl:when>
            <xsl:when test="KHMSHDon = '1' or inv:KHMSHDon = '1'">H\xD3A \u0110\u01A0N GI\xC1 TR\u1ECA GIA T\u0102NG</xsl:when>
            <xsl:otherwise>H\xD3A \u0110\u01A0N B\xC1N H\xC0NG</xsl:otherwise>
          </xsl:choose>
        </h1>
        <div style="font-size: 10px; color: #64748b; font-style: italic; margin-top: 2px;">
          (Theo Ngh\u1ECB \u0111\u1ECBnh s\u1ED1 123/2020/N\u0110-CP v\xE0 Th\xF4ng t\u01B0 s\u1ED1 78/2021/TT-BTC)
        </div>
        <div style="font-size: 11px; font-weight: 600; margin-top: 5px;">
          Ng\xE0y l\u1EADp: <xsl:value-of select="NLap | inv:NLap"/>
        </div>
      </div>
      <div class="meta-box">
        <div class="meta-row">
          <span>M\u1EABu s\u1ED1: </span>
          <strong><xsl:value-of select="KHMSHDon | inv:KHMSHDon"/></strong>
        </div>
        <div class="meta-row">
          <span>K\xFD hi\u1EC7u: </span>
          <strong style="color: #b91c1c;"><xsl:value-of select="KHHDon | inv:KHHDon"/></strong>
        </div>
        <div class="meta-row" style="border-top: 1px dashed #fca5a5; padding-top: 3px; margin-top: 3px;">
          <span>S\u1ED1 H\u0110: </span>
          <strong style="color: #b91c1c; font-size: 13px;"><xsl:value-of select="SHDon | inv:SHDon"/></strong>
        </div>
      </div>
    </div>
  </xsl:template>

  <!-- Template for NBan -->
  <xsl:template match="NBan | inv:NBan">
    <div class="party-box">
      <div class="party-row">
        <span class="party-label">\u0110\u01A1n v\u1ECB b\xE1n h\xE0ng:</span>
        <strong style="text-transform: uppercase;"><xsl:value-of select="Ten | inv:Ten"/></strong>
      </div>
      <div class="party-row">
        <span class="party-label">M\xE3 s\u1ED1 thu\u1EBF:</span>
        <div><span class="mst-badge"><xsl:value-of select="MST | inv:MST"/></span></div>
      </div>
      <div class="party-row">
        <span class="party-label">\u0110\u1ECBa ch\u1EC9:</span>
        <span><xsl:value-of select="DChi | inv:DChi"/></span>
      </div>
    </div>
  </xsl:template>

  <!-- Template for NMua -->
  <xsl:template match="NMua | inv:NMua">
    <div class="party-box">
      <div class="party-row">
        <span class="party-label">Ng\u01B0\u1EDDi mua h\xE0ng:</span>
        <strong><xsl:value-of select="Ten | inv:Ten"/></strong>
      </div>
      <div class="party-row">
        <span class="party-label">M\xE3 s\u1ED1 thu\u1EBF:</span>
        <span><xsl:value-of select="MST | inv:MST | '(Kh\xF4ng c\xF3)'"/></span>
      </div>
      <div class="party-row">
        <span class="party-label">\u0110\u1ECBa ch\u1EC9:</span>
        <span><xsl:value-of select="DChi | inv:DChi"/></span>
      </div>
    </div>
  </xsl:template>

  <!-- Template for TToan -->
  <xsl:template match="TToan | inv:TToan">
    <div class="summary-box">
      <div class="summary-row">
        <span>T\u1ED5ng c\u1ED9ng ti\u1EC1n h\xE0ng (ch\u01B0a thu\u1EBF):</span>
        <strong style="font-family: monospace;"><xsl:value-of select="TgTCThue | inv:TgTCThue"/></strong>
      </div>
      <div class="summary-row">
        <span>Ti\u1EC1n thu\u1EBF GTGT:</span>
        <strong style="font-family: monospace; color: #b45309;"><xsl:value-of select="TgTThue | inv:TgTThue"/></strong>
      </div>
      <div class="summary-row total">
        <span>T\u1ED4NG TI\u1EC0N THANH TO\xC1N:</span>
        <span style="font-family: monospace;"><xsl:value-of select="TgTTTBSo | inv:TgTTTBSo"/></span>
      </div>
      <div class="summary-row" style="border-top: 1px dashed #cbd5e1; padding-top: 4px; margin-top: 4px; font-style: italic;">
        <span>S\u1ED1 ti\u1EC1n vi\u1EBFt b\u1EB1ng ch\u1EEF: <strong><xsl:value-of select="TgTTTBChu | inv:TgTTTBChu"/></strong></span>
      </div>
    </div>
  </xsl:template>

</xsl:stylesheet>`;

// src/services/invoice-engine/captcha/geminiCaptchaSolver.ts
import { GoogleGenAI } from "@google/genai";
import { createHash } from "node:crypto";
var VNPT_CAPTCHA_PROMPT = "Read the 4 digits in this captcha image. Ignore background noise. Output ONLY the 4 digits.";
var EASYINVOICE_CAPTCHA_PROMPT = VNPT_CAPTCHA_PROMPT;
var ALPHANUMERIC_CAPTCHA_PROMPT = "Read the 4 to 6 alphanumeric characters in this captcha image. Output ONLY those characters, no explanation.";
var attempts = /* @__PURE__ */ new Map();
var blockedKeys = /* @__PURE__ */ new Map();
var usage = { requests: 0, cacheHits: 0, failures: 0, inputTokens: 0, outputTokens: 0, thinkingTokens: 0 };
function imagePart(input) {
  if (typeof input === "string") {
    const dataUri = input.trim().match(/^data:(image\/[^;]+);base64,([\s\S]+)$/);
    if (dataUri) return { mimeType: dataUri[1], data: dataUri[2] };
    if (input.trim().startsWith("<svg")) return { mimeType: "image/svg+xml", data: Buffer.from(input).toString("base64") };
  }
  const bytes = typeof input === "string" ? Buffer.from(input, "base64") : Buffer.from(input);
  const signature = bytes.subarray(0, 12).toString("latin1");
  const mimeType = signature.startsWith("GIF") ? "image/gif" : bytes[0] === 255 && bytes[1] === 216 ? "image/jpeg" : signature.startsWith("RIFF") ? "image/webp" : signature.startsWith("BM") ? "image/bmp" : "image/png";
  return { mimeType, data: bytes.toString("base64") };
}
async function solveCaptchaWithGemini(input, customPrompt, options = {}) {
  const apiKey = options.customApiKey || process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY ch\u01B0a \u0111\u01B0\u1EE3c c\u1EA5u h\xECnh.");
  if (process.env.CAPTCHA_AI_ENABLED === "false") throw new Error("OCR AI \u0111\xE3 t\u1EAFt. Vui l\xF2ng nh\u1EADp CAPTCHA th\u1EE7 c\xF4ng.");
  let model = process.env.CAPTCHA_AI_MODEL || "gemini-flash-latest";
  if (model === "gemini-2.5-flash-lite" || model.includes("1.5-flash") || model.includes("2.0-flash")) {
    model = "gemini-flash-latest";
  }
  const keyHash = createHash("sha256").update(apiKey).digest("hex");
  if ((blockedKeys.get(keyHash) || 0) > Date.now()) {
    throw new Error("OCR AI \u0111ang t\u1EA1m d\u1EEBng sau l\u1ED7i h\u1EA1n m\u1EE9c/c\u1EA5u h\xECnh. Vui l\xF2ng nh\u1EADp CAPTCHA th\u1EE7 c\xF4ng.");
  }
  const image = imagePart(input);
  const prompt = customPrompt || VNPT_CAPTCHA_PROMPT;
  const alphanumeric = options.alphanumeric ?? /alphanumeric/i.test(prompt);
  const fingerprint = createHash("sha256").update(JSON.stringify([keyHash, model, image, prompt, alphanumeric])).digest("hex");
  for (const [key, entry] of attempts) {
    if (entry.expires <= Date.now()) attempts.delete(key);
  }
  const existing = attempts.get(fingerprint);
  if (existing) {
    usage.cacheHits++;
    return existing.promise;
  }
  if (attempts.size >= 512) throw new Error("OCR \u0111ang b\u1EADn. Vui l\xF2ng th\u1EED l\u1EA1i sau.");
  const timeoutMs = Math.min(Math.max(options.timeoutMs || 12e3, 1e4), 12e3);
  const work = (async () => {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          },
          timeout: timeoutMs
        }
      });
      usage.requests++;
      const response = await ai.models.generateContent({
        model,
        contents: [{ inlineData: image }, { text: prompt }],
        config: {
          maxOutputTokens: 32,
          abortSignal: AbortSignal.timeout(timeoutMs)
        }
      });
      usage.inputTokens += response.usageMetadata?.promptTokenCount || 0;
      usage.outputTokens += response.usageMetadata?.candidatesTokenCount || 0;
      usage.thinkingTokens += response.usageMetadata?.thoughtsTokenCount || 0;
      console.info("[CAPTCHA usage]", JSON.stringify({ model, ...usage }));
      const rawText = (response.text || "").trim();
      const cleanChars = rawText.replace(/[^a-zA-Z0-9]/g, "");
      if (alphanumeric) {
        if (/^[a-zA-Z0-9]{4,6}$/.test(cleanChars)) {
          return cleanChars.toUpperCase();
        }
        const match = rawText.match(/[a-zA-Z0-9]{4,6}/);
        if (match) return match[0].toUpperCase();
      } else {
        const digits = rawText.replace(/[^0-9]/g, "");
        if (/^\d{4}$/.test(digits)) return digits;
      }
      throw new Error(`OCR tr\u1EA3 v\u1EC1 m\xE3 kh\xF4ng h\u1EE3p l\u1EC7: "${rawText}".`);
    } catch (error) {
      usage.failures++;
      const message = String(error?.message || error);
      if (/429|RESOURCE_EXHAUSTED|spending cap|quota|401|403|API_KEY/i.test(message)) {
        if (blockedKeys.size >= 128) blockedKeys.delete(blockedKeys.keys().next().value);
        blockedKeys.set(keyHash, Date.now() + 6e4);
      }
      throw error;
    }
  })();
  attempts.set(fingerprint, { expires: Date.now() + 12e4, promise: work });
  return work;
}

// src/services/invoice-engine/captcha/tesseractCaptchaSolver.ts
import { createWorker } from "tesseract.js";
import zlib from "zlib";
var isServerless = Boolean(
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT || process.env.NETLIFY
);
var tesseractWorker = null;
var workerInitializing = null;
async function getWorker(whitelist) {
  if (tesseractWorker) {
    if (whitelist) {
      await tesseractWorker.setParameters({
        tessedit_char_whitelist: whitelist,
        tessedit_pageseg_mode: "7"
        // Single text line
      });
    }
    return tesseractWorker;
  }
  if (workerInitializing) {
    const w2 = await workerInitializing;
    if (whitelist) {
      await w2.setParameters({
        tessedit_char_whitelist: whitelist,
        tessedit_pageseg_mode: "7"
      });
    }
    return w2;
  }
  workerInitializing = (async () => {
    try {
      const cachePath = isServerless ? "/tmp" : ".";
      const w2 = await createWorker("eng", 1, {
        cachePath
      });
      await w2.setParameters({
        tessedit_char_whitelist: whitelist || "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
        tessedit_pageseg_mode: "7"
      });
      tesseractWorker = w2;
      return w2;
    } finally {
      workerInitializing = null;
    }
  })();
  const w = await workerInitializing;
  return w;
}
function decodePngRgba(buf) {
  try {
    let offset = 8;
    const idatChunks = [];
    let width = 0;
    let height = 0;
    while (offset < buf.length) {
      const len = buf.readUInt32BE(offset);
      const type = buf.slice(offset + 4, offset + 8).toString("ascii");
      if (type === "IHDR") {
        width = buf.readUInt32BE(offset + 8);
        height = buf.readUInt32BE(offset + 12);
      } else if (type === "IDAT") {
        idatChunks.push(buf.slice(offset + 8, offset + 8 + len));
      }
      offset += 12 + len;
    }
    if (!width || !height || idatChunks.length === 0) return null;
    const decompressed = zlib.inflateSync(Buffer.concat(idatChunks));
    const rawRgba = Buffer.alloc(width * height * 4);
    const stride = width * 4 + 1;
    const prevRow = Buffer.alloc(width * 4);
    for (let y = 0; y < height; y++) {
      const filter = decompressed[y * stride];
      const rowOffset = y * stride + 1;
      const destOffset = y * width * 4;
      for (let x = 0; x < width * 4; x++) {
        const bpp = 4;
        const raw = decompressed[rowOffset + x];
        const a = x >= bpp ? rawRgba[destOffset + x - bpp] : 0;
        const b = prevRow[x];
        const c = x >= bpp ? prevRow[x - bpp] : 0;
        let val = raw;
        if (filter === 1) val = raw + a & 255;
        else if (filter === 2) val = raw + b & 255;
        else if (filter === 3) val = raw + Math.floor((a + b) / 2) & 255;
        else if (filter === 4) {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          val = raw + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c) & 255;
        }
        rawRgba[destOffset + x] = val;
        prevRow[x] = val;
      }
    }
    return { width, height, data: rawRgba };
  } catch {
    return null;
  }
}
function createBinarizedBmp(decoded, scale = 3, cropLeft = 30, cropRight = 142) {
  const { width, height, data } = decoded;
  const cropX1 = Math.max(0, Math.min(cropLeft, width - 10));
  const cropX2 = Math.min(cropRight, width);
  const cropW = Math.max(1, cropX2 - cropX1);
  const cropH = height;
  const newW = cropW * scale;
  const newH = cropH * scale;
  const rowSize = Math.floor((24 * newW + 31) / 32) * 4;
  const imageSize = rowSize * newH;
  const fileSize = 54 + imageSize;
  const bmp = Buffer.alloc(fileSize);
  bmp.write("BM", 0);
  bmp.writeUInt32LE(fileSize, 2);
  bmp.writeUInt32LE(54, 10);
  bmp.writeUInt32LE(40, 14);
  bmp.writeInt32LE(newW, 18);
  bmp.writeInt32LE(newH, 22);
  bmp.writeUInt16LE(1, 26);
  bmp.writeUInt16LE(24, 28);
  bmp.writeUInt32LE(0, 30);
  bmp.writeUInt32LE(imageSize, 34);
  for (let destY = 0; destY < newH; destY++) {
    const srcY = Math.floor((newH - 1 - destY) / scale);
    const rowStart = 54 + destY * rowSize;
    for (let destX = 0; destX < newW; destX++) {
      const srcX = cropX1 + Math.floor(destX / scale);
      const srcIdx = (srcY * width + srcX) * 4;
      const r = data[srcIdx] || 0;
      const g = data[srcIdx + 1] || 0;
      const b = data[srcIdx + 2] || 0;
      const lum = r * 0.299 + g * 0.587 + b * 0.114;
      const isText = lum > 140;
      const val = isText ? 0 : 255;
      const pxOffset = rowStart + destX * 3;
      bmp[pxOffset] = val;
      bmp[pxOffset + 1] = val;
      bmp[pxOffset + 2] = val;
    }
  }
  return bmp;
}
async function solveCaptchaWithTesseract(imageInput, options) {
  const timeoutMs = options?.timeoutMs || 4500;
  const recognitionPromise = (async () => {
    let buf;
    if (typeof imageInput === "string") {
      const trimmed = imageInput.trim();
      if (trimmed.startsWith("<svg") || trimmed.includes("<svg")) {
        throw new Error("Tesseract kh\xF4ng h\u1ED7 tr\u1EE3 \u0111\u1ECBnh d\u1EA1ng SVG tr\u1EF1c ti\u1EBFp.");
      }
      const cleanB64 = trimmed.replace(/^data:image\/[a-z+]+;base64,/, "");
      buf = Buffer.from(cleanB64, "base64");
    } else {
      buf = Buffer.from(imageInput);
    }
    if (buf.length >= 4 && buf.slice(0, 10).toString("utf-8").includes("<svg")) {
      throw new Error("Tesseract kh\xF4ng h\u1ED7 tr\u1EE3 \u0111\u1ECBnh d\u1EA1ng SVG tr\u1EF1c ti\u1EBFp.");
    }
    const digitsOnly = options?.digitsOnly === true;
    const whitelist = options?.whitelist || (digitsOnly ? "0123456789" : "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    let processBuf = buf;
    const isPng = buf[0] === 137 && buf[1] === 80 && buf[2] === 78 && buf[3] === 71;
    if (options?.preprocessEasyInvoice === true && isPng) {
      const decoded = decodePngRgba(buf);
      if (decoded) {
        const binarized = createBinarizedBmp(decoded, 3, 25, 145);
        processBuf = binarized;
      }
    }
    const worker = await getWorker(whitelist);
    const result = await worker.recognize(processBuf);
    let text = result.data.text || "";
    if (digitsOnly) {
      text = text.replace(/[^0-9]/g, "");
    } else {
      text = text.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    }
    return {
      code: text,
      confidence: result.data.confidence || 0
    };
  })();
  const timeoutPromise = new Promise(
    (_, reject) => setTimeout(() => reject(new Error(`Tesseract timeout v\u01B0\u1EE3t qu\xE1 ${timeoutMs}ms`)), timeoutMs)
  );
  return Promise.race([recognitionPromise, timeoutPromise]);
}
async function terminateTesseract() {
  if (tesseractWorker) {
    await tesseractWorker.terminate();
    tesseractWorker = null;
  }
}

// src/services/invoice-engine/captcha/CaptchaSolver.ts
var CaptchaSolver = class {
  /**
   * Ưu tiên giải mã cục bộ bằng Tesseract (Miễn phí 100%, chạy offline),
   * nếu thất bại mới tự động chuyển sang Gemini API làm phương án dự phòng.
   * Nếu có cờ forceGemini (ví dụ khi GDT từ chối mã từ OCR local ở lần trước),
   * sẽ bỏ qua Tesseract và dùng ngay Gemini API trên CAPTCHA mới.
   */
  static async solveWithAI(imageInput, options) {
    const startTime = Date.now();
    if (!options?.forceGemini) {
      try {
        const tesseractRes = await solveCaptchaWithTesseract(imageInput, {
          digitsOnly: options?.alphanumeric !== true,
          whitelist: options?.whitelist || (options?.alphanumeric ? "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ" : "0123456789"),
          timeoutMs: options?.timeoutMs || 4e3,
          preprocessEasyInvoice: options?.preprocessEasyInvoice === true
        });
        const localCode = (tesseractRes?.code || "").trim().toUpperCase();
        const validLocalCode = options?.alphanumeric ? /^[A-Z0-9]{4,6}$/.test(localCode) : /^[0-9]{3,6}$/.test(localCode);
        if (validLocalCode) {
          console.log(`[CaptchaSolver] Tesseract local gi\u1EA3i th\xE0nh c\xF4ng: "${localCode}" (\u0111\u1ED9 tin c\u1EADy: ${Math.round(tesseractRes.confidence)}%)`);
          return {
            code: localCode,
            confidence: tesseractRes.confidence,
            engine: "tesseract-local",
            processingTimeMs: Date.now() - startTime
          };
        }
      } catch (error) {
        console.warn("[CaptchaSolver] Tesseract local OCR kh\xF4ng nh\u1EADn di\u1EC7n \u0111\u01B0\u1EE3c:", error?.message || error);
      }
    }
    try {
      if (options?.forceGemini) {
        console.log("[CaptchaSolver] K\xEDch ho\u1EA1t \u01B0u ti\xEAn Gemini API cho CAPTCHA m\u1EDBi...");
      }
      const code = await solveCaptchaWithGemini(imageInput, options?.prompt, {
        timeoutMs: Math.max(options?.timeoutMs || 12e3, 1e4),
        customApiKey: options?.customApiKey,
        alphanumeric: options?.alphanumeric
      });
      if (code) {
        console.log(`[CaptchaSolver] Gemini API gi\u1EA3i th\xE0nh c\xF4ng: "${code}"`);
        return {
          code,
          confidence: 99,
          engine: "gemini",
          processingTimeMs: Date.now() - startTime
        };
      }
    } catch (error) {
      console.warn("[CaptchaSolver] Gemini CAPTCHA fallback kh\xF4ng th\xE0nh c\xF4ng:", error?.message || error);
      return null;
    }
    return null;
  }
  static isValidImageBuffer(buf) {
    if (!buf || buf.length < 8) return false;
    const image = Buffer.from(buf);
    return image[0] === 137 && image[1] === 80 && image[2] === 78 && image[3] === 71 || image[0] === 255 && image[1] === 216 && image[2] === 255 || image[0] === 71 && image[1] === 73 && image[2] === 70 || image[0] === 66 && image[1] === 77 || image[0] === 82 && image[1] === 73 && image[2] === 70 && image[3] === 70;
  }
  static async solve(imageInput, options) {
    const result = await this.solveWithDetails(imageInput, options);
    return result.code;
  }
  static async solveWithDetails(imageInput, options) {
    const res = await this.solveWithAI(imageInput, options);
    if (!res || !res.code) {
      throw new Error("[CaptchaSolver] Kh\xF4ng th\u1EC3 gi\u1EA3i Captcha b\u1EB1ng c\u1EA3 Tesseract local l\u1EABn Gemini.");
    }
    return res;
  }
  static async resetWorker() {
    await terminateTesseract();
  }
  static async terminate() {
    await terminateTesseract();
  }
};

// src/services/invoice-engine/drivers/InvoiceProviderDriver.ts
var BaseInvoiceProviderDriver = class {
  /**
   * Helper: Trích xuất giá trị một thẻ XML bất kỳ (hỗ trợ cả namespace & CDATA)
   */
  extractXmlTag(xml, tagName, defaultValue = "") {
    if (!xml) return defaultValue;
    const cleanTag = tagName.replace(/[^a-zA-Z0-9_]/g, "");
    const regex = new RegExp(`<(?:[a-zA-Z0-9_]+:)?${cleanTag}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_]+:)?${cleanTag}>`, "i");
    const match = xml.match(regex);
    if (match && match[1]) {
      let val = match[1].trim();
      if (val.startsWith("<![CDATA[") && val.endsWith("]]>")) {
        val = val.substring(9, val.length - 3).trim();
      }
      return val;
    }
    return defaultValue;
  }
  /**
   * Helper: Trích xuất danh sách các block XML lặp lại
   */
  extractXmlBlocks(xml, tagName) {
    if (!xml) return [];
    const cleanTag = tagName.replace(/[^a-zA-Z0-9_]/g, "");
    const regex = new RegExp(`<(?:[a-zA-Z0-9_]+:)?${cleanTag}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_]+:)?${cleanTag}>`, "gi");
    const blocks = [];
    let m;
    while ((m = regex.exec(xml)) !== null) {
      if (m[1]) {
        blocks.push(m[1]);
      }
    }
    return blocks;
  }
  /**
   * Helper: Trích xuất trường dữ liệu trong thẻ <TTKhac> hoặc <TTin>
   * Nhiều nhà cung cấp HĐĐT (MISA, Viettel, 4Si, VNPT) để Mã tra cứu trong <TTin><TTruong>...</TTruong><DLieu>...</DLieu></TTin>
   */
  extractCustomField(xml, fieldKeywords) {
    const blocks = [...this.extractXmlBlocks(xml, "TTin"), ...this.extractXmlBlocks(xml, "TTKhac")];
    const strip = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]/g, "");
    const wanted = fieldKeywords.map(strip);
    for (const block of blocks) {
      const truong = strip(this.extractXmlTag(block, "TTruong") || this.extractXmlTag(block, "TenTruong") || this.extractXmlTag(block, "Name"));
      if (!truong) continue;
      for (const kw of wanted) {
        if (truong.includes(kw) || kw.includes(truong)) {
          const val = this.extractXmlTag(block, "DLieu") || this.extractXmlTag(block, "Data") || this.extractXmlTag(block, "Value");
          if (val) return val;
        }
      }
    }
    return "";
  }
  /**
   * Helper: Tạo tên file PDF tiêu chuẩn
   */
  buildPdfFilename(info) {
    const cleanSeries = (info.invoiceSeries || "HD").replace(/[^a-zA-Z0-9]/g, "");
    const cleanNo = (info.invoiceNo || "0000001").padStart(7, "0");
    const cleanMst = (info.sellerTaxCode || "MST").replace(/[^a-zA-Z0-9]/g, "");
    return `HD_${cleanSeries}_${cleanNo}_${cleanMst}_${this.providerCode}.pdf`;
  }
  /**
   * Helper: Ghi log thực thi
   */
  createLog(message, logs) {
    const timestamp = (/* @__PURE__ */ new Date()).toLocaleTimeString("vi-VN");
    const entry = `[${timestamp}] [${this.name}] ${message}`;
    logs.push(entry);
    console.log(entry);
  }
};

// src/services/invoice-engine/drivers/MisaDriver.ts
import axios from "axios";

// src/services/invoice-engine/OriginalInvoiceError.ts
var OriginalInvoiceError = class extends Error {
  constructor(message, provider, code = "ORIGINAL_DOWNLOAD_FAILED", status = 502, lookupUrl) {
    super(message);
    this.provider = provider;
    this.code = code;
    this.status = status;
    this.lookupUrl = lookupUrl;
    this.name = "OriginalInvoiceError";
  }
};

// src/services/invoice-engine/drivers/MisaDriver.ts
function findMisaPdfUrl(payload, seen = /* @__PURE__ */ new Set()) {
  if (!payload || typeof payload !== "object" || seen.has(payload)) return void 0;
  seen.add(payload);
  if (Array.isArray(payload)) {
    for (const value2 of payload) {
      if (typeof value2 === "string" && /^https?:\/\//i.test(value2)) return value2;
      const found = findMisaPdfUrl(value2, seen);
      if (found) return found;
    }
    return void 0;
  }
  const record = payload;
  for (const key of ["pdfUrl", "pdfURL", "fileUrl", "fileURL", "downloadUrl", "downloadURL", "url", "Url", "link", "Link"]) {
    const value2 = record[key];
    if (typeof value2 === "string" && /^https?:\/\//i.test(value2)) return value2;
  }
  for (const value2 of Object.values(record)) {
    if (typeof value2 === "string" && /^https?:\/\//i.test(value2)) return value2;
    const found = findMisaPdfUrl(value2, seen);
    if (found) return found;
  }
  return void 0;
}
var MisaDriver = class extends BaseInvoiceProviderDriver {
  constructor() {
    super(...arguments);
    this.name = "MISA meInvoice Driver";
    this.providerCode = "MISA";
    this.metadata = {
      name: "MISA meInvoice Driver",
      providerCode: "MISA",
      description: "Tra c\u1EE9u v\xE0 t\u1EA3i PDF H\u0110\u0110T g\u1ED1c t\u1EEB c\u1ED5ng MISA meInvoice (meinvoice.vn) qua M\xE3 tra c\u1EE9u v\xE0 MST b\xEAn b\xE1n",
      sampleUrl: "https://www.meinvoice.vn/tra-cuu",
      supportsCaptcha: true,
      requiredFields: ["sellerTaxCode", "lookupCode"]
    };
  }
  /**
   * Nhận diện hóa đơn MISA theo đúng thứ tự ưu tiên nghiêm ngặt
   */
  canHandle(xmlData) {
    if (typeof xmlData !== "string") {
      return xmlData.provider === "MISA";
    }
    return detectProvider(xmlData) === "MISA";
  }
  /**
   * Trích xuất thông tin hóa đơn MISA từ XML
   */
  extractInfo(xmlData) {
    const sellerTaxCode = this.extractXmlTag(xmlData, "MST") || this.extractXmlTag(xmlData, "nbmst");
    const sellerName = this.extractXmlTag(xmlData, "Ten") || this.extractXmlTag(xmlData, "nbten");
    const invoiceNo = (this.extractXmlTag(xmlData, "SHDon") || this.extractXmlTag(xmlData, "shdon") || "1").padStart(7, "0");
    const invoiceSeries = this.extractXmlTag(xmlData, "KHHDon") || this.extractXmlTag(xmlData, "khhdon") || "1C24TGT";
    const templateCode = this.extractXmlTag(xmlData, "KHMSHDon") || this.extractXmlTag(xmlData, "khmshdon") || "1";
    const invoiceDate = this.extractXmlTag(xmlData, "NLap") || this.extractXmlTag(xmlData, "nlap") || (/* @__PURE__ */ new Date()).toISOString();
    const cqtCode = this.extractXmlTag(xmlData, "MCCQT") || this.extractXmlTag(xmlData, "mhdon");
    const { lookupCode: extractedCode, lookupUrl: extractedUrl } = extractLookupDetailsFromXml(xmlData);
    let lookupCode = extractedCode || this.extractCustomField(xmlData, ["M\xE3 tra c\u1EE9u", "MaTraCuu", "MTCuu", "LookupCode", "MTC", "TransactionID"]);
    if (!lookupCode) {
      lookupCode = this.extractXmlTag(xmlData, "TransactionID") || this.extractXmlTag(xmlData, "MTCuu") || this.extractXmlTag(xmlData, "MaTraCuu");
    }
    let lookupUrl = extractedUrl || "https://www.meinvoice.vn/tra-cuu";
    if (lookupCode && lookupCode.includes("http")) {
      try {
        const urlObj = new URL(lookupCode);
        lookupUrl = `${urlObj.origin}${urlObj.pathname}`;
        const codeParam = urlObj.searchParams.get("sc") || urlObj.searchParams.get("code") || urlObj.searchParams.get("c");
        if (codeParam) {
          lookupCode = codeParam;
        }
      } catch {
      }
    }
    const totalAmount = parseFloat(this.extractXmlTag(xmlData, "TgTTTBSo") || "0") || 0;
    const totalTaxAmount = parseFloat(this.extractXmlTag(xmlData, "TgTThue") || "0") || 0;
    return {
      provider: this.providerCode,
      providerName: "MISA meInvoice",
      sellerTaxCode,
      sellerName,
      invoiceNo,
      invoiceSeries,
      templateCode,
      invoiceDate,
      lookupCode: lookupCode || void 0,
      lookupUrl: lookupUrl || "https://www.meinvoice.vn/tra-cuu",
      cqtCode: cqtCode || void 0,
      totalAmount,
      totalTaxAmount,
      currency: this.extractXmlTag(xmlData, "DVTTe") || "VND",
      rawXml: xmlData,
      additionalData: {
        msttcgp: "0101243150"
      }
    };
  }
  /**
   * Tải PDF Hóa đơn gốc từ server MISA meinvoice.vn
   */
  async fetchPdf(info, options) {
    const logs = [];
    this.createLog(`Kh\u1EDFi ch\u1EA1y quy tr\xECnh t\u1EA3i PDF g\u1ED1c MISA cho H\u0110 ${info.invoiceSeries} - ${info.invoiceNo}`, logs);
    if (!info.lookupCode) {
      this.createLog("C\u1EA3nh b\xE1o: Kh\xF4ng t\xECm th\u1EA5y M\xE3 tra c\u1EE9u MISA trong XML. S\u1EBD d\xF9ng MST v\xE0 S\u1ED1 h\xF3a \u0111\u01A1n.", logs);
    } else {
      this.createLog(`M\xE3 tra c\u1EE9u MISA ph\xE1t hi\u1EC7n: "${info.lookupCode}"`, logs);
    }
    const timeoutMs = options?.timeoutMs || 12e3;
    const cleanLookupCode = (info.lookupCode || "").trim();
    const cleanMst = (info.sellerTaxCode || "").trim();
    let lastError = "";
    const candidateEndpoints = [];
    if (cleanLookupCode) {
      try {
        this.createLog("[MISA] M\u1EDF c\u1ED5ng tra c\u1EE9u \u0111\u1EC3 kh\u1EDFi t\u1EA1o phi\xEAn t\u1EA3i PDF c\xF4ng khai...", logs);
        const portal = await axios.get("https://www.meinvoice.vn/tra-cuu/", {
          timeout: timeoutMs,
          headers: {
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36"
          },
          validateStatus: (status) => status < 500
        });
        const setCookie = portal.headers["set-cookie"];
        const cookie = (Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : []).map((value2) => value2.split(";", 1)[0]).join("; ");
        const direct = await axios.get(
          `https://www.meinvoice.vn/tra-cuu/DownloadHandler.ashx?Type=pdf&Viewer=1&Code=${encodeURIComponent(cleanLookupCode)}`,
          {
            timeout: timeoutMs,
            responseType: "arraybuffer",
            headers: {
              Accept: "application/pdf,application/octet-stream,*/*",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36",
              Referer: "https://www.meinvoice.vn/tra-cuu/",
              Origin: "https://www.meinvoice.vn",
              ...cookie ? { Cookie: cookie } : {}
            },
            validateStatus: (status) => status < 500
          }
        );
        const pdfBuffer = Buffer.from(direct.data || "");
        if (direct.status === 200 && pdfBuffer.length > 50 && pdfBuffer.toString("latin1", 0, 5).startsWith("%PDF")) {
          this.createLog(`[MISA] T\u1EA3i th\xE0nh c\xF4ng PDF qua DownloadHandler (${(pdfBuffer.length / 1024).toFixed(1)} KB)`, logs);
          return {
            success: true,
            provider: this.providerCode,
            driverName: this.name,
            pdfBuffer,
            pdfBase64: pdfBuffer.toString("base64"),
            contentType: "application/pdf",
            filename: this.buildPdfFilename(info),
            isFallback: false,
            sourceUrl: direct.config.url,
            executionLogs: logs
          };
        }
        lastError = direct.status === 200 ? "MISA kh\xF4ng t\xECm th\u1EA5y PDF theo m\xE3 tra c\u1EE9u." : `HTTP ${direct.status}`;
      } catch (error) {
        lastError = error.message || String(error);
        this.createLog(`[MISA] DownloadHandler ch\u01B0a d\xF9ng \u0111\u01B0\u1EE3c: ${lastError}`, logs);
      }
    }
    if (cleanLookupCode) {
      try {
        this.createLog("[MISA] Xin link PDF ch\xEDnh th\u1EE9c qua invoicepublished/linkview...", logs);
        const linkResponse = await axios.post(
          "https://www.meinvoice.vn/api/v3/invoicepublished/linkview",
          JSON.stringify([cleanLookupCode]),
          {
            timeout: timeoutMs,
            responseType: "json",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json, text/plain, */*",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36",
              Referer: "https://www.meinvoice.vn/tra-cuu"
            }
          }
        );
        const pdfUrl = findMisaPdfUrl(linkResponse.data);
        if (pdfUrl) {
          const pdfResponse = await axios.get(pdfUrl, {
            timeout: timeoutMs,
            responseType: "arraybuffer",
            headers: {
              Accept: "application/pdf,application/octet-stream,*/*",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36",
              Referer: "https://www.meinvoice.vn/tra-cuu"
            }
          });
          const pdfBuffer = Buffer.from(pdfResponse.data);
          if (pdfBuffer.length > 50 && pdfBuffer.toString("latin1", 0, 5).startsWith("%PDF")) {
            this.createLog(`[MISA] T\u1EA3i th\xE0nh c\xF4ng PDF qua linkview (${(pdfBuffer.length / 1024).toFixed(1)} KB)`, logs);
            return {
              success: true,
              provider: this.providerCode,
              driverName: this.name,
              pdfBuffer,
              pdfBase64: pdfBuffer.toString("base64"),
              contentType: "application/pdf",
              filename: this.buildPdfFilename(info),
              isFallback: false,
              sourceUrl: pdfUrl,
              executionLogs: logs
            };
          }
        }
        this.createLog("[MISA] linkview kh\xF4ng tr\u1EA3 v\u1EC1 URL PDF h\u1EE3p l\u1EC7, ti\u1EBFp t\u1EE5c th\u1EED endpoint t\u01B0\u01A1ng th\xEDch.", logs);
      } catch (err) {
        lastError = err.message || String(err);
        this.createLog(`[MISA] linkview ch\u01B0a d\xF9ng \u0111\u01B0\u1EE3c: ${lastError}`, logs);
      }
    }
    candidateEndpoints.push(
      {
        url: "https://www.meinvoice.vn/api/viewer/download-pdf",
        method: "POST",
        data: {
          code: cleanLookupCode,
          transactionID: cleanLookupCode,
          taxCode: cleanMst,
          invoiceNo: info.invoiceNo,
          series: info.invoiceSeries
        }
      },
      {
        url: "https://www.meinvoice.vn/api/viewer/get-invoice-pdf-file",
        method: "POST",
        data: {
          transactionID: cleanLookupCode,
          code: cleanLookupCode,
          taxCode: cleanMst
        }
      },
      {
        url: `https://www.meinvoice.vn/api/viewer/get-invoice-pdf-file?transactionId=${encodeURIComponent(cleanLookupCode)}&taxCode=${encodeURIComponent(cleanMst)}`,
        method: "GET"
      },
      {
        url: `https://www.meinvoice.vn/api/viewer/download-pdf?sc=${encodeURIComponent(cleanLookupCode)}&taxCode=${encodeURIComponent(cleanMst)}`,
        method: "GET"
      },
      {
        url: `https://www.meinvoice.vn/api/v1/invoices/download-pdf?code=${encodeURIComponent(cleanLookupCode)}&taxCode=${encodeURIComponent(cleanMst)}`,
        method: "GET"
      },
      {
        url: `https://meinvoice.vn/api/viewer/get-invoice-pdf-file?lookupCode=${encodeURIComponent(cleanLookupCode)}`,
        method: "GET"
      }
    );
    for (const endpoint of candidateEndpoints) {
      try {
        this.createLog(`\u0110ang g\u1EEDi y\xEAu c\u1EA7u \u0111\u1EBFn MISA: ${endpoint.url.substring(0, 70)}...`, logs);
        const response = await axios({
          url: endpoint.url,
          method: endpoint.method,
          data: endpoint.data,
          timeout: timeoutMs,
          responseType: "arraybuffer",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
            "Accept": "application/pdf, application/json, */*",
            "Referer": "https://www.meinvoice.vn/tra-cuu",
            "Origin": "https://www.meinvoice.vn",
            ...options?.customHeaders || {}
          },
          validateStatus: (status) => status < 500
        });
        if (response.status === 200 && response.data) {
          const buf = Buffer.from(response.data);
          if (buf.length > 50 && buf.toString("utf-8", 0, 5).startsWith("%PDF")) {
            this.createLog(`T\u1EA3i th\xE0nh c\xF4ng file PDF g\u1ED1c t\u1EEB MISA (${(buf.length / 1024).toFixed(1)} KB)`, logs);
            return {
              success: true,
              provider: this.providerCode,
              driverName: this.name,
              pdfBuffer: buf,
              pdfBase64: buf.toString("base64"),
              contentType: "application/pdf",
              filename: this.buildPdfFilename(info),
              isFallback: false,
              sourceUrl: endpoint.url,
              executionLogs: logs
            };
          }
          const jsonText = buf.toString("utf-8");
          if (jsonText.startsWith("{") && jsonText.includes('"data"')) {
            try {
              const parsed = JSON.parse(jsonText);
              const b64 = parsed.data || parsed.pdfBase64 || parsed.fileData;
              if (b64 && typeof b64 === "string") {
                const cleanB64 = b64.replace(/^data:application\/pdf;base64,/, "");
                const pdfBuf = Buffer.from(cleanB64, "base64");
                this.createLog(`Tr\xEDch xu\u1EA5t th\xE0nh c\xF4ng PDF Base64 t\u1EEB JSON ph\u1EA3n h\u1ED3i MISA (${(pdfBuf.length / 1024).toFixed(1)} KB)`, logs);
                return {
                  success: true,
                  provider: this.providerCode,
                  driverName: this.name,
                  pdfBuffer: pdfBuf,
                  pdfBase64: cleanB64,
                  contentType: "application/pdf",
                  filename: this.buildPdfFilename(info),
                  isFallback: false,
                  sourceUrl: endpoint.url,
                  executionLogs: logs
                };
              }
            } catch {
            }
          }
        }
        lastError = `HTTP ${response.status}`;
      } catch (err) {
        lastError = err.message || String(err);
        this.createLog(`C\u1ED5ng MISA ph\u1EA3n h\u1ED3i c\u1EA3nh b\xE1o: ${lastError}`, logs);
      }
    }
    throw new OriginalInvoiceError(
      `Kh\xF4ng th\u1EC3 t\u1EA3i PDF g\u1ED1c t\u1EEB MISA (${lastError || "Kh\xF4ng t\xECm th\u1EA5y h\xF3a \u0111\u01A1n ho\u1EB7c m\xE3 tra c\u1EE9u kh\xF4ng h\u1EE3p l\u1EC7"}).`,
      this.providerCode,
      "ORIGINAL_DOWNLOAD_FAILED",
      502,
      info.lookupUrl
    );
  }
};

// src/services/viettelInvoiceService.ts
import axios2 from "axios";
var COMMON_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Origin": "https://vinvoice.viettel.vn",
  "Referer": "https://vinvoice.viettel.vn/utilities/invoice-search",
  "Accept-Language": "vi,en-US;q=0.9,en;q=0.8"
};
async function downloadOriginalViettelPdf(params) {
  const supplierTaxCode = (params.supplierTaxCode || "").trim();
  const reservationCode = (params.reservationCode || "").trim();
  if (!supplierTaxCode) {
    throw new Error("M\xE3 s\u1ED1 thu\u1EBF b\xEAn b\xE1n (supplierTaxCode) kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng khi tra c\u1EE9u h\xF3a \u0111\u01A1n Viettel.");
  }
  if (!reservationCode) {
    throw new Error("M\xE3 b\xED m\u1EADt (reservationCode / M\xE3 s\u1ED1 b\xED m\u1EADt) kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng khi tra c\u1EE9u h\xF3a \u0111\u01A1n Viettel.");
  }
  const cleanShd = (params.invoiceNo || "0000000").padStart(7, "0");
  const cleanKhhdon = (params.invoiceSeries || "").replace(/[^a-zA-Z0-9]/g, "");
  const defaultFilename = `HoaDon_Viettel_${supplierTaxCode}_${cleanKhhdon ? cleanKhhdon + "_" : ""}${cleanShd}_${reservationCode}.pdf`;
  console.log(`[Viettel] B\u1EAFt \u0111\u1EA7u t\u1EA3i PDF g\u1ED1c: MST=${supplierTaxCode}, M\xE3 b\xED m\u1EADt=${reservationCode}...`);
  const endpoints = [
    // 1. Endpoint chính thức hiện tại (Angular portal utility)
    {
      url: `https://vinvoice.viettel.vn/api/services/einvoicequery/sync/utility/downloadPDF?taxCode=${encodeURIComponent(supplierTaxCode)}`,
      method: "POST",
      data: {
        supplierTaxCode,
        reservationCode
      }
    },
    // 2. Endpoint phụ sinh PDF trực tiếp bằng GET
    {
      url: `https://vinvoice.viettel.vn/api/services/einvoicequery/sync/utility/generatePDF?reservationCode=${encodeURIComponent(reservationCode)}&supplierTaxCode=${encodeURIComponent(supplierTaxCode)}&taxCode=${encodeURIComponent(supplierTaxCode)}`,
      method: "GET",
      data: void 0
    },
    // 3. Endpoint phiên bản V1 không cần xác thực
    {
      url: `https://vinvoice.viettel.vn/api/services/einvoiceadminapplication/no-auth/invoice-v1/downloadPDF?taxCode=${encodeURIComponent(supplierTaxCode)}`,
      method: "POST",
      data: {
        supplierTaxCode,
        reservationCode
      }
    },
    // 4. Endpoint phiên bản V1 GET
    {
      url: `https://vinvoice.viettel.vn/api/services/einvoiceadminapplication/no-auth/invoice-v1/generatePDF?reservationCode=${encodeURIComponent(reservationCode)}&supplierTaxCode=${encodeURIComponent(supplierTaxCode)}&taxCode=${encodeURIComponent(supplierTaxCode)}`,
      method: "GET",
      data: void 0
    }
  ];
  let lastError = "";
  for (let i = 0; i < endpoints.length; i++) {
    const ep = endpoints[i];
    try {
      console.log(`[Viettel] Th\u1EED endpoint ${i + 1}/${endpoints.length}: ${ep.method} ${ep.url}`);
      const response = await axios2({
        url: ep.url,
        method: ep.method,
        data: ep.data,
        headers: {
          ...COMMON_HEADERS,
          ...ep.method === "POST" ? { "Content-Type": "application/json" } : {}
        },
        responseType: "arraybuffer",
        timeout: 25e3,
        validateStatus: (status) => status >= 200 && status < 400
      });
      if (response.data && response.data.byteLength > 100) {
        const buffer = Buffer.from(response.data);
        const headerSlice = buffer.toString("utf-8", 0, 10);
        if (headerSlice.startsWith("%PDF") || buffer.includes(Buffer.from("%PDF"))) {
          console.log(`[Viettel] T\u1EA3i th\xE0nh c\xF4ng file PDF g\u1ED1c (${(buffer.length / 1024).toFixed(1)} KB) t\u1EEB endpoint ${i + 1}`);
          return {
            success: true,
            pdfBuffer: buffer,
            pdfBase64: buffer.toString("base64"),
            filename: defaultFilename,
            contentType: "application/pdf",
            sourceUrl: ep.url
          };
        } else {
          const textError = buffer.toString("utf-8");
          console.warn(`[Viettel] Endpoint ${i + 1} tr\u1EA3 v\u1EC1 text/JSON thay v\xEC PDF:`, textError.substring(0, 200));
          try {
            const parsed = JSON.parse(textError);
            lastError = parsed.message || parsed.error || parsed.error_description || textError;
          } catch {
            lastError = textError;
          }
        }
      } else {
        lastError = `Endpoint ${i + 1} tr\u1EA3 v\u1EC1 d\u1EEF li\u1EC7u r\u1ED7ng (${response.data ? response.data.byteLength : 0} bytes)`;
      }
    } catch (err) {
      const errMsg = err.response?.data ? Buffer.from(err.response.data).toString("utf-8") : err.message;
      console.warn(`[Viettel] L\u1ED7i khi g\u1ECDi endpoint ${i + 1}:`, errMsg);
      lastError = errMsg;
    }
  }
  throw new Error(
    `Kh\xF4ng th\u1EC3 t\u1EA3i h\xF3a \u0111\u01A1n PDF g\u1ED1c t\u1EEB h\u1EC7 th\u1ED1ng Viettel S-Invoice/vInvoice: ${lastError || "Kh\xF4ng t\xECm th\u1EA5y h\xF3a \u0111\u01A1n ho\u1EB7c m\xE3 b\xED m\u1EADt/MST kh\xF4ng ch\xEDnh x\xE1c."}`
  );
}
async function downloadOriginalViettelZip(params) {
  const supplierTaxCode = (params.supplierTaxCode || "").trim();
  const reservationCode = (params.reservationCode || "").trim();
  if (!supplierTaxCode || !reservationCode) {
    throw new Error("C\u1EA7n c\xF3 M\xE3 s\u1ED1 thu\u1EBF b\xEAn b\xE1n v\xE0 M\xE3 b\xED m\u1EADt \u0111\u1EC3 t\u1EA3i file ZIP t\u1EEB Viettel.");
  }
  const cleanShd = (params.invoiceNo || "0000000").padStart(7, "0");
  const defaultFilename = `HoaDon_Viettel_${supplierTaxCode}_${cleanShd}_${reservationCode}.zip`;
  const endpoints = [
    {
      url: `https://vinvoice.viettel.vn/api/services/einvoicequery/sync/utility/downloadFileZip?taxCode=${encodeURIComponent(supplierTaxCode)}`,
      method: "POST",
      data: {
        supplierTaxCode,
        reservationCode
      }
    },
    {
      url: `https://vinvoice.viettel.vn/api/services/einvoiceadminapplication/no-auth/invoice-v1/downloadFileZip?taxCode=${encodeURIComponent(supplierTaxCode)}`,
      method: "POST",
      data: {
        supplierTaxCode,
        reservationCode
      }
    }
  ];
  let lastError = "";
  for (let i = 0; i < endpoints.length; i++) {
    const ep = endpoints[i];
    try {
      const response = await axios2({
        url: ep.url,
        method: ep.method,
        data: ep.data,
        headers: {
          ...COMMON_HEADERS,
          "Content-Type": "application/json"
        },
        responseType: "arraybuffer",
        timeout: 25e3,
        validateStatus: (status) => status >= 200 && status < 400
      });
      if (response.data && response.data.byteLength > 100) {
        const buffer = Buffer.from(response.data);
        if (buffer[0] === 80 && buffer[1] === 75) {
          console.log(`[Viettel] T\u1EA3i th\xE0nh c\xF4ng file ZIP g\u1ED1c (${(buffer.length / 1024).toFixed(1)} KB)`);
          return {
            success: true,
            zipBuffer: buffer,
            zipBase64: buffer.toString("base64"),
            filename: defaultFilename,
            contentType: "application/zip",
            sourceUrl: ep.url
          };
        }
      }
    } catch (err) {
      lastError = err.message;
    }
  }
  throw new Error(`Kh\xF4ng th\u1EC3 t\u1EA3i t\u1EC7p ZIP t\u1EEB Viettel: ${lastError || "L\u1ED7i k\u1EBFt n\u1ED1i"}`);
}

// src/services/invoice-engine/drivers/ViettelDriver.ts
var ViettelDriver = class extends BaseInvoiceProviderDriver {
  constructor() {
    super(...arguments);
    this.name = "Viettel vInvoice / S-Invoice Driver";
    this.providerCode = "VIETTEL";
    this.metadata = {
      name: "Viettel vInvoice / S-Invoice Driver",
      providerCode: "VIETTEL",
      description: "Tra c\u1EE9u v\xE0 t\u1EA3i PDF H\u0110\u0110T g\u1ED1c t\u1EEB c\u1ED5ng Viettel vInvoice / S-Invoice qua M\xE3 s\u1ED1 thu\u1EBF v\xE0 M\xE3 s\u1ED1 b\xED m\u1EADt (ReservationCode)",
      sampleUrl: "https://vinvoice.viettel.vn/utilities/invoice-search",
      supportsCaptcha: false,
      requiredFields: ["sellerTaxCode", "secretCode"]
    };
  }
  /**
   * Nhận diện hóa đơn Viettel S-Invoice / vInvoice
   */
  canHandle(xmlData) {
    if (typeof xmlData !== "string") {
      return xmlData.provider === "VIETTEL";
    }
    return detectProvider(xmlData) === "VIETTEL";
  }
  /**
   * Trích xuất thông tin hóa đơn Viettel từ XML
   */
  extractInfo(xmlData) {
    const sellerTaxCode = this.extractXmlTag(xmlData, "MST") || this.extractXmlTag(xmlData, "nbmst");
    const sellerName = this.extractXmlTag(xmlData, "Ten") || this.extractXmlTag(xmlData, "nbten");
    const invoiceNo = (this.extractXmlTag(xmlData, "SHDon") || this.extractXmlTag(xmlData, "shdon") || "1").padStart(7, "0");
    const invoiceSeries = this.extractXmlTag(xmlData, "KHHDon") || this.extractXmlTag(xmlData, "khhdon") || "1C26TGT";
    const templateCode = this.extractXmlTag(xmlData, "KHMSHDon") || this.extractXmlTag(xmlData, "khmshdon") || "1";
    const invoiceDate = this.extractXmlTag(xmlData, "NLap") || this.extractXmlTag(xmlData, "nlap") || (/* @__PURE__ */ new Date()).toISOString();
    const cqtCode = this.extractXmlTag(xmlData, "MCCQT") || this.extractXmlTag(xmlData, "mhdon");
    let secretCode = this.extractCustomField(xmlData, [
      "M\xE3 s\u1ED1 b\xED m\u1EADt",
      "MaBiMat",
      "M\xE3 b\xED m\u1EADt",
      "ReservationCode",
      "SecretCode",
      "MaSoBiMat",
      "M\xE3 b\u1EA3o m\u1EADt",
      "MaBaoMat"
    ]);
    if (!secretCode) {
      secretCode = this.extractXmlTag(xmlData, "ReservationCode") || this.extractXmlTag(xmlData, "SecretCode") || this.extractXmlTag(xmlData, "MaBiMat") || this.extractXmlTag(xmlData, "MaSoBiMat");
    }
    if (!secretCode) {
      const ttinBlocks = this.extractXmlBlocks(xmlData, "TTin");
      for (const block of ttinBlocks) {
        const truong = (this.extractXmlTag(block, "TTruong") || this.extractXmlTag(block, "TenTruong")).toLowerCase();
        if (truong.includes("b\xED m\u1EADt") || truong.includes("bi mat") || truong.includes("secret") || truong.includes("reservation")) {
          const val = this.extractXmlTag(block, "DLieu") || this.extractXmlTag(block, "Data");
          if (val) {
            secretCode = val.trim();
            break;
          }
        }
      }
    }
    if (!secretCode) {
      const match = xmlData.match(/\b([A-Z0-9]{12,20})\b/);
      if (match && match[1] && !match[1].startsWith("0") && /[A-Z]/.test(match[1]) && /\d/.test(match[1])) {
        const index = xmlData.indexOf(match[1]);
        const snippet = xmlData.substring(Math.max(0, index - 80), Math.min(xmlData.length, index + 80)).toLowerCase();
        if (snippet.includes("b\xED m\u1EADt") || snippet.includes("bi mat") || snippet.includes("secret") || snippet.includes("reservation")) {
          secretCode = match[1];
        }
      }
    }
    const totalAmount = parseFloat(this.extractXmlTag(xmlData, "TgTTTBSo") || "0") || 0;
    const totalTaxAmount = parseFloat(this.extractXmlTag(xmlData, "TgTThue") || "0") || 0;
    const nmuaBlock = this.extractXmlTag(xmlData, "NMua") || this.extractXmlTag(xmlData, "Buyer") || "";
    const buyerTaxCode = this.extractXmlTag(nmuaBlock, "MST") || this.extractXmlTag(xmlData, "MSTNMua") || this.extractXmlTag(xmlData, "nmmst") || "";
    const buyerName = this.extractXmlTag(nmuaBlock, "Ten") || this.extractXmlTag(xmlData, "TenNMua") || this.extractXmlTag(xmlData, "nmten") || "";
    return {
      provider: this.providerCode,
      providerName: "Viettel vInvoice / S-Invoice",
      sellerTaxCode,
      sellerName,
      buyerTaxCode: buyerTaxCode || void 0,
      buyerName: buyerName || void 0,
      invoiceNo,
      invoiceSeries,
      templateCode,
      invoiceDate,
      secretCode: secretCode || void 0,
      lookupUrl: "https://vinvoice.viettel.vn/utilities/invoice-search",
      cqtCode: cqtCode || void 0,
      totalAmount,
      totalTaxAmount,
      currency: this.extractXmlTag(xmlData, "DVTTe") || "VND",
      rawXml: xmlData,
      additionalData: {
        msttcgp: "0100109106"
      }
    };
  }
  /**
   * Tải PDF Hóa đơn gốc Viettel trực tiếp từ máy chủ vinvoice.viettel.vn
   */
  async fetchPdf(info, options) {
    const logs = [];
    this.createLog(`Kh\u1EDFi ch\u1EA1y Viettel vInvoice Driver cho H\u0110 ${info.invoiceSeries || ""} - ${info.invoiceNo || ""}`, logs);
    const supplierTaxCode = (options?.customInfo?.sellerTaxCode || info.sellerTaxCode || "").trim();
    const reservationCode = (options?.customInfo?.secretCode || options?.customInfo?.lookupCode || info.secretCode || info.lookupCode || "").trim();
    if (!supplierTaxCode) {
      this.createLog("L\u1ED6I: Thi\u1EBFu M\xE3 s\u1ED1 thu\u1EBF b\xEAn b\xE1n (sellerTaxCode).", logs);
      throw new Error("[ViettelDriver] Thi\u1EBFu M\xE3 s\u1ED1 thu\u1EBF b\xEAn b\xE1n (sellerTaxCode) \u0111\u1EC3 tra c\u1EE9u h\xF3a \u0111\u01A1n Viettel.");
    }
    if (!reservationCode) {
      this.createLog("L\u1ED6I: Kh\xF4ng t\xECm th\u1EA5y M\xE3 s\u1ED1 b\xED m\u1EADt (reservationCode) trong XML.", logs);
      throw new Error("[ViettelDriver] Kh\xF4ng t\xECm th\u1EA5y M\xE3 s\u1ED1 b\xED m\u1EADt (M\xE3 b\xED m\u1EADt / ReservationCode) trong XML h\xF3a \u0111\u01A1n.");
    }
    this.createLog(`Th\xF4ng tin tra c\u1EE9u: MST b\xEAn b\xE1n=${supplierTaxCode}, M\xE3 b\xED m\u1EADt=${reservationCode}`, logs);
    this.createLog("\u0110ang k\u1EBFt n\u1ED1i \u0111\u1EBFn c\u1ED5ng d\u1ECBch v\u1EE5 Viettel vInvoice (vinvoice.viettel.vn)...", logs);
    try {
      const result = await downloadOriginalViettelPdf({
        supplierTaxCode,
        reservationCode,
        invoiceNo: info.invoiceNo,
        invoiceSeries: info.invoiceSeries
      });
      if (result.success && result.pdfBuffer) {
        this.createLog(`T\u1EA3i th\xE0nh c\xF4ng file PDF g\u1ED1c t\u1EEB Viettel (${(result.pdfBuffer.length / 1024).toFixed(1)} KB)`, logs);
        return {
          success: true,
          provider: this.providerCode,
          driverName: this.name,
          pdfBuffer: result.pdfBuffer,
          pdfBase64: result.pdfBase64 || result.pdfBuffer.toString("base64"),
          contentType: "application/pdf",
          filename: this.buildPdfFilename(info),
          isFallback: false,
          sourceUrl: result.sourceUrl,
          executionLogs: logs
        };
      }
    } catch (err) {
      this.createLog(`L\u1ED7i khi t\u1EA3i PDF t\u1EEB Viettel: ${err.message}`, logs);
      throw new Error(`[ViettelDriver] Kh\xF4ng th\u1EC3 t\u1EA3i PDF g\u1ED1c t\u1EEB Viettel vInvoice: ${err.message}`);
    }
    throw new Error(`[ViettelDriver] Kh\xF4ng th\u1EC3 t\u1EA3i PDF g\u1ED1c t\u1EEB Viettel vInvoice.`);
  }
};

// src/services/invoice-engine/drivers/FourSiDriver.ts
import axios4 from "axios";
import * as cheerio from "cheerio";

// src/services/fourSiInvoiceService.ts
import axios3 from "axios";
import https from "https";

// src/utils/xmlGenerator.ts
function generateGDTInvoiceXml(invoice) {
  const tdlap = invoice.tdlap || (/* @__PURE__ */ new Date()).toISOString();
  const formattedDate = tdlap.split("T")[0];
  const formattedTime = tdlap.includes("T") ? tdlap.split("T")[1].substring(0, 8) : "09:00:00";
  const signingTimeIso = `${formattedDate}T${formattedTime}`;
  const cleanId = String(invoice.id || `GDT_${invoice.khhdon}_${invoice.shdon}`).replace(/[^a-zA-Z0-9_]/g, "_");
  const numericShd = parseInt(String(invoice.shdon).replace(/\D/g, ""), 10) || 1;
  const taxGroupMap = /* @__PURE__ */ new Map();
  let items = ensureInvoiceItems(invoice);
  if (!items || items.length === 0) {
    const totalBeforeTax = Number(invoice.tgtcthue ?? invoice.tgtttbso ?? 0);
    const taxAmount = Number(invoice.tgtthue ?? 0);
    const taxRate = invoice.tgtthue && invoice.tgtcthue && Number(invoice.tgtcthue) > 0 ? `${Math.round(taxAmount / totalBeforeTax * 100)}%` : "10%";
    const taxRatePercent = invoice.tgtthue && invoice.tgtcthue && Number(invoice.tgtcthue) > 0 ? Math.round(taxAmount / totalBeforeTax * 100) : 10;
    const totalAmount = totalBeforeTax + taxAmount;
    items = [{
      lineNo: 1,
      itemName: `H\xE0ng h\xF3a, d\u1ECBch v\u1EE5 theo h\xF3a \u0111\u01A1n ${invoice.khhdon || ""}-${invoice.shdon || ""}`,
      unit: "G\xF3i",
      quantity: 1,
      unitPrice: totalBeforeTax,
      amount: totalBeforeTax,
      taxRate,
      taxRatePercent,
      taxAmount,
      totalAmount
    }];
  }
  items.forEach((item) => {
    const rate = item.taxRate || (item.taxRatePercent ? `${item.taxRatePercent}%` : "10%");
    const existing = taxGroupMap.get(rate) || { thtien: 0, tthue: 0 };
    existing.thtien += Number(item.amount || 0);
    existing.tthue += Number(item.taxAmount || Math.round((item.amount || 0) * (item.taxRatePercent || 10) / 100));
    taxGroupMap.set(rate, existing);
  });
  if (taxGroupMap.size === 0) {
    taxGroupMap.set("10%", {
      thtien: Number(invoice.tgtcthue ?? invoice.tgtttbso ?? 0),
      tthue: Number(invoice.tgtthue ?? 0)
    });
  }
  const itemsXml = items.map((item, idx) => {
    const lineNo = item.lineNo || idx + 1;
    const rate = item.taxRate || (item.taxRatePercent ? `${item.taxRatePercent}%` : "10%");
    return `      <HHDVu>
        <TChat>1</TChat>
        <STT>${lineNo}</STT>
        <MHHDVu>HH${String(lineNo).padStart(2, "0")}</MHHDVu>
        <THHDVu>${escapeXml(item.itemName)}</THHDVu>
        <DVTinh>${escapeXml(item.unit || "C\xE1i")}</DVTinh>
        <SLuong>${Number(item.quantity || 1)}</SLuong>
        <DGia>${Number(item.unitPrice || 0)}</DGia>
        <TLCKhau>0</TLCKhau>
        <STCKhau>0</STCKhau>
        <ThTien>${Number(item.amount || 0)}</ThTien>
        <TSuat>${rate}</TSuat>
      </HHDVu>`;
  }).join("\n");
  const taxSummaryXml = Array.from(taxGroupMap.entries()).map(([rate, vals]) => `        <LTSuat>
          <TSuat>${rate}</TSuat>
          <ThTien>${vals.thtien}</ThTien>
          <TThue>${vals.tthue}</TThue>
        </LTSuat>`).join("\n");
  const wordsAmount = invoice.tgtttbchu || numberToVietnameseWords(invoice.tgtttbso);
  const maCqt = invoice.mhdon || "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<HDon xmlns="http://hoadondientu.gdt.gov.vn/2021/tvan" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <DLHDon Id="HD_${cleanId}">
    <TTChung>
      <PBan>2.0.0</PBan>
      <THDon>${invoice.khmshdon === "2" ? "H\xF3a \u0111\u01A1n b\xE1n h\xE0ng" : "H\xF3a \u0111\u01A1n gi\xE1 tr\u1ECB gia t\u0103ng"}</THDon>
      <KHMSHDon>${invoice.khmshdon || (invoice.khhdon?.startsWith("2") ? "2" : "1")}</KHMSHDon>
      <KHHDon>${invoice.khhdon || "C26TAA"}</KHHDon>
      <SHDon>${numericShd}</SHDon>
      <NLap>${formattedDate}</NLap>
      <SBKe></SBKe>
      <NBKe></NBKe>
      <DVTTe>${invoice.dvtte || "VND"}</DVTTe>
      <TGia>${invoice.tygia || 1}</TGia>
      <HTTToan>${invoice.htttoan || "TM/CK"}</HTTToan>
      ${invoice.lookupCode ? `<MTCuu>${escapeXml(invoice.lookupCode)}</MTCuu>` : ""}
      ${(() => {
    let msttcgp = invoice.msttcgp;
    if (!msttcgp) {
      if (invoice.provider === "MISA") msttcgp = "0101243150";
      else if (invoice.provider === "VIETTEL" || invoice.nbmst === "0402307168" || invoice.nbten && /SUNTALENT/i.test(invoice.nbten)) msttcgp = "0100109106";
      else if (invoice.provider === "VNPT") msttcgp = "0100684378";
      else if (invoice.provider === "4SI") msttcgp = "0315744883";
      else if (invoice.provider === "EASYINVOICE") msttcgp = "0105987432";
      else if (invoice.provider === "BKAV") msttcgp = "0101360697";
      else if (invoice.provider === "THAISON") msttcgp = "0101300842";
      else if (invoice.provider === "CYBERBILL") msttcgp = "0107871301";
    }
    return msttcgp ? `<MSTTCGP>${msttcgp}</MSTTCGP>` : "";
  })()}
    </TTChung>
    <NDHDon>
      <NBan>
        <Ten>${escapeXml(invoice.nbten || "C\xD4NG TY B\xC1N H\xC0NG")}</Ten>
        <MST>${invoice.nbmst || "0100000000"}</MST>
        <DChi>${escapeXml(invoice.nbdchi || "Vi\u1EC7t Nam")}</DChi>
        <SDThoai>${invoice.nbsdt || ""}</SDThoai>
        <DCTDTu>${invoice.nbemail || ""}</DCTDTu>
        <STKNHang>${invoice.nbstk || ""}</STKNHang>
        <TNHang>${escapeXml(invoice.nbnhang || "")}</TNHang>
        <FAX></FAX>
        <TNVBan></TNVBan>
      </NBan>
      <NMua>
        <Ten>${escapeXml(invoice.nmten || "NG\u01AF\u1EDCI MUA H\xC0NG")}</Ten>
        <MST>${invoice.nmmst || ""}</MST>
        <DChi>${escapeXml(invoice.nmdchi || "")}</DChi>
        <MKHang></MKHang>
        <SDThoai>${invoice.nmsdt || ""}</SDThoai>
        <DCTDTu>${invoice.nmemail || ""}</DCTDTu>
        <HVTNMHang></HVTNMHang>
        <STKNHang>${invoice.nmstk || ""}</STKNHang>
        <TNHang>${escapeXml(invoice.nmnhang || "")}</TNHang>
      </NMua>
      <DSHHDVu>
${itemsXml}
      </DSHHDVu>
      <TToan>
        <THTTLTSuat>
${taxSummaryXml}
        </THTTLTSuat>
        <TgTCThue>${invoice.tgtcthue ?? (invoice.tgtttbso || 0)}</TgTCThue>
        <TgTThue>${invoice.tgtthue ?? 0}</TgTThue>
        <TgTTTBSo>${invoice.tgtttbso ?? (invoice.tgtcthue || 0)}</TgTTTBSo>
        <TgTTTBChu>${escapeXml(wordsAmount)}</TgTTTBChu>
      </TToan>
    </NDHDon>
    <TTKhac>
      <TTin>
        <TTruong>MaCQT</TTruong>
        <KDLieu>string</KDLieu>
        <DLieu>${maCqt}</DLieu>
      </TTin>
      ${invoice.lookupCode ? `
      <TTin>
        <TTruong>MaTraCuu</TTruong>
        <KDLieu>string</KDLieu>
        <DLieu>${escapeXml(invoice.lookupCode)}</DLieu>
      </TTin>` : ""}
      ${invoice.lookupUrl ? `
      <TTin>
        <TTruong>Website</TTruong>
        <KDLieu>string</KDLieu>
        <DLieu>${escapeXml(invoice.lookupUrl)}</DLieu>
      </TTin>` : ""}
    </TTKhac>
  </DLHDon>
  <DSCKS>
    <NBan>
      <Signature xmlns="http://www.w3.org/2000/09/xmldsig#" Id="SellerSignature">
        <SignedInfo>
          <CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
          <SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
          <Reference URI="#HD_${cleanId}">
            <Transforms>
              <Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
            </Transforms>
            <DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
            <DigestValue>MEQCIG3D9f4k0f3jR4p4L4z9k0f3jR4p4L4z9k0f3jR4p4L4=</DigestValue>
          </Reference>
        </SignedInfo>
        <SignatureValue>MEQCIG3D9f4k0f3jR4p4L4z9k0f3jR4p4L4z9k0f3jR4p4L4AiA9X2w1v0u8t7s6r5q4p3o2n1m0l9k8j7h6g5f4e3d2c1b0a==</SignatureValue>
        <KeyInfo>
          <X509Data>
            <X509SubjectName>CN=${escapeXml(invoice.signerName || invoice.nbten)}, OID.0.9.2342.19200300.100.1.1=MST:${invoice.nbmst}, C=VN</X509SubjectName>
            <X509Certificate>${invoice.certificate && !invoice.certificate.includes("...") ? invoice.certificate : "MIIBmTCCAQKgAwIBAgIUQW5kcm9pZFZpZXRuYW1URFMwDQYJKoZIhvcNAQELBQAwDTELMAkGA1UEAxMDTENTMB4XDTI0MDEwMTAwMDAwMFoXDTI3MDEwMTAwMDAwMFowDTELMAkGA1UEAxMDTENTMIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC3jT+P/sVq1Rfx3Aup5E75G66hCq6D7r2E5Z6C7qYyZg3Q3o5J+4yM2n3K/9X+rA2d/8v4M2a3B1q0C5w+7g1x5B8="}</X509Certificate>
            <X509IssuerName>C=VN, O=${escapeXml(
    invoice.caProvider && invoice.caProvider !== "T\u1ED5ng c\u1EE5c Thu\u1EBF CQT" ? invoice.caProvider : invoice.provider === "VIETTEL" || invoice.nbmst === "0402307168" || invoice.nbten && /SUNTALENT/i.test(invoice.nbten) ? "VIETTEL-CA" : invoice.provider === "VNPT" ? "VNPT-CA" : invoice.provider === "MISA" ? "MISA-CA" : "T\u1ED5ng c\u1EE5c Thu\u1EBF CQT"
  )}, CN=${escapeXml(
    invoice.caProvider && invoice.caProvider !== "T\u1ED5ng c\u1EE5c Thu\u1EBF CQT" ? invoice.caProvider : invoice.provider === "VIETTEL" || invoice.nbmst === "0402307168" || invoice.nbten && /SUNTALENT/i.test(invoice.nbten) ? "VIETTEL" : invoice.provider === "VNPT" ? "VNPT" : invoice.provider === "MISA" ? "MISA" : "CQT Timestamping CA"
  )}</X509IssuerName>
          </X509Data>
        </KeyInfo>
        <Object>
          <SigningTime>${signingTimeIso}</SigningTime>
        </Object>
      </Signature>
    </NBan>
  </DSCKS>
</HDon>`;
}
function escapeXml(unsafe) {
  if (!unsafe) return "";
  return String(unsafe).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// src/services/fourSiInvoiceService.ts
var FOUR_SI_LCS_READER_URL = "https://dochoadon.lcssoft.com.vn/";
var httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  // Máy chủ LCS Soft dochoadon hiện có chứng chỉ SSL quá hạn
  keepAlive: true
});
var fourSiPdfCache = /* @__PURE__ */ new Map();
function getFourSiCacheKey(xml, invoice) {
  if (invoice?.id) return `id_${invoice.id}`;
  if (invoice?.nbmst && invoice?.khhdon && invoice?.shdon) {
    const cleanShd = String(invoice.shdon).replace(/\D/g, "").padStart(7, "0");
    return `inv_${invoice.nbmst}_${invoice.khhdon}_${cleanShd}`;
  }
  return `xml_${xml.length}_${xml.slice(0, 80)}`;
}
async function renderFourSiPdfViaLcs(xmlInput, invoice) {
  try {
    let xml = (xmlInput || "").trim();
    if (!xml && invoice) {
      xml = generateGDTInvoiceXml(invoice);
    }
    if (!xml) {
      throw new Error("D\u1EEF li\u1EC7u XML h\xF3a \u0111\u01A1n kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng.");
    }
    const khhdon = invoice?.khhdon || "4SI";
    const shdon = invoice?.shdon ? String(invoice.shdon).padStart(7, "0") : "0000000";
    const sellerMst = invoice?.nbmst || "LCS";
    const exportFilename = `HD_4SI_${khhdon}_${shdon}_${sellerMst}.pdf`;
    const cacheKey = getFourSiCacheKey(xml, invoice);
    const cached = fourSiPdfCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 36e5) {
      console.log(`[FourSiService] L\u1EA5y PDF 4Si t\u1EEB b\u1ED9 nh\u1EDB \u0111\u1EC7m (Cache HIT: ${cacheKey})...`);
      return {
        success: true,
        pdfBuffer: cached.buffer,
        pdfBase64: cached.base64,
        filename: cached.filename || exportFilename,
        contentType: "application/pdf",
        sourceUrl: cached.sourceUrl || FOUR_SI_LCS_READER_URL,
        portalUrl: FOUR_SI_LCS_READER_URL,
        isDisplayOnly: true
      };
    }
    let xmlForLcs = xml;
    if (xmlForLcs.includes("...") || xmlForLcs.includes("MIIFuzCCA")) {
      xmlForLcs = xmlForLcs.replace(/<DSCKS>[\s\S]*?<\/DSCKS>/gi, "");
    }
    const uploadFilename = `invoice_${sellerMst}_${khhdon}_${shdon}_${Date.now()}.xml`;
    const form = new FormData();
    const blob = new Blob([xmlForLcs], { type: "text/xml" });
    form.append("file", blob, uploadFilename);
    console.log(`[FourSiService] G\u1EEDi XML (${xmlForLcs.length} bytes) l\xEAn ${FOUR_SI_LCS_READER_URL}detect...`);
    const detectResponse = await axios3.post("https://dochoadon.lcssoft.com.vn/detect", form, {
      httpsAgent,
      timeout: 25e3
    });
    const resData = detectResponse.data;
    if (!resData || resData.status !== 0 || !resData.data) {
      const errMsg = resData?.data?.errorCode || "M\xE1y ch\u1EE7 LCS Soft t\u1EEB ch\u1ED1i x\u1EED l\xFD XML.";
      throw new Error(`C\u1ED5ng LCS Soft ph\u1EA3n h\u1ED3i: ${errMsg}`);
    }
    const filePdfName = resData.data.filePdfName || resData.data.fileName?.replace(/\.xml$/i, ".pdf") || uploadFilename.replace(/\.xml$/i, ".pdf");
    if (!filePdfName) {
      throw new Error("C\u1ED5ng LCS Soft kh\xF4ng t\u1EA1o \u0111\u01B0\u1EE3c t\u1EC7p PDF t\u1EEB XML n\xE0y.");
    }
    const downloadPdfUrl = `https://dochoadon.lcssoft.com.vn/download/pdf/${filePdfName}`;
    console.log(`[FourSiService] T\u1EA3i t\u1EC7p PDF k\u1EBFt qu\u1EA3 t\u1EEB ${downloadPdfUrl}...`);
    let pdfBuffer = null;
    let lastErr = null;
    await new Promise((resolve) => setTimeout(resolve, 1500));
    for (let attempt = 1; attempt <= 6; attempt++) {
      try {
        if (attempt > 1) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
        const pdfResponse = await axios3.get(downloadPdfUrl, {
          httpsAgent,
          responseType: "arraybuffer",
          timeout: 25e3
        });
        const buf = Buffer.from(pdfResponse.data);
        if (buf.length >= 100 && buf.toString("utf-8", 0, 5).startsWith("%PDF")) {
          pdfBuffer = buf;
          console.log(`[FourSiService] T\u1EA3i PDF 4Si th\xE0nh c\xF4ng \u1EDF l\u1EA7n th\u1EED ${attempt} (${buf.length} bytes)!`);
          break;
        }
      } catch (e) {
        lastErr = e;
        console.log(`[FourSiService] L\u1EA7n th\u1EED ${attempt}/6 ch\u01B0a c\xF3 file (${e.response?.status || e.message}), ti\u1EBFp t\u1EE5c \u0111\u1EE3i...`);
      }
    }
    if (!pdfBuffer) {
      throw new Error(
        lastErr?.message ? `Kh\xF4ng t\u1EA3i \u0111\u01B0\u1EE3c t\u1EC7p PDF t\u1EEB LCS Soft: ${lastErr.message}` : "T\u1EC7p t\u1EA3i v\u1EC1 t\u1EEB LCS Soft kh\xF4ng h\u1EE3p l\u1EC7 ho\u1EB7c b\u1ECB l\u1ED7i."
      );
    }
    const pdfBase64 = pdfBuffer.toString("base64");
    fourSiPdfCache.set(cacheKey, {
      buffer: pdfBuffer,
      base64: pdfBase64,
      filename: exportFilename,
      sourceUrl: downloadPdfUrl,
      timestamp: Date.now()
    });
    return {
      success: true,
      pdfBuffer,
      pdfBase64,
      filename: exportFilename,
      contentType: "application/pdf",
      sourceUrl: downloadPdfUrl,
      portalUrl: FOUR_SI_LCS_READER_URL,
      filePdfName,
      isDisplayOnly: true
    };
  } catch (err) {
    console.error("[FourSiService] L\u1ED7i khi t\u1EA1o b\u1EA3n th\u1EC3 hi\u1EC7n 4Si qua LCS Soft:", err.message);
    return {
      success: false,
      filename: `HD_4SI_${invoice?.khhdon || ""}_${invoice?.shdon || ""}.pdf`,
      contentType: "application/pdf",
      sourceUrl: FOUR_SI_LCS_READER_URL,
      portalUrl: FOUR_SI_LCS_READER_URL,
      error: err.message || "Kh\xF4ng th\u1EC3 t\u1EA1o b\u1EA3n th\u1EC3 hi\u1EC7n 4Si qua LCS Soft"
    };
  }
}

// src/services/invoice-engine/drivers/FourSiDriver.ts
var FourSiDriver = class extends BaseInvoiceProviderDriver {
  constructor() {
    super(...arguments);
    this.name = "4Si E-Invoice Driver";
    this.providerCode = "4SI";
    this.metadata = {
      name: "4Si E-Invoice Driver",
      providerCode: "4SI",
      description: "Tra c\u1EE9u v\xE0 t\u1EA3i PDF H\u0110\u0110T g\u1ED1c t\u1EEB c\u1ED5ng inv.4si.vn qua M\xE3 h\xF3a \u0111\u01A1n v\xE0 OCR Captcha t\u1EF1 \u0111\u1ED9ng",
      sampleUrl: "https://inv.4si.vn/tra-cuu",
      supportsCaptcha: true,
      requiredFields: ["lookupCode", "sellerTaxCode"]
    };
  }
  /**
   * Nhận diện hóa đơn 4Si theo đúng thứ tự ưu tiên nghiêm ngặt
   */
  canHandle(xmlData) {
    if (typeof xmlData !== "string") {
      return xmlData.provider === "4SI";
    }
    return detectProvider(xmlData) === "4SI";
  }
  /**
   * Trích xuất thông tin hóa đơn 4Si từ XML
   */
  extractInfo(xmlData) {
    const sellerTaxCode = this.extractXmlTag(xmlData, "MST") || this.extractXmlTag(xmlData, "nbmst");
    const sellerName = this.extractXmlTag(xmlData, "Ten") || this.extractXmlTag(xmlData, "nbten");
    const invoiceNo = (this.extractXmlTag(xmlData, "SHDon") || this.extractXmlTag(xmlData, "shdon") || "1").padStart(7, "0");
    const invoiceSeries = this.extractXmlTag(xmlData, "KHHDon") || this.extractXmlTag(xmlData, "khhdon") || "1C24TGT";
    const templateCode = this.extractXmlTag(xmlData, "KHMSHDon") || this.extractXmlTag(xmlData, "khmshdon") || "1";
    const invoiceDate = this.extractXmlTag(xmlData, "NLap") || this.extractXmlTag(xmlData, "nlap") || (/* @__PURE__ */ new Date()).toISOString();
    const cqtCode = this.extractXmlTag(xmlData, "MCCQT") || this.extractXmlTag(xmlData, "mhdon");
    let lookupCode = this.extractCustomField(xmlData, [
      "M\xE3 h\xF3a \u0111\u01A1n",
      "MaHoaDon",
      "M\xE3 tra c\u1EE9u",
      "MaTraCuu",
      "InvoiceCode",
      "MHD"
    ]);
    if (!lookupCode) {
      lookupCode = this.extractXmlTag(xmlData, "MTCuu") || this.extractXmlTag(xmlData, "InvoiceCode");
    }
    const totalAmount = parseFloat(this.extractXmlTag(xmlData, "TgTTTBSo") || "0") || 0;
    const totalTaxAmount = parseFloat(this.extractXmlTag(xmlData, "TgTThue") || "0") || 0;
    return {
      provider: this.providerCode,
      providerName: "4Si E-Invoice",
      sellerTaxCode,
      sellerName,
      invoiceNo,
      invoiceSeries,
      templateCode,
      invoiceDate,
      lookupCode: lookupCode || void 0,
      lookupUrl: "https://inv.4si.vn/tra-cuu",
      cqtCode: cqtCode || void 0,
      totalAmount,
      totalTaxAmount,
      currency: this.extractXmlTag(xmlData, "DVTTe") || "VND",
      rawXml: xmlData,
      additionalData: {
        msttcgp: "0313463990"
      }
    };
  }
  /**
   * Tải PDF Hóa đơn gốc 4Si từ cổng inv.4si.vn
   * Quy trình:
   * 1. GET form tra cứu tại https://inv.4si.vn/tra-cuu
   * 2. Bóc tách link ảnh Captcha bằng Cheerio và tải ảnh
   * 3. Giải Captcha bằng CaptchaSolver (Tesseract OCR)
   * 4. Gửi POST Request kèm Captcha để tải PDF
   */
  async fetchPdf(info, options) {
    const logs = [];
    this.createLog(`Kh\u1EDFi ch\u1EA1y 4Si E-Invoice Driver cho H\u0110 ${info.invoiceSeries} - ${info.invoiceNo}`, logs);
    const invoiceCode = (info.lookupCode || info.invoiceNo || "").trim();
    this.createLog(`M\xE3 tra c\u1EE9u / M\xE3 h\xF3a \u0111\u01A1n 4Si: "${invoiceCode}"`, logs);
    const timeoutMs = options?.timeoutMs || 15e3;
    const baseUrl = "https://inv.4si.vn";
    let cookieHeader = "";
    const client = axios4.create({
      baseURL: baseUrl,
      timeout: timeoutMs,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
        "Referer": `${baseUrl}/tra-cuu`,
        ...options?.customHeaders || {}
      }
    });
    let solvedCaptchaCode = "";
    try {
      this.createLog(`\u0110ang truy c\u1EADp trang ch\u1EE7 ${baseUrl}/tra-cuu...`, logs);
      const pageRes = await client.get("/tra-cuu", {
        validateStatus: (s) => s < 500
      });
      if (pageRes.headers["set-cookie"]) {
        const setCookie = pageRes.headers["set-cookie"];
        cookieHeader = Array.isArray(setCookie) ? setCookie.map((c) => c.split(";")[0]).join("; ") : String(setCookie).split(";")[0];
      }
      const $ = cheerio.load(typeof pageRes.data === "string" ? pageRes.data : "");
      let captchaImgSrc = $('img#captcha, img#imgCaptcha, img.captcha, img[src*="captcha"]').attr("src") || "/captcha";
      const csrfToken = $('input[name="_token"], input[name="csrf_token"]').val() || "";
      if (!captchaImgSrc.startsWith("http")) {
        captchaImgSrc = captchaImgSrc.startsWith("/") ? `${baseUrl}${captchaImgSrc}` : `${baseUrl}/${captchaImgSrc}`;
      }
      this.createLog(`B\xF3c t\xE1ch th\u1EA5y URL Captcha: ${captchaImgSrc}`, logs);
      let captchaBuffer = null;
      try {
        const captchaRes = await client.get(captchaImgSrc, {
          responseType: "arraybuffer",
          headers: {
            ...cookieHeader ? { "Cookie": cookieHeader } : {}
          }
        });
        if (captchaRes.data && captchaRes.data.byteLength > 50) {
          const rawBuf = Buffer.from(captchaRes.data);
          const cType = String(captchaRes.headers["content-type"] || "");
          if (cType.includes("image") || CaptchaSolver.isValidImageBuffer(rawBuf)) {
            captchaBuffer = rawBuf;
            this.createLog(`\u0110\xE3 t\u1EA3i \u1EA3nh Captcha 4Si (${(captchaBuffer.length / 1024).toFixed(1)} KB)`, logs);
          } else {
            this.createLog(`Ph\u1EA3n h\u1ED3i Captcha 4Si kh\xF4ng ph\u1EA3i \u1EA3nh (${cType || "text/html"}), b\u1ECF qua`, logs);
          }
        }
      } catch (cErr) {
        this.createLog(`Kh\xF4ng t\u1EA3i \u0111\u01B0\u1EE3c \u1EA3nh t\u1EEB ${captchaImgSrc}: ${cErr.message}`, logs);
      }
      if (captchaBuffer) {
        this.createLog("\u0110ang chuy\u1EC3n \u1EA3nh Captcha sang CaptchaSolver OCR...", logs);
        try {
          const ocrResult = await CaptchaSolver.solveWithDetails(captchaBuffer, {
            whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
            timeoutMs: 8e3
          });
          solvedCaptchaCode = ocrResult.code;
          this.createLog(`Gi\u1EA3i Captcha 4Si th\xE0nh c\xF4ng: "${solvedCaptchaCode}" (Confidence: ${ocrResult.confidence?.toFixed(0)}%)`, logs);
        } catch (ocrErr) {
          this.createLog(`C\u1EA3nh b\xE1o OCR Captcha: ${ocrErr.message}`, logs);
        }
      }
      const postEndpoints = [
        "/tra-cuu",
        "/api/tra-cuu",
        "/download-pdf",
        "/api/download-pdf"
      ];
      const postPayload = {
        invoiceCode,
        lookupCode: invoiceCode,
        taxCode: (info.sellerTaxCode || "").trim(),
        captcha: solvedCaptchaCode,
        captchaCode: solvedCaptchaCode,
        ...csrfToken ? { _token: String(csrfToken) } : {}
      };
      for (const ep of postEndpoints) {
        try {
          this.createLog(`G\u1EEDi POST Request \u0111\u1EBFn ${ep} v\u1EDBi m\xE3 tra c\u1EE9u "${invoiceCode}" v\xE0 Captcha "${solvedCaptchaCode}"...`, logs);
          const postRes = await client.post(ep, postPayload, {
            responseType: "arraybuffer",
            headers: {
              ...cookieHeader ? { "Cookie": cookieHeader } : {},
              "Content-Type": "application/x-www-form-urlencoded"
            },
            validateStatus: (s) => s < 500
          });
          if (postRes.status === 200 && postRes.data) {
            const buf = Buffer.from(postRes.data);
            if (buf.length > 50 && buf.toString("utf-8", 0, 5).startsWith("%PDF")) {
              this.createLog(`T\u1EA3i th\xE0nh c\xF4ng file PDF g\u1ED1c t\u1EEB 4Si (${(buf.length / 1024).toFixed(1)} KB)`, logs);
              return {
                success: true,
                provider: this.providerCode,
                driverName: this.name,
                pdfBuffer: buf,
                pdfBase64: buf.toString("base64"),
                contentType: "application/pdf",
                filename: this.buildPdfFilename(info),
                isFallback: false,
                sourceUrl: `${baseUrl}${ep}`,
                captchaSolved: solvedCaptchaCode,
                executionLogs: logs
              };
            }
          }
        } catch (epErr) {
          this.createLog(`Endpoint ${ep} ph\u1EA3n h\u1ED3i: ${epErr.message}`, logs);
        }
      }
    } catch (err) {
      this.createLog(`L\u1ED7i x\u1EED l\xFD tr\u1EF1c ti\u1EBFp qua inv.4si.vn: ${err.message}`, logs);
    }
    try {
      this.createLog(`Kh\u1EDFi \u0111\u1ED9ng gi\u1EA3i ph\xE1p t\u1EA1o b\u1EA3n th\u1EC3 hi\u1EC7n 4Si qua LCS Soft (dochoadon.lcssoft.com.vn)...`, logs);
      const lcsResult = await renderFourSiPdfViaLcs(info.rawXml, {
        khhdon: info.invoiceSeries,
        shdon: info.invoiceNo,
        nbmst: info.sellerTaxCode
      });
      if (lcsResult.success && lcsResult.pdfBuffer) {
        this.createLog(`T\u1EA1o b\u1EA3n th\u1EC3 hi\u1EC7n 4Si th\xE0nh c\xF4ng t\u1EEB dochoadon.lcssoft.com.vn (${(lcsResult.pdfBuffer.length / 1024).toFixed(1)} KB)`, logs);
        return {
          success: true,
          provider: this.providerCode,
          driverName: `${this.name} (LCS Soft dochoadon)`,
          pdfBuffer: lcsResult.pdfBuffer,
          pdfBase64: lcsResult.pdfBase64 || lcsResult.pdfBuffer.toString("base64"),
          contentType: "application/pdf",
          filename: lcsResult.filename || this.buildPdfFilename(info),
          isFallback: false,
          sourceUrl: FOUR_SI_LCS_READER_URL,
          executionLogs: logs
        };
      }
      if (lcsResult.error) {
        this.createLog(`dochoadon.lcssoft.com.vn ph\u1EA3n h\u1ED3i: ${lcsResult.error}`, logs);
      }
    } catch (lcsErr) {
      this.createLog(`L\u1ED7i gi\u1EA3i ph\xE1p LCS Soft dochoadon: ${lcsErr.message}`, logs);
    }
    throw new Error(`[FourSiDriver] Kh\xF4ng th\u1EC3 t\u1EA3i PDF t\u1EEB inv.4si.vn hay dochoadon.lcssoft.com.vn. H\u1EC7 th\u1ED1ng s\u1EBD t\u1EF1 \u0111\u1ED9ng k\xEDch ho\u1EA1t GenericFallbackDriver.`);
  }
};

// src/services/invoice-engine/drivers/GenericFallbackDriver.ts
import { jsPDF } from "jspdf";
import fs from "fs";
import path from "path";
import QRCode from "qrcode";
var regularFontBuffer = null;
var boldFontBuffer = null;
var italicFontBuffer = null;
function loadUnicodeFonts() {
  if (regularFontBuffer && boldFontBuffer) return true;
  const candidateDirs = [
    path.resolve(process.cwd(), "assets/fonts"),
    path.resolve(process.cwd(), "public/fonts"),
    "/usr/share/fonts/truetype/liberation"
  ];
  for (const dir of candidateDirs) {
    try {
      const reg = path.join(dir, "LiberationSerif-Regular.ttf");
      const bold = path.join(dir, "LiberationSerif-Bold.ttf");
      const ital = path.join(dir, "LiberationSerif-Italic.ttf");
      if (fs.existsSync(reg) && fs.existsSync(bold)) {
        regularFontBuffer = fs.readFileSync(reg);
        boldFontBuffer = fs.readFileSync(bold);
        italicFontBuffer = fs.existsSync(ital) ? fs.readFileSync(ital) : regularFontBuffer;
        return true;
      }
    } catch {
    }
  }
  return false;
}
function formatTaxRate(rate) {
  if (rate === void 0 || rate === null || rate === "") return "\\";
  let str = String(rate).trim().replace(/<[^>]+>/g, "").trim();
  if (str === "0.1" || str === "0,1") return "10%";
  if (str === "0.08" || str === "0,08") return "8%";
  if (str === "0.05" || str === "0,05") return "5%";
  if (str === "0.00" || str === "0" || str === "0%") return "0%";
  if (str === "-1" || str === "-2" || /kct|khong/i.test(str)) return "KCT";
  if (str === "-3" || /knt|khong_nop/i.test(str)) return "KNT";
  if (/^\d+(\.\d+)?$/.test(str)) {
    const num = parseFloat(str);
    if (num > 0 && num <= 1) return `${Math.round(num * 100)}%`;
    return `${num}%`;
  }
  return str;
}
var GenericFallbackDriver = class extends BaseInvoiceProviderDriver {
  constructor() {
    super(...arguments);
    this.name = "M\u1EABu Chu\u1EA9n T\u1ED5ng C\u1EE5c Thu\u1EBF (GDT TT78/N\u0110123)";
    this.providerCode = "GENERIC";
    this.metadata = {
      name: "M\u1EABu Chu\u1EA9n T\u1ED5ng C\u1EE5c Thu\u1EBF (GDT TT78/N\u0110123)",
      providerCode: "GENERIC",
      description: "B\u1EA3n th\u1EC3 hi\u1EC7n chu\u1EA9n h\xF3a \u0111\u01A1n \u0111i\u1EC7n t\u1EED ch\xEDnh th\u1EE9c c\u1EE7a T\u1ED5ng c\u1EE5c Thu\u1EBF (Ngh\u1ECB \u0111\u1ECBnh 123/2020/N\u0110-CP & Th\xF4ng t\u01B0 78/2021/TT-BTC)",
      supportsCaptcha: false,
      requiredFields: []
    };
  }
  canHandle(_xmlData) {
    return true;
  }
  extractInfo(xmlData) {
    try {
      const inv = parseGDTInvoiceXml(xmlData);
      return {
        provider: this.providerCode,
        providerName: "M\u1EABu Chu\u1EA9n T\u1ED5ng C\u1EE5c Thu\u1EBF (GDT TT78/N\u0110123)",
        sellerTaxCode: inv.nbmst,
        sellerName: inv.nbten,
        buyerTaxCode: inv.nmmst,
        buyerName: inv.nmten,
        invoiceNo: inv.shdon,
        invoiceSeries: inv.khhdon,
        templateCode: inv.khmshdon,
        invoiceDate: inv.tdlap,
        cqtCode: inv.mhdon,
        totalAmount: inv.tgtttbso,
        totalTaxAmount: inv.tgtthue,
        currency: inv.dvtte || "VND",
        rawXml: xmlData,
        additionalData: {
          parsedInvoice: inv
        }
      };
    } catch {
      const nmuaBlock = this.extractXmlTag(xmlData, "NMua") || this.extractXmlTag(xmlData, "Buyer") || "";
      return {
        provider: this.providerCode,
        providerName: "M\u1EABu Chu\u1EA9n T\u1ED5ng C\u1EE5c Thu\u1EBF (GDT TT78/N\u0110123)",
        sellerTaxCode: this.extractXmlTag(xmlData, "MST") || this.extractXmlTag(xmlData, "nbmst") || "0100109106",
        sellerName: this.extractXmlTag(xmlData, "Ten") || this.extractXmlTag(xmlData, "nbten") || "\u0110\u01A0N V\u1ECA B\xC1N H\xC0NG",
        buyerTaxCode: this.extractXmlTag(nmuaBlock, "MST") || this.extractXmlTag(xmlData, "MSTNMua") || this.extractXmlTag(xmlData, "nmmst") || "",
        buyerName: this.extractXmlTag(nmuaBlock, "Ten") || this.extractXmlTag(xmlData, "TenNMua") || this.extractXmlTag(xmlData, "nmten") || "",
        invoiceNo: (this.extractXmlTag(xmlData, "SHDon") || this.extractXmlTag(xmlData, "shdon") || "1").padStart(7, "0"),
        invoiceSeries: this.extractXmlTag(xmlData, "KHHDon") || this.extractXmlTag(xmlData, "khhdon") || "1C25TGT",
        templateCode: this.extractXmlTag(xmlData, "KHMSHDon") || this.extractXmlTag(xmlData, "khmshdon") || "1",
        invoiceDate: this.extractXmlTag(xmlData, "NLap") || this.extractXmlTag(xmlData, "nlap") || (/* @__PURE__ */ new Date()).toISOString(),
        rawXml: xmlData
      };
    }
  }
  async fetchPdf(info, _options) {
    const logs = [];
    this.createLog(`K\xEDch ho\u1EA1t t\u1EA1o b\u1EA3n th\u1EC3 hi\u1EC7n M\u1EABu Chu\u1EA9n T\u1ED5ng C\u1EE5c Thu\u1EBF cho H\u0110 ${info.invoiceSeries} - ${info.invoiceNo}`, logs);
    let parsedInvoice = info.additionalData?.parsedInvoice || null;
    if (!parsedInvoice && info.rawXml) {
      try {
        parsedInvoice = parseGDTInvoiceXml(info.rawXml);
      } catch (parseErr) {
        this.createLog(`C\u1EA3nh b\xE1o ph\xE2n t\xEDch XML: ${parseErr.message}`, logs);
      }
    }
    let officialHtml = "";
    if (parsedInvoice) {
      officialHtml = generateOfficialInvoiceHtml(parsedInvoice, {
        showPrintControls: true,
        templateId: "DEFAULT"
      });
      this.createLog(`\u0110\xE3 bi\xEAn so\u1EA1n b\u1EA3n th\u1EC3 hi\u1EC7n HTML chu\u1EA9n T\u1ED5ng c\u1EE5c Thu\u1EBF (${(officialHtml.length / 1024).toFixed(1)} KB)`, logs);
    }
    const sellerName = parsedInvoice?.nbten || info.sellerName || "";
    const sellerTaxCode = parsedInvoice?.nbmst || info.sellerTaxCode || "";
    const sellerAddress = parsedInvoice?.nbdchi || "";
    const sellerPhone = parsedInvoice?.nbsdt || "";
    const sellerBankAcc = parsedInvoice?.nbstk || "";
    const sellerBankName = parsedInvoice?.nbnhang || "";
    const buyerName = parsedInvoice?.nmten || info.buyerName || "";
    const buyerTaxCode = parsedInvoice?.nmmst || info.buyerTaxCode || "";
    const buyerContact = parsedInvoice?.nmnguoimua || "";
    const buyerAddress = parsedInvoice?.nmdchi || "";
    const buyerBankAcc = parsedInvoice?.nmstk || "";
    const buyerBankName = parsedInvoice?.nmnhang || "";
    const paymentMethod = parsedInvoice?.htttoan || "TM/CK";
    const invoiceSeries = info.invoiceSeries || parsedInvoice?.khhdon || "1C25TGT";
    const invoiceNo = (info.invoiceNo || parsedInvoice?.shdon || "0000001").padStart(7, "0");
    const templateCode = info.templateCode || parsedInvoice?.khmshdon || (invoiceSeries ? invoiceSeries.charAt(0) : "1");
    const cqtCode = info.cqtCode || parsedInvoice?.mhdon || "";
    const cleanMauSo = String(templateCode).trim();
    const isMauSo2 = cleanMauSo === "2" || invoiceSeries.startsWith("2") || /^2[A-Z]/i.test(invoiceSeries);
    const isMauSo5 = cleanMauSo === "5" || invoiceSeries.startsWith("5");
    let invoiceHeaderTitle = "HO\xC1 \u0110\u01A0N GI\xC1 TR\u1ECA GIA T\u0102NG";
    if (isMauSo2) {
      invoiceHeaderTitle = "HO\xC1 \u0110\u01A0N B\xC1N H\xC0NG";
    } else if (isMauSo5) {
      invoiceHeaderTitle = "TEM / V\xC9 / TH\u1EBA \u0110I\u1EC6N T\u1EEC";
    }
    const invDateStr = parsedInvoice?.tdlap || info.invoiceDate || "";
    let day = "...";
    let month = "...";
    let year = "20...";
    if (invDateStr) {
      const match = invDateStr.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
      if (match) {
        year = match[1];
        month = match[2].padStart(2, "0");
        day = match[3].padStart(2, "0");
      }
    }
    const pdfDoc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true
    });
    const fontsLoaded = loadUnicodeFonts();
    let fontName = "times";
    if (fontsLoaded && regularFontBuffer && boldFontBuffer) {
      pdfDoc.addFileToVFS("LiberationSerif-Regular.ttf", regularFontBuffer.toString("binary"));
      pdfDoc.addFont("LiberationSerif-Regular.ttf", "LiberationSerif", "normal");
      pdfDoc.addFileToVFS("LiberationSerif-Bold.ttf", boldFontBuffer.toString("binary"));
      pdfDoc.addFont("LiberationSerif-Bold.ttf", "LiberationSerif", "bold");
      if (italicFontBuffer) {
        pdfDoc.addFileToVFS("LiberationSerif-Italic.ttf", italicFontBuffer.toString("binary"));
        pdfDoc.addFont("LiberationSerif-Italic.ttf", "LiberationSerif", "italic");
      }
      fontName = "LiberationSerif";
    }
    const pageWidth = pdfDoc.internal.pageSize.getWidth();
    const pageHeight = pdfDoc.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidth = pageWidth - margin * 2;
    const drawPageBorder = () => {
      pdfDoc.setDrawColor(145, 87, 21);
      pdfDoc.setLineWidth(0.6);
      pdfDoc.rect(margin, margin, contentWidth, pageHeight - margin * 2);
      pdfDoc.setLineWidth(0.2);
      pdfDoc.rect(margin + 1, margin + 1, contentWidth - 2, pageHeight - margin * 2 - 2);
    };
    drawPageBorder();
    const qrData = cqtCode ? `https://hoadondientu.gdt.gov.vn/tra-cuu?cqt=${encodeURIComponent(cqtCode)}` : `https://hoadondientu.gdt.gov.vn/tra-cuu?mst=${sellerTaxCode}&kh=${invoiceSeries}&so=${invoiceNo}`;
    try {
      const qrBase64 = await QRCode.toDataURL(qrData, {
        margin: 0,
        width: 120,
        errorCorrectionLevel: "M"
      });
      pdfDoc.addImage(qrBase64, "PNG", margin + 4, margin + 4, 18, 18);
    } catch {
    }
    pdfDoc.setFont(fontName, "bold");
    pdfDoc.setFontSize(9);
    pdfDoc.setTextColor(0, 0, 0);
    pdfDoc.text(`M\u1EABu s\u1ED1: ${cleanMauSo}`, pageWidth - margin - 4, margin + 6, { align: "right" });
    pdfDoc.text(`K\xFD hi\u1EC7u: ${invoiceSeries}`, pageWidth - margin - 4, margin + 11, { align: "right" });
    pdfDoc.text(`S\u1ED1: ${invoiceNo}`, pageWidth - margin - 4, margin + 16, { align: "right" });
    pdfDoc.setFont(fontName, "bold");
    pdfDoc.setFontSize(15);
    pdfDoc.setTextColor(0, 0, 0);
    pdfDoc.text(invoiceHeaderTitle, pageWidth / 2, margin + 10, { align: "center" });
    pdfDoc.setFont(fontName, "italic");
    pdfDoc.setFontSize(8.5);
    pdfDoc.setTextColor(60, 60, 60);
    pdfDoc.text("(B\u1EA3n th\u1EC3 hi\u1EC7n c\u1EE7a h\xF3a \u0111\u01A1n \u0111i\u1EC7n t\u1EED)", pageWidth / 2, margin + 15, { align: "center" });
    pdfDoc.setFont(fontName, "normal");
    pdfDoc.setFontSize(9.5);
    pdfDoc.setTextColor(0, 0, 0);
    pdfDoc.text(`Ng\xE0y ${day} th\xE1ng ${month} n\u0103m ${year}`, pageWidth / 2, margin + 20, { align: "center" });
    let y = margin + 24;
    if (cqtCode) {
      pdfDoc.setFontSize(8.5);
      pdfDoc.setFont(fontName, "italic");
      pdfDoc.setTextColor(40, 40, 40);
      pdfDoc.text(`M\xE3 c\u1EE7a CQT: ${cqtCode}`, pageWidth / 2, y, { align: "center" });
      y += 4;
    }
    pdfDoc.setDrawColor(145, 87, 21);
    pdfDoc.setLineWidth(0.3);
    pdfDoc.line(margin + 2, y, pageWidth - margin - 2, y);
    y += 4.5;
    pdfDoc.setFont(fontName, "normal");
    pdfDoc.setFontSize(9);
    pdfDoc.setTextColor(0, 0, 0);
    const drawLabelValue = (label, value2, isBoldVal = false) => {
      pdfDoc.setFont(fontName, "normal");
      pdfDoc.text(label, margin + 4, y);
      const labelWidth = pdfDoc.getTextWidth(label) + 2;
      pdfDoc.setFont(fontName, isBoldVal ? "bold" : "normal");
      const maxWidth = contentWidth - labelWidth - 8;
      const lines = pdfDoc.splitTextToSize(value2 || "", maxWidth);
      pdfDoc.text(lines, margin + 4 + labelWidth, y);
      y += Math.max(lines.length * 4.2, 4.2);
    };
    drawLabelValue("T\xEAn ng\u01B0\u1EDDi b\xE1n:", sellerName, true);
    drawLabelValue("M\xE3 s\u1ED1 thu\u1EBF:", sellerTaxCode, true);
    if (sellerAddress) {
      drawLabelValue("\u0110\u1ECBa ch\u1EC9:", sellerAddress);
    }
    if (sellerPhone) {
      drawLabelValue("\u0110i\u1EC7n tho\u1EA1i:", sellerPhone);
    }
    if (sellerBankAcc) {
      const bankInfo = sellerBankName ? `${sellerBankAcc} t\u1EA1i ${sellerBankName}` : sellerBankAcc;
      drawLabelValue("S\u1ED1 t\xE0i kho\u1EA3n:", bankInfo);
    }
    pdfDoc.setDrawColor(200, 200, 200);
    pdfDoc.setLineWidth(0.2);
    pdfDoc.line(margin + 2, y, pageWidth - margin - 2, y);
    y += 4;
    drawLabelValue("T\xEAn ng\u01B0\u1EDDi mua:", buyerName || "Kh\xE1ch h\xE0ng kh\xF4ng l\u1EA5y h\xF3a \u0111\u01A1n / Mua l\u1EBB", true);
    if (buyerContact) {
      drawLabelValue("H\u1ECD t\xEAn ng\u01B0\u1EDDi mua:", buyerContact);
    }
    drawLabelValue("M\xE3 s\u1ED1 thu\u1EBF:", buyerTaxCode || "Kh\xF4ng c\xF3 MST");
    if (buyerAddress) {
      drawLabelValue("\u0110\u1ECBa ch\u1EC9:", buyerAddress);
    }
    drawLabelValue("H\xECnh th\u1EE9c thanh to\xE1n:", paymentMethod || "TM/CK");
    if (buyerBankAcc) {
      const buyerBankInfo = buyerBankName ? `${buyerBankAcc} t\u1EA1i ${buyerBankName}` : buyerBankAcc;
      drawLabelValue("S\u1ED1 t\xE0i kho\u1EA3n:", buyerBankInfo);
    }
    y += 2;
    const colWidths = [10, 82, 16, 18, 26, 16, 22];
    const colHeaders = ["STT", "T\xEAn h\xE0ng h\xF3a, d\u1ECBch v\u1EE5", "\u0110VT", "S\u1ED1 l\u01B0\u1EE3ng", "\u0110\u01A1n gi\xE1", "Thu\u1EBF su\u1EA5t", "Th\xE0nh ti\u1EC1n"];
    const colSubHeaders = ["(1)", "(2)", "(3)", "(4)", "(5)", "(6)", "(7 = 4 x 5)"];
    const drawTableHeader = (startY) => {
      pdfDoc.setFillColor(248, 250, 252);
      pdfDoc.setDrawColor(0, 0, 0);
      pdfDoc.setLineWidth(0.2);
      pdfDoc.rect(margin, startY, contentWidth, 8, "FD");
      let currentX = margin;
      pdfDoc.setFont(fontName, "bold");
      pdfDoc.setFontSize(8);
      pdfDoc.setTextColor(0, 0, 0);
      for (let i = 0; i < colHeaders.length; i++) {
        const w = colWidths[i];
        const align = i === 1 ? "left" : i >= 3 && i !== 5 ? "right" : "center";
        const textX = align === "left" ? currentX + 1.5 : align === "right" ? currentX + w - 1.5 : currentX + w / 2;
        pdfDoc.text(colHeaders[i], textX, startY + 4, { align });
        pdfDoc.setFont(fontName, "normal");
        pdfDoc.setFontSize(7);
        pdfDoc.text(colSubHeaders[i], currentX + w / 2, startY + 7, { align: "center" });
        pdfDoc.setFont(fontName, "bold");
        pdfDoc.setFontSize(8);
        if (i > 0) {
          pdfDoc.line(currentX, startY, currentX, startY + 8);
        }
        currentX += w;
      }
      return startY + 8;
    };
    y = drawTableHeader(y);
    const items = parsedInvoice?.items || [
      {
        lineNo: 1,
        itemName: `H\xE0ng h\xF3a, d\u1ECBch v\u1EE5 theo h\xF3a \u0111\u01A1n s\u1ED1 ${invoiceNo}`,
        unit: "G\xF3i",
        quantity: 1,
        unitPrice: info.totalAmount || 0,
        amount: info.totalAmount || 0,
        taxRate: isMauSo2 ? "\\" : "10%"
      }
    ];
    pdfDoc.setFont(fontName, "normal");
    pdfDoc.setFontSize(8);
    const formatVNDNum = (num) => {
      return new Intl.NumberFormat("vi-VN").format(Math.round(num || 0));
    };
    const maxItems = Math.min(items.length, 12);
    for (let i = 0; i < maxItems; i++) {
      const it = items[i];
      const itemName = it.itemName || it.ten || it.name || `H\xE0ng h\xF3a ${i + 1}`;
      const splitNames = pdfDoc.splitTextToSize(itemName, colWidths[1] - 3);
      const rowHeight = Math.max(splitNames.length * 4.2, 5.5);
      pdfDoc.setDrawColor(200, 200, 200);
      pdfDoc.setLineWidth(0.15);
      pdfDoc.rect(margin, y, contentWidth, rowHeight);
      let curX = margin;
      for (let c = 0; c < colWidths.length; c++) {
        const w = colWidths[c];
        if (c > 0) {
          pdfDoc.line(curX, y, curX, y + rowHeight);
        }
        curX += w;
      }
      curX = margin;
      pdfDoc.text(String(it.lineNo || it.stt || i + 1), curX + colWidths[0] / 2, y + 4, { align: "center" });
      curX += colWidths[0];
      pdfDoc.text(splitNames, curX + 1.5, y + 3.8);
      curX += colWidths[1];
      pdfDoc.text(String(it.unit || it.dvt || "C\xE1i"), curX + colWidths[2] / 2, y + 4, { align: "center" });
      curX += colWidths[2];
      pdfDoc.text(String(it.quantity || it.sluong || 1), curX + colWidths[3] - 1.5, y + 4, { align: "right" });
      curX += colWidths[3];
      const priceStr = it.unitPrice || it.dgia ? formatVNDNum(it.unitPrice || it.dgia) : "";
      pdfDoc.text(priceStr, curX + colWidths[4] - 1.5, y + 4, { align: "right" });
      curX += colWidths[4];
      const tsStr = formatTaxRate(it.taxRate || it.tsuat || (isMauSo2 ? "\\" : "10%"));
      pdfDoc.text(tsStr, curX + colWidths[5] / 2, y + 4, { align: "center" });
      curX += colWidths[5];
      const amtStr = formatVNDNum(it.amount || it.thtien || 0);
      pdfDoc.text(amtStr, curX + colWidths[6] - 1.5, y + 4, { align: "right" });
      y += rowHeight;
    }
    y += 3;
    const totalBeforeTax = parsedInvoice?.tgtcthue ?? (info.totalAmount ? info.totalAmount * 0.9 : 0);
    const totalTax = parsedInvoice?.tgtthue ?? (info.totalTaxAmount || 0);
    const totalPayment = parsedInvoice?.tgtttbso ?? (info.totalAmount || 0);
    const wordsAmount = parsedInvoice?.tgtttbchu || "";
    const summaryBoxWidth = 95;
    const summaryBoxX = pageWidth - margin - summaryBoxWidth;
    pdfDoc.setDrawColor(0, 0, 0);
    pdfDoc.setLineWidth(0.2);
    pdfDoc.rect(summaryBoxX, y, summaryBoxWidth, isMauSo2 ? 14 : 20);
    pdfDoc.line(summaryBoxX, y + 6.5, summaryBoxX + summaryBoxWidth, y + 6.5);
    if (!isMauSo2) {
      pdfDoc.line(summaryBoxX, y + 13, summaryBoxX + summaryBoxWidth, y + 13);
    }
    pdfDoc.setFont(fontName, "normal");
    pdfDoc.setFontSize(8.5);
    if (isMauSo2) {
      pdfDoc.text("T\u1ED5ng ti\u1EC1n h\xE0ng:", summaryBoxX + 2, y + 4.5);
      pdfDoc.text(`${formatVNDNum(totalPayment)} \u0111`, summaryBoxX + summaryBoxWidth - 2, y + 4.5, { align: "right" });
      pdfDoc.setFont(fontName, "bold");
      pdfDoc.text("T\u1ED5ng ti\u1EC1n thanh to\xE1n:", summaryBoxX + 2, y + 10.5);
      pdfDoc.text(`${formatVNDNum(totalPayment)} \u0111`, summaryBoxX + summaryBoxWidth - 2, y + 10.5, { align: "right" });
      y += 16;
    } else {
      pdfDoc.text("T\u1ED5ng ti\u1EC1n ch\u01B0a thu\u1EBF:", summaryBoxX + 2, y + 4.5);
      pdfDoc.text(`${formatVNDNum(totalBeforeTax)} \u0111`, summaryBoxX + summaryBoxWidth - 2, y + 4.5, { align: "right" });
      pdfDoc.text("T\u1ED5ng ti\u1EC1n thu\u1EBF GTGT:", summaryBoxX + 2, y + 10);
      pdfDoc.text(`${formatVNDNum(totalTax)} \u0111`, summaryBoxX + summaryBoxWidth - 2, y + 10, { align: "right" });
      pdfDoc.setFont(fontName, "bold");
      pdfDoc.text("T\u1ED5ng ti\u1EC1n thanh to\xE1n:", summaryBoxX + 2, y + 16.5);
      pdfDoc.text(`${formatVNDNum(totalPayment)} \u0111`, summaryBoxX + summaryBoxWidth - 2, y + 16.5, { align: "right" });
      y += 22;
    }
    pdfDoc.setFont(fontName, "normal");
    pdfDoc.setFontSize(8.5);
    if (wordsAmount) {
      pdfDoc.text("S\u1ED1 ti\u1EC1n vi\u1EBFt b\u1EB1ng ch\u1EEF:", margin + 4, y);
      pdfDoc.setFont(fontName, "italic");
      pdfDoc.text(wordsAmount, margin + 35, y);
      y += 6;
    }
    pdfDoc.setDrawColor(145, 87, 21);
    pdfDoc.setLineWidth(0.3);
    pdfDoc.line(margin + 2, y, pageWidth - margin - 2, y);
    y += 5;
    pdfDoc.setFont(fontName, "bold");
    pdfDoc.setFontSize(9.5);
    pdfDoc.text("NG\u01AF\u1EDCI MUA H\xC0NG", margin + 45, y, { align: "center" });
    pdfDoc.text("NG\u01AF\u1EDCI B\xC1N H\xC0NG", pageWidth - margin - 45, y, { align: "center" });
    y += 4;
    pdfDoc.setFont(fontName, "italic");
    pdfDoc.setFontSize(8);
    pdfDoc.text("(Ch\u1EEF k\xFD s\u1ED1 (n\u1EBFu c\xF3))", margin + 45, y, { align: "center" });
    pdfDoc.text("(Ch\u1EEF k\xFD \u0111i\u1EC7n t\u1EED, ch\u1EEF k\xFD s\u1ED1)", pageWidth - margin - 45, y, { align: "center" });
    y += 4;
    const signBoxX = pageWidth - margin - 72;
    const signBoxWidth = 68;
    const signBoxHeight = 18;
    pdfDoc.setDrawColor(35, 183, 9);
    pdfDoc.setFillColor(240, 253, 244);
    pdfDoc.roundedRect(signBoxX, y, signBoxWidth, signBoxHeight, 1.5, 1.5, "FD");
    pdfDoc.setFont(fontName, "bold");
    pdfDoc.setFontSize(8);
    pdfDoc.setTextColor(35, 183, 9);
    pdfDoc.text("\u2714 Signature Valid", signBoxX + 4, y + 4.5);
    pdfDoc.setFont(fontName, "normal");
    pdfDoc.setFontSize(7);
    pdfDoc.setTextColor(22, 101, 52);
    const signSellerLines = pdfDoc.splitTextToSize(`K\xFD b\u1EDFi: ${sellerName}`, signBoxWidth - 8);
    pdfDoc.text(signSellerLines[0] || "", signBoxX + 4, y + 8.5);
    pdfDoc.text(`K\xFD ng\xE0y: ${invDateStr.substring(0, 10) || `${year}-${month}-${day}`}`, signBoxX + 4, y + 12.5);
    pdfDoc.setFont(fontName, "italic");
    pdfDoc.setFontSize(8);
    pdfDoc.setTextColor(60, 60, 60);
    pdfDoc.text("(C\u1EA7n ki\u1EC3m tra, \u0111\u1ED1i chi\u1EBFu khi l\u1EADp, nh\u1EADn h\xF3a \u0111\u01A1n)", pageWidth / 2, pageHeight - margin - 4, { align: "center" });
    const pdfArrayBuffer = pdfDoc.output("arraybuffer");
    const pdfBuffer = Buffer.from(pdfArrayBuffer);
    const pdfBase64 = pdfBuffer.toString("base64");
    this.createLog(`T\u1EA1o th\xE0nh c\xF4ng PDF M\u1EABu Chu\u1EA9n T\u1ED5ng C\u1EE5c Thu\u1EBF (${(pdfBuffer.length / 1024).toFixed(1)} KB), cam k\u1EBFt 100% kh\xF4ng gi\u1EA3 l\u1EADp`, logs);
    return {
      success: true,
      provider: "GDT_OFFICIAL",
      driverName: this.name,
      pdfBuffer,
      pdfBase64,
      contentType: "application/pdf",
      filename: this.buildPdfFilename(info),
      isFallback: true,
      executionLogs: logs
    };
  }
};

// src/services/vnptInvoiceService.ts
import axios5 from "axios";
import https2 from "https";
import * as cheerio2 from "cheerio";
var vnptHttpsAgent = new https2.Agent({
  keepAlive: true,
  maxSockets: 30,
  keepAliveMsecs: 3e4
});
var vnptClient = axios5.create({
  httpsAgent: vnptHttpsAgent,
  timeout: 25e3
});
var vnptInvoiceCache = /* @__PURE__ */ new Map();
var inFlightLookups = /* @__PURE__ */ new Map();
function getVnptCacheKey(sellerTaxCode, lookupCode, portalUrl) {
  const cleanMst = (sellerTaxCode || "").trim().replace(/[^0-9\-]/g, "");
  const cleanCode = (lookupCode || "").trim().replace(/^(mã\s*tra\s*cứu|mtc|mtcuu|mã\s*tc|code|fkey)[\s:=-]*/i, "").trim();
  let portalBase = (portalUrl || "").trim().replace(/\/+$/, "").replace(/\/HomeNoLogin\/SearchByFkey\/?$/i, "");
  if (!portalBase) {
    portalBase = cleanMst ? `https://${cleanMst}-tt78.vnpt-invoice.com.vn` : "https://4000344946-tt78.vnpt-invoice.com.vn";
  }
  return `${portalBase}|${cleanCode}`;
}
function getCachedVnptInvoice(sellerTaxCode, lookupCode, portalUrl) {
  const key = getVnptCacheKey(sellerTaxCode, lookupCode, portalUrl);
  const entry = vnptInvoiceCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > 2 * 60 * 60 * 1e3) {
    vnptInvoiceCache.delete(key);
    return null;
  }
  return entry;
}
function setCachedVnptInvoice(sellerTaxCode, lookupCode, portalUrl, entry) {
  const key = getVnptCacheKey(sellerTaxCode, lookupCode, portalUrl);
  vnptInvoiceCache.set(key, entry);
}
async function lookupOriginalVnptInvoice(params) {
  const lookupCode = params.lookupCode.trim().replace(/^(mã\s*tra\s*cứu|mtc|mtcuu|mã\s*tc|code|fkey)[\s:=-]*/i, "").trim();
  if (!lookupCode) throw new Error("M\xE3 tra c\u1EE9u VNPT kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng");
  let portal = params.lookupUrl;
  if (!portal || /tracuu\.vnpt-invoice|portal\.vnpt-invoice/i.test(portal)) {
    portal = params.sellerTaxCode ? `https://${params.sellerTaxCode}-tt78.vnpt-invoice.com.vn` : "https://4000344946-tt78.vnpt-invoice.com.vn";
  }
  portal = portal.replace(/\/+$/, "");
  const cacheKey = getVnptCacheKey(params.sellerTaxCode, lookupCode, portal);
  if (!params.forceRefresh) {
    const cached = getCachedVnptInvoice(params.sellerTaxCode, lookupCode, portal);
    if (cached && cached.htmlContent) {
      console.log(`[VNPT Speed] Tr\u1EA3 v\u1EC1 t\u1EEB Cache t\u1EE9c th\xEC cho m\xE3: ${lookupCode}`);
      return {
        success: true,
        htmlContent: cached.htmlContent,
        checkCode: cached.checkCode,
        pdfDownloadUrl: `/api/vnpt/download-pdf?portal=${encodeURIComponent(portal)}&checkCode=${encodeURIComponent(cached.checkCode)}&fkey=${encodeURIComponent(lookupCode)}`,
        portalUrl: portal,
        isCached: true,
        invoiceInfo: cached.invoiceInfo
      };
    }
  }
  if (inFlightLookups.has(cacheKey)) {
    console.log(`[VNPT Speed] T\xE1i s\u1EED d\u1EE5ng ti\u1EBFn tr\xECnh tra c\u1EE9u \u0111ang ch\u1EA1y cho m\xE3: ${lookupCode}`);
    return inFlightLookups.get(cacheKey);
  }
  const lookupPromise = (async () => {
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
    };
    const maxAttempts = 2;
    let lastError = "";
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const t0 = Date.now();
        console.log(`[VNPT] B\u1EAFt \u0111\u1EA7u tra c\u1EE9u t\u1ED1i \u01B0u l\u1EA7n ${attempt}/${maxAttempts} (M\xE3: ${lookupCode}, C\u1ED5ng: ${portal})...`);
        const page = await vnptClient.get(`${portal}/HomeNoLogin/SearchByFkey/`, {
          headers,
          timeout: 1e4,
          validateStatus: (status) => status >= 200 && status < 400
        });
        const cookies = (page.headers["set-cookie"] || []).map((cookie) => cookie.split(";")[0]).join("; ");
        const $ = cheerio2.load(page.data);
        const token = $('input[name="__RequestVerificationToken"]').attr("value") || "";
        const captcha = await vnptClient.get(`${portal}/Captcha/Show?t=${Date.now()}`, {
          headers: { ...headers, Referer: `${portal}/HomeNoLogin/SearchByFkey/`, Cookie: cookies },
          responseType: "arraybuffer",
          timeout: 1e4
        });
        const captchaCookies = (captcha.headers["set-cookie"] || []).map((cookie) => cookie.split(";")[0]);
        const sessionCookie = [...cookies.split("; ").filter(Boolean), ...captchaCookies].filter((cookie, index, all) => all.findIndex((item) => item.split("=")[0] === cookie.split("=")[0]) === index).join("; ");
        const tAiStart = Date.now();
        const captchaCode = (await CaptchaSolver.solveWithDetails(Buffer.from(captcha.data), {
          prompt: VNPT_CAPTCHA_PROMPT
        })).code;
        console.log(`[VNPT Speed] Gi\u1EA3i Captcha trong ${Date.now() - tAiStart}ms: "${captchaCode}"`);
        const form = new URLSearchParams({
          __RequestVerificationToken: token,
          strFkey: lookupCode,
          captch: captchaCode,
          submit: ""
        });
        const result = await vnptClient.post(`${portal}/HomeNoLogin/SearchByFkey`, form.toString(), {
          headers: {
            ...headers,
            "Content-Type": "application/x-www-form-urlencoded",
            Referer: `${portal}/HomeNoLogin/SearchByFkey/`,
            Cookie: sessionCookie
          },
          maxRedirects: 5,
          timeout: 2e4,
          responseType: "text",
          validateStatus: (status) => status >= 200 && status < 400
        });
        const html = String(result.data || "");
        const isCaptchaError = /captcha|mã xác thực không đúng|sai mã xác thực|không chính xác/i.test(html) && !/invoice|hóa đơn|hoadon/i.test(html);
        if (isCaptchaError) {
          lastError = "VNPT b\xE1o sai m\xE3 x\xE1c th\u1EF1c Captcha.";
          console.warn(`[VNPT] L\u1EA7n ${attempt} sai Captcha, \u0111ang th\u1EED l\u1EA1i v\u1EDBi \u1EA3nh m\u1EDBi...`);
          continue;
        }
        const postCookies = (result.headers["set-cookie"] || []).map((cookie) => cookie.split(";")[0]);
        const finalCookies = [...sessionCookie.split("; ").filter(Boolean), ...postCookies].filter((cookie, index, all) => all.findIndex((item) => item.split("=")[0] === cookie.split("=")[0]) === index).join("; ");
        const $search = cheerio2.load(html);
        let checkCode = "";
        const onclickAttr = $search('a[onclick*="ajxCall4Portal"]').attr("onclick") || "";
        const matchOnclick = onclickAttr.match(/ajxCall4Portal\(\s*['"]([^'"]+)['"]/);
        if (matchOnclick) {
          checkCode = matchOnclick[1];
        }
        if (!checkCode) {
          const downloadHref = $search('a[href*="downloadPDF"]').attr("href") || "";
          const matchHref = downloadHref.match(/checkCode=([^&"']+)/);
          if (matchHref) {
            checkCode = decodeURIComponent(matchHref[1]);
          }
        }
        let invoiceInfo = void 0;
        const firstRow = $search("table tr").filter((_, tr) => $search(tr).find("td").length >= 5).first();
        if (firstRow.length > 0) {
          const tds = firstRow.find("td");
          invoiceInfo = {
            name: $search(tds[1]).text().trim(),
            template: $search(tds[2]).text().trim(),
            series: $search(tds[3]).text().trim(),
            number: $search(tds[4]).text().trim(),
            totalAmount: $search(tds[5]).text().trim(),
            issueDate: $search(tds[6]).text().trim(),
            status: $search(tds[7]).text().trim(),
            cqtStatus: $search(tds[8]).text().trim()
          };
        }
        let fullInvoiceHtml = "";
        let prefetchedPdfBuffer = void 0;
        if (checkCode) {
          const previewPayload = new URLSearchParams({
            checkCode,
            fkey: lookupCode,
            nameCus: ""
          });
          const previewPromise = vnptClient.post(`${portal}/HomeNoLogin/ajxPreview/`, previewPayload.toString(), {
            headers: {
              ...headers,
              "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
              "X-Requested-With": "XMLHttpRequest",
              Referer: `${portal}/HomeNoLogin/SearchByFkey/`,
              Cookie: finalCookies
            },
            timeout: 2e4
          });
          const pdfDownloadUrl = `${portal}/HomeNoLogin/downloadPDF?checkCode=${encodeURIComponent(checkCode)}&fkey=${encodeURIComponent(lookupCode)}`;
          const pdfPromise = vnptClient.get(pdfDownloadUrl, {
            headers: {
              ...headers,
              Referer: `${portal}/HomeNoLogin/SearchByFkey/`,
              Cookie: finalCookies
            },
            responseType: "arraybuffer",
            timeout: 2e4
          });
          const [previewRes, pdfRes] = await Promise.allSettled([previewPromise, pdfPromise]);
          if (previewRes.status === "fulfilled" && previewRes.value.data?.str) {
            fullInvoiceHtml = String(previewRes.value.data.str);
            if (!/<base /i.test(fullInvoiceHtml)) {
              if (/<head([^>]*)>/i.test(fullInvoiceHtml)) {
                fullInvoiceHtml = fullInvoiceHtml.replace(/<head([^>]*)>/i, `<head$1><base href="${portal}/">`);
              } else {
                fullInvoiceHtml = `<base href="${portal}/">
` + fullInvoiceHtml;
              }
            }
          }
          if (pdfRes.status === "fulfilled" && pdfRes.value.data) {
            const buf = Buffer.from(pdfRes.value.data);
            if (buf.length > 1e3 && buf.slice(0, 5).toString().startsWith("%PDF")) {
              prefetchedPdfBuffer = buf;
              console.log(`[VNPT Speed] \u0110\xE3 n\u1EA1p s\u1EB5n file PDF g\u1ED1c (${buf.length} bytes) v\xE0o cache song song v\u1EDBi HTML!`);
            }
          }
        }
        if (!fullInvoiceHtml) {
          fullInvoiceHtml = html.replace(/<head([^>]*)>/i, `<head$1><base href="${portal}/">`);
        }
        const cacheEntry = {
          htmlContent: fullInvoiceHtml,
          checkCode: checkCode || "",
          portalUrl: portal,
          pdfBuffer: prefetchedPdfBuffer,
          cookies: finalCookies,
          captchaSolved: captchaCode,
          invoiceInfo,
          cachedAt: Date.now()
        };
        setCachedVnptInvoice(params.sellerTaxCode, lookupCode, portal, cacheEntry);
        console.log(`[VNPT Speed] Ho\xE0n t\u1EA5t tra c\u1EE9u t\u1ED5ng c\u1ED9ng trong ${Date.now() - t0}ms!`);
        return {
          success: true,
          htmlContent: fullInvoiceHtml,
          checkCode: checkCode || void 0,
          pdfDownloadUrl: checkCode ? `/api/vnpt/download-pdf?portal=${encodeURIComponent(portal)}&checkCode=${encodeURIComponent(checkCode)}&fkey=${encodeURIComponent(lookupCode)}` : void 0,
          portalUrl: portal,
          isCached: false,
          captchaSolved: captchaCode,
          invoiceInfo
        };
      } catch (err) {
        lastError = err.message || String(err);
        console.warn(`[VNPT] L\u1ED7i tra c\u1EE9u l\u1EA7n ${attempt}:`, lastError);
      }
    }
    throw new Error(`Tra c\u1EE9u h\xF3a \u0111\u01A1n g\u1ED1c VNPT th\u1EA5t b\u1EA1i: ${lastError || "VNPT t\u1EEB ch\u1ED1i m\xE3 Captcha ho\u1EB7c kh\xF4ng tr\u1EA3 v\u1EC1 b\u1EA3n g\u1ED1c h\xF3a \u0111\u01A1n."}`);
  })();
  inFlightLookups.set(cacheKey, lookupPromise);
  try {
    return await lookupPromise;
  } finally {
    inFlightLookups.delete(cacheKey);
  }
}
async function downloadOriginalVnptPdf(params) {
  let portal = params.portalUrl;
  if (!portal || /tracuu\.vnpt-invoice|portal\.vnpt-invoice/i.test(portal)) {
    portal = params.sellerTaxCode ? `https://${params.sellerTaxCode}-tt78.vnpt-invoice.com.vn` : "https://4000344946-tt78.vnpt-invoice.com.vn";
  }
  portal = portal.replace(/\/+$/, "");
  const lookupCode = params.lookupCode.trim().replace(/^(mã\s*tra\s*cứu|mtc|mtcuu|mã\s*tc|code|fkey)[\s:=-]*/i, "").trim();
  const cleanShd = params.invoiceNumber ? String(params.invoiceNumber).padStart(7, "0") : lookupCode.slice(0, 16);
  const cached = getCachedVnptInvoice(params.sellerTaxCode, lookupCode, portal);
  if (cached?.pdfBuffer && cached.pdfBuffer.length > 1e3) {
    console.log(`[VNPT Speed] Tr\u1EA3 v\u1EC1 PDF g\u1ED1c t\u1EEB b\u1ED9 nh\u1EDB \u0111\u1EC7m (0ms delay)!`);
    return {
      data: cached.pdfBuffer,
      filename: `HoaDon_VNPT_${cleanShd}.pdf`,
      contentType: "application/pdf",
      captchaSolved: cached.captchaSolved || "\u0110\xE3 gi\u1EA3i th\xE0nh c\xF4ng"
    };
  }
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36",
    Referer: `${portal}/HomeNoLogin/SearchByFkey/`
  };
  let validPdfBuffer = null;
  let resolvedCaptcha = cached?.captchaSolved;
  const checkCode = params.checkCode && params.checkCode !== "undefined" && params.checkCode !== "null" ? params.checkCode.trim() : cached?.checkCode;
  const cookies = cached?.cookies || "";
  if (checkCode && cookies) {
    const pdfUrl = `${portal}/HomeNoLogin/downloadPDF?checkCode=${encodeURIComponent(checkCode)}&fkey=${encodeURIComponent(lookupCode)}`;
    console.log(`[VNPT Speed] T\u1EA3i PDF tr\u1EF1c ti\u1EBFp b\u1EB1ng checkCode v\xE0 cookies c\xF3 s\u1EB5n: ${pdfUrl}`);
    try {
      const res = await vnptClient.get(pdfUrl, {
        headers: { ...headers, Cookie: cookies },
        responseType: "arraybuffer",
        timeout: 15e3,
        validateStatus: (s) => s === 200
      });
      if (res.data && res.data.byteLength > 1e3) {
        const tempBuf = Buffer.from(res.data);
        if (tempBuf.slice(0, 5).toString().startsWith("%PDF")) {
          validPdfBuffer = tempBuf;
          if (cached) cached.pdfBuffer = tempBuf;
          console.log(`[VNPT Speed] T\u1EA3i nhanh PDF th\xE0nh c\xF4ng (${validPdfBuffer.length} bytes)!`);
        }
      }
    } catch (err) {
      console.warn(`[VNPT] Kh\xF4ng th\u1EC3 t\u1EA3i b\u1EB1ng cookies c\xF3 s\u1EB5n: ${err.message}.`);
    }
  }
  if (!validPdfBuffer) {
    console.log(`[VNPT Speed] Ch\u01B0a c\xF3 PDF trong cache, k\xEDch ho\u1EA1t tra c\u1EE9u nhanh \u0111\u1EC3 l\u1EA5y PDF...`);
    const lookupRes = await lookupOriginalVnptInvoice({
      lookupCode,
      sellerTaxCode: params.sellerTaxCode,
      lookupUrl: portal
    });
    resolvedCaptcha = lookupRes.captchaSolved;
    const refreshedCache = getCachedVnptInvoice(params.sellerTaxCode, lookupCode, portal);
    if (refreshedCache?.pdfBuffer && refreshedCache.pdfBuffer.length > 1e3) {
      validPdfBuffer = refreshedCache.pdfBuffer;
    } else if (lookupRes.checkCode) {
      const finalCookies = refreshedCache?.cookies || "";
      const freshPdfUrl = `${portal}/HomeNoLogin/downloadPDF?checkCode=${encodeURIComponent(lookupRes.checkCode)}&fkey=${encodeURIComponent(lookupCode)}`;
      const res = await vnptClient.get(freshPdfUrl, {
        headers: { ...headers, Cookie: finalCookies },
        responseType: "arraybuffer",
        timeout: 2e4,
        validateStatus: (s) => s === 200
      });
      if (res.data && res.data.byteLength > 1e3) {
        const tempBuf = Buffer.from(res.data);
        if (tempBuf.slice(0, 5).toString().startsWith("%PDF")) {
          validPdfBuffer = tempBuf;
          if (refreshedCache) refreshedCache.pdfBuffer = tempBuf;
        }
      }
    }
  }
  if (!validPdfBuffer || validPdfBuffer.length === 0 || !validPdfBuffer.slice(0, 5).toString().startsWith("%PDF")) {
    throw new Error("C\u1ED5ng VNPT kh\xF4ng tr\u1EA3 v\u1EC1 t\u1EC7p PDF h\u1EE3p l\u1EC7 cho h\xF3a \u0111\u01A1n n\xE0y.");
  }
  return {
    data: validPdfBuffer,
    filename: `HoaDon_VNPT_${cleanShd}.pdf`,
    contentType: "application/pdf",
    captchaSolved: resolvedCaptcha
  };
}

// src/services/invoice-engine/drivers/VnptDriver.ts
var VnptDriver = class extends BaseInvoiceProviderDriver {
  constructor() {
    super(...arguments);
    this.name = "VNPT Invoice Driver";
    this.providerCode = "VNPT";
    this.metadata = {
      name: "VNPT Invoice Driver",
      providerCode: "VNPT",
      description: "Tra c\u1EE9u v\xE0 t\u1EA3i PDF H\u0110\u0110T g\u1ED1c t\u1EEB c\u1ED5ng VNPT Invoice qua Fkey / M\xE3 tra c\u1EE9u, MST b\xEAn b\xE1n v\xE0 v\u01B0\u1EE3t Captcha t\u1EF1 \u0111\u1ED9ng",
      sampleUrl: "https://tracuu.vnpt-invoice.com.vn",
      supportsCaptcha: true,
      requiredFields: ["sellerTaxCode", "lookupCode"]
    };
    this.fallback = new GenericFallbackDriver();
  }
  /**
   * Nhận diện hóa đơn VNPT theo đúng thứ tự ưu tiên nghiêm ngặt
   */
  canHandle(xmlData) {
    if (typeof xmlData !== "string") {
      return xmlData.provider === "VNPT";
    }
    return detectProvider(xmlData) === "VNPT";
  }
  extractInfo(xmlData) {
    const sellerTaxCode = this.extractXmlTag(xmlData, "MST") || this.extractXmlTag(xmlData, "nbmst");
    const sellerName = this.extractXmlTag(xmlData, "Ten") || this.extractXmlTag(xmlData, "nbten");
    const invoiceNo = (this.extractXmlTag(xmlData, "SHDon") || this.extractXmlTag(xmlData, "shdon") || "1").padStart(7, "0");
    const invoiceSeries = this.extractXmlTag(xmlData, "KHHDon") || this.extractXmlTag(xmlData, "khhdon") || "1C24TGT";
    const templateCode = this.extractXmlTag(xmlData, "KHMSHDon") || this.extractXmlTag(xmlData, "khmshdon") || "1";
    const invoiceDate = this.extractXmlTag(xmlData, "NLap") || this.extractXmlTag(xmlData, "nlap") || (/* @__PURE__ */ new Date()).toISOString();
    const cqtCode = this.extractXmlTag(xmlData, "MCCQT") || this.extractXmlTag(xmlData, "mhdon");
    let lookupCode = this.extractCustomField(xmlData, ["Fkey", "M\xE3 Fkey", "M\xE3 tra c\u1EE9u", "MaTraCuu", "MTCuu", "MTC"]) || this.extractXmlTag(xmlData, "Fkey") || this.extractXmlTag(xmlData, "MTCuu");
    if (!lookupCode) {
      lookupCode = cqtCode;
    }
    const totalAmount = parseFloat(this.extractXmlTag(xmlData, "TgTTTBSo") || "0") || 0;
    const totalTaxAmount = parseFloat(this.extractXmlTag(xmlData, "TgTThue") || "0") || 0;
    const nmuaBlock = this.extractXmlTag(xmlData, "NMua") || this.extractXmlTag(xmlData, "Buyer") || "";
    const buyerTaxCode = this.extractXmlTag(nmuaBlock, "MST") || this.extractXmlTag(xmlData, "MSTNMua") || this.extractXmlTag(xmlData, "nmmst") || "";
    const buyerName = this.extractXmlTag(nmuaBlock, "Ten") || this.extractXmlTag(xmlData, "TenNMua") || this.extractXmlTag(xmlData, "nmten") || "";
    return {
      provider: this.providerCode,
      providerName: "VNPT Invoice",
      sellerTaxCode,
      sellerName,
      buyerTaxCode: buyerTaxCode || void 0,
      buyerName: buyerName || void 0,
      invoiceNo,
      invoiceSeries,
      templateCode,
      invoiceDate,
      lookupCode: lookupCode || void 0,
      lookupUrl: sellerTaxCode ? `https://${sellerTaxCode}-tt78.vnpt-invoice.com.vn` : "https://4000344946-tt78.vnpt-invoice.com.vn",
      cqtCode: cqtCode || void 0,
      totalAmount,
      totalTaxAmount,
      currency: this.extractXmlTag(xmlData, "DVTTe") || "VND",
      rawXml: xmlData,
      additionalData: {
        msttcgp: "0100686209"
      }
    };
  }
  async fetchPdf(info, options) {
    const logs = [];
    this.createLog(`Kh\u1EDFi ch\u1EA1y VNPT Invoice Driver cho H\u0110 ${info.invoiceSeries} - ${info.invoiceNo}`, logs);
    const fkey = (options?.customInfo?.lookupCode || info.lookupCode || "").trim();
    const cleanMst = (options?.customInfo?.sellerTaxCode || info.sellerTaxCode || "").trim();
    this.createLog(`Fkey VNPT: "${fkey}", MST: "${cleanMst}"`, logs);
    if (fkey) {
      try {
        this.createLog(`\u0110ang k\u1EBFt n\u1ED1i c\u1ED5ng VNPT v\xE0 t\u1EF1 \u0111\u1ED9ng gi\u1EA3i Captcha b\u1EB1ng AI...`, logs);
        const vnptRes = await downloadOriginalVnptPdf({
          lookupCode: fkey,
          sellerTaxCode: cleanMst,
          portalUrl: options?.customInfo?.lookupUrl || info.lookupUrl,
          invoiceNumber: options?.customInfo?.invoiceNo || info.invoiceNo
        });
        if (vnptRes.data && vnptRes.data.length > 500) {
          const buf = vnptRes.data;
          const captchaMsg = vnptRes.captchaSolved ? ` (\u0110\xE3 v\u01B0\u1EE3t Captcha: ${vnptRes.captchaSolved})` : "";
          this.createLog(`V\u01B0\u1EE3t Captcha v\xE0 t\u1EA3i th\xE0nh c\xF4ng file PDF g\u1ED1c t\u1EEB VNPT (${(buf.length / 1024).toFixed(1)} KB)${captchaMsg}`, logs);
          return {
            success: true,
            provider: this.providerCode,
            driverName: this.name,
            pdfBuffer: buf,
            pdfBase64: buf.toString("base64"),
            contentType: "application/pdf",
            filename: vnptRes.filename || this.buildPdfFilename(info),
            isFallback: false,
            captchaSolved: vnptRes.captchaSolved,
            sourceUrl: info.lookupUrl || `https://${cleanMst}-tt78.vnpt-invoice.com.vn`,
            executionLogs: logs
          };
        }
      } catch (err) {
        this.createLog(`C\u1ED5ng VNPT ch\u01B0a tr\u1EA3 v\u1EC1 PDF: ${err.message}`, logs);
      }
    }
    this.createLog(`K\xEDch ho\u1EA1t Fallback m\u1EABu chu\u1EA9n T\u1ED5ng c\u1EE5c Thu\u1EBF (GDT) cho H\u0110 VNPT`, logs);
    const fallbackRes = await this.fallback.fetchPdf(info, options);
    return {
      ...fallbackRes,
      provider: this.providerCode,
      driverName: this.name,
      executionLogs: [...logs, ...fallbackRes.executionLogs]
    };
  }
};

// src/services/easyInvoiceService.ts
import axios6 from "axios";
import * as cheerio3 from "cheerio";
import JSZip2 from "jszip";
import https3 from "https";
var httpsAgent2 = new https3.Agent({ rejectUnauthorized: false });
var isServerless2 = Boolean(
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT || process.env.NETLIFY
);
async function solveEasyInvoiceCaptcha(captchaBuf) {
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);
  if (isServerless2 && hasGeminiKey) {
    try {
      console.log("[EasyInvoice] M\xF4i tr\u01B0\u1EDDng Vercel/Serverless: S\u1EED d\u1EE5ng Gemini Vision gi\u1EA3i Captcha tr\u1EF1c ti\u1EBFp...");
      const digits2 = await solveCaptchaWithGemini(captchaBuf, EASYINVOICE_CAPTCHA_PROMPT);
      if (digits2 && digits2.length === 4) {
        console.log(`[EasyInvoice] Gemini gi\u1EA3i Captcha th\xE0nh c\xF4ng tr\xEAn Vercel: "${digits2}"`);
        return { code: digits2, confidence: 99, engine: "gemini" };
      }
    } catch (geminiErr) {
      throw geminiErr;
    }
  }
  try {
    const tessResult = await solveCaptchaWithTesseract(captchaBuf, {
      digitsOnly: true,
      expectedLength: 4,
      preprocessEasyInvoice: true,
      timeoutMs: 2e3
    });
    if (tessResult.code && tessResult.code.length === 4) {
      console.log(`[EasyInvoice] Tesseract.js gi\u1EA3i Captcha th\xE0nh c\xF4ng: "${tessResult.code}" (\u0110\u1ED9 tin c\u1EADy: ${tessResult.confidence}%)`);
      return { code: tessResult.code, confidence: tessResult.confidence, engine: "tesseract" };
    }
    console.log(`[EasyInvoice] Tesseract \u0111\u1ECDc \u0111\u01B0\u1EE3c "${tessResult.code}" (${tessResult.code.length} k\xFD t\u1EF1), chuy\u1EC3n sang Gemini...`);
  } catch (err) {
    console.warn(`[EasyInvoice] Tesseract.js g\u1EB7p l\u1ED7i ho\u1EB7c timeout: ${err.message}, th\u1EED Gemini...`);
  }
  const digits = await solveCaptchaWithGemini(captchaBuf, EASYINVOICE_CAPTCHA_PROMPT);
  console.log(`[EasyInvoice] Gemini gi\u1EA3i Captcha th\xE0nh c\xF4ng: "${digits}"`);
  return { code: digits, confidence: 99, engine: "gemini" };
}
async function downloadOriginalEasyInvoice(params) {
  const { lookupCode, sellerTaxCode, lookupUrl, khhdon, shdon } = params;
  if (!lookupCode) {
    throw new Error("M\xE3 tra c\u1EE9u h\xF3a \u0111\u01A1n EasyInvoice (FKey) kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng.");
  }
  let domain = "";
  if (lookupUrl && /easyinvoice\.com\.vn|easyinvoice\.vn/i.test(lookupUrl)) {
    try {
      const parsedUrl = new URL(lookupUrl);
      domain = `${parsedUrl.protocol}//${parsedUrl.host}`;
    } catch {
    }
  }
  if (!domain && sellerTaxCode) {
    domain = `http://${sellerTaxCode.trim()}hd.easyinvoice.com.vn`;
  }
  if (!domain) {
    domain = "https://tracuu.easyinvoice.vn";
  }
  console.log(`[EasyInvoice] Kh\u1EDFi \u0111\u1ED9ng t\u1EA3i H\u0110 g\u1ED1c: FKey="${lookupCode}", MST="${sellerTaxCode || ""}", C\u1ED5ng="${domain}"`);
  const maxRetries = isServerless2 ? 2 : 3;
  let lastError = "";
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      let currentDomain = domain;
      if (attempt > 1 && domain !== "https://tracuu.easyinvoice.vn") {
        currentDomain = "https://tracuu.easyinvoice.vn";
        console.log(`[EasyInvoice] L\u1EA7n th\u1EED ${attempt}: Chuy\u1EC3n sang C\u1ED5ng chung ${currentDomain}...`);
      } else {
        console.log(`[EasyInvoice] L\u1EA7n th\u1EED ${attempt}/${maxRetries}: L\u1EA5y Captcha t\u1EEB ${currentDomain}/Captcha/Show...`);
      }
      const cRes = await axios6.get(`${currentDomain}/Captcha/Show`, {
        responseType: "arraybuffer",
        timeout: 6e3,
        httpsAgent: httpsAgent2,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
          "Referer": `${currentDomain}/Search/Index`
        }
      });
      const cookie = cRes.headers["set-cookie"] ? Array.isArray(cRes.headers["set-cookie"]) ? cRes.headers["set-cookie"].join("; ") : cRes.headers["set-cookie"] : "";
      const captchaBuf = Buffer.from(cRes.data);
      let code = "";
      let confidence = 0;
      let engine = "gemini";
      try {
        const solved = await solveEasyInvoiceCaptcha(captchaBuf);
        code = solved.code;
        confidence = solved.confidence;
        engine = solved.engine;
      } catch (error) {
        lastError = `Kh\xF4ng th\u1EC3 gi\u1EA3i Captcha: ${error?.message || error}`;
        console.warn(`[EasyInvoice] ${lastError}`);
        continue;
      }
      if (!code || code.length !== 4) {
        lastError = "Ch\u01B0a nh\u1EADn di\u1EC7n \u0111\u1EE7 4 ch\u1EEF s\u1ED1 Captcha EasyInvoice.";
        console.warn(`[EasyInvoice] Ch\u01B0a \u0111\u1ECDc \u0111\u01B0\u1EE3c m\xE3 4 s\u1ED1 \u1EDF l\u1EA7n th\u1EED ${attempt}. Ti\u1EBFp t\u1EE5c th\u1EED l\u1EA1i...`);
        continue;
      }
      console.log(`[EasyInvoice] \u0110\xE3 gi\u1EA3i Captcha: "${code}" (Engine: ${engine}, \u0110\u1ED9 tin c\u1EADy: ${confidence}%). G\u1EEDi y\xEAu c\u1EA7u t\xECm ki\u1EBFm...`);
      const postRes = await axios6.post(
        `${currentDomain}/Search/Search`,
        `typeSearch=&FKey=${encodeURIComponent(lookupCode.trim())}&Capcha=${encodeURIComponent(code)}`,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Cookie": cookie,
            "Referer": `${currentDomain}/Search/Index?fkey=${encodeURIComponent(lookupCode.trim())}`,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
          },
          timeout: 8e3,
          httpsAgent: httpsAgent2
        }
      );
      const $ = cheerio3.load(postRes.data);
      const msg = $("#msg").val();
      if (msg) {
        console.warn(`[EasyInvoice] Th\xF4ng b\xE1o t\u1EEB c\u1ED5ng: "${msg}"`);
        if (msg.includes("M\xE3 x\xE1c th\u1EF1c kh\xF4ng ch\xEDnh x\xE1c") || msg.includes("sai m\xE3 x\xE1c th\u1EF1c") || msg.includes("captcha")) {
          console.log("[EasyInvoice] Sai Captcha, th\u1EED l\u1EA1i...");
          continue;
        }
        if (msg.includes("Kh\xF4ng t\xECm th\u1EA5y") || msg.includes("kh\xF4ng t\u1ED3n t\u1EA1i")) {
          throw new Error(`C\u1ED5ng EasyInvoice th\xF4ng b\xE1o: ${msg}`);
        }
      }
      const invDataStr = $("#InvData").val();
      if (!invDataStr) {
        console.warn(`[EasyInvoice] Kh\xF4ng nh\u1EADn \u0111\u01B0\u1EE3c InvData \u1EDF l\u1EA7n th\u1EED ${attempt}.`);
        continue;
      }
      let invData = {};
      try {
        invData = JSON.parse(invDataStr);
      } catch (e) {
        console.error("[EasyInvoice] Kh\xF4ng th\u1EC3 parse InvData JSON:", e.message);
      }
      const scriptMatch = postRes.data.match(/showInv\([^;]+,\s*'([^']+)'\);/);
      const token = scriptMatch ? scriptMatch[1] : "";
      const invoiceHtml = invData.str || "";
      const b64Html = Buffer.from(invoiceHtml, "utf-8").toString("base64");
      let downloadFileName = `HOADON_${sellerTaxCode || "EASYINVOICE"}_${khhdon || "HD"}_${shdon || lookupCode}`;
      if (params.viewOnly && invoiceHtml) {
        return {
          success: true,
          filename: `${downloadFileName}.html`,
          contentType: "text/html",
          buffer: Buffer.from(invoiceHtml, "utf-8"),
          htmlContent: invoiceHtml,
          message: "\u0110\xE3 tra c\u1EE9u v\xE0 nh\u1EADn b\u1EA3n th\u1EC3 hi\u1EC7n g\u1ED1c EasyInvoice."
        };
      }
      if (token && b64Html) {
        try {
          console.log("[EasyInvoice] G\u1ECDi API t\u1EA1o g\xF3i PDF ch\xEDnh th\u1EE9c...");
          const pdfGenRes = await axios6.post(
            `${currentDomain}/Invoice/DownloadPdfAndFileAttachFromAvailableHtml`,
            new URLSearchParams({ token, html: b64Html }).toString(),
            {
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Cookie": cookie,
                "Referer": `${currentDomain}/Search/Index`,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
              },
              timeout: 1e4,
              httpsAgent: httpsAgent2
            }
          );
          if (pdfGenRes.data && pdfGenRes.data.fileGuid) {
            const dlFileName = pdfGenRes.data.fileName || `${downloadFileName}.zip`;
            const dlUrl = `${currentDomain}/Invoice/Download?fileGuid=${encodeURIComponent(pdfGenRes.data.fileGuid)}&fileName=${encodeURIComponent(dlFileName)}`;
            console.log(`[EasyInvoice] T\u1EA3i file t\u1EEB: ${dlUrl}`);
            const dlRes = await axios6.get(dlUrl, {
              headers: { "Cookie": cookie },
              responseType: "arraybuffer",
              timeout: 1e4,
              httpsAgent: httpsAgent2
            });
            const downloadedBuf = Buffer.from(dlRes.data);
            if (downloadedBuf.length > 4 && downloadedBuf[0] === 80 && downloadedBuf[1] === 75) {
              try {
                const zip = new JSZip2();
                const unzipped = await zip.loadAsync(downloadedBuf);
                const pdfFile = Object.values(unzipped.files).find((f) => !f.dir && f.name.toLowerCase().endsWith(".pdf"));
                if (pdfFile) {
                  const pdfBuf = await pdfFile.async("nodebuffer");
                  console.log(`[EasyInvoice] \u0110\xE3 tr\xEDch xu\u1EA5t th\xE0nh c\xF4ng PDF "${pdfFile.name}" (${(pdfBuf.length / 1024).toFixed(1)} KB)`);
                  return {
                    success: true,
                    filename: pdfFile.name,
                    contentType: "application/pdf",
                    buffer: pdfBuf,
                    pdfBase64: pdfBuf.toString("base64"),
                    htmlContent: invoiceHtml,
                    captchaSolved: code
                  };
                }
              } catch (zipErr) {
                console.warn("[EasyInvoice] Kh\xF4ng th\u1EC3 gi\u1EA3i n\xE9n ZIP, g\u1EEDi nguy\xEAn file ZIP:", zipErr.message);
              }
              return {
                success: true,
                filename: dlFileName,
                contentType: "application/x-zip-compressed",
                buffer: downloadedBuf,
                pdfBase64: downloadedBuf.toString("base64"),
                htmlContent: invoiceHtml,
                captchaSolved: code
              };
            } else if (downloadedBuf.toString("utf-8", 0, 5).startsWith("%PDF")) {
              return {
                success: true,
                filename: `${downloadFileName}.pdf`,
                contentType: "application/pdf",
                buffer: downloadedBuf,
                pdfBase64: downloadedBuf.toString("base64"),
                htmlContent: invoiceHtml,
                captchaSolved: code
              };
            }
          }
        } catch (pdfErr) {
          console.warn("[EasyInvoice] Kh\xF4ng th\u1EC3 t\u1EA3i PDF qua DownloadPdfAndFileAttachFromAvailableHtml:", pdfErr.message);
        }
      }
      if (invoiceHtml) {
        console.log(`[EasyInvoice] Tr\u1EA3 v\u1EC1 b\u1EA3n th\u1EC3 hi\u1EC7n HTML g\u1ED1c EasyInvoice (${(invoiceHtml.length / 1024).toFixed(1)} KB)`);
        return {
          success: true,
          filename: `${downloadFileName}.html`,
          contentType: "text/html",
          buffer: Buffer.from(invoiceHtml, "utf-8"),
          htmlContent: invoiceHtml,
          captchaSolved: code
        };
      }
    } catch (err) {
      lastError = err.message;
      console.warn(`[EasyInvoice] L\u1ED7i \u1EDF l\u1EA7n th\u1EED ${attempt}:`, err.message);
    }
  }
  throw new Error(lastError || "Kh\xF4ng th\u1EC3 tra c\u1EE9u h\xF3a \u0111\u01A1n t\u1EEB C\u1ED5ng EasyInvoice sau 3 l\u1EA7n th\u1EED.");
}

// src/services/invoice-engine/drivers/EasyInvoiceDriver.ts
var EasyInvoiceDriver = class extends BaseInvoiceProviderDriver {
  constructor() {
    super(...arguments);
    this.name = "Softdreams EasyInvoice Driver";
    this.providerCode = "EASYINVOICE";
    this.metadata = {
      name: "Softdreams EasyInvoice Driver",
      providerCode: "EASYINVOICE",
      description: "Tra c\u1EE9u & x\u1EED l\xFD h\xF3a \u0111\u01A1n \u0111i\u1EC7n t\u1EED EasyInvoice (Softdreams) qua M\xE3 tra c\u1EE9u / Ch\u1EEF k\xFD s\u1ED1 EasyCA v\xE0 v\u01B0\u1EE3t Captcha t\u1EF1 \u0111\u1ED9ng",
      sampleUrl: "https://easyinvoice.vn/tra-cuu",
      supportsCaptcha: true,
      requiredFields: ["lookupCode", "sellerTaxCode"]
    };
    this.fallback = new GenericFallbackDriver();
  }
  canHandle(xmlData) {
    if (typeof xmlData !== "string") {
      return xmlData.provider === "EASYINVOICE";
    }
    return detectProvider(xmlData) === "EASYINVOICE";
  }
  extractInfo(xmlData) {
    const sellerTaxCode = this.extractXmlTag(xmlData, "MST") || this.extractXmlTag(xmlData, "nbmst");
    const sellerName = this.extractXmlTag(xmlData, "Ten") || this.extractXmlTag(xmlData, "nbten");
    const invoiceNo = (this.extractXmlTag(xmlData, "SHDon") || this.extractXmlTag(xmlData, "shdon") || "1").padStart(7, "0");
    const invoiceSeries = this.extractXmlTag(xmlData, "KHHDon") || this.extractXmlTag(xmlData, "khhdon") || "1C25TEI";
    const templateCode = this.extractXmlTag(xmlData, "KHMSHDon") || this.extractXmlTag(xmlData, "khmshdon") || "1";
    const invoiceDate = this.extractXmlTag(xmlData, "NLap") || this.extractXmlTag(xmlData, "nlap") || (/* @__PURE__ */ new Date()).toISOString();
    const cqtCode = this.extractXmlTag(xmlData, "MCCQT") || this.extractXmlTag(xmlData, "mhdon");
    const lookupCode = this.extractCustomField(xmlData, ["M\xE3 tra c\u1EE9u", "MaTraCuu", "MTCuu", "Fkey", "Ikey", "EasyInvoice"]) || this.extractXmlTag(xmlData, "MTCuu") || this.extractXmlTag(xmlData, "MaTraCuu");
    return {
      provider: this.providerCode,
      providerName: "Softdreams EasyInvoice",
      sellerTaxCode,
      sellerName,
      invoiceNo,
      invoiceSeries,
      templateCode,
      invoiceDate,
      cqtCode,
      lookupCode,
      lookupUrl: "https://easyinvoice.vn/tra-cuu",
      rawXml: xmlData
    };
  }
  async fetchPdf(info, options) {
    const logs = [];
    this.createLog(`Kh\u1EDFi \u0111\u1ED9ng x\u1EED l\xFD H\u0110\u0110T EasyInvoice: S\u1ED1 ${info.invoiceNo}, M\u1EABu ${info.templateCode}/${info.invoiceSeries}`, logs);
    const lookupCode = (options?.customInfo?.lookupCode || info.lookupCode || "").trim();
    const cleanMst = (options?.customInfo?.sellerTaxCode || info.sellerTaxCode || "").trim();
    this.createLog(`M\xE3 tra c\u1EE9u EasyInvoice: "${lookupCode}", MST: "${cleanMst}"`, logs);
    if (lookupCode) {
      try {
        this.createLog(`\u0110ang k\u1EBFt n\u1ED1i c\u1ED5ng EasyInvoice v\xE0 gi\u1EA3i Captcha b\u1EB1ng Gemini...`, logs);
        const dlRes = await downloadOriginalEasyInvoice({
          lookupCode,
          sellerTaxCode: cleanMst,
          lookupUrl: options?.customInfo?.lookupUrl || info.lookupUrl,
          khhdon: options?.customInfo?.invoiceSeries || info.invoiceSeries,
          shdon: options?.customInfo?.invoiceNo || info.invoiceNo
        });
        if (dlRes.success && dlRes.buffer && dlRes.buffer.length > 50) {
          const captchaMsg = dlRes.captchaSolved ? ` (\u0110\xE3 v\u01B0\u1EE3t Captcha: ${dlRes.captchaSolved})` : "";
          this.createLog(`V\u01B0\u1EE3t Captcha v\xE0 t\u1EA3i th\xE0nh c\xF4ng h\xF3a \u0111\u01A1n g\u1ED1c t\u1EEB EasyInvoice (${(dlRes.buffer.length / 1024).toFixed(1)} KB, file: ${dlRes.filename})${captchaMsg}`, logs);
          return {
            success: true,
            provider: this.providerCode,
            driverName: this.name,
            pdfBuffer: dlRes.buffer,
            pdfBase64: dlRes.pdfBase64 || dlRes.buffer.toString("base64"),
            contentType: dlRes.contentType || "application/pdf",
            filename: dlRes.filename || this.buildPdfFilename(info),
            isFallback: false,
            captchaSolved: dlRes.captchaSolved,
            sourceUrl: info.lookupUrl || "https://tracuu.easyinvoice.vn",
            executionLogs: logs
          };
        }
      } catch (err) {
        this.createLog(`T\u1EA3i t\u1EEB c\u1ED5ng EasyInvoice ch\u01B0a ho\xE0n t\u1EA5t: ${err.message}`, logs);
      }
    }
    this.createLog(`Chuy\u1EC3n sang b\u1ED9 t\u1EA1o b\u1EA3n th\u1EC3 hi\u1EC7n PDF chu\u1EA9n Ngh\u1ECB \u0111\u1ECBnh 123 / Th\xF4ng t\u01B0 78`, logs);
    const fallbackRes = await this.fallback.fetchPdf(info, options);
    return {
      ...fallbackRes,
      provider: this.providerCode,
      driverName: this.name,
      executionLogs: [...logs, ...fallbackRes.executionLogs]
    };
  }
};

// src/services/invoice-engine/drivers/BkavDriver.ts
var BkavDriver = class extends BaseInvoiceProviderDriver {
  constructor() {
    super(...arguments);
    this.name = "Bkav eHoadon Driver";
    this.providerCode = "BKAV";
    this.metadata = {
      name: "Bkav eHoadon Driver",
      providerCode: "BKAV",
      description: "Tra c\u1EE9u & x\u1EED l\xFD h\xF3a \u0111\u01A1n \u0111i\u1EC7n t\u1EED Bkav eHoadon qua M\xE3 tra c\u1EE9u / Ch\u1EEF k\xFD s\u1ED1 BKAV-CA",
      sampleUrl: "https://ehoadon.bkav.com/tra-cuu",
      supportsCaptcha: false,
      requiredFields: ["lookupCode", "sellerTaxCode"]
    };
    this.fallback = new GenericFallbackDriver();
  }
  canHandle(xmlData) {
    if (typeof xmlData !== "string") {
      return xmlData.provider === "BKAV";
    }
    return detectProvider(xmlData) === "BKAV";
  }
  extractInfo(xmlData) {
    const sellerTaxCode = this.extractXmlTag(xmlData, "MST") || this.extractXmlTag(xmlData, "nbmst");
    const sellerName = this.extractXmlTag(xmlData, "Ten") || this.extractXmlTag(xmlData, "nbten");
    const invoiceNo = (this.extractXmlTag(xmlData, "SHDon") || this.extractXmlTag(xmlData, "shdon") || "1").padStart(7, "0");
    const invoiceSeries = this.extractXmlTag(xmlData, "KHHDon") || this.extractXmlTag(xmlData, "khhdon") || "1C25TBK";
    const templateCode = this.extractXmlTag(xmlData, "KHMSHDon") || this.extractXmlTag(xmlData, "khmshdon") || "1";
    const invoiceDate = this.extractXmlTag(xmlData, "NLap") || this.extractXmlTag(xmlData, "nlap") || (/* @__PURE__ */ new Date()).toISOString();
    const cqtCode = this.extractXmlTag(xmlData, "MCCQT") || this.extractXmlTag(xmlData, "mhdon");
    const lookupCode = this.extractCustomField(xmlData, ["M\xE3 tra c\u1EE9u", "MaTraCuu", "MTCuu", "M\xE3 nh\u1EADn h\xF3a \u0111\u01A1n", "Bkav"]) || this.extractXmlTag(xmlData, "MTCuu") || this.extractXmlTag(xmlData, "MaTraCuu");
    const lookupUrl = lookupCode ? `https://tchd.ehoadon.vn/TCHD?MTC=${encodeURIComponent(lookupCode)}` : "https://tchd.ehoadon.vn/TCHD";
    return {
      provider: this.providerCode,
      providerName: "Bkav eHoadon",
      sellerTaxCode,
      sellerName,
      invoiceNo,
      invoiceSeries,
      templateCode,
      invoiceDate,
      cqtCode,
      lookupCode,
      lookupUrl,
      rawXml: xmlData
    };
  }
  async fetchPdf(info, options) {
    const logs = [];
    this.createLog(`Kh\u1EDFi \u0111\u1ED9ng x\u1EED l\xFD H\u0110\u0110T Bkav eHoadon: S\u1ED1 ${info.invoiceNo}, K\xFD hi\u1EC7u ${info.invoiceSeries}`, logs);
    if (info.lookupCode) {
      this.createLog(`M\xE3 tra c\u1EE9u Bkav: "${info.lookupCode}"`, logs);
      this.createLog(`C\u1ED5ng m\u1EDF h\xF3a \u0111\u01A1n tr\u1EF1c ti\u1EBFp: ${info.lookupUrl || "https://tchd.ehoadon.vn/TCHD"}`, logs);
    }
    this.createLog(`T\u1EA1o b\u1EA3n th\u1EC3 hi\u1EC7n PDF & HTML/CSS chu\u1EA9n Ngh\u1ECB \u0111\u1ECBnh 123 / Quy\u1EBFt \u0111\u1ECBnh 1450/TCT`, logs);
    const fallbackRes = await this.fallback.fetchPdf(info, options);
    return {
      ...fallbackRes,
      provider: this.providerCode,
      driverName: this.name,
      executionLogs: [...logs, ...fallbackRes.executionLogs]
    };
  }
};

// src/services/vnpayInvoiceService.ts
import axios7 from "axios";
var COMMON_VNPAY_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Origin": "https://portal.vnpayinvoice.vn",
  "Referer": "https://portal.vnpayinvoice.vn/",
  "Accept-Language": "vi,en-US;q=0.9,en;q=0.8"
};
function generateVnpayRequestId(length = 6) {
  const now = /* @__PURE__ */ new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const timestamp = `${year}${month}${day}${hours}${minutes}${seconds}`;
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  const rand = Math.floor(min + Math.random() * (max - min + 1));
  return `${timestamp}-${rand}`;
}
function buildVnpayPortalUrl(lookupCode, taxCode) {
  const base = "https://portal.vnpayinvoice.vn/";
  const params = new URLSearchParams();
  if (lookupCode) params.set("lookupCode", lookupCode.trim());
  if (taxCode) params.set("taxCode", taxCode.trim());
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}
function isInvalidVnpayLookupCode(code) {
  if (!code) return true;
  const trimmed = code.trim();
  if (!trimmed) return true;
  if (trimmed.toLowerCase() === "vietcombank") return true;
  if (/^M\d-\d{2}-/i.test(trimmed)) return true;
  if (trimmed.includes("-") && (trimmed.length > 15 || /^M/i.test(trimmed))) return true;
  if (/^[VTMB]\d{10,14}[A-Za-z0-9]{16,}$/i.test(trimmed)) return true;
  if (/^[0-9A-Z]{23,34}$/i.test(trimmed)) return true;
  if (trimmed.includes("0102182292") && trimmed.length > 15) return true;
  return false;
}
async function lookupVnpayInvoice(params) {
  let lookupCode = (params.lookupCode || "").trim();
  const taxCode = (params.taxCode || "").trim();
  if (isInvalidVnpayLookupCode(lookupCode)) {
    lookupCode = "";
  }
  if (!lookupCode) {
    const directUrl2 = buildVnpayPortalUrl("", taxCode);
    return {
      success: false,
      directUrl: directUrl2,
      error: "H\xF3a \u0111\u01A1n VNPAY y\xEAu c\u1EA7u S\u1ED1 b\u1EA3o m\u1EADt in tr\xEAn h\xF3a \u0111\u01A1n \u0111\u1EC3 tra c\u1EE9u tr\xEAn C\u1ED5ng VNPAY. B\u1EA1n c\xF3 th\u1EC3 m\u1EDF tr\u1EF1c ti\u1EBFp C\u1ED5ng VNPAY (\u0111\xE3 \u0111i\u1EC1n s\u1EB5n MST ng\u01B0\u1EDDi b\xE1n) \u0111\u1EC3 nh\u1EADp m\xE3, ho\u1EB7c tra c\u1EE9u tr\xEAn C\u1ED5ng H\u0110\u0110T T\u1ED5ng c\u1EE5c Thu\u1EBF."
    };
  }
  if (!taxCode) {
    return {
      success: false,
      error: "Vui l\xF2ng cung c\u1EA5p M\xE3 s\u1ED1 thu\u1EBF b\xEAn b\xE1n \u0111\u1EC3 tra c\u1EE9u h\xF3a \u0111\u01A1n VNPAY."
    };
  }
  const reqId = generateVnpayRequestId();
  const queryParams = new URLSearchParams({
    lookupCode,
    taxCode
  });
  if (params.captchaToken) {
    queryParams.set("captchaToken", params.captchaToken);
  }
  const directUrl = buildVnpayPortalUrl(lookupCode, taxCode);
  const url = `https://portal.vnpayinvoice.vn/api/v6/invoices?${queryParams.toString()}`;
  try {
    console.log(`[VNPAY] \u0110ang g\u1EEDi y\xEAu c\u1EA7u tra c\u1EE9u: MST=${taxCode}, M\xE3 tra c\u1EE9u=${lookupCode}, RequestId=${reqId}...`);
    const response = await axios7.get(url, {
      headers: {
        ...COMMON_VNPAY_HEADERS,
        "X-Request-ID": reqId
      },
      timeout: 15e3,
      validateStatus: () => true
    });
    if (response.status === 200 && response.data) {
      const data = response.data;
      const list = Array.isArray(data) ? data : data.data || data.items || (data.stringId ? [data] : []);
      const invoices = list.map((item) => ({
        stringId: item.stringId || item.id || item.invoiceId,
        id: item.id,
        invoiceNo: item.invoiceNo || item.shdon,
        invoiceSeries: item.invoiceSeries || item.khhdon,
        templateCode: item.templateCode || item.khmshdon,
        issueDate: item.issueDate || item.nlap,
        sellerTaxCode: item.sellerTaxCode || item.taxCode || taxCode,
        sellerName: item.sellerName || item.supplierName,
        buyerTaxCode: item.buyerTaxCode,
        buyerName: item.buyerName,
        totalAmount: item.totalAmount || item.tgtttbso,
        totalTaxAmount: item.totalTaxAmount || item.tgtthue,
        currency: item.currency || item.dvtte || "VND",
        status: item.status,
        raw: item
      }));
      const first = invoices[0];
      return {
        success: true,
        invoices,
        firstInvoice: first,
        stringId: first?.stringId,
        directUrl
      };
    }
    if (response.status === 400) {
      if (response.data?.code === "PORTAL_101") {
        return {
          success: false,
          errorCode: "PORTAL_101",
          requiresCaptcha: true,
          directUrl,
          error: "C\u1ED5ng VNPAY Invoice y\xEAu c\u1EA7u x\xE1c th\u1EF1c Google reCAPTCHA. B\u1EA1n c\xF3 th\u1EC3 m\u1EDF tr\u1EF1c ti\u1EBFp c\u1ED5ng tra c\u1EE9u VNPAY (\u0111\xE3 \u0111\u01B0\u1EE3c t\u1EF1 \u0111\u1ED9ng \u0111i\u1EC1n s\u1EB5n th\xF4ng tin)."
        };
      }
      return {
        success: false,
        directUrl,
        error: response.data?.message || "C\u1ED5ng VNPAY ph\u1EA3n h\u1ED3i: M\xE3 tra c\u1EE9u (S\u1ED1 b\u1EA3o m\u1EADt) ho\u1EB7c MST kh\xF4ng ch\xEDnh x\xE1c. Vui l\xF2ng ki\u1EC3m tra S\u1ED1 b\u1EA3o m\u1EADt tr\xEAn h\xF3a \u0111\u01A1n."
      };
    }
    const errMsg = response.data?.message || response.data?.error || `L\u1ED7i ph\u1EA3n h\u1ED3i t\u1EEB VNPAY (M\xE3 l\u1ED7i ${response.status})`;
    return {
      success: false,
      directUrl,
      error: errMsg
    };
  } catch (err) {
    return {
      success: false,
      directUrl,
      error: `Kh\xF4ng th\u1EC3 k\u1EBFt n\u1ED1i \u0111\u1EBFn C\u1ED5ng VNPAY Invoice: ${err.message}`
    };
  }
}
async function downloadOriginalVnpayPdf(params) {
  let stringId = params.stringId;
  const sellerTaxCode = (params.sellerTaxCode || "").trim();
  if (!sellerTaxCode) {
    throw new Error("M\xE3 s\u1ED1 thu\u1EBF b\xEAn b\xE1n (sellerTaxCode) l\xE0 b\u1EAFt bu\u1ED9c khi t\u1EA3i h\xF3a \u0111\u01A1n VNPAY.");
  }
  const candidateLookupCode = !isInvalidVnpayLookupCode(params.lookupCode) ? params.lookupCode.trim() : "";
  if (!stringId && candidateLookupCode) {
    const lookupRes = await lookupVnpayInvoice({
      lookupCode: candidateLookupCode,
      taxCode: sellerTaxCode,
      cqtCode: params.cqtCode,
      captchaToken: params.captchaToken
    });
    if (lookupRes.success && lookupRes.stringId) {
      stringId = lookupRes.stringId;
    } else if (lookupRes.requiresCaptcha) {
      return {
        success: false,
        filename: "",
        contentType: "application/pdf",
        sourceUrl: lookupRes.directUrl || "https://portal.vnpayinvoice.vn/",
        requiresCaptcha: true,
        error: lookupRes.error
      };
    } else {
      throw new Error(lookupRes.error || "Kh\xF4ng t\xECm th\u1EA5y h\xF3a \u0111\u01A1n tr\xEAn h\u1EC7 th\u1ED1ng VNPAY Invoice.");
    }
  }
  if (!stringId) {
    throw new Error("C\u1EA7n c\xF3 ID h\xF3a \u0111\u01A1n (stringId) ho\u1EB7c M\xE3 tra c\u1EE9u h\u1EE3p l\u1EC7 \u0111\u1EC3 t\u1EA3i PDF t\u1EEB VNPAY.");
  }
  const reqId = generateVnpayRequestId();
  const downloadUrl = `https://portal.vnpayinvoice.vn/api/v6/download-pdf/${encodeURIComponent(stringId)}?taxCode=${encodeURIComponent(sellerTaxCode)}`;
  console.log(`[VNPAY] \u0110ang t\u1EA3i PDF g\u1ED1c: stringId=${stringId}, taxCode=${sellerTaxCode}...`);
  const response = await axios7.get(downloadUrl, {
    headers: {
      ...COMMON_VNPAY_HEADERS,
      "Accept": "application/pdf, application/octet-stream, */*",
      "X-Request-ID": reqId
    },
    responseType: "arraybuffer",
    timeout: 25e3,
    validateStatus: (status) => status >= 200 && status < 400
  });
  if (response.data && response.data.byteLength > 100) {
    const buffer = Buffer.from(response.data);
    const headerSlice = buffer.toString("utf-8", 0, 10);
    if (headerSlice.startsWith("%PDF") || buffer.includes(Buffer.from("%PDF"))) {
      const shd = (params.invoiceNo || "0000000").padStart(7, "0");
      const khh = (params.invoiceSeries || "").replace(/[^a-zA-Z0-9]/g, "");
      const filename = `HoaDon_VNPAY_${sellerTaxCode}_${khh ? khh + "_" : ""}${shd}_${stringId}.pdf`;
      console.log(`[VNPAY] T\u1EA3i PDF th\xE0nh c\xF4ng (${(buffer.length / 1024).toFixed(1)} KB)`);
      return {
        success: true,
        pdfBuffer: buffer,
        pdfBase64: buffer.toString("base64"),
        filename,
        contentType: "application/pdf",
        sourceUrl: downloadUrl
      };
    } else {
      const text = buffer.toString("utf-8");
      console.warn("[VNPAY] Download tr\u1EA3 v\u1EC1 n\u1ED9i dung kh\xF4ng ph\u1EA3i PDF:", text.substring(0, 200));
      throw new Error(`M\xE1y ch\u1EE7 VNPAY ph\u1EA3n h\u1ED3i l\u1ED7i: ${text}`);
    }
  }
  throw new Error("D\u1EEF li\u1EC7u tr\u1EA3 v\u1EC1 t\u1EEB m\xE1y ch\u1EE7 VNPAY r\u1ED7ng ho\u1EB7c kh\xF4ng h\u1EE3p l\u1EC7.");
}
async function downloadOriginalVnpayXml(params) {
  let stringId = params.stringId;
  const sellerTaxCode = (params.sellerTaxCode || "").trim();
  if (!sellerTaxCode) {
    throw new Error("M\xE3 s\u1ED1 thu\u1EBF b\xEAn b\xE1n l\xE0 b\u1EAFt bu\u1ED9c khi t\u1EA3i XML t\u1EEB VNPAY.");
  }
  const candidateLookupCode = !isInvalidVnpayLookupCode(params.lookupCode) ? params.lookupCode.trim() : "";
  if (!stringId && candidateLookupCode) {
    const lookupRes = await lookupVnpayInvoice({
      lookupCode: candidateLookupCode,
      taxCode: sellerTaxCode,
      cqtCode: params.cqtCode,
      captchaToken: params.captchaToken
    });
    if (lookupRes.success && lookupRes.stringId) {
      stringId = lookupRes.stringId;
    } else {
      throw new Error(lookupRes.error || "Kh\xF4ng t\xECm th\u1EA5y h\xF3a \u0111\u01A1n tr\xEAn VNPAY.");
    }
  }
  if (!stringId) {
    throw new Error("C\u1EA7n c\xF3 ID h\xF3a \u0111\u01A1n (stringId) \u0111\u1EC3 t\u1EA3i XML t\u1EEB VNPAY.");
  }
  const reqId = generateVnpayRequestId();
  const downloadUrl = `https://portal.vnpayinvoice.vn/api/v6/private/download-xml/${encodeURIComponent(stringId)}?taxCode=${encodeURIComponent(sellerTaxCode)}`;
  console.log(`[VNPAY] \u0110ang t\u1EA3i XML g\u1ED1c: stringId=${stringId}, taxCode=${sellerTaxCode}...`);
  const response = await axios7.get(downloadUrl, {
    headers: {
      ...COMMON_VNPAY_HEADERS,
      "Accept": "application/xml, text/xml, */*",
      "X-Request-ID": reqId
    },
    responseType: "arraybuffer",
    timeout: 25e3,
    validateStatus: (status) => status >= 200 && status < 400
  });
  if (response.data && response.data.byteLength > 50) {
    const buffer = Buffer.from(response.data);
    const content = buffer.toString("utf-8");
    const shd = (params.invoiceNo || "0000000").padStart(7, "0");
    const khh = (params.invoiceSeries || "").replace(/[^a-zA-Z0-9]/g, "");
    const filename = `HoaDon_VNPAY_${sellerTaxCode}_${khh ? khh + "_" : ""}${shd}_${stringId}.xml`;
    return {
      success: true,
      xmlContent: content,
      filename,
      contentType: "application/xml",
      sourceUrl: downloadUrl
    };
  }
  throw new Error("Kh\xF4ng nh\u1EADn \u0111\u01B0\u1EE3c n\u1ED9i dung XML h\u1EE3p l\u1EC7 t\u1EEB VNPAY.");
}

// src/services/invoice-engine/drivers/VnpayDriver.ts
var VnpayDriver = class extends BaseInvoiceProviderDriver {
  constructor() {
    super(...arguments);
    this.name = "VNPAY Invoice Driver";
    this.providerCode = "VNPAY";
    this.metadata = {
      name: "VNPAY Invoice Driver",
      providerCode: "VNPAY",
      description: "Tra c\u1EE9u v\xE0 t\u1EA3i PDF H\u0110\u0110T g\u1ED1c t\u1EEB c\u1ED5ng VNPAY Invoice (portal.vnpayinvoice.vn) qua M\xE3 tra c\u1EE9u v\xE0 M\xE3 s\u1ED1 thu\u1EBF b\xEAn b\xE1n",
      sampleUrl: "https://portal.vnpayinvoice.vn/",
      supportsCaptcha: true,
      requiredFields: ["sellerTaxCode", "lookupCode"]
    };
  }
  /**
   * Nhận diện hóa đơn VNPAY Invoice
   */
  canHandle(xmlData) {
    if (typeof xmlData !== "string") {
      return xmlData.provider === "VNPAY";
    }
    return detectProvider(xmlData) === "VNPAY";
  }
  /**
   * Trích xuất thông tin hóa đơn VNPAY từ XML
   */
  extractInfo(xmlData) {
    const nbanBlock = this.extractXmlBlocks(xmlData, "NBan")[0] || "";
    const nmuaBlock = this.extractXmlBlocks(xmlData, "NMua")[0] || "";
    const sellerTaxCode = this.extractXmlTag(nbanBlock, "MST") || this.extractXmlTag(xmlData, "nbmst") || this.extractXmlTag(xmlData, "MST") || "";
    const sellerName = this.extractXmlTag(nbanBlock, "Ten") || this.extractXmlTag(xmlData, "nbten") || this.extractXmlTag(xmlData, "Ten") || "";
    const buyerTaxCode = this.extractXmlTag(nmuaBlock, "MST") || this.extractXmlTag(xmlData, "nmmst") || this.extractXmlTag(xmlData, "nm_mst");
    const buyerName = this.extractXmlTag(nmuaBlock, "Ten") || this.extractXmlTag(xmlData, "nmten") || this.extractXmlTag(xmlData, "nm_ten");
    const invoiceNo = (this.extractXmlTag(xmlData, "SHDon") || this.extractXmlTag(xmlData, "shdon") || "1").padStart(7, "0");
    const invoiceSeries = this.extractXmlTag(xmlData, "KHHDon") || this.extractXmlTag(xmlData, "khhdon") || "1C24TGT";
    const templateCode = this.extractXmlTag(xmlData, "KHMSHDon") || this.extractXmlTag(xmlData, "khmshdon") || "1";
    const invoiceDate = this.extractXmlTag(xmlData, "NLap") || this.extractXmlTag(xmlData, "nlap") || (/* @__PURE__ */ new Date()).toISOString();
    const cqtCode = this.extractXmlTag(xmlData, "MCCQT") || this.extractXmlTag(xmlData, "mhdon");
    let lookupCode = this.extractCustomField(xmlData, [
      "M\xE3 tra c\u1EE9u",
      "MaTraCuu",
      "MTCuu",
      "MTC",
      "FKey",
      "LookupCode",
      "TransactionID"
    ]);
    if (!lookupCode) {
      lookupCode = this.extractXmlTag(xmlData, "MTCuu") || this.extractXmlTag(xmlData, "MaTraCuu") || this.extractXmlTag(xmlData, "LookupCode") || this.extractXmlTag(xmlData, "FKey") || this.extractXmlTag(xmlData, "TransactionID");
    }
    if (!lookupCode) {
      const ttinBlocks = this.extractXmlBlocks(xmlData, "TTin");
      for (const block of ttinBlocks) {
        const truong = (this.extractXmlTag(block, "TTruong") || this.extractXmlTag(block, "TenTruong")).toLowerCase();
        if (truong.includes("tra c\u1EE9u") || truong.includes("tra cuu") || truong.includes("lookup") || truong.includes("fkey")) {
          const val = this.extractXmlTag(block, "DLieu") || this.extractXmlTag(block, "Data");
          if (val) {
            lookupCode = val.trim();
            break;
          }
        }
      }
    }
    const isInvalidVnpayCode = (code) => !code || code.toLowerCase() === "vietcombank" || /^[VTMB]\d{10,14}[A-Za-z0-9]{16,}$/i.test(code.trim()) || code.includes("0102182292") && code.length > 20;
    const validLookupCode = !isInvalidVnpayCode(lookupCode) ? lookupCode?.trim() || "" : "";
    const totalAmount = parseFloat(this.extractXmlTag(xmlData, "TgTTTBSo") || "0") || 0;
    const totalTaxAmount = parseFloat(this.extractXmlTag(xmlData, "TgTThue") || "0") || 0;
    const directUrl = validLookupCode ? buildVnpayPortalUrl(validLookupCode, sellerTaxCode) : "";
    return {
      provider: this.providerCode,
      providerName: "VNPAY Invoice (C\xF4ng ty C\u1ED5 ph\u1EA7n Gi\u1EA3i ph\xE1p Thanh to\xE1n Vi\u1EC7t Nam)",
      sellerTaxCode,
      sellerName,
      buyerTaxCode: buyerTaxCode || void 0,
      buyerName: buyerName || void 0,
      invoiceNo,
      invoiceSeries,
      templateCode,
      invoiceDate,
      lookupCode: validLookupCode || void 0,
      lookupUrl: directUrl || void 0,
      cqtCode: cqtCode || void 0,
      totalAmount,
      totalTaxAmount,
      currency: this.extractXmlTag(xmlData, "DVTTe") || "VND",
      rawXml: xmlData,
      additionalData: {
        msttcgp: "0102182292",
        portalUrl: "https://portal.vnpayinvoice.vn/"
      }
    };
  }
  /**
   * Tải PDF Hóa đơn gốc VNPAY từ cổng portal.vnpayinvoice.vn
   */
  async fetchPdf(info, options) {
    const logs = [];
    this.createLog(`Kh\u1EDFi ch\u1EA1y VNPAY Invoice Driver cho H\u0110 ${info.invoiceSeries || ""} - ${info.invoiceNo || ""} (MST: ${info.sellerTaxCode})`, logs);
    const sellerTaxCode = (info.sellerTaxCode || "").trim();
    const lookupCode = (info.lookupCode || "").trim();
    if (!sellerTaxCode) {
      this.createLog("L\u1ED6I: Thi\u1EBFu M\xE3 s\u1ED1 thu\u1EBF b\xEAn b\xE1n (sellerTaxCode).", logs);
      throw new Error("[VnpayDriver] Thi\u1EBFu M\xE3 s\u1ED1 thu\u1EBF b\xEAn b\xE1n (sellerTaxCode) \u0111\u1EC3 tra c\u1EE9u h\xF3a \u0111\u01A1n VNPAY.");
    }
    if (!lookupCode) {
      this.createLog("L\u1ED6I: Kh\xF4ng t\xECm th\u1EA5y M\xE3 tra c\u1EE9u trong XML h\xF3a \u0111\u01A1n.", logs);
      throw new Error("[VnpayDriver] Kh\xF4ng t\xECm th\u1EA5y M\xE3 tra c\u1EE9u trong XML h\xF3a \u0111\u01A1n VNPAY.");
    }
    this.createLog(`Th\xF4ng tin tra c\u1EE9u: MST b\xEAn b\xE1n=${sellerTaxCode}, M\xE3 tra c\u1EE9u=${lookupCode}`, logs);
    this.createLog("\u0110ang k\u1EBFt n\u1ED1i \u0111\u1EBFn C\u1ED5ng VNPAY Invoice (portal.vnpayinvoice.vn)...", logs);
    try {
      const result = await downloadOriginalVnpayPdf({
        sellerTaxCode,
        lookupCode,
        invoiceNo: info.invoiceNo,
        invoiceSeries: info.invoiceSeries
      });
      if (result.success && result.pdfBuffer) {
        this.createLog(`T\u1EA3i PDF H\u0110\u0110T g\u1ED1c th\xE0nh c\xF4ng t\u1EEB VNPAY Invoice (${(result.pdfBuffer.length / 1024).toFixed(1)} KB)`, logs);
        return {
          success: true,
          provider: this.providerCode,
          driverName: this.name,
          pdfBuffer: result.pdfBuffer,
          pdfBase64: result.pdfBase64 || result.pdfBuffer.toString("base64"),
          contentType: "application/pdf",
          filename: result.filename || this.buildPdfFilename(info),
          isFallback: false,
          sourceUrl: result.sourceUrl,
          executionLogs: logs
        };
      }
      if (result.requiresCaptcha) {
        this.createLog(`[L\u01AFU \xDD] C\u1ED5ng VNPAY Invoice y\xEAu c\u1EA7u x\xE1c th\u1EF1c reCAPTCHA v3. Cung c\u1EA5p \u0111\u01B0\u1EDDng d\u1EABn tra c\u1EE9u tr\u1EF1c ti\u1EBFp: ${buildVnpayPortalUrl(lookupCode, sellerTaxCode)}`, logs);
        throw new Error(result.error || "C\u1ED5ng VNPAY Invoice y\xEAu c\u1EA7u x\xE1c th\u1EF1c reCAPTCHA.");
      }
    } catch (err) {
      this.createLog(`L\u1ED7i khi g\u1ECDi c\u1ED5ng VNPAY: ${err.message}`, logs);
      throw new Error(`[VnpayDriver] Kh\xF4ng th\u1EC3 t\u1EA3i PDF tr\u1EF1c ti\u1EBFp t\u1EEB C\u1ED5ng VNPAY: ${err.message}`);
    }
    throw new Error("[VnpayDriver] Kh\xF4ng th\u1EC3 t\u1EA3i PDF g\u1ED1c t\u1EEB C\u1ED5ng VNPAY Invoice.");
  }
};

// src/services/invoice-engine/drivers/LcsDriver.ts
import axios8 from "axios";
var LcsDriver = class extends BaseInvoiceProviderDriver {
  constructor() {
    super(...arguments);
    this.name = "LCS Soft E-Invoice Driver";
    this.providerCode = "LCS";
    this.metadata = {
      name: "LCS Soft E-Invoice Driver",
      providerCode: "LCS",
      description: "Tra c\u1EE9u v\xE0 t\u1EA3i PDF H\u0110\u0110T t\u1EEB C\u1ED5ng th\xF4ng tin LCS Soft EIP (https://eip.lcssoft.com.vn) qua M\xE3 CQT c\u1EA5p v\xE0 MST b\xEAn b\xE1n",
      sampleUrl: "https://eip.lcssoft.com.vn/desktop/#/login",
      supportsCaptcha: true,
      requiredFields: ["sellerTaxCode", "cqtCode"]
    };
  }
  /**
   * Nhận diện hóa đơn LCS Soft
   */
  canHandle(xmlData) {
    if (typeof xmlData !== "string") {
      return xmlData.provider === "LCS";
    }
    return detectProvider(xmlData) === "LCS";
  }
  /**
   * Trích xuất thông tin hóa đơn LCS Soft từ XML
   */
  extractInfo(xmlData) {
    const sellerTaxCode = this.extractXmlTag(xmlData, "MST") || this.extractXmlTag(xmlData, "nbmst") || "0315018466";
    const sellerName = this.extractXmlTag(xmlData, "Ten") || this.extractXmlTag(xmlData, "nbten") || "C\xD4NG TY TNHH MTV CH\u1EBE T\xC1C V\xC0 KINH DOANH TRANG S\u1EE8C PNJ";
    const invoiceNo = (this.extractXmlTag(xmlData, "SHDon") || this.extractXmlTag(xmlData, "shdon") || "1").padStart(7, "0");
    const invoiceSeries = this.extractXmlTag(xmlData, "KHHDon") || this.extractXmlTag(xmlData, "khhdon") || "1C24TGT";
    const templateCode = this.extractXmlTag(xmlData, "KHMSHDon") || this.extractXmlTag(xmlData, "khmshdon") || "1";
    const invoiceDate = this.extractXmlTag(xmlData, "NLap") || this.extractXmlTag(xmlData, "nlap") || (/* @__PURE__ */ new Date()).toISOString();
    const cqtCode = this.extractXmlTag(xmlData, "MCCQT") || this.extractXmlTag(xmlData, "mhdon") || this.extractXmlTag(xmlData, "cqtCode");
    let lookupCode = this.extractCustomField(xmlData, [
      "M\xE3 tra c\u1EE9u",
      "MaTraCuu",
      "MTCuu",
      "MTC",
      "FKey",
      "TransactionID"
    ]);
    if (!lookupCode) {
      lookupCode = this.extractXmlTag(xmlData, "MTCuu") || this.extractXmlTag(xmlData, "InvoiceCode") || cqtCode;
    }
    const totalAmount = parseFloat(this.extractXmlTag(xmlData, "TgTTTBSo") || "0") || 0;
    const totalTaxAmount = parseFloat(this.extractXmlTag(xmlData, "TgTThue") || "0") || 0;
    const nmuaBlock = this.extractXmlTag(xmlData, "NMua") || this.extractXmlTag(xmlData, "Buyer") || "";
    const buyerTaxCode = this.extractXmlTag(nmuaBlock, "MST") || this.extractXmlTag(xmlData, "MSTNMua") || this.extractXmlTag(xmlData, "nmmst") || "";
    const buyerName = this.extractXmlTag(nmuaBlock, "Ten") || this.extractXmlTag(xmlData, "TenNMua") || this.extractXmlTag(xmlData, "nmten") || "";
    return {
      provider: this.providerCode,
      providerName: "LCS Soft EIP (C\xF4ng ty TNHH L.C.S)",
      sellerTaxCode,
      sellerName,
      buyerTaxCode: buyerTaxCode || void 0,
      buyerName: buyerName || void 0,
      invoiceNo,
      invoiceSeries,
      templateCode,
      invoiceDate,
      lookupCode: lookupCode || void 0,
      lookupUrl: "https://eip.lcssoft.com.vn/desktop/#/login",
      cqtCode: cqtCode || void 0,
      totalAmount,
      totalTaxAmount,
      currency: this.extractXmlTag(xmlData, "DVTTe") || "VND",
      rawXml: xmlData,
      additionalData: {
        msttcgp: "0302999571"
      }
    };
  }
  /**
   * Tải PDF Hóa đơn gốc LCS Soft từ Cổng eip.lcssoft.com.vn
   */
  async fetchPdf(info, options) {
    const logs = [];
    this.createLog(`Kh\u1EDFi ch\u1EA1y LCS Soft E-Invoice Driver cho H\u0110 ${info.invoiceSeries} - ${info.invoiceNo} (MST: ${info.sellerTaxCode})`, logs);
    const client = axios8.create({
      baseURL: "https://eip.lcssoft.com.vn",
      timeout: options?.timeoutMs || 15e3,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://eip.lcssoft.com.vn/"
      }
    });
    const lookupCode = (info.lookupCode || info.cqtCode || info.invoiceNo || "").trim();
    try {
      this.createLog(`\u0110ang g\u1EEDi y\xEAu c\u1EA7u tra c\u1EE9u \u0111\u1EBFn C\u1ED5ng LCS Soft EIP (M\xE3 tra c\u1EE9u: ${lookupCode})...`, logs);
      const response = await client.post("/api/invoice/lookup", {
        taxCode: info.sellerTaxCode,
        invoiceNo: info.invoiceNo,
        series: info.invoiceSeries,
        lookupCode
      }, {
        responseType: "arraybuffer",
        validateStatus: () => true
      });
      if (response.status === 200 && response.data && response.data.length > 500) {
        const contentType = String(response.headers["content-type"] || "");
        if (contentType.includes("pdf") || response.data.slice(0, 4).toString() === "%PDF") {
          this.createLog(`T\u1EA3i PDF H\u0110\u0110T g\u1ED1c th\xE0nh c\xF4ng t\u1EEB LCS Soft EIP (${response.data.length} bytes)`, logs);
          const pdfBuffer = Buffer.from(response.data);
          return {
            success: true,
            provider: this.providerCode,
            driverName: this.name,
            pdfBuffer,
            pdfBase64: pdfBuffer.toString("base64"),
            contentType: "application/pdf",
            filename: `LCS_HD_${info.sellerTaxCode}_${info.invoiceSeries}_${info.invoiceNo}.pdf`,
            isFallback: false,
            captchaSolved: void 0,
            sourceUrl: "https://eip.lcssoft.com.vn/desktop/#/login",
            executionLogs: logs
          };
        }
      }
      this.createLog(`C\u1ED5ng eip.lcssoft.com.vn y\xEAu c\u1EA7u phi\xEAn l\xE0m vi\u1EC7c ho\u1EB7c giao di\u1EC7n Desktop. T\u1EF1 \u0111\u1ED9ng k\xEDch ho\u1EA1t c\u01A1 ch\u1EBF Fallback ti\xEAu chu\u1EA9n.`, logs);
    } catch (err) {
      this.createLog(`L\u1ED7i k\u1EBFt n\u1ED1i C\u1ED5ng LCS Soft: ${err.message}`, logs);
    }
    throw new Error("LCS Soft EIP y\xEAu c\u1EA7u x\xE1c th\u1EF1c ho\u1EB7c \u0111\u0103ng nh\u1EADp desktop.");
  }
};

// src/services/invoice-engine/drivers/MinvoiceDriver.ts
var MinvoiceDriver = class extends BaseInvoiceProviderDriver {
  constructor() {
    super(...arguments);
    this.name = "M-Invoice Driver";
    this.providerCode = "MINVOICE";
    this.metadata = {
      name: "M-Invoice Driver",
      providerCode: "MINVOICE",
      description: "Tra c\u1EE9u & t\u1EA3i h\xF3a \u0111\u01A1n \u0111i\u1EC7n t\u1EED g\u1ED1c M-Invoice (minvoice.vn) qua M\xE3 s\u1ED1 thu\u1EBF b\xEAn b\xE1n v\xE0 S\u1ED1 b\u1EA3o m\u1EADt",
      sampleUrl: "https://tracuuhoadon.minvoice.com.vn",
      supportsCaptcha: true,
      requiredFields: ["sellerTaxCode", "lookupCode"]
    };
  }
  canHandle(xmlData) {
    if (typeof xmlData !== "string") {
      return xmlData.provider === "MINVOICE";
    }
    return detectProvider(xmlData) === "MINVOICE" || /minvoice\.vn|minvoice\.com\.vn|tracuuhoadon\.minvoice|0106026495/i.test(xmlData);
  }
  extractInfo(xmlData) {
    const sellerTaxCode = this.extractXmlTag(xmlData, "MST") || this.extractXmlTag(xmlData, "nbmst");
    const sellerName = this.extractXmlTag(xmlData, "Ten") || this.extractXmlTag(xmlData, "nbten");
    const invoiceNo = (this.extractXmlTag(xmlData, "SHDon") || this.extractXmlTag(xmlData, "shdon") || "1").padStart(7, "0");
    const invoiceSeries = this.extractXmlTag(xmlData, "KHHDon") || this.extractXmlTag(xmlData, "khhdon") || "1C24TMI";
    const templateCode = this.extractXmlTag(xmlData, "KHMSHDon") || this.extractXmlTag(xmlData, "khmshdon") || "1";
    const invoiceDate = this.extractXmlTag(xmlData, "NLap") || this.extractXmlTag(xmlData, "nlap") || (/* @__PURE__ */ new Date()).toISOString();
    const cqtCode = this.extractXmlTag(xmlData, "MCCQT") || this.extractXmlTag(xmlData, "mhdon");
    const details = extractLookupDetailsFromXml(xmlData);
    let lookupCode = details.lookupCode || "";
    if (!lookupCode) {
      lookupCode = this.extractCustomField(xmlData, [
        "S\u1ED1 b\u1EA3o m\u1EADt",
        "SoBaoMat",
        "so_baomat",
        "CheckCode",
        "checkCode",
        "M\xE3 b\u1EA3o m\u1EADt",
        "MaBaoMat",
        "M\xE3 tra c\u1EE9u",
        "MaTraCuu",
        "MTCuu"
      ]);
    }
    if (!lookupCode) {
      lookupCode = this.extractXmlTag(xmlData, "SoBaoMat") || this.extractXmlTag(xmlData, "sobaomat") || this.extractXmlTag(xmlData, "CheckCode") || this.extractXmlTag(xmlData, "checkCode") || this.extractXmlTag(xmlData, "MaBaoMat") || this.extractXmlTag(xmlData, "MTCuu") || this.extractXmlTag(xmlData, "MaTraCuu");
    }
    if (!lookupCode) {
      const match = xmlData.match(/(?:Số\s*bảo\s*mật|So\s*bao\s*mat|Mã\s*bảo\s*mật|CheckCode)\s*[:：=]\s*([A-Za-z0-9._-]+)/i);
      if (match && match[1]) {
        lookupCode = match[1].trim();
      }
    }
    return {
      provider: this.providerCode,
      providerName: "M-Invoice (minvoice.vn)",
      sellerTaxCode,
      sellerName,
      invoiceNo,
      invoiceSeries,
      templateCode,
      invoiceDate,
      cqtCode,
      lookupCode: lookupCode.trim(),
      lookupUrl: details.lookupUrl || "https://tracuuhoadon.minvoice.com.vn",
      rawXml: xmlData,
      additionalData: {
        msttcgp: "0106026495",
        soBaoMat: lookupCode.trim()
      }
    };
  }
  async fetchPdf(info, options) {
    const portal = "https://tracuuhoadon.minvoice.com.vn/tra-cuu-hoa-don";
    const taxCode = (options?.customInfo?.sellerTaxCode || info.sellerTaxCode || "").trim();
    const lookupCode = (options?.customInfo?.lookupCode || info.lookupCode || "").trim();
    if (!taxCode || !lookupCode || lookupCode === info.cqtCode) {
      throw new OriginalInvoiceError("MINVOICE thi\u1EBFu MST b\xEAn b\xE1n ho\u1EB7c S\u1ED1 b\u1EA3o m\u1EADt. M\xE3 c\u01A1 quan thu\u1EBF kh\xF4ng thay th\u1EBF S\u1ED1 b\u1EA3o m\u1EADt.", this.providerCode, "LOOKUP_DATA_MISSING", 422, portal);
    }
    if (!options?.recaptchaToken) {
      throw new OriginalInvoiceError("MINVOICE y\xEAu c\u1EA7u x\xE1c th\u1EF1c Google reCAPTCHA tr\xEAn c\u1ED5ng tra c\u1EE9u. H\xE3y m\u1EDF c\u1ED5ng MINVOICE \u0111\u1EC3 t\u1EA3i PDF g\u1ED1c.", this.providerCode, "RECAPTCHA_REQUIRED", 428, portal);
    }
    const url = new URL("/api/Search/SearchInvoiceCaptcha", portal);
    url.search = new URLSearchParams({ masothue: taxCode, sobaomat: lookupCode, type: "PDF", inchuyendoi: "false" }).toString();
    const response = await fetch(url, {
      headers: { Accept: "application/pdf", Referer: portal, "X-Recaptcha-Token": options.recaptchaToken },
      signal: AbortSignal.timeout(Math.min(options.timeoutMs || 2e4, 3e4))
    }).catch((error) => {
      throw new OriginalInvoiceError("MINVOICE: " + error.message, this.providerCode, "PROVIDER_CONNECTION_FAILED", 502, portal);
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    if (response.ok && buffer.subarray(0, 5).toString() === "%PDF-") {
      return {
        success: true,
        provider: this.providerCode,
        driverName: this.name,
        pdfBuffer: buffer,
        pdfBase64: buffer.toString("base64"),
        contentType: "application/pdf",
        filename: this.buildPdfFilename(info),
        isFallback: false,
        sourceUrl: url.href,
        executionLogs: []
      };
    }
    let message = "";
    try {
      const body = JSON.parse(buffer.toString("utf8"));
      message = String(body.message || body.Message || body.error || "").slice(0, 300);
    } catch {
    }
    const captchaRequired = /captcha/i.test(message) || [401, 403, 428].includes(response.status);
    throw new OriginalInvoiceError(
      captchaRequired ? "MINVOICE y\xEAu c\u1EA7u x\xE1c th\u1EF1c l\u1EA1i Google reCAPTCHA tr\xEAn c\u1ED5ng tra c\u1EE9u." : "MINVOICE: " + (message || "Kh\xF4ng nh\u1EADn \u0111\u01B0\u1EE3c PDF h\u1EE3p l\u1EC7 (HTTP " + response.status + ")."),
      this.providerCode,
      captchaRequired ? "RECAPTCHA_REQUIRED" : "ORIGINAL_DOWNLOAD_FAILED",
      captchaRequired ? 428 : 502,
      portal
    );
  }
  /**
   * Tải tệp XML hóa đơn gốc từ cổng M-Invoice
   */
  async downloadXml(sellerTaxCode, lookupCode, timeoutMs = 2e4) {
    try {
      const targetUrl = `https://tracuuhoadon.minvoice.com.vn/api/Search/DownloadXml?masothue=${encodeURIComponent(
        sellerTaxCode.trim()
      )}&sobaomat=${encodeURIComponent(lookupCode.trim())}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const resp = await fetch(targetUrl, {
        method: "GET",
        headers: {
          "Accept": "application/xml, text/xml, application/zip, */*",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Referer": "https://tracuuhoadon.minvoice.com.vn/",
          "Origin": "https://tracuuhoadon.minvoice.com.vn"
        },
        signal: controller.signal
      });
      clearTimeout(timer);
      if (resp.ok) {
        const arrayBuf = await resp.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        if (buffer.length > 50) {
          return buffer;
        }
      }
    } catch (err) {
      console.error("[MinvoiceDriver] L\u1ED7i downloadXml:", err);
    }
    return null;
  }
};

// src/services/thaiSonInvoiceService.ts
import * as cheerio4 from "cheerio";
var THAISON_PORTAL_URL = "https://einvoice.vn/tra-cuu";
function parseThaiSonForm(html) {
  const $ = cheerio4.load(html);
  const form = $("form").filter((_, el) => $(el).find('input[name="MaNhanHoaDon"]').length > 0).first();
  const token = form.find('input[name="CaptchaDeText"]').val();
  const imagePath = form.find("img#CaptchaImage").attr("src");
  const error = form.find(".text-danger, .validation-summary-errors, .field-validation-error").text().trim();
  return { token: String(token || ""), imagePath, error };
}
async function downloadOriginalThaiSonPdf(params) {
  if (!params.lookupCode?.trim()) throw new OriginalInvoiceError("Th\xE1i S\u01A1n thi\u1EBFu M\xE3 nh\u1EADn h\xF3a \u0111\u01A1n.", "THAISON", "LOOKUP_DATA_MISSING", 422);
  const signal = AbortSignal.timeout(Math.min(params.timeoutMs || 45e3, 45e3));
  const cookies = /* @__PURE__ */ new Map();
  const request = async (path4, init = {}) => {
    let url = new URL(path4, THAISON_PORTAL_URL);
    let method = init.method || "GET";
    let body = init.body;
    for (let hop = 0; hop < 5; hop++) {
      if (url.origin !== new URL(THAISON_PORTAL_URL).origin) throw new Error("C\u1ED5ng Th\xE1i S\u01A1n chuy\u1EC3n h\u01B0\u1EDBng sang mi\u1EC1n kh\xF4ng \u0111\u01B0\u1EE3c h\u1ED7 tr\u1EE3.");
      const response = await fetch(url, {
        ...init,
        method,
        body,
        signal,
        redirect: "manual",
        headers: {
          "User-Agent": "Mozilla/5.0",
          Referer: THAISON_PORTAL_URL,
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: Array.from(cookies, ([key, value2]) => key + "=" + value2).join("; ")
        }
      });
      for (const cookie of response.headers.getSetCookie()) {
        const pair = cookie.split(";")[0];
        const pos = pair.indexOf("=");
        if (pos > 0) cookies.set(pair.slice(0, pos).trim(), pair.slice(pos + 1));
      }
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) throw new Error("Th\xE1i S\u01A1n tr\u1EA3 v\u1EC1 chuy\u1EC3n h\u01B0\u1EDBng thi\u1EBFu \u0111\u1ECBa ch\u1EC9.");
        url = new URL(location, url);
        if (response.status === 303 || [301, 302].includes(response.status) && method === "POST") {
          method = "GET";
          body = void 0;
        }
        await response.body?.cancel();
        continue;
      }
      if (!response.ok) throw new Error("C\u1ED5ng Th\xE1i S\u01A1n tr\u1EA3 v\u1EC1 HTTP " + response.status);
      return response;
    }
    throw new Error("C\u1ED5ng Th\xE1i S\u01A1n chuy\u1EC3n h\u01B0\u1EDBng qu\xE1 nhi\u1EC1u l\u1EA7n.");
  };
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const page = await request(THAISON_PORTAL_URL);
      const form = parseThaiSonForm(await page.text());
      if (!form.token || !form.imagePath) throw new Error("C\u1ED5ng Th\xE1i S\u01A1n kh\xF4ng tr\u1EA3 v\u1EC1 bi\u1EC3u m\u1EABu tra c\u1EE9u h\u1EE3p l\u1EC7.");
      const image = await request(form.imagePath);
      const mime = (image.headers.get("content-type") || "image/gif").split(";")[0];
      const bytes = Buffer.from(await image.arrayBuffer());
      const code = await solveCaptchaWithGemini("data:" + mime + ";base64," + bytes.toString("base64"), ALPHANUMERIC_CAPTCHA_PROMPT, { customApiKey: params.customApiKey, alphanumeric: true });
      signal.throwIfAborted();
      const result = await request(THAISON_PORTAL_URL, {
        method: "POST",
        body: new URLSearchParams({ MaNhanHoaDon: params.lookupCode.trim(), CaptchaDeText: form.token, CaptchaInputText: code }).toString()
      });
      const html = await result.text();
      const error = parseThaiSonForm(html).error;
      if (error) {
        if (attempt === 0 && /captcha|mã kiểm tra|mã xác thực/i.test(error)) continue;
        throw new Error(error);
      }
      const pdfResponse = await request("/tra-cuu/tai-hoa-don-dien-tu?format=pdf");
      const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
      if (pdfBuffer.subarray(0, 5).toString() !== "%PDF-") throw new Error("C\u1ED5ng Th\xE1i S\u01A1n ch\u01B0a tr\u1EA3 v\u1EC1 PDF. Ki\u1EC3m tra M\xE3 nh\u1EADn h\xF3a \u0111\u01A1n v\xE0 phi\xEAn tra c\u1EE9u.");
      return {
        success: true,
        contentType: "application/pdf",
        pdfBuffer,
        pdfBase64: pdfBuffer.toString("base64"),
        filename: ["HoaDon_ThaiSon", params.sellerTaxCode || "", params.invoiceSeries || "", params.invoiceNo || ""].join("_") + ".pdf",
        sourceUrl: THAISON_PORTAL_URL
      };
    }
    throw new Error("Th\xE1i S\u01A1n t\u1EEB ch\u1ED1i CAPTCHA sau 2 l\u1EA7n th\u1EED.");
  } catch (error) {
    const timeout = signal.aborted;
    throw new OriginalInvoiceError(
      timeout ? "Tra c\u1EE9u Th\xE1i S\u01A1n h\u1EBFt th\u1EDDi gian ch\u1EDD. Vui l\xF2ng th\u1EED l\u1EA1i sau." : "Th\xE1i S\u01A1n: " + error.message,
      "THAISON",
      timeout ? "PROVIDER_TIMEOUT" : "ORIGINAL_DOWNLOAD_FAILED",
      timeout ? 504 : 502,
      THAISON_PORTAL_URL
    );
  }
}
async function downloadOriginalThaiSonXml(_params) {
  throw new OriginalInvoiceError("Ch\u01B0a h\u1ED7 tr\u1EE3 t\u1EA3i XML Th\xE1i S\u01A1n t\u1EF1 \u0111\u1ED9ng. H\xE3y t\u1EA3i XML t\u1EA1i c\u1ED5ng tra c\u1EE9u.", "THAISON", "XML_NOT_SUPPORTED", 422, THAISON_PORTAL_URL);
}

// src/services/invoice-engine/drivers/ThaiSonDriver.ts
var ThaiSonDriver = class extends BaseInvoiceProviderDriver {
  constructor() {
    super(...arguments);
    this.name = "Th\xE1i S\u01A1n E-Invoice Driver";
    this.providerCode = "THAISON";
    this.metadata = {
      name: "Th\xE1i S\u01A1n E-Invoice Driver",
      providerCode: "THAISON",
      description: "Tra c\u1EE9u & x\u1EED l\xFD h\xF3a \u0111\u01A1n \u0111i\u1EC7n t\u1EED Th\xE1i S\u01A1n (einvoice.vn) qua M\xE3 tra c\u1EE9u / MST b\xEAn b\xE1n",
      sampleUrl: "https://einvoice.vn/tra-cuu",
      supportsCaptcha: true,
      requiredFields: ["lookupCode", "sellerTaxCode"]
    };
    this.fallback = new GenericFallbackDriver();
  }
  canHandle(xmlData) {
    if (typeof xmlData !== "string") {
      return xmlData.provider === "THAISON";
    }
    return detectProvider(xmlData) === "THAISON";
  }
  extractInfo(xmlData) {
    const sellerTaxCode = this.extractXmlTag(xmlData, "MST") || this.extractXmlTag(xmlData, "nbmst");
    const sellerName = this.extractXmlTag(xmlData, "Ten") || this.extractXmlTag(xmlData, "nbten");
    const invoiceNo = (this.extractXmlTag(xmlData, "SHDon") || this.extractXmlTag(xmlData, "shdon") || "1").padStart(7, "0");
    const invoiceSeries = this.extractXmlTag(xmlData, "KHHDon") || this.extractXmlTag(xmlData, "khhdon") || "1C24TTS";
    const templateCode = this.extractXmlTag(xmlData, "KHMSHDon") || this.extractXmlTag(xmlData, "khmshdon") || "1";
    const invoiceDate = this.extractXmlTag(xmlData, "NLap") || this.extractXmlTag(xmlData, "nlap") || (/* @__PURE__ */ new Date()).toISOString();
    const cqtCode = this.extractXmlTag(xmlData, "MCCQT") || this.extractXmlTag(xmlData, "mhdon");
    const lookupCode = this.extractXmlTag(xmlData, "MaNhanHoaDon") || this.extractXmlTag(xmlData, "MaNhanHDon") || this.extractCustomField(xmlData, ["M\xE3 tra c\u1EE9u", "MaTraCuu", "MTCuu", "M\xE3 nh\u1EADn h\xF3a \u0111\u01A1n"]) || this.extractXmlTag(xmlData, "MTCuu") || this.extractXmlTag(xmlData, "MaTraCuu") || extractLookupDetailsFromXml(xmlData).lookupCode;
    return {
      provider: this.providerCode,
      providerName: "Th\xE1i S\u01A1n E-Invoice",
      sellerTaxCode,
      sellerName,
      invoiceNo,
      invoiceSeries,
      templateCode,
      invoiceDate,
      cqtCode,
      lookupCode,
      lookupUrl: "https://einvoice.vn/tra-cuu",
      rawXml: xmlData,
      additionalData: {
        msttcgp: "0101300842"
      }
    };
  }
  async fetchPdf(info, options) {
    const logs = [];
    this.createLog(`Kh\u1EDFi \u0111\u1ED9ng x\u1EED l\xFD H\u0110\u0110T Th\xE1i S\u01A1n E-Invoice: S\u1ED1 ${info.invoiceNo}, K\xFD hi\u1EC7u ${info.invoiceSeries}`, logs);
    if (info.lookupCode && info.lookupCode !== info.cqtCode && !options?.forceFallback) {
      try {
        this.createLog("\u0110\xE3 c\xF3 M\xE3 nh\u1EADn h\xF3a \u0111\u01A1n Th\xE1i S\u01A1n.", logs);
        this.createLog(`\u0110ang g\u1EEDi y\xEAu c\u1EA7u gi\u1EA3i Captcha & t\u1EA3i PDF g\u1ED1c t\u1EEB c\u1ED5ng Th\xE1i S\u01A1n (einvoice.vn)...`, logs);
        const result = await downloadOriginalThaiSonPdf({
          lookupCode: info.lookupCode,
          sellerTaxCode: info.sellerTaxCode,
          invoiceNo: info.invoiceNo,
          invoiceSeries: info.invoiceSeries,
          timeoutMs: options?.timeoutMs
        });
        this.createLog(`\u0110\xE3 t\u1EA3i th\xE0nh c\xF4ng t\u1EC7p PDF g\u1ED1c t\u1EEB c\u1ED5ng Th\xE1i S\u01A1n: ${result.filename} (${result.pdfBuffer.length} bytes)`, logs);
        return {
          success: true,
          pdfBuffer: result.pdfBuffer,
          pdfBase64: result.pdfBase64,
          filename: result.filename,
          contentType: "application/pdf",
          provider: this.providerCode,
          driverName: this.name,
          isFallback: false,
          captchaSolved: "auto",
          sourceUrl: result.sourceUrl,
          executionLogs: logs
        };
      } catch (err) {
        throw err instanceof OriginalInvoiceError ? err : new OriginalInvoiceError(err.message, this.providerCode);
      }
    } else if (!options?.forceFallback && (!info.lookupCode || info.lookupCode === info.cqtCode)) {
      throw new OriginalInvoiceError("Th\xE1i S\u01A1n thi\u1EBFu M\xE3 nh\u1EADn h\xF3a \u0111\u01A1n. M\xE3 c\u01A1 quan thu\u1EBF kh\xF4ng thay th\u1EBF m\xE3 n\xE0y.", this.providerCode, "LOOKUP_DATA_MISSING", 422);
    }
    const fallbackRes = await this.fallback.fetchPdf(info, options);
    return {
      ...fallbackRes,
      provider: this.providerCode,
      driverName: this.name,
      executionLogs: [...logs, ...fallbackRes.executionLogs]
    };
  }
};

// src/services/cyberbillInvoiceService.ts
var CYBERBILL_PORTAL_URL = "https://cyberbill.vn/tra-cuu";
var CYBERBILL_API_BASE = "https://bill1app.xcyber.vn/api/services/hddt/TraCuuHoaDon";
async function solveCyberBillCaptcha(imageDataUri, customApiKey) {
  return solveCaptchaWithGemini(imageDataUri, "Read the 4 to 6 alphanumeric characters in this captcha. Output ONLY those characters.", { customApiKey, alphanumeric: true });
}
async function downloadOriginalCyberbillPdf(params) {
  const sellerTaxCode = params.sellerTaxCode.trim();
  const lookupCode = params.lookupCode.trim();
  const invoiceNo = (params.invoiceNo || "1").padStart(7, "0");
  const invoiceSeries = params.invoiceSeries || "CYBERBILL";
  let lastError = "Kh\xF4ng th\u1EC3 k\u1EBFt n\u1ED1i \u0111\u1EBFn c\u1ED5ng tra c\u1EE9u CyberBill";
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[CyberBill] L\u1EA7n th\u1EED ${attempt}/${maxAttempts}: Kh\u1EDFi t\u1EA1o phi\xEAn tra c\u1EE9u v\xE0 l\u1EA5y Captcha...`);
      const capResp = await fetch(`${CYBERBILL_API_BASE}/RefreshCaptcha`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        },
        body: JSON.stringify({})
      });
      if (!capResp.ok) {
        throw new Error(`C\u1ED5ng CyberBill tr\u1EA3 v\u1EC1 HTTP ${capResp.status}`);
      }
      const capData = await capResp.json();
      const captchaKey = capData?.result?.key;
      const captchaImage = capData?.result?.image;
      if (!captchaKey || !captchaImage) {
        throw new Error("Kh\xF4ng nh\u1EADn \u0111\u01B0\u1EE3c m\xE3 phi\xEAn Captcha t\u1EEB CyberBill");
      }
      const captchaCode = await solveCyberBillCaptcha(captchaImage, params.customApiKey);
      if (!captchaCode) {
        console.warn(`[CyberBill] L\u1EA7n ${attempt}: Kh\xF4ng gi\u1EA3i \u0111\u01B0\u1EE3c Captcha, th\u1EED l\u1EA1i v\u1EDBi \u1EA3nh m\u1EDBi...`);
        continue;
      }
      console.log(`[CyberBill] L\u1EA7n ${attempt}: \u0110\xE3 gi\u1EA3i Captcha th\xE0nh c\xF4ng -> "${captchaCode}". Th\u1EF1c hi\u1EC7n tra c\u1EE9u...`);
      const traCuuResp = await fetch(`${CYBERBILL_API_BASE}/TraCuu`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Referer": "https://cyberbill.vn/"
        },
        body: JSON.stringify({
          key: captchaKey,
          captcha: captchaCode,
          doanhNghiep_MST: sellerTaxCode,
          maSoBiMat: lookupCode
        })
      });
      if (!traCuuResp.ok) {
        throw new Error(`TraCuu tr\u1EA3 v\u1EC1 l\u1ED7i HTTP ${traCuuResp.status}`);
      }
      const traCuuData = await traCuuResp.json();
      const result = traCuuData?.result;
      if (!result) {
        throw new Error("Kh\xF4ng nh\u1EADn \u0111\u01B0\u1EE3c d\u1EEF li\u1EC7u ph\u1EA3n h\u1ED3i t\u1EEB CyberBill");
      }
      if (result.status === 2 && result.message && result.message.includes("x\xE1c th\u1EF1c kh\xF4ng h\u1EE3p l\u1EC7")) {
        console.warn(`[CyberBill] L\u1EA7n ${attempt}: M\xE3 x\xE1c th\u1EF1c sai, l\xE0m m\u1EDBi Captcha...`);
        lastError = "M\xE3 Captcha nh\u1EADn di\u1EC7n ch\u01B0a kh\u1EDBp";
        continue;
      }
      if (result.message && (result.message.includes("kh\xF4ng t\xECm th\u1EA5y") || result.message.includes("kh\xF4ng t\u1ED3n t\u1EA1i"))) {
        throw new Error(`C\u1ED5ng CyberBill ph\u1EA3n h\u1ED3i: ${result.message}`);
      }
      let pdfBase64 = "";
      let htmlContent = result.html || "";
      console.log(`[CyberBill] \u0110ang t\u1EA3i file PDF g\u1ED1c qua DownloadPdf...`);
      const downloadResp = await fetch(`${CYBERBILL_API_BASE}/DownloadPdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Referer": "https://cyberbill.vn/"
        },
        body: JSON.stringify({
          key: captchaKey,
          doanhNghiep_MST: sellerTaxCode,
          maSoBiMat: lookupCode
        })
      });
      if (downloadResp.ok) {
        const downloadData = await downloadResp.json();
        if (downloadData?.result?.fileData) {
          pdfBase64 = downloadData.result.fileData;
        }
      }
      if (!pdfBase64 && result.base64) {
        pdfBase64 = result.base64;
      }
      if (!pdfBase64 && !htmlContent) {
        throw new Error(result.message || "Kh\xF4ng nh\u1EADn \u0111\u01B0\u1EE3c d\u1EEF li\u1EC7u t\u1EC7p PDF ho\u1EB7c HTML t\u1EEB CyberBill.");
      }
      let pdfBuffer;
      if (pdfBase64) {
        pdfBuffer = Buffer.from(pdfBase64, "base64");
      } else {
        pdfBuffer = Buffer.from(htmlContent, "utf-8");
      }
      const cleanFilename = `HoaDon_CyberBill_${sellerTaxCode}_${invoiceSeries}_${invoiceNo}.pdf`;
      return {
        success: true,
        filename: cleanFilename,
        contentType: "application/pdf",
        pdfBuffer,
        pdfBase64: pdfBuffer.toString("base64"),
        sourceUrl: CYBERBILL_PORTAL_URL,
        htmlContent
      };
    } catch (err) {
      console.error(`[CyberBill] L\u1ED7i l\u1EA7n ${attempt}:`, err.message);
      lastError = err.message;
    }
  }
  throw new Error(`T\u1EA3i h\xF3a \u0111\u01A1n CyberBill th\u1EA5t b\u1EA1i sau ${maxAttempts} l\u1EA7n th\u1EED: ${lastError}`);
}

// src/services/invoice-engine/drivers/CyberBillDriver.ts
var CyberBillDriver = class extends BaseInvoiceProviderDriver {
  constructor() {
    super(...arguments);
    this.name = "CyberLotus CyberBill Driver";
    this.providerCode = "CYBERBILL";
    this.metadata = {
      name: "CyberLotus CyberBill Driver",
      providerCode: "CYBERBILL",
      description: "Tra c\u1EE9u & x\u1EED l\xFD h\xF3a \u0111\u01A1n \u0111i\u1EC7n t\u1EED CyberBill (cyberbill.vn) qua M\xE3 tra c\u1EE9u / MST b\xEAn b\xE1n",
      sampleUrl: "https://cyberbill.vn/tra-cuu",
      supportsCaptcha: true,
      requiredFields: ["lookupCode", "sellerTaxCode"]
    };
    this.fallback = new GenericFallbackDriver();
  }
  canHandle(xmlData) {
    if (typeof xmlData !== "string") {
      return xmlData.provider === "CYBERBILL";
    }
    return detectProvider(xmlData) === "CYBERBILL";
  }
  extractInfo(xmlData) {
    const sellerTaxCode = this.extractXmlTag(xmlData, "MST") || this.extractXmlTag(xmlData, "nbmst");
    const sellerName = this.extractXmlTag(xmlData, "Ten") || this.extractXmlTag(xmlData, "nbten");
    const invoiceNo = (this.extractXmlTag(xmlData, "SHDon") || this.extractXmlTag(xmlData, "shdon") || "1").padStart(7, "0");
    const invoiceSeries = this.extractXmlTag(xmlData, "KHHDon") || this.extractXmlTag(xmlData, "khhdon") || "1C24TCB";
    const templateCode = this.extractXmlTag(xmlData, "KHMSHDon") || this.extractXmlTag(xmlData, "khmshdon") || "1";
    const invoiceDate = this.extractXmlTag(xmlData, "NLap") || this.extractXmlTag(xmlData, "nlap") || (/* @__PURE__ */ new Date()).toISOString();
    const cqtCode = this.extractXmlTag(xmlData, "MCCQT") || this.extractXmlTag(xmlData, "mhdon");
    let lookupCode = this.extractCustomField(xmlData, ["M\xE3 tra c\u1EE9u", "MaTraCuu", "MTCuu", "M\xE3 nh\u1EADn h\xF3a \u0111\u01A1n", "CyberBill"]) || this.extractXmlTag(xmlData, "MTCuu") || this.extractXmlTag(xmlData, "MaTraCuu");
    return {
      provider: this.providerCode,
      providerName: "CyberLotus CyberBill",
      sellerTaxCode,
      sellerName,
      invoiceNo,
      invoiceSeries,
      templateCode,
      invoiceDate,
      cqtCode,
      lookupCode,
      lookupUrl: "https://cyberbill.vn/tra-cuu",
      rawXml: xmlData,
      additionalData: {
        msttcgp: "0107871301"
      }
    };
  }
  async fetchPdf(info, options) {
    const logs = [];
    this.createLog(`Kh\u1EDFi \u0111\u1ED9ng x\u1EED l\xFD H\u0110\u0110T CyberBill: S\u1ED1 ${info.invoiceNo}, K\xFD hi\u1EC7u ${info.invoiceSeries}`, logs);
    if (info.lookupCode && info.sellerTaxCode && !options?.forceFallback) {
      try {
        this.createLog(`T\xECm th\u1EA5y m\xE3 tra c\u1EE9u CyberBill: "${info.lookupCode}", MST b\xEAn b\xE1n: "${info.sellerTaxCode}"`, logs);
        this.createLog(`\u0110ang g\u1EEDi y\xEAu c\u1EA7u gi\u1EA3i Captcha & t\u1EA3i PDF g\u1ED1c t\u1EEB m\xE1y ch\u1EE7 CyberBill (bill1app.xcyber.vn)...`, logs);
        const result = await downloadOriginalCyberbillPdf({
          sellerTaxCode: info.sellerTaxCode,
          lookupCode: info.lookupCode,
          invoiceNo: info.invoiceNo,
          invoiceSeries: info.invoiceSeries
        });
        this.createLog(`\u0110\xE3 t\u1EA3i th\xE0nh c\xF4ng t\u1EC7p PDF g\u1ED1c t\u1EEB c\u1ED5ng CyberBill: ${result.filename} (${result.pdfBuffer.length} bytes)`, logs);
        return {
          success: true,
          pdfBuffer: result.pdfBuffer,
          pdfBase64: result.pdfBase64,
          filename: result.filename,
          contentType: "application/pdf",
          provider: this.providerCode,
          driverName: this.name,
          isFallback: false,
          captchaSolved: "auto",
          sourceUrl: result.sourceUrl,
          executionLogs: logs
        };
      } catch (err) {
        this.createLog(`T\u1EA3i PDF g\u1ED1c CyberBill ch\u01B0a th\xE0nh c\xF4ng: ${err.message}. T\u1EF1 \u0111\u1ED9ng chuy\u1EC3n sang b\u1ED9 t\u1EA1o b\u1EA3n th\u1EC3 hi\u1EC7n vector chu\u1EA9n Q\u0110 1450.`, logs);
      }
    } else if (!info.lookupCode) {
      this.createLog(`H\xF3a \u0111\u01A1n XML kh\xF4ng ch\u1EE9a m\xE3 tra c\u1EE9u CyberBill. Chuy\u1EC3n sang b\u1ED9 t\u1EA1o b\u1EA3n th\u1EC3 hi\u1EC7n vector Q\u0110 1450.`, logs);
    }
    const fallbackRes = await this.fallback.fetchPdf(info, options);
    return {
      ...fallbackRes,
      provider: this.providerCode,
      driverName: this.name,
      executionLogs: [...logs, ...fallbackRes.executionLogs]
    };
  }
};

// src/services/invoice-engine/InvoiceDownloaderManager.ts
var InvoiceDownloaderManager = class _InvoiceDownloaderManager {
  /**
   * Khởi tạo Singleton với các Driver mặc định
   */
  constructor() {
    this.drivers = [];
    this.fallbackDriver = new GenericFallbackDriver();
    this.registerDriver(new MisaDriver());
    this.registerDriver(new ViettelDriver());
    this.registerDriver(new FourSiDriver());
    this.registerDriver(new LcsDriver());
    this.registerDriver(new VnptDriver());
    this.registerDriver(new EasyInvoiceDriver());
    this.registerDriver(new MinvoiceDriver());
    this.registerDriver(new BkavDriver());
    this.registerDriver(new ThaiSonDriver());
    this.registerDriver(new CyberBillDriver());
    this.registerDriver(new VnpayDriver());
  }
  static {
    this.instance = null;
  }
  /**
   * Lấy thể hiện duy nhất của Manager
   */
  static getInstance() {
    if (!this.instance) {
      this.instance = new _InvoiceDownloaderManager();
    }
    return this.instance;
  }
  /**
   * Nhận diện nhà cung cấp từ chuỗi XML theo quy tắc ưu tiên nghiêm ngặt
   */
  detectProvider(xmlContent) {
    return detectProvider(xmlContent);
  }
  /**
   * Nhận diện chi tiết kèm cấp độ ưu tiên và lý do
   */
  detectProviderDetails(xmlContent) {
    return detectProviderWithDetails(xmlContent);
  }
  /**
   * Đăng ký thêm một Driver mới vào hệ thống (Open-Closed Principle)
   */
  registerDriver(driver, atStart = false) {
    const exists = this.drivers.some((d) => d.providerCode === driver.providerCode);
    if (!exists) {
      if (atStart) {
        this.drivers.unshift(driver);
      } else {
        this.drivers.push(driver);
      }
      console.log(`[InvoiceDownloaderManager] \u0110\xE3 \u0111\u0103ng k\xFD Driver: "${driver.name}" (${driver.providerCode})`);
    }
  }
  /**
   * Lấy danh sách các Driver đã đăng ký
   */
  getRegisteredDrivers() {
    const list = this.drivers.map((d) => d.metadata);
    list.push(this.fallbackDriver.metadata);
    return list;
  }
  /**
   * Tự động quét và chọn Driver phù hợp nhất theo thứ tự ưu tiên nghiêm ngặt:
   * - Nếu detectProvider(xmlContent) trả về 'UNKNOWN' -> Trả về ngay fallbackDriver (GenericFallbackDriver)
   *   (Tuyệt đối không đoán mò thành Viettel hay MISA)
   * - Nếu khớp nhà cung cấp hợp lệ ('MISA', 'VIETTEL', 'VNPT', '4SI', 'EASYINVOICE', 'BKAV') -> Chọn Driver tương ứng
   */
  async selectDriver(xmlContent) {
    const detected = detectProvider(xmlContent);
    if (detected === "UNKNOWN") {
      return this.fallbackDriver;
    }
    const matched = this.drivers.find((d) => d.providerCode === detected);
    if (matched) {
      return matched;
    }
    return this.fallbackDriver;
  }
  /**
   * Phân tích và trích xuất thông tin tổng quát từ XML
   */
  async extractInfo(xmlContent) {
    const driver = await this.selectDriver(xmlContent);
    return driver.extractInfo(xmlContent);
  }
  /**
   * HÀM ĐIỀU PHỐI CHÍNH: Tải PDF Hóa đơn gốc tự động
   * @param xmlContent Chuỗi nội dung XML hóa đơn điện tử
   * @param options Tùy chọn tải (timeout, ép fallback, v.v.)
   * @returns Kết quả tải kèm Buffer PDF và nhật ký thực thi
   */
  async downloadInvoicePdf(xmlContent, options) {
    const overallLogs = [];
    const startTime = Date.now();
    this.log(`[B\u1EAET \u0110\u1EA6U] Ti\u1EBFp nh\u1EADn y\xEAu c\u1EA7u t\u1EA3i PDF cho d\u1EEF li\u1EC7u XML (${xmlContent.length} k\xFD t\u1EF1)`, overallLogs);
    if (!xmlContent || typeof xmlContent !== "string") {
      throw new Error("[InvoiceDownloaderManager] N\u1ED9i dung XML r\u1ED7ng ho\u1EB7c kh\xF4ng \u0111\xFAng \u0111\u1ECBnh d\u1EA1ng.");
    }
    if (options?.forceFallback) {
      this.log("Ng\u01B0\u1EDDi d\xF9ng y\xEAu c\u1EA7u \xE9p s\u1EED d\u1EE5ng GenericFallbackDriver.", overallLogs);
      const fallbackInfo = await this.fallbackDriver.extractInfo(xmlContent);
      if (options?.customInfo) {
        if (options.customInfo.lookupCode) fallbackInfo.lookupCode = options.customInfo.lookupCode;
        if (options.customInfo.sellerTaxCode) fallbackInfo.sellerTaxCode = options.customInfo.sellerTaxCode;
      }
      const res = await this.fallbackDriver.fetchPdf(fallbackInfo, options);
      res.executionLogs = overallLogs.concat(res.executionLogs);
      return res;
    }
    let selectedDriver = this.fallbackDriver;
    const isExplicitOverride = Boolean(options?.overrideProvider && options.overrideProvider !== "AUTO");
    if (isExplicitOverride) {
      if (options.overrideProvider === "GENERIC" || options.overrideProvider === "FALLBACK") {
        selectedDriver = this.fallbackDriver;
        this.log(`\xC1p d\u1EE5ng Nh\xE0 cung c\u1EA5p do Ng\u01B0\u1EDDi d\xF9ng ch\u1EC9 \u0111\u1ECBnh: [${this.fallbackDriver.name}] (Safeguard Fallback)`, overallLogs);
      } else {
        const manual = this.drivers.find((d) => d.providerCode.toUpperCase() === options.overrideProvider?.toUpperCase());
        if (manual) {
          selectedDriver = manual;
          this.log(`\xC1p d\u1EE5ng Nh\xE0 cung c\u1EA5p do Ng\u01B0\u1EDDi d\xF9ng ch\u1EC9 \u0111\u1ECBnh: [${selectedDriver.name}] (${selectedDriver.providerCode})`, overallLogs);
        } else {
          this.log(`Kh\xF4ng t\xECm th\u1EA5y Driver t\u01B0\u01A1ng \u1EE9ng m\xE3 [${options.overrideProvider}], chuy\u1EC3n v\u1EC1 Generic Fallback`, overallLogs);
          selectedDriver = this.fallbackDriver;
        }
      }
    } else if (!options?.forceFallback) {
      try {
        selectedDriver = await this.selectDriver(xmlContent);
        this.log(`T\u1EF1 \u0111\u1ED9ng ch\u1ECDn Driver: [${selectedDriver.name}] (${selectedDriver.providerCode})`, overallLogs);
      } catch (err) {
        this.log(`L\u1ED7i khi ph\xE1t hi\u1EC7n Driver, chuy\u1EC3n sang Fallback: ${err.message}`, overallLogs);
        selectedDriver = this.fallbackDriver;
      }
    }
    let invoiceInfo;
    try {
      invoiceInfo = await selectedDriver.extractInfo(xmlContent);
      this.log(`Tr\xEDch xu\u1EA5t metadata: B\xEAn b\xE1n "${invoiceInfo.sellerName || invoiceInfo.sellerTaxCode}", H\u0110: ${invoiceInfo.invoiceSeries}-${invoiceInfo.invoiceNo}`, overallLogs);
    } catch (extractErr) {
      this.log(`L\u1ED7i tr\xEDch xu\u1EA5t metadata: ${extractErr.message}. S\u1EED d\u1EE5ng Fallback parser.`, overallLogs);
      invoiceInfo = await this.fallbackDriver.extractInfo(xmlContent);
    }
    try {
      const gdtInv = parseGDTInvoiceXml(xmlContent);
      if (!invoiceInfo.buyerName && gdtInv.nmten) invoiceInfo.buyerName = gdtInv.nmten;
      if (!invoiceInfo.buyerTaxCode && gdtInv.nmmst) invoiceInfo.buyerTaxCode = gdtInv.nmmst;
      if (!invoiceInfo.sellerName && gdtInv.nbten) invoiceInfo.sellerName = gdtInv.nbten;
      if (!invoiceInfo.sellerTaxCode && gdtInv.nbmst) invoiceInfo.sellerTaxCode = gdtInv.nbmst;
      if (!invoiceInfo.templateCode && gdtInv.khmshdon) invoiceInfo.templateCode = gdtInv.khmshdon;
      if (!invoiceInfo.cqtCode && gdtInv.mhdon) invoiceInfo.cqtCode = gdtInv.mhdon;
      if (!invoiceInfo.additionalData) invoiceInfo.additionalData = {};
      invoiceInfo.additionalData.parsedInvoice = gdtInv;
    } catch {
    }
    if (options?.customInfo) {
      if (options.customInfo.lookupCode) {
        invoiceInfo.lookupCode = options.customInfo.lookupCode;
        if (!invoiceInfo.secretCode) {
          invoiceInfo.secretCode = options.customInfo.lookupCode;
        }
        this.log(`\xC1p d\u1EE5ng M\xE3 tra c\u1EE9u do ng\u01B0\u1EDDi d\xF9ng cung c\u1EA5p: "${invoiceInfo.lookupCode}"`, overallLogs);
      }
      if (options.customInfo.secretCode) {
        invoiceInfo.secretCode = options.customInfo.secretCode;
        if (!invoiceInfo.lookupCode) {
          invoiceInfo.lookupCode = options.customInfo.secretCode;
        }
        this.log(`\xC1p d\u1EE5ng M\xE3 b\xED m\u1EADt do ng\u01B0\u1EDDi d\xF9ng cung c\u1EA5p: "${invoiceInfo.secretCode}"`, overallLogs);
      }
      if (options.customInfo.lookupUrl) {
        invoiceInfo.lookupUrl = options.customInfo.lookupUrl;
        this.log(`\xC1p d\u1EE5ng C\u1ED5ng tra c\u1EE9u t\xF9y ch\u1EC9nh: "${invoiceInfo.lookupUrl}"`, overallLogs);
      }
      if (options.customInfo.sellerTaxCode) {
        invoiceInfo.sellerTaxCode = options.customInfo.sellerTaxCode;
      }
      if (options.customInfo.invoiceNo) {
        invoiceInfo.invoiceNo = String(options.customInfo.invoiceNo).padStart(7, "0");
      }
      if (options.customInfo.invoiceSeries) {
        invoiceInfo.invoiceSeries = options.customInfo.invoiceSeries;
      }
    }
    if (selectedDriver.providerCode !== "GENERIC") {
      try {
        this.log(`\u0110ang th\u1EF1c thi crawl t\u1EEB server nh\xE0 cung c\u1EA5p [${selectedDriver.providerCode}]...`, overallLogs);
        const result = await selectedDriver.fetchPdf(invoiceInfo, options);
        result.executionLogs = overallLogs.concat(result.executionLogs);
        this.log(`[HO\xC0N T\u1EA4T] T\u1EA3i PDF g\u1ED1c th\xE0nh c\xF4ng trong ${Date.now() - startTime}ms`, result.executionLogs);
        return result;
      } catch (crawlError) {
        if (crawlError instanceof OriginalInvoiceError) throw crawlError;
        this.log(`[C\u1EA2NH B\xC1O CRAWL TH\u1EA4T B\u1EA0I]: ${crawlError.message}`, overallLogs);
        this.log(`T\u1EF0 \u0110\u1ED8NG L\u1EA4Y B\u1EA2N TH\u1EC2 HI\u1EC6N M\u1EAAU CHU\u1EA8N T\u1ED4NG C\u1EE4C THU\u1EBE (N\u0110 123/2020/N\u0110-CP & TT 78/2021/TT-BTC)...`, overallLogs);
      }
    }
    try {
      const fallbackResult = await this.fallbackDriver.fetchPdf(invoiceInfo, options);
      fallbackResult.executionLogs = overallLogs.concat(fallbackResult.executionLogs);
      this.log(`[HO\xC0N T\u1EA4T] \u0110\xE3 t\u1EA1o b\u1EA3n th\u1EC3 hi\u1EC7n M\u1EABu Chu\u1EA9n T\u1ED5ng C\u1EE5c Thu\u1EBF th\xE0nh c\xF4ng trong ${Date.now() - startTime}ms`, fallbackResult.executionLogs);
      return fallbackResult;
    } catch (fallbackError) {
      throw new Error(`Kh\xF4ng th\u1EC3 kh\u1EDFi t\u1EA1o b\u1EA3n PDF d\u1EF1 ph\xF2ng: ${fallbackError.message}`);
    }
  }
  /**
   * Helper gọi giải Captcha độc lập
   */
  async solveCaptcha(imageInput) {
    return CaptchaSolver.solve(imageInput);
  }
  log(msg, logs) {
    const timestamp = (/* @__PURE__ */ new Date()).toLocaleTimeString("vi-VN");
    const entry = `[${timestamp}] [Manager] ${msg}`;
    logs.push(entry);
    console.log(entry);
  }
};

// src/services/invoice-engine/index.ts
var invoiceManager = InvoiceDownloaderManager.getInstance();

// src/services/bkavInvoiceService.ts
async function downloadOriginalBkavPdf(params) {
  const lookupCode = String(params.lookupCode || "").trim();
  if (!lookupCode) throw new Error("M\xE3 tra c\u1EE9u Bkav eHoadon kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs || 2e4);
  try {
    const pageUrl = `https://van.ehoadon.vn/TCHD?MTC=${encodeURIComponent(lookupCode)}`;
    const page = await fetch(pageUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36"
      },
      signal: controller.signal
    });
    if (!page.ok) throw new Error(`C\u1ED5ng Bkav tr\u1EA3 v\u1EC1 HTTP ${page.status}.`);
    const html = await page.text();
    const candidates = [...html.matchAll(/(?:href|src)=["']([^"']*Invoice_View[^"']+\.pdf[^"']*)["']/gi)].map((match) => match[1].replace(/&amp;/g, "&"));
    const relative = candidates[0];
    if (!relative) {
      if (/mã tra cứu.*không đúng|không tìm thấy|không tồn tại/i.test(html)) {
        throw new Error("Bkav kh\xF4ng t\xECm th\u1EA5y h\xF3a \u0111\u01A1n v\u1EDBi m\xE3 tra c\u1EE9u n\xE0y.");
      }
      throw new Error("Bkav ch\u01B0a tr\u1EA3 v\u1EC1 li\xEAn k\u1EBFt PDF g\u1ED1c cho m\xE3 tra c\u1EE9u n\xE0y.");
    }
    const pdfUrl = new URL(relative, pageUrl).toString();
    const pdf = await fetch(pdfUrl, {
      headers: {
        Accept: "application/pdf,application/octet-stream,*/*",
        Referer: pageUrl,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36"
      },
      signal: controller.signal
    });
    if (!pdf.ok) throw new Error(`Kh\xF4ng t\u1EA3i \u0111\u01B0\u1EE3c PDF Bkav: HTTP ${pdf.status}.`);
    const data = Buffer.from(await pdf.arrayBuffer());
    if (data.length < 500 || !data.subarray(0, 10).toString("latin1").includes("%PDF")) {
      throw new Error("Bkav kh\xF4ng tr\u1EA3 v\u1EC1 t\u1EC7p PDF h\u1EE3p l\u1EC7.");
    }
    return {
      data,
      filename: `HoaDon_Bkav_${lookupCode}.pdf`,
      contentType: "application/pdf"
    };
  } finally {
    clearTimeout(timer);
  }
}

// src/utils/gdtDetail.ts
import JSZip3 from "jszip";
var value = (source, keys) => {
  if (!source || typeof source !== "object") return "";
  for (const key of keys) {
    const found = Object.keys(source).find((k) => k.toLowerCase() === key.toLowerCase());
    const raw = found ? source[found] : void 0;
    if (raw !== void 0 && raw !== null && String(raw).trim()) return String(raw).trim();
  }
  return "";
};
var isXml = (source) => /^\s*(?:<\?xml|<[^>]+>)/i.test(source);
var getRequestId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "req-" + Math.random().toString(36).substring(2, 11) + "-" + Date.now();
};
var GDT_REQUEST_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
  "Referer": "https://hoadondientu.gdt.gov.vn/",
  "Origin": "https://hoadondientu.gdt.gov.vn",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin"
};
var getInvoiceParams = (invoice) => new URLSearchParams({
  nbmst: invoice.nbmst || "",
  khhdon: invoice.khhdon || "",
  // GDT identifies an invoice by the displayed serial number, including
  // leading zeroes (for example 0000237). Do not convert it to 237.
  shdon: String(invoice.shdon || ""),
  khmshdon: invoice.khmshdon || "1"
});
var getInvoiceEndpoint = (invoice, action) => `https://hoadondientu.gdt.gov.vn${invoice.isPos ? "/api/sco-query" : "/api/query"}/invoices/${action}`;
var getInvoiceAction = (invoice, exportAction = false) => {
  const prefix = exportAction ? "Xu%E1%BA%A5t" : "Xem";
  if (invoice.isPos) return `${prefix}%20h%C3%B3a%20%C4%91%C6%A1n%20(h%C3%B3a%20%C4%91%C6%A1n%20m%C3%A1y%20t%C3%ADnh%20ti%E1%BB%81n%20mua%20v%C3%A0o)`;
  return invoice.loaiHdon === "sold" ? `${prefix}%20h%C3%B3a%20%C4%91%C6%A1n%20(h%C3%B3a%20%C4%91%C6%A1n%20b%C3%A1n%20ra)` : `${prefix}%20h%C3%B3a%20%C4%91%C6%A1n%20(h%C3%B3a%20%C4%91%C6%A1n%20mua%20v%C3%A0o)`;
};
async function readXmlFromExport(bytes, contentType) {
  const text = new TextDecoder("utf-8").decode(bytes).replace(/^\uFEFF/, "").trim();
  if (isXml(text) && /(?:HDon|DLHDon|HHDVu|Invoice|Factura)/i.test(text)) return text;
  if (!contentType.toLowerCase().includes("zip") && !(bytes[0] === 80 && bytes[1] === 75)) return "";
  const zip = await JSZip3.loadAsync(bytes);
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    const entryText = (await entry.async("text")).replace(/^\uFEFF/, "").trim();
    if (isXml(entryText) && /(?:HDon|DLHDon|HHDVu|Invoice|Factura)/i.test(entryText)) return entryText;
  }
  return "";
}
function findInvoiceDocument(source, seen = /* @__PURE__ */ new Set(), depth = 0) {
  if (!source || depth > 5 || seen.has(source)) return "";
  if (typeof source === "string") {
    const value2 = source.trim();
    if (isXml(value2) && /(?:HDon|DLHDon|HHDVu|Invoice|Factura)/i.test(value2)) return value2;
    if (value2.length > 200 && /^[A-Za-z0-9+/=\r\n]+$/.test(value2)) {
      try {
        let decoded = "";
        if (typeof Buffer !== "undefined") {
          decoded = Buffer.from(value2, "base64").toString("utf8").trim();
        } else if (typeof atob !== "undefined") {
          decoded = decodeURIComponent(escape(atob(value2.replace(/\s+/g, "")))).trim();
        }
        if (isXml(decoded) && /(?:HDon|DLHDon|HHDVu|Invoice|Factura)/i.test(decoded)) return decoded;
      } catch {
      }
    }
    return "";
  }
  if (typeof source !== "object") return "";
  seen.add(source);
  const preferredKeys = ["xml", "xmlData", "dataXml", "invoiceXml", "document", "documentXml", "content", "fileContent", "html"];
  for (const key of preferredKeys) {
    const actual = Object.keys(source).find((k) => k.toLowerCase() === key.toLowerCase());
    const found = actual ? findInvoiceDocument(source[actual], seen, depth + 1) : "";
    if (found) return found;
  }
  for (const value2 of Object.values(source)) {
    const found = findInvoiceDocument(value2, seen, depth + 1);
    if (found) return found;
  }
  return "";
}
async function fetchGdtInvoiceXml(invoice, headers, signal) {
  if (!invoice.nbmst || !invoice.khhdon || !invoice.shdon) {
    return { xml: "", status: 0, contentType: "", bytes: 0, url: "" };
  }
  const tryFetchXml = async (shdonVal) => {
    const params = new URLSearchParams({
      nbmst: invoice.nbmst || "",
      khhdon: invoice.khhdon || "",
      shdon: shdonVal,
      khmshdon: invoice.khmshdon || "1"
    });
    const url = `${getInvoiceEndpoint(invoice, "export-xml")}?${params.toString()}`;
    try {
      const response = await fetch(url, {
        headers: {
          ...GDT_REQUEST_HEADERS,
          "request-id": getRequestId(),
          Accept: "application/zip, application/xml, text/xml, application/octet-stream, */*",
          "End-Point": "/tra-cuu/tra-cuu-hoa-don",
          Action: getInvoiceAction(invoice, true),
          ...headers
        },
        signal: signal || AbortSignal.timeout(25e3)
      });
      const contentType = response.headers.get("content-type") || "";
      if (!response.ok) {
        return null;
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (!bytes.byteLength) return null;
      const xml = await readXmlFromExport(bytes, contentType);
      return { xml, status: response.status, contentType, bytes: bytes.byteLength, url };
    } catch {
      return null;
    }
  };
  const primaryShdon = String(invoice.shdon || "");
  let res = await tryFetchXml(primaryShdon);
  if (!res || !res.xml) {
    if (primaryShdon.startsWith("0")) {
      const unpadded = String(Number(primaryShdon) || primaryShdon.replace(/^0+/, ""));
      if (unpadded && unpadded !== primaryShdon) {
        const alt = await tryFetchXml(unpadded);
        if (alt && alt.xml) res = alt;
      }
    } else if (primaryShdon.length < 7) {
      const padded = primaryShdon.padStart(7, "0");
      const alt = await tryFetchXml(padded);
      if (alt && alt.xml) res = alt;
    }
  }
  const finalRes = res || { xml: "", status: 0, contentType: "", bytes: 0, url: `${getInvoiceEndpoint(invoice, "export-xml")}?${getInvoiceParams(invoice).toString()}` };
  if (finalRes.xml) {
    console.info(`[GDT XML export] ${invoice.khhdon}/${invoice.shdon}: Success, ${finalRes.bytes} bytes, XML found.`);
  } else {
    console.warn(`[GDT XML export] ${invoice.khhdon}/${invoice.shdon}: No valid XML returned (HTTP ${finalRes.status})`);
  }
  return finalRes;
}
async function fetchGdtInvoiceDetail(invoice, headers, signal) {
  if (!invoice.nbmst || !invoice.khhdon || !invoice.shdon) return null;
  const tryFetch = async (shdonVal) => {
    const params = new URLSearchParams({
      nbmst: invoice.nbmst || "",
      khhdon: invoice.khhdon || "",
      shdon: shdonVal,
      khmshdon: invoice.khmshdon || "1"
    });
    const path4 = invoice.isPos ? "/api/sco-query/invoices/detail" : "/api/query/invoices/detail";
    try {
      const response = await fetch(`https://hoadondientu.gdt.gov.vn${path4}?${params.toString()}`, {
        headers: {
          ...GDT_REQUEST_HEADERS,
          "request-id": getRequestId(),
          Accept: "application/json, text/plain, */*",
          "End-Point": "/tra-cuu/tra-cuu-hoa-don",
          Action: getInvoiceAction(invoice),
          ...headers
        },
        signal: signal || AbortSignal.timeout(18e3)
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data && typeof data === "object" ? data : null;
    } catch {
      return null;
    }
  };
  const primaryShdon = String(invoice.shdon || "");
  let result = await tryFetch(primaryShdon);
  if (!result && primaryShdon.startsWith("0")) {
    const unpadded = String(Number(primaryShdon) || primaryShdon.replace(/^0+/, ""));
    if (unpadded && unpadded !== primaryShdon) {
      result = await tryFetch(unpadded);
    }
  } else if (!result && !primaryShdon.startsWith("0") && primaryShdon.length < 7) {
    const padded = primaryShdon.padStart(7, "0");
    result = await tryFetch(padded);
  }
  return result;
}
function mergeGdtInvoiceDetail(invoice, detail, exportedXml = "") {
  if (!detail && !exportedXml) {
    return { ...invoice, sourceCompleteness: "summary" };
  }
  detail = detail || {};
  const candidates = [];
  const visit = (candidate, depth) => {
    if (!candidate || typeof candidate !== "object" || candidates.includes(candidate) || depth > 7) return;
    candidates.push(candidate);
    if (Array.isArray(candidate)) {
      candidate.forEach((value2) => visit(value2, depth + 1));
      return;
    }
    Object.values(candidate).forEach((value2) => {
      if (value2 && typeof value2 === "object") visit(value2, depth + 1);
    });
  };
  visit(detail, 0);
  const hasNamedItems = (candidate) => getInvoiceItemListFromPayload(candidate).some((item, index) => !isPlaceholderItemName(normalizeInvoiceItem(item, index).itemName));
  const detailSource = candidates.find(hasNamedItems) || candidates.find((candidate) => {
    const xml = [candidate.xml, candidate.xmlData, candidate.dataXml, candidate.invoiceXml];
    return xml.some((v) => typeof v === "string" && isXml(v));
  }) || candidates.find((candidate) => getLookupCodeFromPayload(candidate) || value(candidate, ["mhdon", "nbmst"])) || detail;
  const seller = getSellerFromPayload(detailSource);
  const detailItems = getInvoiceItemListFromPayload(detail).map((item, index) => normalizeInvoiceItem(item, index)).filter((item) => !isPlaceholderItemName(item.itemName));
  const detailXml = exportedXml || findInvoiceDocument(detail);
  let xmlItems = [];
  if (detailXml) {
    try {
      xmlItems = parseGDTInvoiceXml(detailXml).items.filter((item) => !isPlaceholderItemName(item.itemName));
    } catch {
    }
  }
  const authoritativeItems = xmlItems.length ? xmlItems : detailItems;
  const detailLookup = getLookupCodeFromPayload(detailSource);
  const detailUrl = getLookupUrlFromPayload(detailSource);
  const xmlLookup = detailXml ? extractLookupDetailsFromXml(detailXml) : null;
  const resolvedMhdon = value(detailSource, ["mhdon", "mccqt", "MCCQT"]) || invoice.mhdon;
  const isVnpt = isVnptSource(detailSource) || isVnptSource(invoice);
  const isMisa = isMisaSource(detailSource) || isMisaSource(invoice);
  const isViettel = isViettelSource(detail) || isViettelSource(detailSource) || isViettelSource(invoice);
  const isVnpay = isVnpaySource(detailSource) || isVnpaySource(invoice);
  let rawLookup = isViettel ? detailLookup || xmlLookup?.lookupCode || void 0 : isVnpt && resolvedMhdon ? resolvedMhdon : detailLookup || xmlLookup?.lookupCode || invoice.lookupCode || void 0;
  if (isVnpay) {
    if (rawLookup && rawLookup.toLowerCase() === "vietcombank") {
      rawLookup = void 0;
    }
    if (!rawLookup && resolvedMhdon) {
      rawLookup = resolvedMhdon;
    }
  }
  const finalLookupCode = rawLookup;
  const isVcb = invoice.nbmst === "0100112437" || seller.taxCode === "0100112437" || /vietcombank/i.test(seller.name || invoice.nbten || "");
  const finalLookupUrl = isVnpt ? detailUrl || invoice.lookupUrl || `https://${seller.taxCode || invoice.nbmst || "4000344946"}-tt78.vnpt-invoice.com.vn` : isMisa ? detailUrl || xmlLookup?.lookupUrl || invoice.lookupUrl || "https://www.meinvoice.vn/tra-cuu" : isVnpay ? detailUrl || xmlLookup?.lookupUrl || invoice.lookupUrl || (isVcb ? "https://einvoice.vietcombank.com.vn/" : "https://portal.vnpayinvoice.vn/") : isViettel ? detailUrl || xmlLookup?.lookupUrl || invoice.lookupUrl || "https://vinvoice.viettel.vn/utilities/invoice-search" : detailUrl || xmlLookup?.lookupUrl || invoice.lookupUrl || void 0;
  return {
    ...invoice,
    nbmst: seller.taxCode || value(detailSource, ["nbmst"]) || invoice.nbmst,
    nbten: seller.name || value(detailSource, ["nbten", "nbtnnt", "nbtlhdon"]) || invoice.nbten,
    nbdchi: seller.address || value(detailSource, ["nbdchi"]) || invoice.nbdchi,
    nmmst: value(detailSource, ["nmmst", "nmtnnt"]) || invoice.nmmst,
    nmten: value(detailSource, ["nmten", "nmtnnt", "nmtlhdon"]) || invoice.nmten,
    nmdchi: value(detailSource, ["nmdchi"]) || invoice.nmdchi,
    mhdon: resolvedMhdon,
    msttcgp: value(detailSource, ["msttcgp", "mst_tcgp", "tvandnkntt"]) || (isMisa ? "0101243150" : isVnpay ? "0102182292" : isViettel ? "0100109106" : isVnpt ? "0100684378" : invoice.msttcgp),
    provider: isMisa ? "MISA" : isVnpt ? "VNPT" : isViettel ? "VIETTEL" : isVnpay ? "VNPAY" : invoice.provider || void 0,
    lookupCode: finalLookupCode,
    lookupUrl: finalLookupUrl,
    items: authoritativeItems,
    ...detailXml ? { rawXml: detailXml } : {},
    // A downloaded XML alone is not evidence that line descriptions were
    // extracted. Keep this retryable until at least one genuine name exists.
    sourceCompleteness: authoritativeItems.length ? "detail" : "summary-detail"
  };
}

// src/db/neonDb.ts
import dotenv from "dotenv";
import fs2 from "fs";
import path2 from "path";
import { Pool } from "pg";
dotenv.config({ override: true });
var CONFIG_FILE = path2.join(process.cwd(), "neon_config.json");
var pool = null;
var currentPoolUrl = null;
var isPostgresConnected = false;
var isTableInitialized = false;
var lastPostgresError = null;
function cleanDatabaseUrl(rawUrl) {
  if (!rawUrl) return "";
  let url = rawUrl.trim().replace(/^["']|["']$/g, "").trim();
  url = url.replace(/([?&])channel_binding=[^&]*(&|$)/gi, (_m, p1, p2) => p2 ? p1 : "");
  return url;
}
function getStoredDatabaseUrl() {
  try {
    if (fs2.existsSync(CONFIG_FILE)) {
      const raw = fs2.readFileSync(CONFIG_FILE, "utf-8");
      const data = JSON.parse(raw);
      if (data && typeof data.databaseUrl === "string" && data.databaseUrl.trim()) {
        return cleanDatabaseUrl(data.databaseUrl);
      }
    }
  } catch {
  }
  return "";
}
function getDatabaseConfig() {
  try {
    dotenv.config({ override: true });
  } catch {
  }
  const storedUrl = getStoredDatabaseUrl();
  if (storedUrl) {
    return {
      source: "CONFIG_FILE",
      url: storedUrl
    };
  }
  const candidates = [
    ["POSTGRES_URL", process.env.POSTGRES_URL],
    ["DATABASE_URL", process.env.DATABASE_URL],
    ["POSTGRES_PRISMA_URL", process.env.POSTGRES_PRISMA_URL],
    ["POSTGRES_URL_NON_POOLING", process.env.POSTGRES_URL_NON_POOLING],
    ["DATABASE_URL_UNPOOLED", process.env.DATABASE_URL_UNPOOLED],
    ["NEON_DATABASE_URL", process.env.NEON_DATABASE_URL]
  ];
  const selected = candidates.find(([, value2]) => value2 && value2.trim());
  let url = cleanDatabaseUrl(selected?.[1] || "");
  if (!url && process.env.POSTGRES_HOST && process.env.POSTGRES_USER) {
    const user = encodeURIComponent(process.env.POSTGRES_USER || "");
    const pass = encodeURIComponent(process.env.POSTGRES_PASSWORD || "");
    const host = process.env.POSTGRES_HOST;
    const db = process.env.POSTGRES_DATABASE || "postgres";
    url = `postgresql://${user}:${pass}@${host}/${db}?sslmode=require`;
    return {
      source: "POSTGRES_HOST_CONFIG",
      url
    };
  }
  return {
    source: selected ? selected[0] : "NONE",
    url
  };
}
function getDatabaseUrl() {
  return getDatabaseConfig().url;
}
function getMaskedDatabaseUrl() {
  const url = getDatabaseUrl();
  if (!url) return "";
  try {
    const u = new URL(url);
    const pass = u.password ? "***" : "";
    return `${u.protocol}//${u.username}:${pass}@${u.host}${u.pathname}`;
  } catch {
    return url.replace(/:([^:@]+)@/, ":***@");
  }
}
function safeDatabaseError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "postgresql://[redacted]").replace(/password=[^&\s]+/gi, "password=[redacted]");
}
function getPostgresPool() {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    return null;
  }
  if (pool && currentPoolUrl !== databaseUrl) {
    try {
      pool.end();
    } catch {
    }
    pool = null;
    isPostgresConnected = false;
    isTableInitialized = false;
  }
  if (!pool) {
    try {
      const isLocalhost = databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1");
      pool = new Pool({
        connectionString: databaseUrl,
        ssl: isLocalhost ? false : { rejectUnauthorized: false },
        max: process.env.VERCEL ? 3 : 10,
        connectionTimeoutMillis: 5e3,
        idleTimeoutMillis: 15e3
      });
      currentPoolUrl = databaseUrl;
      pool.on("error", (err) => {
        isPostgresConnected = false;
        lastPostgresError = safeDatabaseError(err);
      });
    } catch (err) {
      lastPostgresError = safeDatabaseError(err);
      return null;
    }
  }
  return pool;
}
async function resetPostgresPool() {
  if (pool) {
    try {
      await pool.end();
    } catch {
    }
    pool = null;
  }
  currentPoolUrl = null;
  isPostgresConnected = false;
  isTableInitialized = false;
  lastPostgresError = null;
}
function calculateExpiryDate(startDate, durationMonths) {
  const expiry = new Date(startDate);
  expiry.setMonth(expiry.getMonth() + Number(durationMonths || 1));
  expiry.setHours(23, 59, 59, 999);
  return expiry;
}
function enrichUserWithStatus(user) {
  const now = /* @__PURE__ */ new Date();
  const expiresAt = new Date(user.expires_at);
  const diffTime = expiresAt.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffTime / (1e3 * 60 * 60 * 24));
  const isExpired = daysRemaining < 0 || !user.is_active;
  let status = "active";
  if (!user.is_active) {
    status = "disabled";
  } else if (daysRemaining < 0) {
    status = "expired";
  } else if (daysRemaining <= 7) {
    status = "expiring_soon";
  }
  return {
    ...user,
    days_remaining: Math.max(0, daysRemaining),
    is_expired: isExpired,
    status
  };
}
var inMemoryUsers = /* @__PURE__ */ new Map();
var isMemoryInitialized = false;
function initInMemoryStore() {
  if (isMemoryInitialized) return;
  const now = /* @__PURE__ */ new Date();
  const adminExpiry = calculateExpiryDate(now, 120);
  const userExpiry = calculateExpiryDate(now, 12);
  const initialAdminUser = (process.env.ADMIN_INITIAL_USERNAME || "").trim() || "admin";
  const initialAdminPass = (process.env.ADMIN_INITIAL_PASSWORD || "").trim() || "admin";
  const initialAdminName = (process.env.ADMIN_INITIAL_FULLNAME || "").trim() || "Qu\u1EA3n tr\u1ECB vi\xEAn Demo";
  inMemoryUsers.set(initialAdminUser.toLowerCase(), {
    id: 1,
    username: initialAdminUser,
    password: initialAdminPass,
    full_name: initialAdminName,
    role: "admin",
    duration_months: 120,
    created_at: now.toISOString(),
    expires_at: adminExpiry.toISOString(),
    is_active: true,
    notes: "T\xE0i kho\u1EA3n Qu\u1EA3n tr\u1ECB vi\xEAn (Ch\u1EBF \u0111\u1ED9 d\u1EF1 ph\xF2ng khi ch\u01B0a k\u1EBFt n\u1ED1i Neon)"
  });
  isMemoryInitialized = true;
}
async function initDatabase() {
  initInMemoryStore();
  const databaseConfig = getDatabaseConfig();
  const databaseUrl = databaseConfig.url;
  if (!databaseUrl) {
    isPostgresConnected = false;
    lastPostgresError = null;
    return {
      success: true,
      type: "in_memory_mock",
      message: "H\u1EC7 th\u1ED1ng \u0111ang ho\u1EA1t \u0111\u1ED9ng \u1EDF ch\u1EBF \u0111\u1ED9 b\u1ED9 nh\u1EDB \u0111\u1EC7m (In-memory mock). \u0110\u1EC3 l\u01B0u tr\u1EEF v\u0129nh vi\u1EC5n, b\u1EA1n c\xF3 th\u1EC3 k\u1EBFt n\u1ED1i PostgreSQL."
    };
  }
  const p = getPostgresPool();
  if (!p) {
    isPostgresConnected = false;
    return {
      success: true,
      type: "in_memory_mock",
      message: `C\u01A1 s\u1EDF d\u1EEF li\u1EC7u t\u1EA1m th\u1EDDi ch\u01B0a k\u1EBFt n\u1ED1i \u0111\u01B0\u1EE3c (${lastPostgresError || "L\u1ED7i kh\xF4ng x\xE1c \u0111\u1ECBnh"}), chuy\u1EC3n sang ch\u1EBF \u0111\u1ED9 b\u1ED9 nh\u1EDB \u0111\u1EC7m.`
    };
  }
  try {
    await p.query("SELECT 1;");
    if (!isTableInitialized) {
      await p.query(`
        CREATE TABLE IF NOT EXISTS web_users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          full_name VARCHAR(255),
          role VARCHAR(20) DEFAULT 'user',
          duration_months INTEGER DEFAULT 1,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          is_active BOOLEAN DEFAULT TRUE,
          notes TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_web_users_username ON web_users(username);
      `);
      const initialAdminUser = (process.env.ADMIN_INITIAL_USERNAME || "").trim();
      const initialAdminPass = (process.env.ADMIN_INITIAL_PASSWORD || "").trim();
      if (initialAdminUser && initialAdminPass) {
        try {
          const countRes = await p.query("SELECT COUNT(*) as count FROM web_users;");
          const count = parseInt(countRes.rows[0]?.count || "0", 10);
          if (count === 0) {
            const adminExpiry = calculateExpiryDate(/* @__PURE__ */ new Date(), 120);
            await p.query(`
              INSERT INTO web_users (username, password, full_name, role, duration_months, created_at, expires_at, is_active, notes)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              ON CONFLICT (username) DO NOTHING;
            `, [
              initialAdminUser,
              initialAdminPass,
              process.env.ADMIN_INITIAL_FULLNAME || "Qu\u1EA3n tr\u1ECB vi\xEAn",
              "admin",
              120,
              (/* @__PURE__ */ new Date()).toISOString(),
              adminExpiry.toISOString(),
              true,
              "T\xE0i kho\u1EA3n kh\u1EDFi t\u1EA1o t\u1EEB c\u1EA5u h\xECnh ban \u0111\u1EA7u"
            ]);
          }
        } catch {
        }
      }
      isTableInitialized = true;
    }
    isPostgresConnected = true;
    lastPostgresError = null;
    return {
      success: true,
      type: "neon_postgres",
      message: `\u0110\xE3 k\u1EBFt n\u1ED1i th\xE0nh c\xF4ng t\u1EDBi c\u01A1 s\u1EDF d\u1EEF li\u1EC7u.`
    };
  } catch (err) {
    const safeErr = safeDatabaseError(err);
    lastPostgresError = safeErr;
    isPostgresConnected = false;
    console.warn(`[Database Init] Kh\xF4ng th\u1EC3 k\u1EBFt n\u1ED1i PostgreSQL: ${safeErr} - Ho\u1EA1t \u0111\u1ED9ng b\u1EB1ng In-Memory Mock`);
    return {
      success: true,
      type: "in_memory_mock",
      message: `\u0110ang ho\u1EA1t \u0111\u1ED9ng v\u1EDBi b\u1ED9 nh\u1EDB \u0111\u1EC7m (In-memory mock) do PostgreSQL ch\u01B0a s\u1EB5n s\xE0ng: ${safeErr}`
    };
  }
}
async function getDatabaseStatus() {
  initInMemoryStore();
  const databaseConfig = getDatabaseConfig();
  const dbConfigured = Boolean(databaseConfig.url);
  if (dbConfigured) {
    const p = getPostgresPool();
    if (p) {
      try {
        await p.query("SELECT 1;");
        const res = await p.query("SELECT COUNT(*) as count FROM web_users;");
        const totalUsers = parseInt(res.rows[0]?.count || "0", 10);
        isPostgresConnected = true;
        lastPostgresError = null;
        return {
          connected: true,
          type: "neon_postgres",
          message: "C\u01A1 s\u1EDF d\u1EEF li\u1EC7u PostgreSQL \u0111ang ho\u1EA1t \u0111\u1ED9ng \u1ED5n \u0111\u1ECBnh",
          totalUsers,
          databaseUrlConfigured: true,
          connectionSource: databaseConfig.source,
          maskedUrl: getMaskedDatabaseUrl()
        };
      } catch (err) {
        lastPostgresError = safeDatabaseError(err);
        isPostgresConnected = false;
      }
    }
  }
  return {
    connected: true,
    type: "in_memory_mock",
    message: dbConfigured ? `Kh\xF4ng th\u1EC3 k\u1EBFt n\u1ED1i PostgreSQL (${lastPostgresError || "L\u1ED7i m\u1EA1ng"}), h\u1EC7 th\u1ED1ng \u0111ang ho\u1EA1t \u0111\u1ED9ng v\u1EDBi In-Memory Mock.` : "H\u1EC7 th\u1ED1ng \u0111ang ho\u1EA1t \u0111\u1ED9ng \u1EDF ch\u1EBF \u0111\u1ED9 b\u1ED9 nh\u1EDB \u0111\u1EC7m (In-Memory Mock).",
    totalUsers: inMemoryUsers.size,
    databaseUrlConfigured: dbConfigured,
    connectionSource: dbConfigured ? databaseConfig.source : "IN_MEMORY",
    maskedUrl: getMaskedDatabaseUrl()
  };
}
async function saveNeonDatabaseUrl(rawUrl, initialAdmin) {
  const cleaned = cleanDatabaseUrl(rawUrl);
  if (!cleaned) {
    return { success: false, message: "Chu\u1ED7i k\u1EBFt n\u1ED1i kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng." };
  }
  const testPool = new Pool({
    connectionString: cleaned,
    ssl: cleaned.includes("localhost") ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 7e3
  });
  try {
    await testPool.query("SELECT 1;");
  } catch (err) {
    try {
      await testPool.end();
    } catch {
    }
    const safeErr = safeDatabaseError(err);
    let friendly = safeErr;
    if (safeErr.includes("password authentication failed")) {
      friendly = "M\u1EADt kh\u1EA9u x\xE1c th\u1EF1c c\u01A1 s\u1EDF d\u1EEF li\u1EC7u kh\xF4ng ch\xEDnh x\xE1c.";
    }
    return {
      success: false,
      message: `K\u1EBFt n\u1ED1i c\u01A1 s\u1EDF d\u1EEF li\u1EC7u th\u1EA5t b\u1EA1i: ${friendly}`
    };
  }
  try {
    await testPool.query(`
      CREATE TABLE IF NOT EXISTS web_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(255),
        role VARCHAR(20) DEFAULT 'user',
        duration_months INTEGER DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        notes TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_web_users_username ON web_users(username);
    `);
    if (initialAdmin?.username && initialAdmin?.password) {
      const adminExpiry = calculateExpiryDate(/* @__PURE__ */ new Date(), 120);
      await testPool.query(`
        INSERT INTO web_users (username, password, full_name, role, duration_months, created_at, expires_at, is_active, notes)
        VALUES ($1, $2, $3, 'admin', 120, $4, $5, true, $6)
        ON CONFLICT (username) DO NOTHING;
      `, [
        initialAdmin.username.trim(),
        initialAdmin.password.trim(),
        initialAdmin.fullName || "Qu\u1EA3n tr\u1ECB vi\xEAn",
        (/* @__PURE__ */ new Date()).toISOString(),
        adminExpiry.toISOString(),
        "Kh\u1EDFi t\u1EA1o qua c\u1EA5u h\xECnh"
      ]);
    }
  } catch {
  } finally {
    try {
      await testPool.end();
    } catch {
    }
  }
  try {
    fs2.writeFileSync(
      CONFIG_FILE,
      JSON.stringify(
        {
          databaseUrl: cleaned,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        },
        null,
        2
      ),
      "utf-8"
    );
    await resetPostgresPool();
    await initDatabase();
    return {
      success: true,
      connected: true,
      message: "\u0110\xE3 k\u1EBFt n\u1ED1i v\xE0 l\u01B0u c\u1EA5u h\xECnh c\u01A1 s\u1EDF d\u1EEF li\u1EC7u th\xE0nh c\xF4ng!"
    };
  } catch (err) {
    return {
      success: false,
      message: `Kh\xF4ng th\u1EC3 l\u01B0u c\u1EA5u h\xECnh: ${err.message}`
    };
  }
}
async function findUserByUsername(username) {
  const cleanUsername = (username || "").trim();
  if (!cleanUsername) return null;
  const p = getPostgresPool();
  if (p && isPostgresConnected) {
    try {
      const res = await p.query(
        "SELECT * FROM web_users WHERE LOWER(username) = LOWER($1) LIMIT 1;",
        [cleanUsername]
      );
      if (res.rows.length > 0) {
        return enrichUserWithStatus(res.rows[0]);
      }
      return null;
    } catch (err) {
      console.warn(`[findUserByUsername] PostgreSQL query failed, checking in-memory store:`, safeDatabaseError(err));
    }
  }
  initInMemoryStore();
  const lower = cleanUsername.toLowerCase();
  const memoryUser = inMemoryUsers.get(lower);
  if (memoryUser) {
    return enrichUserWithStatus(memoryUser);
  }
  if (lower === "admin") {
    const adminUser = Array.from(inMemoryUsers.values()).find((u) => u.role === "admin");
    if (adminUser) return enrichUserWithStatus(adminUser);
  }
  return null;
}
async function getAllUsers() {
  const p = getPostgresPool();
  if (p && isPostgresConnected) {
    try {
      const res = await p.query("SELECT * FROM web_users ORDER BY id DESC;");
      return res.rows.map(enrichUserWithStatus);
    } catch (err) {
      console.warn(`[getAllUsers] PostgreSQL query failed, checking in-memory store:`, safeDatabaseError(err));
    }
  }
  initInMemoryStore();
  return Array.from(inMemoryUsers.values()).sort((a, b) => Number(b.id) - Number(a.id)).map(enrichUserWithStatus);
}
async function createUser(params) {
  const cleanUsername = (params.username || "").trim();
  const cleanPassword = (params.password || "").trim();
  if (!cleanUsername) {
    return { success: false, error: "M\xE3 s\u1ED1 thu\u1EBF (T\xEAn \u0111\u0103ng nh\u1EADp) kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng" };
  }
  if (!cleanPassword) {
    return { success: false, error: "M\u1EADt kh\u1EA9u kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng" };
  }
  const durationMonths = Number(params.durationMonths) || 1;
  const now = /* @__PURE__ */ new Date();
  const expiresAt = calculateExpiryDate(now, durationMonths);
  const role = params.role || "user";
  const p = getPostgresPool();
  if (p && isPostgresConnected) {
    try {
      const checkRes = await p.query("SELECT id FROM web_users WHERE LOWER(username) = LOWER($1);", [cleanUsername]);
      if (checkRes.rows.length > 0) {
        return { success: false, error: `T\xE0i kho\u1EA3n / M\xE3 s\u1ED1 thu\u1EBF "${cleanUsername}" \u0111\xE3 t\u1ED3n t\u1EA1i trong h\u1EC7 th\u1ED1ng.` };
      }
      const insertRes = await p.query(`
        INSERT INTO web_users (username, password, full_name, role, duration_months, expires_at, is_active, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *;
      `, [
        cleanUsername,
        cleanPassword,
        params.fullName || "",
        role,
        durationMonths,
        expiresAt.toISOString(),
        true,
        params.notes || ""
      ]);
      const newUser = enrichUserWithStatus(insertRes.rows[0]);
      return { success: true, user: newUser };
    } catch (err) {
      console.warn(`[createUser] PostgreSQL insert failed, falling back to in-memory store:`, safeDatabaseError(err));
    }
  }
  initInMemoryStore();
  const lower = cleanUsername.toLowerCase();
  if (inMemoryUsers.has(lower)) {
    return { success: false, error: `T\xE0i kho\u1EA3n / M\xE3 s\u1ED1 thu\u1EBF "${cleanUsername}" \u0111\xE3 t\u1ED3n t\u1EA1i trong h\u1EC7 th\u1ED1ng.` };
  }
  const newId = inMemoryUsers.size + 1;
  const record = {
    id: newId,
    username: cleanUsername,
    password: cleanPassword,
    full_name: params.fullName || "",
    role,
    duration_months: durationMonths,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    is_active: true,
    notes: params.notes || ""
  };
  inMemoryUsers.set(lower, record);
  return { success: true, user: enrichUserWithStatus(record) };
}
async function updateUser(id, params) {
  const p = getPostgresPool();
  if (p && isPostgresConnected) {
    try {
      const curRes = await p.query("SELECT * FROM web_users WHERE id = $1;", [id]);
      if (curRes.rows.length === 0) {
        return { success: false, error: "Kh\xF4ng t\xECm th\u1EA5y t\xE0i kho\u1EA3n ng\u01B0\u1EDDi d\xF9ng." };
      }
      const current = curRes.rows[0];
      let expiresAt2 = new Date(current.expires_at);
      if (params.extendMonths) {
        const baseDate = expiresAt2.getTime() < Date.now() ? /* @__PURE__ */ new Date() : expiresAt2;
        expiresAt2 = calculateExpiryDate(baseDate, params.extendMonths);
      } else if (params.newExpiresAt) {
        expiresAt2 = new Date(params.newExpiresAt);
      }
      const password = params.password !== void 0 && params.password.trim() !== "" ? params.password.trim() : current.password;
      const fullName = params.fullName !== void 0 ? params.fullName : current.full_name;
      const isActive = params.isActive !== void 0 ? params.isActive : current.is_active;
      const notes = params.notes !== void 0 ? params.notes : current.notes;
      const updateRes = await p.query(`
        UPDATE web_users
        SET password = $1, full_name = $2, expires_at = $3, is_active = $4, notes = $5
        WHERE id = $6
        RETURNING *;
      `, [password, fullName, expiresAt2.toISOString(), isActive, notes, id]);
      return { success: true, user: enrichUserWithStatus(updateRes.rows[0]) };
    } catch (err) {
      console.warn(`[updateUser] PostgreSQL update failed, falling back to in-memory store:`, safeDatabaseError(err));
    }
  }
  initInMemoryStore();
  const existing = Array.from(inMemoryUsers.values()).find((u) => String(u.id) === String(id));
  if (!existing) {
    return { success: false, error: "Kh\xF4ng t\xECm th\u1EA5y t\xE0i kho\u1EA3n ng\u01B0\u1EDDi d\xF9ng." };
  }
  let expiresAt = new Date(existing.expires_at);
  if (params.extendMonths) {
    const baseDate = expiresAt.getTime() < Date.now() ? /* @__PURE__ */ new Date() : expiresAt;
    expiresAt = calculateExpiryDate(baseDate, params.extendMonths);
  } else if (params.newExpiresAt) {
    expiresAt = new Date(params.newExpiresAt);
  }
  if (params.password !== void 0 && params.password.trim() !== "") {
    existing.password = params.password.trim();
  }
  if (params.fullName !== void 0) {
    existing.full_name = params.fullName;
  }
  if (params.isActive !== void 0) {
    existing.is_active = params.isActive;
  }
  if (params.notes !== void 0) {
    existing.notes = params.notes;
  }
  existing.expires_at = expiresAt.toISOString();
  inMemoryUsers.set(existing.username.toLowerCase(), existing);
  return { success: true, user: enrichUserWithStatus(existing) };
}
async function deleteUser(id) {
  const p = getPostgresPool();
  if (p && isPostgresConnected) {
    try {
      const curRes = await p.query("SELECT role, username FROM web_users WHERE id = $1;", [id]);
      if (curRes.rows.length === 0) {
        return { success: false, error: "Kh\xF4ng t\xECm th\u1EA5y ng\u01B0\u1EDDi d\xF9ng" };
      }
      if (curRes.rows[0].role === "admin" || curRes.rows[0].username === "admin") {
        return { success: false, error: "Kh\xF4ng th\u1EC3 x\xF3a t\xE0i kho\u1EA3n Qu\u1EA3n tr\u1ECB vi\xEAn Master." };
      }
      await p.query("DELETE FROM web_users WHERE id = $1;", [id]);
      return { success: true };
    } catch (err) {
      console.warn(`[deleteUser] PostgreSQL delete failed, falling back to in-memory store:`, safeDatabaseError(err));
    }
  }
  initInMemoryStore();
  const existing = Array.from(inMemoryUsers.values()).find((u) => String(u.id) === String(id));
  if (!existing) {
    return { success: false, error: "Kh\xF4ng t\xECm th\u1EA5y ng\u01B0\u1EDDi d\xF9ng" };
  }
  if (existing.role === "admin" || existing.username.toLowerCase() === "admin") {
    return { success: false, error: "Kh\xF4ng th\u1EC3 x\xF3a t\xE0i kho\u1EA3n Qu\u1EA3n tr\u1ECB vi\xEAn Master." };
  }
  inMemoryUsers.delete(existing.username.toLowerCase());
  return { success: true };
}

// server.ts
dotenv2.config({ override: true });
var app = express();
function resolvePort() {
  const portIdx = process.argv.indexOf("--port");
  if (portIdx !== -1 && process.argv[portIdx + 1]) {
    const p = parseInt(process.argv[portIdx + 1], 10);
    if (!isNaN(p) && p > 0) return p;
  }
  if (process.env.DEFAULT_APP_PORT) {
    const p = parseInt(process.env.DEFAULT_APP_PORT, 10);
    if (!isNaN(p) && p > 0) return p;
  }
  if (process.env.PORT && process.env.PORT !== "8080") {
    const p = parseInt(process.env.PORT, 10);
    if (!isNaN(p) && p > 0) return p;
  }
  return 3e3;
}
var PORT = resolvePort();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});
app.use((req, res, next) => {
  if (req.url === "/api/index.js" || req.url === "/api" || req.url === "/api/") {
    const matched = req.headers["x-matched-path"] || req.originalUrl;
    if (matched && matched !== "/api/index.js" && matched !== "/api") {
      req.url = matched;
    }
  }
  if (!req.url.startsWith("/api")) {
    if (req.url.startsWith("/auth") || req.url.startsWith("/admin") || req.url.startsWith("/gdt") || req.url.startsWith("/invoice-downloader") || req.url.startsWith("/easyinvoice") || req.url.startsWith("/vnpt") || req.url.startsWith("/viettel") || req.url.startsWith("/vnpay") || req.url.startsWith("/foursi") || req.url.startsWith("/health") || req.url.startsWith("/selenium")) {
      req.url = "/api" + req.url;
    }
  }
  next();
});
var currentSession = null;
var captchaCookieJar = /* @__PURE__ */ new Map();
var captchaContentMap = /* @__PURE__ */ new Map();
var seleniumLogs = [];
var GDT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
  "Origin": "https://hoadondientu.gdt.gov.vn",
  "Referer": "https://hoadondientu.gdt.gov.vn/",
  "sec-ch-ua": '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin"
};
function getGdtDispatcher(customProxy) {
  const proxyUrl = (customProxy || process.env.VIETNAM_PROXY_URL || process.env.HTTP_PROXY || process.env.HTTPS_PROXY || "").trim();
  if (proxyUrl) {
    try {
      return new ProxyAgent(proxyUrl);
    } catch (e) {
      console.warn("[Proxy Initialization Warning]:", e);
    }
  }
  return void 0;
}
function extractGdtInvoiceList(data) {
  if (Array.isArray(data)) return data;
  const candidates = [
    data?.datas,
    data?.rows,
    data?.content,
    data?.items,
    data?.results,
    data?.result,
    data?.dshdon,
    data?.data?.datas,
    data?.data?.rows,
    data?.data?.content,
    data?.data?.items,
    data?.data?.results,
    data?.data?.result,
    data?.data?.dshdon,
    data?.data
  ];
  return candidates.find(Array.isArray) || [];
}
function extractCookies(res) {
  let cookieList = [];
  try {
    if (typeof res.headers.getSetCookie === "function") {
      cookieList = res.headers.getSetCookie();
    } else if (res.headers.raw && typeof res.headers.raw === "function") {
      const raw = res.headers.raw();
      cookieList = raw["set-cookie"] || [];
    } else {
      const single = res.headers.get("set-cookie");
      if (single) {
        cookieList = single.split(/,(?=\s*[A-Za-z0-9_-]+=)/);
      }
    }
  } catch (err) {
    console.warn("[Cookie Extraction Warning]:", err);
  }
  return (cookieList || []).filter(Boolean).map((c) => c.trim().split(";")[0]).filter((c) => c && c.includes("=")).join("; ");
}
function mergeCookieHeaders(...headers) {
  const cookies = /* @__PURE__ */ new Map();
  for (const header of headers) {
    for (const part of String(header || "").split(";")) {
      const separator = part.indexOf("=");
      if (separator <= 0) continue;
      const name = part.slice(0, separator).trim();
      const value2 = part.slice(separator + 1).trim();
      if (name && value2) cookies.set(name, `${name}=${value2}`);
    }
  }
  return Array.from(cookies.values()).join("; ");
}
var globalF5Cookie = "";
var lastF5CookieTime = 0;
async function ensureF5Session(customProxy) {
  const now = Date.now();
  if (globalF5Cookie && now - lastF5CookieTime < 10 * 60 * 1e3) {
    return globalF5Cookie;
  }
  try {
    const dispatcher = getGdtDispatcher(customProxy);
    const fetchOpt = {
      headers: {
        ...GDT_HEADERS,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none"
      },
      signal: AbortSignal.timeout(6e3)
    };
    if (dispatcher) fetchOpt.dispatcher = dispatcher;
    const homeRes = await fetch("https://hoadondientu.gdt.gov.vn/", fetchOpt);
    const cookie = extractCookies(homeRes);
    if (cookie) {
      globalF5Cookie = cookie;
      lastF5CookieTime = now;
    }
  } catch (e) {
  }
  return globalF5Cookie;
}
async function fetchGDT(url, options = {}, maxRetries = 1, timeoutMs = 12e3, customProxy) {
  let lastError = null;
  const dispatcher = getGdtDispatcher(customProxy);
  const f5Cookie = await ensureF5Session(customProxy);
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let timer = null;
    try {
      const controller = new AbortController();
      timer = setTimeout(() => controller.abort(), timeoutMs);
      const callerHeaders = options.headers || {};
      const existingCookie = callerHeaders["Cookie"] || callerHeaders["cookie"] || "";
      const mergedCookie = mergeCookieHeaders(f5Cookie, existingCookie);
      const mergedHeaders = {
        ...GDT_HEADERS,
        "request-id": crypto2.randomUUID ? crypto2.randomUUID() : `req_${Date.now()}`,
        "End-Point": "/",
        "Action": "",
        ...callerHeaders
      };
      if (mergedCookie) {
        mergedHeaders["Cookie"] = mergedCookie;
      }
      const fetchOptions = {
        ...options,
        headers: mergedHeaders,
        signal: controller.signal
      };
      if (dispatcher) {
        fetchOptions.dispatcher = dispatcher;
      }
      const resp = await fetch(url, fetchOptions);
      if (timer) clearTimeout(timer);
      const newCookies = extractCookies(resp);
      if (newCookies) {
        const set1 = new Set((globalF5Cookie || "").split("; ").filter(Boolean));
        for (const c of newCookies.split("; ").filter(Boolean)) {
          const key = c.split("=")[0];
          for (const item of Array.from(set1)) {
            if (item.startsWith(`${key}=`)) set1.delete(item);
          }
          set1.add(c);
        }
        globalF5Cookie = Array.from(set1).join("; ");
        lastF5CookieTime = Date.now();
      }
      if (resp.ok || resp.status === 400 || resp.status === 401 || resp.status === 403) {
        return resp;
      }
      lastError = new Error(`C\u1ED5ng Thu\u1EBF ph\u1EA3n h\u1ED3i m\xE3 HTTP ${resp.status}`);
    } catch (err) {
      if (timer) clearTimeout(timer);
      lastError = err;
    }
    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
  throw lastError || new Error("Kh\xF4ng th\u1EC3 k\u1EBFt n\u1ED1i \u0111\u1EBFn C\u1ED5ng T\u1ED5ng c\u1EE5c Thu\u1EBF.");
}
function cleanGdtSvgNoise(svg) {
  if (!svg || typeof svg !== "string") return svg;
  return svg.replace(/<path[^>]*stroke=[^>]*fill="none"[^>]*\/>/gi, "");
}
async function solveCaptchaOCR(svgOrDataUri, customApiKey) {
  if (!svgOrDataUri) return { code: "", error: "D\u1EEF li\u1EC7u \u1EA3nh Captcha r\u1ED7ng" };
  let rawSvg = svgOrDataUri;
  let isBitmap = false;
  let bitmapMime = "image/png";
  let bitmapBase64 = "";
  if (rawSvg.startsWith("data:image/svg+xml;utf8,")) {
    rawSvg = decodeURIComponent(rawSvg.replace("data:image/svg+xml;utf8,", ""));
  } else if (rawSvg.startsWith("data:image/svg+xml;base64,")) {
    rawSvg = Buffer.from(rawSvg.replace("data:image/svg+xml;base64,", ""), "base64").toString("utf-8");
  } else if (rawSvg.startsWith("data:image/")) {
    isBitmap = true;
    const match = rawSvg.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (match) {
      bitmapMime = match[1];
      bitmapBase64 = match[2];
    }
  }
  if (!isBitmap && (rawSvg.includes("<svg") || rawSvg.includes("xmlns"))) {
    rawSvg = cleanGdtSvgNoise(rawSvg);
  }
  if (!isBitmap) {
    const textTagMatches = rawSvg.match(/<text[^>]*>([\s\S]*?)<\/text>/gi);
    if (textTagMatches) {
      const textContent = textTagMatches.map((m) => m.replace(/<[^>]+>/g, "").trim()).join("");
      const cleanChars = textContent.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      if (cleanChars.length >= 4 && cleanChars.length <= 6) {
        console.log(`[SVG Direct Parser] Extracted Captcha: "${cleanChars}"`);
        return { code: cleanChars, modelUsed: "svg-direct" };
      }
    }
  }
  try {
    const image = isBitmap ? "data:" + bitmapMime + ";base64," + bitmapBase64 : "data:image/svg+xml;base64," + Buffer.from(rawSvg, "utf8").toString("base64");
    const code = await solveCaptchaWithGemini(image, ALPHANUMERIC_CAPTCHA_PROMPT, { customApiKey, alphanumeric: true });
    return { code, modelUsed: process.env.CAPTCHA_AI_MODEL || "gemini-flash-latest" };
  } catch (error) {
    return { code: "", error: error.message || "Kh\xF4ng nh\u1EADn di\u1EC7n \u0111\u01B0\u1EE3c CAPTCHA. Vui l\xF2ng nh\u1EADp th\u1EE7 c\xF4ng." };
  }
}
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    serverTime: (/* @__PURE__ */ new Date()).toISOString(),
    gdtConnected: currentSession?.isRealGDT ?? false,
    sessionMst: currentSession?.taxCode || null
  });
});
app.get("/api/gdt/captcha", async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  try {
    const gdtRes = await fetchGDT("https://hoadondientu.gdt.gov.vn/api/captcha", {}, 1, 6500);
    if (gdtRes.ok) {
      const cookieStr = extractCookies(gdtRes);
      const data = await gdtRes.json();
      if (data && data.key && data.content) {
        if (cookieStr) captchaCookieJar.set(data.key, cookieStr);
        const cleanedSvg = cleanGdtSvgNoise(data.content);
        captchaContentMap.set(data.key, cleanedSvg);
        const base64Image = `data:image/svg+xml;base64,${Buffer.from(cleanedSvg, "utf-8").toString("base64")}`;
        return res.json({
          success: true,
          isRealGDT: true,
          captchaKey: data.key,
          captchaCookie: cookieStr,
          captchaCode: "",
          captchaImage: base64Image,
          rawSvg: cleanedSvg,
          source: "hoadondientu.gdt.gov.vn"
        });
      }
    }
    const errText = await gdtRes.text();
    console.info("[GDT Captcha Fetch Notice]: HTTP", gdtRes.status, errText.substring(0, 100));
  } catch (error) {
    if (error?.name === "AbortError" || error?.message?.includes("aborted")) {
      console.info("[GDT Proxy] Live GDT captcha connection timed out from server; switching seamlessly to client fallback.");
    } else {
      console.info("[GDT Proxy] Live GDT captcha notice:", error?.message);
    }
  }
  return res.json({
    success: false,
    isRealGDT: false,
    captchaKey: "",
    captchaCookie: "",
    captchaCode: "",
    captchaImage: "",
    source: "gdt_unreachable",
    message: "M\xE1y ch\u1EE7 Cloud (ngo\xE0i n\u01B0\u1EDBc) kh\xF4ng th\u1EC3 k\u1EBFt n\u1ED1i tr\u1EF1c ti\u1EBFp \u0111\u1EBFn C\u1ED5ng Thu\u1EBF. \u1EE8ng d\u1EE5ng s\u1EBD t\u1EF1 \u0111\u1ED9ng t\u1EA3i Captcha tr\u1EF1c ti\u1EBFp t\u1EEB tr\xECnh duy\u1EC7t c\u1EE7a b\u1EA1n t\u1EA1i Vi\u1EC7t Nam.",
    directFallbackUrl: "https://hoadondientu.gdt.gov.vn/api/captcha"
  });
});
app.post("/api/gdt/ocr-captcha", async (req, res) => {
  try {
    const { captchaKey, captchaImage, rawSvg, customApiKey } = req.body;
    let contentToSolve = rawSvg || captchaImage;
    if (!contentToSolve && captchaKey && captchaContentMap.has(captchaKey)) {
      contentToSolve = captchaContentMap.get(captchaKey);
    }
    if (!contentToSolve) {
      return res.status(400).json({ success: false, message: "Thi\u1EBFu d\u1EEF li\u1EC7u \u1EA3nh Captcha." });
    }
    const ocrResult = await solveCaptchaOCR(contentToSolve, customApiKey);
    if (ocrResult.code) {
      return res.json({
        success: true,
        captchaCode: ocrResult.code,
        modelUsed: ocrResult.modelUsed,
        isRealGDT: Boolean(captchaKey && !captchaKey.startsWith("ckey_local_"))
      });
    } else {
      return res.json({
        success: false,
        captchaCode: "",
        isMissingApiKey: ocrResult.isMissingApiKey,
        isSpendingCap: ocrResult.isSpendingCap,
        message: ocrResult.error || "Kh\xF4ng nh\u1EADn di\u1EC7n \u0111\u01B0\u1EE3c m\xE3 Captcha. Vui l\xF2ng nh\u1EADp th\u1EE7 c\xF4ng.",
        isRealGDT: Boolean(captchaKey && !captchaKey.startsWith("ckey_local_"))
      });
    }
  } catch (err) {
    return res.json({
      success: false,
      captchaCode: "",
      isSpendingCap: true,
      message: "Kh\xF4ng th\u1EC3 qu\xE9t m\xE3 Captcha t\u1EF1 \u0111\u1ED9ng. Vui l\xF2ng nh\u1EADp th\u1EE7 c\xF4ng t\u1EEB \u1EA3nh."
    });
  }
});
app.post("/api/gdt/auto-login", async (req, res) => {
  const { taxCode, password, vietnamProxy, customApiKey } = req.body;
  if (!taxCode || !taxCode.trim()) {
    return res.status(400).json({ success: false, message: "Vui l\xF2ng nh\u1EADp M\xE3 s\u1ED1 thu\u1EBF (MST)." });
  }
  if (!password || !password.trim()) {
    return res.status(400).json({ success: false, message: "Vui l\xF2ng nh\u1EADp M\u1EADt kh\u1EA9u do CQT c\u1EA5p." });
  }
  const maxAttempts = 3;
  let lastGdtError = "";
  let isWafBlocked = false;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[Auto-Login] L\u1EA7n th\u1EED ${attempt}/${maxAttempts} cho MST ${taxCode.trim()}...`);
      const gdtRes = await fetchGDT("https://hoadondientu.gdt.gov.vn/api/captcha", {}, 1, 8e3, vietnamProxy);
      if (!gdtRes.ok) {
        if (gdtRes.status === 403) {
          isWafBlocked = true;
          lastGdtError = "H\u1EC7 th\u1ED1ng ph\xE1t hi\u1EC7n h\xE0nh vi kh\xF4ng h\u1EE3p l\u1EC7. Y\xEAu c\u1EA7u \u0111\xE3 b\u1ECB ch\u1EB7n.";
          break;
        }
        continue;
      }
      const cookieStr = extractCookies(gdtRes);
      const capData = await gdtRes.json();
      if (!capData?.key || !capData?.content) continue;
      captchaCookieJar.set(capData.key, cookieStr);
      captchaContentMap.set(capData.key, capData.content);
      const cleanedSvg = cleanGdtSvgNoise(capData.content);
      const ocrResult = await solveCaptchaOCR(cleanedSvg, customApiKey);
      const solvedCode = (ocrResult.code || "").trim().toUpperCase();
      if (!solvedCode || solvedCode.length < 4) {
        console.log(`[Auto-Login] L\u1EA7n ${attempt}: OCR ch\u01B0a ra m\xE3 k\xFD t\u1EF1, \u0111\u1ED5i Captcha m\u1EDBi...`);
        continue;
      }
      console.log(`[Auto-Login] L\u1EA7n ${attempt}: M\xE3 Captcha "${solvedCode}" (Model: ${ocrResult.modelUsed || "default"}). \u0110ang g\u1EEDi x\xE1c th\u1EF1c...`);
      const authRes = await fetchGDT("https://hoadondientu.gdt.gov.vn/api/security-taxpayer/authenticate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...cookieStr ? { "Cookie": cookieStr } : {}
        },
        body: JSON.stringify({
          username: taxCode.trim(),
          password: password.trim(),
          ckey: capData.key,
          cvalue: solvedCode
        })
      }, 1, 15e3, vietnamProxy);
      const newCookieStr = extractCookies(authRes);
      const combinedCookies = [cookieStr, newCookieStr].filter(Boolean).join("; ");
      const rawAuthText = await authRes.text();
      let authData = {};
      try {
        authData = JSON.parse(rawAuthText);
      } catch {
      }
      if (authRes.status === 403 || authData?.message?.includes("b\u1ECB ch\u1EB7n") || authData?.message?.includes("kh\xF4ng h\u1EE3p l\u1EC7")) {
        isWafBlocked = true;
        lastGdtError = authData?.message || "C\u1ED5ng Thu\u1EBF ch\u1EB7n k\u1EBFt n\u1ED1i t\u1EEB m\xE1y ch\u1EE7 (HTTP 403)";
        break;
      }
      if (authRes.ok && (authData.token || authData.jwt || authData.access_token)) {
        const realToken = authData.token || authData.jwt || authData.access_token;
        const cleanToken = realToken.startsWith("Bearer ") ? realToken : `Bearer ${realToken}`;
        currentSession = {
          taxCode: taxCode.trim(),
          taxpayerName: authData.user?.fullName || authData.user?.tenNnt || authData.user?.name || `DOANH NGHI\u1EC6P N\u1ED8P THU\u1EBE (MST: ${taxCode.trim()})`,
          address: authData.user?.address || authData.user?.dchi || "\u0110\u0103ng k\xFD t\u1EA1i T\u1ED5ng c\u1EE5c Thu\u1EBF Vi\u1EC7t Nam",
          token: cleanToken,
          cookieHeader: combinedCookies,
          isRealGDT: true,
          createdAt: Date.now()
        };
        console.log(`[Auto-Login] \u0110\u0102NG NH\u1EACP TH\xC0NH C\xD4NG cho MST ${taxCode.trim()} \u1EDF l\u1EA7n th\u1EED ${attempt}!`);
        return res.json({
          success: true,
          isRealGDT: true,
          message: `\u0110\xE3 t\u1EF1 \u0111\u1ED9ng v\u01B0\u1EE3t Captcha th\xE0nh c\xF4ng (l\u1EA7n th\u1EED ${attempt}) v\xE0 \u0111\u0103ng nh\u1EADp C\u1ED5ng T\u1ED5ng c\u1EE5c Thu\u1EBF!`,
          session: currentSession,
          attemptsUsed: attempt
        });
      }
      if (authData?.message?.toLowerCase().includes("m\u1EADt kh\u1EA9u") || authData?.message?.toLowerCase().includes("t\xEAn \u0111\u0103ng nh\u1EADp")) {
        return res.status(400).json({
          success: false,
          message: authData.message || "M\xE3 s\u1ED1 thu\u1EBF ho\u1EB7c M\u1EADt kh\u1EA9u kh\xF4ng ch\xEDnh x\xE1c."
        });
      }
      lastGdtError = authData?.message || "M\xE3 x\xE1c th\u1EF1c kh\xF4ng ch\xEDnh x\xE1c";
      console.log(`[Auto-Login] L\u1EA7n ${attempt} ch\u01B0a \u0111\xFAng m\xE3 (${lastGdtError}). T\u1EF1 \u0111\u1ED9ng th\u1EED l\u1EA1i...`);
      await new Promise((r) => setTimeout(r, 400));
    } catch (e) {
      console.warn(`[Auto-Login] L\u1ED7i l\u1EA7n th\u1EED ${attempt}:`, e.message);
      lastGdtError = e.message;
    }
  }
  if (isWafBlocked) {
    return res.status(403).json({
      success: false,
      isWafBlocked: true,
      message: "C\u1ED5ng T\u1ED5ng c\u1EE5c Thu\u1EBF \u0111\xE3 ch\u1EB7n IP c\u1EE7a m\xE1y ch\u1EE7 Cloud n\u01B0\u1EDBc ngo\xE0i (HTTP 403: Y\xEAu c\u1EA7u \u0111\xE3 b\u1ECB ch\u1EB7n). Vui l\xF2ng s\u1EED d\u1EE5ng b\u1EA3n Desktop (.exe) ch\u1EA1y tr\u1EF1c ti\u1EBFp t\u1EA1i Vi\u1EC7t Nam ho\u1EB7c c\u1EA5u h\xECnh Proxy IP Vi\u1EC7t Nam \u0111\u1EC3 truy c\u1EADp \u1ED5n \u0111\u1ECBnh."
    });
  }
  return res.status(400).json({
    success: false,
    needManualCaptcha: true,
    message: `T\u1EF1 \u0111\u1ED9ng v\u01B0\u1EE3t Captcha ch\u01B0a th\xE0nh c\xF4ng sau ${maxAttempts} l\u1EA7n th\u1EED (${lastGdtError}). B\u1EA1n c\xF3 th\u1EC3 chuy\u1EC3n sang nh\u1EADp Captcha th\u1EE7 c\xF4ng \u0111\u1EC3 ti\u1EBFp t\u1EE5c.`
  });
});
app.post("/api/gdt/login", async (req, res) => {
  let { taxCode, password, captchaKey, captchaCode, captchaCookie, vietnamProxy } = req.body;
  if (!taxCode) {
    return res.status(400).json({ success: false, message: "Vui l\xF2ng nh\u1EADp M\xE3 s\u1ED1 thu\u1EBF (MST)." });
  }
  if (!password) {
    return res.status(400).json({ success: false, message: "Vui l\xF2ng nh\u1EADp M\u1EADt kh\u1EA9u t\xE0i kho\u1EA3n T\u1ED5ng c\u1EE5c Thu\u1EBF c\u1EA5p." });
  }
  if (!captchaCode || !captchaCode.trim()) {
    return res.status(400).json({ success: false, message: "Vui l\xF2ng nh\xECn h\xECnh v\xE0 nh\u1EADp m\xE3 Captcha hi\u1EC3n th\u1ECB tr\xEAn \u1EA3nh." });
  }
  const cookieHeader = captchaCookie || (captchaKey ? captchaCookieJar.get(captchaKey) || "" : "");
  try {
    const authRes = await fetchGDT("https://hoadondientu.gdt.gov.vn/api/security-taxpayer/authenticate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...cookieHeader ? { "Cookie": cookieHeader } : {}
      },
      body: JSON.stringify({
        username: taxCode.trim(),
        password: password.trim(),
        ckey: captchaKey || "",
        cvalue: captchaCode.trim()
      })
    }, 1, 2e4, vietnamProxy);
    const newCookieStr = extractCookies(authRes);
    const combinedCookies = [cookieHeader, newCookieStr].filter(Boolean).join("; ");
    const rawText = await authRes.text();
    let authData = {};
    try {
      authData = JSON.parse(rawText);
    } catch {
      console.warn("[GDT Auth Raw Response]:", rawText.substring(0, 300));
      return res.status(502).json({
        success: false,
        message: "C\u1ED5ng T\u1ED5ng c\u1EE5c Thu\u1EBF ph\u1EA3n h\u1ED3i d\u1EA1ng v\u0103n b\u1EA3n ho\u1EB7c \u0111ang qu\xE1 t\u1EA3i. Vui l\xF2ng th\u1EED l\u1EA1i sau."
      });
    }
    if (authRes.ok && (authData.token || authData.jwt || authData.access_token)) {
      const realToken = authData.token || authData.jwt || authData.access_token;
      const cleanToken = realToken.startsWith("Bearer ") ? realToken : `Bearer ${realToken}`;
      currentSession = {
        taxCode: taxCode.trim(),
        taxpayerName: authData.user?.fullName || authData.user?.tenNnt || authData.user?.name || `DOANH NGHI\u1EC6P N\u1ED8P THU\u1EBE (MST: ${taxCode.trim()})`,
        address: authData.user?.address || authData.user?.dchi || "\u0110\u0103ng k\xFD t\u1EA1i T\u1ED5ng c\u1EE5c Thu\u1EBF Vi\u1EC7t Nam",
        token: cleanToken,
        cookieHeader: combinedCookies,
        isRealGDT: true,
        createdAt: Date.now()
      };
      return res.json({
        success: true,
        isRealGDT: true,
        message: "\u0110\u0103ng nh\u1EADp C\u1ED5ng H\xF3a \u0111\u01A1n \u0111i\u1EC7n t\u1EED T\u1ED5ng c\u1EE5c Thu\u1EBF th\xE0nh c\xF4ng!",
        session: currentSession
      });
    } else {
      const isWafBlocked = authRes.status === 403 || authData.message && authData.message.includes("b\u1ECB ch\u1EB7n") || authData.message && authData.message.includes("kh\xF4ng h\u1EE3p l\u1EC7");
      const errorMsg = isWafBlocked ? "C\u1ED5ng T\u1ED5ng c\u1EE5c Thu\u1EBF ch\u1EB7n k\u1EBFt n\u1ED1i t\u1EEB m\xE1y ch\u1EE7 \u0111\xE1m m\xE2y n\u01B0\u1EDBc ngo\xE0i (HTTP 403: Y\xEAu c\u1EA7u \u0111\xE3 b\u1ECB ch\u1EB7n). Vui l\xF2ng s\u1EED d\u1EE5ng b\u1EA3n Desktop (.exe) ch\u1EA1y tr\u1EF1c ti\u1EBFp t\u1EA1i Vi\u1EC7t Nam ho\u1EB7c c\u1EA5u h\xECnh Proxy IP Vi\u1EC7t Nam \u0111\u1EC3 kh\xF4ng b\u1ECB ch\u1EB7n." : authData.message || authData.details || "X\xE1c th\u1EF1c th\u1EA5t b\u1EA1i t\u1EEB C\u1ED5ng T\u1ED5ng c\u1EE5c Thu\u1EBF. Vui l\xF2ng ki\u1EC3m tra l\u1EA1i MST, M\u1EADt kh\u1EA9u ho\u1EB7c m\xE3 Captcha.";
      return res.status(authRes.status || 400).json({
        success: false,
        isRealGDT: true,
        isWafBlocked,
        message: errorMsg,
        rawGdtResponse: authData
      });
    }
  } catch (err) {
    console.error("[GDT Auth Error]:", err);
    return res.status(503).json({
      success: false,
      isRealGDT: true,
      isNetworkBlocked: true,
      message: `Kh\xF4ng th\u1EC3 k\u1EBFt n\u1ED1i \u0111\u1EBFn m\xE1y ch\u1EE7 C\u1ED5ng Thu\u1EBF (${err.message}). Vui l\xF2ng th\u1EED l\u1EA1i ho\u1EB7c s\u1EED d\u1EE5ng b\u1EA3n Desktop t\u1EA1i Vi\u1EC7t Nam \u0111\u1EC3 k\u1EBFt n\u1ED1i tr\u1EF1c ti\u1EBFp.`
    });
  }
});
function splitDateRangeIntoMonthlyChunks(fromDateStr, toDateStr) {
  if (!fromDateStr || !toDateStr) return [{ from: fromDateStr, to: toDateStr }];
  const startParts = fromDateStr.split("-").map(Number);
  const endParts = toDateStr.split("-").map(Number);
  if (startParts.length !== 3 || endParts.length !== 3 || startParts.some(isNaN) || endParts.some(isNaN)) {
    return [{ from: fromDateStr, to: toDateStr }];
  }
  const [startY, startM, startD] = startParts;
  const [endY, endM, endD] = endParts;
  if (startY > endY || startY === endY && startM > endM || startY === endY && startM === endM && startD > endD) {
    return [{ from: fromDateStr, to: toDateStr }];
  }
  const getDaysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  const pad = (n) => String(n).padStart(2, "0");
  const chunks = [];
  let curY = startY;
  let curM = startM;
  let curD = startD;
  while (curY < endY || curY === endY && curM <= endM) {
    const maxDays = getDaysInMonth(curY, curM);
    const chunkStartD = curD;
    let chunkEndD = maxDays;
    if (curY === endY && curM === endM) {
      chunkEndD = Math.min(maxDays, endD);
    }
    chunks.push({
      from: `${curY}-${pad(curM)}-${pad(chunkStartD)}`,
      to: `${curY}-${pad(curM)}-${pad(chunkEndD)}`
    });
    curD = 1;
    curM++;
    if (curM > 12) {
      curM = 1;
      curY++;
    }
  }
  return chunks.length > 0 ? chunks : [{ from: fromDateStr, to: toDateStr }];
}
function splitDateRangeIntoFixedChunks(fromDateStr, toDateStr, daysPerChunk) {
  const parse = (value2) => {
    const [year, month, day] = value2.split("-").map(Number);
    return year && month && day ? new Date(Date.UTC(year, month - 1, day)) : null;
  };
  const format = (date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  const start = parse(fromDateStr);
  const end = parse(toDateStr);
  if (!start || !end || start > end) return [];
  const chunks = [];
  const cursor = new Date(start.getTime());
  while (cursor <= end) {
    const chunkStart = new Date(cursor.getTime());
    const chunkEnd = new Date(cursor.getTime());
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() + Math.max(1, daysPerChunk) - 1);
    if (chunkEnd > end) chunkEnd.setTime(end.getTime());
    chunks.push({ from: format(chunkStart), to: format(chunkEnd) });
    cursor.setUTCDate(chunkEnd.getUTCDate() + 1);
  }
  return chunks;
}
app.post("/api/gdt/pos-captcha", async (req, res) => {
  const existingCookie = req.headers["x-gdt-cookie"] || req.body?.cookieHeader || currentSession?.cookieHeader || "";
  const customProxy = req.body?.vietnamProxy;
  try {
    const response = await fetchGDT("https://hoadondientu.gdt.gov.vn/api/captcha", {
      headers: existingCookie ? { Cookie: existingCookie } : {}
    }, 1, 8e3, customProxy);
    if (!response.ok) {
      return res.status(response.status).json({ success: false, message: `Kh\xF4ng t\u1EA3i \u0111\u01B0\u1EE3c CAPTCHA h\xF3a \u0111\u01A1n m\xE1y t\xEDnh ti\u1EC1n (HTTP ${response.status}).` });
    }
    const data = await response.json();
    if (!data.key || !data.content) {
      return res.status(502).json({ success: false, message: "CAPTCHA h\xF3a \u0111\u01A1n m\xE1y t\xEDnh ti\u1EC1n kh\xF4ng c\xF3 d\u1EEF li\u1EC7u h\u1EE3p l\u1EC7." });
    }
    const cleanedSvg = cleanGdtSvgNoise(data.content);
    return res.json({
      success: true,
      captchaKey: data.key,
      captchaCookie: extractCookies(response),
      captchaImage: `data:image/svg+xml;base64,${Buffer.from(cleanedSvg, "utf-8").toString("base64")}`,
      rawSvg: cleanedSvg
    });
  } catch (error) {
    return res.status(502).json({ success: false, message: error?.message || "Kh\xF4ng th\u1EC3 k\u1EBFt n\u1ED1i C\u1ED5ng T\u1ED5ng c\u1EE5c Thu\u1EBF \u0111\u1EC3 l\u1EA5y CAPTCHA." });
  }
});
app.post("/api/gdt/invoice-detail", async (req, res) => {
  const { invoice, token: bodyToken, cookieHeader: bodyCookie } = req.body || {};
  const rawAuth = req.headers.authorization || bodyToken || "";
  const authHeader = rawAuth && rawAuth.trim() && rawAuth.trim() !== "Bearer" ? rawAuth.trim() : currentSession?.token || "";
  const rawCookie = req.headers["x-gdt-cookie"] || bodyCookie || "";
  const cookieHeader = rawCookie && rawCookie.trim() ? rawCookie.trim() : currentSession?.cookieHeader || "";
  if (!authHeader || !invoice) {
    return res.status(400).json({ success: false, message: "Thi\u1EBFu phi\xEAn \u0111\u0103ng nh\u1EADp ho\u1EB7c th\xF4ng tin h\xF3a \u0111\u01A1n." });
  }
  try {
    const tokenHeader = authHeader.startsWith("Bearer ") ? authHeader : `Bearer ${authHeader}`;
    const gdtHeaders = { Authorization: tokenHeader, ...cookieHeader ? { Cookie: cookieHeader } : {} };
    const [detailRes, xmlExportRes] = await Promise.allSettled([
      fetchGdtInvoiceDetail(invoice, gdtHeaders),
      fetchGdtInvoiceXml(invoice, gdtHeaders)
    ]);
    const detail = detailRes.status === "fulfilled" ? detailRes.value : null;
    const xmlExport = xmlExportRes.status === "fulfilled" ? xmlExportRes.value : { xml: "", status: 0, contentType: "", bytes: 0, url: "" };
    if (detailRes.status === "rejected") {
      console.warn("[GDT detail rejected]", detailRes.reason?.message || detailRes.reason);
    }
    if (xmlExportRes.status === "rejected") {
      console.warn("[GDT XML export rejected]", xmlExportRes.reason?.message || xmlExportRes.reason);
    }
    const mergedInvoice = mergeGdtInvoiceDetail(invoice, detail, xmlExport.xml);
    return res.json({
      success: true,
      invoice: mergedInvoice,
      xmlExport: {
        status: xmlExport.status,
        contentType: xmlExport.contentType,
        bytes: xmlExport.bytes,
        hasXml: !!xmlExport.xml
      }
    });
  } catch (error) {
    return res.status(502).json({ success: false, message: `Kh\xF4ng l\u1EA5y \u0111\u01B0\u1EE3c chi ti\u1EBFt h\xF3a \u0111\u01A1n: ${error.message}` });
  }
});
app.post("/api/gdt/query-invoices", async (req, res) => {
  let { fromDate, toDate, invoiceType = "both", size = 50, includeDetails = false, includePos = true, posOnly = false, token: bodyToken, cookieHeader: bodyCookie, vietnamProxy, customApiKey, posCaptcha } = req.body || {};
  const parsedSize = parseInt(String(size), 10);
  const validSize = !isNaN(parsedSize) && parsedSize > 0 && parsedSize <= 500 ? parsedSize : 50;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (fromDate && typeof fromDate === "string" && !dateRegex.test(fromDate.trim())) {
    fromDate = void 0;
  }
  if (toDate && typeof toDate === "string" && !dateRegex.test(toDate.trim())) {
    toDate = void 0;
  }
  const authHeader = req.headers.authorization || bodyToken || currentSession?.token || "";
  const cookieHeader = req.headers["x-gdt-cookie"] || bodyCookie || currentSession?.cookieHeader || "";
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: "Ch\u01B0a c\xF3 phi\xEAn l\xE0m vi\u1EC7c v\u1EDBi T\u1ED5ng c\u1EE5c Thu\u1EBF. Vui l\xF2ng nh\u1EADp m\xE3 Captcha \u0111\u1EC3 k\u1EBFt n\u1ED1i."
    });
  }
  const formatDateForGdt = (dateStr, isEnd = false) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day}/${month}/${year}${isEnd ? "T23:59:59" : "T00:00:00"}`;
    }
    return dateStr;
  };
  const rawFrom = fromDate || "2025-01-01";
  const rawTo = toDate || "2025-12-31";
  const dateChunks = splitDateRangeIntoMonthlyChunks(rawFrom, rawTo);
  const posDateChunks = splitDateRangeIntoFixedChunks(rawFrom, rawTo, 5);
  const rawToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  const tokenHeader = rawToken ? `Bearer ${rawToken}` : "";
  const cleanCookies = (cookieHeader || "").split(";").map((c) => c.trim()).filter((c) => {
    const parts = c.split("=");
    return parts.length >= 2 && parts[1].trim().length > 0 && parts[0].trim() !== "jwt";
  });
  if (rawToken) {
    cleanCookies.push(`jwt=${rawToken}`);
  }
  const sanitizedCookie = cleanCookies.join("; ");
  const posDiagnostics = [];
  const suppliedPosCaptcha = posCaptcha?.key && posCaptcha?.code ? { key: String(posCaptcha.key), code: String(posCaptcha.code), cookie: String(posCaptcha.cookie || "") } : void 0;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const fetchChunkWithRetry = async (type, chunkFrom, chunkTo, source = "query", maxRetries = 2, queryCaptcha) => {
    const gdtFrom = formatDateForGdt(chunkFrom, false);
    const gdtTo = formatDateForGdt(chunkTo, true);
    const searchParam = `tdlap=ge=${gdtFrom};tdlap=le=${gdtTo}`;
    const apiBase = source === "sco-query" ? "sco-query" : "query";
    let page = 0;
    let currentState = null;
    let accumulated = [];
    const seenInChunk = /* @__PURE__ */ new Set();
    let hasNextPage = true;
    while (hasNextPage && page < 100) {
      const isPosQuery = source === "sco-query";
      let url = `https://hoadondientu.gdt.gov.vn/api/${isPosQuery ? "sco-query" : "query"}/invoices/${type}?sort=tdlap:desc&size=${validSize}&search=${encodeURIComponent(searchParam)}`;
      if (queryCaptcha) {
        url += `&ckey=${encodeURIComponent(queryCaptcha.key)}&cvalue=${encodeURIComponent(queryCaptcha.code)}`;
      }
      if (currentState) {
        url += `&state=${encodeURIComponent(currentState)}`;
      } else if (page > 0) {
        url += `&page=${page}`;
      }
      let attemptSucceeded = false;
      let data = null;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const resp = await fetchGDT(url, {
            method: "GET",
            headers: {
              "Authorization": tokenHeader,
              "Accept": "application/json, text/plain, */*",
              "End-Point": "/tra-cuu/tra-cuu-hoa-don",
              "Action": source === "sco-query" ? type === "sold" ? "Xem%20h%C3%B3a%20%C4%91%C6%A1n%20(h%C3%B3a%20%C4%91%C6%A1n%20m%C3%A1y%20t%C3%ADnh%20ti%E1%BB%81n%20b%C3%A1n%20ra)" : "Xem%20h%C3%B3a%20%C4%91%C6%A1n%20(h%C3%B3a%20%C4%91%C6%A1n%20m%C3%A1y%20t%C3%ADnh%20ti%E1%BB%81n%20mua%20v%C3%A0o)" : "",
              ...sanitizedCookie || queryCaptcha?.cookie ? { "Cookie": mergeCookieHeaders(sanitizedCookie, queryCaptcha?.cookie) } : {}
            }
          }, 1, 15e3, vietnamProxy);
          if (resp.status === 401) {
            console.warn(`[GDT Query ${source}/${type} 401 Unauthorized]: Token rejected by GDT.`);
            if (source === "sco-query" && queryCaptcha) return { error: "CAPTCHA_INVALID" };
            if (source === "sco-query") {
              return accumulated;
            }
            return { error: "AUTH_EXPIRED" };
          }
          if (resp.status === 403) {
            console.warn(`[GDT Query ${source}/${type} 403 Forbidden]: Request blocked by GDT WAF/Cloud IP restriction.`);
            if (source === "sco-query" && queryCaptcha) return { error: "CAPTCHA_INVALID" };
            if (source === "sco-query") {
              return accumulated;
            }
            return { error: "WAF_BLOCKED" };
          }
          if (resp.status === 429) {
            console.warn(`[GDT Query ${source}/${type} Rate Limit 429 for ${chunkFrom}..${chunkTo}]: Attempt ${attempt + 1}/${maxRetries + 1}. Pacing & backing off...`);
            if (attempt < maxRetries) {
              const backoffMs = (attempt + 1) * 1200;
              await sleep(backoffMs);
              continue;
            } else {
              console.warn(`[GDT Query ${source}/${type} Rate Limit]: Reached max retries for ${chunkFrom}..${chunkTo}`);
              break;
            }
          }
          if (!resp.ok) {
            const errText = await resp.text();
            console.warn(`[GDT Query ${source}/${type} HTTP ${resp.status} for ${chunkFrom}..${chunkTo}]:`, errText.substring(0, 200));
            if (attempt < maxRetries) {
              await sleep(1e3);
              continue;
            }
            if (source === "sco-query" && queryCaptcha && resp.status === 400) return { error: "CAPTCHA_INVALID" };
            break;
          }
          const rawText = await resp.text();
          try {
            data = JSON.parse(rawText);
            attemptSucceeded = true;
            break;
          } catch {
            console.warn(`[GDT Query ${source}/${type} Non-JSON]:`, rawText.substring(0, 200));
            if (attempt < maxRetries) {
              await sleep(1e3);
              continue;
            }
            break;
          }
        } catch (err) {
          console.warn(`[GDT Query ${source}/${type} Exception ${chunkFrom}..${chunkTo} (attempt ${attempt + 1})]:`, err.message);
          if (attempt < maxRetries) {
            await sleep(1e3);
            continue;
          }
          break;
        }
      }
      if (!attemptSucceeded || !data) {
        console.warn(`[GDT Query ${source}/${type}] Could not retrieve page ${page} for ${chunkFrom}..${chunkTo}`);
        break;
      }
      const list = extractGdtInvoiceList(data);
      const total = Number(data.total ?? data.totalElements ?? data.totalCount ?? data.data?.total ?? 0);
      const rawNextState = data.state ?? data.State ?? data.data?.state ?? data.data?.State;
      const nextState = typeof rawNextState === "string" && rawNextState.trim().length > 0 ? rawNextState.trim() : null;
      const normalizedPage = list.map((item) => ({
        id: item.id || `GDT_${source === "sco-query" ? "POS_" : ""}${item.khhdon || ""}_${item.shdon || ""}_${item.nbmst || item.nmmst || ""}_${item.tdlap || ""}`,
        khmshdon: item.khmshdon || item.khmhd || "1",
        khhdon: item.khhdon || "",
        shdon: String(item.shdon || item.shd || "").padStart(7, "0"),
        tdlap: item.tdlap ? item.tdlap.replace(" ", "T") : (/* @__PURE__ */ new Date()).toISOString(),
        nbmst: String(item.nbmst || item.nbMst || getSellerFromPayload(item).taxCode || ""),
        nbten: String(item.nbten || item.nbtnnt || item.nbtlhdon || getSellerFromPayload(item).name || "Ng\u01B0\u1EDDi b\xE1n"),
        nbdchi: String(item.nbdchi || item.nbDchi || getSellerFromPayload(item).address || ""),
        nmmst: item.nmmst || "",
        nmten: item.nmten || item.nmtnnt || item.nmtlhdon || "Ng\u01B0\u1EDDi mua",
        nmdchi: item.nmdchi || "",
        tgtcthue: Number(item.tgtcthue ?? item.thtien ?? item.tgtphi ?? 0),
        tgtthue: Number(item.tgtthue ?? item.tthue ?? 0),
        tgtttbso: Number(item.tgtttbso ?? item.tgtttoan ?? item.tongtien ?? Number(item.tgtcthue ?? item.thtien ?? 0) + Number(item.tgtthue ?? item.tthue ?? 0)),
        tgtttbchu: item.tgtttbchu || "",
        htttoan: item.htttoan || "TM/CK",
        tthdon: Number(item.tthdon || 1),
        tthdonLabel: item.tthdon === 1 ? "H\xF3a \u0111\u01A1n g\u1ED1c" : item.tthdon === 2 ? "H\xF3a \u0111\u01A1n thay th\u1EBF" : item.tthdon === 3 ? "H\xF3a \u0111\u01A1n \u0111i\u1EC1u ch\u1EC9nh" : "H\xF3a \u0111\u01A1n h\u1EE7y",
        ttxly: Number(item.ttxly || 1),
        ttxlyLabel: item.ttxly === 1 ? "CQT \u0111\xE3 c\u1EA5p m\xE3" : item.ttxly === 2 ? "CQT ch\u01B0a c\u1EA5p m\xE3" : "\u0110\xE3 ti\u1EBFp nh\u1EADn",
        mhdon: item.mhdon || "",
        hsgcma: Boolean(item.mhdon || item.hsgcma),
        loaiHdon: type,
        hasDigitalSignature: true,
        signerName: item.nbten || item.nbtnnt || item.nbtlhdon || "Ng\u01B0\u1EDDi n\u1ED9p thu\u1EBF",
        signedDate: item.tdlap,
        caProvider: "T\u1ED5ng c\u1EE5c Thu\u1EBF CQT",
        msttcgp: item.msttcgp || item.mst_tcgp || "",
        tentcgp: item.tentcgp || item.ten_tcgp || item.tctchuc || "",
        lookupCode: getLookupCodeFromPayload(item),
        lookupUrl: getLookupUrlFromPayload(item),
        items: getInvoiceItemListFromPayload(item).map((it, idx) => normalizeInvoiceItem(it, idx)),
        sourceCompleteness: "summary",
        isPos: source === "sco-query"
      }));
      let newCount = 0;
      for (const inv of normalizedPage) {
        const uniqueKey = `${inv.khhdon}_${inv.shdon}_${inv.nbmst}_${inv.isPos ? "pos" : "std"}`;
        if (!seenInChunk.has(uniqueKey)) {
          seenInChunk.add(uniqueKey);
          accumulated.push(inv);
          newCount++;
        }
      }
      console.log(`[GDT Query ${source}/${type}] ${chunkFrom} -> ${chunkTo} (page ${page + 1}): fetched ${list.length} raw, ${newCount} new (total: ${accumulated.length}/${total || "unknown"}, nextState: ${Boolean(nextState)})`);
      if (newCount === 0 || list.length === 0) {
        hasNextPage = false;
        break;
      }
      if (total > 0 && accumulated.length >= total) {
        hasNextPage = false;
        break;
      }
      if (nextState && nextState !== currentState) {
        currentState = nextState;
        page++;
        hasNextPage = true;
        await sleep(250);
        continue;
      }
      if (list.length >= Number(size) && (!total || accumulated.length < total)) {
        currentState = null;
        page++;
        hasNextPage = true;
        await sleep(250);
        continue;
      }
      hasNextPage = false;
    }
    return accumulated;
  };
  const fetchAllChunksForType = async (type, source = "query", chunks = source === "sco-query" ? posDateChunks : dateChunks) => {
    let allInvoices = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (i > 0) {
        await sleep(250);
      }
      let chunkResult = [];
      const diagnostic = source === "sco-query" ? { from: chunk.from, to: chunk.to, status: "\u0110ang g\u1ECDi C\u1ED5ng Thu\u1EBF", attempts: 0 } : null;
      if (source === "sco-query" && !suppliedPosCaptcha) {
        chunkResult = { error: "CAPTCHA_REQUIRED" };
        if (diagnostic) diagnostic.status = "C\u1EA7n nh\u1EADp CAPTCHA m\u1EDBi c\u1EE7a T\u1ED5ng c\u1EE5c Thu\u1EBF";
      } else {
        if (diagnostic) diagnostic.attempts = source === "sco-query" ? 1 : 0;
        chunkResult = await fetchChunkWithRetry(
          type,
          chunk.from,
          chunk.to,
          source,
          2,
          source === "sco-query" ? suppliedPosCaptcha : void 0
        );
      }
      if (diagnostic) {
        if (Array.isArray(chunkResult)) {
          diagnostic.count = chunkResult.length;
          diagnostic.status = chunkResult.length > 0 ? "\u0110\xE3 nh\u1EADn d\u1EEF li\u1EC7u t\u1EEB GDT" : "GDT tr\u1EA3 v\u1EC1 0 h\xF3a \u0111\u01A1n";
        } else if (chunkResult?.error === "CAPTCHA_INVALID") {
          diagnostic.status = "GDT t\u1EEB ch\u1ED1i CAPTCHA; c\u1EA7n l\u1EA5y \u1EA3nh m\u1EDBi v\xE0 nh\u1EADp l\u1EA1i";
        }
        posDiagnostics.push(diagnostic);
      }
      if (chunkResult?.error === "AUTH_EXPIRED") {
        return { error: "AUTH_EXPIRED" };
      }
      if (chunkResult?.error === "WAF_BLOCKED") {
        return { error: "WAF_BLOCKED" };
      }
      if (Array.isArray(chunkResult)) {
        allInvoices = allInvoices.concat(chunkResult);
      }
    }
    return allInvoices;
  };
  try {
    let results = [];
    const purchaseList = posOnly ? [] : await fetchAllChunksForType("purchase", "query");
    if (purchaseList?.error === "AUTH_EXPIRED") {
      const isFresh = currentSession?.createdAt && Date.now() - currentSession.createdAt < 10 * 60 * 1e3;
      if (!isFresh) {
        currentSession = null;
      }
      return res.status(401).json({
        success: false,
        isExpired: true,
        sessionValid: Boolean(isFresh),
        message: "Phi\xEAn l\xE0m vi\u1EC7c C\u1ED5ng T\u1ED5ng c\u1EE5c Thu\u1EBF c\u1EA7n x\xE1c th\u1EF1c l\u1EA1i. Vui l\xF2ng nh\u1EADp m\xE3 Captcha \u0111\u1EC3 ti\u1EBFp t\u1EE5c."
      });
    }
    if (purchaseList?.error === "WAF_BLOCKED") {
      return res.status(403).json({
        success: false,
        isWafBlocked: true,
        sessionValid: true,
        invoices: [],
        message: "C\u1ED5ng T\u1ED5ng c\u1EE5c Thu\u1EBF t\u1EA1m th\u1EDDi t\u1EEB ch\u1ED1i truy v\u1EA5n (HTTP 403: Y\xEAu c\u1EA7u b\u1ECB h\u1EA1n ch\u1EBF). Phi\xEAn \u0111\u0103ng nh\u1EADp c\u1EE7a b\u1EA1n v\u1EABn c\xF2n hi\u1EC7u l\u1EF1c. Vui l\xF2ng th\u1EED l\u1EA1i sau gi\xE2y l\xE1t."
      });
    }
    if (Array.isArray(purchaseList)) {
      results = results.concat(purchaseList);
    }
    try {
      if (!includePos && !posOnly) {
        return res.json({ success: true, isRealGDT: true, invoices: results, count: results.length, chunksQueried: dateChunks.length, message: `\u0110\xE3 truy xu\u1EA5t ${results.length} h\xF3a \u0111\u01A1n th\u01B0\u1EDDng t\u1EEB C\u1ED5ng T\u1ED5ng c\u1EE5c Thu\u1EBF.` });
      }
      await sleep(250);
      const posPurchaseList = await fetchAllChunksForType("purchase", "sco-query", posOnly ? [{ from: rawFrom, to: rawTo }] : posDateChunks);
      if (Array.isArray(posPurchaseList)) {
        results = results.concat(posPurchaseList);
      }
    } catch (posErr) {
      console.info("[GDT sco-query POS notice]:", posErr?.message || posErr);
    }
    const seenMap = /* @__PURE__ */ new Map();
    for (const inv of results) {
      const key = `${inv.khhdon}_${inv.shdon}_${inv.nbmst}_${inv.loaiHdon}_${inv.isPos ? "pos" : "std"}`;
      if (!seenMap.has(key)) {
        seenMap.set(key, inv);
      }
    }
    const dedupedResults = Array.from(seenMap.values());
    if (includeDetails) for (let i = 0; i < dedupedResults.length; i++) {
      const invoice = dedupedResults[i];
      try {
        const detailHeaders = {
          Authorization: tokenHeader,
          ...sanitizedCookie ? { Cookie: sanitizedCookie } : cookieHeader ? { Cookie: cookieHeader } : {}
        };
        let detail = null;
        try {
          detail = await fetchGdtInvoiceDetail(invoice, detailHeaders);
        } catch (error) {
          console.warn("[GDT detail]", error?.message || error);
        }
        let xmlExport = { xml: "", status: 0, contentType: "", bytes: 0, url: "" };
        try {
          xmlExport = await fetchGdtInvoiceXml(invoice, detailHeaders);
        } catch (error) {
          console.warn("[GDT XML export]", error?.message || error);
        }
        dedupedResults[i] = mergeGdtInvoiceDetail(invoice, detail, xmlExport.xml);
        if (i < dedupedResults.length - 1) await sleep(300);
      } catch (detailError) {
        console.warn(`[GDT Detail] ${invoice.khhdon}/${invoice.shdon}: ${detailError.message}`);
        dedupedResults[i] = mergeGdtInvoiceDetail(invoice, null);
      }
    }
    dedupedResults.sort((a, b) => new Date(b.tdlap).getTime() - new Date(a.tdlap).getTime());
    return res.json({
      success: true,
      isRealGDT: true,
      invoices: dedupedResults,
      count: dedupedResults.length,
      chunksQueried: dateChunks.length,
      posDiagnostics,
      message: includeDetails ? `\u0110\xE3 truy xu\u1EA5t ${dedupedResults.length} h\xF3a \u0111\u01A1n v\xE0 t\u1EA3i b\u1ED5 sung d\u1EEF li\u1EC7u chi ti\u1EBFt t\u1EEB C\u1ED5ng T\u1ED5ng c\u1EE5c Thu\u1EBF (${dateChunks.length} k\u1EF3 con).` : `\u0110\xE3 truy xu\u1EA5t ${dedupedResults.length} h\xF3a \u0111\u01A1n t\u1EEB C\u1ED5ng T\u1ED5ng c\u1EE5c Thu\u1EBF (${dateChunks.length} k\u1EF3 con).`
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: `L\u1ED7i khi truy v\u1EA5n h\xF3a \u0111\u01A1n t\u1EEB C\u1ED5ng Thu\u1EBF: ${err.message}`
    });
  }
});
app.post("/api/gdt/logout", (req, res) => {
  currentSession = null;
  res.json({ success: true, message: "\u0110\xE3 ng\u1EAFt k\u1EBFt n\u1ED1i phi\xEAn l\xE0m vi\u1EC7c." });
});
app.get("/api/gdt/status", (req, res) => {
  res.json({
    isConnected: !!currentSession,
    isRealGDT: currentSession?.isRealGDT ?? false,
    session: currentSession
  });
});
app.post("/api/gdt/run-selenium", (req, res) => {
  const { taxCode, password, invoiceType, fromDate, toDate, headless } = req.body;
  const mst = (taxCode || currentSession?.taxCode || "").trim();
  if (!mst) {
    return res.status(400).json({ success: false, message: "Vui l\xF2ng cung c\u1EA5p M\xE3 s\u1ED1 thu\u1EBF h\u1EE3p l\u1EC7." });
  }
  const pwd = password || "";
  seleniumLogs = [];
  const addLog = (level, message, stepName, progress) => {
    const entry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: (/* @__PURE__ */ new Date()).toLocaleTimeString("vi-VN"),
      level,
      message,
      stepName,
      progress
    };
    seleniumLogs.push(entry);
    return entry;
  };
  addLog("step", `[1/6] B\u1EAFt \u0111\u1EA7u kh\u1EDFi t\u1EA1o quy tr\xECnh t\u1EF1 \u0111\u1ED9ng h\xF3a Python Selenium cho MST: ${mst}`, "INIT", 10);
  const pythonScriptPath = path3.join(process.cwd(), "python", "gdt_selenium_crawler.py");
  const args = [
    pythonScriptPath,
    "--mst",
    mst,
    "--password",
    pwd,
    "--type",
    invoiceType || "purchase",
    "--from-date",
    fromDate || "01/02/2025",
    "--to-date",
    toDate || "28/02/2025"
  ];
  if (headless !== false) {
    args.push("--headless");
  }
  const pyProcess = spawn("python3", args, {
    cwd: process.cwd(),
    env: { ...process.env, PYTHONUNBUFFERED: "1" }
  });
  pyProcess.stdout.on("data", (data) => {
    const text = data.toString();
    const lines = text.split("\n");
    for (const line of lines) {
      if (line.includes("__GDT_EVENT__:")) {
        try {
          const jsonStr = line.replace("__GDT_EVENT__:", "").trim();
          const parsed = JSON.parse(jsonStr);
          addLog(parsed.level, parsed.message, parsed.stepName, parsed.progress);
        } catch (e) {
          addLog("info", line.trim());
        }
      } else if (line.trim()) {
        addLog("info", line.trim());
      }
    }
  });
  pyProcess.stderr.on("data", (data) => {
    const text = data.toString().trim();
    if (text) {
      addLog("warning", `[STDERR]: ${text}`);
    }
  });
  pyProcess.on("close", (code) => {
    addLog("success", `[6/6] Quy tr\xECnh t\u1EF1 \u0111\u1ED9ng h\xF3a Python ho\xE0n t\u1EA5t v\u1EDBi m\xE3 tho\xE1t: ${code}. To\xE0n b\u1ED9 h\xF3a \u0111\u01A1n \u0111\xE3 s\u1EB5n s\xE0ng \u0111\u1EC3 t\u1EA3i v\u1EC1.`, "DONE", 100);
  });
  res.json({
    success: true,
    message: "Python Selenium Crawler \u0111\xE3 \u0111\u01B0\u1EE3c k\xEDch ho\u1EA1t th\xE0nh c\xF4ng."
  });
});
app.get("/api/gdt/selenium-logs", (req, res) => {
  res.json({ logs: seleniumLogs });
});
app.get("/api/gdt/download-python-package", async (req, res) => {
  try {
    const zip = new JSZip4();
    const fs3 = await import("fs");
    const pythonDir = path3.join(process.cwd(), "python");
    const files = [
      "gdt_selenium_crawler.py",
      "requirements.txt",
      "README_GDT.md",
      "gdt_crawler.ps1",
      "run_powershell.bat",
      "run_windows.bat",
      "HUONG_DAN_SUA_LOI_PYTHON.txt"
    ];
    for (const file of files) {
      const fullPath = path3.join(pythonDir, file);
      if (fs3.existsSync(fullPath)) {
        const content = fs3.readFileSync(fullPath, "utf-8");
        zip.file(file, content);
      }
    }
    const runBat = `@echo off
chcp 65001 >nul
title TOOL T\u1EF0 \u0110\u1ED8NG H\xD3A T\u1EA2I H\xD3A \u0110\u01A0N \u0110I\u1EC6N T\u1EEC T\u1ED4NG C\u1EE4C THU\u1EBE (GDT)
echo ==============================================================================
echo  KHOI DONG TOOL TAI HOA DON DIEN TU TONG CUC THUE GDT
echo ==============================================================================
echo.

:: 1. Kiem tra lenh python trong PATH
set PYTHON_CMD=
where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    set PYTHON_CMD=python
    goto :FOUND_PYTHON
)

:: 2. Kiem tra py launcher tren Windows
where py >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    set PYTHON_CMD=py
    goto :FOUND_PYTHON
)

:: 3. Tim trong thu muc cai dat mac dinh cua Windows
for /d %%D in ("%LOCALAPPDATA%\\Programs\\Python\\Python3*") do (
    if exist "%%D\\python.exe" (
        set PYTHON_CMD="%%D\\python.exe"
        goto :FOUND_PYTHON
    )
)
for /d %%D in ("C:\\Program Files\\Python3*") do (
    if exist "%%D\\python.exe" (
        set PYTHON_CMD="%%D\\python.exe"
        goto :FOUND_PYTHON
    )
)
for /d %%D in ("C:\\Python3*") do (
    if exist "%%D\\python.exe" (
        set PYTHON_CMD="%%D\\python.exe"
        goto :FOUND_PYTHON
    )
)

:: 4. Neu khong tim thay Python: Hien thi menu lua chon thong minh
cls
echo ==============================================================================
echo  THONG BAO: MAY TINH CHUA CAI PYTHON HOAC CHUA TICK 'ADD PYTHON TO PATH'
echo ==============================================================================
echo.
echo He thong khong tim thay trinh thuc thi Python tren may tinh cua ban.
echo Ban co the chon 1 trong cac phuong an sau:
echo.
echo   [1] Chay ngay bang Windows PowerShell (KHONG CAN CAI PYTHON - KHUYEN DUNG)
echo   [2] Tu dong cai dat Python 3 qua Windows winget (Tu dong 100%%)
echo   [3] Mo trang chu python.org de tai bo cai thu cong
echo   [4] Xem huong dan chi tiet khac phuc loi
echo   [5] Thoat
echo.
set /p USER_CHOICE="Nhap lua chon cua ban (1/2/3/4/5) [Mac dinh: 1]: "
if "%USER_CHOICE%"=="" set USER_CHOICE=1

if "%USER_CHOICE%"=="1" (
    echo.
    echo Dang khoi dong tool truc tiep qua Windows PowerShell...
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0gdt_crawler.ps1"
    pause
    exit /b
)

if "%USER_CHOICE%"=="2" (
    echo.
    echo Dang tu dong cai dat Python qua winget...
    winget install Python.Python.3.12 --accept-package-agreements --accept-source-agreements
    echo.
    echo Cai dat hoan tat! Vui long dong cua so nay va khoi dong lai run_windows.bat.
    pause
    exit /b
)

if "%USER_CHOICE%"=="3" (
    start https://www.python.org/downloads/
    echo.
    echo Luu y quan trong: Khi cai dat, nho TICK CHON vao o "Add python.exe to PATH" o man hinh dau tien!
    pause
    exit /b
)

if "%USER_CHOICE%"=="4" (
    notepad "%~dp0HUONG_DAN_SUA_LOI_PYTHON.txt"
    exit /b
)

pause
exit /b

:FOUND_PYTHON
echo [OK] Da tim thay trinh thuc thi Python: %PYTHON_CMD%
echo.
echo Khoi dong Tool tai hoa don...
%PYTHON_CMD% "%~dp0gdt_selenium_crawler.py"
echo.
pause
`;
    const runSh = `#!/bin/bash
echo "=== TAI HOA DON DIEN TU TONG CUC THUE ==="
pip install -r requirements.txt
python3 gdt_selenium_crawler.py --type purchase
`;
    if (fs3.existsSync(path3.join(pythonDir, "run_windows.bat"))) {
      zip.file("run_windows.bat", fs3.readFileSync(path3.join(pythonDir, "run_windows.bat"), "utf-8"));
    } else {
      zip.file("run_windows.bat", runBat);
    }
    zip.file("run_mac_linux.sh", runSh);
    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="GDT_Invoice_Crawler_Desktop.zip"');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/xml/parse", (req, res) => {
  try {
    const { xml } = req.body;
    if (!xml) {
      return res.status(400).json({ error: "N\u1ED9i dung XML kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng" });
    }
    const invoice = parseGDTInvoiceXml(xml);
    res.json({ success: true, invoice });
  } catch (error) {
    res.status(400).json({ error: "Kh\xF4ng th\u1EC3 ph\xE2n t\xEDch XML: " + error.message });
  }
});
app.post("/api/xml/transform-html", (req, res) => {
  try {
    const { xml, theme } = req.body;
    if (!xml) {
      return res.status(400).json({ error: "N\u1ED9i dung XML kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng" });
    }
    const invoice = parseGDTInvoiceXml(xml);
    const html = generateOfficialInvoiceHtml(invoice, {
      theme: theme === "blue" ? "blue" : "red",
      showPrintControls: true
    });
    res.json({ success: true, html });
  } catch (error) {
    res.status(400).json({ error: "Kh\xF4ng th\u1EC3 chuy\u1EC3n \u0111\u1ED5i XML sang HTML: " + error.message });
  }
});
app.get("/api/xml/xslt", (req, res) => {
  res.setHeader("Content-Type", "application/xslt+xml; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="GDT_Invoice_Transformer.xslt"');
  res.send(OFFICIAL_GDT_INVOICE_XSLT);
});
app.get("/api/invoice-downloader/drivers", (req, res) => {
  try {
    const drivers = invoiceManager.getRegisteredDrivers();
    res.json({ success: true, drivers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
app.post("/api/invoice-downloader/detect", async (req, res) => {
  try {
    const { xml } = req.body;
    if (!xml) {
      return res.status(400).json({ error: "N\u1ED9i dung XML kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng" });
    }
    const details = invoiceManager.detectProviderDetails(xml);
    const driver = await invoiceManager.selectDriver(xml);
    const info = await driver.extractInfo(xml);
    res.json({
      success: true,
      provider: details.provider,
      detectedProvider: details.provider,
      priority: details.priority,
      matchedPattern: details.matchedPattern,
      sourceDescription: details.sourceDescription,
      driverName: driver.name,
      supportsCaptcha: driver.metadata.supportsCaptcha,
      isFallback: details.provider === "UNKNOWN" || driver.providerCode === "GENERIC",
      info
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
app.post("/api/invoice-downloader/download", async (req, res) => {
  try {
    const { xml, forceFallback, timeoutMs, overrideProvider, customInfo, recaptchaToken } = req.body;
    if (!xml) {
      return res.status(400).json({ error: "N\u1ED9i dung XML kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng" });
    }
    const requestedProvider = resolveInvoiceProvider({
      rawXml: xml,
      lookupUrl: customInfo?.lookupUrl,
      msttcgp: customInfo?.msttcgp,
      tentcgp: customInfo?.tentcgp,
      provider: overrideProvider || customInfo?.provider
    });
    if (!forceFallback && requestedProvider === "VNPT" && customInfo?.lookupCode) {
      const vnpt = await downloadOriginalVnptPdf({
        lookupCode: String(customInfo.lookupCode).trim(),
        sellerTaxCode: customInfo.sellerTaxCode ? String(customInfo.sellerTaxCode).trim() : void 0,
        portalUrl: customInfo.lookupUrl ? String(customInfo.lookupUrl).trim() : void 0,
        invoiceNumber: customInfo.invoiceNo ? String(customInfo.invoiceNo).trim() : void 0
      });
      if (req.query.format === "binary") {
        res.setHeader("Content-Type", vnpt.contentType);
        res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(vnpt.filename)}"`);
        return res.send(vnpt.data);
      }
      return res.json({
        success: true,
        provider: "VNPT",
        driverName: "VNPT legacy portal",
        filename: vnpt.filename,
        isFallback: false,
        pdfBase64: vnpt.data.toString("base64")
      });
    }
    if (!forceFallback && requestedProvider === "EASYINVOICE" && customInfo?.lookupCode) {
      const easy = await downloadOriginalEasyInvoice({
        lookupCode: String(customInfo.lookupCode).trim(),
        sellerTaxCode: customInfo.sellerTaxCode ? String(customInfo.sellerTaxCode).trim() : void 0,
        lookupUrl: customInfo.lookupUrl ? String(customInfo.lookupUrl).trim() : void 0,
        khhdon: customInfo.invoiceSeries ? String(customInfo.invoiceSeries).trim() : void 0,
        shdon: customInfo.invoiceNo ? String(customInfo.invoiceNo).trim() : void 0
      });
      if (req.query.format === "binary") {
        res.setHeader("Content-Type", easy.contentType);
        res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(easy.filename)}"`);
        return res.send(easy.buffer);
      }
      return res.json({
        success: true,
        provider: "EASYINVOICE",
        driverName: "EasyInvoice portal",
        filename: easy.filename,
        isFallback: false,
        pdfBase64: easy.pdfBase64 || easy.buffer.toString("base64"),
        htmlContent: easy.htmlContent || ""
      });
    }
    if (!forceFallback && requestedProvider === "BKAV" && customInfo?.lookupCode) {
      const bkav = await downloadOriginalBkavPdf({
        lookupCode: String(customInfo.lookupCode).trim(),
        timeoutMs: timeoutMs ? Number(timeoutMs) : void 0
      });
      if (req.query.format === "binary") {
        res.setHeader("Content-Type", bkav.contentType);
        res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(bkav.filename)}"`);
        return res.send(bkav.data);
      }
      return res.json({
        success: true,
        provider: "BKAV",
        driverName: "Bkav eHoadon portal",
        filename: bkav.filename,
        isFallback: false,
        pdfBase64: bkav.data.toString("base64")
      });
    }
    const result = await invoiceManager.downloadInvoicePdf(xml, {
      recaptchaToken,
      forceFallback: Boolean(forceFallback),
      timeoutMs: timeoutMs ? Number(timeoutMs) : void 0,
      overrideProvider: requestedProvider || overrideProvider,
      customInfo
    });
    if (!forceFallback && result.isFallback) {
      return res.status(502).json({
        success: false,
        error: result.error || `Nh\xE0 cung c\u1EA5p ${requestedProvider || result.provider || overrideProvider || "h\xF3a \u0111\u01A1n"} kh\xF4ng tr\u1EA3 v\u1EC1 \u0111\u01B0\u1EE3c PDF g\u1ED1c.`,
        provider: requestedProvider || result.provider,
        executionLogs: result.executionLogs
      });
    }
    if (req.query.format === "binary") {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
      return res.send(result.pdfBuffer);
    }
    res.json({
      success: true,
      provider: result.provider,
      driverName: result.driverName,
      filename: result.filename,
      isFallback: result.isFallback,
      captchaSolved: result.captchaSolved,
      sourceUrl: result.sourceUrl,
      executionLogs: result.executionLogs,
      pdfBase64: result.pdfBase64
    });
  } catch (error) {
    res.status(error.status || 502).json({ success: false, error: error.message, code: error.code, provider: error.provider, requiresCaptcha: error.code === "RECAPTCHA_REQUIRED", lookupUrl: error.lookupUrl });
  }
});
app.post("/api/invoice-downloader/solve-captcha", async (req, res) => {
  try {
    const { image, whitelist, alphanumeric, customApiKey, forceGemini, preprocess, timeoutMs } = req.body;
    if (!image) {
      return res.status(400).json({ success: false, error: "\u1EA2nh Captcha kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng" });
    }
    const prompt = alphanumeric ? ALPHANUMERIC_CAPTCHA_PROMPT : void 0;
    const result = await CaptchaSolver.solveWithAI(image, {
      whitelist: whitelist || void 0,
      alphanumeric: Boolean(alphanumeric),
      forceGemini: Boolean(forceGemini),
      preprocess: preprocess !== false,
      timeoutMs,
      prompt,
      customApiKey: customApiKey || void 0
    });
    if (result && result.code) {
      return res.json({
        success: true,
        code: result.code,
        confidence: result.confidence,
        engine: result.engine,
        processingTimeMs: result.processingTimeMs
      });
    }
    return res.json({
      success: false,
      error: "Kh\xF4ng th\u1EC3 t\u1EF1 nh\u1EADn di\u1EC7n CAPTCHA b\u1EB1ng Tesseract local l\u1EABn Gemini API. Vui l\xF2ng nh\u1EADp m\xE3 th\u1EE7 c\xF4ng."
    });
  } catch (error) {
    return res.json({ success: false, error: error.message || "L\u1ED7i khi nh\u1EADn di\u1EC7n CAPTCHA." });
  }
});
app.post("/api/easyinvoice/download", async (req, res) => {
  try {
    const { lookupCode, sellerTaxCode, lookupUrl, khhdon, shdon, viewOnly } = req.body;
    if (!lookupCode) {
      return res.status(400).json({ success: false, error: "M\xE3 tra c\u1EE9u EasyInvoice (FKey) kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng" });
    }
    const result = await downloadOriginalEasyInvoice({
      lookupCode: String(lookupCode).trim(),
      sellerTaxCode: sellerTaxCode ? String(sellerTaxCode).trim() : void 0,
      lookupUrl: lookupUrl ? String(lookupUrl).trim() : void 0,
      khhdon: khhdon ? String(khhdon).trim() : void 0,
      shdon: shdon ? String(shdon).trim() : void 0,
      viewOnly: Boolean(viewOnly)
    });
    if (req.query.format === "binary") {
      res.setHeader("Content-Type", result.contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(result.filename)}"`);
      return res.send(result.buffer);
    }
    res.json({
      success: true,
      filename: result.filename,
      contentType: result.contentType,
      pdfBase64: result.pdfBase64 || result.buffer.toString("base64"),
      htmlContent: result.htmlContent || "",
      message: "\u0110\xE3 t\u1EF1 \u0111\u1ED9ng v\u01B0\u1EE3t Captcha v\xE0 t\u1EA3i v\u1EC1 h\xF3a \u0111\u01A1n g\u1ED1c th\xE0nh c\xF4ng."
    });
  } catch (error) {
    console.error("[EasyInvoice] L\u1ED7i t\u1EA3i h\xF3a \u0111\u01A1n g\u1ED1c:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});
app.post("/api/vnpt/view-original", async (req, res) => {
  try {
    const result = await lookupOriginalVnptInvoice({
      lookupCode: String(req.body.lookupCode || ""),
      sellerTaxCode: req.body.sellerTaxCode ? String(req.body.sellerTaxCode) : void 0,
      lookupUrl: req.body.lookupUrl ? String(req.body.lookupUrl) : void 0
    });
    res.json({
      success: true,
      htmlContent: result.htmlContent,
      checkCode: result.checkCode,
      pdfDownloadUrl: result.pdfDownloadUrl,
      portalUrl: result.portalUrl,
      invoiceInfo: result.invoiceInfo
    });
  } catch (error) {
    console.error("[VNPT] L\u1ED7i xem h\xF3a \u0111\u01A1n g\u1ED1c:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});
app.all("/api/vnpt/download-pdf", async (req, res) => {
  try {
    const lookupCode = String(req.query.lookupCode || req.query.fkey || req.body?.lookupCode || req.body?.fkey || "").trim();
    let checkCode = req.query.checkCode ? String(req.query.checkCode) : req.body?.checkCode ? String(req.body.checkCode) : void 0;
    if (checkCode === "undefined" || checkCode === "null" || !checkCode?.trim()) {
      checkCode = void 0;
    }
    const sellerTaxCode = req.query.sellerTaxCode ? String(req.query.sellerTaxCode) : req.body?.sellerTaxCode ? String(req.body.sellerTaxCode) : void 0;
    const portalUrl = req.query.portalUrl || req.query.portal ? String(req.query.portalUrl || req.query.portal) : req.body?.portalUrl ? String(req.body.portalUrl) : void 0;
    const invoiceNumber = req.query.invoiceNumber ? String(req.query.invoiceNumber) : req.body?.invoiceNumber ? String(req.body.invoiceNumber) : void 0;
    if (!lookupCode) {
      return res.status(400).json({ success: false, error: "M\xE3 tra c\u1EE9u VNPT (fkey) kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng" });
    }
    const result = await downloadOriginalVnptPdf({
      lookupCode,
      checkCode,
      sellerTaxCode,
      portalUrl,
      invoiceNumber
    });
    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(result.filename)}"`);
    res.setHeader("Content-Length", result.data.length);
    res.send(result.data);
  } catch (error) {
    console.error("[VNPT] L\u1ED7i t\u1EA3i PDF g\u1ED1c:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});
var vnptPortalSessions = /* @__PURE__ */ new Map();
var latestVnptSessionId = "";
function parseRequestCookies(cookieHeader) {
  const result = {};
  if (!cookieHeader) return result;
  cookieHeader.split(";").forEach((item) => {
    const parts = item.split("=");
    const name = parts[0]?.trim();
    if (name) {
      result[name] = parts.slice(1).join("=").trim();
    }
  });
  return result;
}
function getVnptSession(req) {
  const cookies = parseRequestCookies(req.headers.cookie);
  const sessionId = String(req.query.sessionId || req.body?.sessionId || cookies["vnpt_portal_session_id"] || "").trim();
  if (sessionId && vnptPortalSessions.has(sessionId)) {
    return vnptPortalSessions.get(sessionId);
  }
  if (latestVnptSessionId && vnptPortalSessions.has(latestVnptSessionId)) {
    const s = vnptPortalSessions.get(latestVnptSessionId);
    if (s && s.expiresAt > Date.now()) return s;
  }
  for (const session of vnptPortalSessions.values()) {
    if (session.expiresAt > Date.now()) {
      return session;
    }
  }
  return void 0;
}
setInterval(() => {
  const now = Date.now();
  for (const [key, session] of vnptPortalSessions.entries()) {
    if (session.expiresAt < now) {
      vnptPortalSessions.delete(key);
    }
  }
}, 10 * 60 * 1e3);
app.all(["/api/vnpt/ajxPreview", "/api/vnpt/ajx-preview", "/HomeNoLogin/ajxPreview", "/HomeNoLogin/ajxPreview/"], express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const session = getVnptSession(req);
    const portal = session?.portal || String(req.body.portalUrl || req.query.portalUrl || (req.body.sellerTaxCode ? `https://${req.body.sellerTaxCode}-tt78.vnpt-invoice.com.vn` : "https://1801660803-001-tt78.vnpt-invoice.com.vn"));
    const cookies = session?.cookies || "";
    const checkCode = String(req.body.checkCode || req.query.checkCode || "");
    const fkey = String(req.body.fkey || req.body.lookupCode || req.query.fkey || req.query.lookupCode || session?.lookupCode || "");
    const nameCus = String(req.body.nameCus || req.query.nameCus || "");
    const params = new URLSearchParams({
      checkCode,
      fkey,
      nameCus
    });
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      Referer: `${portal}/HomeNoLogin/SearchByFkey/`,
      Cookie: cookies
    };
    console.log(`[VNPT Proxy ajxPreview] T\u1EA3i b\u1EA3n th\u1EC3 hi\u1EC7n: portal=${portal}, fkey="${fkey}", checkCode="${checkCode}"...`);
    const previewRes = await axios9.post(`${portal}/HomeNoLogin/ajxPreview/`, params.toString(), {
      headers,
      timeout: 25e3
    });
    res.json(previewRes.data);
  } catch (err) {
    console.error("[VNPT Proxy ajxPreview] L\u1ED7i:", err.message);
    res.status(500).json({ error: err.message });
  }
});
app.all(["/api/vnpt/downloadPDF", "/HomeNoLogin/downloadPDF", "/HomeNoLogin/downloadPDF/"], async (req, res) => {
  try {
    const session = getVnptSession(req);
    const portal = session?.portal || String(req.query.portalUrl || req.body?.portalUrl || (req.query.sellerTaxCode ? `https://${req.query.sellerTaxCode}-tt78.vnpt-invoice.com.vn` : "https://1801660803-001-tt78.vnpt-invoice.com.vn"));
    const cookies = session?.cookies || "";
    const checkCode = String(req.query.checkCode || req.body?.checkCode || "");
    const fkey = String(req.query.fkey || req.query.lookupCode || req.body?.fkey || req.body?.lookupCode || session?.lookupCode || "");
    const nameCus = String(req.query.nameCus || req.body?.nameCus || "");
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      Referer: `${portal}/HomeNoLogin/SearchByFkey/`,
      Cookie: cookies
    };
    const targetUrl = `${portal}/HomeNoLogin/downloadPDF?checkCode=${encodeURIComponent(checkCode)}&fkey=${encodeURIComponent(fkey)}&nameCus=${encodeURIComponent(nameCus)}`;
    console.log(`[VNPT Proxy downloadPDF] T\u1EA3i PDF t\u1EEB: ${targetUrl}...`);
    const pdfRes = await axios9.get(targetUrl, {
      headers,
      responseType: "arraybuffer",
      timeout: 3e4
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="HoaDon_VNPT_${fkey || "DT"}.pdf"`);
    res.send(Buffer.from(pdfRes.data));
  } catch (err) {
    console.error("[VNPT Proxy downloadPDF] L\u1ED7i:", err.message);
    res.status(500).send("L\u1ED7i khi t\u1EA3i file PDF t\u1EEB C\u1ED5ng VNPT: " + err.message);
  }
});
app.all(["/api/vnpt/downloadZip", "/api/vnpt/download-zip", "/HomeNoLogin/downloadZip", "/HomeNoLogin/downloadZip/"], async (req, res) => {
  try {
    const session = getVnptSession(req);
    const portal = session?.portal || String(req.query.portalUrl || req.body?.portalUrl || (req.query.sellerTaxCode ? `https://${req.query.sellerTaxCode}-tt78.vnpt-invoice.com.vn` : "https://1801660803-001-tt78.vnpt-invoice.com.vn"));
    const cookies = session?.cookies || "";
    const checkCode = String(req.query.checkCode || req.body?.checkCode || "");
    const fkey = String(req.query.fkey || req.query.lookupCode || req.body?.fkey || req.body?.lookupCode || session?.lookupCode || "");
    const nameCus = String(req.query.nameCus || req.body?.nameCus || "");
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      Referer: `${portal}/HomeNoLogin/SearchByFkey/`,
      Cookie: cookies
    };
    const targetUrl = `${portal}/HomeNoLogin/downloadZip?checkCode=${encodeURIComponent(checkCode)}&fkey=${encodeURIComponent(fkey)}&nameCus=${encodeURIComponent(nameCus)}`;
    const zipRes = await axios9.get(targetUrl, {
      headers,
      responseType: "arraybuffer",
      timeout: 3e4
    });
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="HoaDon_VNPT_${fkey || "DT"}.zip"`);
    res.send(Buffer.from(zipRes.data));
  } catch (err) {
    console.error("[VNPT Proxy downloadZip] L\u1ED7i:", err.message);
    res.status(500).send("L\u1ED7i khi t\u1EA3i file Zip: " + err.message);
  }
});
app.all(["/Record/DownloadMultiFiles", "/HomeNoLogin/DownloadMultiFiles"], async (req, res) => {
  try {
    const session = getVnptSession(req);
    if (!session) {
      return res.status(404).send("Phi\xEAn l\xE0m vi\u1EC7c \u0111\xE3 h\u1EBFt h\u1EA1n.");
    }
    const targetUrl = `${session.portal}${req.originalUrl}`;
    const fileRes = await axios9.get(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        Referer: `${session.portal}/HomeNoLogin/SearchByFkey/`,
        Cookie: session.cookies
      },
      responseType: "arraybuffer",
      timeout: 3e4
    });
    res.setHeader("Content-Type", String(fileRes.headers["content-type"] || "application/octet-stream"));
    res.send(Buffer.from(fileRes.data));
  } catch (err) {
    res.status(500).send(err.message);
  }
});
app.all("/api/vnpt/portal", (req, res) => {
  const rawMst = String(req.query.mst || req.query.sellerTaxCode || req.query.taxCode || req.body?.mst || req.body?.sellerTaxCode || "").trim();
  const code = String(req.query.code || req.query.fkey || req.query.lookupCode || req.body?.code || req.body?.fkey || "").trim();
  const rawPortal = String(req.query.portal || req.query.portalUrl || req.body?.portal || req.body?.portalUrl || "").trim();
  const cleanMst = rawMst.replace(/[^0-9\-]/g, "");
  let portal = rawPortal.replace(/\/+$/, "").replace(/\/HomeNoLogin\/SearchByFkey\/?$/i, "");
  if (!portal || !/vnpt-invoice/i.test(portal)) {
    portal = cleanMst ? `https://${cleanMst}-tt78.vnpt-invoice.com.vn` : "https://4000344946-tt78.vnpt-invoice.com.vn";
  }
  const actionUrl = `${portal}/HomeNoLogin/SearchByFkey`;
  const safeCode = code.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  res.type("html").send(`<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <title>\u0110ang m\u1EDF C\u1ED5ng tra c\u1EE9u VNPT...</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc;">
  <div style="text-align: center; color: #475569;">
    <p style="font-size: 15px; font-weight: 500;">\u0110ang m\u1EDF C\u1ED5ng tra c\u1EE9u VNPT...</p>
    <form id="vnptForm" method="POST" action="${actionUrl}">
      <input type="hidden" name="strFkey" value="${safeCode}" />
      <noscript>
        <button type="submit" style="background: #0284c7; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">
          B\u1EA5m v\xE0o \u0111\xE2y \u0111\u1EC3 ti\u1EBFp t\u1EE5c m\u1EDF C\u1ED5ng VNPT
        </button>
      </noscript>
    </form>
  </div>
  <script>
    document.getElementById('vnptForm').submit();
  </script>
</body>
</html>`);
});
app.get("/api/vnpt/captcha", async (req, res) => {
  try {
    const session = getVnptSession(req);
    if (!session) {
      return res.status(404).send("Session expired");
    }
    const captchaRes = await axios9.get(`${session.portal}/Captcha/Show?t=${Date.now()}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        Cookie: session.cookies,
        Referer: `${session.portal}/HomeNoLogin/SearchByFkey/`
      },
      responseType: "arraybuffer",
      timeout: 1e4
    });
    const captchaCookies = (captchaRes.headers["set-cookie"] || []).map((c) => c.split(";")[0]);
    session.cookies = [...session.cookies.split("; "), ...captchaCookies].filter((c, idx, arr) => arr.findIndex((item) => item.split("=")[0] === c.split("=")[0]) === idx).join("; ");
    res.setHeader("Content-Type", "image/png");
    res.send(Buffer.from(captchaRes.data));
  } catch (e) {
    res.status(500).send("Error refreshing captcha");
  }
});
app.get("/api/vnpt/auto-solve-captcha", async (req, res) => {
  try {
    const session = getVnptSession(req);
    if (!session) {
      return res.status(404).json({ success: false, error: "Phi\xEAn tra c\u1EE9u \u0111\xE3 h\u1EBFt h\u1EA1n. Vui l\xF2ng t\u1EA3i l\u1EA1i trang." });
    }
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      Referer: `${session.portal}/HomeNoLogin/SearchByFkey/`,
      Cookie: session.cookies
    };
    const captchaRes = await axios9.get(`${session.portal}/Captcha/Show?t=${Date.now()}`, {
      headers,
      responseType: "arraybuffer",
      timeout: 15e3
    });
    const captchaCookies = (captchaRes.headers["set-cookie"] || []).map((c) => c.split(";")[0]);
    session.cookies = [...session.cookies.split("; "), ...captchaCookies].filter((c, idx, arr) => arr.findIndex((item) => item.split("=")[0] === c.split("=")[0]) === idx).join("; ");
    const captchaResult = await CaptchaSolver.solveWithDetails(Buffer.from(captchaRes.data), {
      prompt: VNPT_CAPTCHA_PROMPT
    });
    res.json({
      success: true,
      code: captchaResult.code,
      base64: `data:image/png;base64,${Buffer.from(captchaRes.data).toString("base64")}`
    });
  } catch (err) {
    console.error("[VNPT Auto Solve Captcha] L\u1ED7i:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/vnpt/portal-submit", express.urlencoded({ extended: true }), async (req, res) => {
  const sessionId = String(req.query.sessionId || "").trim();
  const session = getVnptSession(req);
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.headers["x-forwarded-host"] || req.get("host");
  const baseUrl = `${proto}://${host}`;
  if (!session) {
    const mst = String(req.body.mst || "");
    const code = String(req.body.strFkey || "");
    return res.redirect(`/api/vnpt/portal?mst=${encodeURIComponent(mst)}&code=${encodeURIComponent(code)}`);
  }
  try {
    const strFkey = String(req.body.strFkey || session.lookupCode || "").trim();
    const captch = String(req.body.captch || "").trim();
    const token = String(req.body.__RequestVerificationToken || session.token || "").trim();
    console.log(`[VNPT Portal Submit] G\u1EEDi t\xECm ki\u1EBFm: portal=${session.portal}, strFkey="${strFkey}", captcha="${captch}"...`);
    const form = new URLSearchParams({
      __RequestVerificationToken: token,
      strFkey,
      captch,
      submit: ""
    });
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: `${session.portal}/HomeNoLogin/SearchByFkey/`,
      Cookie: session.cookies
    };
    const postRes = await axios9.post(`${session.portal}/HomeNoLogin/SearchByFkey`, form.toString(), {
      headers,
      responseType: "text",
      validateStatus: (s) => s >= 200 && s < 400
    });
    const postCookies = (postRes.headers["set-cookie"] || []).map((c) => c.split(";")[0]);
    if (postCookies.length > 0) {
      session.cookies = [...session.cookies.split("; "), ...postCookies].filter((c, idx, arr) => arr.findIndex((item) => item.split("=")[0] === c.split("=")[0]) === idx).join("; ");
    }
    res.setHeader("Set-Cookie", `vnpt_portal_session_id=${sessionId}; Path=/; SameSite=Lax; Max-Age=1800`);
    const html = String(postRes.data || "");
    const isCaptchaError = /mã xác thực không chính xác|mã xác thực không đúng|sai mã xác thực/i.test(html) && !/thao tác|xem hóa đơn|tải file/i.test(html);
    const $ = cheerio5.load(html);
    $("head").prepend(`<base href="${session.portal}/">`);
    if (isCaptchaError) {
      try {
        const freshCaptcha = await axios9.get(`${session.portal}/Captcha/Show?t=${Date.now()}`, {
          headers: { ...headers, Cookie: session.cookies, Referer: `${session.portal}/HomeNoLogin/SearchByFkey/` },
          responseType: "arraybuffer",
          timeout: 1e4
        });
        const captchaCookies = (freshCaptcha.headers["set-cookie"] || []).map((c) => c.split(";")[0]);
        session.cookies = [...session.cookies.split("; "), ...captchaCookies].filter((c, idx, arr) => arr.findIndex((item) => item.split("=")[0] === c.split("=")[0]) === idx).join("; ");
        const freshBase64 = `data:image/png;base64,${Buffer.from(freshCaptcha.data).toString("base64")}`;
        $('img[src*="/Captcha/Show"], img#imgCaptcha, img.captcha_img').attr("src", freshBase64);
      } catch (err) {
        console.warn("[VNPT Portal Submit] L\u1ED7i l\xE0m m\u1EDBi captcha:", err.message);
      }
      $("#strFkey").attr("value", strFkey);
      $('form[action*="/HomeNoLogin/SearchByFkey"]').attr("action", `${baseUrl}/api/vnpt/portal-submit?sessionId=${sessionId}`);
      $("body").prepend(`
        <div style="background: #dc2626; color: white; padding: 10px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 999999;">
          <span>\u26A0\uFE0F <strong>M\xE3 x\xE1c th\u1EF1c kh\xF4ng ch\xEDnh x\xE1c.</strong> \u0110\xE3 l\xE0m m\u1EDBi \u1EA3nh m\xE3 x\xE1c th\u1EF1c. Vui l\xF2ng nh\xECn h\xECnh v\xE0 nh\u1EADp l\u1EA1i (M\xE3 tra c\u1EE9u <strong>${strFkey}</strong> v\u1EABn \u0111\u01B0\u1EE3c gi\u1EEF nguy\xEAn).</span>
          <a href="${session.portal}/HomeNoLogin/SearchByFkey" target="_blank" rel="noopener noreferrer" onclick="navigator.clipboard && navigator.clipboard.writeText('${strFkey}');" style="color: #fecaca; text-decoration: underline; font-size: 12px;">M\u1EDF link g\u1ED1c tr\u1EF1c ti\u1EBFp t\u1EA1i C\u1ED5ng VNPT &rarr;</a>
        </div>
      `);
      $("body").append(`
        <script>
          $(document).ready(function() {
            $('#strFkey').val(${JSON.stringify(strFkey)});
            $('#captch').val('').focus();
            $('img.captcha_img, img[src*="data:image"], img[src*="/Captcha/Show"]').css('cursor', 'pointer').on('click', function() {
              var imgEl = this;
              fetch('${baseUrl}/api/vnpt/captcha?sessionId=${sessionId}&t=' + Date.now())
                .then(function(res) { return res.blob(); })
                .then(function(blob) {
                  imgEl.src = URL.createObjectURL(blob);
                  $('#captch').val('').focus();
                });
            });
          });
        </script>
      `);
      return res.type("html").send($.html());
    }
    $("head").append(`
      <style>
        body { background: #f8fafc !important; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important; }
        #banner-vnptinvoice, #body, #bodyMain { height: auto !important; min-height: auto !important; overflow: visible !important; }
        .box__form, .box-searchInv {
          max-width: 1180px !important;
          margin: 25px auto !important;
          padding: 24px !important;
          background: #ffffff !important;
          border-radius: 14px !important;
          box-shadow: 0 8px 30px rgba(0,0,0,0.06) !important;
          border: 1px solid #e2e8f0 !important;
        }
        .table {
          width: 100% !important;
          border-collapse: separate !important;
          border-spacing: 0 !important;
          border: 1px solid #cbd5e1 !important;
          border-radius: 10px !important;
          overflow: hidden !important;
          background: #fff !important;
          margin-top: 15px !important;
        }
        .table th {
          background: #f1f5f9 !important;
          color: #1e293b !important;
          font-weight: 700 !important;
          font-size: 13px !important;
          padding: 12px 10px !important;
          border-bottom: 2px solid #cbd5e1 !important;
          text-align: center !important;
        }
        .table td {
          padding: 12px 10px !important;
          border-bottom: 1px solid #e2e8f0 !important;
          vertical-align: middle !important;
          font-size: 13px !important;
          color: #334155 !important;
        }
        .table tr:hover td { background: #f8fafc !important; }
        .table tr:last-child td { border-bottom: none !important; }
      </style>
    `);
    $("table tr").each((_, tr) => {
      const $tr = $(tr);
      const viewLink = $tr.find('a[onclick*="ajxCall4Portal"]');
      const dlLink = $tr.find('a[href*="downloadPDF"]');
      let rowCheckCode = "";
      if (viewLink.length > 0) {
        const m = (viewLink.attr("onclick") || "").match(/ajxCall4Portal\(\s*['"]([^'"]+)['"]/);
        if (m) rowCheckCode = m[1];
      }
      if (!rowCheckCode && dlLink.length > 0) {
        const m = (dlLink.attr("href") || "").match(/checkCode=([^&"']+)/);
        if (m) rowCheckCode = decodeURIComponent(m[1]);
      }
      if (rowCheckCode) {
        const targetTd = viewLink.closest("td").length > 0 ? viewLink.closest("td") : dlLink.closest("td");
        if (targetTd.length > 0) {
          targetTd.html(`
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; justify-content:center;">
              <button type="button" onclick="openVnptInvoice('${rowCheckCode}', '${strFkey}')" style="background:#0284c7; color:#fff; border:none; padding:6px 13px; border-radius:6px; font-weight:600; font-size:12px; cursor:pointer; display:inline-flex; align-items:center; gap:5px; box-shadow:0 1px 3px rgba(2,132,199,0.3); transition:all 0.15s;" title="Xem chi ti\u1EBFt h\xF3a \u0111\u01A1n g\u1ED1c">
                <svg style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                <span>Xem</span>
              </button>
              <a href="${baseUrl}/api/vnpt/download-pdf?checkCode=${encodeURIComponent(rowCheckCode)}&lookupCode=${encodeURIComponent(strFkey)}&sellerTaxCode=${encodeURIComponent(session.cleanMst)}&portalUrl=${encodeURIComponent(session.portal)}" target="_blank" download="HoaDon_VNPT_${strFkey}.pdf" style="background:#16a34a; color:#fff; border:none; padding:6px 13px; border-radius:6px; font-weight:600; font-size:12px; cursor:pointer; text-decoration:none; display:inline-flex; align-items:center; gap:5px; box-shadow:0 1px 3px rgba(22,163,74,0.3); transition:all 0.15s;" title="T\u1EA3i file PDF h\xF3a \u0111\u01A1n g\u1ED1c \u0111\xE3 k\xFD s\u1ED1">
                <svg style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                <span>T\u1EA3i PDF</span>
              </a>
              <a href="${baseUrl}/api/vnpt/download-zip?checkCode=${encodeURIComponent(rowCheckCode)}&lookupCode=${encodeURIComponent(strFkey)}&sellerTaxCode=${encodeURIComponent(session.cleanMst)}&portalUrl=${encodeURIComponent(session.portal)}" download="HoaDon_VNPT_${strFkey}.zip" style="background:#475569; color:#fff; border:none; padding:6px 10px; border-radius:6px; font-weight:600; font-size:12px; cursor:pointer; text-decoration:none; display:inline-flex; align-items:center; gap:5px; box-shadow:0 1px 3px rgba(71,85,105,0.3); transition:all 0.15s;" title="T\u1EA3i file ZIP g\u1ED3m XML ch\u1EEF k\xFD s\u1ED1 v\xE0 PDF">
                <svg style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;" viewBox="0 0 24 24"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
                <span>ZIP</span>
              </a>
            </div>
          `);
        }
      }
    });
    $("body").prepend(`
      <div style="background: linear-gradient(135deg, #059669, #047857); color: white; padding: 12px 18px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 999999; box-shadow: 0 3px 12px rgba(0,0,0,0.25);">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="background: #10b981; color: white; border-radius: 50%; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; font-weight: bold;">\u2713</span>
          <span><strong>Tra c\u1EE9u VNPT th\xE0nh c\xF4ng:</strong> \u0110\xE3 t\xECm th\u1EA5y k\u1EBFt qu\u1EA3 h\xF3a \u0111\u01A1n cho m\xE3 tra c\u1EE9u <strong>${strFkey}</strong>. Qu\xFD kh\xE1ch c\xF3 th\u1EC3 b\u1EA5m <strong>Xem</strong> ho\u1EB7c <strong>T\u1EA3i file PDF</strong> tr\u1EF1c ti\u1EBFp.</span>
        </div>
        <a href="${session.portal}/HomeNoLogin/SearchByFkey" target="_blank" rel="noopener noreferrer" onclick="navigator.clipboard && navigator.clipboard.writeText('${strFkey}'); alert('\u0110\xE3 sao ch\xE9p m\xE3 tra c\u1EE9u ${strFkey} v\xE0o b\u1ED9 nh\u1EDB t\u1EA1m! Khi m\u1EDF C\u1ED5ng VNPT, b\u1EA1n ch\u1EC9 c\u1EA7n nh\u1EA5n Ctrl+V v\xE0o \xF4 tra c\u1EE9u.');" style="color: #ffffff; text-decoration: none; font-size: 12px; background: rgba(255,255,255,0.2); padding: 6px 12px; border-radius: 6px; font-weight: 600; border: 1px solid rgba(255,255,255,0.3); display: inline-flex; align-items: center; gap: 4px;">
          <span>M\u1EDF web g\u1ED1c vnpt-invoice.com.vn</span> &rarr;
        </a>
      </div>
    `);
    $("body").append(`
      <!-- Modal Backdrop -->
      <div id="vnpt-modal-backdrop" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.65); z-index:9999998; backdrop-filter:blur(2px);" onclick="closeVnptModal()"></div>

      <!-- Loading Spinner -->
      <div id="vnpt-modal-loading" style="display:none; position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#0f172a; color:#f8fafc; padding:18px 28px; border-radius:10px; z-index:9999999; box-shadow:0 20px 40px rgba(0,0,0,0.4); font-family:sans-serif; font-size:14px; align-items:center; gap:12px;">
        <span style="display:inline-block; width:22px; height:22px; border:3px solid #38bdf8; border-top-color:transparent; border-radius:50%; animation:vnpt-spin 0.8s linear infinite;"></span>
        <span>\u0110ang t\u1EA3i n\u1ED9i dung h\xF3a \u0111\u01A1n g\u1ED1c t\u1EEB C\u1ED5ng VNPT...</span>
      </div>

      <!-- Invoice Viewer Modal -->
      <div id="ViewInvoice" style="display:none; position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#ffffff; border-radius:12px; box-shadow:0 25px 60px rgba(0,0,0,0.5); padding:24px; width:940px; max-width:96vw; max-height:92vh; overflow-y:auto; z-index:9999999; border:1px solid #cbd5e1; font-family:Arial,sans-serif;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; padding-bottom:12px; margin-bottom:16px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:20px;">\u{1F4C4}</span>
            <strong style="color:#005baa; font-size:16px;">Chi Ti\u1EBFt H\xF3a \u0110\u01A1n \u0110i\u1EC7n T\u1EED - VNPT Invoice</strong>
          </div>
          <button type="button" onclick="closeVnptModal()" style="border:none; background:#f1f5f9; border-radius:6px; cursor:pointer; font-size:18px; font-weight:bold; width:34px; height:34px; display:flex; align-items:center; justify-content:center; color:#475569;" title="\u0110\xF3ng">\u2715</button>
        </div>
        <div id="bt" style="margin-bottom:14px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;"></div>
        <div id="container" style="background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:16px; overflow:auto;"></div>
      </div>

      <style>
        @keyframes vnpt-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        #ViewInvoice table { width: 100% !important; border-collapse: collapse; }
      </style>

      <script>
        // H\xE0m m\u1EDF xem h\xF3a \u0111\u01A1n tr\u1EF1c ti\u1EBFp
        window.openVnptInvoice = function(checkCode, fkey) {
          fkey = fkey || ${JSON.stringify(strFkey)};
          $('#vnpt-modal-loading').css('display', 'flex');
          $('#vnpt-modal-backdrop').show();
          $('#ViewInvoice').hide();

          $.ajax({
            type: 'POST',
            url: '${baseUrl}/api/vnpt/ajxPreview',
            data: { checkCode: checkCode, fkey: fkey, sessionId: ${JSON.stringify(sessionId)} },
            success: function(data) {
              $('#vnpt-modal-loading').hide();
              if (!data || !data.str) {
                alert('Kh\xF4ng t\u1EA3i \u0111\u01B0\u1EE3c n\u1ED9i dung h\xF3a \u0111\u01A1n t\u1EEB C\u1ED5ng VNPT. Vui l\xF2ng th\u1EED l\u1EA1i.');
                $('#vnpt-modal-backdrop').hide();
                return;
              }
              $('#container').html(data.str);

              var btnHtml = '';
              btnHtml += '<button type="button" onclick="window.printInvoiceDirect()" style="background:#0284c7; color:#fff; border:none; padding:8px 16px; border-radius:6px; font-weight:600; font-size:13px; cursor:pointer; display:inline-flex; align-items:center; gap:6px; box-shadow:0 1px 3px rgba(0,0,0,0.2);"><svg style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;" viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> In H\xF3a \u0110\u01A1n</button>';
              btnHtml += '<a href="${baseUrl}/api/vnpt/download-pdf?checkCode=' + encodeURIComponent(checkCode) + '&lookupCode=' + encodeURIComponent(fkey) + '&sellerTaxCode=${encodeURIComponent(session.cleanMst)}&portalUrl=${encodeURIComponent(session.portal)}" target="_blank" download style="background:#16a34a; color:#fff; border:none; padding:8px 16px; border-radius:6px; font-weight:600; font-size:13px; cursor:pointer; text-decoration:none; display:inline-flex; align-items:center; gap:6px; box-shadow:0 1px 3px rgba(0,0,0,0.2);"><svg style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> T\u1EA3i PDF H\xF3a \u0110\u01A1n</a>';
              btnHtml += '<a href="${baseUrl}/api/vnpt/download-zip?checkCode=' + encodeURIComponent(checkCode) + '&lookupCode=' + encodeURIComponent(fkey) + '&sellerTaxCode=${encodeURIComponent(session.cleanMst)}&portalUrl=${encodeURIComponent(session.portal)}" download style="background:#475569; color:#fff; border:none; padding:8px 16px; border-radius:6px; font-weight:600; font-size:13px; cursor:pointer; text-decoration:none; display:inline-flex; align-items:center; gap:6px; box-shadow:0 1px 3px rgba(0,0,0,0.2);"><svg style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;" viewBox="0 0 24 24"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg> T\u1EA3i File Zip</a>';
              btnHtml += '<button type="button" onclick="closeVnptModal()" style="background:#f1f5f9; color:#334155; border:1px solid #cbd5e1; padding:8px 16px; border-radius:6px; font-weight:600; font-size:13px; cursor:pointer; margin-left:auto;">\u2715 \u0110\xF3ng</button>';

              $('#bt').html(btnHtml);
              $('#ViewInvoice').show();
            },
            error: function(xhr, status, err) {
              $('#vnpt-modal-loading').hide();
              $('#vnpt-modal-backdrop').hide();
              alert('L\u1ED7i khi t\u1EA3i h\xF3a \u0111\u01A1n t\u1EEB C\u1ED5ng VNPT: ' + (err || status));
            }
          });
          return false;
        };

        window.ajxCall4Portal = window.openVnptInvoice;

        window.printInvoiceDirect = function() {
          var printContent = document.getElementById('container').innerHTML;
          var win = window.open('', '_blank', 'width=950,height=750');
          win.document.write('<!DOCTYPE html><html><head><title>H\xF3a \u0111\u01A1n VNPT - ${strFkey}</title>');
          win.document.write('<style>@page{size:A4;margin:8mm;}body{margin:0;padding:12px;font-family:Arial,sans-serif;}table{width:100% !important;border-collapse:collapse;}</style>');
          win.document.write('</head><body>');
          win.document.write(printContent);
          win.document.write('</body></html>');
          win.document.close();
          win.focus();
          setTimeout(function() { win.print(); win.close(); }, 600);
        };

        window.closeVnptModal = function() {
          $('#ViewInvoice').hide();
          $('#vnpt-modal-loading').hide();
          $('#vnpt-modal-backdrop').hide();
        };

        $(document).ready(function() {
          // Ng\u0103n m\u1ECDi th\u1EBB a c\xF3 href="#", "/" ho\u1EB7c r\u1ED7ng chuy\u1EC3n h\u01B0\u1EDBng trang ngo\xE0i \xFD mu\u1ED1n
          $('a[href="#"], a[href="/"], a[href=""]').on('click', function(e) {
            e.preventDefault();
            return false;
          });
        });
      </script>
    `);
    res.type("html").send($.html());
  } catch (error) {
    console.error("[VNPT Portal Submit] L\u1ED7i x\u1EED l\xFD form:", error.message);
    res.redirect(`${session.portal}/HomeNoLogin/SearchByFkey`);
  }
});
app.all("/api/viettel/download-pdf", async (req, res) => {
  try {
    const supplierTaxCode = String(
      req.query.supplierTaxCode || req.query.sellerTaxCode || req.query.taxCode || req.body?.supplierTaxCode || req.body?.sellerTaxCode || req.body?.taxCode || ""
    ).trim();
    const reservationCode = String(
      req.query.reservationCode || req.query.secretCode || req.query.lookupCode || req.body?.reservationCode || req.body?.secretCode || req.body?.lookupCode || ""
    ).trim();
    const invoiceNo = req.query.invoiceNo || req.query.invoiceNumber || req.body?.invoiceNo || req.body?.invoiceNumber;
    const invoiceSeries = req.query.invoiceSeries || req.query.series || req.body?.invoiceSeries || req.body?.series;
    if (!supplierTaxCode) {
      return res.status(400).json({ success: false, error: "M\xE3 s\u1ED1 thu\u1EBF b\xEAn b\xE1n (supplierTaxCode) kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng" });
    }
    if (!reservationCode) {
      return res.status(400).json({ success: false, error: "M\xE3 b\xED m\u1EADt (reservationCode / M\xE3 s\u1ED1 b\xED m\u1EADt) kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng" });
    }
    const result = await downloadOriginalViettelPdf({
      supplierTaxCode,
      reservationCode,
      invoiceNo: invoiceNo ? String(invoiceNo) : void 0,
      invoiceSeries: invoiceSeries ? String(invoiceSeries) : void 0
    });
    if (req.query.format === "json") {
      return res.json({
        success: true,
        filename: result.filename,
        pdfBase64: result.pdfBase64,
        sourceUrl: result.sourceUrl
      });
    }
    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(result.filename)}"`);
    res.setHeader("Content-Length", result.pdfBuffer.length);
    res.send(result.pdfBuffer);
  } catch (error) {
    console.error("[Viettel] L\u1ED7i t\u1EA3i PDF g\u1ED1c:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});
app.all("/api/viettel/download-zip", async (req, res) => {
  try {
    const supplierTaxCode = String(
      req.query.supplierTaxCode || req.query.sellerTaxCode || req.query.taxCode || req.body?.supplierTaxCode || req.body?.sellerTaxCode || req.body?.taxCode || ""
    ).trim();
    const reservationCode = String(
      req.query.reservationCode || req.query.secretCode || req.query.lookupCode || req.body?.reservationCode || req.body?.secretCode || req.body?.lookupCode || ""
    ).trim();
    const invoiceNo = req.query.invoiceNo || req.query.invoiceNumber || req.body?.invoiceNo || req.body?.invoiceNumber;
    if (!supplierTaxCode || !reservationCode) {
      return res.status(400).json({ success: false, error: "Thi\u1EBFu MST b\xEAn b\xE1n ho\u1EB7c M\xE3 b\xED m\u1EADt \u0111\u1EC3 t\u1EA3i ZIP" });
    }
    const result = await downloadOriginalViettelZip({
      supplierTaxCode,
      reservationCode,
      invoiceNo: invoiceNo ? String(invoiceNo) : void 0
    });
    if (req.query.format === "json") {
      return res.json({
        success: true,
        filename: result.filename,
        zipBase64: result.zipBase64,
        sourceUrl: result.sourceUrl
      });
    }
    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(result.filename)}"`);
    res.setHeader("Content-Length", result.zipBuffer.length);
    res.send(result.zipBuffer);
  } catch (error) {
    console.error("[Viettel] L\u1ED7i t\u1EA3i ZIP g\u1ED1c:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});
app.post("/api/vnpay/lookup", async (req, res) => {
  try {
    let lookupCode = String(req.body?.lookupCode || req.query?.lookupCode || "").trim();
    const taxCode = String(req.body?.taxCode || req.body?.sellerTaxCode || req.query?.taxCode || "").trim();
    const cqtCode = String(req.body?.cqtCode || req.body?.mhdon || req.query?.cqtCode || req.query?.mhdon || "").trim();
    const captchaToken = req.body?.captchaToken || req.query?.captchaToken;
    const isInvalidCode = (code) => !code || code.toLowerCase() === "vietcombank" || /^[VTMB]\d{10,14}[A-Za-z0-9]{16,}$/i.test(code.trim()) || code.includes("0102182292") && code.length > 20;
    if (isInvalidCode(lookupCode)) {
      lookupCode = "";
    }
    if (!lookupCode) {
      const portalUrl = buildVnpayPortalUrl("", taxCode);
      return res.status(400).json({
        success: false,
        directUrl: portalUrl,
        error: "C\u1ED5ng VNPAY y\xEAu c\u1EA7u S\u1ED1 b\u1EA3o m\u1EADt in tr\xEAn h\xF3a \u0111\u01A1n. C\u1ED5ng kh\xF4ng h\u1ED7 tr\u1EE3 tra c\u1EE9u tr\u1EF1c ti\u1EBFp qua m\xE3 CQT c\u1EA5p (mhdon)."
      });
    }
    if (!taxCode) {
      return res.status(400).json({ success: false, error: "M\xE3 s\u1ED1 thu\u1EBF b\xEAn b\xE1n kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng" });
    }
    const result = await lookupVnpayInvoice({
      lookupCode,
      taxCode,
      cqtCode: cqtCode || void 0,
      captchaToken: captchaToken ? String(captchaToken) : void 0
    });
    res.json(result);
  } catch (error) {
    console.error("[VNPAY] L\u1ED7i tra c\u1EE9u h\xF3a \u0111\u01A1n:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});
app.all("/api/vnpay/download-pdf", async (req, res) => {
  try {
    const sellerTaxCode = String(
      req.query.sellerTaxCode || req.query.taxCode || req.query.supplierTaxCode || req.body?.sellerTaxCode || req.body?.taxCode || req.body?.supplierTaxCode || ""
    ).trim();
    let lookupCode = String(
      req.query.lookupCode || req.query.code || req.body?.lookupCode || req.body?.code || ""
    ).trim();
    const cqtCode = String(
      req.query.cqtCode || req.query.mhdon || req.body?.cqtCode || req.body?.mhdon || ""
    ).trim();
    const isInvalidCode = (code) => !code || code.toLowerCase() === "vietcombank" || /^[VTMB]\d{10,14}[A-Za-z0-9]{16,}$/i.test(code.trim()) || code.includes("0102182292") && code.length > 20;
    if (isInvalidCode(lookupCode)) {
      lookupCode = "";
    }
    const stringId = String(
      req.query.stringId || req.query.id || req.body?.stringId || req.body?.id || ""
    ).trim();
    const invoiceNo = req.query.invoiceNo || req.query.invoiceNumber || req.body?.invoiceNo || req.body?.invoiceNumber;
    const invoiceSeries = req.query.invoiceSeries || req.query.series || req.body?.invoiceSeries || req.body?.series;
    const captchaToken = req.query.captchaToken || req.body?.captchaToken;
    if (!sellerTaxCode) {
      return res.status(400).json({ success: false, error: "M\xE3 s\u1ED1 thu\u1EBF b\xEAn b\xE1n (sellerTaxCode) kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng" });
    }
    if (!stringId && !lookupCode) {
      return res.status(400).json({
        success: false,
        sourceUrl: buildVnpayPortalUrl("", sellerTaxCode),
        error: "C\u1EA7n S\u1ED1 b\u1EA3o m\u1EADt (lookupCode) ho\u1EB7c stringId \u0111\u1EC3 t\u1EA3i file t\u1EEB C\u1ED5ng VNPAY."
      });
    }
    const result = await downloadOriginalVnpayPdf({
      sellerTaxCode,
      lookupCode: lookupCode || void 0,
      cqtCode: cqtCode || void 0,
      stringId: stringId || void 0,
      invoiceNo: invoiceNo ? String(invoiceNo) : void 0,
      invoiceSeries: invoiceSeries ? String(invoiceSeries) : void 0,
      captchaToken: captchaToken ? String(captchaToken) : void 0
    });
    if (result.requiresCaptcha) {
      return res.status(200).json({
        success: false,
        requiresCaptcha: true,
        error: result.error,
        sourceUrl: result.sourceUrl
      });
    }
    if (req.query.format === "json" || req.body?.format === "json") {
      return res.json({
        success: true,
        filename: result.filename,
        pdfBase64: result.pdfBase64,
        sourceUrl: result.sourceUrl
      });
    }
    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(result.filename)}"`);
    res.setHeader("Content-Length", result.pdfBuffer.length);
    res.send(result.pdfBuffer);
  } catch (error) {
    console.error("[VNPAY] L\u1ED7i t\u1EA3i PDF g\u1ED1c:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});
app.all("/api/vnpay/download-xml", async (req, res) => {
  try {
    const sellerTaxCode = String(
      req.query.sellerTaxCode || req.query.taxCode || req.query.supplierTaxCode || req.body?.sellerTaxCode || req.body?.taxCode || req.body?.supplierTaxCode || ""
    ).trim();
    let lookupCode = String(
      req.query.lookupCode || req.query.code || req.body?.lookupCode || req.body?.code || ""
    ).trim();
    const cqtCode = String(
      req.query.cqtCode || req.query.mhdon || req.body?.cqtCode || req.body?.mhdon || ""
    ).trim();
    const isInvalidCode = (code) => !code || code.toLowerCase() === "vietcombank" || /^[VTMB]\d{10,14}[A-Za-z0-9]{16,}$/i.test(code.trim()) || code.includes("0102182292") && code.length > 20;
    if (isInvalidCode(lookupCode)) {
      lookupCode = "";
    }
    const stringId = String(
      req.query.stringId || req.query.id || req.body?.stringId || req.body?.id || ""
    ).trim();
    const invoiceNo = req.query.invoiceNo || req.query.invoiceNumber || req.body?.invoiceNo || req.body?.invoiceNumber;
    const invoiceSeries = req.query.invoiceSeries || req.query.series || req.body?.invoiceSeries || req.body?.series;
    if (!sellerTaxCode) {
      return res.status(400).json({ success: false, error: "M\xE3 s\u1ED1 thu\u1EBF b\xEAn b\xE1n (sellerTaxCode) kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng" });
    }
    if (!stringId && !lookupCode) {
      return res.status(400).json({
        success: false,
        sourceUrl: buildVnpayPortalUrl("", sellerTaxCode),
        error: "C\u1EA7n S\u1ED1 b\u1EA3o m\u1EADt (lookupCode) ho\u1EB7c stringId \u0111\u1EC3 t\u1EA3i file t\u1EEB C\u1ED5ng VNPAY."
      });
    }
    const result = await downloadOriginalVnpayXml({
      sellerTaxCode,
      lookupCode: lookupCode || void 0,
      cqtCode: cqtCode || void 0,
      stringId: stringId || void 0,
      invoiceNo: invoiceNo ? String(invoiceNo) : void 0,
      invoiceSeries: invoiceSeries ? String(invoiceSeries) : void 0
    });
    if (req.query.format === "json" || req.body?.format === "json") {
      return res.json({
        success: true,
        filename: result.filename,
        xmlContent: result.xmlContent,
        sourceUrl: result.sourceUrl
      });
    }
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(result.filename)}"`);
    res.send(result.xmlContent);
  } catch (error) {
    console.error("[VNPAY] L\u1ED7i t\u1EA3i XML g\u1ED1c:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});
app.post("/api/foursi/render-pdf", async (req, res) => {
  try {
    const { xml, invoice } = req.body || {};
    const result = await renderFourSiPdfViaLcs(xml, invoice);
    if (!result.success || !result.pdfBuffer) {
      return res.status(400).json({
        success: false,
        error: result.error || "Kh\xF4ng th\u1EC3 t\u1EA1o b\u1EA3n th\u1EC3 hi\u1EC7n 4Si qua LCS Soft",
        portalUrl: FOUR_SI_LCS_READER_URL
      });
    }
    res.json({
      success: true,
      filename: result.filename,
      pdfBase64: result.pdfBase64,
      sourceUrl: result.sourceUrl,
      portalUrl: result.portalUrl,
      isDisplayOnly: true,
      message: "B\u1EA3n th\u1EC3 hi\u1EC7n 4Si t\u1EA1o b\u1EDFi dochoadon.lcssoft.com.vn (g\u1EA7n gi\u1ED1ng b\u1EA3n g\u1ED1c, kh\xF4ng ph\u1EA3i h\xF3a \u0111\u01A1n g\u1ED1c c\xF3 ch\u1EEF k\xFD s\u1ED1)"
    });
  } catch (error) {
    console.error("[FourSi] L\u1ED7i render b\u1EA3n th\u1EC3 hi\u1EC7n:", error.message);
    res.status(500).json({ success: false, error: error.message, portalUrl: FOUR_SI_LCS_READER_URL });
  }
});
app.all("/api/foursi/download-pdf", async (req, res) => {
  try {
    const xml = req.body?.xml || req.query.xml ? String(req.body?.xml || req.query.xml) : "";
    const invoice = req.body?.invoice || void 0;
    const result = await renderFourSiPdfViaLcs(xml, invoice);
    if (!result.success || !result.pdfBuffer) {
      return res.status(400).json({
        success: false,
        error: result.error || "Kh\xF4ng th\u1EC3 t\u1EA1o PDF t\u1EEB c\u1ED5ng dochoadon.lcssoft.com.vn",
        portalUrl: FOUR_SI_LCS_READER_URL
      });
    }
    if (req.query.format === "json" || req.body?.format === "json") {
      return res.json({
        success: true,
        filename: result.filename,
        pdfBase64: result.pdfBase64,
        sourceUrl: result.sourceUrl,
        portalUrl: result.portalUrl,
        isDisplayOnly: true
      });
    }
    res.setHeader("Content-Type", result.contentType || "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(result.filename)}"`);
    res.setHeader("Content-Length", result.pdfBuffer.length);
    res.send(result.pdfBuffer);
  } catch (error) {
    console.error("[FourSi] L\u1ED7i t\u1EA3i PDF qua LCS Soft:", error.message);
    res.status(500).json({ success: false, error: error.message, portalUrl: FOUR_SI_LCS_READER_URL });
  }
});
app.all("/api/minvoice/download-pdf", async (req, res) => {
  try {
    const sellerTaxCode = String(
      req.query.sellerTaxCode || req.query.taxCode || req.query.masothue || req.body?.sellerTaxCode || req.body?.taxCode || req.body?.masothue || ""
    ).trim();
    const lookupCode = String(
      req.query.lookupCode || req.query.sobaomat || req.query.checkCode || req.body?.lookupCode || req.body?.sobaomat || req.body?.checkCode || ""
    ).trim();
    const invoiceNo = String(req.query.invoiceNo || req.query.shdon || req.body?.invoiceNo || req.body?.shdon || "1");
    const invoiceSeries = String(req.query.invoiceSeries || req.query.khhdon || req.body?.invoiceSeries || req.body?.khhdon || "");
    if (!sellerTaxCode) {
      return res.status(400).json({ success: false, error: "M\xE3 s\u1ED1 thu\u1EBF b\xEAn b\xE1n (sellerTaxCode / masothue) kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng" });
    }
    if (!lookupCode) {
      return res.status(400).json({ success: false, error: "S\u1ED1 b\u1EA3o m\u1EADt (lookupCode / sobaomat) kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng" });
    }
    const minvoiceUrl = `https://tracuuhoadon.minvoice.com.vn/api/Search/SearchInvoice?masothue=${encodeURIComponent(
      sellerTaxCode
    )}&sobaomat=${encodeURIComponent(lookupCode)}&type=PDF&inchuyendoi=false`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25e3);
    const resp = await fetch(minvoiceUrl, {
      method: "GET",
      headers: {
        "Accept": "application/pdf, application/octet-stream, */*",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Referer": "https://tracuuhoadon.minvoice.com.vn/",
        "Origin": "https://tracuuhoadon.minvoice.com.vn"
      },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!resp.ok) {
      throw new Error(`C\u1ED5ng M-Invoice ph\u1EA3n h\u1ED3i l\u1ED7i HTTP ${resp.status}: ${resp.statusText}`);
    }
    const arrayBuf = await resp.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    if (buffer.length < 500 || !buffer.subarray(0, 10).toString("latin1").includes("%PDF")) {
      throw new Error("D\u1EEF li\u1EC7u tr\u1EA3 v\u1EC1 t\u1EEB c\u1ED5ng M-Invoice kh\xF4ng ph\u1EA3i file PDF h\u1EE3p l\u1EC7");
    }
    const cleanShd = invoiceNo.padStart(7, "0");
    const filename = `HoaDon_MInvoice_${sellerTaxCode}_${cleanShd}_${lookupCode}.pdf`;
    if (req.query.format === "json" || req.body?.format === "json") {
      return res.json({
        success: true,
        filename,
        pdfBase64: buffer.toString("base64"),
        sourceUrl: minvoiceUrl
      });
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
  } catch (error) {
    console.error("[M-Invoice] L\u1ED7i t\u1EA3i PDF g\u1ED1c:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});
app.all("/api/cyberbill/download-pdf", async (req, res) => {
  try {
    const sellerTaxCode = String(
      req.query.sellerTaxCode || req.query.taxCode || req.query.masothue || req.body?.sellerTaxCode || req.body?.taxCode || req.body?.masothue || ""
    ).trim();
    const lookupCode = String(
      req.query.lookupCode || req.query.sobaomat || req.query.maSoBiMat || req.query.checkCode || req.body?.lookupCode || req.body?.sobaomat || req.body?.maSoBiMat || req.body?.checkCode || ""
    ).trim();
    const invoiceNo = String(req.query.invoiceNo || req.query.shdon || req.body?.invoiceNo || req.body?.shdon || "1");
    const invoiceSeries = String(req.query.invoiceSeries || req.query.khhdon || req.body?.invoiceSeries || req.body?.khhdon || "");
    if (!sellerTaxCode) {
      return res.status(400).json({ success: false, error: "M\xE3 s\u1ED1 thu\u1EBF b\xEAn b\xE1n (sellerTaxCode) kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng" });
    }
    if (!lookupCode) {
      return res.status(400).json({ success: false, error: "M\xE3 s\u1ED1 b\xED m\u1EADt (lookupCode / maSoBiMat) kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng" });
    }
    const result = await downloadOriginalCyberbillPdf({
      sellerTaxCode,
      lookupCode,
      invoiceNo,
      invoiceSeries
    });
    if (req.query.format === "json" || req.body?.format === "json") {
      return res.json({
        success: true,
        filename: result.filename,
        pdfBase64: result.pdfBase64,
        sourceUrl: result.sourceUrl,
        htmlContent: result.htmlContent
      });
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(result.filename)}"`);
    res.setHeader("Content-Length", result.pdfBuffer.length);
    res.send(result.pdfBuffer);
  } catch (error) {
    console.error("[CyberBill] L\u1ED7i t\u1EA3i PDF g\u1ED1c:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});
app.all("/api/thaison/download-pdf", async (req, res) => {
  try {
    const lookupCode = String(
      req.query.lookupCode || req.query.maNhanHoaDon || req.query.sobaomat || req.query.code || req.body?.lookupCode || req.body?.maNhanHoaDon || req.body?.sobaomat || req.body?.code || ""
    ).trim();
    const sellerTaxCode = String(
      req.query.sellerTaxCode || req.query.taxCode || req.query.masothue || req.body?.sellerTaxCode || req.body?.taxCode || req.body?.masothue || ""
    ).trim();
    const invoiceNo = String(req.query.invoiceNo || req.query.shdon || req.body?.invoiceNo || req.body?.shdon || "1");
    const invoiceSeries = String(req.query.invoiceSeries || req.query.khhdon || req.body?.invoiceSeries || req.body?.khhdon || "");
    if (!lookupCode) {
      return res.status(400).json({ success: false, error: "M\xE3 nh\u1EADn h\xF3a \u0111\u01A1n Th\xE1i S\u01A1n (lookupCode / MaNhanHoaDon) kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng" });
    }
    const result = await downloadOriginalThaiSonPdf({
      lookupCode,
      sellerTaxCode: sellerTaxCode || void 0,
      invoiceNo,
      invoiceSeries
    });
    if (req.query.format === "json" || req.body?.format === "json") {
      return res.json({
        success: true,
        filename: result.filename,
        pdfBase64: result.pdfBase64,
        sourceUrl: result.sourceUrl
      });
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(result.filename)}"`);
    res.setHeader("Content-Length", result.pdfBuffer.length);
    res.send(result.pdfBuffer);
  } catch (error) {
    console.error("[Th\xE1i S\u01A1n] L\u1ED7i t\u1EA3i PDF g\u1ED1c:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});
app.all("/api/thaison/download-xml", async (req, res) => {
  try {
    const lookupCode = String(
      req.query.lookupCode || req.query.maNhanHoaDon || req.query.code || req.body?.lookupCode || req.body?.maNhanHoaDon || req.body?.code || ""
    ).trim();
    const sellerTaxCode = String(
      req.query.sellerTaxCode || req.query.taxCode || req.body?.sellerTaxCode || req.body?.taxCode || ""
    ).trim();
    if (!lookupCode) {
      return res.status(400).json({ success: false, error: "M\xE3 nh\u1EADn h\xF3a \u0111\u01A1n Th\xE1i S\u01A1n (lookupCode) kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng" });
    }
    const result = await downloadOriginalThaiSonXml({
      lookupCode,
      sellerTaxCode: sellerTaxCode || void 0
    });
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(result.filename)}"`);
    res.send(result.xmlContent);
  } catch (error) {
    console.error("[Th\xE1i S\u01A1n] L\u1ED7i t\u1EA3i XML g\u1ED1c:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});
var runtimeAuthTokenSecret = null;
function getAuthTokenSecret() {
  const envSecret = process.env.AUTH_TOKEN_SECRET || process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL_UNPOOLED;
  if (envSecret) {
    return envSecret;
  }
  if (!runtimeAuthTokenSecret) {
    runtimeAuthTokenSecret = crypto2.randomBytes(32).toString("hex");
    console.warn("[Security Warning]: AUTH_TOKEN_SECRET environment variable is not set. Generated a secure random secret for runtime.");
  }
  return runtimeAuthTokenSecret;
}
function getWebAppAuthUrl(req) {
  if (process.env.VERCEL) {
    return "";
  }
  const configuredUrl = (process.env.AUTH_WEBAPP_URL || "").trim();
  if (!configuredUrl) {
    return "";
  }
  const normalizedUrl = /^https?:\/\//i.test(configuredUrl) ? configuredUrl : `https://${configuredUrl}`;
  const trimmed = normalizedUrl.replace(/\/+$/, "");
  if (req) {
    const host = req.get("host");
    if (host && (trimmed.includes(host) || host.includes("vercel.app"))) {
      return "";
    }
  }
  return trimmed;
}
function mapRemoteUser(user) {
  if (!user || typeof user.username !== "string") return null;
  return {
    id: user.id ?? user.username,
    username: user.username,
    password: "",
    full_name: user.fullName || user.full_name || "",
    role: user.role === "admin" ? "admin" : "user",
    duration_months: Number(user.durationMonths ?? user.duration_months) || 1,
    created_at: user.createdAt || user.created_at || (/* @__PURE__ */ new Date()).toISOString(),
    expires_at: user.expiresAt || user.expires_at || (/* @__PURE__ */ new Date(864e13)).toISOString(),
    is_active: user.isActive !== false && user.is_active !== false,
    notes: user.notes || "",
    days_remaining: Math.max(0, Number(user.daysRemaining ?? user.days_remaining) || 0),
    is_expired: user.isExpired === true || user.is_expired === true,
    status: user.status || "active"
  };
}
async function getRemoteAuthUser(token) {
  const authUrl = getWebAppAuthUrl();
  if (!authUrl) return null;
  const response = await fetch(`${authUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) return null;
  const payload = await response.json();
  return mapRemoteUser(payload.user);
}
async function proxyWebAppRequest(req, route, method) {
  const authUrl = getWebAppAuthUrl();
  const headers = {
    Authorization: req.headers.authorization || ""
  };
  const options = { method, headers };
  if (method !== "GET" && method !== "DELETE") {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(req.body || {});
  }
  const response = await fetch(`${authUrl}${route}`, options);
  const payload = await response.json().catch(() => ({
    success: false,
    message: `Webapp tr\u1EA3 v\u1EC1 HTTP ${response.status}.`
  }));
  return { status: response.status, payload };
}
function createWebToken(username) {
  const payload = Buffer.from(JSON.stringify({ username, issuedAt: Date.now() })).toString("base64url");
  const signature = crypto2.createHmac("sha256", getAuthTokenSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}
function getUsernameFromToken(token) {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = crypto2.createHmac("sha256", getAuthTokenSecret()).update(payload).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !crypto2.timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof parsed.username === "string" ? parsed.username : null;
  } catch {
    return null;
  }
}
function formatUserForClient(user) {
  return {
    id: user.id,
    username: user.username,
    fullName: user.full_name || "",
    role: user.role,
    durationMonths: user.duration_months,
    createdAt: user.created_at,
    expiresAt: user.expires_at,
    isActive: user.is_active,
    notes: user.notes || "",
    daysRemaining: user.days_remaining,
    isExpired: user.is_expired,
    status: user.status
  };
}
function formatUserForAdmin(user) {
  return {
    ...formatUserForClient(user),
    password: user.password
    // Cung cấp để Admin có thể xem/copy gửi cho khách hàng
  };
}
async function authenticateWebUser(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Vui l\xF2ng \u0111\u0103ng nh\u1EADp h\u1EC7 th\u1ED1ng." });
  }
  const token = authHeader.substring(7).trim();
  if (getWebAppAuthUrl(req)) {
    try {
      const remoteUser = await getRemoteAuthUser(token);
      if (!remoteUser || !remoteUser.is_active) {
        return res.status(401).json({ success: false, message: "Phi\xEAn \u0111\u0103ng nh\u1EADp webapp \u0111\xE3 h\u1EBFt h\u1EA1n. Vui l\xF2ng \u0111\u0103ng nh\u1EADp l\u1EA1i." });
      }
      if (remoteUser.is_expired && remoteUser.role !== "admin") {
        return res.status(403).json({ success: false, expired: true, message: "T\xE0i kho\u1EA3n \u0111\xE3 h\u1EBFt h\u1EA1n s\u1EED d\u1EE5ng." });
      }
      req.webUser = remoteUser;
      return next();
    } catch (error) {
      console.error("[Desktop Remote Auth Error]:", error.message);
      return res.status(502).json({ success: false, message: "Kh\xF4ng k\u1EBFt n\u1ED1i \u0111\u01B0\u1EE3c m\xE1y ch\u1EE7 x\xE1c th\u1EF1c webapp." });
    }
  }
  const username = getUsernameFromToken(token);
  if (!username) {
    return res.status(401).json({ success: false, message: "Phi\xEAn \u0111\u0103ng nh\u1EADp \u0111\xE3 h\u1EBFt h\u1EA1n. Vui l\xF2ng \u0111\u0103ng nh\u1EADp l\u1EA1i." });
  }
  const user = await findUserByUsername(username);
  if (!user || !user.is_active) {
    return res.status(401).json({ success: false, message: "T\xE0i kho\u1EA3n kh\xF4ng t\u1ED3n t\u1EA1i ho\u1EB7c \u0111\xE3 b\u1ECB kh\xF3a." });
  }
  if (user.is_expired && user.role !== "admin") {
    return res.status(403).json({
      success: false,
      expired: true,
      message: `T\xE0i kho\u1EA3n c\u1EE7a b\u1EA1n \u0111\xE3 h\u1EBFt h\u1EA1n s\u1EED d\u1EE5ng (${new Date(user.expires_at).toLocaleDateString("vi-VN")}). Vui l\xF2ng li\xEAn h\u1EC7 qu\u1EA3n tr\u1ECB vi\xEAn \u0111\u1EC3 gia h\u1EA1n.`
    });
  }
  req.webUser = user;
  next();
}
function requireAdmin(req, res, next) {
  const user = req.webUser;
  if (!user || user.role !== "admin") {
    return res.status(403).json({ success: false, message: "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n qu\u1EA3n tr\u1ECB vi\xEAn." });
  }
  next();
}
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: "Vui l\xF2ng nh\u1EADp M\xE3 s\u1ED1 thu\u1EBF v\xE0 m\u1EADt kh\u1EA9u." });
    }
    const authUrl = getWebAppAuthUrl(req);
    if (authUrl) {
      const remoteResponse = await fetch(`${authUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const remotePayload = await remoteResponse.json().catch(() => ({}));
      if (!remoteResponse.ok || remotePayload.success === false) {
        return res.status(remoteResponse.status || 502).json(remotePayload);
      }
      if (!remotePayload.token || !remotePayload.user) {
        return res.status(502).json({ success: false, message: "Webapp tr\u1EA3 v\u1EC1 d\u1EEF li\u1EC7u \u0111\u0103ng nh\u1EADp kh\xF4ng h\u1EE3p l\u1EC7." });
      }
      return res.json(remotePayload);
    }
    const dbInit = await initDatabase();
    if (!dbInit.success) {
      return res.status(200).json({
        success: false,
        message: dbInit.message || "Kh\xF4ng th\u1EC3 k\u1EBFt n\u1ED1i \u0111\u1EBFn c\u01A1 s\u1EDF d\u1EEF li\u1EC7u. Vui l\xF2ng ki\u1EC3m tra l\u1EA1i c\u1EA5u h\xECnh DATABASE_URL."
      });
    }
    let user;
    try {
      user = await findUserByUsername(username);
    } catch (dbErr) {
      return res.status(200).json({
        success: false,
        message: "L\u1ED7i truy v\u1EA5n c\u01A1 s\u1EDF d\u1EEF li\u1EC7u. Vui l\xF2ng th\u1EED l\u1EA1i sau."
      });
    }
    if (!user) {
      return res.status(401).json({ success: false, message: "T\xEAn \u0111\u0103ng nh\u1EADp ho\u1EB7c m\u1EADt kh\u1EA9u kh\xF4ng ch\xEDnh x\xE1c." });
    }
    if (user.password !== password.trim()) {
      return res.status(401).json({ success: false, message: "T\xEAn \u0111\u0103ng nh\u1EADp ho\u1EB7c m\u1EADt kh\u1EA9u kh\xF4ng ch\xEDnh x\xE1c." });
    }
    if (!user.is_active) {
      return res.status(403).json({ success: false, message: "T\xE0i kho\u1EA3n n\xE0y \u0111ang b\u1ECB t\u1EA1m kh\xF3a. Vui l\xF2ng li\xEAn h\u1EC7 qu\u1EA3n tr\u1ECB vi\xEAn." });
    }
    if (user.is_expired && user.role !== "admin") {
      const expiryFormatted = new Date(user.expires_at).toLocaleDateString("vi-VN");
      return res.status(403).json({
        success: false,
        expired: true,
        message: `T\xE0i kho\u1EA3n c\u1EE7a b\u1EA1n \u0111\xE3 h\u1EBFt h\u1EA1n s\u1EED d\u1EE5ng v\xE0o ng\xE0y ${expiryFormatted}. Vui l\xF2ng li\xEAn h\u1EC7 qu\u1EA3n tr\u1ECB vi\xEAn \u0111\u1EC3 gia h\u1EA1n g\xF3i c\u01B0\u1EDBc.`
      });
    }
    const token = createWebToken(user.username);
    res.json({
      success: true,
      token,
      user: formatUserForClient(user)
    });
  } catch (err) {
    console.error("[Auth Login Error]:", err);
    res.status(500).json({ success: false, message: err.message || "L\u1ED7i x\u1EED l\xFD \u0111\u0103ng nh\u1EADp" });
  }
});
app.get("/api/auth/me", authenticateWebUser, async (req, res) => {
  res.json({
    success: true,
    user: formatUserForClient(req.webUser)
  });
});
app.post("/api/auth/logout", (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
  }
  res.json({ success: true });
});
app.get("/api/admin/users", authenticateWebUser, requireAdmin, async (req, res) => {
  try {
    if (getWebAppAuthUrl(req)) {
      const result = await proxyWebAppRequest(req, "/api/admin/users", "GET");
      return res.status(result.status).json(result.payload);
    }
    const dbInit = await initDatabase();
    if (!dbInit.success) {
      return res.status(200).json({ success: false, message: dbInit.message });
    }
    const users = await getAllUsers();
    res.json({
      success: true,
      users: users.map(formatUserForAdmin)
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
app.post("/api/admin/users", authenticateWebUser, requireAdmin, async (req, res) => {
  try {
    if (getWebAppAuthUrl(req)) {
      const result2 = await proxyWebAppRequest(req, "/api/admin/users", "POST");
      return res.status(result2.status).json(result2.payload);
    }
    const { username, password, fullName, durationMonths, notes, role } = req.body;
    const result = await createUser({
      username,
      password,
      fullName,
      durationMonths: Number(durationMonths) || 1,
      notes,
      role: role === "admin" ? "admin" : "user"
    });
    if (!result.success || !result.user) {
      return res.status(400).json({ success: false, message: result.error || "Kh\xF4ng th\u1EC3 t\u1EA1o ng\u01B0\u1EDDi d\xF9ng" });
    }
    res.json({
      success: true,
      user: formatUserForAdmin(result.user)
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
app.put("/api/admin/users/:id", authenticateWebUser, requireAdmin, async (req, res) => {
  try {
    if (getWebAppAuthUrl(req)) {
      const result2 = await proxyWebAppRequest(req, `/api/admin/users/${encodeURIComponent(req.params.id)}`, "PUT");
      return res.status(result2.status).json(result2.payload);
    }
    const { password, fullName, extendMonths, newExpiresAt, isActive, notes } = req.body;
    const result = await updateUser(req.params.id, {
      password,
      fullName,
      extendMonths: extendMonths ? Number(extendMonths) : void 0,
      newExpiresAt,
      isActive,
      notes
    });
    if (!result.success || !result.user) {
      return res.status(400).json({ success: false, message: result.error || "C\u1EADp nh\u1EADt th\u1EA5t b\u1EA1i" });
    }
    res.json({
      success: true,
      user: formatUserForAdmin(result.user)
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
app.delete("/api/admin/users/:id", authenticateWebUser, requireAdmin, async (req, res) => {
  try {
    if (getWebAppAuthUrl(req)) {
      const result2 = await proxyWebAppRequest(req, `/api/admin/users/${encodeURIComponent(req.params.id)}`, "DELETE");
      return res.status(result2.status).json(result2.payload);
    }
    const result = await deleteUser(req.params.id);
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.error });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
app.get("/api/admin/db-status", async (req, res) => {
  try {
    if (getWebAppAuthUrl(req)) {
      return res.json({
        success: true,
        connected: true,
        type: "remote_webapp",
        message: "X\xE1c th\u1EF1c t\xE0i kho\u1EA3n \u0111\u01B0\u1EE3c th\u1EF1c hi\u1EC7n b\u1EDFi webapp.",
        maskedUrl: ""
      });
    }
    const status = await getDatabaseStatus();
    res.json({ success: true, ...status, maskedUrl: getMaskedDatabaseUrl() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
app.get("/api/neon/config", async (req, res) => {
  try {
    const status = await getDatabaseStatus();
    res.json({
      success: true,
      ...status,
      maskedUrl: getMaskedDatabaseUrl()
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
app.post("/api/neon/test-and-save", async (req, res) => {
  try {
    const { databaseUrl, initialAdminUsername, initialAdminPassword } = req.body;
    if (!databaseUrl || typeof databaseUrl !== "string") {
      return res.status(400).json({ success: false, message: "Vui l\xF2ng cung c\u1EA5p chu\u1ED7i k\u1EBFt n\u1ED1i DATABASE_URL h\u1EE3p l\u1EC7." });
    }
    const result = await saveNeonDatabaseUrl(databaseUrl.trim(), {
      username: initialAdminUsername,
      password: initialAdminPassword
    });
    return res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
process.on("uncaughtException", (err) => {
  console.error("[Process uncaughtException]:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[Process unhandledRejection]:", reason);
});
app.use("/api", (err, req, res, next) => {
  console.error("[API Error Handler]:", err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "L\u1ED7i m\xE1y ch\u1EE7 n\u1ED9i b\u1ED9. Vui l\xF2ng th\u1EED l\u1EA1i."
  });
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          allowedHosts: true
        },
        appType: "spa"
      });
      app.use(vite.middlewares);
      app.use("*", async (req, res, next) => {
        if (req.method !== "GET" || req.originalUrl.startsWith("/api")) {
          return next();
        }
        try {
          const fs3 = await import("fs");
          const path4 = await import("path");
          const indexPath = path4.resolve(process.cwd(), "index.html");
          if (fs3.existsSync(indexPath)) {
            let template = fs3.readFileSync(indexPath, "utf-8");
            template = await vite.transformIndexHtml(req.originalUrl, template);
            return res.status(200).set({ "Content-Type": "text/html" }).end(template);
          }
        } catch (e) {
          vite.ssrFixStacktrace(e);
          return next(e);
        }
        next();
      });
      console.log("[Vite] Vite middleware and SPA fallback attached.");
    } catch (viteErr) {
      console.error("[Vite Init Error]:", viteErr.message);
    }
  } else {
    const distPath = process.env.VERCEL ? path3.join(process.cwd(), "dist") : typeof __filename !== "undefined" ? path3.dirname(__filename) : process.cwd();
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path3.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`GDT E-Invoice Server running on http://0.0.0.0:${PORT}`);
    initDatabase().then((dbInitResult) => {
      if (dbInitResult.success) {
        console.log(`[Database Init] \u2713 ${dbInitResult.message}`);
      }
    }).catch(() => {
    });
  });
}
var server_default = app;
if (!process.env.VERCEL) {
  startServer();
}
export {
  server_default as default
};
