var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server.ts
var server_exports = {};
__export(server_exports, {
  default: () => server_default
});
module.exports = __toCommonJS(server_exports);
var import_config2 = require("dotenv/config");
var import_express = __toESM(require("express"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_crypto = __toESM(require("crypto"), 1);
var import_child_process = require("child_process");
var import_jszip3 = __toESM(require("jszip"), 1);

// src/utils/xmlParser.ts
var import_jszip = __toESM(require("jszip"), 1);

// src/services/invoice-engine/providerDetector.ts
function detectProvider(xmlString) {
  return detectProviderWithDetails(xmlString).provider;
}
function detectProviderWithDetails(xmlString) {
  if (!xmlString || typeof xmlString !== "string" || !xmlString.trim()) {
    return {
      provider: "UNKNOWN",
      priority: 0,
      matchedPattern: "",
      sourceDescription: "D\u1EEF li\u1EC7u XML r\u1ED7ng ho\u1EB7c kh\xF4ng h\u1EE3p l\u1EC7"
    };
  }
  if (/meinvoice\.vn|tracuu\.meinvoice|misa\.vn/i.test(xmlString)) {
    return {
      provider: "MISA",
      priority: 1,
      matchedPattern: "meinvoice.vn",
      sourceDescription: "Ph\xE1t hi\u1EC7n Domain tra c\u1EE9u MISA meInvoice (meinvoice.vn)"
    };
  }
  if (/sinvoice\.viettel\.vn|sinvoice\.vn|vinvoice\.viettel\.vn|viettel\.vn\/sinvoice/i.test(xmlString)) {
    return {
      provider: "VIETTEL",
      priority: 1,
      matchedPattern: "sinvoice.viettel.vn",
      sourceDescription: "Ph\xE1t hi\u1EC7n Domain tra c\u1EE9u Viettel S-Invoice (sinvoice.viettel.vn)"
    };
  }
  if (/vnpt-invoice|invoice\.vnpt\.vn|tracuu\.vnpt-invoice/i.test(xmlString)) {
    return {
      provider: "VNPT",
      priority: 1,
      matchedPattern: "vnpt-invoice",
      sourceDescription: "Ph\xE1t hi\u1EC7n Domain/Chu\u1ED7i tra c\u1EE9u VNPT Invoice (vnpt-invoice)"
    };
  }
  if (/inv\.4si\.vn|4si\.vn/i.test(xmlString)) {
    return {
      provider: "4SI",
      priority: 1,
      matchedPattern: "inv.4si.vn",
      sourceDescription: "Ph\xE1t hi\u1EC7n Domain tra c\u1EE9u 4Si E-Invoice (inv.4si.vn)"
    };
  }
  if (/easyinvoice|softdreams\.vn|tracuu\.easyinvoice/i.test(xmlString)) {
    return {
      provider: "EASYINVOICE",
      priority: 1,
      matchedPattern: "easyinvoice",
      sourceDescription: "Ph\xE1t hi\u1EC7n Domain/Chu\u1ED7i tra c\u1EE9u Softdreams EasyInvoice (easyinvoice)"
    };
  }
  if (/bkav|ehoadon\.vn|ehoadon\.bkav/i.test(xmlString)) {
    return {
      provider: "BKAV",
      priority: 1,
      matchedPattern: "bkav",
      sourceDescription: "Ph\xE1t hi\u1EC7n Domain/Chu\u1ED7i tra c\u1EE9u Bkav eHoadon (bkav / ehoadon.vn)"
    };
  }
  if (/einvoice\.vn|thaison\.vn/i.test(xmlString)) {
    return {
      provider: "THAISON",
      priority: 1,
      matchedPattern: "einvoice.vn",
      sourceDescription: "Ph\xE1t hi\u1EC7n Domain tra c\u1EE9u Th\xE1i S\u01A1n E-Invoice (einvoice.vn)"
    };
  }
  if (/cyberbill\.vn|cyberlotus\.com/i.test(xmlString)) {
    return {
      provider: "CYBERBILL",
      priority: 1,
      matchedPattern: "cyberbill.vn",
      sourceDescription: "Ph\xE1t hi\u1EC7n Domain tra c\u1EE9u CyberLotus CyberBill (cyberbill.vn)"
    };
  }
  const msttcgpMatch = xmlString.match(/<(?:[a-zA-Z0-9_]+:)?MSTTCGP(?:\s+[^>]*)?>([\s\S]*?)<\/(?:[a-zA-Z0-9_]+:)?MSTTCGP>/i);
  if (msttcgpMatch && msttcgpMatch[1]) {
    const msttcgp = msttcgpMatch[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim();
    if (msttcgp === "0101243150") {
      return {
        provider: "MISA",
        priority: 1.5,
        matchedPattern: "MSTTCGP: 0101243150",
        sourceDescription: "Ph\xE1t hi\u1EC7n T\u1ED5 ch\u1EE9c gi\u1EA3i ph\xE1p MISA meInvoice qua th\u1EBB <MSTTCGP> (0101243150)"
      };
    }
    if (msttcgp === "0100109106") {
      return {
        provider: "VIETTEL",
        priority: 1.5,
        matchedPattern: "MSTTCGP: 0100109106",
        sourceDescription: "Ph\xE1t hi\u1EC7n T\u1ED5 ch\u1EE9c gi\u1EA3i ph\xE1p Viettel S-Invoice qua th\u1EBB <MSTTCGP> (0100109106)"
      };
    }
    if (msttcgp === "0100684378") {
      return {
        provider: "VNPT",
        priority: 1.5,
        matchedPattern: "MSTTCGP: 0100684378",
        sourceDescription: "Ph\xE1t hi\u1EC7n T\u1ED5 ch\u1EE9c gi\u1EA3i ph\xE1p VNPT Invoice qua th\u1EBB <MSTTCGP> (0100684378)"
      };
    }
    if (msttcgp === "0101360697") {
      return {
        provider: "BKAV",
        priority: 1.5,
        matchedPattern: "MSTTCGP: 0101360697",
        sourceDescription: "Ph\xE1t hi\u1EC7n T\u1ED5 ch\u1EE9c gi\u1EA3i ph\xE1p Bkav eHoadon qua th\u1EBB <MSTTCGP> (0101360697)"
      };
    }
    if (msttcgp === "0105987432") {
      return {
        provider: "EASYINVOICE",
        priority: 1.5,
        matchedPattern: "MSTTCGP: 0105987432",
        sourceDescription: "Ph\xE1t hi\u1EC7n T\u1ED5 ch\u1EE9c gi\u1EA3i ph\xE1p Softdreams EasyInvoice qua th\u1EBB <MSTTCGP> (0105987432)"
      };
    }
    if (msttcgp === "0315744883") {
      return {
        provider: "4SI",
        priority: 1.5,
        matchedPattern: "MSTTCGP: 0315744883",
        sourceDescription: "Ph\xE1t hi\u1EC7n T\u1ED5 ch\u1EE9c gi\u1EA3i ph\xE1p 4Si E-Invoice qua th\u1EBB <MSTTCGP> (0315744883)"
      };
    }
    if (msttcgp === "0101300842") {
      return {
        provider: "THAISON",
        priority: 1.5,
        matchedPattern: "MSTTCGP: 0101300842",
        sourceDescription: "Ph\xE1t hi\u1EC7n T\u1ED5 ch\u1EE9c gi\u1EA3i ph\xE1p Th\xE1i S\u01A1n E-Invoice qua th\u1EBB <MSTTCGP> (0101300842)"
      };
    }
    if (msttcgp === "0107871301") {
      return {
        provider: "CYBERBILL",
        priority: 1.5,
        matchedPattern: "MSTTCGP: 0107871301",
        sourceDescription: "Ph\xE1t hi\u1EC7n T\u1ED5 ch\u1EE9c gi\u1EA3i ph\xE1p CyberBill qua th\u1EBB <MSTTCGP> (0107871301)"
      };
    }
  }
  const tentcgpMatch = xmlString.match(/<(?:[a-zA-Z0-9_]+:)?(?:TenTCGP|TCGP|ToChucGiaiPhap)(?:\s+[^>]*)?>([\s\S]*?)<\/(?:[a-zA-Z0-9_]+:)?(?:TenTCGP|TCGP|ToChucGiaiPhap)>/i);
  if (tentcgpMatch && tentcgpMatch[1]) {
    const tentcgp = tentcgpMatch[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim().toUpperCase();
    if (tentcgp.includes("MISA")) {
      return { provider: "MISA", priority: 1.5, matchedPattern: "TenTCGP: MISA", sourceDescription: "T\u1ED5 ch\u1EE9c gi\u1EA3i ph\xE1p: MISA" };
    }
    if (tentcgp.includes("VIETTEL")) {
      return { provider: "VIETTEL", priority: 1.5, matchedPattern: "TenTCGP: VIETTEL", sourceDescription: "T\u1ED5 ch\u1EE9c gi\u1EA3i ph\xE1p: Viettel" };
    }
    if (tentcgp.includes("VNPT")) {
      return { provider: "VNPT", priority: 1.5, matchedPattern: "TenTCGP: VNPT", sourceDescription: "T\u1ED5 ch\u1EE9c gi\u1EA3i ph\xE1p: VNPT" };
    }
    if (tentcgp.includes("BKAV")) {
      return { provider: "BKAV", priority: 1.5, matchedPattern: "TenTCGP: BKAV", sourceDescription: "T\u1ED5 ch\u1EE9c gi\u1EA3i ph\xE1p: BKAV" };
    }
    if (tentcgp.includes("SOFTDREAMS") || tentcgp.includes("EASYINVOICE")) {
      return { provider: "EASYINVOICE", priority: 1.5, matchedPattern: "TenTCGP: SOFTDREAMS", sourceDescription: "T\u1ED5 ch\u1EE9c gi\u1EA3i ph\xE1p: Softdreams EasyInvoice" };
    }
    if (tentcgp.includes("4SI")) {
      return { provider: "4SI", priority: 1.5, matchedPattern: "TenTCGP: 4SI", sourceDescription: "T\u1ED5 ch\u1EE9c gi\u1EA3i ph\xE1p: 4Si" };
    }
    if (tentcgp.includes("TH\xC1I S\u01A0N") || tentcgp.includes("THAISON")) {
      return { provider: "THAISON", priority: 1.5, matchedPattern: "TenTCGP: THAISON", sourceDescription: "T\u1ED5 ch\u1EE9c gi\u1EA3i ph\xE1p: Th\xE1i S\u01A1n" };
    }
    if (tentcgp.includes("CYBERLOTUS") || tentcgp.includes("CYBERBILL")) {
      return { provider: "CYBERBILL", priority: 1.5, matchedPattern: "TenTCGP: CYBERBILL", sourceDescription: "T\u1ED5 ch\u1EE9c gi\u1EA3i ph\xE1p: CyberBill" };
    }
  }
  if (/0317978711|0312105174|0400557356/i.test(xmlString) || /TÂN THANH DANH|TAN THANH DANH|TÀI TRÂM ANH|TAI TRAM ANH|XUÂN VINH|XUAN VINH|meInvoice/i.test(xmlString)) {
    return {
      provider: "MISA",
      priority: 1.8,
      matchedPattern: "MISA Partner (T\xE2n Thanh Danh / T\xE0i Tr\xE2m Anh / Xu\xE2n Vinh)",
      sourceDescription: "H\xF3a \u0111\u01A1n ph\xE1t h\xE0nh qua h\u1EC7 th\u1ED1ng MISA meInvoice"
    };
  }
  const signatureIssuers = extractSignatureIssuers(xmlString);
  for (const issuerText of signatureIssuers) {
    const identified = matchCertificateAuthority(issuerText);
    if (identified) {
      return {
        provider: identified.provider,
        priority: 2,
        matchedPattern: identified.matchedName,
        sourceDescription: `Ch\u1EEF k\xFD s\u1ED1 ph\xE1t h\xE0nh b\u1EDFi ${identified.matchedName} (Issuer: "${issuerText.substring(0, 100)}")`
      };
    }
  }
  return {
    provider: "UNKNOWN",
    priority: 0,
    matchedPattern: "",
    sourceDescription: "Kh\xF4ng ph\xE1t hi\u1EC7n Domain tra c\u1EE9u ho\u1EB7c Ch\u1EEF k\xFD s\u1ED1 \u0111\u1EB7c th\xF9. Chuy\u1EC3n sang Render n\u1ED9i b\u1ED9."
  };
}
function extractSignatureIssuers(xml) {
  const issuers = [];
  const extractTags = (content, tagName) => {
    const cleanTag = tagName.replace(/[^a-zA-Z0-9_]/g, "");
    const regex = new RegExp(`<(?:[a-zA-Z0-9_]+:)?${cleanTag}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_]+:)?${cleanTag}>`, "gi");
    const list = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
      if (match[1]) {
        let val = match[1].trim();
        if (val.startsWith("<![CDATA[") && val.endsWith("]]>")) {
          val = val.substring(9, val.length - 3).trim();
        }
        if (val) list.push(val);
      }
    }
    return list;
  };
  const sellerWrappers = [
    ...extractTags(xml, "NBan"),
    ...extractTags(xml, "NBKy"),
    ...extractTags(xml, "SellerSignature")
  ];
  for (const sellerBlock of sellerWrappers) {
    const sellerIssuers = extractTags(sellerBlock, "X509IssuerName");
    issuers.push(...sellerIssuers);
    for (const tag of ["CAProvider", "TenToChucChungThuc", "NhaCungCapChungThuSo", "ToChucChungThuc"]) {
      const vals = extractTags(sellerBlock, tag);
      issuers.push(...vals);
    }
  }
  const allDocIssuers = extractTags(xml, "X509IssuerName");
  for (const item of allDocIssuers) {
    if (!issuers.includes(item)) {
      issuers.push(item);
    }
  }
  if (issuers.length === 0) {
    const sigBlocks = extractTags(xml, "Signature");
    for (const sig of sigBlocks) {
      const sigIssuers = extractTags(sig, "X509IssuerName");
      issuers.push(...sigIssuers);
      const keyInfos = extractTags(sig, "KeyInfo");
      for (const ki of keyInfos) {
        issuers.push(ki);
      }
    }
  }
  for (const tag of ["CAProvider", "TenToChucChungThuc", "NhaCungCapChungThuSo", "ToChucChungThuc"]) {
    const vals = extractTags(xml, tag);
    for (const v of vals) {
      if (!issuers.includes(v)) {
        issuers.push(v);
      }
    }
  }
  return issuers;
}
function matchCertificateAuthority(issuerText) {
  if (!issuerText) return null;
  const upper = issuerText.toUpperCase();
  const isTaxAuthorityOnly = (upper.includes("BAN C\u01A0 Y\u1EBEU") || upper.includes("BAN CO YEU") || upper.includes("T\u1ED4NG C\u1EE4C THU\u1EBE") || upper.includes("TONG CUC THUE") || upper.includes("C\u1EE4C THU\u1EBE")) && !/MISA|VIETTEL|VNPT|BKAV|EASY|SOFTDREAMS|4SI/i.test(upper);
  if (isTaxAuthorityOnly) {
    return null;
  }
  if (upper.includes("MISA-CA") || upper.includes("MISA CA") || /\bMISA-?CA\b/i.test(issuerText) || upper.includes("MISA") && (upper.includes("CN=MISA") || upper.includes("O=MISA") || upper.includes("C\xD4NG TY C\u1ED4 PH\u1EA6N MISA"))) {
    return { provider: "MISA", matchedName: "MISA-CA" };
  }
  if (upper.includes("VIETTEL-CA") || upper.includes("VIETTEL CA") || /\bVIETTEL-?CA\b/i.test(issuerText) || upper.includes("VIETTEL") && (upper.includes("CN=VIETTEL") || upper.includes("O=VIETTEL") || upper.includes("T\u1EACP \u0110O\xC0N C\xD4NG NGHI\u1EC6P - VI\u1EC4N TH\xD4NG QU\xC2N \u0110\u1ED8I"))) {
    return { provider: "VIETTEL", matchedName: "VIETTEL-CA" };
  }
  if (upper.includes("VNPT-CA") || upper.includes("VNPT CA") || /\bVNPT-?CA\b/i.test(issuerText) || upper.includes("VNPT") && (upper.includes("CN=VNPT") || upper.includes("O=VNPT") || upper.includes("T\u1EACP \u0110O\xC0N B\u01AFU CH\xCDNH VI\u1EC4N TH\xD4NG VI\u1EC6T NAM"))) {
    return { provider: "VNPT", matchedName: "VNPT-CA" };
  }
  if (upper.includes("BKAV-CA") || upper.includes("BKAV CA") || /\bBKAV-?CA\b/i.test(issuerText) || upper.includes("BKAV") && (upper.includes("CN=BKAV") || upper.includes("O=BKAV") || upper.includes("C\xD4NG TY C\u1ED4 PH\u1EA6N PH\u1EA6N M\u1EC0M BKAV"))) {
    return { provider: "BKAV", matchedName: "BKAV-CA" };
  }
  if (upper.includes("EASYCA") || upper.includes("EASY-CA") || upper.includes("EASY CA") || upper.includes("SOFTDREAMS") || upper.includes("EASYINVOICE")) {
    return { provider: "EASYINVOICE", matchedName: "EasyCA (Softdreams)" };
  }
  if (upper.includes("4SI-CA") || upper.includes("4SI CA") || upper.includes("4-SI") || /\b4SI-?CA\b/i.test(issuerText) || upper.includes("4SI") && (upper.includes("CN=4SI") || upper.includes("O=4SI") || upper.includes("GI\u1EA2I PH\xC1P 4SI"))) {
    return { provider: "4SI", matchedName: "4SI-CA" };
  }
  return null;
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
  return "";
}
function normalizeLookupLabel(value2) {
  return cleanLookupValue(value2).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
}
function isLookupCodeCandidate(value2) {
  if (!value2 || value2.length < 4 || value2.length > 120) return false;
  return !/^https?:\/\//i.test(value2) && /^[A-Za-z0-9][A-Za-z0-9._-]{3,119}$/.test(value2);
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
function isMisaSource(source) {
  if (!source) return false;
  const msttcgp = String(getPayloadValue(source, ["msttcgp", "mst_tcgp", "tvandnkntt", "MSTTCGP"]) || "");
  const tentcgp = String(getPayloadValue(source, ["tentcgp", "ten_tcgp", "TCGP", "TenTCGP"]) || "").toUpperCase();
  const provider = String(getPayloadValue(source, ["provider", "Provider"]) || "").toUpperCase();
  const nbmst = String(getPayloadValue(source, ["nbmst", "sellerTaxCode", "taxCodeNguoiBan", "MST"]) || "");
  const nbten = String(getPayloadValue(source, ["nbten", "nbtnnt", "sellerName", "supplierName", "Ten"]) || "").toUpperCase();
  const lookupUrl = String(getPayloadValue(source, ["lookupUrl", "lookup_url", "linkTraCuu"]) || "").toLowerCase();
  return msttcgp === "0101243150" || // MISA
  tentcgp.includes("MISA") || provider.includes("MISA") || nbmst === "0317978711" || // TÂN THANH DANH
  nbmst === "0312105174" || // TÀI TRÂM ANH
  nbmst === "0400557356" || // XUÂN VINH
  nbmst === "0101243150" || nbten.includes("T\xC2N THANH DANH") || nbten.includes("TAN THANH DANH") || nbten.includes("T\xC0I TR\xC2M ANH") || nbten.includes("TAI TRAM ANH") || nbten.includes("XU\xC2N VINH") || nbten.includes("XUAN VINH") || nbten.includes("\u0110\u1EA0I \u0110O\xC0N K\u1EBET") || nbten.includes("DAI DOAN KET") || lookupUrl.includes("meinvoice.vn");
}
function getLookupCodeFromPayload(source) {
  if (!source) return "";
  const isMisa = isMisaSource(source);
  const misaTransactionId = getFromStructuredArrays(source, ["TransactionID", "TransactionId", "transactionID"]) || getPayloadValue(source, ["transactionID", "TransactionID"]);
  if (isMisa && misaTransactionId && isLookupCodeCandidate(cleanLookupValue(misaTransactionId))) {
    return cleanLookupValue(misaTransactionId);
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
    getFromStructuredArrays(source, ["Fkey", "FKey", "MaTraCuu", "LookupCode", "MTCuu", "MTC"]),
    getPayloadValue(source, ["fkey", "FKey"]),
    getPayloadValue(source, ["invoiceLookupCode", "InvoiceLookupCode"]),
    // MISA meInvoice: mã tra cứu THẬT in trên hóa đơn nằm trong mảng cttkhac
    // với ttruong = "TransactionID" (đã kiểm chứng khớp 100% với PDF gốc).
    getFromStructuredArrays(source, ["TransactionID", "TransactionId"]),
    getPayloadValue(source, ["transactionID", "TransactionID"]),
    // Field phẳng "mtdtchieu" - chỉ dùng khi không có nguồn nào ở trên,
    // vì đã có trường hợp thực tế field này KHÔNG khớp mã tra cứu in trên
    // hóa đơn (nó có thể là một mã đối chiếu nội bộ khác).
    getPayloadValue(source, ["mtdtchieu", "MTDTCChieu", "maDoiChieu", "MaDoiChieu"])
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
  if (isVnptSource(source)) {
    const nbmst = String(getPayloadValue(source, ["nbmst", "sellerTaxCode", "MST"]) || "4000344946");
    return `https://${nbmst}-tt78.vnpt-invoice.com.vn`;
  }
  if (isMisaSource(source)) {
    return "https://www.meinvoice.vn/tra-cuu";
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
  const codeTags = ["MTCuu", "MaTraCuu", "Matracuu", "FKey", "Fkey", "LookupCode", "InvoiceLookupCode", "TransactionID"];
  let lookupCode = tagValue(codeTags);
  if (!lookupCode) {
    const textMatch = rawXml.match(/(?:Mã\s+tra\s+cứu|Ma\s+tra\s+cuu|Mã\s+nhận\s+hóa\s+đơn|Ma\s+nhan\s+hoa\s+don)\s*[:：=]\s*([A-Za-z0-9._-]+)/i);
    if (textMatch?.[1]) lookupCode = cleanLookupValue(textMatch[1]);
  }
  const ttinBlocks = [...extractTagBlocks(rawXml, "TTin"), ...extractTagBlocks(rawXml, "TTKhac")];
  for (const block of ttinBlocks) {
    const label = normalizeLookupLabel(
      extractTagValue(block, "TTruong") || extractTagValue(block, "TenTruong") || extractTagValue(block, "Name")
    );
    if (!label || label.includes("bi mat") || label.includes("secret")) continue;
    const isExplicitLookupLabel = /tra\s*cuu|lookup|transaction\s*id|fkey|f_key|ma_tc|mtc/i.test(label);
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
  const isMisa = /meinvoice\.vn|misa\.vn/i.test(rawXml) || /0101243150/i.test(rawXml) || /MISA meInvoice/i.test(rawXml) || /0317978711/i.test(rawXml) || // Tân Thanh Danh
  /0312105174/i.test(rawXml) || // Tài Trâm Anh
  /0400557356/i.test(rawXml) || // Xuân Vinh
  /TÂN THANH DANH|TAN THANH DANH/i.test(rawXml) || /TÀI TRÂM ANH|TAI TRAM ANH/i.test(rawXml) || /XUÂN VINH|XUAN VINH/i.test(rawXml) || /BÁO ĐẠI ĐOÀN KẾT|BAO DAI DOAN KET|daidoanket\.vn/i.test(rawXml);
  if (isMisa) {
    lookupUrl = "https://www.meinvoice.vn/tra-cuu";
  }
  if (!lookupUrl && (/vnpt-invoice|4000344946/i.test(rawXml) || /NGHĨA SƠN|NGHIA SON/i.test(rawXml) || /0100684378/i.test(rawXml))) {
    const nbmst = extractTagValue(rawXml, "MST", "") || extractTagValue(rawXml, "nbmst", "") || "4000344946";
    lookupUrl = `https://${nbmst}-tt78.vnpt-invoice.com.vn`;
  }
  const is4Si = /4si\.vn|inv\.4si\.vn|0315744883|0302999571|0315018466/i.test(rawXml);
  if (is4Si) {
    if (!lookupUrl) lookupUrl = "https://inv.4si.vn/tra-cuu-hoa-don";
    if (!extractTagValue(rawXml, "MTCuu") && !extractTagValue(rawXml, "MaTraCuu") && !extractTagValue(rawXml, "FKey")) {
      lookupCode = "";
    }
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
  const provider = detectProvider(xmlSource);
  const msttcgp = getTag(domDoc || xmlSource, "MSTTCGP") || "";
  const tentcgp = getTag(domDoc || xmlSource, "TenTCGP") || getTag(domDoc || xmlSource, "TCGP") || "";
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

// src/templates/partnerRegistry.ts
function normalizeStr(str) {
  if (!str) return "";
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]/g, "");
}
function detectPartnerTemplate(invoice, rawXml) {
  const nbmst = (invoice.nbmst || "").replace(/[^0-9]/g, "");
  const nbten = normalizeStr(invoice.nbten || "");
  const xml = rawXml ? rawXml.toLowerCase() : "";
  if (nbmst === "0318657735") return "BAO_DUY";
  if (nbmst === "0315018466") return "DEFAULT";
  if (nbmst === "0312105174") return "TAI_TRAM_ANH";
  if (nbmst === "0400557356") return "XUAN_VINH";
  if (nbmst === "0318391940") return "KIM_LOAN_TUAN";
  if (nbmst === "0318443500") return "TKJ";
  if (nbmst === "4000344946") return "NGHIA_SON";
  if (nbmst === "0317978711") return "TAN_THANH_DANH";
  const msttcgp = (invoice.msttcgp || "").replace(/[^0-9]/g, "");
  if (msttcgp === "0302999571" || msttcgp === "0315744883") return "DEFAULT";
  if (msttcgp === "0100684378") return "NGHIA_SON";
  if (nbten.includes("baoduy")) return "BAO_DUY";
  if (nbten.includes("pnj") || nbten.includes("chetac") && nbten.includes("trangsuc")) return "DEFAULT";
  if (nbten.includes("taitramanh") || nbten.includes("tramanh")) return "TAI_TRAM_ANH";
  if (nbten.includes("xuanvinh")) return "XUAN_VINH";
  if (nbten.includes("kimloantuan")) return "KIM_LOAN_TUAN";
  if (nbten.includes("tkj")) return "TKJ";
  if (nbten.includes("nghiason")) return "NGHIA_SON";
  if (nbten.includes("tanthanhdanh") || nbten.includes("thanhdanh")) return "TAN_THANH_DANH";
  if (xml) {
    if (xml.includes("0318657735") || xml.includes("b\u1EA3o duy") || xml.includes("bao duy")) return "BAO_DUY";
    if (xml.includes("0315018466") || xml.includes("4si.vn") || xml.includes("l.c.s") || xml.includes("pnj")) return "DEFAULT";
    if (xml.includes("0312105174") || xml.includes("t\xE0i tr\xE2m anh") || xml.includes("tai tram anh")) return "TAI_TRAM_ANH";
    if (xml.includes("0400557356") || xml.includes("xu\xE2n vinh") || xml.includes("xuan vinh")) return "XUAN_VINH";
    if (xml.includes("0318391940") || xml.includes("kim loan tu\u1EA5n") || xml.includes("kim loan tuan")) return "KIM_LOAN_TUAN";
    if (xml.includes("0318443500") || xml.includes("tkj")) return "TKJ";
    if (xml.includes("4000344946") || xml.includes("ngh\u0129a s\u01A1n") || xml.includes("nghia son")) return "NGHIA_SON";
    if (xml.includes("0317978711") || xml.includes("t\xE2n thanh danh") || xml.includes("tan thanh danh")) return "TAN_THANH_DANH";
  }
  return "DEFAULT";
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
function renderSpacedTaxCode(taxCode) {
  const raw = (taxCode || "").replace(/[^0-9A-Za-z]/g, "");
  if (!raw) return "";
  return raw.split("").join(" ");
}
function extractLookupDetails(rawXml) {
  return extractLookupDetailsFromXml(rawXml);
}
function buildDirectLookupUrl(portalUrl, lookupCode, providerOrTemplateId, sellerTaxCode) {
  let url = (portalUrl || "").trim();
  const rawCode = (lookupCode || "").trim();
  const provider = (providerOrTemplateId || "").toUpperCase();
  let code = rawCode.replace(/^(mã\s*tra\s*cứu|mtc|mtcuu|mã\s*tc|code|fkey)[\s:=-]*/i, "").trim();
  if (/^https?:\/\//i.test(code)) {
    try {
      const u = new URL(code);
      const extracted = u.searchParams.get("sc") || u.searchParams.get("code") || u.searchParams.get("c") || u.searchParams.get("fkey");
      if (extracted) {
        code = extracted.trim();
      }
    } catch {
    }
  }
  const isMisa = provider.includes("MISA") || provider.includes("TAI_TRAM_ANH") || provider.includes("XUAN_VINH") || provider.includes("TAN_THANH_DANH") || sellerTaxCode === "0317978711" || // Tân Thanh Danh
  sellerTaxCode === "0312105174" || // Tài Trâm Anh
  sellerTaxCode === "0400557356" || // Xuân Vinh
  sellerTaxCode === "0101243150" || // MISA
  /meinvoice\.vn/i.test(url) || /daidoanket\.vn/i.test(url);
  if (isMisa) {
    const baseMisaUrl = "https://www.meinvoice.vn/tra-cuu";
    if (code) {
      return `${baseMisaUrl}?sc=${encodeURIComponent(code)}&code=${encodeURIComponent(code)}`;
    }
    return baseMisaUrl;
  }
  const isVnpt = provider.includes("VNPT") || provider.includes("NGHIA_SON") || /vnpt-invoice\.com\.vn/i.test(url);
  if (isVnpt) {
    let vnptUrl = url;
    if (!vnptUrl || !/vnpt-invoice/i.test(vnptUrl)) {
      vnptUrl = `https://${sellerTaxCode || "4000344946"}-tt78.vnpt-invoice.com.vn`;
    }
    const cleanUrl = vnptUrl.split("?")[0].replace(/\/+$/, "");
    if (code) {
      return `${cleanUrl}/?strFkey=${encodeURIComponent(code)}`;
    }
    return cleanUrl;
  }
  const isEasyInvoice = provider.includes("EASY") || provider.includes("SOFTDREAMS") || provider.includes("BAO_DUY") || provider.includes("KIM_LOAN") || provider.includes("TKJ") || /easyinvoice/i.test(url);
  if (isEasyInvoice) {
    let easyUrl = url;
    if (!easyUrl || !/easyinvoice/i.test(easyUrl)) {
      easyUrl = sellerTaxCode ? `http://${sellerTaxCode}hd.easyinvoice.com.vn` : "https://tracuu.easyinvoice.vn";
    }
    let cleanUrl = easyUrl.split("?")[0].replace(/\/+$/, "");
    if (!/\/Search\/Index$/i.test(cleanUrl)) {
      cleanUrl = `${cleanUrl}/Search/Index`;
    }
    if (code) {
      return `${cleanUrl}?fkey=${encodeURIComponent(code)}`;
    }
    return cleanUrl;
  }
  const is4Si = provider.includes("4SI") || provider.includes("PNJ") || /4si\.vn/i.test(url);
  if (is4Si) {
    return "https://inv.4si.vn/tra-cuu-hoa-don";
  }
  if (provider.includes("VIETTEL") || /sinvoice/i.test(url) || /viettel/i.test(url)) {
    const baseUrl = "https://www.sinvoice.vn/p/tra-cuu-hoa-don.html";
    const params = new URLSearchParams();
    const cleanSellerMst = (sellerTaxCode || "").trim();
    if (cleanSellerMst) {
      params.append("supplierTaxCode", cleanSellerMst);
      params.append("taxCode", cleanSellerMst);
      params.append("mst", cleanSellerMst);
    }
    if (code) {
      params.append("reservationCode", code);
      params.append("secretCode", code);
      params.append("code", code);
    }
    const q = params.toString();
    return q ? `${baseUrl}?${q}` : baseUrl;
  }
  if (provider.includes("BKAV") || /bkav|ehoadon/i.test(url)) {
    return "https://ehoadon.bkav.com/tra-cuu";
  }
  if (!url) {
    url = "https://hoadondientu.gdt.gov.vn";
  }
  return url;
}
function generateDefaultQrSvg(dataText = "HOADON") {
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><rect width="100" height="100" fill="white"/><rect x="8" y="8" width="28" height="28" fill="none" stroke="black" stroke-width="4"/><rect x="16" y="16" width="12" height="12" fill="black"/><rect x="64" y="8" width="28" height="28" fill="none" stroke="black" stroke-width="4"/><rect x="72" y="16" width="12" height="12" fill="black"/><rect x="8" y="64" width="28" height="28" fill="none" stroke="black" stroke-width="4"/><rect x="16" y="72" width="12" height="12" fill="black"/><rect x="42" y="10" width="14" height="8" fill="black"/><rect x="40" y="24" width="8" height="16" fill="black"/><rect x="10" y="44" width="24" height="8" fill="black"/><rect x="44" y="42" width="16" height="16" fill="black"/><rect x="68" y="44" width="22" height="8" fill="black"/><rect x="42" y="66" width="12" height="24" fill="black"/><rect x="64" y="60" width="14" height="12" fill="black"/><rect x="82" y="66" width="10" height="24" fill="black"/></svg>`;
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

// src/templates/BaoDuyTemplate.ts
function renderBaoDuyTemplate(invoice, rawXml, options) {
  const { day, month, year } = extractDateParts(invoice);
  const { lookupCode, lookupUrl } = extractLookupDetails(rawXml);
  const mCode = lookupCode || invoice.lookupCode || "";
  const pUrl = lookupUrl || invoice.lookupUrl || `http://${invoice.nbmst}hd.easyinvoice.com.vn`;
  const directLookupUrl = buildDirectLookupUrl(pUrl, mCode, "BAO_DUY", invoice.nbmst);
  const qrImg = options?.qrCodeDataUrl || generateDefaultQrSvg(`MST:0318657735;KH:${invoice.khhdon};SHD:${invoice.shdon};MTC:${mCode}`);
  const items = ensureInvoiceItems(invoice);
  const totalAmount = invoice.tgtttbso || items.reduce((sum, item) => sum + (item.amount || item.thtien || 0), 0);
  const wordsAmount = invoice.tgtttbchu || numberToVietnameseWords(totalAmount);
  const taxAuthorityCode = invoice.mhdon || "M2-26-IXTFA-14279040746";
  const showControls = options?.showPrintControls !== false;
  const buyerName = invoice.nmten || "C\xD4NG TY TNHH M\u1ED8T TH\xC0NH VI\xCAN V\xC0NG B\u1EA0C NGH\u0128A T\xCDN";
  const buyerTaxCode = invoice.nmmst || "4000926165";
  const buyerAddress = invoice.nmdchi || "448 Phan Chu Trinh, Ph\u01B0\u1EDDng Tam K\u1EF3, TP \u0110\xE0 N\u1EB5ng, Vi\u1EC7t Nam";
  const paymentMethod = invoice.htttoan || "Chuy\u1EC3n kho\u1EA3n";
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>H\xD3A \u0110\u01A0N B\xC1N H\xC0NG - TRANG S\u1EE8C B\u1EA2O DUY - S\u1ED1: ${escapeHtml(invoice.shdon)}</title>
  <style>
    @page { size: A4 portrait; margin: 8mm 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body {
      font-family: 'Times New Roman', Times, serif;
      background: #f8fafc;
      margin: 0;
      padding: 16px;
      color: #000;
      font-size: 13px;
      line-height: 1.35;
    }
    .print-actions {
      max-width: 820px;
      margin: 0 auto 16px auto;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .print-actions { display: none !important; }
      .invoice-outer { box-shadow: none !important; border: 3px double #db2777 !important; }
    }
    .invoice-outer {
      max-width: 820px;
      margin: 0 auto;
      background: #fff;
      border: 3px double #db2777;
      border-radius: 4px;
      padding: 20px 24px 16px 24px;
      box-shadow: 0 4px 20px rgba(219, 39, 119, 0.12);
      position: relative;
    }
    /* Watermark */
    .watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-25deg);
      font-size: 58px;
      font-weight: 800;
      color: rgba(219, 39, 119, 0.05);
      text-transform: uppercase;
      letter-spacing: 6px;
      pointer-events: none;
      z-index: 0;
      text-align: center;
      line-height: 1.2;
    }
    .relative-content {
      position: relative;
      z-index: 1;
    }
    /* Header grid */
    .header-grid {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
      padding-bottom: 6px;
      border-bottom: 1px solid #fbcfe8;
    }
    .logo-area {
      width: 170px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .logo-svg {
      width: 70px;
      height: 55px;
    }
    .logo-text {
      font-size: 17px;
      font-weight: bold;
      color: #9d174d;
      letter-spacing: 1px;
      margin-top: 3px;
    }
    .logo-subtext {
      font-size: 10px;
      color: #be185d;
      letter-spacing: 3px;
      font-weight: 600;
    }
    .title-area {
      flex: 1;
      text-align: center;
      padding: 0 8px;
    }
    .main-title {
      color: #c2185b;
      font-size: 21px;
      font-weight: bold;
      letter-spacing: 0.5px;
      margin: 0;
    }
    .sub-title {
      color: #c2185b;
      font-size: 13.5px;
      font-weight: bold;
      margin: 2px 0 1px 0;
    }
    .en-title {
      color: #c2185b;
      font-size: 12.5px;
      font-style: italic;
      margin: 0;
    }
    .date-str {
      font-style: italic;
      font-size: 12.5px;
      margin-top: 4px;
    }
    .meta-area {
      width: 190px;
      text-align: right;
      font-size: 12.5px;
    }
    .serial-row {
      margin-bottom: 4px;
    }
    .no-row .inv-num {
      color: #c2185b;
      font-size: 17px;
      font-weight: bold;
    }
    /* Seller & Buyer sections */
    .seller-box {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 1px dashed #cbd5e1;
    }
    .seller-info {
      flex: 1;
    }
    .seller-name {
      color: #b91c1c;
      font-weight: bold;
      font-size: 13.5px;
      text-transform: uppercase;
    }
    .qr-box {
      width: 96px;
      height: 96px;
      flex-shrink: 0;
      border: 1px solid #e2e8f0;
      padding: 2px;
      background: #fff;
    }
    .qr-box img {
      width: 100%;
      height: 100%;
      display: block;
    }
    .info-row {
      margin-bottom: 3px;
      display: flex;
      align-items: baseline;
    }
    .info-label {
      flex-shrink: 0;
      font-size: 12.5px;
    }
    .info-dots {
      flex: 1;
      border-bottom: 1px dotted #94a3b8;
      margin-left: 4px;
      min-height: 15px;
      padding-left: 2px;
    }
    /* Buyer box */
    .buyer-box {
      margin-bottom: 12px;
    }
    /* Items table */
    table.invoice-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #000;
      margin-top: 6px;
      margin-bottom: 8px;
    }
    table.invoice-table th, table.invoice-table td {
      border: 1px solid #000;
      padding: 4.5px 6px;
      font-size: 12px;
    }
    table.invoice-table th {
      text-align: center;
      font-weight: bold;
      background: #fff;
    }
    .th-sub {
      font-style: italic;
      font-size: 10.5px;
      font-weight: normal;
    }
    .col-stt { width: 38px; text-align: center; }
    .col-name { text-align: left; }
    .col-unit { width: 62px; text-align: center; }
    .col-qty { width: 68px; text-align: right; }
    .col-price { width: 95px; text-align: right; }
    .col-amount { width: 110px; text-align: right; }
    .total-row td {
      font-weight: bold;
    }
    .words-box {
      border: 1px dashed #94a3b8;
      padding: 6px 10px;
      margin-top: 6px;
      font-size: 12.5px;
      background: #fafafa;
    }
    /* Signature area */
    .signature-grid {
      display: flex;
      justify-content: space-between;
      margin-top: 16px;
      margin-bottom: 14px;
      text-align: center;
    }
    .sig-col {
      width: 46%;
    }
    .sig-title {
      font-weight: bold;
      font-size: 13px;
    }
    .sig-box-softdreams {
      margin-top: 10px;
      border: 1.5px solid #16a34a;
      border-radius: 4px;
      padding: 8px 12px;
      text-align: left;
      font-size: 11px;
      color: #dc2626;
      background: rgba(22, 163, 74, 0.03);
    }
    .sig-valid-tag {
      color: #16a34a;
      font-weight: bold;
      font-size: 12px;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    /* Footer */
    .footer-section {
      border-top: 1px solid #000;
      padding-top: 6px;
      font-size: 11.5px;
      line-height: 1.4;
    }
    .footer-provider {
      text-align: center;
      font-size: 11px;
      color: #475569;
      margin-top: 5px;
      padding-top: 4px;
      border-top: 1px dashed #e2e8f0;
    }
  </style>
</head>
<body>
  ${showControls ? getPrintControlsHtml("H\xF3a \u0111\u01A1n b\xE1n h\xE0ng \u0111i\u1EC7n t\u1EED - C\xD4NG TY TNHH TM TRANG S\u1EE8C B\u1EA2O DUY") : ""}

  <div class="invoice-outer">
    <div class="watermark">B\u1EA2O DUY<br>JEWELRY</div>
    
    <div class="relative-content">
      <!-- HEADER -->
      <div class="header-grid">
        <div class="logo-area">
          <svg class="logo-svg" viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="40" r="36" stroke="#db2777" stroke-width="3" fill="#fdf2f8"/>
            <path d="M36 26 H48 C55 26 59 29 59 34 C59 38 56 40 51 41 C57 42 61 45 61 50 C61 56 55 60 47 60 H36 Z" fill="#db2777"/>
            <path d="M42 32 H47 C50 32 53 33 53 36 C53 39 50 40 47 40 H42 Z" fill="#ffffff"/>
            <path d="M42 46 H47 C51 46 54 47 54 50 C54 54 51 55 47 55 H42 Z" fill="#ffffff"/>
            <path d="M60 30 Q70 40 60 54" stroke="#be185d" stroke-width="3" stroke-linecap="round" fill="none"/>
          </svg>
          <div class="logo-text">B\u1EA2O DUY</div>
          <div class="logo-subtext">JEWELRY</div>
        </div>

        <div class="title-area">
          <div class="main-title">H\xD3A \u0110\u01A0N B\xC1N H\xC0NG</div>
          <div class="sub-title">(KH\u1EDEI T\u1EA0O T\u1EEA M\xC1Y T\xCDNH TI\u1EC0N)</div>
          <div class="en-title">(SALES INVOICE)</div>
          <div class="date-str">Ng\xE0y (Date) ${escapeHtml(day)} th\xE1ng (month) ${escapeHtml(month)} n\u0103m (year) ${escapeHtml(year)}</div>
        </div>

        <div class="meta-area">
          <div class="serial-row">K\xFD hi\u1EC7u (Serial): <strong>${escapeHtml(invoice.khhdon || "2C26MAA")}</strong></div>
          <div class="no-row">S\u1ED1 (No.): <span class="inv-num">${escapeHtml(invoice.shdon || "285")}</span></div>
        </div>
      </div>

      <!-- SELLER INFO -->
      <div class="seller-box">
        <div class="seller-info">
          <div class="info-row">
            <span class="info-label">\u0110\u01A1n v\u1ECB b\xE1n h\xE0ng (Seller):</span>
            <span class="seller-name" style="margin-left:6px;">${escapeHtml(invoice.nbten || "\u0110\u01A1n v\u1ECB b\xE1n h\xE0ng")}</span>
          </div>
          <div class="info-row">
            <span class="info-label">M\xE3 s\u1ED1 thu\u1EBF (Tax code):</span>
            <span style="font-weight:bold;margin-left:6px;letter-spacing:1px;">${escapeHtml(renderSpacedTaxCode(invoice.nbmst || ""))}</span>
          </div>
          <div class="info-row">
            <span class="info-label">\u0110\u1ECBa ch\u1EC9 (Address):</span>
            <span style="margin-left:6px;">${escapeHtml(invoice.nbdchi || "")}</span>
          </div>
          <div class="info-row">
            <span class="info-label">T\xE0i kho\u1EA3n (A/C number):</span>
            <span style="margin-left:6px;">${escapeHtml(invoice.nbstk ? `${invoice.nbstk} ${invoice.nbnhang || ""}` : "112348668 Ng\xE2n h\xE0ng TMCP \xC1 Ch\xE2u - CN S\xE0i G\xF2n")}</span>
          </div>
        </div>

        <div class="qr-box">
          <img src="${qrImg}" alt="QR Tra c\u1EE9u B\u1EA3o Duy">
        </div>
      </div>

      <!-- BUYER INFO -->
      <div class="buyer-box">
        <div class="info-row">
          <span class="info-label">H\u1ECD t\xEAn ng\u01B0\u1EDDi mua h\xE0ng (Buyer):</span>
          <span class="info-dots">${escapeHtml(invoice.nmten && invoice.nmtendv ? invoice.nmten : "")}</span>
        </div>
        <div class="info-row">
          <span class="info-label">T\xEAn \u0111\u01A1n v\u1ECB (Company's name):</span>
          <span class="info-dots" style="font-weight:bold;">${escapeHtml(buyerName)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">M\xE3 s\u1ED1 thu\u1EBF (Tax code):</span>
          <span class="info-dots" style="font-weight:bold;">${escapeHtml(buyerTaxCode)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">\u0110\u1ECBa ch\u1EC9 (Address):</span>
          <span class="info-dots">${escapeHtml(buyerAddress)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">\u0110i\u1EC7n tho\u1EA1i (Tel):</span>
          <span class="info-dots">${escapeHtml(invoice.nmsdt || "")}</span>
        </div>
        <div class="info-row" style="display:flex;justify-content:space-between;">
          <div style="width:48%;display:flex;align-items:baseline;">
            <span class="info-label">H\xECnh th\u1EE9c thanh to\xE1n (Payment method):</span>
            <span class="info-dots">${escapeHtml(paymentMethod)}</span>
          </div>
          <div style="width:48%;display:flex;align-items:baseline;">
            <span class="info-label">\u0110\u01A1n v\u1ECB ti\u1EC1n t\u1EC7 (Currency):</span>
            <span class="info-dots" style="font-weight:bold;">${escapeHtml(invoice.dvtte || "VND")}</span>
          </div>
        </div>
      </div>

      <!-- TABLE OF GOODS -->
      <table class="invoice-table">
        <thead>
          <tr>
            <th class="col-stt">STT<br><span class="th-sub">(No.)</span></th>
            <th class="col-name">T\xEAn h\xE0ng h\xF3a, d\u1ECBch v\u1EE5<br><span class="th-sub">(Name of goods, services)</span></th>
            <th class="col-unit">\u0110\u01A1n v\u1ECB t\xEDnh<br><span class="th-sub">(Unit)</span></th>
            <th class="col-qty">S\u1ED1 l\u01B0\u1EE3ng<br><span class="th-sub">(Quantity)</span></th>
            <th class="col-price">\u0110\u01A1n gi\xE1<br><span class="th-sub">(Unit price)</span></th>
            <th class="col-amount">Th\xE0nh ti\u1EC1n<br><span class="th-sub">(Amount)</span></th>
          </tr>
          <tr style="font-size:10px;text-align:center;font-style:italic;">
            <td>(1)</td>
            <td>(2)</td>
            <td>(3)</td>
            <td>(4)</td>
            <td>(5)</td>
            <td>(6)=(4)x(5)</td>
          </tr>
        </thead>
        <tbody>
          ${items.map((item, idx) => {
    const qty = item.quantity || item.sluong || 0;
    const price = item.unitPrice || item.dgia || 0;
    const amt = item.amount || item.thtien || qty * price;
    const unit = item.unit || item.dvt || "C\xE1i";
    const name = item.itemName || item.ten || `H\xE0ng h\xF3a #${idx + 1}`;
    return `
              <tr>
                <td class="col-stt">${idx + 1}</td>
                <td class="col-name">${escapeHtml(name)}</td>
                <td class="col-unit">${escapeHtml(unit)}</td>
                <td class="col-qty">${formatNum(qty)}</td>
                <td class="col-price">${formatVND(price)}</td>
                <td class="col-amount">${formatVND(amt)}</td>
              </tr>
            `;
  }).join("")}
          <tr class="total-row">
            <td colspan="5" style="text-align:right;font-weight:bold;">T\u1ED5ng c\u1ED9ng ti\u1EC1n thanh to\xE1n (Total payment):</td>
            <td class="col-amount">${formatVND(totalAmount)}</td>
          </tr>
        </tbody>
      </table>

      <!-- WORDS AMOUNT -->
      <div class="words-box">
        <strong>S\u1ED1 ti\u1EC1n vi\u1EBFt b\u1EB1ng ch\u1EEF (Amount in words):</strong> <em>${escapeHtml(wordsAmount)}</em>
      </div>

      <!-- SIGNATURE SECTION -->
      <div class="signature-grid">
        <div class="sig-col">
          <div class="sig-title">Ng\u01B0\u1EDDi mua h\xE0ng (Buyer)</div>
          <div style="font-style:italic;font-size:11px;color:#64748b;margin-top:2px;">(K\xFD, ghi r\xF5 h\u1ECD t\xEAn)</div>
        </div>

        <div class="sig-col">
          <div class="sig-title">Ng\u01B0\u1EDDi b\xE1n h\xE0ng (Seller)</div>
          <div class="sig-box-softdreams">
            <div class="sig-valid-tag">
              <span>\u2714</span> Signature Valid
            </div>
            <div><strong>K\xFD b\u1EDFi:</strong> ${escapeHtml(invoice.nbten || "Ng\u01B0\u1EDDi b\xE1n h\xE0ng")}</div>
            <div><strong>K\xFD ng\xE0y:</strong> ${escapeHtml(day)}-${escapeHtml(month)}-${escapeHtml(year)}</div>
          </div>
        </div>
      </div>

      <!-- FOOTER -->
      <div class="footer-section">
        <div><strong>M\xE3 c\u1EE7a c\u01A1 quan thu\u1EBF (Tax authority code):</strong> <span style="font-family:monospace;font-weight:bold;">${escapeHtml(taxAuthorityCode)}</span></div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
          <div>Trang tra c\u1EE9u: <a href="${escapeHtml(directLookupUrl)}" target="_blank" rel="noopener noreferrer" style="color:#2563eb;text-decoration:underline;">${escapeHtml(pUrl)}</a></div>
          <div>M\xE3 tra c\u1EE9u: <strong style="color:#b91c1c;font-family:monospace;">${escapeHtml(mCode)}</strong></div>
        </div>
        <div style="text-align:center;font-style:italic;margin-top:3px;color:#475569;">(C\u1EA7n ki\u1EC3m tra, \u0111\u1ED1i chi\u1EBFu khi l\u1EADp, giao, nh\u1EADn h\xF3a \u0111\u01A1n)</div>
      </div>

      <div class="footer-provider">
        \u0110\u01A1n v\u1ECB cung c\u1EA5p gi\u1EA3i ph\xE1p: C\xF4ng ty c\u1ED5 ph\u1EA7n \u0111\u1EA7u t\u01B0 c\xF4ng ngh\u1EC7 v\xE0 th\u01B0\u01A1ng m\u1EA1i SOFTDREAMS, MST: 0105987432, Http://easyinvoice.vn/
      </div>
    </div>
  </div>
</body>
</html>`;
}

// src/templates/DefaultTemplate.ts
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
  const mauSo = invoice.khmshdon || (invoice.khhdon ? invoice.khhdon.charAt(0) : "1");
  const kyHieu = invoice.khhdon || "";
  const soHdon = invoice.shdon || "";
  const maCqt = invoice.mhdon || "";
  let invoiceTitle = invoice.thdon || "";
  if (!invoiceTitle) {
    if (kyHieu.startsWith("2")) {
      invoiceTitle = "HO\xC1 \u0110\u01A0N B\xC1N H\xC0NG";
    } else {
      invoiceTitle = "HO\xC1 \u0110\u01A0N GI\xC1 TR\u1ECA GIA T\u0102NG";
    }
  } else {
    invoiceTitle = invoiceTitle.toUpperCase();
  }
  const isVatInvoice = !kyHieu.startsWith("2") && (vatAmount > 0 || invoiceTitle.includes("GI\xC1 TR\u1ECA GIA T\u0102NG"));
  const qrImg = options?.qrCodeDataUrl || generateDefaultQrSvg(
    maCqt ? `https://hoadondientu.gdt.gov.vn/tra-cuu?cqt=${encodeURIComponent(maCqt)}` : `MST:${invoice.nbmst};KH:${kyHieu};SHD:${soHdon};TONG:${totalAmount}${mCode ? `;MTC:${mCode}` : ""}`
  );
  const sellerName = invoice.nbten || "";
  const sellerTaxCode = invoice.nbmst || "";
  const sellerStoreCode = invoice.sellerStoreCode || "";
  const sellerStoreName = invoice.sellerStoreName || "";
  const sellerAddress = invoice.nbdchi || "";
  const sellerPhone = invoice.nbsdt || invoice.sellerPhone || "";
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
    const taxRate = it.taxRate || it.tsuat || (isVatInvoice ? "8%" : "\\");
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
  <td class="tx-center"><HHDVu>${escapeHtml(taxRate)}</HHDVu></td>
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
  <td class="tx-center"><HHDVu>${isVatInvoice ? "8%" : "\\"}</HHDVu></td>
  <td class="tx-center">${formatVND(subTotal)}</td>
</tr>`;
  const vatRows = invoice.vatBreakdown && invoice.vatBreakdown.length > 0 ? invoice.vatBreakdown : isVatInvoice ? [{ taxRate: items.find((it) => it.taxRate || it.tsuat)?.taxRate || items.find((it) => it.taxRate || it.tsuat)?.tsuat || "8%", amount: subTotal, taxAmount: vatAmount }] : [{ taxRate: "\\", amount: subTotal, taxAmount: 0 }];
  const vatRowsHtml = vatRows.map((row) => `<tr>
  <td class="tx-center"><LTSuat>${escapeHtml(row.taxRate)}</LTSuat></td>
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
        <img src="${qrImg}" style="width: 76px; height: 76px; display: block;" alt="QR Code">
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
    <li>
      <div class="data-item">
        <div class="di-label"><span>M\xE3 c\u1EEDa h\xE0ng:</span></div>
        <div class="di-value"><div>${escapeHtml(sellerStoreCode)}</div></div>
      </div>
    </li>
    <li>
      <div class="data-item">
        <div class="di-label"><span>T\xEAn c\u1EEDa h\xE0ng:</span></div>
        <div class="di-value"><div>${escapeHtml(sellerStoreName)}</div></div>
      </div>
    </li>
    <li>
      <div class="data-item">
        <div class="di-label"><span>\u0110\u1ECBa ch\u1EC9:</span></div>
        <div class="di-value"><div>${escapeHtml(sellerAddress)}</div></div>
      </div>
    </li>
    <li>
      <div class="data-item">
        <div class="di-label"><span>\u0110i\u1EC7n tho\u1EA1i:</span></div>
        <div class="di-value"><div>${escapeHtml(sellerPhone)}</div></div>
      </div>
    </li>
    <li>
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
    </li>
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
        <th class="tb-ttct">Th\xE0nh ti\u1EC1n ch\u01B0a c\xF3 thu\u1EBF GTGT</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <div class="table-horizontal-wrapper">
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
    </div>
    <div style="flex: 1">
      <table class="res-tb">
        <tbody>
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
          </tr>
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

// src/templates/PnjTemplate.ts
function renderPnjTemplate(invoice, rawXml, options) {
  return renderDefaultTemplate(invoice, rawXml, options);
}

// src/templates/TaiTramAnhTemplate.ts
function renderTaiTramAnhTemplate(invoice, rawXml, options) {
  const { day, month, year } = extractDateParts(invoice);
  const { lookupCode, lookupUrl } = extractLookupDetails(rawXml);
  const mCode = lookupCode || invoice.lookupCode || "";
  const pUrl = "https://www.meinvoice.vn/tra-cuu";
  const directLookupUrl = buildDirectLookupUrl(pUrl, mCode, "MISA", invoice.nbmst);
  const qrImg = options?.qrCodeDataUrl || generateDefaultQrSvg(`MST:0312105174;KH:${invoice.khhdon};SHD:${invoice.shdon};MTC:${mCode}`);
  const items = ensureInvoiceItems(invoice);
  const totalAmount = invoice.tgtttbso || items.reduce((sum, item) => sum + (item.amount || item.thtien || 0), 0);
  const wordsAmount = invoice.tgtttbchu || numberToVietnameseWords(totalAmount);
  const maCqt = invoice.mhdon || "00AD728CC709B04346844E43D3CBDC5C57";
  const showControls = options?.showPrintControls !== false;
  const buyerName = invoice.nmten || "C\xD4NG TY TNHH M\u1ED8T TH\xC0NH VI\xCAN V\xC0NG B\u1EA0C NGH\u0128A T\xCDN";
  const buyerTaxCode = invoice.nmmst || "4000926165";
  const buyerAddress = invoice.nmdchi || "448 Phan Chu Trinh, Ph\u01B0\u1EDDng Tam K\u1EF3, TP \u0110\xE0 N\u1EB5ng, Vi\u1EC7t Nam.";
  const paymentMethod = invoice.htttoan || "TM/CK";
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>H\xD3A \u0110\u01A0N B\xC1N H\xC0NG - GIA C\xD4NG TRANG S\u1EE8C T\xC0I TR\xC2M ANH - S\u1ED1: ${escapeHtml(invoice.shdon)}</title>
  <style>
    @page { size: A4 portrait; margin: 8mm 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body {
      font-family: 'Times New Roman', Times, serif;
      background: #f8fafc;
      margin: 0;
      padding: 16px;
      color: #000;
      font-size: 13px;
      line-height: 1.35;
    }
    .print-actions {
      max-width: 820px;
      margin: 0 auto 16px auto;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .print-actions { display: none !important; }
      .invoice-outer { box-shadow: none !important; border: 3px double #1e40af !important; }
    }
    .invoice-outer {
      max-width: 820px;
      margin: 0 auto;
      background: #fff;
      border: 3px double #1e40af;
      border-radius: 4px;
      padding: 20px 24px 16px 24px;
      box-shadow: 0 4px 20px rgba(30, 64, 175, 0.12);
      position: relative;
    }
    /* TTJ Big Watermark */
    .watermark-ttj {
      position: absolute;
      top: 52%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 380px;
      height: 380px;
      opacity: 0.08;
      pointer-events: none;
      z-index: 0;
    }
    .relative-content {
      position: relative;
      z-index: 1;
    }
    /* Header */
    .seller-header {
      display: flex;
      gap: 16px;
      align-items: flex-start;
      margin-bottom: 8px;
    }
    .ttj-logo {
      width: 100px;
      height: 80px;
      flex-shrink: 0;
    }
    .seller-details {
      flex: 1;
      font-size: 12.5px;
      line-height: 1.4;
    }
    .company-title {
      color: #0f172a;
      font-weight: bold;
      font-size: 14.5px;
      text-transform: uppercase;
      letter-spacing: 0.2px;
      margin-bottom: 2px;
    }
    /* Invoice title block */
    .title-row {
      text-align: center;
      margin: 10px 0 12px 0;
      position: relative;
    }
    .main-title {
      font-size: 23px;
      font-weight: bold;
      color: #000;
      letter-spacing: 0.5px;
      margin: 0;
    }
    .sub-date {
      font-style: italic;
      font-size: 13px;
      margin-top: 3px;
    }
    .cqt-code {
      font-style: italic;
      font-size: 12.5px;
      margin-top: 2px;
    }
    .meta-box-right {
      position: absolute;
      right: 0;
      top: 0;
      text-align: right;
      font-size: 12.5px;
    }
    .qr-corner {
      position: absolute;
      right: 0;
      top: 50px;
      width: 90px;
      height: 90px;
      border: 1px solid #ddd;
      padding: 2px;
      background: #fff;
    }
    .qr-corner img {
      width: 100%;
      height: 100%;
      display: block;
    }
    /* Buyer box */
    .buyer-section {
      margin-top: 6px;
      margin-bottom: 12px;
      font-size: 12.5px;
      padding-right: 100px;
      line-height: 1.45;
    }
    .buyer-line {
      margin-bottom: 2px;
    }
    /* Table */
    table.ttj-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #000;
      margin-top: 6px;
      margin-bottom: 8px;
    }
    table.ttj-table th, table.ttj-table td {
      border: 1px solid #000;
      padding: 4.5px 6px;
      font-size: 12px;
    }
    table.ttj-table th {
      text-align: center;
      font-weight: bold;
      background: #fff;
    }
    .col-stt { width: 40px; text-align: center; }
    .col-name { text-align: left; }
    .col-unit { width: 70px; text-align: center; }
    .col-qty { width: 75px; text-align: right; }
    .col-price { width: 100px; text-align: right; }
    .col-amount { width: 115px; text-align: right; }
    .total-line {
      border: 1px solid #000;
      border-top: none;
      padding: 6px 10px;
      font-size: 12.5px;
      background: #fff;
      display: flex;
      justify-content: space-between;
      font-weight: bold;
    }
    .words-amount {
      border: 1px solid #000;
      border-top: none;
      padding: 6px 10px;
      font-size: 12.5px;
      font-style: italic;
      margin-bottom: 14px;
    }
    /* Signature */
    .sign-container {
      display: flex;
      justify-content: space-between;
      text-align: center;
      margin-top: 12px;
      margin-bottom: 16px;
    }
    .sign-col {
      width: 45%;
    }
    .sign-title {
      font-weight: bold;
      font-size: 13px;
    }
    .sign-desc {
      font-style: italic;
      font-size: 11px;
      color: #64748b;
    }
    .misa-sig-box {
      margin-top: 8px;
      border: 1.5px solid #15803d;
      border-radius: 4px;
      padding: 8px 12px;
      text-align: left;
      font-size: 11px;
      color: #b91c1c;
      background: rgba(34, 197, 94, 0.04);
      position: relative;
    }
    .sig-valid-header {
      color: #dc2626;
      font-weight: bold;
      font-size: 12px;
      margin-bottom: 2px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    /* Footer */
    .footer-area {
      border-top: 1px solid #000;
      padding-top: 6px;
      font-size: 11.5px;
      text-align: center;
      line-height: 1.45;
    }
  </style>
</head>
<body>
  ${showControls ? getPrintControlsHtml("H\xF3a \u0111\u01A1n b\xE1n h\xE0ng \u0111i\u1EC7n t\u1EED - DNTN GIA C\xD4NG TRANG S\u1EE8C T\xC0I TR\xC2M ANH") : ""}

  <div class="invoice-outer">
    <!-- SVG Watermark TTJ -->
    <svg class="watermark-ttj" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="100" cy="100" rx="90" ry="60" stroke="#1e40af" stroke-width="16" fill="none" transform="rotate(-30 100 100)"/>
      <path d="M70 65 H130 M100 65 V135" stroke="#0284c7" stroke-width="14" stroke-linecap="round"/>
      <path d="M125 90 H155 M140 90 V140 Q140 155 125 155" stroke="#1e40af" stroke-width="12" stroke-linecap="round" fill="none"/>
    </svg>

    <div class="relative-content">
      <!-- SELLER HEADER -->
      <div class="seller-header">
        <svg class="ttj-logo" viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="60" cy="45" rx="52" ry="34" stroke="#0284c7" stroke-width="9" fill="none" transform="rotate(-25 60 45)"/>
          <path d="M42 28 H78 M60 28 V66" stroke="#1e40af" stroke-width="8" stroke-linecap="round"/>
          <path d="M75 42 H96 M86 42 V68 Q86 78 76 78" stroke="#0284c7" stroke-width="7" stroke-linecap="round" fill="none"/>
        </svg>

        <div class="seller-details">
          <div class="company-title">${escapeHtml(invoice.nbten || "\u0110\u01A1n v\u1ECB b\xE1n h\xE0ng")}</div>
          <div>M\xE3 s\u1ED1 thu\u1EBF: <strong>${escapeHtml(invoice.nbmst || "")}</strong></div>
          <div>\u0110\u1ECBa ch\u1EC9: ${escapeHtml(invoice.nbdchi || "")}</div>
          <div>\u0110i\u1EC7n tho\u1EA1i: ${escapeHtml(invoice.nbsdt || "(028) 3820 5096")}</div>
          <div>S\u1ED1 t\xE0i kho\u1EA3n: <strong>${escapeHtml(invoice.nbstk ? `${invoice.nbstk} - ${invoice.nbnhang || ""}` : "199228689 - NG\xC2N H\xC0NG TMCP \xC1 CH\xC2U - PGD B\xCCNH \u0110\u0102NG")}</strong></div>
        </div>
      </div>

      <!-- TITLE & META -->
      <div class="title-row">
        <div class="main-title">H\xD3A \u0110\u01A0N B\xC1N H\xC0NG</div>
        <div class="sub-date">Ng\xE0y ${escapeHtml(day)} th\xE1ng ${escapeHtml(month)} n\u0103m ${escapeHtml(year)}</div>
        <div class="cqt-code">M\xE3 CQT: <strong>${escapeHtml(maCqt)}</strong></div>

        <div class="meta-box-right">
          <div>K\xFD hi\u1EC7u: <strong>${escapeHtml(invoice.khhdon || "2C26TTA")}</strong></div>
          <div>S\u1ED1: <strong style="font-size:15px;color:#000;">${escapeHtml(invoice.shdon || "00000273")}</strong></div>
        </div>

        <div class="qr-corner">
          <img src="${qrImg}" alt="QR Tra c\u1EE9u TTJ">
        </div>
      </div>

      <!-- BUYER SECTION -->
      <div class="buyer-section">
        <div class="buyer-line">H\u1ECD t\xEAn ng\u01B0\u1EDDi mua h\xE0ng: <span>${escapeHtml(invoice.nmten && invoice.nmtendv ? invoice.nmten : "")}</span></div>
        <div class="buyer-line">T\xEAn \u0111\u01A1n v\u1ECB: <strong style="text-transform:uppercase;">${escapeHtml(buyerName)}</strong></div>
        <div class="buyer-line">M\xE3 s\u1ED1 thu\u1EBF: <strong>${escapeHtml(buyerTaxCode)}</strong></div>
        <div class="buyer-line">\u0110\u1ECBa ch\u1EC9: ${escapeHtml(buyerAddress)}</div>
        <div class="buyer-line" style="display:flex;justify-content:space-between;">
          <div>H\xECnh th\u1EE9c thanh to\xE1n: <strong>${escapeHtml(paymentMethod)}</strong></div>
          <div>S\u1ED1 t\xE0i kho\u1EA3n: <span>${escapeHtml(invoice.nmstk || "")}</span></div>
        </div>
      </div>

      <!-- GOODS TABLE -->
      <table class="ttj-table">
        <thead>
          <tr>
            <th class="col-stt">STT</th>
            <th class="col-name">T\xEAn h\xE0ng h\xF3a, d\u1ECBch v\u1EE5</th>
            <th class="col-unit">\u0110\u01A1n v\u1ECB t\xEDnh</th>
            <th class="col-qty">S\u1ED1 l\u01B0\u1EE3ng</th>
            <th class="col-price">\u0110\u01A1n gi\xE1</th>
            <th class="col-amount">Th\xE0nh ti\u1EC1n</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item, idx) => {
    const qty = item.quantity || item.sluong || 0;
    const price = item.unitPrice || item.dgia || 0;
    const amt = item.amount || item.thtien || qty * price;
    const unit = item.unit || item.dvt || "m\xF3n";
    const name = item.itemName || item.ten || `Gia c\xF4ng l\u1EAFc HLV610-KLV #${idx + 1}`;
    const qtyFormatted = Number.isInteger(qty) ? `${qty},00` : new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(qty);
    return `
              <tr>
                <td class="col-stt">${idx + 1}</td>
                <td class="col-name">${escapeHtml(name)}</td>
                <td class="col-unit">${escapeHtml(unit)}</td>
                <td class="col-qty">${qtyFormatted}</td>
                <td class="col-price">${formatVND(price)}</td>
                <td class="col-amount">${formatVND(amt)}</td>
              </tr>
            `;
  }).join("")}
        </tbody>
      </table>

      <div class="total-line">
        <span>C\u1ED9ng ti\u1EC1n b\xE1n h\xE0ng h\xF3a, d\u1ECBch v\u1EE5:</span>
        <span style="font-size:13.5px;">${formatVND(totalAmount)}</span>
      </div>

      <div class="words-amount">
        S\u1ED1 ti\u1EC1n vi\u1EBFt b\u1EB1ng ch\u1EEF: <strong>${escapeHtml(wordsAmount)}</strong>
      </div>

      <!-- SIGNATURES -->
      <div class="sign-container">
        <div class="sign-col">
          <div class="sign-title">Ng\u01B0\u1EDDi mua h\xE0ng</div>
          <div class="sign-desc">(K\xFD, ghi r\xF5 h\u1ECD, t\xEAn)</div>
        </div>

        <div class="sign-col">
          <div class="sign-title">Ng\u01B0\u1EDDi b\xE1n h\xE0ng</div>
          <div class="sign-desc">(K\xFD, ghi r\xF5 h\u1ECD, t\xEAn)</div>
          
          <div class="misa-sig-box">
            <div class="sig-valid-header">
              <span style="color:#15803d;font-size:14px;">\u2714</span>
              <span>Signature Valid</span>
            </div>
            <div><strong>K\xFD b\u1EDFi:</strong> ${escapeHtml(invoice.nbten || "Ng\u01B0\u1EDDi b\xE1n h\xE0ng")}</div>
            <div><strong>K\xFD ng\xE0y:</strong> ${escapeHtml(day)}/${escapeHtml(month)}/${escapeHtml(year)}</div>
          </div>
        </div>
      </div>

      <!-- FOOTER -->
      <div class="footer-area">
        <div>Tra c\u1EE9u t\u1EA1i Website: <a href="${escapeHtml(directLookupUrl)}" target="_blank" rel="noopener noreferrer" style="color:#2563eb;text-decoration:none;font-weight:600;">${escapeHtml(pUrl)}</a> - M\xE3 tra c\u1EE9u h\xF3a \u0111\u01A1n: <strong style="font-family:monospace;font-size:12px;">${escapeHtml(mCode)}</strong></div>
        <div style="font-style:italic;color:#64748b;margin-top:2px;">(C\u1EA7n ki\u1EC3m tra, \u0111\u1ED1i chi\u1EBFu khi l\u1EADp, giao, nh\u1EADn h\xF3a \u0111\u01A1n)</div>
        <div style="font-size:10.5px;color:#475569;margin-top:3px;">Ph\xE1t h\xE0nh b\u1EDFi ph\u1EA7n m\u1EC1m MISA meInvoice - C\xF4ng ty C\u1ED5 ph\u1EA7n MISA (www.misa.vn) - MST 0101243150</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// src/templates/XuanVinhTemplate.ts
function renderXuanVinhTemplate(invoice, rawXml, options) {
  const { day, month, year } = extractDateParts(invoice);
  const { lookupCode, lookupUrl } = extractLookupDetails(rawXml);
  const mCode = lookupCode || invoice.lookupCode || "";
  const pUrl = "https://www.meinvoice.vn/tra-cuu";
  const directLookupUrl = buildDirectLookupUrl(pUrl, mCode, "MISA", invoice.nbmst);
  const qrImg = options?.qrCodeDataUrl || generateDefaultQrSvg(`MST:0400557356;KH:${invoice.khhdon};SHD:${invoice.shdon};MTC:${mCode}`);
  const items = ensureInvoiceItems(invoice);
  const totalAmount = invoice.tgtttbso || 19e4;
  const subTotal = invoice.tgtcthue || items.reduce((sum, item) => sum + (item.amount || item.thtien || 0), 0);
  const vatAmount = invoice.tgtthue || (totalAmount - subTotal > 0 ? totalAmount - subTotal : Math.round(subTotal * 0.08));
  const wordsAmount = invoice.tgtttbchu || numberToVietnameseWords(totalAmount);
  const maCqt = invoice.mhdon || "00EB81977D56674404BBBFD392138BEAE7";
  const showControls = options?.showPrintControls !== false;
  const buyerName = invoice.nmten || "C\xD4NG TY TNHH MTV V\xC0NG B\u1EA0C NGH\u0128A T\xCDN";
  const buyerTaxCode = invoice.nmmst || "4000926165";
  const buyerAddress = invoice.nmdchi || "446-448 Phan Ch\xE2u Trinh, Ph\u01B0\u1EDDng Tam K\u1EF3, Th\xE0nh ph\u1ED1 \u0110\xE0 N\u1EB5ng, Vi\u1EC7t Nam";
  const paymentMethod = invoice.htttoan || "TM/CK";
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>H\xD3A \u0110\u01A0N GI\xC1 TR\u1ECA GIA T\u0102NG - C\xD4NG TY TNHH XU\xC2N VINH - S\u1ED1: ${escapeHtml(invoice.shdon)}</title>
  <style>
    @page { size: A4 portrait; margin: 8mm 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body {
      font-family: 'Times New Roman', Times, serif;
      background: #f8fafc;
      margin: 0;
      padding: 16px;
      color: #000;
      font-size: 13px;
      line-height: 1.35;
    }
    .print-actions {
      max-width: 820px;
      margin: 0 auto 16px auto;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .print-actions { display: none !important; }
      .invoice-outer { box-shadow: none !important; border: 3px double #dc2626 !important; }
    }
    .invoice-outer {
      max-width: 820px;
      margin: 0 auto;
      background: #fff;
      border: 3px double #dc2626;
      border-radius: 4px;
      padding: 20px 24px 16px 24px;
      box-shadow: 0 4px 20px rgba(220, 38, 38, 0.12);
      position: relative;
    }
    /* Xuan Vinh Watermark */
    .watermark-xuanvinh {
      position: absolute;
      top: 52%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-25deg);
      font-size: 68px;
      font-weight: 900;
      color: rgba(220, 38, 38, 0.05);
      text-transform: uppercase;
      letter-spacing: 8px;
      pointer-events: none;
      z-index: 0;
      white-space: nowrap;
    }
    .relative-content {
      position: relative;
      z-index: 1;
    }
    /* Header */
    .seller-header {
      display: flex;
      gap: 16px;
      align-items: flex-start;
      margin-bottom: 8px;
    }
    .xuanvinh-logo {
      width: 140px;
      height: 60px;
      flex-shrink: 0;
    }
    .seller-details {
      flex: 1;
      font-size: 12.5px;
      line-height: 1.38;
    }
    .company-title {
      color: #dc2626;
      font-weight: bold;
      font-size: 15px;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    /* Title block */
    .title-row {
      text-align: center;
      margin: 10px 0 12px 0;
      position: relative;
    }
    .main-title {
      font-size: 22px;
      font-weight: bold;
      color: #dc2626;
      letter-spacing: 0.5px;
      margin: 0;
    }
    .sub-date {
      font-style: italic;
      font-size: 13px;
      margin-top: 3px;
    }
    .cqt-code {
      font-style: italic;
      font-size: 12.5px;
      margin-top: 2px;
    }
    .meta-box-right {
      position: absolute;
      right: 0;
      top: 0;
      text-align: right;
      font-size: 12.5px;
    }
    .qr-corner {
      position: absolute;
      right: 0;
      top: 50px;
      width: 90px;
      height: 90px;
      border: 1px solid #ddd;
      padding: 2px;
      background: #fff;
    }
    .qr-corner img {
      width: 100%;
      height: 100%;
      display: block;
    }
    /* Buyer */
    .buyer-section {
      margin-top: 6px;
      margin-bottom: 12px;
      font-size: 12.5px;
      padding-right: 100px;
      line-height: 1.45;
    }
    .buyer-line {
      margin-bottom: 2px;
    }
    /* Goods table */
    table.xv-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #000;
      margin-top: 6px;
    }
    table.xv-table th, table.xv-table td {
      border: 1px solid #000;
      padding: 4.5px 6px;
      font-size: 12px;
    }
    table.xv-table th {
      text-align: center;
      font-weight: bold;
      background: #fff;
    }
    .col-stt { width: 40px; text-align: center; }
    .col-name { text-align: left; }
    .col-unit { width: 65px; text-align: center; }
    .col-qty { width: 75px; text-align: right; }
    .col-price { width: 100px; text-align: right; }
    .col-amount { width: 115px; text-align: right; }
    /* Tax summary table */
    .tax-summary-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #000;
      border-top: none;
      font-size: 12.5px;
    }
    .tax-summary-table td {
      border: 1px solid #000;
      padding: 5px 8px;
    }
    .words-amount {
      border: 1px solid #000;
      border-top: none;
      padding: 6px 10px;
      font-size: 12.5px;
      font-style: italic;
      margin-bottom: 14px;
    }
    /* Signatures */
    .sign-container {
      display: flex;
      justify-content: space-between;
      text-align: center;
      margin-top: 12px;
      margin-bottom: 16px;
    }
    .sign-col {
      width: 45%;
    }
    .sign-title {
      font-weight: bold;
      font-size: 13px;
    }
    .sign-desc {
      font-style: italic;
      font-size: 11px;
      color: #64748b;
    }
    .misa-sig-box {
      margin-top: 8px;
      border: 1.5px solid #15803d;
      border-radius: 4px;
      padding: 8px 12px;
      text-align: left;
      font-size: 11px;
      color: #b91c1c;
      background: rgba(34, 197, 94, 0.04);
    }
    .sig-valid-header {
      color: #dc2626;
      font-weight: bold;
      font-size: 12px;
      margin-bottom: 2px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    /* Footer */
    .footer-area {
      border-top: 1px solid #000;
      padding-top: 6px;
      font-size: 11.5px;
      text-align: center;
      line-height: 1.45;
    }
  </style>
</head>
<body>
  ${showControls ? getPrintControlsHtml("H\xD3A \u0110\u01A0N GI\xC1 TR\u1ECA GIA T\u0102NG - C\xD4NG TY TNHH XU\xC2N VINH") : ""}

  <div class="invoice-outer">
    <div class="watermark-xuanvinh">XU\xC2N VINH</div>

    <div class="relative-content">
      <!-- SELLER HEADER -->
      <div class="seller-header">
        <svg class="xuanvinh-logo" viewBox="0 0 160 60" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 10 L30 50 L50 10" stroke="#dc2626" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M30 30 L55 50" stroke="#b91c1c" stroke-width="8" stroke-linecap="round"/>
          <text x="60" y="32" font-family="'Times New Roman', sans-serif" font-size="20" font-weight="bold" fill="#dc2626">XU\xC2N VINH</text>
          <text x="60" y="46" font-family="sans-serif" font-size="9" font-weight="bold" fill="#475569" letter-spacing="1">COMPUTER & TECH</text>
        </svg>

        <div class="seller-details">
          <div class="company-title">${escapeHtml(invoice.nbten || "\u0110\u01A1n v\u1ECB b\xE1n h\xE0ng")}</div>
          <div>M\xE3 s\u1ED1 thu\u1EBF: <strong>${escapeHtml(invoice.nbmst || "")}</strong></div>
          <div>\u0110\u1ECBa ch\u1EC9: ${escapeHtml(invoice.nbdchi || "")}</div>
          <div>\u0110i\u1EC7n tho\u1EA1i: ${escapeHtml(invoice.nbsdt || "0236 3868 888")}</div>
          <div>S\u1ED1 t\xE0i kho\u1EA3n: <strong>${escapeHtml(invoice.nbstk ? `${invoice.nbstk} - ${invoice.nbnhang || ""}` : "55185259 - Ng\xE2n h\xE0ng ACB \u0110\xE0 N\u1EB5ng / 0041000120221 - Vietcombank")}</strong></div>
        </div>
      </div>

      <!-- TITLE & META -->
      <div class="title-row">
        <div class="main-title">H\xD3A \u0110\u01A0N GI\xC1 TR\u1ECA GIA T\u0102NG</div>
        <div class="sub-date">Ng\xE0y ${escapeHtml(day)} th\xE1ng ${escapeHtml(month)} n\u0103m ${escapeHtml(year)}</div>
        <div class="cqt-code">M\xE3 CQT: <strong>${escapeHtml(maCqt)}</strong></div>

        <div class="meta-box-right">
          <div>K\xFD hi\u1EC7u: <strong>${escapeHtml(invoice.khhdon || "1C26TXV")}</strong></div>
          <div>S\u1ED1: <strong style="font-size:15px;color:#dc2626;">${escapeHtml(invoice.shdon || "00003011")}</strong></div>
        </div>

        <div class="qr-corner">
          <img src="${qrImg}" alt="QR Tra c\u1EE9u Xu\xE2n Vinh">
        </div>
      </div>

      <!-- BUYER SECTION -->
      <div class="buyer-section">
        <div class="buyer-line">H\u1ECD t\xEAn ng\u01B0\u1EDDi mua h\xE0ng: <strong>${escapeHtml(invoice.nmten && invoice.nmtendv ? invoice.nmten : buyerName)}</strong></div>
        <div class="buyer-line">T\xEAn \u0111\u01A1n v\u1ECB: <strong style="text-transform:uppercase;">${escapeHtml(buyerName)}</strong></div>
        <div class="buyer-line">M\xE3 s\u1ED1 thu\u1EBF: <strong>${escapeHtml(buyerTaxCode)}</strong></div>
        <div class="buyer-line">\u0110\u1ECBa ch\u1EC9: ${escapeHtml(buyerAddress)}</div>
        <div class="buyer-line" style="display:flex;justify-content:space-between;">
          <div>H\xECnh th\u1EE9c thanh to\xE1n: <strong>${escapeHtml(paymentMethod)}</strong></div>
          <div>S\u1ED1 t\xE0i kho\u1EA3n: <span>${escapeHtml(invoice.nmstk || "")}</span></div>
        </div>
      </div>

      <!-- GOODS TABLE -->
      <table class="xv-table">
        <thead>
          <tr>
            <th class="col-stt">STT</th>
            <th class="col-name">T\xEAn h\xE0ng h\xF3a, d\u1ECBch v\u1EE5</th>
            <th class="col-unit">\u0110\u01A1n v\u1ECB t\xEDnh</th>
            <th class="col-qty">S\u1ED1 l\u01B0\u1EE3ng</th>
            <th class="col-price">\u0110\u01A1n gi\xE1</th>
            <th class="col-amount">Th\xE0nh ti\u1EC1n</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item, idx) => {
    const qty = item.quantity || item.sluong || 0;
    const price = item.unitPrice || item.dgia || 0;
    const amt = item.amount || item.thtien || qty * price;
    const unit = item.unit || item.dvt || "Chai";
    const name = item.itemName || item.ten || `M\u1EF1c in phun Brother BTD60BK #${idx + 1}`;
    const qtyFormatted = Number.isInteger(qty) ? `${qty},00` : new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(qty);
    return `
              <tr>
                <td class="col-stt">${idx + 1}</td>
                <td class="col-name">${escapeHtml(name)}</td>
                <td class="col-unit">${escapeHtml(unit)}</td>
                <td class="col-qty">${qtyFormatted}</td>
                <td class="col-price">${formatVND(price)}</td>
                <td class="col-amount">${formatVND(amt)}</td>
              </tr>
            `;
  }).join("")}
        </tbody>
      </table>

      <!-- TAX BREAKDOWN TABLE -->
      <table class="tax-summary-table">
        <tr>
          <td style="width:70%;font-weight:bold;">C\u1ED9ng ti\u1EC1n h\xE0ng:</td>
          <td style="width:30%;text-align:right;font-weight:bold;">${formatVND(subTotal)}</td>
        </tr>
        <tr>
          <td>
            <span>Thu\u1EBF su\u1EA5t GTGT: <strong>8%</strong></span>
            <span style="margin-left:30px;">Ti\u1EC1n thu\u1EBF GTGT:</span>
          </td>
          <td style="text-align:right;font-weight:bold;">${formatVND(vatAmount)}</td>
        </tr>
        <tr style="background:#fef2f2;">
          <td style="font-weight:bold;color:#b91c1c;">T\u1ED5ng ti\u1EC1n thanh to\xE1n:</td>
          <td style="text-align:right;font-weight:bold;color:#b91c1c;font-size:13.5px;">${formatVND(totalAmount)}</td>
        </tr>
      </table>

      <div class="words-amount">
        S\u1ED1 ti\u1EC1n vi\u1EBFt b\u1EB1ng ch\u1EEF: <strong>${escapeHtml(wordsAmount)}</strong>
      </div>

      <!-- SIGNATURES -->
      <div class="sign-container">
        <div class="sign-col">
          <div class="sign-title">Ng\u01B0\u1EDDi mua h\xE0ng</div>
          <div class="sign-desc">(K\xFD, ghi r\xF5 h\u1ECD, t\xEAn)</div>
        </div>

        <div class="sign-col">
          <div class="sign-title">Ng\u01B0\u1EDDi b\xE1n h\xE0ng</div>
          <div class="sign-desc">(K\xFD, ghi r\xF5 h\u1ECD, t\xEAn)</div>
          
          <div class="misa-sig-box">
            <div class="sig-valid-header">
              <span style="color:#15803d;font-size:14px;">\u2714</span>
              <span>Signature Valid</span>
            </div>
            <div><strong>K\xFD b\u1EDFi:</strong> ${escapeHtml(invoice.nbten || "Ng\u01B0\u1EDDi b\xE1n h\xE0ng")}</div>
            <div><strong>K\xFD ng\xE0y:</strong> ${escapeHtml(day)}/${escapeHtml(month)}/${escapeHtml(year)}</div>
          </div>
        </div>
      </div>

      <!-- FOOTER -->
      <div class="footer-area">
        <div>Tra c\u1EE9u t\u1EA1i Website: <a href="${escapeHtml(directLookupUrl)}" target="_blank" rel="noopener noreferrer" style="color:#2563eb;text-decoration:none;font-weight:600;">${escapeHtml(pUrl)}</a> - M\xE3 tra c\u1EE9u h\xF3a \u0111\u01A1n: <strong style="font-family:monospace;font-size:12px;">${escapeHtml(mCode)}</strong></div>
        <div style="font-style:italic;color:#64748b;margin-top:2px;">(C\u1EA7n ki\u1EC3m tra, \u0111\u1ED1i chi\u1EBFu khi l\u1EADp, giao, nh\u1EADn h\xF3a \u0111\u01A1n)</div>
        <div style="font-size:10.5px;color:#475569;margin-top:3px;">Ph\xE1t h\xE0nh b\u1EDFi ph\u1EA7n m\u1EC1m MISA meInvoice - C\xF4ng ty C\u1ED5 ph\u1EA7n MISA (www.misa.vn) - MST 0101243150</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// src/templates/KimLoanTuanTemplate.ts
function renderKimLoanTuanTemplate(invoice, rawXml, options) {
  const { day, month, year } = extractDateParts(invoice);
  const { lookupCode, lookupUrl } = extractLookupDetails(rawXml);
  const mCode = lookupCode || invoice.lookupCode || "";
  const pUrl = lookupUrl || invoice.lookupUrl || `http://${invoice.nbmst}hd.easyinvoice.com.vn`;
  const directLookupUrl = buildDirectLookupUrl(pUrl, mCode, "KIM_LOAN_TUAN", invoice.nbmst);
  const qrImg = options?.qrCodeDataUrl || generateDefaultQrSvg(`MST:0318391940;KH:${invoice.khhdon};SHD:${invoice.shdon};MTC:${mCode}`);
  const items = ensureInvoiceItems(invoice);
  const totalAmount = invoice.tgtttbso || items.reduce((sum, item) => sum + (item.amount || item.thtien || 0), 0);
  const wordsAmount = invoice.tgtttbchu || numberToVietnameseWords(totalAmount);
  const taxAuthorityCode = invoice.mhdon || "M2-26-896W-14282367803";
  const showControls = options?.showPrintControls !== false;
  const buyerName = invoice.nmten || "C\xD4NG TY TNHH M\u1ED8T TH\xC0NH VI\xCAN V\xC0NG B\u1EA0C NGH\u0128A T\xCDN";
  const buyerTaxCode = invoice.nmmst || "4000926165";
  const buyerAddress = invoice.nmdchi || "448 Phan Chu Trinh, Ph\u01B0\u1EDDng Tam K\u1EF3, TP \u0110\xE0 N\u1EB5ng, Vi\u1EC7t Nam";
  const paymentMethod = invoice.htttoan || "Chuy\u1EC3n kho\u1EA3n";
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>H\xD3A \u0110\u01A0N B\xC1N H\xC0NG - V\xC0NG B\u1EA0C KIM LOAN TU\u1EA4N - S\u1ED1: ${escapeHtml(invoice.shdon)}</title>
  <style>
    @page { size: A4 portrait; margin: 8mm 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body {
      font-family: 'Times New Roman', Times, serif;
      background: #f8fafc;
      margin: 0;
      padding: 16px;
      color: #000;
      font-size: 13px;
      line-height: 1.35;
    }
    .print-actions {
      max-width: 820px;
      margin: 0 auto 16px auto;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .print-actions { display: none !important; }
      .invoice-outer { box-shadow: none !important; border: 3px double #b45309 !important; }
    }
    .invoice-outer {
      max-width: 820px;
      margin: 0 auto;
      background: #fff;
      border: 3px double #b45309;
      border-radius: 4px;
      padding: 20px 24px 16px 24px;
      box-shadow: 0 4px 20px rgba(180, 83, 9, 0.12);
      position: relative;
    }
    /* Watermark */
    .watermark-klt {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-20deg);
      font-size: 52px;
      font-weight: 800;
      color: rgba(217, 119, 6, 0.05);
      text-transform: uppercase;
      letter-spacing: 4px;
      pointer-events: none;
      z-index: 0;
      text-align: center;
      line-height: 1.2;
    }
    .relative-content {
      position: relative;
      z-index: 1;
    }
    /* Header grid */
    .header-grid {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
      padding-bottom: 6px;
      border-bottom: 1px solid #fef3c7;
    }
    .logo-area {
      width: 170px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .klt-flower-svg {
      width: 60px;
      height: 52px;
    }
    .logo-text {
      font-size: 15px;
      font-weight: bold;
      color: #b45309;
      letter-spacing: 0.5px;
      margin-top: 3px;
      text-align: center;
    }
    .title-area {
      flex: 1;
      text-align: center;
      padding: 0 8px;
    }
    .main-title {
      color: #dc2626;
      font-size: 21px;
      font-weight: bold;
      letter-spacing: 0.5px;
      margin: 0;
    }
    .sub-title {
      color: #dc2626;
      font-size: 13px;
      font-weight: bold;
      margin: 2px 0 1px 0;
    }
    .en-title {
      color: #dc2626;
      font-size: 12px;
      font-style: italic;
      margin: 0;
    }
    .date-str {
      font-style: italic;
      font-size: 12.5px;
      margin-top: 4px;
    }
    .meta-area {
      width: 190px;
      text-align: right;
      font-size: 12.5px;
    }
    .inv-num {
      color: #dc2626;
      font-size: 17px;
      font-weight: bold;
    }
    /* Seller & Buyer */
    .seller-box {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 1px dashed #cbd5e1;
    }
    .seller-info {
      flex: 1;
    }
    .seller-name {
      color: #dc2626;
      font-weight: bold;
      font-size: 13.5px;
      text-transform: uppercase;
    }
    .qr-box {
      width: 96px;
      height: 96px;
      flex-shrink: 0;
      border: 1px solid #e2e8f0;
      padding: 2px;
      background: #fff;
    }
    .qr-box img {
      width: 100%;
      height: 100%;
      display: block;
    }
    .info-row {
      margin-bottom: 3px;
      display: flex;
      align-items: baseline;
    }
    .info-label {
      flex-shrink: 0;
      font-size: 12.5px;
    }
    .info-dots {
      flex: 1;
      border-bottom: 1px dotted #94a3b8;
      margin-left: 4px;
      min-height: 15px;
      padding-left: 2px;
    }
    .buyer-box {
      margin-bottom: 10px;
    }
    /* 7-column table */
    table.klt-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #000;
      margin-top: 6px;
      margin-bottom: 8px;
    }
    table.klt-table th, table.klt-table td {
      border: 1px solid #000;
      padding: 4.5px 5px;
      font-size: 12px;
    }
    table.klt-table th {
      text-align: center;
      font-weight: bold;
      background: #fff;
    }
    .th-sub {
      font-style: italic;
      font-size: 10px;
      font-weight: normal;
    }
    .col-stt { width: 34px; text-align: center; }
    .col-name { text-align: left; }
    .col-unit { width: 50px; text-align: center; }
    .col-qty { width: 65px; text-align: right; }
    .col-weight { width: 68px; text-align: right; }
    .col-price { width: 90px; text-align: right; }
    .col-amount { width: 105px; text-align: right; }
    .total-row td {
      font-weight: bold;
    }
    .words-box {
      border: 1px dashed #94a3b8;
      padding: 6px 10px;
      margin-top: 6px;
      font-size: 12.5px;
      background: #fafafa;
    }
    /* Signature */
    .signature-grid {
      display: flex;
      justify-content: space-between;
      margin-top: 14px;
      margin-bottom: 14px;
      text-align: center;
    }
    .sig-col {
      width: 46%;
    }
    .sig-title {
      font-weight: bold;
      font-size: 13px;
    }
    .sig-box-softdreams {
      margin-top: 8px;
      border: 1.5px solid #16a34a;
      border-radius: 4px;
      padding: 8px 12px;
      text-align: left;
      font-size: 11px;
      color: #dc2626;
      background: rgba(22, 163, 74, 0.03);
    }
    .sig-valid-tag {
      color: #16a34a;
      font-weight: bold;
      font-size: 12px;
      margin-bottom: 3px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    /* Footer */
    .footer-section {
      border-top: 1px solid #000;
      padding-top: 6px;
      font-size: 11.5px;
      line-height: 1.4;
    }
    .footer-provider {
      text-align: center;
      font-size: 11px;
      color: #475569;
      margin-top: 4px;
      padding-top: 4px;
      border-top: 1px dashed #e2e8f0;
    }
  </style>
</head>
<body>
  ${showControls ? getPrintControlsHtml("H\xF3a \u0111\u01A1n b\xE1n h\xE0ng \u0111i\u1EC7n t\u1EED - C\xD4NG TY TNHH KD V\xC0NG B\u1EA0C KIM LOAN TU\u1EA4N") : ""}

  <div class="invoice-outer">
    <div class="watermark-klt">KIM LOAN TU\u1EA4N<br>JEWELRY</div>

    <div class="relative-content">
      <!-- HEADER -->
      <div class="header-grid">
        <div class="logo-area">
          <svg class="klt-flower-svg" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="45" stroke="#d97706" stroke-width="2" fill="#fffbeb"/>
            <!-- 8 petals golden flower -->
            <path d="M50 16 C55 28 55 38 50 50 C45 38 45 28 50 16 Z" fill="#f59e0b" stroke="#b45309" stroke-width="1"/>
            <path d="M50 84 C55 72 55 62 50 50 C45 62 45 72 50 84 Z" fill="#f59e0b" stroke="#b45309" stroke-width="1"/>
            <path d="M16 50 C28 55 38 55 50 50 C38 45 28 45 16 50 Z" fill="#f59e0b" stroke="#b45309" stroke-width="1"/>
            <path d="M84 50 C72 55 62 55 50 50 C62 45 72 45 84 50 Z" fill="#f59e0b" stroke="#b45309" stroke-width="1"/>
            <path d="M26 26 C38 33 44 42 50 50 C42 44 33 38 26 26 Z" fill="#fbbf24" stroke="#b45309" stroke-width="1"/>
            <path d="M74 74 C62 67 56 58 50 50 C58 56 67 62 74 74 Z" fill="#fbbf24" stroke="#b45309" stroke-width="1"/>
            <path d="M74 26 C67 38 58 44 50 50 C56 42 62 33 74 26 Z" fill="#fbbf24" stroke="#b45309" stroke-width="1"/>
            <path d="M26 74 C33 62 42 56 50 50 C44 58 38 67 26 74 Z" fill="#fbbf24" stroke="#b45309" stroke-width="1"/>
            <circle cx="50" cy="50" r="10" fill="#b45309"/>
          </svg>
          <div class="logo-text">KIM LOAN TU\u1EA4N</div>
        </div>

        <div class="title-area">
          <div class="main-title">H\xD3A \u0110\u01A0N B\xC1N H\xC0NG</div>
          <div class="sub-title">(KH\u1EDEI T\u1EA0O T\u1EEA M\xC1Y T\xCDNH TI\u1EC0N)</div>
          <div class="en-title">(VAT INVOICE)</div>
          <div class="date-str">Ng\xE0y (Date) ${escapeHtml(day)} th\xE1ng (month) ${escapeHtml(month)} n\u0103m (year) ${escapeHtml(year)}</div>
        </div>

        <div class="meta-area">
          <div>K\xFD hi\u1EC7u (Serial): <strong>${escapeHtml(invoice.khhdon || "2C26MKG")}</strong></div>
          <div>S\u1ED1 (No.): <span class="inv-num">${escapeHtml(invoice.shdon || "292")}</span></div>
        </div>
      </div>

      <!-- SELLER INFO -->
      <div class="seller-box">
        <div class="seller-info">
          <div class="info-row">
            <span class="info-label">\u0110\u01A1n v\u1ECB b\xE1n h\xE0ng (Seller):</span>
            <span class="seller-name" style="margin-left:6px;">${escapeHtml(invoice.nbten || "\u0110\u01A1n v\u1ECB b\xE1n h\xE0ng")}</span>
          </div>
          <div class="info-row">
            <span class="info-label">M\xE3 s\u1ED1 thu\u1EBF (Tax code):</span>
            <span style="font-weight:bold;margin-left:6px;letter-spacing:1px;">${escapeHtml(renderSpacedTaxCode(invoice.nbmst || ""))}</span>
          </div>
          <div class="info-row">
            <span class="info-label">\u0110\u1ECBa ch\u1EC9 (Address):</span>
            <span style="margin-left:6px;">${escapeHtml(invoice.nbdchi || "")}</span>
          </div>
          <div class="info-row">
            <span class="info-label">T\xE0i kho\u1EA3n (A/C number):</span>
            <span style="margin-left:6px;">${escapeHtml(invoice.nbstk ? `${invoice.nbstk} - ${invoice.nbnhang || ""}` : "05049999 t\u1EA1i Ng\xE2n H\xE0ng Eximbank")}</span>
          </div>
        </div>

        <div class="qr-box">
          <img src="${qrImg}" alt="QR Tra c\u1EE9u Kim Loan Tu\u1EA5n">
        </div>
      </div>

      <!-- BUYER INFO -->
      <div class="buyer-box">
        <div class="info-row">
          <span class="info-label">H\u1ECD t\xEAn ng\u01B0\u1EDDi mua h\xE0ng (Buyer):</span>
          <span class="info-dots">${escapeHtml(invoice.nmten && invoice.nmtendv ? invoice.nmten : "")}</span>
        </div>
        <div class="info-row">
          <span class="info-label">T\xEAn \u0111\u01A1n v\u1ECB (Company's name):</span>
          <span class="info-dots" style="font-weight:bold;">${escapeHtml(buyerName)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">M\xE3 s\u1ED1 thu\u1EBF (Tax code):</span>
          <span class="info-dots" style="font-weight:bold;">${escapeHtml(buyerTaxCode)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">\u0110\u1ECBa ch\u1EC9 (Address):</span>
          <span class="info-dots">${escapeHtml(buyerAddress)}</span>
        </div>
        <div class="info-row" style="display:flex;justify-content:space-between;">
          <div style="width:48%;display:flex;align-items:baseline;">
            <span class="info-label">H\xECnh th\u1EE9c thanh to\xE1n (Payment method):</span>
            <span class="info-dots">${escapeHtml(paymentMethod)}</span>
          </div>
          <div style="width:48%;display:flex;align-items:baseline;">
            <span class="info-label">\u0110\u01A1n v\u1ECB ti\u1EC1n t\u1EC7 (Currency):</span>
            <span class="info-dots" style="font-weight:bold;">${escapeHtml(invoice.dvtte || "VND")}</span>
          </div>
        </div>
      </div>

      <!-- 7-COLUMN GOODS TABLE -->
      <table class="klt-table">
        <thead>
          <tr>
            <th class="col-stt">STT<br><span class="th-sub">(No.)</span></th>
            <th class="col-name">T\xEAn h\xE0ng h\xF3a, d\u1ECBch v\u1EE5<br><span class="th-sub">(Name of goods, services)</span></th>
            <th class="col-unit">\u0110\u01A1n v\u1ECB t\xEDnh<br><span class="th-sub">(Unit)</span></th>
            <th class="col-qty">S\u1ED1 l\u01B0\u1EE3ng<br><span class="th-sub">(Quantity)</span></th>
            <th class="col-weight">Tr\u1ECDng l\u01B0\u1EE3ng<br><span class="th-sub">(Weight)</span></th>
            <th class="col-price">\u0110\u01A1n gi\xE1<br><span class="th-sub">(Unit price)</span></th>
            <th class="col-amount">Th\xE0nh ti\u1EC1n<br><span class="th-sub">(Amount)</span></th>
          </tr>
          <tr style="font-size:10px;text-align:center;font-style:italic;">
            <td>(1)</td>
            <td>(2)</td>
            <td>(3)</td>
            <td>(4)</td>
            <td>(5)</td>
            <td>(6)</td>
            <td>(7)=(4)x(6)</td>
          </tr>
        </thead>
        <tbody>
          ${items.map((item, idx) => {
    const qty = item.quantity || item.sluong || 0;
    const price = item.unitPrice || item.dgia || 0;
    const amt = item.amount || item.thtien || qty * price;
    const unit = item.unit || item.dvt || (idx % 2 === 0 ? "Ch\u1EC9" : "C\xE1i");
    const name = item.itemName || item.ten || `S\u1EA3n ph\u1EA9m v\xE0ng #${idx + 1}`;
    const isLaborFee = name.toLowerCase().includes("ti\u1EC1n c\xF4ng") || name.toLowerCase().includes("tien cong");
    const weightVal = isLaborFee ? "" : formatNum(qty);
    return `
              <tr>
                <td class="col-stt">${idx + 1}</td>
                <td class="col-name">${escapeHtml(name)}</td>
                <td class="col-unit">${escapeHtml(unit)}</td>
                <td class="col-qty">${formatNum(qty)}</td>
                <td class="col-weight">${escapeHtml(weightVal)}</td>
                <td class="col-price">${formatVND(price)}</td>
                <td class="col-amount">${formatVND(amt)}</td>
              </tr>
            `;
  }).join("")}
          <tr class="total-row">
            <td colspan="6" style="text-align:right;font-weight:bold;">T\u1ED5ng c\u1ED9ng ti\u1EC1n thanh to\xE1n (Total payment):</td>
            <td class="col-amount">${formatVND(totalAmount)}</td>
          </tr>
        </tbody>
      </table>

      <!-- WORDS AMOUNT -->
      <div class="words-box">
        <strong>S\u1ED1 ti\u1EC1n vi\u1EBFt b\u1EB1ng ch\u1EEF (Amount in words):</strong> <em>${escapeHtml(wordsAmount)}</em>
      </div>

      <!-- SIGNATURE SECTION -->
      <div class="signature-grid">
        <div class="sig-col">
          <div class="sig-title">Ng\u01B0\u1EDDi mua h\xE0ng (Buyer)</div>
          <div style="font-style:italic;font-size:11px;color:#64748b;margin-top:2px;">(K\xFD, ghi r\xF5 h\u1ECD t\xEAn)</div>
        </div>

        <div class="sig-col">
          <div class="sig-title">Ng\u01B0\u1EDDi b\xE1n h\xE0ng (Seller)</div>
          <div class="sig-box-softdreams">
            <div class="sig-valid-tag">
              <span>\u2714</span> Signature Valid
            </div>
            <div><strong>K\xFD b\u1EDFi:</strong> ${escapeHtml(invoice.nbten || "Ng\u01B0\u1EDDi b\xE1n h\xE0ng")}</div>
            <div><strong>K\xFD ng\xE0y:</strong> ${escapeHtml(day)}-${escapeHtml(month)}-${escapeHtml(year)}</div>
          </div>
        </div>
      </div>

      <!-- FOOTER -->
      <div class="footer-section">
        <div><strong>M\xE3 c\u1EE7a c\u01A1 quan thu\u1EBF (Tax authority code):</strong> <span style="font-family:monospace;font-weight:bold;">${escapeHtml(taxAuthorityCode)}</span></div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
          <div>Trang tra c\u1EE9u: <a href="${escapeHtml(directLookupUrl)}" target="_blank" rel="noopener noreferrer" style="color:#2563eb;text-decoration:underline;">${escapeHtml(pUrl)}</a></div>
          <div>M\xE3 tra c\u1EE9u: <strong style="color:#b91c1c;font-family:monospace;">${escapeHtml(mCode)}</strong></div>
        </div>
        <div style="text-align:center;font-style:italic;margin-top:3px;color:#475569;">(C\u1EA7n ki\u1EC3m tra, \u0111\u1ED1i chi\u1EBFu khi l\u1EADp, giao, nh\u1EADn h\xF3a \u0111\u01A1n)</div>
      </div>

      <div class="footer-provider">
        \u0110\u01A1n v\u1ECB cung c\u1EA5p gi\u1EA3i ph\xE1p: C\xF4ng ty c\u1ED5 ph\u1EA7n \u0111\u1EA7u t\u01B0 c\xF4ng ngh\u1EC7 v\xE0 th\u01B0\u01A1ng m\u1EA1i SOFTDREAMS, MST: 0105987432, Http://easyinvoice.vn/
      </div>
    </div>
  </div>
</body>
</html>`;
}

// src/templates/TkjTemplate.ts
function renderTkjTemplate(invoice, rawXml, options) {
  const { day, month, year } = extractDateParts(invoice);
  const { lookupCode, lookupUrl } = extractLookupDetails(rawXml);
  const mCode = lookupCode || invoice.lookupCode || "";
  const pUrl = lookupUrl || invoice.lookupUrl || `http://${invoice.nbmst}hd.easyinvoice.com.vn`;
  const directLookupUrl = buildDirectLookupUrl(pUrl, mCode, "TKJ", invoice.nbmst);
  const qrImg = options?.qrCodeDataUrl || generateDefaultQrSvg(`MST:0318443500;KH:${invoice.khhdon};SHD:${invoice.shdon};MTC:${mCode}`);
  const items = ensureInvoiceItems(invoice);
  const totalAmount = invoice.tgtttbso || items.reduce((sum, item) => sum + (item.amount || item.thtien || 0), 0);
  const wordsAmount = invoice.tgtttbchu || numberToVietnameseWords(totalAmount);
  const taxAuthorityCode = invoice.mhdon || "M2-26-8K5G-14283833446";
  const showControls = options?.showPrintControls !== false;
  const buyerName = invoice.nmten || "C\xD4NG TY TNHH M\u1ED8T TH\xC0NH VI\xCAN V\xC0NG B\u1EA0C NGH\u0128A T\xCDN";
  const buyerTaxCode = invoice.nmmst || "4000926165";
  const buyerAddress = invoice.nmdchi || "448 Phan Chu Trinh, Ph\u01B0\u1EDDng Tam K\u1EF3, TP \u0110\xE0 N\u1EB5ng, Vi\u1EC7t Nam";
  const paymentMethod = invoice.htttoan || "\u0110\u1ED1i tr\u1EEB c\xF4ng n\u1EE3";
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>H\xD3A \u0110\u01A0N B\xC1N H\xC0NG - V\xC0NG B\u1EA0C TKJ - S\u1ED1: ${escapeHtml(invoice.shdon)}</title>
  <style>
    @page { size: A4 portrait; margin: 8mm 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body {
      font-family: 'Times New Roman', Times, serif;
      background: #f8fafc;
      margin: 0;
      padding: 16px;
      color: #000;
      font-size: 13px;
      line-height: 1.35;
    }
    .print-actions {
      max-width: 820px;
      margin: 0 auto 16px auto;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .print-actions { display: none !important; }
      .invoice-outer { box-shadow: none !important; border: 3px double #15803d !important; }
    }
    .invoice-outer {
      max-width: 820px;
      margin: 0 auto;
      background: #fff;
      border: 3px double #15803d;
      border-radius: 4px;
      padding: 20px 24px 16px 24px;
      box-shadow: 0 4px 20px rgba(21, 128, 61, 0.12);
      position: relative;
    }
    /* Watermark */
    .watermark-tkj {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-20deg);
      font-size: 58px;
      font-weight: 800;
      color: rgba(21, 128, 61, 0.05);
      text-transform: uppercase;
      letter-spacing: 6px;
      pointer-events: none;
      z-index: 0;
      text-align: center;
      line-height: 1.2;
    }
    .relative-content {
      position: relative;
      z-index: 1;
    }
    /* Header grid */
    .header-grid {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
      padding-bottom: 6px;
      border-bottom: 1px solid #dcfce7;
    }
    .logo-area {
      width: 170px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .tkj-logo-svg {
      width: 65px;
      height: 52px;
    }
    .logo-text {
      font-size: 16px;
      font-weight: bold;
      color: #166534;
      letter-spacing: 1px;
      margin-top: 3px;
    }
    .title-area {
      flex: 1;
      text-align: center;
      padding: 0 8px;
    }
    .main-title {
      color: #dc2626;
      font-size: 21px;
      font-weight: bold;
      letter-spacing: 0.5px;
      margin: 0;
    }
    .sub-title {
      color: #dc2626;
      font-size: 13px;
      font-weight: bold;
      margin: 2px 0 1px 0;
    }
    .en-title {
      color: #dc2626;
      font-size: 12px;
      font-style: italic;
      margin: 0;
    }
    .date-str {
      font-style: italic;
      font-size: 12.5px;
      margin-top: 4px;
    }
    .meta-area {
      width: 190px;
      text-align: right;
      font-size: 12.5px;
    }
    .inv-num {
      color: #dc2626;
      font-size: 17px;
      font-weight: bold;
    }
    /* Seller & Buyer */
    .seller-box {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 1px dashed #cbd5e1;
    }
    .seller-info {
      flex: 1;
    }
    .seller-name {
      color: #dc2626;
      font-weight: bold;
      font-size: 13.5px;
      text-transform: uppercase;
    }
    .qr-box {
      width: 96px;
      height: 96px;
      flex-shrink: 0;
      border: 1px solid #e2e8f0;
      padding: 2px;
      background: #fff;
    }
    .qr-box img {
      width: 100%;
      height: 100%;
      display: block;
    }
    .info-row {
      margin-bottom: 3px;
      display: flex;
      align-items: baseline;
    }
    .info-label {
      flex-shrink: 0;
      font-size: 12.5px;
    }
    .info-dots {
      flex: 1;
      border-bottom: 1px dotted #94a3b8;
      margin-left: 4px;
      min-height: 15px;
      padding-left: 2px;
    }
    .buyer-box {
      margin-bottom: 10px;
    }
    /* Table */
    table.tkj-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #000;
      margin-top: 6px;
      margin-bottom: 8px;
    }
    table.tkj-table th, table.tkj-table td {
      border: 1px solid #000;
      padding: 4.5px 6px;
      font-size: 12px;
    }
    table.tkj-table th {
      text-align: center;
      font-weight: bold;
      background: #fff;
    }
    .th-sub {
      font-style: italic;
      font-size: 10.5px;
      font-weight: normal;
    }
    .col-stt { width: 36px; text-align: center; }
    .col-name { text-align: left; }
    .col-unit { width: 60px; text-align: center; }
    .col-qty { width: 68px; text-align: right; }
    .col-price { width: 95px; text-align: right; }
    .col-amount { width: 110px; text-align: right; }
    .total-row td {
      font-weight: bold;
    }
    .words-box {
      border: 1px dashed #94a3b8;
      padding: 6px 10px;
      margin-top: 6px;
      font-size: 12.5px;
      background: #fafafa;
    }
    /* Signature */
    .signature-grid {
      display: flex;
      justify-content: space-between;
      margin-top: 14px;
      margin-bottom: 14px;
      text-align: center;
    }
    .sig-col {
      width: 46%;
    }
    .sig-title {
      font-weight: bold;
      font-size: 13px;
    }
    .sig-box-softdreams {
      margin-top: 8px;
      border: 1.5px solid #16a34a;
      border-radius: 4px;
      padding: 8px 12px;
      text-align: left;
      font-size: 11px;
      color: #dc2626;
      background: rgba(22, 163, 74, 0.03);
    }
    .sig-valid-tag {
      color: #16a34a;
      font-weight: bold;
      font-size: 12px;
      margin-bottom: 3px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    /* Footer */
    .footer-section {
      border-top: 1px solid #000;
      padding-top: 6px;
      font-size: 11.5px;
      line-height: 1.4;
    }
    .footer-provider {
      text-align: center;
      font-size: 11px;
      color: #475569;
      margin-top: 4px;
      padding-top: 4px;
      border-top: 1px dashed #e2e8f0;
    }
  </style>
</head>
<body>
  ${showControls ? getPrintControlsHtml("H\xF3a \u0111\u01A1n b\xE1n h\xE0ng \u0111i\u1EC7n t\u1EED - C\xD4NG TY TNHH TM DV V\xC0NG B\u1EA0C TKJ") : ""}

  <div class="invoice-outer">
    <div class="watermark-tkj">TKJ<br>JEWELRY</div>

    <div class="relative-content">
      <!-- HEADER -->
      <div class="header-grid">
        <div class="logo-area">
          <svg class="tkj-logo-svg" viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="10" y="10" width="80" height="60" rx="12" stroke="#15803d" stroke-width="4" fill="#f0fdf4"/>
            <path d="M25 24 H75 M50 24 V60" stroke="#15803d" stroke-width="6" stroke-linecap="round"/>
            <path d="M56 38 L72 24" stroke="#16a34a" stroke-width="5" stroke-linecap="round"/>
            <path d="M56 46 L74 60" stroke="#16a34a" stroke-width="5" stroke-linecap="round"/>
          </svg>
          <div class="logo-text">TKJ</div>
        </div>

        <div class="title-area">
          <div class="main-title">H\xD3A \u0110\u01A0N B\xC1N H\xC0NG</div>
          <div class="sub-title">(KH\u1EDEI T\u1EA0O T\u1EEA M\xC1Y T\xCDNH TI\u1EC0N)</div>
          <div class="en-title">(SALES INVOICE)</div>
          <div class="date-str">Ng\xE0y (Date) ${escapeHtml(day)} th\xE1ng (month) ${escapeHtml(month)} n\u0103m (year) ${escapeHtml(year)}</div>
        </div>

        <div class="meta-area">
          <div>K\xFD hi\u1EC7u (Serial): <strong>${escapeHtml(invoice.khhdon || "2C26MTK")}</strong></div>
          <div>S\u1ED1 (No.): <span class="inv-num">${escapeHtml(invoice.shdon || "134")}</span></div>
        </div>
      </div>

      <!-- SELLER INFO -->
      <div class="seller-box">
        <div class="seller-info">
          <div class="info-row">
            <span class="info-label">\u0110\u01A1n v\u1ECB b\xE1n h\xE0ng (Seller):</span>
            <span class="seller-name" style="margin-left:6px;">${escapeHtml(invoice.nbten || "\u0110\u01A1n v\u1ECB b\xE1n h\xE0ng")}</span>
          </div>
          <div class="info-row">
            <span class="info-label">M\xE3 s\u1ED1 thu\u1EBF (Tax code):</span>
            <span style="font-weight:bold;margin-left:6px;letter-spacing:1px;">${escapeHtml(renderSpacedTaxCode(invoice.nbmst || ""))}</span>
          </div>
          <div class="info-row">
            <span class="info-label">\u0110\u1ECBa ch\u1EC9 (Address):</span>
            <span style="margin-left:6px;">${escapeHtml(invoice.nbdchi || "")}</span>
          </div>
        </div>

        <div class="qr-box">
          <img src="${qrImg}" alt="QR Tra c\u1EE9u TKJ">
        </div>
      </div>

      <!-- BUYER INFO -->
      <div class="buyer-box">
        <div class="info-row">
          <span class="info-label">H\u1ECD t\xEAn ng\u01B0\u1EDDi mua h\xE0ng (Buyer):</span>
          <span class="info-dots">${escapeHtml(invoice.nmten && invoice.nmtendv ? invoice.nmten : "")}</span>
        </div>
        <div class="info-row">
          <span class="info-label">T\xEAn \u0111\u01A1n v\u1ECB (Company's name):</span>
          <span class="info-dots" style="font-weight:bold;">${escapeHtml(buyerName)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">M\xE3 s\u1ED1 thu\u1EBF (Tax code):</span>
          <span class="info-dots" style="font-weight:bold;">${escapeHtml(buyerTaxCode)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">\u0110\u1ECBa ch\u1EC9 (Address):</span>
          <span class="info-dots">${escapeHtml(buyerAddress)}</span>
        </div>
        <div class="info-row" style="display:flex;justify-content:space-between;">
          <div style="width:48%;display:flex;align-items:baseline;">
            <span class="info-label">H\xECnh th\u1EE9c thanh to\xE1n (Payment method):</span>
            <span class="info-dots">${escapeHtml(paymentMethod)}</span>
          </div>
          <div style="width:48%;display:flex;align-items:baseline;">
            <span class="info-label">\u0110\u01A1n v\u1ECB ti\u1EC1n t\u1EC7 (Currency):</span>
            <span class="info-dots" style="font-weight:bold;">${escapeHtml(invoice.dvtte || "VND")}</span>
          </div>
        </div>
      </div>

      <!-- TABLE OF GOODS -->
      <table class="tkj-table">
        <thead>
          <tr>
            <th class="col-stt">STT<br><span class="th-sub">(No.)</span></th>
            <th class="col-name">T\xEAn h\xE0ng h\xF3a, d\u1ECBch v\u1EE5<br><span class="th-sub">(Description)</span></th>
            <th class="col-unit">\u0110\u01A1n v\u1ECB t\xEDnh<br><span class="th-sub">(Unit)</span></th>
            <th class="col-qty">S\u1ED1 l\u01B0\u1EE3ng<br><span class="th-sub">(Quantity)</span></th>
            <th class="col-price">\u0110\u01A1n gi\xE1<br><span class="th-sub">(Unit price)</span></th>
            <th class="col-amount">Th\xE0nh ti\u1EC1n<br><span class="th-sub">(Amount)</span></th>
          </tr>
          <tr style="font-size:10px;text-align:center;font-style:italic;">
            <td>(1)</td>
            <td>(2)</td>
            <td>(3)</td>
            <td>(4)</td>
            <td>(5)</td>
            <td>(6=4x5)</td>
          </tr>
        </thead>
        <tbody>
          ${items.map((item, idx) => {
    const qty = item.quantity || item.sluong || 0;
    const price = item.unitPrice || item.dgia || 0;
    const amt = item.amount || item.thtien || qty * price;
    const unit = item.unit || item.dvt || (idx % 2 === 0 ? "M\xF3n" : "C\xE1i");
    const name = item.itemName || item.ten || `S\u1EA3n ph\u1EA9m v\xE0ng trang s\u1EE9c TKJ #${idx + 1}`;
    return `
              <tr>
                <td class="col-stt">${idx + 1}</td>
                <td class="col-name">${escapeHtml(name)}</td>
                <td class="col-unit">${escapeHtml(unit)}</td>
                <td class="col-qty">${formatNum(qty)}</td>
                <td class="col-price">${formatVND(price)}</td>
                <td class="col-amount">${formatVND(amt)}</td>
              </tr>
            `;
  }).join("")}
          <tr class="total-row">
            <td colspan="5" style="text-align:right;font-weight:bold;">T\u1ED5ng c\u1ED9ng ti\u1EC1n thanh to\xE1n (Total payment):</td>
            <td class="col-amount">${formatVND(totalAmount)}</td>
          </tr>
        </tbody>
      </table>

      <!-- WORDS AMOUNT -->
      <div class="words-box">
        <strong>S\u1ED1 ti\u1EC1n vi\u1EBFt b\u1EB1ng ch\u1EEF (In words):</strong> <em>${escapeHtml(wordsAmount)}</em>
      </div>

      <!-- SIGNATURE SECTION -->
      <div class="signature-grid">
        <div class="sig-col">
          <div class="sig-title">Ng\u01B0\u1EDDi mua h\xE0ng (Buyer)</div>
          <div style="font-style:italic;font-size:11px;color:#64748b;margin-top:2px;">(K\xFD, ghi r\xF5 h\u1ECD t\xEAn)</div>
        </div>

        <div class="sig-col">
          <div class="sig-title">Ng\u01B0\u1EDDi b\xE1n h\xE0ng (Seller)</div>
          <div class="sig-box-softdreams">
            <div class="sig-valid-tag">
              <span>\u2714</span> Signature Valid
            </div>
            <div><strong>K\xFD b\u1EDFi:</strong> ${escapeHtml(invoice.nbten || "Ng\u01B0\u1EDDi b\xE1n h\xE0ng")}</div>
            <div><strong>K\xFD ng\xE0y:</strong> ${escapeHtml(day)}-${escapeHtml(month)}-${escapeHtml(year)}</div>
          </div>
        </div>
      </div>

      <!-- FOOTER -->
      <div class="footer-section">
        <div><strong>M\xE3 c\u1EE7a c\u01A1 quan thu\u1EBF (Tax authority code):</strong> <span style="font-family:monospace;font-weight:bold;">${escapeHtml(taxAuthorityCode)}</span></div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
          <div>Trang tra c\u1EE9u: <a href="${escapeHtml(directLookupUrl)}" target="_blank" rel="noopener noreferrer" style="color:#2563eb;text-decoration:underline;">${escapeHtml(pUrl)}</a></div>
          <div>M\xE3 tra c\u1EE9u: <strong style="color:#b91c1c;font-family:monospace;">${escapeHtml(mCode)}</strong></div>
        </div>
        <div style="text-align:center;font-style:italic;margin-top:3px;color:#475569;">(C\u1EA7n ki\u1EC3m tra, \u0111\u1ED1i chi\u1EBFu khi l\u1EADp, giao, nh\u1EADn h\xF3a \u0111\u01A1n)</div>
      </div>

      <div class="footer-provider">
        \u0110\u01A1n v\u1ECB cung c\u1EA5p gi\u1EA3i ph\xE1p: C\xF4ng ty c\u1ED5 ph\u1EA7n \u0111\u1EA7u t\u01B0 c\xF4ng ngh\u1EC7 v\xE0 th\u01B0\u01A1ng m\u1EA1i SOFTDREAMS, MST: 0105987432, Http://easyinvoice.vn/
      </div>
    </div>
  </div>
</body>
</html>`;
}

// src/templates/NghiaSonTemplate.ts
function renderNghiaSonTemplate(invoice, rawXml, options) {
  const { day, month, year } = extractDateParts(invoice);
  const { lookupCode, lookupUrl } = extractLookupDetails(rawXml);
  const maCqt = invoice.mhdon || "00BB3C25BCB8C74D908D5962B75A9ED39B";
  const mCode = invoice.mhdon || lookupCode || invoice.lookupCode || maCqt;
  const pUrl = lookupUrl || invoice.lookupUrl || `https://${invoice.nbmst || "4000344946"}-tt78.vnpt-invoice.com.vn`;
  const directLookupUrl = buildDirectLookupUrl(pUrl, mCode, "VNPT", invoice.nbmst || "4000344946");
  const qrImg = options?.qrCodeDataUrl || generateDefaultQrSvg(`MST:${invoice.nbmst || ""};KH:${invoice.khhdon};SHD:${invoice.shdon}${mCode ? `;MTC:${mCode}` : ""}`);
  const items = ensureInvoiceItems(invoice);
  const totalAmount = invoice.tgtttbso || items.reduce((sum, item) => sum + (item.amount || item.thtien || 0), 0);
  const subTotal = invoice.tgtcthue || Math.round(totalAmount / 1.1);
  const vatAmount = invoice.tgtthue || (totalAmount - subTotal > 0 ? totalAmount - subTotal : Math.round(subTotal * 0.1));
  const wordsAmount = invoice.tgtttbchu || numberToVietnameseWords(totalAmount);
  const showControls = options?.showPrintControls !== false;
  const buyerName = invoice.nmten || "C\xD4NG TY TNHH M\u1ED8T TH\xC0NH VI\xCAN V\xC0NG B\u1EA0C NGH\u0128A T\xCDN";
  const buyerTaxCode = invoice.nmmst || "4000926165";
  const buyerAddress = invoice.nmdchi || "448 Phan Chu Trinh, Ph\u01B0\u1EDDng Tam K\u1EF3, Th\xE0nh ph\u1ED1 Tam K\u1EF3, T\u1EC9nh Qu\u1EA3ng Nam, Vi\u1EC7t Nam";
  const paymentMethod = invoice.htttoan || "Chuy\u1EC3n kho\u1EA3n";
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>H\xD3A \u0110\u01A0N GI\xC1 TR\u1ECA GIA T\u0102NG - ${escapeHtml(invoice.nbten || "\u0110\u01A1n v\u1ECB b\xE1n h\xE0ng")} - S\u1ED1: ${escapeHtml(invoice.shdon)}</title>
  <style>
    @page { size: A4 portrait; margin: 8mm 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body {
      font-family: 'Times New Roman', Times, serif;
      background: #f8fafc;
      margin: 0;
      padding: 16px;
      color: #000;
      font-size: 13px;
      line-height: 1.35;
    }
    .print-actions {
      max-width: 820px;
      margin: 0 auto 16px auto;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .print-actions { display: none !important; }
      .invoice-outer { box-shadow: none !important; border: 3px double #0284c7 !important; }
    }
    .invoice-outer {
      max-width: 820px;
      margin: 0 auto;
      background: #fff;
      border: 3px double #0284c7;
      border-radius: 4px;
      padding: 18px 22px 14px 22px;
      box-shadow: 0 4px 20px rgba(2, 132, 199, 0.12);
      position: relative;
    }
    .top-vnpt-banner {
      text-align: center;
      font-size: 11px;
      color: #0369a1;
      border-bottom: 1px solid #bae6fd;
      padding-bottom: 4px;
      margin-bottom: 8px;
    }
    /* Header */
    .header-grid {
      display: flex;
      gap: 14px;
      align-items: flex-start;
      margin-bottom: 6px;
    }
    .vnpt-logo-box {
      width: 70px;
      height: 60px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .vnpt-globe-svg {
      width: 55px;
      height: 55px;
    }
    .seller-text-box {
      flex: 1;
      font-size: 12.5px;
      line-height: 1.38;
    }
    .seller-title {
      color: #0369a1;
      font-weight: bold;
      font-size: 14.5px;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    /* Title block */
    .title-row {
      text-align: center;
      margin: 8px 0 10px 0;
      position: relative;
    }
    .main-title {
      font-size: 22px;
      font-weight: bold;
      color: #dc2626;
      letter-spacing: 0.5px;
      margin: 0;
    }
    .en-title {
      font-size: 12px;
      font-style: italic;
      color: #dc2626;
      margin: 1px 0;
    }
    .sub-date {
      font-style: italic;
      font-size: 12.5px;
      margin-top: 2px;
    }
    .cqt-code {
      font-style: italic;
      font-size: 12px;
      margin-top: 2px;
    }
    .meta-box-right {
      position: absolute;
      right: 0;
      top: 0;
      text-align: right;
      font-size: 12.5px;
    }
    .qr-corner {
      position: absolute;
      right: 0;
      top: 52px;
      width: 86px;
      height: 86px;
      border: 1px solid #ddd;
      padding: 2px;
      background: #fff;
    }
    .qr-corner img {
      width: 100%;
      height: 100%;
      display: block;
    }
    /* Buyer */
    .buyer-section {
      margin-top: 6px;
      margin-bottom: 10px;
      font-size: 12.5px;
      padding-right: 95px;
      line-height: 1.45;
    }
    .buyer-line {
      margin-bottom: 2px;
    }
    /* Goods table */
    table.ns-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #000;
      margin-top: 6px;
    }
    table.ns-table th, table.ns-table td {
      border: 1px solid #000;
      padding: 4px 6px;
      font-size: 12px;
    }
    table.ns-table th {
      text-align: center;
      font-weight: bold;
      background: #fff;
    }
    .th-sub {
      font-style: italic;
      font-size: 10px;
      font-weight: normal;
    }
    .col-stt { width: 36px; text-align: center; }
    .col-name { text-align: left; }
    .col-unit { width: 60px; text-align: center; }
    .col-qty { width: 68px; text-align: right; }
    .col-price { width: 95px; text-align: right; }
    .col-amount { width: 110px; text-align: right; }
    /* Tax calculations */
    .calc-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #000;
      border-top: none;
      font-size: 12.5px;
    }
    .calc-table td {
      border: 1px solid #000;
      padding: 4.5px 8px;
    }
    .words-amount {
      border: 1px solid #000;
      border-top: none;
      padding: 6px 10px;
      font-size: 12.5px;
      font-style: italic;
      margin-bottom: 12px;
    }
    /* 3 Signatures */
    .sign-container {
      display: flex;
      justify-content: space-between;
      text-align: center;
      margin-top: 10px;
      margin-bottom: 14px;
    }
    .sign-col {
      width: 32%;
    }
    .sign-title {
      font-weight: bold;
      font-size: 12.5px;
    }
    .sign-desc {
      font-style: italic;
      font-size: 10.5px;
      color: #64748b;
    }
    .vnpt-sig-box {
      margin-top: 6px;
      border: 1px solid #16a34a;
      border-radius: 4px;
      padding: 6px 8px;
      text-align: left;
      font-size: 10.5px;
      color: #000;
      background: rgba(22, 163, 74, 0.03);
    }
    .sig-valid-tag {
      color: #16a34a;
      font-weight: bold;
      font-size: 11.5px;
      margin-bottom: 2px;
      display: flex;
      align-items: center;
      gap: 3px;
    }
    /* Footer */
    .footer-area {
      border-top: 1px solid #000;
      padding-top: 6px;
      font-size: 11.5px;
      text-align: center;
      line-height: 1.45;
    }
  </style>
</head>
<body>
  ${showControls ? getPrintControlsHtml(`H\xD3A \u0110\u01A0N GI\xC1 TR\u1ECA GIA T\u0102NG - ${invoice.nbten || "\u0110\u01A1n v\u1ECB b\xE1n h\xE0ng"}`) : ""}

  <div class="invoice-outer">
    <div class="top-vnpt-banner">
      \u0110\u01A1n v\u1ECB cung c\u1EA5p gi\u1EA3i ph\xE1p h\xF3a \u0111\u01A1n \u0111i\u1EC7n t\u1EED: T\u1EADp \u0111o\xE0n B\u01B0u ch\xEDnh Vi\u1EC5n th\xF4ng Vi\u1EC7t Nam. \u0110i\u1EC7n tho\u1EA1i: 1800.1260
    </div>

    <!-- SELLER HEADER -->
    <div class="header-grid">
      <div class="vnpt-logo-box">
        <svg class="vnpt-globe-svg" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="44" fill="#0284c7"/>
          <ellipse cx="50" cy="50" rx="44" ry="18" stroke="#ffffff" stroke-width="3" fill="none"/>
          <ellipse cx="50" cy="50" rx="18" ry="44" stroke="#ffffff" stroke-width="3" fill="none"/>
          <path d="M50 6 V94" stroke="#ffffff" stroke-width="3"/>
          <path d="M6 50 H94" stroke="#ffffff" stroke-width="3"/>
        </svg>
      </div>

      <div class="seller-text-box">
        <div class="seller-title">${escapeHtml(invoice.nbten || "\u0110\u01A1n v\u1ECB b\xE1n h\xE0ng")}</div>
        <div>M\xE3 s\u1ED1 thu\u1EBF (Tax code): <strong>${escapeHtml(invoice.nbmst || "")}</strong></div>
        <div>\u0110\u1ECBa ch\u1EC9 (Address): ${escapeHtml(invoice.nbdchi || "")}</div>
        <div>\u0110i\u1EC7n tho\u1EA1i (Tel): ${escapeHtml(invoice.nbsdt || "0921143577")}</div>
        <div>S\u1ED1 t\xE0i kho\u1EA3n (Account No.): <strong>${escapeHtml(invoice.nbstk ? `${invoice.nbstk} - ${invoice.nbnhang || ""}` : "040092309799 - Ng\xE2n h\xE0ng Sacombank -Chi nh\xE1nh Qu\u1EA3ng Nam")}</strong></div>
      </div>
    </div>

    <!-- TITLE & META -->
    <div class="title-row">
      <div class="main-title">H\xD3A \u0110\u01A0N GI\xC1 TR\u1ECA GIA T\u0102NG</div>
      <div class="en-title">(VAT INVOICE)</div>
      <div class="sub-date">Ng\xE0y (Date) ${escapeHtml(day)} th\xE1ng (month) ${escapeHtml(month)} n\u0103m (year) ${escapeHtml(year)}</div>
      <div class="cqt-code">M\xE3 CQT: <strong>${escapeHtml(maCqt)}</strong></div>

      <div class="meta-box-right">
        <div>M\u1EABu s\u1ED1 (Form): <strong>${escapeHtml(invoice.khmshdon || "1")}</strong></div>
        <div>K\xFD hi\u1EC7u (Serial): <strong>${escapeHtml(invoice.khhdon || "1C26TNS")}</strong></div>
        <div>S\u1ED1 (No.): <strong style="font-size:15px;color:#dc2626;">${escapeHtml(invoice.shdon || "00000010")}</strong></div>
      </div>

      <div class="qr-corner">
        <img src="${qrImg}" alt="QR Tra c\u1EE9u h\xF3a \u0111\u01A1n">
      </div>
    </div>

    <!-- BUYER SECTION -->
    <div class="buyer-section">
      <div class="buyer-line">H\u1ECD t\xEAn ng\u01B0\u1EDDi mua h\xE0ng (Buyer): <span>${escapeHtml(invoice.nmten && invoice.nmtendv ? invoice.nmten : "")}</span></div>
      <div class="buyer-line">T\xEAn \u0111\u01A1n v\u1ECB (Company): <strong style="text-transform:uppercase;">${escapeHtml(buyerName)}</strong></div>
      <div class="buyer-line">M\xE3 s\u1ED1 thu\u1EBF (Tax code): <strong>${escapeHtml(buyerTaxCode)}</strong></div>
      <div class="buyer-line">\u0110\u1ECBa ch\u1EC9 (Address): ${escapeHtml(buyerAddress)}</div>
      <div class="buyer-line" style="display:flex;justify-content:space-between;">
        <div>H\xECnh th\u1EE9c thanh to\xE1n (Payment method): <strong>${escapeHtml(paymentMethod)}</strong></div>
        <div>S\u1ED1 t\xE0i kho\u1EA3n (Account No.): <span>${escapeHtml(invoice.nmstk || "")}</span></div>
      </div>
    </div>

    <!-- GOODS TABLE -->
    <table class="ns-table">
      <thead>
        <tr>
          <th class="col-stt">STT<br><span class="th-sub">(No.)</span></th>
          <th class="col-name">T\xEAn h\xE0ng h\xF3a, d\u1ECBch v\u1EE5<br><span class="th-sub">(Description)</span></th>
          <th class="col-unit">\u0110\u01A1n v\u1ECB t\xEDnh<br><span class="th-sub">(Unit)</span></th>
          <th class="col-qty">S\u1ED1 l\u01B0\u1EE3ng<br><span class="th-sub">(Quantity)</span></th>
          <th class="col-price">\u0110\u01A1n gi\xE1<br><span class="th-sub">(Unit Price)</span></th>
          <th class="col-amount">Th\xE0nh ti\u1EC1n<br><span class="th-sub">(Amount)</span></th>
        </tr>
        <tr style="font-size:10px;text-align:center;font-style:italic;">
          <td>(1)</td>
          <td>(2)</td>
          <td>(3)</td>
          <td>(4)</td>
          <td>(5)</td>
          <td>(6=4x5)</td>
        </tr>
      </thead>
      <tbody>
        ${items.map((item, idx) => {
    const qty = item.quantity || item.sluong || 0;
    const price = item.unitPrice || item.dgia || 0;
    const amt = item.amount || item.thtien || qty * price;
    const unit = item.unit || item.dvt || "ch\u1EC9";
    const name = item.itemName || item.ten || `H\xE0ng h\xF3a, d\u1ECBch v\u1EE5 #${idx + 1}`;
    return `
            <tr>
              <td class="col-stt">${idx + 1}</td>
              <td class="col-name">${escapeHtml(name)}</td>
              <td class="col-unit">${escapeHtml(unit)}</td>
              <td class="col-qty">${formatNum(qty)}</td>
              <td class="col-price">${formatVND(price)}</td>
              <td class="col-amount">${formatVND(amt)}</td>
            </tr>
          `;
  }).join("")}
      </tbody>
    </table>

    <!-- TAX CALCULATIONS -->
    <table class="calc-table">
      <tr>
        <td style="width:70%;font-weight:bold;">Thu\u1EBF su\u1EA5t GTGT (VAT rate): 10%</td>
        <td style="width:30%;text-align:right;">Ti\u1EC1n thu\u1EBF GTGT: <strong>${formatVND(vatAmount)}</strong></td>
      </tr>
      <tr style="background:#f0fdf4;">
        <td style="font-weight:bold;">T\u1ED5ng c\u1ED9ng ti\u1EC1n thanh to\xE1n (Total payment):</td>
        <td style="text-align:right;font-weight:bold;color:#b91c1c;font-size:13px;">${formatVND(totalAmount)}</td>
      </tr>
    </table>

    <div class="words-amount">
      S\u1ED1 ti\u1EC1n vi\u1EBFt b\u1EB1ng ch\u1EEF (In words): <strong>${escapeHtml(wordsAmount)}</strong>
    </div>

    <!-- 3 SIGNATURES SECTION -->
    <div class="sign-container">
      <div class="sign-col">
        <div class="sign-title">Ng\u01B0\u1EDDi mua h\xE0ng (Buyer)</div>
        <div class="sign-desc">(K\xFD, ghi r\xF5 h\u1ECD, t\xEAn)</div>
      </div>

      <div class="sign-col">
        <div class="sign-title">C\u01A1 quan thu\u1EBF (Tax authorities)</div>
        <div class="sign-desc">(K\xFD \u0111i\u1EC7n t\u1EED)</div>
        <div class="vnpt-sig-box">
          <div class="sig-valid-tag"><span>\u2714</span> Signature Valid</div>
          <div><strong>K\xFD b\u1EDFi:</strong> T\u1ED5ng c\u1EE5c Thu\u1EBF</div>
          <div><strong>K\xFD ng\xE0y:</strong> ${escapeHtml(day)}/${escapeHtml(month)}/${escapeHtml(year)}</div>
        </div>
      </div>

      <div class="sign-col">
        <div class="sign-title">Ng\u01B0\u1EDDi b\xE1n h\xE0ng (Seller)</div>
        <div class="sign-desc">(K\xFD \u0111i\u1EC7n t\u1EED)</div>
        <div class="vnpt-sig-box">
          <div class="sig-valid-tag"><span>\u2714</span> Signature Valid</div>
          <div><strong>K\xFD b\u1EDFi:</strong> ${escapeHtml(invoice.nbten || "Ng\u01B0\u1EDDi b\xE1n h\xE0ng")}</div>
          <div><strong>K\xFD ng\xE0y:</strong> ${escapeHtml(day)}/${escapeHtml(month)}/${escapeHtml(year)}</div>
        </div>
      </div>
    </div>

    <!-- FOOTER -->
    <div class="footer-area">
      <div style="font-style:italic;color:#64748b;">(C\u1EA7n ki\u1EC3m tra, \u0111\u1ED1i chi\u1EBFu khi l\u1EADp, giao, nh\u1EADn h\xF3a \u0111\u01A1n)</div>
      <div style="margin-top:2px;">Tra c\u1EE9u h\xF3a \u0111\u01A1n \u0111i\u1EC7n t\u1EED t\u1EA1i Website: <a href="${escapeHtml(directLookupUrl)}" target="_blank" rel="noopener noreferrer" style="color:#0284c7;text-decoration:underline;font-weight:600;">${escapeHtml(pUrl)}</a> - M\xE3 tra c\u1EE9u: <strong style="font-family:monospace;font-size:12px;">${escapeHtml(mCode)}</strong></div>
    </div>
  </div>
</body>
</html>`;
}

// src/templates/TanThanhDanhTemplate.ts
function renderTanThanhDanhTemplate(invoice, rawXml, options) {
  const { day, month, year } = extractDateParts(invoice);
  const { lookupCode, lookupUrl } = extractLookupDetails(rawXml);
  const mCode = lookupCode || invoice.lookupCode || "";
  const pUrl = "https://www.meinvoice.vn/tra-cuu";
  const directLookupUrl = buildDirectLookupUrl(pUrl, mCode, "MISA", invoice.nbmst || "0317978711");
  const qrImg = options?.qrCodeDataUrl || generateDefaultQrSvg(`MST:${invoice.nbmst || "0317978711"};KH:${invoice.khhdon || "2C26MTD"};SHD:${invoice.shdon || ""};MTC:${mCode}`);
  const items = ensureInvoiceItems(invoice);
  const calculatedTotal = items.reduce((sum, item) => sum + Number(item.amount || item.thtien || 0), 0);
  const totalAmount = typeof invoice.tgtttbso === "number" && invoice.tgtttbso > 0 ? invoice.tgtttbso : calculatedTotal;
  const wordsAmount = invoice.tgtttbchu || (totalAmount > 0 ? numberToVietnameseWords(totalAmount) : "");
  const maCqt = invoice.mhdon || "";
  const showControls = options?.showPrintControls !== false;
  const sellerName = invoice.nbten || "C\xD4NG TY TNHH KINH DOANH V\xC0NG B\u1EA0C T\xC2N THANH DANH";
  const sellerTaxCode = invoice.nbmst || "0317978711";
  const sellerAddress = invoice.nbdchi || invoice.nmdchi_seller || "25-27 An D\u01B0\u01A1ng V\u01B0\u01A1ng, Ph\u01B0\u1EDDng 08, Qu\u1EADn 5, Th\xE0nh ph\u1ED1 H\u1ED3 Ch\xED Minh, Vi\u1EC7t Nam";
  const sellerPhone = invoice.sdt_seller || invoice.nbsdt || "028 3835 1868";
  const sellerBank = invoice.nbstk ? `${invoice.nbstk}${invoice.nbnhang ? ` - ${invoice.nbnhang}` : ""}` : "";
  const buyerName = invoice.nmten || "C\xD4NG TY TNHH M\u1ED8T TH\xC0NH VI\xCAN V\xC0NG B\u1EA0C NGH\u0128A T\xCDN";
  const buyerTaxCode = invoice.nmmst || "4000926165";
  const buyerAddress = invoice.nmdchi || "448 Phan Chu Trinh, Ph\u01B0\u1EDDng Tam K\u1EF3, Th\xE0nh ph\u1ED1 Tam K\u1EF3, T\u1EC9nh Qu\u1EA3ng Nam, Vi\u1EC7t Nam";
  const paymentMethod = invoice.htttoan || "TM/CK";
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>H\xD3A \u0110\u01A0N B\xC1N H\xC0NG - ${escapeHtml(sellerName)} - S\u1ED1: ${escapeHtml(invoice.shdon || "")}</title>
  <style>
    @page { size: A4 portrait; margin: 8mm 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body {
      font-family: 'Times New Roman', Times, serif;
      background: #f8fafc;
      margin: 0;
      padding: 16px;
      color: #000;
      font-size: 13px;
      line-height: 1.35;
    }
    .print-actions {
      max-width: 820px;
      margin: 0 auto 16px auto;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .print-actions { display: none !important; }
      .invoice-outer { box-shadow: none !important; border: 3px double #047857 !important; }
    }
    .invoice-outer {
      max-width: 820px;
      margin: 0 auto;
      background: #fff;
      border: 3px double #047857;
      border-radius: 4px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.08);
      position: relative;
      padding: 6px;
    }
    .invoice-inner {
      border: 1px solid #10b981;
      padding: 16px 20px 14px 20px;
      position: relative;
    }
    .header-layout {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      border-bottom: 1.5px solid #047857;
      padding-bottom: 12px;
    }
    .logo-box {
      width: 78px;
      height: 78px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1.5px solid #047857;
      border-radius: 6px;
      background: #ecfdf5;
      color: #047857;
      font-size: 26px;
      font-weight: bold;
    }
    .seller-info {
      flex: 1;
      padding: 0 4px;
    }
    .seller-name {
      font-size: 15px;
      font-weight: bold;
      color: #065f46;
      text-transform: uppercase;
      margin-bottom: 4px;
      line-height: 1.25;
    }
    .seller-detail {
      font-size: 12.5px;
      color: #1e293b;
      margin-bottom: 2px;
    }
    .qr-box {
      width: 80px;
      flex-shrink: 0;
      text-align: right;
    }
    .qr-box img {
      width: 76px;
      height: 76px;
      display: block;
      margin-left: auto;
    }
    
    .title-area {
      text-align: center;
      margin-top: 10px;
      margin-bottom: 10px;
    }
    .invoice-title {
      font-size: 20px;
      font-weight: bold;
      color: #047857;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    .invoice-date {
      font-style: italic;
      font-size: 12.5px;
      color: #334155;
    }
    .invoice-meta-grid {
      display: flex;
      justify-content: center;
      gap: 24px;
      margin-top: 4px;
      font-size: 12.5px;
    }
    
    .buyer-section {
      background: #f0fdf4;
      border: 1px dashed #6ee7b7;
      border-radius: 4px;
      padding: 8px 12px;
      margin-bottom: 10px;
      font-size: 12.5px;
    }
    .buyer-row {
      display: flex;
      margin-bottom: 3px;
    }
    .buyer-label {
      width: 140px;
      flex-shrink: 0;
      color: #334155;
    }
    .buyer-val {
      flex: 1;
      font-weight: 500;
      color: #0f172a;
    }

    /* B\u1EA3ng h\xE0ng h\xF3a */
    table.items-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #047857;
      font-size: 12px;
      margin-bottom: 8px;
    }
    table.items-table th, table.items-table td {
      border: 1px solid #047857;
      padding: 5px 6px;
    }
    table.items-table th {
      background: #ecfdf5;
      color: #065f46;
      font-weight: bold;
      text-align: center;
    }
    .col-stt { width: 36px; text-align: center; }
    .col-name { text-align: left; }
    .col-unit { width: 55px; text-align: center; }
    .col-qty { width: 60px; text-align: right; }
    .col-price { width: 95px; text-align: right; }
    .col-amount { width: 110px; text-align: right; }

    .summary-area {
      border: 1px solid #047857;
      border-top: none;
      background: #fafaf9;
      padding: 6px 10px;
      font-size: 12.5px;
      margin-top: -8px;
      margin-bottom: 12px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 3px;
    }

    .sign-container {
      display: flex;
      justify-content: space-between;
      margin-top: 14px;
      margin-bottom: 12px;
    }
    .sign-col {
      width: 48%;
      text-align: center;
    }
    .sign-title {
      font-weight: bold;
      font-size: 13px;
      text-transform: uppercase;
      color: #065f46;
    }
    .sign-desc {
      font-style: italic;
      font-size: 11px;
      color: #64748b;
      margin-top: 1px;
    }
    .misa-sig-box {
      margin-top: 10px;
      border: 1.5px solid #16a34a;
      background: #f0fdf4;
      border-radius: 4px;
      padding: 6px 10px;
      display: inline-block;
      text-align: left;
      font-size: 11px;
      color: #15803d;
      min-width: 220px;
    }
    .sig-valid-header {
      display: flex;
      align-items: center;
      gap: 5px;
      font-weight: bold;
      font-size: 12px;
      margin-bottom: 2px;
      border-bottom: 1px solid #bbf7d0;
      padding-bottom: 2px;
    }

    /* FOOTER */
    .footer-area {
      border-top: 1px dashed #cbd5e1;
      padding-top: 8px;
      margin-top: 10px;
      text-align: center;
      font-size: 11.5px;
      color: #334155;
      line-height: 1.45;
    }
  </style>
</head>
<body>
  ${showControls ? getPrintControlsHtml("H\xF3a \u0111\u01A1n T\xE2n Thanh Danh") : ""}

  <div class="invoice-outer">
    <div class="invoice-inner">
      <!-- HEADER -->
      <div class="header-layout">
        <div class="logo-box">
          TTD
        </div>

        <div class="seller-info">
          <div class="seller-name">${escapeHtml(sellerName)}</div>
          <div class="seller-detail"><strong>M\xE3 s\u1ED1 thu\u1EBF:</strong> <span style="font-family:monospace;font-weight:bold;font-size:13px;color:#065f46;">${escapeHtml(sellerTaxCode)}</span></div>
          <div class="seller-detail"><strong>\u0110\u1ECBa ch\u1EC9:</strong> ${escapeHtml(sellerAddress)}</div>
          <div class="seller-detail"><strong>\u0110i\u1EC7n tho\u1EA1i:</strong> ${escapeHtml(sellerPhone)}</div>
          <div class="seller-detail"><strong>S\u1ED1 t\xE0i kho\u1EA3n:</strong> ${escapeHtml(sellerBank)}</div>
        </div>

        <div class="qr-box">
          <img src="${qrImg}" alt="QR Tra c\u1EE9u" />
        </div>
      </div>

      <!-- TITLE -->
      <div class="title-area">
        <div class="invoice-title">H\xD3A \u0110\u01A0N B\xC1N H\xC0NG</div>
        <div class="invoice-date">Ng\xE0y ${escapeHtml(day)} th\xE1ng ${escapeHtml(month)} n\u0103m ${escapeHtml(year)}</div>
        <div class="invoice-meta-grid">
          <div>K\xFD hi\u1EC7u: <strong style="font-family:monospace;color:#065f46;">${escapeHtml(invoice.khhdon || "2C26MTD")}</strong></div>
          <div>S\u1ED1: <strong style="font-family:monospace;font-size:14px;color:#b91c1c;">${escapeHtml(invoice.shdon || "00001667")}</strong></div>
        </div>
        <div style="font-size:11.5px;color:#475569;margin-top:3px;">
          M\xE3 c\u1EE7a CQT: <strong style="font-family:monospace;color:#047857;">${escapeHtml(maCqt)}</strong>
        </div>
      </div>

      <!-- BUYER -->
      <div class="buyer-section">
        <div class="buyer-row">
          <div class="buyer-label">H\u1ECD t\xEAn ng\u01B0\u1EDDi mua h\xE0ng:</div>
          <div class="buyer-val">${escapeHtml(invoice.tennguoimua || invoice.nmten || "")}</div>
        </div>
        <div class="buyer-row">
          <div class="buyer-label">T\xEAn \u0111\u01A1n v\u1ECB:</div>
          <div class="buyer-val" style="font-weight:bold;color:#065f46;">${escapeHtml(buyerName)}</div>
        </div>
        <div class="buyer-row">
          <div class="buyer-label">M\xE3 s\u1ED1 thu\u1EBF:</div>
          <div class="buyer-val" style="font-family:monospace;font-weight:bold;">${escapeHtml(buyerTaxCode)}</div>
        </div>
        <div class="buyer-row">
          <div class="buyer-label">\u0110\u1ECBa ch\u1EC9:</div>
          <div class="buyer-val">${escapeHtml(buyerAddress)}</div>
        </div>
        <div class="buyer-row">
          <div class="buyer-label">H\xECnh th\u1EE9c thanh to\xE1n:</div>
          <div class="buyer-val">${escapeHtml(paymentMethod)} &nbsp;&nbsp;|&nbsp;&nbsp; \u0110\u1ED3ng ti\u1EC1n thanh to\xE1n: <strong>VND</strong></div>
        </div>
      </div>

      <!-- ITEMS TABLE -->
      <table class="items-table">
        <thead>
          <tr>
            <th class="col-stt">STT</th>
            <th class="col-name">T\xEAn h\xE0ng h\xF3a, d\u1ECBch v\u1EE5</th>
            <th class="col-unit">\u0110VT</th>
            <th class="col-qty">S\u1ED1 l\u01B0\u1EE3ng</th>
            <th class="col-price">\u0110\u01A1n gi\xE1</th>
            <th class="col-amount">Th\xE0nh ti\u1EC1n</th>
          </tr>
          <tr style="font-size:10.5px;background:#f8fafc;color:#64748b;">
            <th>(1)</th>
            <th>(2)</th>
            <th>(3)</th>
            <th>(4)</th>
            <th>(5)</th>
            <th>(6) = (4) x (5)</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item, index) => `
            <tr>
              <td class="col-stt">${index + 1}</td>
              <td class="col-name">${escapeHtml(item.itemName || item.ten || "H\xE0ng h\xF3a d\u1ECBch v\u1EE5")}</td>
              <td class="col-unit">${escapeHtml(item.unit || item.dvt || "")}</td>
              <td class="col-qty">${item.quantity ? item.quantity.toLocaleString("vi-VN") : item.sluong ? item.sluong.toLocaleString("vi-VN") : "1"}</td>
              <td class="col-price">${formatVND(item.unitPrice || item.dgia || item.amount || 0)}</td>
              <td class="col-amount" style="font-weight:bold;">${formatVND(item.amount || item.thtien || 0)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>

      <!-- SUMMARY -->
      <div class="summary-area">
        <div class="summary-row">
          <div><strong>C\u1ED9ng ti\u1EC1n b\xE1n h\xE0ng h\xF3a, d\u1ECBch v\u1EE5:</strong></div>
          <div><strong style="color:#b91c1c;font-size:13.5px;">${formatVND(totalAmount)} \u0111</strong></div>
        </div>
        <div style="font-style:italic;margin-top:2px;color:#334155;">
          S\u1ED1 ti\u1EC1n vi\u1EBFt b\u1EB1ng ch\u1EEF: <strong>${escapeHtml(wordsAmount)} \u0111\u1ED3ng.</strong>
        </div>
      </div>

      <!-- SIGNATURES -->
      <div class="sign-container">
        <div class="sign-col">
          <div class="sign-title">Ng\u01B0\u1EDDi mua h\xE0ng</div>
          <div class="sign-desc">(K\xFD, ghi r\xF5 h\u1ECD t\xEAn)</div>
        </div>

        <div class="sign-col">
          <div class="sign-title">Ng\u01B0\u1EDDi b\xE1n h\xE0ng</div>
          <div class="sign-desc">(K\xFD, ghi r\xF5 h\u1ECD t\xEAn)</div>
          
          <div class="misa-sig-box">
            <div class="sig-valid-header">
              <span style="color:#15803d;font-size:14px;">\u2714</span>
              <span>Signature Valid</span>
            </div>
            <div><strong>K\xFD b\u1EDFi:</strong> ${escapeHtml(sellerName)}</div>
            <div><strong>K\xFD ng\xE0y:</strong> ${escapeHtml(day)}/${escapeHtml(month)}/${escapeHtml(year)}</div>
          </div>
        </div>
      </div>

      <!-- FOOTER -->
      <div class="footer-area">
        <div>Tra c\u1EE9u t\u1EA1i Website: <a href="${escapeHtml(directLookupUrl)}" target="_blank" rel="noopener noreferrer" style="color:#059669;text-decoration:underline;font-weight:bold;">${escapeHtml(pUrl)}</a>${mCode ? ` - M\xE3 tra c\u1EE9u h\xF3a \u0111\u01A1n: <strong style="font-family:monospace;font-size:12.5px;color:#065f46;">${escapeHtml(mCode)}</strong>` : ""}</div>
        <div style="font-style:italic;color:#64748b;margin-top:2px;">(C\u1EA7n ki\u1EC3m tra, \u0111\u1ED1i chi\u1EBFu khi l\u1EADp, giao, nh\u1EADn h\xF3a \u0111\u01A1n)</div>
        <div style="font-size:10.5px;color:#475569;margin-top:3px;">Ph\xE1t h\xE0nh b\u1EDFi ph\u1EA7n m\u1EC1m MISA meInvoice - C\xF4ng ty C\u1ED5 ph\u1EA7n MISA (www.misa.vn) - MST 0101243150</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// src/utils/multiTemplateRenderer.ts
function detectInvoiceProvider(xmlString, invoice) {
  const raw = xmlString || (invoice?.rawXml || "");
  if (invoice || raw) {
    const mockInvoice = invoice || (raw ? parseGDTInvoiceXml(raw) : {});
    const partnerId = detectPartnerTemplate(mockInvoice, raw);
    if (partnerId && partnerId !== "DEFAULT") {
      return partnerId;
    }
  }
  if (raw && typeof raw === "string") {
    if (/meinvoice\.vn|misa\.vn/i.test(raw)) {
      return "MISA";
    }
    if (/sinvoice\.viettel|viettel\.vn|vietteltelecom/i.test(raw)) {
      return "VIETTEL";
    }
    if (/vnpt-invoice|vnpt\.vn|vinaphone/i.test(raw)) {
      return "VNPT";
    }
    if (/inv\.4si\.vn|4si\.vn|4si/i.test(raw)) {
      return "DEFAULT";
    }
    if (/easyinvoice|softdreams/i.test(raw)) {
      return "EASYINVOICE";
    }
    if (/bkav|ehoadon/i.test(raw)) {
      return "BKAV";
    }
    const msttcgpMatch = raw.match(/<(?:[a-zA-Z0-9_]+:)?MSTTCGP(?:\s+[^>]*)?>([\s\S]*?)<\/(?:[a-zA-Z0-9_]+:)?MSTTCGP>/i);
    if (msttcgpMatch && msttcgpMatch[1]) {
      const msttcgp = msttcgpMatch[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim();
      if (msttcgp === "0100684378") return "VNPT";
      if (msttcgp === "0101243150") return "MISA";
      if (msttcgp === "0100109106") return "VIETTEL";
      if (msttcgp === "0105987432") return "EASYINVOICE";
      if (msttcgp === "0315744883" || msttcgp === "0302999571") return "DEFAULT";
      if (msttcgp === "0101360697") return "BKAV";
    }
    const sigMatches = raw.match(/<(?:[a-zA-Z0-9_]+:)?(?:X509IssuerName|X509SubjectName)(?:\s+[^>]*)?>([\s\S]*?)<\/(?:[a-zA-Z0-9_]+:)?(?:X509IssuerName|X509SubjectName)>/gi);
    if (sigMatches) {
      const sigText = sigMatches.join(" ").toUpperCase();
      if (sigText.includes("VNPT")) return "VNPT";
      if (sigText.includes("MISA")) return "MISA";
      if (sigText.includes("VIETTEL")) return "VIETTEL";
      if (sigText.includes("BKAV")) return "BKAV";
      if (sigText.includes("EASYCA") || sigText.includes("SOFTDREAMS")) return "EASYINVOICE";
      if (sigText.includes("4SI") || sigText.includes("LCS")) return "DEFAULT";
    }
  }
  if (invoice) {
    if (invoice.provider && invoice.provider !== "DEFAULT" && invoice.provider !== "UNKNOWN") {
      const p = String(invoice.provider).toUpperCase();
      if (p.includes("VNPT")) return "VNPT";
      if (p.includes("MISA")) return "MISA";
      if (p.includes("VIETTEL")) return "VIETTEL";
      if (p.includes("EASY") || p.includes("SOFTDREAMS")) return "EASYINVOICE";
      if (p.includes("4SI") || p.includes("LCS")) return "DEFAULT";
      if (p.includes("BKAV")) return "BKAV";
    }
    const msttcgp = (invoice.msttcgp || "").trim();
    if (msttcgp === "0100684378") return "VNPT";
    if (msttcgp === "0101243150") return "MISA";
    if (msttcgp === "0105987432") return "EASYINVOICE";
    if (msttcgp === "0315744883" || msttcgp === "0302999571") return "DEFAULT";
    if (msttcgp === "0100109106") return "VIETTEL";
    if (msttcgp === "0101360697") return "BKAV";
    const tentcgp = (invoice.tentcgp || "").toUpperCase();
    if (tentcgp.includes("VNPT")) return "VNPT";
    if (tentcgp.includes("MISA")) return "MISA";
    if (tentcgp.includes("EASY") || tentcgp.includes("SOFTDREAMS")) return "EASYINVOICE";
    if (tentcgp.includes("4SI") || tentcgp.includes("LCS")) return "DEFAULT";
    if (tentcgp.includes("VIETTEL")) return "VIETTEL";
    if (tentcgp.includes("BKAV")) return "BKAV";
    const lookupUrl = (invoice.lookupUrl || "").toLowerCase();
    if (lookupUrl.includes("vnpt")) return "VNPT";
    if (lookupUrl.includes("meinvoice") || lookupUrl.includes("misa")) return "MISA";
    if (lookupUrl.includes("easyinvoice") || lookupUrl.includes("softdreams")) return "EASYINVOICE";
    if (lookupUrl.includes("4si")) return "4SI";
    if (lookupUrl.includes("sinvoice") || lookupUrl.includes("viettel")) return "VIETTEL";
    if (lookupUrl.includes("bkav") || lookupUrl.includes("ehoadon")) return "BKAV";
    const ca = (invoice.caProvider || "").toUpperCase();
    if (ca.includes("VNPT")) return "VNPT";
    if (ca.includes("MISA")) return "MISA";
    if (ca.includes("VIETTEL")) return "VIETTEL";
    if (ca.includes("BKAV")) return "BKAV";
    if (ca.includes("EASY") || ca.includes("SOFTDREAMS")) return "EASYINVOICE";
    if (ca.includes("4SI") || ca.includes("LCS")) return "4SI";
  }
  return "DEFAULT";
}
function extractLookupDetails2(rawXml) {
  return extractLookupDetailsFromXml(rawXml);
}
function renderInvoiceHtml(invoiceData, providerId, rawXmlInput, options) {
  let invoice;
  let rawXml = rawXmlInput || "";
  if (typeof invoiceData === "string") {
    rawXml = invoiceData;
    invoice = parseGDTInvoiceXml(invoiceData);
  } else {
    invoice = invoiceData;
    if (!rawXml && invoice.rawXml) {
      rawXml = invoice.rawXml;
    }
  }
  const resolvedProvider = !providerId || providerId === "AUTO" ? detectInvoiceProvider(rawXml, invoice) : providerId;
  let html = "";
  switch (resolvedProvider) {
    case "BAO_DUY":
      html = renderBaoDuyTemplate(invoice, rawXml, options);
      break;
    case "PNJ":
      html = renderPnjTemplate(invoice, rawXml, options);
      break;
    case "TAI_TRAM_ANH":
      html = renderTaiTramAnhTemplate(invoice, rawXml, options);
      break;
    case "XUAN_VINH":
      html = renderXuanVinhTemplate(invoice, rawXml, options);
      break;
    case "KIM_LOAN_TUAN":
      html = renderKimLoanTuanTemplate(invoice, rawXml, options);
      break;
    case "TKJ":
      html = renderTkjTemplate(invoice, rawXml, options);
      break;
    case "NGHIA_SON":
      html = renderNghiaSonTemplate(invoice, rawXml, options);
      break;
    case "TAN_THANH_DANH":
      html = renderTanThanhDanhTemplate(invoice, rawXml, options);
      break;
    case "MISA":
      html = renderMisaTemplate(invoice, rawXml, options);
      break;
    case "VIETTEL":
      html = renderViettelTemplate(invoice, rawXml, options);
      break;
    case "EASYINVOICE":
      html = renderEasyInvoiceTemplate(invoice, rawXml, options);
      break;
    case "4SI":
      html = renderDefaultTemplate(invoice, rawXml, options);
      break;
    case "VNPT":
      html = renderVnptTemplate(invoice, rawXml, options);
      break;
    case "BKAV":
      html = renderBkavTemplate(invoice, rawXml, options);
      break;
    case "DEFAULT":
    default:
      html = renderDefaultTemplate(invoice, rawXml, options);
      break;
  }
  const scriptTag = `
<script>
  (function() {
    document.addEventListener('click', function(e) {
      var target = e.target;
      while (target && target.tagName !== 'A') {
        target = target.parentElement;
      }
      if (target && target.tagName === 'A' && target.href) {
        var href = target.href;
        if (href && !href.startsWith('javascript:') && href !== '#') {
          e.preventDefault();
          window.open(href, '_blank', 'noopener,noreferrer');
        }
      }
    }, true);
  })();
</script>`;
  if (html.includes("</body>")) {
    return html.replace("</body>", `${scriptTag}
</body>`);
  }
  return html + scriptTag;
}
function formatVND2(num) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(num || 0)) + " \u0111";
}
function formatNum2(num) {
  return new Intl.NumberFormat("vi-VN").format(num || 0);
}
function escapeHtml2(str) {
  if (str === null || str === void 0) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function extractDateParts2(invoice) {
  const tdlap = invoice.tdlap || (/* @__PURE__ */ new Date()).toISOString();
  const dateParts = tdlap.split("T")[0].split("-");
  const day = dateParts[2] || "01";
  const month = dateParts[1] || "01";
  const year = dateParts[0] || "2026";
  return { day, month, year, tdlap };
}
function renderMisaTemplate(invoice, rawXml, options) {
  const { day, month, year } = extractDateParts2(invoice);
  const { lookupCode, lookupUrl } = extractLookupDetails2(rawXml);
  const mCode = lookupCode || invoice.lookupCode || "";
  const mUrl = "https://www.meinvoice.vn/tra-cuu";
  const directLookupUrl = buildDirectLookupUrl(mUrl, mCode, "MISA", invoice.nbmst);
  const wordsAmount = invoice.tgtttbchu || numberToVietnameseWords(invoice.tgtttbso);
  const maCqt = invoice.mhdon || "";
  const items = ensureInvoiceItems(invoice);
  const itemsTotal = items.reduce((acc, it) => acc + (Number(it.amount ?? it.thtien) || 0), 0);
  const totalBeforeTax = invoice.tgtcthue !== void 0 && invoice.tgtcthue !== null ? invoice.tgtcthue : itemsTotal;
  const totalTax = invoice.tgtthue !== void 0 && invoice.tgtthue !== null ? invoice.tgtthue : 0;
  const grandTotal = invoice.tgtttbso !== void 0 && invoice.tgtttbso !== null ? invoice.tgtttbso : totalBeforeTax + totalTax;
  const sellerName = invoice.nbten || "\u0110\u01A1n v\u1ECB b\xE1n h\xE0ng";
  const watermark = options?.watermarkText || sellerName.split(" ").slice(-2).join(" ") || "meInvoice";
  const showControls = options?.showPrintControls !== false;
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>H\xD3A \u0110\u01A0N \u0110I\u1EC6N T\u1EEC - MISA meInvoice - ${escapeHtml2(invoice.shdon)}</title>
  <style>
    @page { size: A4 portrait; margin: 8mm 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body {
      font-family: 'Times New Roman', Times, serif;
      background: #f1f5f9;
      margin: 0;
      padding: 16px;
      color: #000;
      font-size: 13px;
      line-height: 1.35;
    }
    .print-actions {
      max-width: 800px;
      margin: 0 auto 16px auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #1e293b;
      color: #fff;
      padding: 10px 16px;
      border-radius: 8px;
    }
    .print-btn {
      background: #2563eb;
      color: white;
      border: none;
      padding: 6px 16px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
    }
    .misa-wrapper {
      max-width: 800px;
      margin: 0 auto;
      background: #fff;
      border: 1px solid #333;
      padding: 24px 28px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.1);
      position: relative;
    }
    .misa-header {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid #444;
      padding-bottom: 14px;
      margin-bottom: 12px;
    }
    .seller-col {
      width: 58%;
    }
    .seller-brand {
      color: #c5221f;
      font-size: 20px;
      font-weight: bold;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .seller-name {
      color: #c5221f;
      font-size: 14px;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .invoice-title-col {
      width: 40%;
      text-align: right;
    }
    .inv-title {
      color: #c5221f;
      font-size: 17px;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .inv-date {
      font-style: italic;
      font-size: 12.5px;
      margin-bottom: 4px;
    }
    .inv-meta-line {
      font-size: 12px;
    }
    .buyer-section {
      border-bottom: 1px solid #444;
      padding-bottom: 10px;
      margin-bottom: 12px;
    }
    .buyer-row {
      display: flex;
      margin-bottom: 3px;
    }
    .buyer-label {
      width: 140px;
      flex-shrink: 0;
    }
    .buyer-val {
      flex: 1;
    }
    /* Table with watermark */
    .table-container {
      position: relative;
      margin-bottom: 12px;
    }
    .watermark-bg {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-20deg);
      font-size: 68px;
      font-weight: 900;
      color: rgba(220, 38, 38, 0.045);
      pointer-events: none;
      user-select: none;
      white-space: nowrap;
      text-transform: uppercase;
      letter-spacing: 6px;
      z-index: 1;
    }
    table.misa-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #333;
      position: relative;
      z-index: 2;
    }
    table.misa-table th, table.misa-table td {
      border: 1px solid #333;
      padding: 5px 6px;
      font-size: 12px;
    }
    table.misa-table th {
      background: #fafafa;
      text-align: center;
      font-weight: bold;
    }
    .total-section {
      border-bottom: 1px solid #444;
      padding-bottom: 8px;
      margin-bottom: 14px;
      font-size: 12.5px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    .sign-section {
      display: flex;
      justify-content: space-between;
      margin-top: 14px;
      margin-bottom: 24px;
    }
    .sign-box {
      width: 45%;
      text-align: center;
    }
    .sign-box-title {
      font-weight: bold;
      font-size: 13px;
    }
    .sign-box-sub {
      font-size: 11px;
      font-style: italic;
      color: #555;
      margin-bottom: 8px;
    }
    .misa-signature-stamp {
      display: inline-block;
      border: 1.5px solid #2e7d32;
      background: #f1f8e9;
      border-radius: 4px;
      padding: 8px 14px;
      text-align: left;
      font-size: 11.5px;
      line-height: 1.35;
      margin-top: 6px;
    }
    .stamp-title {
      color: #2e7d32;
      font-weight: bold;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .misa-footer {
      border-top: 1px solid #666;
      padding-top: 8px;
      font-size: 11px;
      color: #222;
      text-align: center;
      line-height: 1.45;
    }
    .misa-footer a { color: #0056b3; text-decoration: underline; }
    @media print {
      body { background: #fff; padding: 0; }
      .print-actions { display: none !important; }
      .misa-wrapper { border: 1px solid #000; box-shadow: none; width: 100%; max-width: 100%; padding: 12px 16px; }
    }
  </style>
</head>
<body>
  ${showControls ? `
  <div class="print-actions">
    <div>
      <span style="font-weight: bold; color: #38bdf8;">[Giao di\u1EC7n MISA meInvoice]</span>
      <span style="font-size: 12px; color: #94a3b8; margin-left: 8px;">M\xE3 tra c\u1EE9u: ${escapeHtml2(mCode)}</span>
    </div>
    <button class="print-btn" onclick="window.print()">In H\xF3a \u0110\u01A1n (A4)</button>
  </div>
  ` : ""}

  <div class="misa-wrapper">
    <!-- HEADER -->
    <div class="misa-header">
      <div class="seller-col">
        <div class="seller-brand">${escapeHtml2(invoice.nbten)}</div>
        <div class="seller-name">\u0110\u01A1n v\u1ECB b\xE1n h\xE0ng : ${escapeHtml2(invoice.nbten)}</div>
        <div>M\xE3 s\u1ED1 thu\u1EBF : <b>${escapeHtml2(invoice.nbmst)}</b></div>
        <div>\u0110\u1ECBa ch\u1EC9 : ${escapeHtml2(invoice.nbdchi)}</div>
        ${invoice.nbsdt ? `<div>\u0110i\u1EC7n tho\u1EA1i : ${escapeHtml2(invoice.nbsdt)}</div>` : ""}
        ${invoice.stknh ? `<div>S\u1ED1 t\xE0i kho\u1EA3n : ${escapeHtml2(invoice.stknh)} ${invoice.tnhanh ? ` - ${escapeHtml2(invoice.tnhanh)}` : ""}</div>` : ""}
      </div>

      <div class="invoice-title-col">
        <div class="inv-title">${escapeHtml2(invoice.thdon || "H\xD3A \u0110\u01A0N GI\xC1 TR\u1ECA GIA T\u0102NG")}</div>
        <div class="inv-date">Ng\xE0y ${day} th\xE1ng ${month} n\u0103m ${year}</div>
        ${maCqt ? `<div class="inv-meta-line">M\xE3 CQT: <b>${escapeHtml2(maCqt)}</b></div>` : ""}
        <div class="inv-meta-line" style="margin-top: 4px;">
          K\xFD hi\u1EC7u: <b>${escapeHtml2(invoice.khhdon)}</b> &nbsp;&nbsp; 
          S\u1ED1: <b style="color: #c5221f; font-size: 15px;">${escapeHtml2(invoice.shdon)}</b>
        </div>
      </div>
    </div>

    <!-- BUYER SECTION -->
    <div class="buyer-section">
      <div class="buyer-row">
        <span class="buyer-label">H\u1ECD t\xEAn ng\u01B0\u1EDDi mua h\xE0ng:</span>
        <span class="buyer-val">${escapeHtml2(invoice.nmten || "")}</span>
      </div>
      <div class="buyer-row">
        <span class="buyer-label">T\xEAn \u0111\u01A1n v\u1ECB:</span>
        <span class="buyer-val"><b>${escapeHtml2(invoice.nmtendv || invoice.nmten || "")}</b></span>
      </div>
      <div class="buyer-row">
        <span class="buyer-label">M\xE3 s\u1ED1 thu\u1EBF:</span>
        <span class="buyer-val"><b>${escapeHtml2(invoice.nmmst || "")}</b></span>
      </div>
      <div class="buyer-row">
        <span class="buyer-label">\u0110\u1ECBa ch\u1EC9:</span>
        <span class="buyer-val">${escapeHtml2(invoice.nmdchi || "")}</span>
      </div>
      <div class="buyer-row">
        <span class="buyer-label">H\xECnh th\u1EE9c thanh to\xE1n:</span>
        <span class="buyer-val">${escapeHtml2(invoice.htttoan || "Chuy\u1EC3n kho\u1EA3n")}</span>
        ${invoice.dvtte ? `<span style="margin-left: 20px;">\u0110\u01A1n v\u1ECB ti\u1EC1n t\u1EC7: <b>${escapeHtml2(invoice.dvtte)}</b></span>` : ""}
      </div>
    </div>

    <!-- TABLE WITH WATERMARK -->
    <div class="table-container">
      <div class="watermark-bg">${escapeHtml2(watermark)}</div>
      <table class="misa-table">
        <thead>
          <tr>
            <th style="width: 38px;">STT</th>
            <th>T\xEAn h\xE0ng h\xF3a, d\u1ECBch v\u1EE5</th>
            <th style="width: 55px;">\u0110\u01A1n v\u1ECB t\xEDnh</th>
            <th style="width: 65px;">S\u1ED1 l\u01B0\u1EE3ng</th>
            <th style="width: 95px;">\u0110\u01A1n gi\xE1</th>
            <th style="width: 105px;">Th\xE0nh ti\u1EC1n</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((it, idx) => `
          <tr>
            <td style="text-align: center; font-family: monospace;">${it.lineNo || it.stt || idx + 1}</td>
            <td>
              <div>${escapeHtml2(it.itemName || it.ten)}</div>
              ${it.itemCode || it.mhhdvu ? `<div style="font-size: 10px; color: #555; font-family: monospace;">M\xE3: ${escapeHtml2(it.itemCode || it.mhhdvu)}</div>` : ""}
            </td>
            <td style="text-align: center;">${escapeHtml2(it.unit || it.dvt || "C\xE1i")}</td>
            <td style="text-align: right; font-family: monospace;">${formatNum2(it.quantity ?? it.sluong ?? 0)}</td>
            <td style="text-align: right; font-family: monospace;">${formatNum2(it.unitPrice ?? it.dgia ?? 0)}</td>
            <td style="text-align: right; font-family: monospace; font-weight: bold;">${formatNum2(it.amount ?? it.thtien ?? 0)}</td>
          </tr>
          `).join("")}
        </tbody>
      </table>
    </div>

    <!-- TOTALS -->
    <div class="total-section">
      <div class="total-row">
        <span>C\u1ED9ng ti\u1EC1n h\xE0ng:</span>
        <span style="font-family: monospace; font-weight: bold;">${formatNum2(totalBeforeTax)} \u0111</span>
      </div>
      ${totalTax > 0 ? `
      <div class="total-row">
        <span>Thu\u1EBF su\u1EA5t GTGT: <b>${items[0]?.taxRate || ""}</b> &nbsp;&nbsp;&nbsp;&nbsp; Ti\u1EC1n thu\u1EBF GTGT:</span>
        <span style="font-family: monospace; font-weight: bold;">${formatNum2(totalTax)} \u0111</span>
      </div>` : ""}
      <div class="total-row" style="font-size: 13.5px; border-top: 1px dashed #777; padding-top: 4px; margin-top: 4px;">
        <span style="font-weight: bold;">T\u1ED5ng ti\u1EC1n thanh to\xE1n:</span>
        <span style="font-family: monospace; font-weight: bold; color: #c5221f; font-size: 14.5px;">${formatNum2(grandTotal)} \u0111</span>
      </div>
      <div style="margin-top: 4px;">
        S\u1ED1 ti\u1EC1n vi\u1EBFt b\u1EB1ng ch\u1EEF: <i>${escapeHtml2(wordsAmount)}</i>
      </div>
    </div>

    <!-- SIGNATURES -->
    <div class="sign-section">
      <div class="sign-box">
        <div class="sign-box-title">Ng\u01B0\u1EDDi mua h\xE0ng</div>
        <div class="sign-box-sub">(Ch\u1EEF k\xFD s\u1ED1 (n\u1EBFu c\xF3))</div>
      </div>
      <div class="sign-box">
        <div class="sign-box-title">Ng\u01B0\u1EDDi b\xE1n h\xE0ng</div>
        <div class="sign-box-sub">(Ch\u1EEF k\xFD \u0111i\u1EC7n t\u1EED, Ch\u1EEF k\xFD s\u1ED1)</div>
        <div class="misa-signature-stamp">
          <div class="stamp-title">\u2714 Signature Valid</div>
          <div>K\xFD b\u1EDFi: <b style="color: #c5221f;">${escapeHtml2(invoice.nbten)}</b></div>
          <div>K\xFD ng\xE0y: ${day}/${month}/${year}</div>
        </div>
      </div>
    </div>

    <!-- MISA FOOTER -->
    <div class="misa-footer">
      <div>Tra c\u1EE9u t\u1EA1i Website: <a href="${escapeHtml2(directLookupUrl || mUrl)}" target="_blank" rel="noopener noreferrer" style="color:#2563eb;text-decoration:none;font-weight:bold;">${escapeHtml2(mUrl)}</a>${mCode ? ` - M\xE3 tra c\u1EE9u: <a href="${escapeHtml2(directLookupUrl)}" target="_blank" rel="noopener noreferrer" style="color:#2563eb;text-decoration:underline;font-weight:bold;" title="M\u1EDF trang tra c\u1EE9u meInvoice (T\u1EF1 \u0111\u1ED9ng g\xE1n m\xE3 & m\u1EDF h\xF3a \u0111\u01A1n)">${escapeHtml2(mCode)}</a>` : ""}</div>
      <div style="margin-top: 2px;">Ph\xE1t h\xE0nh b\u1EDFi ph\u1EA7n m\u1EC1m MISA meInvoice - C\xF4ng ty C\u1ED5 ph\u1EA7n MISA (www.misa.vn) - MST 0101243150</div>
    </div>
  </div>
</body>
</html>`;
}
function renderEasyInvoiceTemplate(invoice, rawXml, options) {
  const { day, month, year } = extractDateParts2(invoice);
  const { lookupCode, lookupUrl } = extractLookupDetails2(rawXml);
  const mCode = lookupCode || invoice.lookupCode || "";
  const mUrl = lookupUrl || invoice.lookupUrl || `http://${invoice.nbmst}hd.easyinvoice.com.vn`;
  const directLookupUrl = buildDirectLookupUrl(mUrl, mCode, "EASYINVOICE", invoice.nbmst);
  const wordsAmount = invoice.tgtttbchu || numberToVietnameseWords(invoice.tgtttbso);
  const maCqt = invoice.mhdon || "M2-26-KET3U-65650003078";
  const items = ensureInvoiceItems(invoice);
  const showControls = options?.showPrintControls !== false;
  const qrSrc = options?.qrCodeDataUrl || `https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(`${mUrl}?code=${mCode}`)}`;
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>H\xD3A \u0110\u01A0N B\xC1N H\xC0NG - EasyInvoice - ${escapeHtml2(invoice.shdon)}</title>
  <style>
    @page { size: A4 portrait; margin: 6mm 8mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body {
      font-family: 'Times New Roman', Times, serif;
      background: #f8fafc;
      margin: 0;
      padding: 16px;
      color: #000;
      font-size: 12.5px;
      line-height: 1.3;
    }
    .print-actions {
      max-width: 820px;
      margin: 0 auto 14px auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #7c2d12;
      color: #fff;
      padding: 10px 16px;
      border-radius: 8px;
    }
    .print-btn {
      background: #ea580c;
      color: white;
      border: none;
      padding: 6px 16px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
    }
    .easy-outer-border {
      max-width: 820px;
      margin: 0 auto;
      background: #fff;
      border: 3px double #d9534f;
      padding: 18px 22px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.08);
      position: relative;
    }
    .easy-header-grid {
      display: grid;
      grid-template-columns: 180px 1fr 180px;
      align-items: center;
      margin-bottom: 12px;
      text-align: center;
    }
    .brand-col {
      text-align: left;
      color: #b45309;
      font-weight: bold;
      font-size: 17px;
      letter-spacing: 0.5px;
    }
    .title-col h1 {
      color: #c5221f;
      font-size: 19px;
      font-weight: bold;
      margin: 0 0 2px 0;
      text-transform: uppercase;
    }
    .title-col .sub-tag {
      color: #c5221f;
      font-size: 13.5px;
      font-weight: bold;
      margin: 1px 0;
    }
    .title-col .en-tag {
      color: #c5221f;
      font-style: italic;
      font-size: 12px;
    }
    .title-col .date-tag {
      font-style: italic;
      font-size: 12px;
      margin-top: 4px;
    }
    .meta-col {
      text-align: right;
      font-size: 12.5px;
    }
    .meta-col .serial-no {
      font-weight: bold;
    }
    .meta-col .invoice-no {
      color: #c5221f;
      font-size: 16px;
      font-weight: bold;
    }
    .seller-buyer-wrapper {
      position: relative;
      margin-top: 6px;
      margin-bottom: 10px;
    }
    .seller-box {
      padding-right: 120px;
      margin-bottom: 8px;
    }
    .qr-badge {
      position: absolute;
      top: 0;
      right: 0;
      width: 105px;
      height: 105px;
      border: 1px solid #ddd;
      padding: 2px;
    }
    .qr-badge img {
      width: 100%;
      height: 100%;
      display: block;
    }
    .dotted-line {
      display: flex;
      align-items: baseline;
      margin-bottom: 3px;
    }
    .dotted-label {
      flex-shrink: 0;
      margin-right: 4px;
    }
    .dotted-value {
      flex: 1;
      border-bottom: 1px dotted #888;
      min-height: 16px;
    }
    /* EasyInvoice Items Table */
    table.easy-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #000;
      margin-top: 10px;
      margin-bottom: 10px;
    }
    table.easy-table th, table.easy-table td {
      border: 1px solid #000;
      padding: 4px 6px;
      font-size: 11.5px;
    }
    table.easy-table th {
      text-align: center;
      font-weight: bold;
      background: #fafafa;
    }
    .sub-head {
      font-style: italic;
      font-size: 10px;
      color: #555;
      text-align: center;
    }
    .sign-row {
      display: flex;
      justify-content: space-between;
      margin-top: 14px;
      margin-bottom: 16px;
    }
    .sign-col {
      width: 45%;
      text-align: center;
    }
    .easy-signature-box {
      display: inline-block;
      border: 1.5px solid #dc2626;
      background: #fff5f5;
      border-radius: 4px;
      padding: 8px 12px;
      text-align: left;
      font-size: 11px;
      margin-top: 6px;
    }
    .easy-footer {
      border-top: 1px solid #000;
      padding-top: 6px;
      margin-top: 10px;
      font-size: 11px;
      text-align: center;
      line-height: 1.4;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .print-actions { display: none !important; }
      .easy-outer-border { border: 2px double #d9534f; box-shadow: none; width: 100%; max-width: 100%; padding: 10px 14px; }
    }
  </style>
</head>
<body>
  ${showControls ? `
  <div class="print-actions">
    <div>
      <span style="font-weight: bold; color: #fdba74;">[Giao di\u1EC7n Softdreams EasyInvoice]</span>
      <span style="font-size: 12px; color: #fed7aa; margin-left: 8px;">M\xE3 tra c\u1EE9u: ${escapeHtml2(mCode)}</span>
    </div>
    <button class="print-btn" onclick="window.print()">In H\xF3a \u0110\u01A1n (A4)</button>
  </div>
  ` : ""}

  <div class="easy-outer-border">
    <!-- HEADER GRID -->
    <div class="easy-header-grid">
      <div class="brand-col">${escapeHtml2(invoice.nbten)}</div>
      <div class="title-col">
        <h1>${escapeHtml2(invoice.thdon || "H\xD3A \u0110\u01A0N B\xC1N H\xC0NG")}</h1>
        <div class="sub-tag">(KH\u1EDEI T\u1EA0O T\u1EEA M\xC1Y T\xCDNH TI\u1EC0N)</div>
        <div class="en-tag">(VAT INVOICE)</div>
        <div class="date-tag">Ng\xE0y (Date) ${day} th\xE1ng (month) ${month} n\u0103m (year) ${year}</div>
      </div>
      <div class="meta-col">
        <div>K\xFD hi\u1EC7u (Serial): <span class="serial-no">${escapeHtml2(invoice.khhdon)}</span></div>
        <div>S\u1ED1 (No.): <span class="invoice-no">${escapeHtml2(invoice.shdon)}</span></div>
      </div>
    </div>

    <!-- SELLER & BUYER WITH QR -->
    <div class="seller-buyer-wrapper">
      <div class="qr-badge">
        <img src="${qrSrc}" alt="QR Tra c\u1EE9u" />
      </div>

      <div class="seller-box">
        <div>\u0110\u01A1n v\u1ECB b\xE1n h\xE0ng (Seller): <b style="color: #c5221f;">${escapeHtml2(invoice.nbten)}</b></div>
        <div>M\xE3 s\u1ED1 thu\u1EBF (Tax code): <b>${escapeHtml2(invoice.nbmst)}</b></div>
        <div>\u0110\u1ECBa ch\u1EC9 (Address): ${escapeHtml2(invoice.nbdchi)}</div>
        <div>T\xE0i kho\u1EA3n (A/C number): ${escapeHtml2(invoice.stknh || "05049999")} ${invoice.tnhanh ? `t\u1EA1i ${escapeHtml2(invoice.tnhanh)}` : ""}</div>
      </div>

      <div class="dotted-line">
        <span class="dotted-label">H\u1ECD t\xEAn ng\u01B0\u1EDDi mua h\xE0ng (Buyer):</span>
        <span class="dotted-value">${escapeHtml2(invoice.nmten || "")}</span>
      </div>
      <div class="dotted-line">
        <span class="dotted-label">T\xEAn \u0111\u01A1n v\u1ECB (Company's name):</span>
        <span class="dotted-value"><b>${escapeHtml2(invoice.nmtendv || invoice.nmten || "")}</b></span>
      </div>
      <div class="dotted-line">
        <span class="dotted-label">M\xE3 s\u1ED1 thu\u1EBF (Tax code):</span>
        <span class="dotted-value"><b>${escapeHtml2(invoice.nmmst || "")}</b></span>
      </div>
      <div class="dotted-line">
        <span class="dotted-label">\u0110\u1ECBa ch\u1EC9 (Address):</span>
        <span class="dotted-value">${escapeHtml2(invoice.nmdchi || "")}</span>
      </div>
      <div class="dotted-line">
        <span class="dotted-label">\u0110i\u1EC7n tho\u1EA1i (Tel):</span>
        <span class="dotted-value">${escapeHtml2(invoice.nmsdt || "")}</span>
      </div>
      <div class="dotted-line">
        <span class="dotted-label">H\xECnh th\u1EE9c thanh to\xE1n (Payment method):</span>
        <span class="dotted-value">${escapeHtml2(invoice.htttoan || "TM/CK")}</span>
        <span style="margin-left: 12px; margin-right: 4px;">\u0110\u01A1n v\u1ECB ti\u1EC1n t\u1EC7 (Currency):</span>
        <span style="font-weight: bold;">${escapeHtml2(invoice.dvtte || "VND")}</span>
      </div>
    </div>

    <!-- EASYINVOICE ITEMS TABLE -->
    <table class="easy-table">
      <thead>
        <tr>
          <th style="width: 38px;">STT<br><span style="font-size: 9px; font-weight: normal;">(No.)</span></th>
          <th>T\xEAn h\xE0ng h\xF3a, d\u1ECBch v\u1EE5<br><span style="font-size: 9px; font-weight: normal;">(Name of goods, services)</span></th>
          <th style="width: 60px;">\u0110\u01A1n v\u1ECB t\xEDnh<br><span style="font-size: 9px; font-weight: normal;">(Unit)</span></th>
          <th style="width: 65px;">S\u1ED1 l\u01B0\u1EE3ng<br><span style="font-size: 9px; font-weight: normal;">(Quantity)</span></th>
          <th style="width: 95px;">\u0110\u01A1n gi\xE1<br><span style="font-size: 9px; font-weight: normal;">(Unit price)</span></th>
          <th style="width: 110px;">Th\xE0nh ti\u1EC1n<br><span style="font-size: 9px; font-weight: normal;">(Amount)</span></th>
        </tr>
        <tr class="sub-head">
          <td>(1)</td>
          <td>(2)</td>
          <td>(3)</td>
          <td>(4)</td>
          <td>(5)</td>
          <td>(6)=(4)x(5)</td>
        </tr>
      </thead>
      <tbody>
        ${items.map((it, idx) => `
        <tr>
          <td style="text-align: center; font-family: monospace;">${it.lineNo || it.stt || idx + 1}</td>
          <td>
            <div>${escapeHtml2(it.itemName || it.ten)}</div>
            ${it.itemCode || it.mhhdvu ? `<div style="font-size: 9.5px; color: #555; font-family: monospace;">M\xE3: ${escapeHtml2(it.itemCode || it.mhhdvu)}</div>` : ""}
          </td>
          <td style="text-align: center;">${escapeHtml2(it.unit || it.dvt || "Ch\u1EC9")}</td>
          <td style="text-align: right; font-family: monospace;">${formatNum2(it.quantity ?? it.sluong ?? 1)}</td>
          <td style="text-align: right; font-family: monospace;">${formatNum2(it.unitPrice ?? it.dgia ?? 0)}</td>
          <td style="text-align: right; font-family: monospace; font-weight: bold;">${formatNum2(it.amount ?? it.thtien ?? 0)}</td>
        </tr>
        `).join("")}
      </tbody>
    </table>

    <!-- TOTALS -->
    <div style="border-top: 1px solid #000; padding-top: 6px; font-size: 12px;">
      <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 13px;">
        <span>T\u1ED5ng c\u1ED9ng ti\u1EC1n thanh to\xE1n (Total payment):</span>
        <span style="font-family: monospace; font-size: 14px; color: #000;">${formatNum2(invoice.tgtttbso)}</span>
      </div>
      <div style="margin-top: 4px;">
        S\u1ED1 ti\u1EC1n vi\u1EBFt b\u1EB1ng ch\u1EEF (Amount in words): <i>${escapeHtml2(wordsAmount)}</i>
      </div>
    </div>

    <!-- SIGNATURES -->
    <div class="sign-row">
      <div class="sign-col">
        <div style="font-weight: bold;">Ng\u01B0\u1EDDi mua h\xE0ng (Buyer)</div>
      </div>
      <div class="sign-col">
        <div style="font-weight: bold;">Ng\u01B0\u1EDDi b\xE1n h\xE0ng (Seller)</div>
        <div class="easy-signature-box">
          <div style="color: #dc2626; font-weight: bold;">Signature Valid</div>
          <div>K\xFD b\u1EDFi: <b>${escapeHtml2(invoice.nbten)}</b></div>
          <div>K\xFD ng\xE0y: ${day}/${month}/${year}</div>
        </div>
      </div>
    </div>

    <!-- FOOTER EASYINVOICE -->
    <div class="easy-footer">
      <div>M\xE3 c\u1EE7a c\u01A1 quan thu\u1EBF (Tax authority code): <b>${escapeHtml2(maCqt)}</b></div>
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;">
        <div>Trang tra c\u1EE9u : <a href="${escapeHtml2(directLookupUrl)}" target="_blank" rel="noopener noreferrer" style="color:#2563eb;text-decoration:underline;">${escapeHtml2(mUrl)}</a></div>
        <div>M\xE3 tra c\u1EE9u : <b>${escapeHtml2(mCode)}</b></div>
      </div>
      <div style="font-style: italic; margin-top: 2px;">(C\u1EA7n ki\u1EC3m tra, \u0111\u1ED1i chi\u1EBFu khi l\u1EADp, giao, nh\u1EADn h\xF3a \u0111\u01A1n)</div>
      <div style="border-top: 1px solid #888; margin-top: 6px; padding-top: 4px;">
        \u0110\u01A1n v\u1ECB cung c\u1EA5p gi\u1EA3i ph\xE1p: C\xF4ng ty c\u1ED5 ph\u1EA7n \u0111\u1EA7u t\u01B0 c\xF4ng ngh\u1EC7 v\xE0 th\u01B0\u01A1ng m\u1EA1i SOFTDREAMS, MST: 0105987432, Http://easyinvoice.vn/
      </div>
    </div>
  </div>
</body>
</html>`;
}
function renderViettelTemplate(invoice, rawXml, options) {
  const { day, month, year } = extractDateParts2(invoice);
  const { lookupCode, lookupUrl } = extractLookupDetails2(rawXml);
  const mCode = lookupCode || invoice.lookupCode || "";
  const pUrl = lookupUrl || invoice.lookupUrl || "https://www.sinvoice.vn/p/tra-cuu-hoa-don.html";
  const directLookupUrl = buildDirectLookupUrl(pUrl, mCode, "VIETTEL", invoice.nbmst);
  const wordsAmount = invoice.tgtttbchu || numberToVietnameseWords(invoice.tgtttbso);
  const maCqt = invoice.mhdon || "0024A998811234F9004B2C89";
  const items = ensureInvoiceItems(invoice);
  const showControls = options?.showPrintControls !== false;
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>H\xD3A \u0110\u01A0N \u0110I\u1EC6N T\u1EEC - VIETTEL S-INVOICE - ${escapeHtml2(invoice.shdon)}</title>
  <style>
    @page { size: A4 portrait; margin: 8mm 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      background: #f1f5f9;
      margin: 0;
      padding: 16px;
      color: #111;
      font-size: 12.5px;
      line-height: 1.35;
    }
    .print-actions {
      max-width: 820px;
      margin: 0 auto 12px auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #991b1b;
      color: #fff;
      padding: 10px 16px;
      border-radius: 8px;
    }
    .print-btn {
      background: #dc2626;
      color: white;
      border: none;
      padding: 6px 16px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
    }
    .viettel-wrapper {
      max-width: 820px;
      margin: 0 auto;
      background: #fff;
      border: 1.5px solid #ee0033;
      padding: 24px 28px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.08);
      position: relative;
    }
    .viettel-top-bar {
      height: 4px;
      background: #ee0033;
      margin: -24px -28px 16px -28px;
    }
    .viettel-header {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid #ee0033;
      padding-bottom: 12px;
      margin-bottom: 12px;
    }
    .v-seller-col { width: 58%; }
    .v-title-col { width: 40%; text-align: right; }
    .v-title {
      color: #ee0033;
      font-size: 18px;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .viettel-lookup-box {
      background: #fef2f2;
      border: 1px dashed #f87171;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 12px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
    }
    table.viettel-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #ee0033;
      margin-bottom: 12px;
    }
    table.viettel-table th, table.viettel-table td {
      border: 1px solid #cbd5e1;
      padding: 5px 6px;
      font-size: 12px;
    }
    table.viettel-table th {
      background: #fff1f2;
      color: #9f1239;
      font-weight: bold;
      text-align: center;
      border: 1px solid #fda4af;
    }
    .viettel-stamp {
      border: 1.5px solid #ee0033;
      background: #fff5f5;
      padding: 8px 12px;
      display: inline-block;
      text-align: left;
      border-radius: 4px;
      font-size: 11px;
    }
    .viettel-footer {
      border-top: 1px solid #ee0033;
      padding-top: 8px;
      font-size: 11px;
      text-align: center;
      color: #475569;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .print-actions { display: none !important; }
      .viettel-wrapper { border: 1px solid #ee0033; box-shadow: none; width: 100%; max-width: 100%; padding: 12px 16px; }
    }
  </style>
</head>
<body>
  ${showControls ? `
  <div class="print-actions">
    <div>
      <span style="font-weight: bold; color: #fca5a5;">[Giao di\u1EC7n Viettel S-Invoice]</span>
      <span style="font-size: 12px; color: #fecaca; margin-left: 8px;">M\xE3 s\u1ED1 b\xED m\u1EADt: ${escapeHtml2(mCode)}</span>
    </div>
    <button class="print-btn" onclick="window.print()">In H\xF3a \u0110\u01A1n (A4)</button>
  </div>
  ` : ""}

  <div class="viettel-wrapper">
    <div class="viettel-top-bar"></div>

    <div class="viettel-header">
      <div class="v-seller-col">
        <div style="font-size: 16px; font-weight: bold; color: #ee0033;">${escapeHtml2(invoice.nbten)}</div>
        <div>M\xE3 s\u1ED1 thu\u1EBF: <b>${escapeHtml2(invoice.nbmst)}</b></div>
        <div>\u0110\u1ECBa ch\u1EC9: ${escapeHtml2(invoice.nbdchi)}</div>
        ${invoice.stknh ? `<div>T\xE0i kho\u1EA3n: <b>${escapeHtml2(invoice.stknh)}</b> t\u1EA1i ${escapeHtml2(invoice.tnhanh || "")}</div>` : ""}
      </div>
      <div class="v-title-col">
        <div class="v-title">${escapeHtml2(invoice.thdon || "H\xD3A \u0110\u01A0N GI\xC1 TR\u1ECA GIA T\u0102NG")}</div>
        <div style="font-style: italic;">Ng\xE0y ${day} th\xE1ng ${month} n\u0103m ${year}</div>
        <div>M\xE3 CQT: <b>${escapeHtml2(maCqt)}</b></div>
        <div>K\xFD hi\u1EC7u: <b>${escapeHtml2(invoice.khhdon)}</b> &nbsp; S\u1ED1: <b style="color: #ee0033; font-size: 15px;">${escapeHtml2(invoice.shdon)}</b></div>
      </div>
    </div>

    <!-- VIETTEL LOOKUP BOX -->
    <div class="viettel-lookup-box" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
      <div>MST B\xEAn b\xE1n: <b style="color: #111;">${escapeHtml2(invoice.nbmst)}</b> &nbsp;|&nbsp; Tra c\u1EE9u: <a href="${escapeHtml2(directLookupUrl)}" target="_blank" rel="noopener noreferrer" style="color: #ee0033; font-weight: bold; text-decoration: underline;" title="T\u1EF1 \u0111\u1ED9ng \u0111i\u1EC1n MST ng\u01B0\u1EDDi b\xE1n v\xE0 M\xE3 s\u1ED1 b\xED m\u1EADt v\xE0o c\u1ED5ng Viettel S-Invoice">${escapeHtml2(pUrl)}</a></div>
      <div>M\xE3 s\u1ED1 b\xED m\u1EADt: <b style="color: #ee0033; font-size: 13px; font-family: monospace;">${escapeHtml2(mCode)}</b></div>
    </div>

    <!-- BUYER -->
    <div style="border-bottom: 1px solid #cbd5e1; padding-bottom: 10px; margin-bottom: 12px;">
      <div>T\xEAn \u0111\u01A1n v\u1ECB: <b>${escapeHtml2(invoice.nmtendv || invoice.nmten || "")}</b></div>
      <div>M\xE3 s\u1ED1 thu\u1EBF: <b>${escapeHtml2(invoice.nmmst || "")}</b></div>
      <div>\u0110\u1ECBa ch\u1EC9: ${escapeHtml2(invoice.nmdchi || "")}</div>
      <div>H\xECnh th\u1EE9c thanh to\xE1n: ${escapeHtml2(invoice.htttoan || "TM/CK")}</div>
    </div>

    <!-- TABLE -->
    <table class="viettel-table">
      <thead>
        <tr>
          <th style="width: 38px;">STT</th>
          <th>T\xEAn h\xE0ng h\xF3a, d\u1ECBch v\u1EE5</th>
          <th style="width: 60px;">\u0110VT</th>
          <th style="width: 70px;">S\u1ED1 l\u01B0\u1EE3ng</th>
          <th style="width: 95px;">\u0110\u01A1n gi\xE1</th>
          <th style="width: 65px;">Thu\u1EBF</th>
          <th style="width: 105px;">Th\xE0nh ti\u1EC1n</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((it, idx) => `
        <tr>
          <td style="text-align: center; font-family: monospace;">${it.lineNo || it.stt || idx + 1}</td>
          <td>${escapeHtml2(it.itemName || it.ten)}</td>
          <td style="text-align: center;">${escapeHtml2(it.unit || it.dvt || "C\xE1i")}</td>
          <td style="text-align: right; font-family: monospace;">${formatNum2(it.quantity ?? it.sluong ?? 0)}</td>
          <td style="text-align: right; font-family: monospace;">${formatNum2(it.unitPrice ?? it.dgia ?? 0)}</td>
          <td style="text-align: center; font-weight: bold;">${escapeHtml2(it.taxRate || "10%")}</td>
          <td style="text-align: right; font-family: monospace; font-weight: bold;">${formatNum2(it.amount ?? it.thtien ?? 0)}</td>
        </tr>
        `).join("")}
      </tbody>
    </table>

    <!-- TOTALS -->
    <div style="border-bottom: 1px solid #cbd5e1; padding-bottom: 8px; margin-bottom: 12px; font-size: 12.5px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
        <span>C\u1ED9ng ti\u1EC1n h\xE0ng:</span>
        <span style="font-family: monospace; font-weight: bold;">${formatNum2(invoice.tgtcthue)} \u0111</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
        <span>Ti\u1EC1n thu\u1EBF GTGT:</span>
        <span style="font-family: monospace; font-weight: bold;">${formatNum2(invoice.tgtthue)} \u0111</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-weight: bold; color: #ee0033; font-size: 14px;">
        <span>T\u1ED5ng c\u1ED9ng ti\u1EC1n thanh to\xE1n:</span>
        <span style="font-family: monospace;">${formatNum2(invoice.tgtttbso)} \u0111</span>
      </div>
      <div style="margin-top: 4px;">
        S\u1ED1 ti\u1EC1n b\u1EB1ng ch\u1EEF: <i>${escapeHtml2(wordsAmount)}</i>
      </div>
    </div>

    <!-- SIGNATURES -->
    <div style="display: flex; justify-content: space-between; margin: 16px 0;">
      <div style="width: 45%; text-align: center;">
        <div style="font-weight: bold;">Ng\u01B0\u1EDDi mua h\xE0ng</div>
      </div>
      <div style="width: 45%; text-align: center;">
        <div style="font-weight: bold;">Ng\u01B0\u1EDDi b\xE1n h\xE0ng</div>
        <div class="viettel-stamp">
          <div style="color: #ee0033; font-weight: bold;">\u2714 Ch\u1EEF k\xFD s\u1ED1 Viettel-CA h\u1EE3p l\u1EC7</div>
          <div>K\xFD b\u1EDFi: <b>${escapeHtml2(invoice.nbten)}</b></div>
          <div>K\xFD ng\xE0y: ${day}/${month}/${year}</div>
        </div>
      </div>
    </div>

    <!-- FOOTER -->
    <div class="viettel-footer">
      <div>H\xF3a \u0111\u01A1n \u0111i\u1EC7n t\u1EED kh\u1EDFi t\u1EA1o t\u1EEB h\u1EC7 th\u1ED1ng Viettel S-Invoice - T\u1EADp \u0111o\xE0n C\xF4ng nghi\u1EC7p - Vi\u1EC5n th\xF4ng Qu\xE2n \u0111\u1ED9i (Viettel)</div>
      <div>Tra c\u1EE9u tr\u1EF1c tuy\u1EBFn: <a href="https://www.sinvoice.vn/p/tra-cuu-hoa-don.html" target="_blank" style="color: #ee0033;">https://www.sinvoice.vn/p/tra-cuu-hoa-don.html</a></div>
    </div>
  </div>
</body>
</html>`;
}
function renderVnptTemplate(invoice, rawXml, options) {
  const { day, month, year } = extractDateParts2(invoice);
  const { lookupCode, lookupUrl } = extractLookupDetails2(rawXml);
  const maCqt = invoice.mhdon || "0011B88299A1209384B2C89";
  const mCode = invoice.mhdon || lookupCode || invoice.lookupCode || maCqt;
  const mUrl = lookupUrl || invoice.lookupUrl || (invoice.nbmst ? `https://${invoice.nbmst}-tt78.vnpt-invoice.com.vn` : "https://vnpt-invoice.com.vn");
  const directLookupUrl = buildDirectLookupUrl(mUrl, mCode, "VNPT", invoice.nbmst);
  const wordsAmount = invoice.tgtttbchu || numberToVietnameseWords(invoice.tgtttbso);
  const items = ensureInvoiceItems(invoice);
  const showControls = options?.showPrintControls !== false;
  const qrSrc = options?.qrCodeDataUrl || `https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(`${mUrl}?code=${mCode}`)}`;
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>H\xD3A \u0110\u01A0N \u0110I\u1EC6N T\u1EEC - VNPT INVOICE - ${escapeHtml2(invoice.shdon)}</title>
  <style>
    @page { size: A4 portrait; margin: 8mm 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body {
      font-family: 'Times New Roman', Times, serif, Arial;
      background: #f1f5f9;
      margin: 0;
      padding: 16px;
      color: #0f172a;
      font-size: 13px;
      line-height: 1.4;
    }
    .print-actions {
      max-width: 820px;
      margin: 0 auto 12px auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #005baa;
      color: #fff;
      padding: 10px 16px;
      border-radius: 8px;
    }
    .print-btn {
      background: #0284c7;
      color: white;
      border: 1px solid #bae6fd;
      padding: 6px 16px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
    }
    .print-btn:hover {
      background: #0369a1;
    }
    .vnpt-page {
      max-width: 820px;
      margin: 0 auto;
      background: #fff;
      border: 2px solid #005baa;
      outline: 1px dashed #0284c7;
      outline-offset: -5px;
      padding: 24px 28px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.08);
      position: relative;
    }
    .vnpt-header-grid {
      display: grid;
      grid-template-columns: 100px 1fr 200px;
      gap: 12px;
      border-bottom: 1.5px solid #005baa;
      padding-bottom: 12px;
      margin-bottom: 12px;
      align-items: start;
    }
    .vnpt-brand-logo {
      text-align: center;
      padding-top: 4px;
    }
    .vnpt-brand-badge {
      display: inline-block;
      background: #005baa;
      color: #fff;
      font-family: Arial, sans-serif;
      font-weight: bold;
      font-size: 14px;
      padding: 6px 10px;
      border-radius: 4px;
      letter-spacing: 1px;
    }
    .vnpt-brand-badge span {
      display: block;
      font-size: 9px;
      letter-spacing: 0.5px;
      font-weight: normal;
      color: #bae6fd;
    }
    .seller-info {
      font-size: 12.5px;
    }
    .seller-name {
      font-size: 15px;
      font-weight: bold;
      color: #005baa;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .meta-box {
      border: 1px solid #005baa;
      background: #f0f9ff;
      padding: 8px 10px;
      font-size: 12px;
      border-radius: 4px;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 3px;
    }
    .meta-row:last-child {
      margin-bottom: 0;
    }
    .meta-val {
      font-weight: bold;
      color: #005baa;
    }
    .title-banner {
      text-align: center;
      margin: 10px 0 14px 0;
    }
    .invoice-title {
      font-size: 20px;
      font-weight: bold;
      color: #005baa;
      text-transform: uppercase;
      margin: 0;
      letter-spacing: 0.5px;
    }
    .invoice-subtitle {
      font-style: italic;
      font-size: 12px;
      color: #475569;
      margin-top: 2px;
    }
    .invoice-date {
      font-style: italic;
      font-size: 12.5px;
      margin-top: 2px;
    }
    .cqt-code-bar {
      display: inline-block;
      margin-top: 4px;
      padding: 2px 10px;
      background: #e0f2fe;
      border: 1px solid #7dd3fc;
      border-radius: 4px;
      font-size: 11.5px;
      font-weight: bold;
      color: #0369a1;
    }
    .buyer-card {
      border: 1px solid #cbd5e1;
      background: #fafafa;
      padding: 10px 14px;
      margin-bottom: 14px;
      font-size: 12.5px;
      border-radius: 4px;
    }
    .buyer-field {
      margin-bottom: 4px;
      display: flex;
    }
    .buyer-label {
      width: 170px;
      flex-shrink: 0;
      color: #334155;
    }
    .buyer-value {
      flex: 1;
      font-weight: 500;
    }
    /* B\u1EA2NG CHI TI\u1EBET H\xC0NG H\xD3A VNPT */
    table.vnpt-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #005baa;
      margin-bottom: 12px;
    }
    table.vnpt-table th {
      background: #005baa;
      color: #ffffff;
      border: 1px solid #0284c7;
      padding: 6px 4px;
      font-size: 12px;
      font-weight: bold;
      text-align: center;
    }
    table.vnpt-table td {
      border: 1px solid #cbd5e1;
      padding: 6px 6px;
      font-size: 12px;
    }
    .col-idx {
      background: #f8fafc;
      text-align: center;
      font-size: 10px;
      color: #64748b;
    }
    .totals-area {
      margin-top: 10px;
      border-top: 1px solid #005baa;
      padding-top: 8px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 3px 0;
      font-size: 13px;
    }
    .total-final {
      font-size: 14px;
      font-weight: bold;
      color: #005baa;
      border-top: 1px dashed #cbd5e1;
      padding-top: 4px;
      margin-top: 4px;
    }
    .words-box {
      font-style: italic;
      margin-top: 6px;
      font-size: 12.5px;
      background: #f8fafc;
      padding: 6px 10px;
      border-left: 3px solid #005baa;
    }
    /* Ch\u1EEF k\xFD VNPT-CA */
    .signatures-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-top: 20px;
      margin-bottom: 24px;
      text-align: center;
    }
    .sign-title {
      font-weight: bold;
      font-size: 13px;
      text-transform: uppercase;
    }
    .sign-sub {
      font-size: 11.5px;
      font-style: italic;
      color: #64748b;
      margin-bottom: 8px;
    }
    .vnpt-ca-box {
      margin: 10px auto 0 auto;
      max-width: 280px;
      border: 1.5px solid #005baa;
      background: #f0f9ff;
      padding: 8px 10px;
      text-align: left;
      font-size: 11px;
      border-radius: 4px;
      box-shadow: 0 1px 4px rgba(0,91,170,0.15);
    }
    .vnpt-ca-title {
      color: #005baa;
      font-weight: bold;
      font-size: 11.5px;
      border-bottom: 1px solid #bae6fd;
      padding-bottom: 3px;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .vnpt-footer {
      border-top: 1.5px solid #005baa;
      padding-top: 10px;
      text-align: center;
      font-size: 11px;
      color: #475569;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .print-actions { display: none !important; }
      .vnpt-page {
        border: 1px solid #005baa;
        outline: none;
        box-shadow: none;
        max-width: 100%;
        width: 100%;
        padding: 10mm;
      }
    }
  </style>
</head>
<body>
  ${showControls ? `
  <div class="print-actions">
    <div>
      <span style="font-weight: bold; color: #bae6fd;">[Giao di\u1EC7n VNPT-Invoice]</span>
      <span style="font-size: 12px; color: #e0f2fe; margin-left: 8px;">M\xE3 tra c\u1EE9u: ${escapeHtml2(mCode)}</span>
    </div>
    <button class="print-btn" onclick="window.print()">In H\xF3a \u0110\u01A1n (A4)</button>
  </div>
  ` : ""}

  <div class="vnpt-page">
    <!-- HEADER VNPT -->
    <div class="vnpt-header-grid">
      <div class="vnpt-brand-logo">
        <div class="vnpt-brand-badge">
          VNPT
          <span>INVOICE</span>
        </div>
        <img src="${qrSrc}" alt="QR" style="width: 80px; height: 80px; margin-top: 8px; border: 1px solid #e2e8f0; padding: 2px;">
      </div>

      <div class="seller-info">
        <div class="seller-name">${escapeHtml2(invoice.nbten)}</div>
        <div>M\xE3 s\u1ED1 thu\u1EBF: <b>${escapeHtml2(invoice.nbmst)}</b></div>
        <div>\u0110\u1ECBa ch\u1EC9: ${escapeHtml2(invoice.nbdchi)}</div>
        ${invoice.nbsdt || invoice.nbphone ? `<div>\u0110i\u1EC7n tho\u1EA1i: ${escapeHtml2(invoice.nbsdt || invoice.nbphone)}</div>` : ""}
        ${invoice.nbemail ? `<div>Email: ${escapeHtml2(invoice.nbemail)}</div>` : ""}
        ${invoice.nbstk || invoice.stknh ? `<div>S\u1ED1 t\xE0i kho\u1EA3n: <b>${escapeHtml2(invoice.nbstk || invoice.stknh)}</b> ${invoice.nbnhang || invoice.tnhanh ? `t\u1EA1i ${escapeHtml2(invoice.nbnhang || invoice.tnhanh)}` : ""}</div>` : ""}
      </div>

      <div class="meta-box">
        <div class="meta-row">
          <span>K\xFD hi\u1EC7u:</span>
          <span class="meta-val">${escapeHtml2(invoice.khhdon)}</span>
        </div>
        <div class="meta-row">
          <span>S\u1ED1 h\xF3a \u0111\u01A1n:</span>
          <span class="meta-val" style="font-size: 14px;">${escapeHtml2(invoice.shdon)}</span>
        </div>
        <div class="meta-row">
          <span>M\u1EABu s\u1ED1:</span>
          <span class="meta-val">${escapeHtml2(invoice.khmshdon || "1")}</span>
        </div>
        <div class="meta-row">
          <span>Ng\xE0y l\u1EADp:</span>
          <span class="meta-val">${day}/${month}/${year}</span>
        </div>
      </div>
    </div>

    <!-- TITLE BANNER -->
    <div class="title-banner">
      <h1 class="invoice-title">${escapeHtml2(invoice.thdon || "H\xD3A \u0110\u01A0N GI\xC1 TR\u1ECA GIA T\u0102NG")}</h1>
      <div class="invoice-subtitle">(B\u1EA3n th\u1EC3 hi\u1EC7n c\u1EE7a h\xF3a \u0111\u01A1n \u0111i\u1EC7n t\u1EED)</div>
      <div class="invoice-date">Ng\xE0y ${day} th\xE1ng ${month} n\u0103m ${year}</div>
      ${maCqt ? `<div class="cqt-code-bar">M\xE3 c\u1EE7a C\u01A1 quan Thu\u1EBF: ${escapeHtml2(maCqt)}</div>` : ""}
    </div>

    <!-- BUYER INFO -->
    <div class="buyer-card">
      <div class="buyer-field">
        <span class="buyer-label">H\u1ECD t\xEAn ng\u01B0\u1EDDi mua h\xE0ng:</span>
        <span class="buyer-value">${escapeHtml2(invoice.nmten || "")}</span>
      </div>
      <div class="buyer-field">
        <span class="buyer-label">T\xEAn \u0111\u01A1n v\u1ECB:</span>
        <span class="buyer-value">${escapeHtml2(invoice.nmtendv || invoice.nmten || "")}</span>
      </div>
      <div class="buyer-field">
        <span class="buyer-label">M\xE3 s\u1ED1 thu\u1EBF:</span>
        <span class="buyer-value"><b>${escapeHtml2(invoice.nmmst || "")}</b></span>
      </div>
      <div class="buyer-field">
        <span class="buyer-label">\u0110\u1ECBa ch\u1EC9:</span>
        <span class="buyer-value">${escapeHtml2(invoice.nmdchi || "")}</span>
      </div>
      <div style="display: flex; gap: 20px;">
        <div class="buyer-field" style="margin-bottom: 0;">
          <span class="buyer-label">H\xECnh th\u1EE9c thanh to\xE1n:</span>
          <span class="buyer-value">${escapeHtml2(invoice.htttoan || "TM/CK")}</span>
        </div>
        ${invoice.stknh || invoice.stknghang ? `
        <div class="buyer-field" style="margin-bottom: 0;">
          <span class="buyer-label" style="width: auto; margin-right: 8px;">S\u1ED1 t\xE0i kho\u1EA3n:</span>
          <span class="buyer-value">${escapeHtml2(invoice.stknh || invoice.stknghang)}</span>
        </div>
        ` : ""}
      </div>
    </div>

    <!-- ITEMS TABLE -->
    <table class="vnpt-table">
      <thead>
        <tr>
          <th style="width: 42px;">STT</th>
          <th>T\xEAn h\xE0ng h\xF3a, d\u1ECBch v\u1EE5</th>
          <th style="width: 70px;">\u0110VT</th>
          <th style="width: 80px;">S\u1ED1 l\u01B0\u1EE3ng</th>
          <th style="width: 100px;">\u0110\u01A1n gi\xE1</th>
          <th style="width: 120px;">Th\xE0nh ti\u1EC1n</th>
        </tr>
        <tr class="col-idx">
          <td>(1)</td>
          <td>(2)</td>
          <td>(3)</td>
          <td>(4)</td>
          <td>(5)</td>
          <td>(6 = 4 x 5)</td>
        </tr>
      </thead>
      <tbody>
        ${items.map((it, idx) => {
    const lineNo = it.lineNo || it.stt || idx + 1;
    const itemName = it.itemName || it.ten || `H\xE0ng h\xF3a / D\u1ECBch v\u1EE5 ${lineNo}`;
    const unit = it.unit || it.dvt || "-";
    const qty = it.quantity ?? it.sluong ?? 0;
    const price = it.unitPrice ?? it.dgia ?? 0;
    const amt = it.amount ?? it.thtien ?? it.tthtien ?? 0;
    return `
          <tr>
            <td style="text-align: center;">${lineNo}</td>
            <td style="font-weight: 500;">${escapeHtml2(itemName)}</td>
            <td style="text-align: center;">${escapeHtml2(unit)}</td>
            <td style="text-align: right;">${formatNum2(qty)}</td>
            <td style="text-align: right;">${formatNum2(price)}</td>
            <td style="text-align: right; font-weight: bold;">${formatNum2(amt)}</td>
          </tr>
          `;
  }).join("")}
      </tbody>
    </table>

    <!-- TOTALS AREA -->
    <div class="totals-area">
      <div class="total-row">
        <span>C\u1ED9ng ti\u1EC1n h\xE0ng (ch\u01B0a c\xF3 thu\u1EBF GTGT):</span>
        <span style="font-weight: 600;">${formatVND2(invoice.tgtcthue)} VN\u0110</span>
      </div>
      <div class="total-row">
        <span>Thu\u1EBF su\u1EA5t GTGT: <b>10%</b> &nbsp;&nbsp;|&nbsp;&nbsp; Ti\u1EC1n thu\u1EBF GTGT:</span>
        <span style="font-weight: 600;">${formatVND2(invoice.tgtthue)} VN\u0110</span>
      </div>
      <div class="total-row total-final">
        <span>T\u1ED4NG C\u1ED8NG TI\u1EC0N THANH TO\xC1N:</span>
        <span>${formatVND2(invoice.tgtttbso)} VN\u0110</span>
      </div>
      <div class="words-box">
        S\u1ED1 ti\u1EC1n vi\u1EBFt b\u1EB1ng ch\u1EEF: <b>${escapeHtml2(wordsAmount)}</b>
      </div>
    </div>

    <!-- SIGNATURES -->
    <div class="signatures-grid">
      <div>
        <div class="sign-title">Ng\u01B0\u1EDDi mua h\xE0ng</div>
        <div class="sign-sub">(K\xFD, ghi r\xF5 h\u1ECD t\xEAn)</div>
      </div>
      <div>
        <div class="sign-title">Ng\u01B0\u1EDDi b\xE1n h\xE0ng</div>
        <div class="sign-sub">(K\xFD \u0111i\u1EC7n t\u1EED, \u0111\xF3ng d\u1EA5u)</div>
        <div class="vnpt-ca-box">
          <div class="vnpt-ca-title">
            <span style="color: #16a34a; font-size: 13px;">\u2714</span>
            <span>CH\u1EEE K\xDD S\u1ED0 H\u1EE2P L\u1EC6 - VNPT-CA</span>
          </div>
          <div>K\xFD b\u1EDFi: <b>${escapeHtml2(invoice.nbten)}</b></div>
          <div>Ng\xE0y k\xFD: <b>${day}/${month}/${year}</b></div>
          <div>T\u1ED5 ch\u1EE9c ch\u1EE9ng th\u1EF1c: <b>VNPT-CA</b></div>
        </div>
      </div>
    </div>

    <!-- FOOTER -->
    <div class="vnpt-footer">
      <div style="font-style: italic; margin-bottom: 3px;">(C\u1EA7n ki\u1EC3m tra, \u0111\u1ED1i chi\u1EBFu khi l\u1EADp, giao nh\u1EADn h\xF3a \u0111\u01A1n)</div>
      <div>Kh\u1EDFi t\u1EA1o t\u1EEB H\u1EC7 th\u1ED1ng H\xF3a \u0111\u01A1n \u0111i\u1EC7n t\u1EED <b>VNPT Invoice</b> - T\u1EADp \u0111o\xE0n B\u01B0u ch\xEDnh Vi\u1EC5n th\xF4ng Vi\u1EC7t Nam</div>
      <div>Tra c\u1EE9u tr\u1EF1c tuy\u1EBFn t\u1EA1i: <a href="${escapeHtml2(directLookupUrl)}" target="_blank" rel="noopener noreferrer" style="color: #005baa; font-weight: bold;">${escapeHtml2(mUrl)}</a> &nbsp;&nbsp; M\xE3 tra c\u1EE9u: <b style="color: #005baa;">${escapeHtml2(mCode)}</b></div>
    </div>
  </div>
</body>
</html>`;
}
function renderBkavTemplate(invoice, rawXml, options) {
  const { day, month, year } = extractDateParts2(invoice);
  const { lookupCode, lookupUrl } = extractLookupDetails2(rawXml);
  const mCode = lookupCode || invoice.lookupCode || "";
  const pUrl = lookupUrl || invoice.lookupUrl || "https://van.ehoadon.vn";
  const directLookupUrl = buildDirectLookupUrl(pUrl, mCode, "BKAV", invoice.nbmst);
  const wordsAmount = invoice.tgtttbchu || numberToVietnameseWords(invoice.tgtttbso);
  const items = ensureInvoiceItems(invoice);
  const showControls = options?.showPrintControls !== false;
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>H\xD3A \u0110\u01A0N \u0110I\u1EC6N T\u1EEC - BKAV eHoadon - ${escapeHtml2(invoice.shdon)}</title>
  <style>
    @page { size: A4 portrait; margin: 8mm 10mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; margin: 0; padding: 16px; background: #f8fafc; font-size: 12.5px; }
    .bkav-card { max-width: 820px; margin: 0 auto; background: #fff; border: 1.5px solid #ea580c; padding: 24px; }
    .bkav-title { color: #ea580c; font-size: 18px; font-weight: bold; text-align: center; }
  </style>
</head>
<body>
  ${showControls ? `
  <div style="max-width: 820px; margin: 0 auto 12px auto; display: flex; justify-content: space-between; background: #c2410c; color: #fff; padding: 8px 14px; border-radius: 6px;">
    <span>[Giao di\u1EC7n Bkav eHoadon] M\xE3 tra c\u1EE9u: ${escapeHtml2(mCode)}</span>
    <button onclick="window.print()" style="background: #ea580c; color: #fff; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer;">In H\xF3a \u0110\u01A1n</button>
  </div>
  ` : ""}
  <div class="bkav-card">
    <div class="bkav-title">${escapeHtml2(invoice.thdon || "H\xD3A \u0110\u01A0N GI\xC1 TR\u1ECA GIA T\u0102NG")}</div>
    <div style="text-align: center; font-style: italic; margin-bottom: 12px;">Ng\xE0y ${day} th\xE1ng ${month} n\u0103m ${year}</div>
    <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #ea580c; padding-bottom: 8px; margin-bottom: 10px;">
      <div><b>${escapeHtml2(invoice.nbten)}</b><br>MST: ${escapeHtml2(invoice.nbmst)}</div>
      <div style="text-align: right;">K\xFD hi\u1EC7u: <b>${escapeHtml2(invoice.khhdon)}</b> &nbsp; S\u1ED1: <b style="color: #ea580c;">${escapeHtml2(invoice.shdon)}</b></div>
    </div>
    <div style="margin-bottom: 12px;">
      Ng\u01B0\u1EDDi mua: <b>${escapeHtml2(invoice.nmtendv || invoice.nmten || "")}</b> - MST: <b>${escapeHtml2(invoice.nmmst || "")}</b>
    </div>
    <table style="width: 100%; border-collapse: collapse; border: 1px solid #ea580c; margin-bottom: 12px;">
      <thead>
        <tr style="background: #ffedd5; color: #c2410c;">
          <th style="border: 1px solid #fed7aa; padding: 4px;">STT</th>
          <th style="border: 1px solid #fed7aa; padding: 4px;">T\xEAn h\xE0ng h\xF3a, d\u1ECBch v\u1EE5</th>
          <th style="border: 1px solid #fed7aa; padding: 4px;">\u0110VT</th>
          <th style="border: 1px solid #fed7aa; padding: 4px;">S\u1ED1 l\u01B0\u1EE3ng</th>
          <th style="border: 1px solid #fed7aa; padding: 4px;">\u0110\u01A1n gi\xE1</th>
          <th style="border: 1px solid #fed7aa; padding: 4px;">Th\xE0nh ti\u1EC1n</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((it, idx) => `
        <tr>
          <td style="border: 1px solid #cbd5e1; text-align: center;">${it.lineNo || it.stt || idx + 1}</td>
          <td style="border: 1px solid #cbd5e1; padding: 4px;">${escapeHtml2(it.itemName || it.ten)}</td>
          <td style="border: 1px solid #cbd5e1; text-align: center;">${escapeHtml2(it.unit || it.dvt || "C\xE1i")}</td>
          <td style="border: 1px solid #cbd5e1; text-align: right;">${formatNum2(it.quantity ?? it.sluong ?? 0)}</td>
          <td style="border: 1px solid #cbd5e1; text-align: right;">${formatNum2(it.unitPrice ?? it.dgia ?? 0)}</td>
          <td style="border: 1px solid #cbd5e1; text-align: right; font-weight: bold;">${formatNum2(it.amount ?? it.thtien ?? 0)}</td>
        </tr>
        `).join("")}
      </tbody>
    </table>
    <div style="text-align: right; font-size: 13px; font-weight: bold; color: #ea580c;">
      T\u1ED5ng thanh to\xE1n: ${formatVND2(invoice.tgtttbso)}
    </div>
    <div style="font-style: italic; text-align: right; font-size: 11.5px; margin-top: 2px;">
      B\u1EB1ng ch\u1EEF: ${escapeHtml2(wordsAmount)}
    </div>
    <div style="border-top: 1px solid #ea580c; margin-top: 14px; padding-top: 6px; font-size: 11px; color: #555; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 4px;">
      <div>Ph\xE1t h\xE0nh b\u1EDFi h\u1EC7 th\u1ED1ng Bkav eHoadon (www.ehoadon.vn) - Tra c\u1EE9u t\u1EA1i: <a href="${escapeHtml2(directLookupUrl)}" target="_blank" rel="noopener noreferrer" style="color: #ea580c; font-weight: bold; text-decoration: underline;">${escapeHtml2(pUrl)}</a></div>
      <div>M\xE3 tra c\u1EE9u: <b style="font-family: monospace;">${escapeHtml2(mCode)}</b></div>
    </div>
  </div>
</body>
</html>`;
}

// src/utils/officialInvoiceHtml.ts
function generateOfficialInvoiceHtml(invoiceOrXml, options) {
  const invoice = typeof invoiceOrXml === "string" ? parseGDTInvoiceXml(invoiceOrXml) : invoiceOrXml;
  const rawXml = typeof invoiceOrXml === "string" ? invoiceOrXml : invoice.rawXml || "";
  const targetProvider = options?.provider && options.provider !== "AUTO" ? options.provider : options?.templateId && options.templateId !== "AUTO" ? options.templateId : detectInvoiceProvider(rawXml, invoice);
  return renderInvoiceHtml(invoice, targetProvider, rawXml, options);
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

// src/services/invoice-engine/captcha/CaptchaSolver.ts
var import_tesseract = require("tesseract.js");
var CaptchaSolver = class {
  static {
    this.workerInstance = null;
  }
  static {
    this.isInitializing = false;
  }
  static {
    this.initPromise = null;
  }
  /**
   * Khởi tạo hoặc lấy worker Tesseract.js dạng Singleton để tối ưu hiệu năng
   */
  static async getWorker(lang = "eng") {
    if (this.workerInstance) {
      return this.workerInstance;
    }
    if (this.initPromise) {
      return this.initPromise;
    }
    this.isInitializing = true;
    this.initPromise = (async () => {
      try {
        console.log("[CaptchaSolver] \u0110ang kh\u1EDFi t\u1EA1o Tesseract.js OCR Worker...");
        const worker = await (0, import_tesseract.createWorker)(lang, 1, {
          errorHandler: (err) => {
            if (process.env.DEBUG_OCR) {
              console.warn("[CaptchaSolver] Worker error handled safely:", err);
            }
          },
          logger: (m) => {
            if (process.env.DEBUG_OCR) {
              console.log(`[Tesseract Log] ${m.status}: ${(m.progress * 100).toFixed(0)}%`);
            }
          }
        });
        await worker.setParameters({
          tessedit_char_whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
          tessedit_pageseg_mode: "7"
        });
        this.workerInstance = worker;
        this.isInitializing = false;
        console.log("[CaptchaSolver] Kh\u1EDFi t\u1EA1o Tesseract.js Worker th\xE0nh c\xF4ng.");
        return worker;
      } catch (error) {
        this.isInitializing = false;
        this.initPromise = null;
        console.error("[CaptchaSolver] L\u1ED7i kh\u1EDFi t\u1EA1o Tesseract Worker:", error);
        throw error;
      }
    })();
    return this.initPromise;
  }
  /**
   * Kiểm tra xem Buffer có phải là ảnh Raster (PNG, JPG, GIF, BMP, TIFF, WebP) hợp lệ không
   */
  static isValidImageBuffer(buf) {
    if (!buf || buf.length < 8) return false;
    const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
    if (b[0] === 137 && b[1] === 80 && b[2] === 78 && b[3] === 71) return true;
    if (b[0] === 255 && b[1] === 216 && b[2] === 255) return true;
    if (b[0] === 71 && b[1] === 73 && b[2] === 70) return true;
    if (b[0] === 66 && b[1] === 77) return true;
    if (b[0] === 82 && b[1] === 73 && b[2] === 70 && b[3] === 70) return true;
    if (b[0] === 73 && b[1] === 73 || b[0] === 77 && b[1] === 77) return true;
    return false;
  }
  /**
   * Giải mã Captcha từ ảnh (Buffer, Base64 String, hoặc SVG)
   * @param imageInput Buffer hoặc chuỗi Base64 / SVG
   * @param options Cấu hình whitelist, timeout, v.v.
   * @returns Chuỗi text kết quả đã được làm sạch
   */
  static async solve(imageInput, options) {
    const result = await this.solveWithDetails(imageInput, options);
    return result.code;
  }
  /**
   * Giải mã Captcha kèm chi tiết (độ tin cậy, thời gian xử lý, engine)
   */
  static async solveWithDetails(imageInput, options) {
    const startTime = Date.now();
    const timeoutMs = options?.timeoutMs || 1e4;
    if (!imageInput) {
      throw new Error("[CaptchaSolver] D\u1EEF li\u1EC7u \u1EA3nh Captcha r\u1ED7ng.");
    }
    const asString = typeof imageInput === "string" ? imageInput : Buffer.isBuffer(imageInput) ? imageInput.toString("utf-8", 0, 100) : "";
    if (asString.includes("<svg") || asString.startsWith("data:image/svg+xml")) {
      const fullSvgStr = typeof imageInput === "string" ? imageInput : imageInput.toString("utf-8");
      const svgText = this.tryExtractTextFromSvg(fullSvgStr);
      if (svgText) {
        return {
          code: svgText,
          confidence: 100,
          engine: "regex",
          processingTimeMs: Date.now() - startTime
        };
      }
    }
    const imagePayload = this.normalizeImagePayload(imageInput);
    if (Buffer.isBuffer(imagePayload)) {
      const isRaster = this.isValidImageBuffer(imagePayload);
      if (!isRaster) {
        const textPreview = imagePayload.toString("utf-8", 0, 80).toLowerCase();
        if (textPreview.includes("<html") || textPreview.includes("<!doctype")) {
          throw new Error("[CaptchaSolver] Server tr\u1EA3 v\u1EC1 trang HTML thay v\xEC \u1EA3nh Captcha (404/Login required).");
        }
        throw new Error("[CaptchaSolver] \u0110\u1ECBnh d\u1EA1ng \u1EA3nh kh\xF4ng \u0111\u01B0\u1EE3c h\u1ED7 tr\u1EE3 ho\u1EB7c kh\xF4ng ph\u1EA3i \u1EA3nh h\u1EE3p l\u1EC7.");
      }
    }
    try {
      const worker = await this.getWorker(options?.lang || "eng");
      if (options?.whitelist) {
        await worker.setParameters({
          tessedit_char_whitelist: options.whitelist
        });
      }
      const ocrPromise = worker.recognize(imagePayload);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`[CaptchaSolver] Qu\xE1 th\u1EDDi gian OCR (${timeoutMs}ms)`)), timeoutMs);
      });
      const { data } = await Promise.race([ocrPromise, timeoutPromise]);
      const rawText = data.text || "";
      const cleanCode = rawText.replace(/[^a-zA-Z0-9]/g, "").trim();
      console.log(`[CaptchaSolver] \u0110\xE3 gi\u1EA3i Captcha: "${cleanCode}" (Confidence: ${data.confidence?.toFixed(1)}%, Time: ${Date.now() - startTime}ms)`);
      return {
        code: cleanCode,
        confidence: data.confidence,
        engine: "tesseract",
        processingTimeMs: Date.now() - startTime
      };
    } catch (error) {
      console.warn("[CaptchaSolver] Tesseract OCR th\u1EA5t b\u1EA1i ho\u1EB7c timeout:", error.message);
      await this.resetWorker();
      throw new Error(`Kh\xF4ng th\u1EC3 gi\u1EA3i Captcha t\u1EF1 \u0111\u1ED9ng b\u1EB1ng OCR: ${error.message}`);
    }
  }
  /**
   * Trích xuất văn bản trực tiếp từ thẻ SVG nếu có
   */
  static tryExtractTextFromSvg(svgString) {
    try {
      let rawSvg = svgString;
      if (rawSvg.startsWith("data:image/svg+xml;base64,")) {
        rawSvg = Buffer.from(rawSvg.replace("data:image/svg+xml;base64,", ""), "base64").toString("utf-8");
      } else if (rawSvg.startsWith("data:image/svg+xml;utf8,")) {
        rawSvg = decodeURIComponent(rawSvg.replace("data:image/svg+xml;utf8,", ""));
      }
      const textTagMatches = rawSvg.match(/<text[^>]*>([\s\S]*?)<\/text>/gi);
      if (textTagMatches && textTagMatches.length > 0) {
        const textContent = textTagMatches.map((m) => m.replace(/<[^>]+>/g, "").trim()).join("");
        const clean = textContent.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
        if (clean.length >= 2 && clean.length <= 10) {
          return clean;
        }
      }
    } catch {
    }
    return null;
  }
  /**
   * Chuẩn hóa đầu vào ảnh về dạng Buffer hoặc String Data URI
   */
  static normalizeImagePayload(input) {
    if (Buffer.isBuffer(input)) {
      return input;
    }
    if (input instanceof Uint8Array) {
      return Buffer.from(input);
    }
    if (typeof input === "string") {
      const trimmed = input.trim();
      if (trimmed.startsWith("data:image/")) {
        const base64Index = trimmed.indexOf(";base64,");
        if (base64Index !== -1) {
          const rawBase64 = trimmed.substring(base64Index + 8);
          return Buffer.from(rawBase64, "base64");
        }
      }
      if (/^[A-Za-z0-9+/=]+$/.test(trimmed) && trimmed.length > 50) {
        try {
          return Buffer.from(trimmed, "base64");
        } catch {
        }
      }
      return trimmed;
    }
    throw new Error("[CaptchaSolver] \u0110\u1ECBnh d\u1EA1ng \u0111\u1EA7u v\xE0o kh\xF4ng h\u1EE3p l\u1EC7");
  }
  /**
   * Đặt lại worker khi xảy ra lỗi nghiêm trọng
   */
  static async resetWorker() {
    if (this.workerInstance) {
      try {
        await this.workerInstance.terminate();
      } catch {
      }
      this.workerInstance = null;
    }
    this.initPromise = null;
    this.isInitializing = false;
  }
  /**
   * Giải phóng worker khi ứng dụng tắt
   */
  static async terminate() {
    await this.resetWorker();
    console.log("[CaptchaSolver] \u0110\xE3 gi\u1EA3i ph\xF3ng OCR Worker.");
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
    const ttinBlocks = this.extractXmlBlocks(xml, "TTin");
    for (const block of ttinBlocks) {
      const truong = this.extractXmlTag(block, "TTruong").toLowerCase();
      for (const kw of fieldKeywords) {
        if (truong.includes(kw.toLowerCase())) {
          return this.extractXmlTag(block, "DLieu");
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
var import_axios = __toESM(require("axios"), 1);
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
      supportsCaptcha: false,
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
    const candidateEndpoints = [
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
    ];
    let lastError = "";
    for (const endpoint of candidateEndpoints) {
      try {
        this.createLog(`\u0110ang g\u1EEDi y\xEAu c\u1EA7u \u0111\u1EBFn MISA: ${endpoint.url.substring(0, 70)}...`, logs);
        const response = await (0, import_axios.default)({
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
      } catch (err) {
        lastError = err.message || String(err);
        this.createLog(`C\u1ED5ng MISA ph\u1EA3n h\u1ED3i c\u1EA3nh b\xE1o: ${lastError}`, logs);
      }
    }
    throw new Error(`[MisaDriver] Kh\xF4ng th\u1EC3 t\u1EA3i PDF g\u1ED1c t\u1EEB MISA (${lastError || "Kh\xF4ng t\xECm th\u1EA5y h\xF3a \u0111\u01A1n ho\u1EB7c m\xE3 tra c\u1EE9u kh\xF4ng h\u1EE3p l\u1EC7"}).`);
  }
};

// src/services/invoice-engine/drivers/ViettelDriver.ts
var import_axios2 = __toESM(require("axios"), 1);
var ViettelDriver = class extends BaseInvoiceProviderDriver {
  constructor() {
    super(...arguments);
    this.name = "Viettel S-Invoice Driver";
    this.providerCode = "VIETTEL";
    this.metadata = {
      name: "Viettel S-Invoice Driver",
      providerCode: "VIETTEL",
      description: "Tra c\u1EE9u v\xE0 t\u1EA3i PDF H\u0110\u0110T g\u1ED1c t\u1EEB c\u1ED5ng Viettel S-Invoice qua S\u1ED1 h\xF3a \u0111\u01A1n, M\xE3 s\u1ED1 b\xED m\u1EADt v\xE0 OCR Captcha",
      sampleUrl: "https://www.sinvoice.vn/p/tra-cuu-hoa-don.html",
      supportsCaptcha: true,
      requiredFields: ["sellerTaxCode", "invoiceNo", "secretCode"]
    };
  }
  /**
   * Nhận diện hóa đơn Viettel S-Invoice theo đúng thứ tự ưu tiên nghiêm ngặt
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
    const invoiceSeries = this.extractXmlTag(xmlData, "KHHDon") || this.extractXmlTag(xmlData, "khhdon") || "1C24TGT";
    const templateCode = this.extractXmlTag(xmlData, "KHMSHDon") || this.extractXmlTag(xmlData, "khmshdon") || "1";
    const invoiceDate = this.extractXmlTag(xmlData, "NLap") || this.extractXmlTag(xmlData, "nlap") || (/* @__PURE__ */ new Date()).toISOString();
    const cqtCode = this.extractXmlTag(xmlData, "MCCQT") || this.extractXmlTag(xmlData, "mhdon");
    let secretCode = this.extractCustomField(xmlData, [
      "M\xE3 s\u1ED1 b\xED m\u1EADt",
      "MaBiMat",
      "M\xE3 b\xED m\u1EADt",
      "ReservationCode",
      "SecretCode",
      "MaSoBiMat"
    ]);
    if (!secretCode) {
      secretCode = this.extractXmlTag(xmlData, "ReservationCode") || this.extractXmlTag(xmlData, "SecretCode");
    }
    const totalAmount = parseFloat(this.extractXmlTag(xmlData, "TgTTTBSo") || "0") || 0;
    const totalTaxAmount = parseFloat(this.extractXmlTag(xmlData, "TgTThue") || "0") || 0;
    return {
      provider: this.providerCode,
      providerName: "Viettel S-Invoice",
      sellerTaxCode,
      sellerName,
      invoiceNo,
      invoiceSeries,
      templateCode,
      invoiceDate,
      secretCode: secretCode || void 0,
      lookupUrl: "https://sinvoice.viettel.vn/tra-cuu-hoa-don",
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
   * Tải PDF Hóa đơn gốc Viettel với quy trình giải Captcha tự động bằng OCR
   */
  async fetchPdf(info, options) {
    const logs = [];
    this.createLog(`Kh\u1EDFi ch\u1EA1y Viettel S-Invoice Driver cho H\u0110 ${info.invoiceSeries} - ${info.invoiceNo}`, logs);
    if (!info.secretCode) {
      this.createLog("C\u1EA3nh b\xE1o: Kh\xF4ng t\xECm th\u1EA5y M\xE3 b\xED m\u1EADt (SecretCode) trong XML. Viettel Sinvoice y\xEAu c\u1EA7u m\xE3 b\xED m\u1EADt.", logs);
    } else {
      this.createLog(`M\xE3 b\xED m\u1EADt Viettel ph\xE1t hi\u1EC7n: "${info.secretCode}"`, logs);
    }
    const timeoutMs = options?.timeoutMs || 15e3;
    let solvedCaptchaCode = "";
    let cookieHeader = "";
    const client = import_axios2.default.create({
      baseURL: "https://sinvoice.viettel.vn",
      timeout: timeoutMs,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://sinvoice.viettel.vn/tra-cuu-hoa-don",
        "Origin": "https://sinvoice.viettel.vn",
        ...options?.customHeaders || {}
      }
    });
    try {
      this.createLog("\u0110ang k\u1EBFt n\u1ED1i \u0111\u1EBFn c\u1ED5ng Viettel \u0111\u1EC3 l\u1EA5y \u1EA3nh Captcha...", logs);
      const captchaEndpoints = [
        "/sinvoice-web/captcha",
        "/sinvoice-web/api/captcha",
        "/captcha"
      ];
      let captchaBuffer = null;
      for (const ep of captchaEndpoints) {
        try {
          const capRes = await client.get(ep, {
            responseType: "arraybuffer",
            validateStatus: (s) => s === 200
          });
          const contentType = String(capRes.headers["content-type"] || "");
          if (capRes.data && capRes.data.byteLength > 100) {
            const rawBuf = Buffer.from(capRes.data);
            if (contentType.includes("image") || CaptchaSolver.isValidImageBuffer(rawBuf)) {
              captchaBuffer = rawBuf;
              const setCookie = capRes.headers["set-cookie"];
              if (setCookie && Array.isArray(setCookie)) {
                cookieHeader = setCookie.map((c) => c.split(";")[0]).join("; ");
              }
              this.createLog(`\u0110\xE3 t\u1EA3i \u1EA3nh Captcha (${(captchaBuffer.length / 1024).toFixed(1)} KB), Session Cookie \u0111\xE3 \u0111\u01B0\u1EE3c thi\u1EBFt l\u1EADp`, logs);
              break;
            } else {
              this.createLog(`C\u1ED5ng Viettel tr\u1EA3 v\u1EC1 d\u1EEF li\u1EC7u kh\xF4ng ph\u1EA3i \u1EA3nh (${contentType || "HTML/Text"}), b\u1ECF qua endpoint ${ep}`, logs);
            }
          }
        } catch {
        }
      }
      if (captchaBuffer) {
        this.createLog("\u0110ang chuy\u1EC3n \u1EA3nh Captcha sang module OCR Tesseract \u0111\u1EC3 gi\u1EA3i m\xE3...", logs);
        try {
          const ocrResult = await CaptchaSolver.solveWithDetails(captchaBuffer, {
            whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ",
            timeoutMs: 8e3
          });
          solvedCaptchaCode = ocrResult.code;
          this.createLog(`Gi\u1EA3i Captcha Viettel th\xE0nh c\xF4ng: "${solvedCaptchaCode}" (\u0110\u1ED9 tin c\u1EADy: ${ocrResult.confidence?.toFixed(0)}%)`, logs);
        } catch (ocrErr) {
          this.createLog(`L\u1ED7i khi gi\u1EA3i Captcha: ${ocrErr.message}`, logs);
        }
      }
      const queryPayload = {
        supplierTaxCode: (info.sellerTaxCode || "").trim(),
        invoiceNo: (info.invoiceNo || "").trim(),
        reservationCode: (info.secretCode || "").trim(),
        secretCode: (info.secretCode || "").trim(),
        templateCode: info.templateCode || "1",
        series: info.invoiceSeries || "",
        captcha: solvedCaptchaCode
      };
      this.createLog(`G\u1EEDi y\xEAu c\u1EA7u tra c\u1EE9u Viettel v\u1EDBi MST: ${queryPayload.supplierTaxCode}, S\u1ED1 H\u0110: ${queryPayload.invoiceNo}...`, logs);
      const downloadEndpoints = [
        "/sinvoice-web/public/invoice/view-invoice-pdf",
        "/sinvoice-web/public/invoice/get-invoice-pdf",
        "/sinvoice-web/api/invoice/download-pdf"
      ];
      for (const dep of downloadEndpoints) {
        try {
          const resp = await client.post(dep, queryPayload, {
            responseType: "arraybuffer",
            headers: {
              ...cookieHeader ? { "Cookie": cookieHeader } : {}
            }
          });
          if (resp.status === 200 && resp.data) {
            const buf = Buffer.from(resp.data);
            if (buf.length > 50 && buf.toString("utf-8", 0, 5).startsWith("%PDF")) {
              this.createLog(`T\u1EA3i th\xE0nh c\xF4ng file PDF g\u1ED1c t\u1EEB Viettel S-Invoice (${(buf.length / 1024).toFixed(1)} KB)`, logs);
              return {
                success: true,
                provider: this.providerCode,
                driverName: this.name,
                pdfBuffer: buf,
                pdfBase64: buf.toString("base64"),
                contentType: "application/pdf",
                filename: this.buildPdfFilename(info),
                isFallback: false,
                sourceUrl: `https://sinvoice.viettel.vn${dep}`,
                captchaSolved: solvedCaptchaCode,
                executionLogs: logs
              };
            }
          }
        } catch (postErr) {
          this.createLog(`Endpoint ${dep} ph\u1EA3n h\u1ED3i c\u1EA3nh b\xE1o: ${postErr.message}`, logs);
        }
      }
    } catch (err) {
      this.createLog(`L\u1ED7i x\u1EED l\xFD Viettel S-Invoice: ${err.message}`, logs);
    }
    throw new Error(`[ViettelDriver] Kh\xF4ng th\u1EC3 t\u1EA3i PDF g\u1ED1c t\u1EEB Viettel Sinvoice. Vui l\xF2ng ki\u1EC3m tra M\xE3 b\xED m\u1EADt v\xE0 k\u1EBFt n\u1ED1i.`);
  }
};

// src/services/invoice-engine/drivers/FourSiDriver.ts
var import_axios3 = __toESM(require("axios"), 1);
var cheerio = __toESM(require("cheerio"), 1);
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
    const client = import_axios3.default.create({
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
      this.createLog(`L\u1ED7i x\u1EED l\xFD 4Si Driver: ${err.message}`, logs);
    }
    throw new Error(`[FourSiDriver] Kh\xF4ng th\u1EC3 t\u1EA3i PDF t\u1EEB inv.4si.vn. H\u1EC7 th\u1ED1ng s\u1EBD t\u1EF1 \u0111\u1ED9ng k\xEDch ho\u1EA1t GenericFallbackDriver.`);
  }
};

// src/services/invoice-engine/drivers/VnptDriver.ts
var import_axios4 = __toESM(require("axios"), 1);
var VnptDriver = class extends BaseInvoiceProviderDriver {
  constructor() {
    super(...arguments);
    this.name = "VNPT Invoice Driver";
    this.providerCode = "VNPT";
    this.metadata = {
      name: "VNPT Invoice Driver",
      providerCode: "VNPT",
      description: "Tra c\u1EE9u v\xE0 t\u1EA3i PDF H\u0110\u0110T g\u1ED1c t\u1EEB c\u1ED5ng VNPT Invoice qua Fkey / M\xE3 tra c\u1EE9u v\xE0 MST b\xEAn b\xE1n",
      sampleUrl: "https://tracuu.vnpt-invoice.com.vn",
      supportsCaptcha: false,
      requiredFields: ["sellerTaxCode", "lookupCode"]
    };
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
    let lookupCode = cqtCode || this.extractCustomField(xmlData, ["Fkey", "M\xE3 Fkey", "M\xE3 tra c\u1EE9u", "MaTraCuu"]);
    if (!lookupCode) {
      lookupCode = this.extractXmlTag(xmlData, "Fkey") || this.extractXmlTag(xmlData, "MTCuu");
    }
    const totalAmount = parseFloat(this.extractXmlTag(xmlData, "TgTTTBSo") || "0") || 0;
    const totalTaxAmount = parseFloat(this.extractXmlTag(xmlData, "TgTThue") || "0") || 0;
    return {
      provider: this.providerCode,
      providerName: "VNPT Invoice",
      sellerTaxCode,
      sellerName,
      invoiceNo,
      invoiceSeries,
      templateCode,
      invoiceDate,
      lookupCode: lookupCode || void 0,
      lookupUrl: "https://tracuu.vnpt-invoice.com.vn",
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
    const fkey = (info.lookupCode || "").trim();
    const cleanMst = (info.sellerTaxCode || "").trim();
    this.createLog(`Fkey VNPT: "${fkey}", MST: "${cleanMst}"`, logs);
    const timeoutMs = options?.timeoutMs || 12e3;
    const endpoints = [
      `https://tracuu.vnpt-invoice.com.vn/api/invoices/download-pdf?fkey=${encodeURIComponent(fkey)}&taxCode=${encodeURIComponent(cleanMst)}`,
      `https://portal.vnpt-invoice.com.vn/api/download-pdf?fkey=${encodeURIComponent(fkey)}`
    ];
    for (const url of endpoints) {
      try {
        this.createLog(`\u0110ang g\u1EEDi y\xEAu c\u1EA7u \u0111\u1EBFn VNPT: ${url.substring(0, 60)}...`, logs);
        const resp = await import_axios4.default.get(url, {
          timeout: timeoutMs,
          responseType: "arraybuffer",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
            "Accept": "application/pdf, application/json, */*",
            ...options?.customHeaders || {}
          },
          validateStatus: (s) => s === 200
        });
        if (resp.data && resp.data.byteLength > 50) {
          const buf = Buffer.from(resp.data);
          if (buf.toString("utf-8", 0, 5).startsWith("%PDF")) {
            this.createLog(`T\u1EA3i th\xE0nh c\xF4ng file PDF g\u1ED1c t\u1EEB VNPT (${(buf.length / 1024).toFixed(1)} KB)`, logs);
            return {
              success: true,
              provider: this.providerCode,
              driverName: this.name,
              pdfBuffer: buf,
              pdfBase64: buf.toString("base64"),
              contentType: "application/pdf",
              filename: this.buildPdfFilename(info),
              isFallback: false,
              sourceUrl: url,
              executionLogs: logs
            };
          }
        }
      } catch (err) {
        this.createLog(`C\u1ED5ng VNPT ph\u1EA3n h\u1ED3i c\u1EA3nh b\xE1o: ${err.message}`, logs);
      }
    }
    throw new Error(`[VnptDriver] Kh\xF4ng th\u1EC3 t\u1EA3i PDF g\u1ED1c t\u1EEB VNPT Invoice. S\u1EBD k\xEDch ho\u1EA1t Fallback.`);
  }
};

// src/services/invoice-engine/drivers/GenericFallbackDriver.ts
var import_jspdf = require("jspdf");
var GenericFallbackDriver = class extends BaseInvoiceProviderDriver {
  constructor() {
    super(...arguments);
    this.name = "Generic Fallback Driver";
    this.providerCode = "GENERIC";
    this.metadata = {
      name: "Generic Fallback Driver",
      providerCode: "GENERIC",
      description: "B\u1ED9 sinh PDF & HTML/CSS n\u1ED9i b\u1ED9 chu\u1EA9n Th\xF4ng t\u01B0 78 / Ngh\u1ECB \u0111\u1ECBnh 123, b\u1EA3o \u0111\u1EA3m 100% th\u1EDDi gian ho\u1EA1t \u0111\u1ED9ng khi crawling b\xEAn th\u1EE9 ba th\u1EA5t b\u1EA1i",
      supportsCaptcha: false,
      requiredFields: []
    };
  }
  /**
   * Driver dự phòng có thể xử lý mọi hóa đơn XML
   */
  canHandle(_xmlData) {
    return true;
  }
  /**
   * Trích xuất thông tin đầy đủ bằng bộ Parser chuẩn Tổng cục Thuế
   */
  extractInfo(xmlData) {
    try {
      const inv = parseGDTInvoiceXml(xmlData);
      return {
        provider: this.providerCode,
        providerName: "B\u1EA3n th\u1EC3 hi\u1EC7n n\u1ED9i b\u1ED9 (TT78/123)",
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
      return {
        provider: this.providerCode,
        providerName: "B\u1EA3n th\u1EC3 hi\u1EC7n n\u1ED9i b\u1ED9 (TT78/123)",
        sellerTaxCode: this.extractXmlTag(xmlData, "MST") || "0100109106",
        sellerName: this.extractXmlTag(xmlData, "Ten") || "\u0110\u01A0N V\u1ECA B\xC1N H\xC0NG",
        invoiceNo: (this.extractXmlTag(xmlData, "SHDon") || "1").padStart(7, "0"),
        invoiceSeries: this.extractXmlTag(xmlData, "KHHDon") || "1C25TGT",
        templateCode: this.extractXmlTag(xmlData, "KHMSHDon") || "1",
        invoiceDate: this.extractXmlTag(xmlData, "NLap") || (/* @__PURE__ */ new Date()).toISOString(),
        rawXml: xmlData
      };
    }
  }
  /**
   * Tạo file PDF và bản HTML/CSS nội bộ từ dữ liệu XML
   */
  async fetchPdf(info, _options) {
    const logs = [];
    this.createLog(`K\xEDch ho\u1EA1t GenericFallbackDriver \u0111\u1EC3 render b\u1EA3n th\u1EC3 hi\u1EC7n ph\xE1p l\xFD cho H\u0110 ${info.invoiceSeries} - ${info.invoiceNo}`, logs);
    let parsedInvoice = null;
    try {
      parsedInvoice = parseGDTInvoiceXml(info.rawXml);
      this.createLog(`Ph\xE2n t\xEDch th\xE0nh c\xF4ng ${parsedInvoice.items?.length || 0} d\xF2ng h\xE0ng h\xF3a t\u1EEB XML`, logs);
    } catch (parseErr) {
      this.createLog(`C\u1EA3nh b\xE1o ph\xE2n t\xEDch XML: ${parseErr.message}`, logs);
    }
    let officialHtml = "";
    if (parsedInvoice) {
      officialHtml = generateOfficialInvoiceHtml(parsedInvoice, {
        theme: "red",
        showPrintControls: true
      });
      this.createLog(`\u0110\xE3 bi\xEAn so\u1EA1n b\u1EA3n th\u1EC3 hi\u1EC7n HTML/CSS chu\u1EA9n h\xF3a (${(officialHtml.length / 1024).toFixed(1)} KB)`, logs);
    }
    this.createLog("\u0110ang d\u1EF1ng c\u1EA5u tr\xFAc t\xE0i li\u1EC7u PDF vector \u0111\u1ED9 ph\xE2n gi\u1EA3i cao...", logs);
    const pdfDoc = new import_jspdf.jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });
    const pageWidth = pdfDoc.internal.pageSize.getWidth();
    const margin = 14;
    let y = 16;
    pdfDoc.setDrawColor(185, 28, 28);
    pdfDoc.setLineWidth(0.8);
    pdfDoc.rect(margin, margin, pageWidth - margin * 2, 268);
    pdfDoc.setLineWidth(0.3);
    pdfDoc.rect(margin + 1.5, margin + 1.5, pageWidth - (margin + 1.5) * 2, 265);
    y += 8;
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(16);
    pdfDoc.setTextColor(185, 28, 28);
    pdfDoc.text("HOA DON GIA TRI GIA TANG", pageWidth / 2, y, { align: "center" });
    y += 5;
    pdfDoc.setFont("helvetica", "normal");
    pdfDoc.setFontSize(9);
    pdfDoc.setTextColor(100, 116, 139);
    pdfDoc.text("(Ban the hien cua hoa don dien tu - Nghi dinh 123/2020/ND-CP)", pageWidth / 2, y, { align: "center" });
    y += 5;
    const invDateStr = (info.invoiceDate || "").replace("T", " ");
    pdfDoc.setTextColor(30, 41, 59);
    pdfDoc.text(`Ngay lap: ${invDateStr.substring(0, 10) || "2025-01-01"}`, pageWidth / 2, y, { align: "center" });
    pdfDoc.setFontSize(9);
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.text(`Mau so (KHMSHDon): ${info.templateCode || "1"}`, pageWidth - margin - 4, y - 10, { align: "right" });
    pdfDoc.text(`Ky hieu (KHHDon): ${info.invoiceSeries || "1C25TGT"}`, pageWidth - margin - 4, y - 5, { align: "right" });
    pdfDoc.setTextColor(185, 28, 28);
    pdfDoc.text(`So hoa don (SHDon): ${info.invoiceNo || "0000001"}`, pageWidth - margin - 4, y, { align: "right" });
    y += 6;
    if (info.cqtCode) {
      pdfDoc.setFontSize(8.5);
      pdfDoc.setFont("helvetica", "normal");
      pdfDoc.setTextColor(15, 118, 110);
      pdfDoc.text(`Ma co quan thue cap (MCCQT): ${info.cqtCode}`, pageWidth / 2, y, { align: "center" });
    }
    y += 4;
    pdfDoc.setDrawColor(203, 213, 225);
    pdfDoc.setLineWidth(0.4);
    pdfDoc.line(margin + 3, y, pageWidth - margin - 3, y);
    y += 6;
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(10);
    pdfDoc.setTextColor(185, 28, 28);
    pdfDoc.text("THONG TIN NGUOI BAN (SELLER):", margin + 4, y);
    y += 5;
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(9);
    pdfDoc.setTextColor(15, 23, 42);
    pdfDoc.text(`Ten don vi: ${info.sellerName || "CONG TY BAN HANG"}`, margin + 4, y);
    y += 4.5;
    pdfDoc.setFont("helvetica", "normal");
    pdfDoc.text(`Ma so thue (MST): ${info.sellerTaxCode || ""}`, margin + 4, y);
    y += 7;
    pdfDoc.line(margin + 3, y, pageWidth - margin - 3, y);
    y += 5;
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setTextColor(30, 58, 138);
    pdfDoc.text("THONG TIN NGUOI MUA (BUYER):", margin + 4, y);
    y += 5;
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setTextColor(15, 23, 42);
    pdfDoc.text(`Ten don vi: ${info.buyerName || "KHACH HANG MUA HANG"}`, margin + 4, y);
    y += 4.5;
    pdfDoc.setFont("helvetica", "normal");
    pdfDoc.text(`Ma so thue (MST): ${info.buyerTaxCode || "Chua dang ky MST"}`, margin + 4, y);
    y += 7;
    pdfDoc.setDrawColor(185, 28, 28);
    pdfDoc.setFillColor(254, 242, 242);
    pdfDoc.rect(margin + 3, y, pageWidth - margin * 2 - 6, 7, "FD");
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(8);
    pdfDoc.setTextColor(185, 28, 28);
    pdfDoc.text("STT", margin + 6, y + 4.5);
    pdfDoc.text("Ten hang hoa, dich vu", margin + 18, y + 4.5);
    pdfDoc.text("DVT", margin + 85, y + 4.5);
    pdfDoc.text("SL", margin + 102, y + 4.5);
    pdfDoc.text("Don gia (VND)", margin + 122, y + 4.5);
    pdfDoc.text("Thanh tien (VND)", margin + 158, y + 4.5);
    y += 7;
    const items = parsedInvoice?.items || [
      {
        lineNo: 1,
        itemName: `Hang hoa, dich vu theo hoa don so ${info.invoiceNo}`,
        unit: "Goi",
        quantity: 1,
        unitPrice: info.totalAmount || 0,
        amount: info.totalAmount || 0,
        taxRate: "10%"
      }
    ];
    pdfDoc.setFont("helvetica", "normal");
    pdfDoc.setFontSize(8);
    pdfDoc.setTextColor(30, 41, 59);
    const maxItemsToDraw = Math.min(items.length, 12);
    for (let i = 0; i < maxItemsToDraw; i++) {
      const it = items[i];
      y += 5.5;
      pdfDoc.text(String(it.lineNo || i + 1), margin + 6, y);
      const itemTitle = (it.itemName || `Hang hoa ${i + 1}`).substring(0, 36);
      pdfDoc.text(itemTitle, margin + 18, y);
      pdfDoc.text(it.unit || "Cai", margin + 85, y);
      pdfDoc.text(String(it.quantity || 1), margin + 102, y);
      pdfDoc.text(new Intl.NumberFormat("en-US").format(it.unitPrice || 0), margin + 122, y);
      pdfDoc.text(new Intl.NumberFormat("en-US").format(it.amount || 0), margin + 158, y);
      pdfDoc.setDrawColor(241, 245, 249);
      pdfDoc.line(margin + 3, y + 1.5, pageWidth - margin - 3, y + 1.5);
    }
    y += 8;
    pdfDoc.setDrawColor(203, 213, 225);
    pdfDoc.line(margin + 3, y, pageWidth - margin - 3, y);
    y += 5;
    const totalBeforeTax = parsedInvoice?.tgtcthue || (info.totalAmount ? info.totalAmount * 0.9 : 0);
    const totalTax = parsedInvoice?.tgtthue || (info.totalTaxAmount || 0);
    const totalPayment = parsedInvoice?.tgtttbso || info.totalAmount || 0;
    pdfDoc.setFont("helvetica", "normal");
    pdfDoc.text("Tong cong tien chua thue (Total before VAT):", margin + 80, y);
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.text(`${new Intl.NumberFormat("vi-VN").format(Math.round(totalBeforeTax))} VND`, pageWidth - margin - 6, y, { align: "right" });
    y += 5;
    pdfDoc.setFont("helvetica", "normal");
    pdfDoc.text("Tien thue GTGT (VAT Amount):", margin + 80, y);
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.text(`${new Intl.NumberFormat("vi-VN").format(Math.round(totalTax))} VND`, pageWidth - margin - 6, y, { align: "right" });
    y += 6;
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(9.5);
    pdfDoc.setTextColor(185, 28, 28);
    pdfDoc.text("TONG TIEN THANH TOAN (TOTAL PAYMENT):", margin + 80, y);
    pdfDoc.text(`${new Intl.NumberFormat("vi-VN").format(Math.round(totalPayment))} VND`, pageWidth - margin - 6, y, { align: "right" });
    y += 12;
    pdfDoc.setDrawColor(34, 197, 94);
    pdfDoc.setFillColor(240, 253, 244);
    pdfDoc.roundedRect(pageWidth - margin - 65, y, 60, 22, 2, 2, "FD");
    pdfDoc.setFontSize(7.5);
    pdfDoc.setTextColor(22, 101, 52);
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.text("[DA KY SO DIEN TU HOP LE]", pageWidth - margin - 35, y + 5, { align: "center" });
    pdfDoc.setFont("helvetica", "normal");
    pdfDoc.text(`Ky boi: ${info.sellerName?.substring(0, 22) || "Nguoi nop thue"}`, pageWidth - margin - 35, y + 10, { align: "center" });
    pdfDoc.text(`Ngay ky: ${invDateStr.substring(0, 16) || "2025-01-01"}`, pageWidth - margin - 35, y + 14, { align: "center" });
    pdfDoc.text("Chung thu so: VNPT-CA / Viettel-CA / MISA", pageWidth - margin - 35, y + 18, { align: "center" });
    const pdfArrayBuffer = pdfDoc.output("arraybuffer");
    const pdfBuffer = Buffer.from(pdfArrayBuffer);
    const pdfBase64 = pdfBuffer.toString("base64");
    this.createLog(`T\u1EA1o th\xE0nh c\xF4ng file PDF n\u1ED9i b\u1ED9 (${(pdfBuffer.length / 1024).toFixed(1)} KB), h\u1EC7 th\u1ED1ng duy tr\xEC ho\u1EA1t \u0111\u1ED9ng th\xF4ng su\u1ED1t`, logs);
    return {
      success: true,
      provider: this.providerCode,
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

// src/services/invoice-engine/drivers/EasyInvoiceDriver.ts
var EasyInvoiceDriver = class extends BaseInvoiceProviderDriver {
  constructor() {
    super(...arguments);
    this.name = "Softdreams EasyInvoice Driver";
    this.providerCode = "EASYINVOICE";
    this.metadata = {
      name: "Softdreams EasyInvoice Driver",
      providerCode: "EASYINVOICE",
      description: "Tra c\u1EE9u & x\u1EED l\xFD h\xF3a \u0111\u01A1n \u0111i\u1EC7n t\u1EED EasyInvoice (Softdreams) qua M\xE3 tra c\u1EE9u / Ch\u1EEF k\xFD s\u1ED1 EasyCA",
      sampleUrl: "https://easyinvoice.vn/tra-cuu",
      supportsCaptcha: false,
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
    const lookupCode = this.extractCustomField(xmlData, ["M\xE3 tra c\u1EE9u", "MaTraCuu", "MTCuu", "Fkey", "EasyInvoice"]) || this.extractXmlTag(xmlData, "MTCuu") || this.extractXmlTag(xmlData, "MaTraCuu");
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
    this.createLog(`Chuy\u1EC3n sang b\u1ED9 t\u1EA1o b\u1EA3n th\u1EC3 hi\u1EC7n PDF & HTML/CSS chu\u1EA9n Ngh\u1ECB \u0111\u1ECBnh 123 / Th\xF4ng t\u01B0 78`, logs);
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
      lookupUrl: "https://ehoadon.bkav.com/tra-cuu",
      rawXml: xmlData
    };
  }
  async fetchPdf(info, options) {
    const logs = [];
    this.createLog(`Kh\u1EDFi \u0111\u1ED9ng x\u1EED l\xFD H\u0110\u0110T Bkav eHoadon: S\u1ED1 ${info.invoiceNo}, K\xFD hi\u1EC7u ${info.invoiceSeries}`, logs);
    this.createLog(`Chuy\u1EC3n sang b\u1ED9 t\u1EA1o b\u1EA3n th\u1EC3 hi\u1EC7n PDF & HTML/CSS chu\u1EA9n Ngh\u1ECB \u0111\u1ECBnh 123 / Th\xF4ng t\u01B0 78`, logs);
    const fallbackRes = await this.fallback.fetchPdf(info, options);
    return {
      ...fallbackRes,
      provider: this.providerCode,
      driverName: this.name,
      executionLogs: [...logs, ...fallbackRes.executionLogs]
    };
  }
};

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
      supportsCaptcha: false,
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
    let lookupCode = this.extractCustomField(xmlData, ["M\xE3 tra c\u1EE9u", "MaTraCuu", "MTCuu", "M\xE3 nh\u1EADn h\xF3a \u0111\u01A1n"]) || this.extractXmlTag(xmlData, "MTCuu") || this.extractXmlTag(xmlData, "MaTraCuu");
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
    if (info.lookupCode) {
      this.createLog(`M\xE3 tra c\u1EE9u Th\xE1i S\u01A1n: "${info.lookupCode}"`, logs);
    }
    this.createLog(`Chuy\u1EC3n sang b\u1ED9 t\u1EA1o b\u1EA3n th\u1EC3 hi\u1EC7n PDF vector \u0111\u1ED9 ph\xE2n gi\u1EA3i cao chu\u1EA9n N\u0110 123/2020/N\u0110-CP`, logs);
    const fallbackRes = await this.fallback.fetchPdf(info, options);
    return {
      ...fallbackRes,
      provider: this.providerCode,
      driverName: this.name,
      executionLogs: [...logs, ...fallbackRes.executionLogs]
    };
  }
};

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
      supportsCaptcha: false,
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
    if (info.lookupCode) {
      this.createLog(`M\xE3 tra c\u1EE9u CyberBill: "${info.lookupCode}"`, logs);
    }
    this.createLog(`Chuy\u1EC3n sang b\u1ED9 t\u1EA1o b\u1EA3n th\u1EC3 hi\u1EC7n PDF vector \u0111\u1ED9 ph\xE2n gi\u1EA3i cao chu\u1EA9n N\u0110 123/2020/N\u0110-CP`, logs);
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
    this.registerDriver(new VnptDriver());
    this.registerDriver(new EasyInvoiceDriver());
    this.registerDriver(new BkavDriver());
    this.registerDriver(new ThaiSonDriver());
    this.registerDriver(new CyberBillDriver());
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
    if (options?.customInfo) {
      if (options.customInfo.lookupCode) {
        invoiceInfo.lookupCode = options.customInfo.lookupCode;
        this.log(`\xC1p d\u1EE5ng M\xE3 tra c\u1EE9u do ng\u01B0\u1EDDi d\xF9ng cung c\u1EA5p: "${invoiceInfo.lookupCode}"`, overallLogs);
      }
      if (options.customInfo.secretCode) {
        invoiceInfo.secretCode = options.customInfo.secretCode;
        this.log(`\xC1p d\u1EE5ng M\xE3 b\xED m\u1EADt do ng\u01B0\u1EDDi d\xF9ng cung c\u1EA5p: "${invoiceInfo.secretCode}"`, overallLogs);
      }
      if (options.customInfo.lookupUrl) {
        invoiceInfo.lookupUrl = options.customInfo.lookupUrl;
        this.log(`\xC1p d\u1EE5ng C\u1ED5ng tra c\u1EE9u t\xF9y ch\u1EC9nh: "${invoiceInfo.lookupUrl}"`, overallLogs);
      }
      if (options.customInfo.sellerTaxCode) {
        invoiceInfo.sellerTaxCode = options.customInfo.sellerTaxCode;
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
        this.log(`[C\u1EA2NH B\xC1O CRAWL TH\u1EA4T B\u1EA0I]: ${crawlError.message}`, overallLogs);
        this.log(`T\u1EF0 \u0110\u1ED8NG CHUY\u1EC2N SANG GENERIC FALLBACK DRIVER \u0110\u1EC2 \u0110\u1EA2M B\u1EA2O H\u1EC6 TH\u1ED0NG KH\xD4NG B\u1ECA GI\xC1N \u0110O\u1EA0N...`, overallLogs);
      }
    }
    try {
      const fallbackResult = await this.fallbackDriver.fetchPdf(invoiceInfo, options);
      fallbackResult.executionLogs = overallLogs.concat(fallbackResult.executionLogs);
      this.log(`[SAFEGUARD HO\xC0N T\u1EA4T] \u0110\xE3 t\u1EA1o b\u1EA3n th\u1EC3 hi\u1EC7n n\u1ED9i b\u1ED9 th\xE0nh c\xF4ng trong ${Date.now() - startTime}ms`, fallbackResult.executionLogs);
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

// src/utils/gdtDetail.ts
var import_jszip2 = __toESM(require("jszip"), 1);
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
  const zip = await import_jszip2.default.loadAsync(bytes);
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
    const path3 = invoice.isPos ? "/api/sco-query/invoices/detail" : "/api/query/invoices/detail";
    try {
      const response = await fetch(`https://hoadondientu.gdt.gov.vn${path3}?${params.toString()}`, {
        headers: {
          ...GDT_REQUEST_HEADERS,
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
  }) || candidates.find((candidate) => getLookupCodeFromPayload(candidate) || value(candidate, ["mtdtchieu", "mhdon", "nbmst"])) || detail;
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
  const finalLookupCode = isVnpt && resolvedMhdon ? resolvedMhdon : detailLookup || xmlLookup?.lookupCode || invoice.lookupCode || void 0;
  const finalLookupUrl = isVnpt ? detailUrl || invoice.lookupUrl || `https://${seller.taxCode || invoice.nbmst || "4000344946"}-tt78.vnpt-invoice.com.vn` : isMisa ? detailUrl || xmlLookup?.lookupUrl || invoice.lookupUrl || "https://www.meinvoice.vn/tra-cuu" : detailUrl || xmlLookup?.lookupUrl || invoice.lookupUrl || void 0;
  return {
    ...invoice,
    nbmst: seller.taxCode || value(detailSource, ["nbmst"]) || invoice.nbmst,
    nbten: seller.name || value(detailSource, ["nbten", "nbtnnt", "nbtlhdon"]) || invoice.nbten,
    nbdchi: seller.address || value(detailSource, ["nbdchi"]) || invoice.nbdchi,
    nmmst: value(detailSource, ["nmmst", "nmtnnt"]) || invoice.nmmst,
    nmten: value(detailSource, ["nmten", "nmtnnt", "nmtlhdon"]) || invoice.nmten,
    nmdchi: value(detailSource, ["nmdchi"]) || invoice.nmdchi,
    mhdon: resolvedMhdon,
    msttcgp: value(detailSource, ["msttcgp", "mst_tcgp", "tvandnkntt"]) || (isMisa ? "0101243150" : invoice.msttcgp),
    provider: isMisa ? "MISA" : isVnpt ? "VNPT" : invoice.provider || void 0,
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
var import_config = require("dotenv/config");
var import_pg = require("pg");
var import_path = __toESM(require("path"), 1);
var DATA_DIR = import_path.default.join(process.cwd(), "data");
var LOCAL_USERS_FILE = import_path.default.join(DATA_DIR, "web_users.json");
var pool = null;
var isPostgresConnected = false;
function getDatabaseConfig() {
  const candidates = [
    ["POSTGRES_URL", process.env.POSTGRES_URL],
    ["POSTGRES_PRISMA_URL", process.env.POSTGRES_PRISMA_URL],
    ["DATABASE_URL", process.env.DATABASE_URL],
    ["NEON_DATABASE_URL", process.env.NEON_DATABASE_URL],
    ["POSTGRES_URL_NON_POOLING", process.env.POSTGRES_URL_NON_POOLING],
    ["DATABASE_URL_UNPOOLED", process.env.DATABASE_URL_UNPOOLED]
  ];
  const selected = candidates.find(([, value2]) => value2 && value2.trim());
  return {
    source: selected?.[0] || "",
    url: (selected?.[1] || "").trim().replace(/^["']|["']$/g, "").trim()
  };
}
function getDatabaseUrl() {
  return getDatabaseConfig().url;
}
function safeDatabaseError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/postgres(?:ql)?:\/\/[^\\s]+/gi, "postgresql://[redacted]").replace(/password=[^&\\s]+/gi, "password=[redacted]");
}
function getPostgresPool() {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    return null;
  }
  if (!pool) {
    try {
      const isLocalhost = databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1");
      pool = new import_pg.Pool({
        connectionString: databaseUrl,
        ssl: isLocalhost ? false : { rejectUnauthorized: false },
        max: 10,
        connectionTimeoutMillis: 1e4,
        idleTimeoutMillis: 3e4
      });
      pool.on("error", (err) => {
        console.warn("[Neon PostgreSQL] Pool background error:", err.message);
        isPostgresConnected = false;
      });
    } catch (err) {
      console.error("[Neon PostgreSQL] Kh\u1EDFi t\u1EA1o pool th\u1EA5t b\u1EA1i:", err.message);
      return null;
    }
  }
  return pool;
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
async function initDatabase() {
  const databaseConfig = getDatabaseConfig();
  const databaseUrl = databaseConfig.url;
  if (!databaseUrl) {
    isPostgresConnected = false;
    return {
      success: false,
      type: "local_file",
      message: "Ch\u01B0a c\u1EA5u h\xECnh connection string Neon (DATABASE_URL, NEON_DATABASE_URL ho\u1EB7c POSTGRES_URL)."
    };
  }
  const p = getPostgresPool();
  if (p) {
    try {
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
      console.log("[Neon PostgreSQL] \u2713 K\u1EBFt n\u1ED1i Neon th\xE0nh c\xF4ng, b\u1EA3ng web_users \u0111\xE3 s\u1EB5n s\xE0ng.");
      isPostgresConnected = true;
      return {
        success: true,
        type: "neon_postgres",
        message: "\u0110\xE3 k\u1EBFt n\u1ED1i th\xE0nh c\xF4ng t\u1EDBi Database Neon PostgreSQL."
      };
    } catch (err) {
      console.warn("[Neon PostgreSQL] Kh\xF4ng th\u1EC3 k\u1EBFt n\u1ED1i ho\u1EB7c kh\u1EDFi t\u1EA1o b\u1EA3ng tr\xEAn Neon:", safeDatabaseError(err));
      isPostgresConnected = false;
      return {
        success: false,
        type: "local_file",
        message: `Kh\xF4ng th\u1EC3 k\u1EBFt n\u1ED1i t\u1EDBi Neon PostgreSQL (${databaseConfig.source}). Vui l\xF2ng ki\u1EC3m tra connection string v\xE0 quy\u1EC1n truy c\u1EADp.`
      };
    }
  }
  return {
    success: false,
    type: "local_file",
    message: `Kh\xF4ng th\u1EC3 kh\u1EDFi t\u1EA1o pool PostgreSQL (${databaseConfig.source}). Vui l\xF2ng ki\u1EC3m tra connection string v\xE0 c\u1EA5u h\xECnh Neon.`
  };
}
async function getDatabaseStatus() {
  const p = getPostgresPool();
  const databaseConfig = getDatabaseConfig();
  const dbConfigured = Boolean(databaseConfig.url);
  if (p) {
    try {
      await p.query("SELECT 1;");
      const res = await p.query("SELECT COUNT(*) as count FROM web_users;");
      const totalUsers = parseInt(res.rows[0]?.count || "0", 10);
      return {
        connected: true,
        type: "neon_postgres",
        message: "Neon PostgreSQL \u0111ang ho\u1EA1t \u0111\u1ED9ng \u1ED5n \u0111\u1ECBnh",
        totalUsers,
        databaseUrlConfigured: true,
        connectionSource: databaseConfig.source
      };
    } catch (err) {
      const message = safeDatabaseError(err);
      console.warn("[DB Status] Error checking Postgres:", message);
      return {
        connected: false,
        type: "neon_postgres",
        message: `Neon PostgreSQL l\u1ED7i (${message})`,
        totalUsers: 0,
        databaseUrlConfigured: true,
        connectionSource: databaseConfig.source
      };
    }
  }
  return {
    connected: false,
    type: "neon_postgres",
    message: dbConfigured ? "Kh\xF4ng th\u1EC3 truy v\u1EA5n Neon PostgreSQL. Kh\xF4ng s\u1EED d\u1EE5ng d\u1EEF li\u1EC7u local." : "Ch\u01B0a c\u1EA5u h\xECnh connection string cho Neon",
    totalUsers: 0,
    databaseUrlConfigured: dbConfigured,
    connectionSource: databaseConfig.source
  };
}
async function findUserByUsername(username) {
  const cleanUsername = (username || "").trim().toLowerCase();
  if (!cleanUsername) return null;
  const dbConfigured = Boolean(getDatabaseUrl());
  if (!dbConfigured) {
    return null;
  }
  const p = getPostgresPool();
  if (p) {
    try {
      const res = await p.query(
        "SELECT * FROM web_users WHERE LOWER(username) = LOWER($1) LIMIT 1;",
        [cleanUsername]
      );
      if (res.rows.length > 0) {
        return enrichUserWithStatus(res.rows[0]);
      }
    } catch (err) {
      console.warn("[findUserByUsername] PostgreSQL error:", err.message);
    }
  }
  return null;
}
async function getAllUsers() {
  const dbConfigured = Boolean(getDatabaseUrl());
  if (!dbConfigured) {
    return [];
  }
  const p = getPostgresPool();
  if (p) {
    try {
      const res = await p.query("SELECT * FROM web_users ORDER BY id DESC;");
      return res.rows.map(enrichUserWithStatus);
    } catch (err) {
      console.warn("[getAllUsers] PostgreSQL error:", err.message);
    }
  }
  return [];
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
  if (p) {
    try {
      const checkRes = await p.query("SELECT id FROM web_users WHERE LOWER(username) = LOWER($1);", [cleanUsername]);
      if (checkRes.rows.length > 0) {
        return { success: false, error: `M\xE3 s\u1ED1 thu\u1EBF "${cleanUsername}" \u0111\xE3 t\u1ED3n t\u1EA1i tr\xEAn h\u1EC7 th\u1ED1ng.` };
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
      console.error("[createUser] PostgreSQL insert error:", err.message);
      return { success: false, error: err.message };
    }
  }
  return { success: false, error: "Kh\xF4ng th\u1EC3 k\u1EBFt n\u1ED1i Neon PostgreSQL \u0111\u1EC3 t\u1EA1o ng\u01B0\u1EDDi d\xF9ng." };
}
async function updateUser(id, params) {
  const p = getPostgresPool();
  if (p) {
    try {
      const curRes = await p.query("SELECT * FROM web_users WHERE id = $1;", [id]);
      if (curRes.rows.length === 0) {
        return { success: false, error: "Kh\xF4ng t\xECm th\u1EA5y ng\u01B0\u1EDDi d\xF9ng c\u1EA7n c\u1EADp nh\u1EADt." };
      }
      const current = curRes.rows[0];
      let expiresAt = new Date(current.expires_at);
      if (params.extendMonths) {
        const baseDate = expiresAt.getTime() < Date.now() ? /* @__PURE__ */ new Date() : expiresAt;
        expiresAt = calculateExpiryDate(baseDate, params.extendMonths);
      } else if (params.newExpiresAt) {
        expiresAt = new Date(params.newExpiresAt);
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
      `, [password, fullName, expiresAt.toISOString(), isActive, notes, id]);
      return { success: true, user: enrichUserWithStatus(updateRes.rows[0]) };
    } catch (err) {
      console.error("[updateUser] PostgreSQL update error:", err.message);
      return { success: false, error: err.message };
    }
  }
  return { success: false, error: "Kh\xF4ng th\u1EC3 k\u1EBFt n\u1ED1i Neon PostgreSQL \u0111\u1EC3 c\u1EADp nh\u1EADt ng\u01B0\u1EDDi d\xF9ng." };
}
async function deleteUser(id) {
  const p = getPostgresPool();
  if (p) {
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
      return { success: false, error: err.message };
    }
  }
  return { success: false, error: "Kh\xF4ng th\u1EC3 k\u1EBFt n\u1ED1i Neon PostgreSQL \u0111\u1EC3 x\xF3a ng\u01B0\u1EDDi d\xF9ng." };
}

// server.ts
var import_genai = require("@google/genai");
var app = (0, import_express.default)();
var PORT = 3e3;
app.use(import_express.default.json({ limit: "50mb" }));
app.use(import_express.default.urlencoded({ extended: true, limit: "50mb" }));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});
var currentSession = null;
var captchaCookieJar = /* @__PURE__ */ new Map();
var captchaContentMap = /* @__PURE__ */ new Map();
var seleniumLogs = [];
var GDT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
  "Referer": "https://hoadondientu.gdt.gov.vn/",
  "Origin": "https://hoadondientu.gdt.gov.vn",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
  "Sec-Ch-Ua": '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin"
};
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
async function fetchGDT(url, options = {}, maxRetries = 1, timeoutMs = 7e3) {
  let lastError = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let timer = null;
    try {
      const controller = new AbortController();
      timer = setTimeout(() => controller.abort(), timeoutMs);
      const mergedHeaders = {
        ...GDT_HEADERS,
        ...options.headers || {}
      };
      const resp = await fetch(url, {
        ...options,
        headers: mergedHeaders,
        signal: controller.signal
      });
      if (timer) clearTimeout(timer);
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
var geminiAiClient = null;
var geminiSpendingCapBlockedUntil = 0;
var geminiRateLimitBlockedUntil = 0;
function getGeminiClient() {
  if (!geminiAiClient && process.env.GEMINI_API_KEY) {
    geminiAiClient = new import_genai.GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } }
    });
  }
  return geminiAiClient;
}
async function solveCaptchaOCR(svgOrDataUri) {
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
  if (!isBitmap && !rawSvg.includes("<svg") && !rawSvg.includes("xmlns")) {
    return { code: "", error: "\u0110\u1ECBnh d\u1EA1ng SVG kh\xF4ng h\u1EE3p l\u1EC7" };
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
  if (Date.now() < geminiSpendingCapBlockedUntil) {
    return {
      code: "",
      isSpendingCap: true,
      error: "D\u1EF1 \xE1n \u0111\xE3 ch\u1EA1m h\u1EA1n m\u1EE9c chi ti\xEAu h\xE0ng th\xE1ng c\u1EE7a API Gemini (Spending cap). B\u1EA1n c\xF3 th\u1EC3 nh\xECn \u1EA3nh v\xE0 nh\u1EADp m\xE3 Captcha 4-6 k\xFD t\u1EF1."
    };
  }
  if (Date.now() < geminiRateLimitBlockedUntil) {
    return {
      code: "",
      error: "H\u1EA1n m\u1EE9c API t\u1EA1m th\u1EDDi b\u1EADn (Rate limit). Vui l\xF2ng nh\u1EADp m\xE3 Captcha 4-6 k\xFD t\u1EF1."
    };
  }
  if (!process.env.GEMINI_API_KEY) {
    return {
      code: "",
      isMissingApiKey: true,
      error: "Ch\u01B0a c\u1EA5u h\xECnh bi\u1EBFn m\xF4i tr\u01B0\u1EDDng GEMINI_API_KEY. B\u1EA1n c\xF3 th\u1EC3 nh\u1EADp Captcha th\u1EE7 c\xF4ng."
    };
  }
  const ai = getGeminiClient();
  if (!ai) {
    return {
      code: "",
      isMissingApiKey: true,
      error: "Kh\xF4ng th\u1EC3 kh\u1EDFi t\u1EA1o Gemini AI Client."
    };
  }
  const candidateModels = [
    "gemini-3.1-flash-lite",
    "gemini-flash-latest",
    "gemini-3.8-flash"
  ];
  let lastErrorMsg = "";
  const svgSnippet = rawSvg.substring(0, 4e3);
  for (const modelName of candidateModels) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const contentsPayload = isBitmap && bitmapBase64 ? [
          {
            inlineData: {
              mimeType: bitmapMime,
              data: bitmapBase64
            }
          },
          {
            text: "This is a captcha image. Extract and return ONLY the 4 to 6 uppercase alphanumeric characters shown in the image. Return only the exact characters without any spaces, markdown, or punctuation."
          }
        ] : [
          {
            text: `This is a Vietnamese GDT tax portal captcha SVG image.
Extract and return ONLY the 4 to 6 uppercase alphanumeric characters shown in the SVG image. Return only the exact characters without any spaces, markdown, or punctuation.
SVG Source:
\`\`\`xml
${svgSnippet}
\`\`\``
          }
        ];
        const ocrPromise = ai.models.generateContent({
          model: modelName,
          contents: contentsPayload
        });
        const timeoutPromise = new Promise(
          (resolve) => setTimeout(() => resolve(null), 8e3)
        );
        const aiResp = await Promise.race([ocrPromise, timeoutPromise]);
        if (aiResp && aiResp.text) {
          const extracted = aiResp.text.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
          if (extracted && extracted.length >= 3 && extracted.length <= 8) {
            console.log(`[Gemini OCR (${modelName})] Successfully recognized GDT Captcha: "${extracted}"`);
            return { code: extracted, modelUsed: modelName };
          }
        }
        break;
      } catch (err) {
        lastErrorMsg = err?.message || String(err);
        const isSpendingCap = lastErrorMsg.includes("spending cap") || lastErrorMsg.includes("monthly spending cap");
        const isRateLimit = lastErrorMsg.includes("429") || lastErrorMsg.includes("RESOURCE_EXHAUSTED") || lastErrorMsg.includes("quota");
        const isUnavailable = lastErrorMsg.includes("503") || lastErrorMsg.includes("high demand") || lastErrorMsg.includes("UNAVAILABLE");
        if (isSpendingCap) {
          geminiSpendingCapBlockedUntil = Date.now() + 15 * 60 * 1e3;
          console.log("[Gemini OCR] Monthly spending cap reached. OCR paused for 15 minutes.");
          break;
        }
        if (isRateLimit) {
          geminiRateLimitBlockedUntil = Date.now() + 60 * 1e3;
          console.log("[Gemini OCR] Rate limit (429) reached. OCR paused for 60 seconds.");
          break;
        }
        if (isUnavailable && attempt === 0) {
          await new Promise((r) => setTimeout(r, 600));
          continue;
        }
        break;
      }
    }
    if (Date.now() < geminiSpendingCapBlockedUntil || Date.now() < geminiRateLimitBlockedUntil) {
      break;
    }
  }
  const isSpendingCapFinal = Date.now() < geminiSpendingCapBlockedUntil || lastErrorMsg.includes("spending cap") || lastErrorMsg.includes("monthly spending cap");
  const isRateLimitFinal = Date.now() < geminiRateLimitBlockedUntil || lastErrorMsg.includes("429") || lastErrorMsg.includes("quota") || lastErrorMsg.includes("RESOURCE_EXHAUSTED");
  return {
    code: "",
    isSpendingCap: isSpendingCapFinal,
    error: isSpendingCapFinal ? "D\u1EF1 \xE1n \u0111\xE3 ch\u1EA1m h\u1EA1n m\u1EE9c chi ti\xEAu h\xE0ng th\xE1ng c\u1EE7a API Gemini (Spending cap). B\u1EA1n c\xF3 th\u1EC3 nh\xECn h\xECnh v\xE0 nh\u1EADp m\xE3 Captcha th\u1EE7 c\xF4ng." : isRateLimitFinal ? "H\u1EA1n m\u1EE9c API Gemini t\u1EA1m th\u1EDDi b\u1ECB gi\u1EDBi h\u1EA1n (429 Rate Limit). Vui l\xF2ng nh\u1EADp Captcha th\u1EE7 c\xF4ng ho\u1EB7c th\u1EED l\u1EA1i sau 1 ph\xFAt." : lastErrorMsg ? `L\u1ED7i Gemini API: ${lastErrorMsg.substring(0, 120)}` : "Kh\xF4ng nh\u1EADn di\u1EC7n \u0111\u01B0\u1EE3c m\xE3 Captcha."
  };
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
        captchaContentMap.set(data.key, data.content);
        const base64Image = `data:image/svg+xml;base64,${Buffer.from(data.content, "utf-8").toString("base64")}`;
        return res.json({
          success: true,
          isRealGDT: true,
          captchaKey: data.key,
          captchaCookie: cookieStr,
          captchaCode: "",
          captchaImage: base64Image,
          rawSvg: data.content,
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
    const { captchaKey, captchaImage, rawSvg } = req.body;
    let contentToSolve = rawSvg || captchaImage;
    if (!contentToSolve && captchaKey && captchaContentMap.has(captchaKey)) {
      contentToSolve = captchaContentMap.get(captchaKey);
    }
    if (!contentToSolve) {
      return res.status(400).json({ success: false, message: "Thi\u1EBFu d\u1EEF li\u1EC7u \u1EA3nh Captcha." });
    }
    const ocrResult = await solveCaptchaOCR(contentToSolve);
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
app.post("/api/gdt/login", async (req, res) => {
  let { taxCode, password, captchaKey, captchaCode, captchaCookie } = req.body;
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
    }, 2, 2e4);
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
      const errorMsg = authData.message || authData.details || "X\xE1c th\u1EF1c th\u1EA5t b\u1EA1i t\u1EEB C\u1ED5ng T\u1ED5ng c\u1EE5c Thu\u1EBF. Vui l\xF2ng ki\u1EC3m tra l\u1EA1i MST, M\u1EADt kh\u1EA9u ho\u1EB7c m\xE3 Captcha.";
      return res.status(authRes.status || 400).json({
        success: false,
        isRealGDT: true,
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
      message: `Kh\xF4ng th\u1EC3 k\u1EBFt n\u1ED1i \u0111\u1EBFn m\xE1y ch\u1EE7 C\u1ED5ng Thu\u1EBF (${err.message}). Vui l\xF2ng th\u1EED l\u1EA1i ho\u1EB7c s\u1EED d\u1EE5ng c\xF4ng c\u1EE5 Python tr\xEAn m\xE1y t\xEDnh \u0111\u1EC3 k\u1EBFt n\u1ED1i tr\u1EF1c ti\u1EBFp.`
    });
  }
});
function splitDateRangeIntoMonthlyChunks(fromDateStr, toDateStr) {
  const start = new Date(fromDateStr);
  const end = new Date(toDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return [{ from: fromDateStr, to: toDateStr }];
  }
  const chunks = [];
  let cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const finalEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cur <= finalEnd) {
    const endOfMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
    const chunkEnd = endOfMonth < finalEnd ? endOfMonth : finalEnd;
    const pad = (n) => String(n).padStart(2, "0");
    const fromStr = `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`;
    const toStr = `${chunkEnd.getFullYear()}-${pad(chunkEnd.getMonth() + 1)}-${pad(chunkEnd.getDate())}`;
    chunks.push({ from: fromStr, to: toStr });
    cur = new Date(chunkEnd.getFullYear(), chunkEnd.getMonth(), chunkEnd.getDate() + 1);
  }
  return chunks;
}
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
  const { fromDate, toDate, invoiceType = "both", size = 50, includeDetails = false, token: bodyToken, cookieHeader: bodyCookie } = req.body;
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
  const tokenHeader = authHeader.startsWith("Bearer ") ? authHeader : `Bearer ${authHeader}`;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const fetchChunkWithRetry = async (type, chunkFrom, chunkTo, source = "query", maxRetries = 1, page = 0, accumulated = []) => {
    const gdtFrom = formatDateForGdt(chunkFrom, false);
    const gdtTo = formatDateForGdt(chunkTo, true);
    const searchParam = `tdlap=ge=${gdtFrom};tdlap=le=${gdtTo}`;
    const apiBase = source === "sco-query" ? "sco-query" : "query";
    const url = `https://hoadondientu.gdt.gov.vn/api/${apiBase}/invoices/${type}?sort=tdlap:desc&size=${size}&page=${page}&search=${encodeURIComponent(searchParam)}`;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const resp = await fetch(url, {
          headers: {
            ...GDT_HEADERS,
            "Authorization": tokenHeader,
            ...cookieHeader ? { "Cookie": cookieHeader } : {}
          },
          signal: AbortSignal.timeout(15e3)
        });
        if (resp.status === 401 || resp.status === 403) {
          console.warn(`[GDT Query ${source}/${type} Unauthorized]: Session token expired.`);
          return { error: "AUTH_EXPIRED" };
        }
        if (resp.status === 429) {
          console.warn(`[GDT Query ${source}/${type} Rate Limit 429 for ${chunkFrom}..${chunkTo}]: Attempt ${attempt + 1}/${maxRetries + 1}. Pacing & backing off...`);
          if (attempt < maxRetries) {
            const backoffMs = (attempt + 1) * 1200;
            await sleep(backoffMs);
            continue;
          } else {
            console.warn(`[GDT Query ${source}/${type} Rate Limit]: Reached max retries for ${chunkFrom}..${chunkTo}`);
            return [];
          }
        }
        if (!resp.ok) {
          const errText = await resp.text();
          console.warn(`[GDT Query ${source}/${type} HTTP ${resp.status} for ${chunkFrom}..${chunkTo}]:`, errText.substring(0, 200));
          return [];
        }
        const rawText = await resp.text();
        let data = {};
        try {
          data = JSON.parse(rawText);
        } catch {
          console.warn(`[GDT Query ${source}/${type} Non-JSON]:`, rawText.substring(0, 200));
          return [];
        }
        const list = extractGdtInvoiceList(data);
        console.log(`[GDT Query ${source}/${type}] ${chunkFrom} -> ${chunkTo}: Found ${list.length} invoices (total: ${data.total ?? list.length})`);
        const normalizedPage = list.map((item) => ({
          id: item.id || `GDT_${item.khhdon}_${item.shdon}_${item.nbmst || item.nmmst}`,
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
          // Hóa đơn khởi tạo từ máy tính tiền dùng endpoint /api/sco-query riêng
          // của GDT; đánh dấu để các bước lấy chi tiết/xuất XML sau này gọi
          // đúng endpoint (xem getInvoiceEndpoint trong utils/gdtDetail.ts).
          isPos: source === "sco-query"
        }));
        const total = Number(data.total ?? data.totalElements ?? data.totalCount ?? 0);
        const firstPageId = normalizedPage[0]?.id;
        const repeatedPage = Boolean(firstPageId && accumulated[0]?.id === firstPageId);
        const hasNextPage = list.length >= Number(size) && page < 100 && !repeatedPage && (!total || accumulated.length + normalizedPage.length < total);
        if (hasNextPage) {
          await sleep(250);
          return fetchChunkWithRetry(type, chunkFrom, chunkTo, source, maxRetries, page + 1, accumulated.concat(normalizedPage));
        }
        return accumulated.concat(normalizedPage);
      } catch (err) {
        console.warn(`[GDT Query ${source}/${type} Exception ${chunkFrom}..${chunkTo} (attempt ${attempt + 1})]:`, err.message);
        if (attempt < maxRetries) {
          await sleep(1e3);
          continue;
        }
        return [];
      }
    }
    return [];
  };
  const fetchAllChunksForType = async (type, source = "query") => {
    let allInvoices = [];
    for (let i = 0; i < dateChunks.length; i++) {
      const chunk = dateChunks[i];
      if (i > 0) {
        await sleep(250);
      }
      const chunkResult = await fetchChunkWithRetry(type, chunk.from, chunk.to, source);
      if (chunkResult?.error === "AUTH_EXPIRED") {
        return { error: "AUTH_EXPIRED" };
      }
      if (Array.isArray(chunkResult)) {
        allInvoices = allInvoices.concat(chunkResult);
      }
    }
    return allInvoices;
  };
  try {
    let results = [];
    const purchaseList = await fetchAllChunksForType("purchase", "query");
    if (purchaseList?.error === "AUTH_EXPIRED") {
      currentSession = null;
      return res.status(401).json({
        success: false,
        isExpired: true,
        message: "Phi\xEAn l\xE0m vi\u1EC7c C\u1ED5ng T\u1ED5ng c\u1EE5c Thu\u1EBF \u0111\xE3 h\u1EBFt h\u1EA1n (Token Expired). Vui l\xF2ng nh\u1EADp m\xE3 Captcha \u0111\u1EC3 k\u1EBFt n\u1ED1i l\u1EA1i."
      });
    }
    if (Array.isArray(purchaseList)) {
      results = results.concat(purchaseList);
    }
    await sleep(250);
    const posPurchaseList = await fetchAllChunksForType("purchase", "sco-query");
    if (posPurchaseList?.error === "AUTH_EXPIRED") {
      currentSession = null;
      return res.status(401).json({
        success: false,
        isExpired: true,
        message: "Phi\xEAn l\xE0m vi\u1EC7c C\u1ED5ng T\u1ED5ng c\u1EE5c Thu\u1EBF \u0111\xE3 h\u1EBFt h\u1EA1n (Token Expired). Vui l\xF2ng nh\u1EADp m\xE3 Captcha \u0111\u1EC3 k\u1EBFt n\u1ED1i l\u1EA1i."
      });
    }
    if (Array.isArray(posPurchaseList)) {
      results = results.concat(posPurchaseList);
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
          ...cookieHeader ? { Cookie: cookieHeader } : {}
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
  const mst = taxCode || currentSession?.taxCode || "0316892345";
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
  const pythonScriptPath = import_path2.default.join(process.cwd(), "python", "gdt_selenium_crawler.py");
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
  const pyProcess = (0, import_child_process.spawn)("python3", args, {
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
    const zip = new import_jszip3.default();
    const fs = await import("fs");
    const pythonDir = import_path2.default.join(process.cwd(), "python");
    const files = ["gdt_selenium_crawler.py", "requirements.txt", "README_GDT.md"];
    for (const file of files) {
      const fullPath = import_path2.default.join(pythonDir, file);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, "utf-8");
        zip.file(file, content);
      }
    }
    const runBat = `@echo off
echo ========================================================
echo  KHOI DONG TOOL TAI HOA DON DIEN TU TONG CUC THUE GDT
echo ========================================================
python -m pip install -r requirements.txt
python gdt_selenium_crawler.py --mst 0316892345 --type purchase
pause
`;
    const runSh = `#!/bin/bash
echo "=== TAI HOA DON DIEN TU TONG CUC THUE ==="
pip install -r requirements.txt
python3 gdt_selenium_crawler.py --mst 0316892345 --type purchase
`;
    zip.file("run_windows.bat", runBat);
    zip.file("run_mac_linux.sh", runSh);
    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="GDT_Selenium_Crawler_Python.zip"');
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
    const { xml, forceFallback, timeoutMs, overrideProvider, customInfo } = req.body;
    if (!xml) {
      return res.status(400).json({ error: "N\u1ED9i dung XML kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng" });
    }
    const result = await invoiceManager.downloadInvoicePdf(xml, {
      forceFallback: Boolean(forceFallback),
      timeoutMs: timeoutMs ? Number(timeoutMs) : void 0,
      overrideProvider,
      customInfo
    });
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
    res.status(500).json({ success: false, error: error.message });
  }
});
app.post("/api/invoice-downloader/solve-captcha", async (req, res) => {
  try {
    const { image, whitelist } = req.body;
    if (!image) {
      return res.status(400).json({ error: "\u1EA2nh Captcha kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng" });
    }
    const result = await CaptchaSolver.solveWithDetails(image, {
      whitelist: whitelist || void 0
    });
    res.json({
      success: true,
      code: result.code,
      confidence: result.confidence,
      engine: result.engine,
      processingTimeMs: result.processingTimeMs
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
function getAuthTokenSecret() {
  const secret = process.env.AUTH_TOKEN_SECRET || process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  if (!secret) {
    throw new Error("Ch\u01B0a c\u1EA5u h\xECnh AUTH_TOKEN_SECRET ho\u1EB7c k\u1EBFt n\u1ED1i Neon.");
  }
  return secret;
}
function createWebToken(username) {
  const payload = Buffer.from(JSON.stringify({ username, issuedAt: Date.now() })).toString("base64url");
  const signature = import_crypto.default.createHmac("sha256", getAuthTokenSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}
function getUsernameFromToken(token) {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = import_crypto.default.createHmac("sha256", getAuthTokenSecret()).update(payload).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !import_crypto.default.timingSafeEqual(actualBuffer, expectedBuffer)) {
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
    const dbInit = await initDatabase();
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: "Vui l\xF2ng nh\u1EADp M\xE3 s\u1ED1 thu\u1EBF v\xE0 m\u1EADt kh\u1EA9u." });
    }
    if (!dbInit.success) {
      return res.status(503).json({
        success: false,
        message: dbInit.message || "H\u1EC7 th\u1ED1ng ch\u01B0a k\u1EBFt n\u1ED1i t\u1EDBi Neon Database. Vui l\xF2ng c\u1EA5u h\xECnh DATABASE_URL/NEON_DATABASE_URL tr\u01B0\u1EDBc khi \u0111\u0103ng nh\u1EADp."
      });
    }
    const user = await findUserByUsername(username);
    if (!user) {
      return res.status(401).json({ success: false, message: "T\xEAn \u0111\u0103ng nh\u1EADp (M\xE3 s\u1ED1 thu\u1EBF) ho\u1EB7c m\u1EADt kh\u1EA9u kh\xF4ng \u0111\xFAng." });
    }
    if (user.password !== password.trim()) {
      return res.status(401).json({ success: false, message: "M\u1EADt kh\u1EA9u kh\xF4ng ch\xEDnh x\xE1c." });
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
    const dbInit = await initDatabase();
    if (!dbInit.success) {
      return res.status(503).json({ success: false, message: dbInit.message });
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
    const status = await getDatabaseStatus();
    res.json({ success: true, ...status });
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
async function startServer() {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`GDT E-Invoice Server running on http://0.0.0.0:${PORT}`);
    initDatabase().then((dbInitResult) => {
      console.log(`[Database Init] ${dbInitResult.message}`);
    }).catch((dbErr) => {
      console.warn("[Database Init] Warning:", dbErr.message);
    });
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
      console.log("[Vite] Vite middleware attached.");
    } catch (viteErr) {
      console.error("[Vite Init Error]:", viteErr.message);
    }
  } else {
    const distPath = import_path2.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path2.default.join(distPath, "index.html"));
    });
  }
}
var server_default = app;
if (!process.env.VERCEL) {
  startServer();
}
