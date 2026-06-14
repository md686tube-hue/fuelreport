import { useState, useEffect, useCallback } from "react";

/* ══ Bengali helpers ══ */
const BN = ["০","১","২","৩","৪","৫","৬","৭","৮","৯"];
const toBn = (n) => String(n).replace(/[0-9]/g, d => BN[+d]);
const toEn = (s) => String(s).replace(/[০-৯]/g, d => String(BN.indexOf(d)));
const BN_MONTHS = ["জানুয়ারি","ফেব্রুয়ারি","মার্চ","এপ্রিল","মে","জুন","জুলাই","আগস্ট","সেপ্টেম্বর","অক্টোবর","নভেম্বর","ডিসেম্বর"];
const fmtDate = (s) => {
  if (!s) return "";
  const [y,m,d] = s.split("-");
  return `${toBn(parseInt(d))} ${BN_MONTHS[+m-1]} ${toBn(y)}`;
};
const todayStr = () => new Date().toISOString().split("T")[0];

/* ══ Constants ══ */
const STATIONS = [
  { id:1,  name:"জীবননগর ফিলিং স্টেশন জীবননগর, চুয়াডাঙ্গা" },
  { id:2,  name:"নাসিম ফিলিং স্টেশন, দত্তনগর রোড, জীবননগর, চুয়াডাঙ্গা" },
  { id:3,  name:"পিয়াস ফিলিং স্টেশন, দেহাটি জীবননগর, চুয়াডাঙ্গা" },
  { id:4,  name:"উৎসব ফিলিং স্টেশন, লক্ষীপুর জীবননগর, চুয়াডাঙ্গা" },
  { id:5,  name:"অংগন ফিলিং স্টেশন, সন্তোষপুর জীবননগর, চুয়াডাঙ্গা" },
  { id:6,  name:"মেসার্স লিমা ফিলিং স্টেশন, হাসাদাহ জীবননগর" },
  { id:7,  name:"মেসার্স এ এম এন্ড সন্স উথলী বাসস্ট্যান্ড, জীবননগর" },
  { id:8,  name:"মেসার্স এম.পিএল ট্রেডার্স হাসাদাহ" },
  { id:9,  name:"মেসার্স মওলা ট্রেডার্স হাসাদাহ জনাব মোঃ ইয়াছীন আলী" },
  { id:10, name:"মেসার্স আব্দুস সাত্তার জীবননগর বাজার" },
  { id:11, name:"মেসার্স আব্দুল আলিম জীবননগর বাজার" },
  { id:12, name:"মেসার্স মোস্তফা অটোমোবাইলস, জীবননগর বাজার" },
];
const FUELS     = ["diesel","petrol","octane"];
const FUEL_LBL  = { diesel:"ডিজেল", petrol:"পেট্রোল", octane:"অকটেন" };
const FIELDS    = ["prev","received","sales","closing"];
const FIELD_LBL = { prev:"পূর্বের মজুদ(লিঃ)", received:"ডিপো হতে গ্রহণ (লিঃ)", sales:"বিক্রয়(লিঃ)", closing:"সমাপনী মজুদ(লিঃ)" };

/* ══ Storage ══ */
/* ══ Cloud Storage (JSONBin.io — মাস ভিত্তিক আলাদা bin, registry pattern) ══
   HOW TO SETUP:
   1. Go to https://jsonbin.io → Sign up free
   2. Create a new bin with content: {}
   3. Copy the Bin ID and your Master Key
   4. Replace the values below:

   এই বিনটি (JSONBIN_BIN_ID) এখন থেকে "রেজিস্ট্রি" — শুধু
   { "months": { "2026-06": "<binId>", "2026-07": "<binId>", ... } }
   ধরনের একটা ছোট ম্যাপিং রাখে। প্রতি মাসের আসল ডেটা থাকে আলাদা আলাদা ছোট bin-এ,
   ফলে কোনো একটা bin কখনো বড় হয়ে সাইজ-লিমিটে আটকায় না।

   প্রথমবার এই কোড চালানোর সময়, যদি এই বিনে পুরনো ফরম্যাটের ডেটা
   (যেমন { "2026-06-01": [...], "2026-06-09": [...] }) পাওয়া যায়,
   সেটা স্বয়ংক্রিয়ভাবে মাস অনুযায়ী আলাদা bin-এ ভাগ করে মাইগ্রেট করা হবে —
   পুরনো কোনো তারিখের তথ্য হারাবে না।
══════════════════════════════════════════════════════════════ */
const JSONBIN_MASTER_KEY = "$2a$10$6mzcIScdz0Uiz6jyfLlwfuuiORj6w/tmJmtW5eJ2iVLKfoq9Hz1ea";
const JSONBIN_BIN_ID     = "69ee27da36566621a8f32dda"; // রেজিস্ট্রি বিন

const _getKey   = () => localStorage.getItem("fuel_mk")   || JSONBIN_MASTER_KEY;
const _getBinId = () => localStorage.getItem("fuel_binid") || JSONBIN_BIN_ID;

const monthKey = (d) => d.slice(0,7); // "YYYY-MM"
const _hdr = (key) => ({ "Content-Type":"application/json", "X-Master-Key": key });

const _readBin = async (binId, key) => {
  const res = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
    headers: { "X-Master-Key": key, "X-Bin-Meta": "false" }
  });
  if (!res.ok) throw new Error("HTTP "+res.status);
  return await res.json();
};

const _writeBin = (binId, key, data) =>
  fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
    method: "PUT", headers: _hdr(key), body: JSON.stringify(data)
  });

const _createBin = async (key, name, data) => {
  const res = await fetch("https://api.jsonbin.io/v3/b", {
    method: "POST",
    headers: { ..._hdr(key), "X-Bin-Name": name },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error("HTTP "+res.status);
  const j = await res.json();
  return j.metadata.id;
};

/* রেজিস্ট্রি বিন থেকে মাস-ভিত্তিক bin ম্যাপিং পড়ে, প্রতিটা মাসের bin লোড করে
   একসাথে মার্জ করে রিটার্ন করে। পুরনো ফরম্যাট পেলে অটো-মাইগ্রেট করে। */
const loadAll = async () => {
  const key = _getKey(); const regBinId = _getBinId();
  if (!key || !regBinId) return {};

  let reg;
  try { reg = await _readBin(regBinId, key); } catch(e) {
    console.error("registry load failed:", e); return {};
  }

  // নতুন ফরম্যাট (রেজিস্ট্রি) — সরাসরি প্রতিটা মাসের bin লোড করো
  if (reg && typeof reg==="object" && reg.months && typeof reg.months==="object") {
    let all = {};
    for (const mk of Object.keys(reg.months)) {
      try { all = { ...all, ...(await _readBin(reg.months[mk], key)) }; }
      catch(e){ console.error("month bin load failed:", mk, e); }
    }
    return all;
  }

  // পুরনো ফরম্যাট: { "2026-06-01": [...], ... } → মাস অনুযায়ী ভাগ করে মাইগ্রেট করো
  const oldData = (reg && typeof reg==="object") ? reg : {};
  const dateKeys = Object.keys(oldData).filter(k=>/^\d{4}-\d{2}-\d{2}$/.test(k));
  if (dateKeys.length > 0) {
    const byMonth = {};
    dateKeys.forEach(d => { (byMonth[monthKey(d)] ??= {})[d] = oldData[d]; });
    const months = {};
    let ok = true;
    for (const mk of Object.keys(byMonth)) {
      try { months[mk] = await _createBin(key, `fuel_${mk}`, byMonth[mk]); }
      catch(e){ console.error("migration bin create failed:", mk, e); ok=false; }
    }
    if (ok) {
      try {
        const res = await _writeBin(regBinId, key, { months });
        if (!res.ok) console.error("registry write failed:", res.status);
      } catch(e){ console.error("registry write failed:", e); }
    }
  }
  return oldData;
};

/* শুধু changedDate যে মাসে পড়ে, সেই মাসের bin-টাই সেভ করে (না থাকলে নতুন বানায়) */
const saveAll = async (allData, changedDate) => {
  const key = _getKey(); const regBinId = _getBinId();
  if (!key || !regBinId) return;
  const mk = monthKey(changedDate);

  let reg;
  try { reg = await _readBin(regBinId, key); } catch(e) {
    alert("সংরক্ষণ ব্যর্থ! রেজিস্ট্রি পড়া যায়নি: "+e.message); return;
  }
  const months = (reg && reg.months && typeof reg.months==="object") ? {...reg.months} : {};

  const monthData = {};
  Object.keys(allData).forEach(d => { if (monthKey(d)===mk) monthData[d]=allData[d]; });

  try {
    if (!months[mk]) {
      months[mk] = await _createBin(key, `fuel_${mk}`, monthData);
      const res = await _writeBin(regBinId, key, { months });
      if (!res.ok) alert("সংরক্ষণ ব্যর্থ! রেজিস্ট্রি Status: "+res.status);
    } else {
      const res = await _writeBin(months[mk], key, monthData);
      if (!res.ok) alert("সংরক্ষণ ব্যর্থ! Status: "+res.status);
    }
  } catch(e) { console.error("save failed:", e); alert("সংরক্ষণ ব্যর্থ: "+e.message); }
};

/* ══ Helpers ══ */
const emptyRow  = () => ({ diesel:{prev:"",received:"",sales:"",closing:""}, petrol:{prev:"",received:"",sales:"",closing:""}, octane:{prev:"",received:"",sales:"",closing:""} });
const emptyData = () => STATIONS.map(s => ({ stationId:s.id, ...emptyRow() }));

const calcTotal = (rows, fuel, field) => {
  const s = rows.reduce((a,r) => { const n=parseInt(toEn(r[fuel][field])); return a+(isNaN(n)?0:n); }, 0);
  return s > 0 ? toBn(s) : "-";
};

const loadScript = (src) => new Promise((res,rej) => {
  if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
  const s = document.createElement("script"); s.src=src; s.onload=res; s.onerror=rej; document.head.appendChild(s);
});

/* ══════════════════════════════════════════
   DOCX download  (pure JS – no CDN needed)
══════════════════════════════════════════ */
async function downloadDocx(dateStr, rows) {
  const totals = {};
  FUELS.forEach(f=>{totals[f]={};FIELDS.forEach(fi=>{totals[f][fi]=calcTotal(rows,f,fi);});});

  const esc = t => String(t)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&apos;");

  const bdr = `<w:top w:val="single" w:sz="4" w:color="000000"/><w:left w:val="single" w:sz="4" w:color="000000"/><w:bottom w:val="single" w:sz="4" w:color="000000"/><w:right w:val="single" w:sz="4" w:color="000000"/>`;
  const noBdr = `<w:top w:val="none" w:sz="0" w:color="FFFFFF"/><w:left w:val="none" w:sz="0" w:color="FFFFFF"/><w:bottom w:val="none" w:sz="0" w:color="FFFFFF"/><w:right w:val="none" w:sz="0" w:color="FFFFFF"/>`;

  const cell = (text, {rs=1,cs=1,bold=false,sz=20,left=false,w=null,shade=null,nb=false}={}) => {
    const wPr = w ? `<w:tcW w:w="${w}" w:type="dxa"/>` : "";
    const shPr = shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${shade}"/>` : `<w:shd w:val="clear" w:color="auto" w:fill="FFFFFF"/>`;
    const span = cs>1 ? `<w:gridSpan w:val="${cs}"/>` : "";
    const rspan = rs>1 ? `<w:vMerge w:val="restart"/>` : "";
    const align = left ? "left" : "center";
    return `<w:tc>
      <w:tcPr>${wPr}<w:tcBorders>${nb?noBdr:bdr}</w:tcBorders>${shPr}${span}${rspan}<w:vAlign w:val="center"/>
        <w:tcMar><w:top w:w="50" w:type="dxa"/><w:bottom w:w="50" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar>
      </w:tcPr>
      <w:p><w:pPr><w:jc w:val="${align}"/></w:pPr>
        <w:r><w:rPr><w:rFonts w:ascii="Nikosh" w:hAnsi="Nikosh" w:cs="Nikosh"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>${bold?'<w:b/>':''}</w:rPr>
          <w:t xml:space="preserve">${esc(text)}</w:t>
        </w:r>
      </w:p></w:tc>`;
  };

  const vcell = (text,{cs=1,bold=false,sz=20,w=null,shade=null}={}) => {
    const wPr = w ? `<w:tcW w:w="${w}" w:type="dxa"/>` : "";
    const shPr = shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${shade}"/>` : `<w:shd w:val="clear" w:color="auto" w:fill="FFFFFF"/>`;
    const span = cs>1 ? `<w:gridSpan w:val="${cs}"/>` : "";
    return `<w:tc>
      <w:tcPr>${wPr}<w:tcBorders>${bdr}</w:tcBorders>${shPr}${span}<w:vMerge/><w:vAlign w:val="center"/>
        <w:tcMar><w:top w:w="50" w:type="dxa"/><w:bottom w:w="50" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar>
      </w:tcPr>
      <w:p><w:pPr><w:jc w:val="center"/></w:pPr></w:p></w:tc>`;
  };

  const row = (...cells) => `<w:tr>${cells.join("")}</w:tr>`;
  const para = (text,{bold=false,sz=24,align="center",after=120}={}) =>
    `<w:p><w:pPr><w:jc w:val="${align}"/><w:spacing w:after="${after}"/></w:pPr>
      <w:r><w:rPr><w:rFonts w:ascii="Nikosh" w:hAnsi="Nikosh" w:cs="Nikosh"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>${bold?'<w:b/>':''}</w:rPr>
        <w:t>${esc(text)}</w:t></w:r></w:p>`;

  const PAGE_W = 12816;
  const S=550, U=800, N=2250;
  const D = Math.floor((PAGE_W - S - U - N) / 12);

  const tableXml = `<w:tbl>
    <w:tblPr><w:tblW w:w="${PAGE_W}" w:type="dxa"/><w:tblLayout w:type="fixed"/>
      <w:tblBorders>${bdr}</w:tblBorders></w:tblPr>
    <w:tblGrid>${[S,U,N,...Array(12).fill(D)].map(w=>`<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>
    ${row(
      cell("ক্রঃনং",       {rs:2,bold:true,sz:18,w:S}),
      cell("উপজেলা",       {rs:2,bold:true,sz:18,w:U}),
      cell("প্রতিষ্ঠানের নাম",{rs:2,bold:true,sz:18,w:N,left:true}),
      cell("ডিজেল",  {cs:4,bold:true,sz:20,w:D*4}),
      cell("পেট্রোল",{cs:4,bold:true,sz:20,w:D*4}),
      cell("অকটেন",  {cs:4,bold:true,sz:20,w:D*4}),
    )}
    ${row(
      vcell("",{w:S}), vcell("",{w:U}), vcell("",{w:N}),
      ...FUELS.flatMap(()=>FIELDS.map(fi=>cell(FIELD_LBL[fi],{sz:16,w:D})))
    )}
    ${STATIONS.map((s,i)=>row(
      cell(toBn(String(i+1).padStart(2,"0")),{sz:20,w:S}),
      cell(i===0?"জীবননগর":"",{sz:20,w:U}),
      cell(s.name,{sz:18,w:N,left:true}),
      ...FUELS.flatMap(f=>FIELDS.map(fi=>cell(rows[i][f][fi]||"-",{sz:20,w:D})))
    )).join("")}
    ${row(
      cell("সর্বমোট",{cs:3,bold:true,sz:20,w:S+U+N}),
      ...FUELS.flatMap(f=>FIELDS.map(fi=>cell(totals[f][fi],{bold:true,sz:20,w:D})))
    )}
  </w:tbl>`;

  const sigXml = `<w:tbl>
    <w:tblPr><w:tblW w:w="${PAGE_W}" w:type="dxa"/>
      <w:tblBorders><w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/><w:insideH w:val="none"/><w:insideV w:val="none"/></w:tblBorders>
    </w:tblPr>
    <w:tblGrid><w:gridCol w:w="${PAGE_W/2}"/><w:gridCol w:w="${PAGE_W/2}"/></w:tblGrid>
    <w:tr>
      <w:tc><w:tcPr><w:tcW w:w="${PAGE_W/2}" w:type="dxa"/><w:tcBorders>${noBdr}</w:tcBorders></w:tcPr><w:p/></w:tc>
      <w:tc><w:tcPr><w:tcW w:w="${PAGE_W/2}" w:type="dxa"/><w:tcBorders>${noBdr}</w:tcBorders></w:tcPr>
        ${para("উপজেলা নির্বাহী অফিসার",{sz:22,after:60})}
        ${para("জীবননগর, চুয়াডাঙ্গা।",{sz:22,after:0})}
      </w:tc>
    </w:tr>
  </w:tbl>`;

  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:body>
  ${para("উপজেলা: জীবননগর",{bold:true,sz:28,after:80})}
  ${para("জ্বালানী তেলের দৈনিক রিপোর্ট",{bold:true,sz:26,after:80})}
  ${para("তারিখ: "+fmtDate(dateStr),{sz:24,after:200})}
  ${tableXml}
  <w:p><w:pPr><w:spacing w:after="240"/></w:pPr></w:p>
  ${sigXml}
  <w:sectPr>
    <w:pgSz w:w="15840" w:h="12240" w:orient="landscape"/>
    <w:pgMar w:top="1152" w:right="1296" w:bottom="1008" w:left="1728"/>
  </w:sectPr>
</w:body></w:document>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults><w:rPrDefault><w:rPr>
    <w:rFonts w:ascii="Nikosh" w:hAnsi="Nikosh" w:cs="Nikosh"/>
    <w:sz w:val="20"/><w:szCs w:val="20"/>
  </w:rPr></w:rPrDefault></w:docDefaults>
</w:styles>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

  const appRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  // Build zip using JSZip (load from CDN)
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js");
  const zip = new window.JSZip();
  zip.file("[Content_Types].xml", contentTypes);
  zip.file("_rels/.rels", appRels);
  zip.file("word/document.xml", docXml);
  zip.file("word/styles.xml", stylesXml);
  zip.file("word/_rels/document.xml.rels", relsXml);

  const blob = await zip.generateAsync({type:"blob", mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"),{href:url,download:`fuel_report_${dateStr}.docx`}).click();
  URL.revokeObjectURL(url);
}

/* ══════════════════════════════════════════
   PDF download
══════════════════════════════════════════ */
async function downloadPdf(dateStr, rows) {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
  const { jsPDF } = window.jspdf;
  const totals = {};
  FUELS.forEach(f=>{totals[f]={};FIELDS.forEach(fi=>{totals[f][fi]=calcTotal(rows,f,fi);});});

  const w = document.createElement("div");
  w.style.cssText = "position:fixed;left:-9999px;top:0;width:1200px;background:#fff;padding:28px 36px;font-family:'Nikosh',sans-serif;color:#000;";
  // ensure Google Fonts Nikosh is loaded
  if (!document.querySelector('link[href*="Nikosh"]')) {
    const lnk = document.createElement("link");
    lnk.rel = "stylesheet";
    lnk.href = "https://fonts.googleapis.com/css2?family=Nikosh&display=swap";
    document.head.appendChild(lnk);
    await new Promise(r => setTimeout(r, 800));
  }
  w.innerHTML = `
    <div style="text-align:center;margin-bottom:8px">
      <div style="font-size:20px;font-weight:800">উপজেলা: জীবননগর</div>
      <div style="font-size:17px;font-weight:700;margin-top:4px">জ্বালানী তেলের দৈনিক রিপোর্ট</div>
      <div style="font-size:14px;margin-top:4px">তারিখ: ${fmtDate(dateStr)}</div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:11.5px;margin-top:10px">
      <thead>
        <tr>
          <th rowspan="2" style="border:1px solid #000;padding:5px 4px;background:#fff;text-align:center;font-weight:700;color:#000">ক্রঃনং</th>
          <th rowspan="2" style="border:1px solid #000;padding:5px 4px;background:#fff;text-align:center;font-weight:700;color:#000">উপজেলা</th>
          <th rowspan="2" style="border:1px solid #000;padding:5px 4px;background:#fff;text-align:center;font-weight:700;color:#000;min-width:170px">প্রতিষ্ঠানের নাম</th>
          ${FUELS.map(f=>`<th colspan="4" style="border:1px solid #000;padding:5px;background:#fff;text-align:center;font-weight:700;color:#000">${FUEL_LBL[f]}</th>`).join("")}
        </tr>
        <tr>
          ${FUELS.map(()=>FIELDS.map(fi=>`<th style="border:1px solid #000;padding:4px 3px;background:#fff;text-align:center;font-size:10px;color:#000">${FIELD_LBL[fi]}</th>`).join("")).join("")}
        </tr>
      </thead>
      <tbody>
        ${STATIONS.map((s,i)=>`<tr>
          <td style="border:1px solid #000;padding:4px;text-align:center;color:#000;background:#fff">${toBn(String(i+1).padStart(2,"0"))}</td>
          <td style="border:1px solid #000;padding:4px;text-align:center;color:#000;background:#fff">${i===0?"জীবননগর":""}</td>
          <td style="border:1px solid #000;padding:4px;font-size:10.5px;color:#000;background:#fff">${s.name}</td>
          ${FUELS.map(f=>FIELDS.map(fi=>`<td style="border:1px solid #000;padding:4px;text-align:center;color:#000;background:#fff">${rows[i][f][fi]||"-"}</td>`).join("")).join("")}
        </tr>`).join("")}
        <tr>
          <td colspan="3" style="border:1px solid #000;padding:5px;text-align:center;font-weight:800;background:#fff;color:#000">সর্বমোট</td>
          ${FUELS.map(f=>FIELDS.map(fi=>`<td style="border:1px solid #000;padding:4px;text-align:center;font-weight:700;background:#fff;color:#000">${totals[f][fi]}</td>`).join("")).join("")}
        </tr>
      </tbody>
    </table>
    <table style="width:100%;border-collapse:collapse;margin-top:28px">
      <tr>
        <td style="width:50%;border:none"></td>
        <td style="width:50%;border:none;text-align:center;font-size:14px;line-height:2;padding-top:8px">
          উপজেলা নির্বাহী অফিসার<br/>জীবননগর, চুয়াডাঙ্গা।
        </td>
      </tr>
    </table>`;

  document.body.appendChild(w);
  if (document.fonts?.ready) await document.fonts.ready;
  await new Promise(r=>setTimeout(r,400));
  const canvas = await window.html2canvas(w, {scale:2,useCORS:true,backgroundColor:"#ffffff"});
  document.body.removeChild(w);
  const pdf   = new jsPDF({orientation:"landscape",unit:"mm",format:"a4"});
  const pW    = pdf.internal.pageSize.getWidth();
  const pH    = pdf.internal.pageSize.getHeight();
  const fw    = pW - 10;
  const fh    = (canvas.height/canvas.width)*fw;
  pdf.addImage(canvas.toDataURL("image/png"),"PNG",5,5,fw,Math.min(fh,pH-10));
  pdf.save(`fuel_report_${dateStr}.pdf`);
}

/* ══════════════════════════════════════════
   TABLE STYLES (module-level constants)
══════════════════════════════════════════ */
const TD  = {border:"1px solid #000",padding:"3px 4px",verticalAlign:"middle",color:"#000",background:"#fff",textAlign:"center",fontSize:12};
const TDG = {...TD,background:"#fff",fontWeight:700};
const THP = {border:"1px solid #000",padding:"5px 4px",fontWeight:700,textAlign:"center",color:"#000",background:"#fff",fontSize:11};
const THPd= {...THP,background:"#fff",color:"#000"};

/* ── Desktop table ── */
function DesktopTable({rowsArr, editable, editRows, setCell}) {
  return (
    <div style={{overflowX:"auto",display:"block"}}>
      <table style={{borderCollapse:"collapse",minWidth:900,width:"100%",background:"#fff"}}>
        <thead>
          <tr>
            <th rowSpan={2} style={{...THP}}>ক্রঃনং</th>
            <th rowSpan={2} style={{...THP}}>উপজেলা</th>
            <th rowSpan={2} style={{...THP,minWidth:150,textAlign:"left",paddingLeft:6}}>প্রতিষ্ঠানের নাম</th>
            {FUELS.map(f=><th key={f} colSpan={4} style={{...THPd}}>{FUEL_LBL[f]}</th>)}
          </tr>
          <tr>
            {FUELS.map(f=>FIELDS.map((fi,hi)=>(
              <th key={f+hi} style={{...THP,fontSize:10}}>{FIELD_LBL[fi]}</th>
            )))}
          </tr>
        </thead>
        <tbody>
          {STATIONS.map((s,i)=>(
            <tr key={s.id}>
              <td style={TD}>{toBn(String(i+1).padStart(2,"0"))}</td>
              <td style={TD}>{i===0?"জীবননগর":""}</td>
              <td style={{...TD,textAlign:"left",fontSize:11,paddingLeft:5}}>{s.name}</td>
              {FUELS.map(f=>FIELDS.map(fi=>(
                <td key={`${s.id}-${f}-${fi}`} style={{...TD,padding:editable?1:3}}>
                  {fi==="prev"
                    ? <span style={{display:"block",padding:"2px 4px",background:"#fff",fontWeight:600}}>
                        {rowsArr[i][f][fi]||<span style={{color:"#000"}}>-</span>}
                      </span>
                    : editable
                      ? <input value={editRows[i][f][fi]} onChange={e=>setCell(i,f,fi,e.target.value)}
                          style={{width:"100%",border:fi==="closing"?"2px solid #000":"1px solid #aaa",padding:"3px",textAlign:"center",fontSize:12,fontFamily:"'Nikosh',sans-serif",background:"#fff",boxSizing:"border-box"}}
                          placeholder="-"  autoComplete="off"/>
                      : <span>{rowsArr[i][f][fi]||"-"}</span>
                  }
                </td>
              )))}
            </tr>
          ))}
          <tr>
            <td colSpan={3} style={TDG}>সর্বমোট</td>
            {FUELS.map(f=>FIELDS.map(fi=>(
              <td key={`total-${f}-${fi}`} style={TDG}>{calcTotal(rowsArr,f,fi)}</td>
            )))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ── Mobile card list ── */
function MobileTable({rowsArr, editable, editRows, setCell}) {
  return (
    <div>
      {STATIONS.map((s,i)=>(
        <div key={s.id} style={{border:"1px solid #000",marginBottom:8,background:"#fff"}}>
          <div style={{background:"#fff",color:"#000",padding:"6px 10px",fontWeight:700,fontSize:13,display:"flex",justifyContent:"space-between",border:"1px solid #000"}}>
            <span>{toBn(String(i+1).padStart(2,"0"))}. {i===0 ? "জীবননগর — " : ""}{s.name}</span>
          </div>
          {FUELS.map(f=>(
            <div key={f} style={{borderTop:"1px solid #ddd"}}>
              <div style={{background:"#fff",color:"#000",padding:"3px 8px",fontSize:12,fontWeight:700,borderTop:"1px solid #000",borderBottom:"1px solid #000"}}>{FUEL_LBL[f]}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:0}}>
                {FIELDS.map(fi=>(
                  <div key={fi} style={{borderRight:"1px solid #ddd",padding:"4px 6px",borderBottom:"1px solid #eee"}}>
                    <div style={{fontSize:9,color:"#666",marginBottom:2}}>{FIELD_LBL[fi]}</div>
                    {fi==="prev"
                      ? <div style={{background:"#fff",padding:"3px",textAlign:"center",fontSize:13,fontWeight:600,borderRadius:2}}>
                          {rowsArr[i][f][fi]||"-"}
                        </div>
                      : editable
                        ? <input value={editRows[i][f][fi]} onChange={e=>setCell(i,f,fi,e.target.value)}
                            style={{width:"100%",border:fi==="closing"?"2px solid #000":"1px solid #bbb",padding:"3px 4px",textAlign:"center",fontSize:13,fontFamily:"'Nikosh',sans-serif",background:"#fff",boxSizing:"border-box",borderRadius:2}}
                            placeholder="-"  autoComplete="off"/>
                        : <div style={{textAlign:"center",fontSize:13}}>{rowsArr[i][f][fi]||"-"}</div>
                    }
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
      {/* Totals */}
      <div style={{border:"1px solid #000",background:"#fff"}}>
        <div style={{background:"#fff",color:"#000",padding:"6px 10px",fontWeight:700,fontSize:13,borderBottom:"1px solid #000"}}>সর্বমোট</div>
        {FUELS.map(f=>(
          <div key={f} style={{borderTop:"1px solid #000"}}>
            <div style={{background:"#fff",color:"#000",padding:"3px 8px",fontSize:12,fontWeight:700,borderBottom:"1px solid #000"}}>{FUEL_LBL[f]}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr"}}>
              {FIELDS.map(fi=>(
                <div key={fi} style={{borderRight:"1px solid #000",padding:"4px 6px"}}>
                  <div style={{fontSize:9,color:"#000",marginBottom:2}}>{FIELD_LBL[fi]}</div>
                  <div style={{textAlign:"center",fontWeight:700,fontSize:13}}>{calcTotal(rowsArr,f,fi)}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Responsive table ── */
function ReportTable({rowsArr, editable, editRows, setCell}) {
  return (
    <>
      <div className="desktop-only"><DesktopTable rowsArr={rowsArr} editable={editable} editRows={editRows} setCell={setCell}/></div>
      <div className="mobile-only"><MobileTable rowsArr={rowsArr} editable={editable} editRows={editRows} setCell={setCell}/></div>
    </>
  );
}

/* ══════════════════════════════════════════
   MAIN APP
══════════════════════════════════════════ */
export default function App() {
  const [allData,  setAllData]  = useState({});
  const [selDate,  setSelDate]  = useState(todayStr());
  const [rows,     setRows]     = useState(emptyData());
  const [loaded,   setLoaded]   = useState(false);
  const [tab,      setTab]      = useState("entry");
  const [histDate, setHistDate] = useState("");
  const [histRows, setHistRows] = useState(null);
  const [msg,      setMsg]      = useState("");
  const [dlState,  setDlState]  = useState("");
  const [setupOpen,setSetupOpen]= useState(false);
  const [mkInput,  setMkInput]  = useState(()=>localStorage.getItem("fuel_mk")||JSONBIN_MASTER_KEY);
  const [bidInput, setBidInput] = useState(()=>localStorage.getItem("fuel_binid")||JSONBIN_BIN_ID);
  const isConfigured = ()=> !!(_getKey()) && !!(_getBinId());

  /* load on mount */
  useEffect(()=>{ loadAll().then(all=>{ setAllData(all); setLoaded(true); }); },[]);

  /* when selDate changes → load that date OR carry closing→prev from nearest prev date */
  useEffect(()=>{
    if (!loaded) return;
    if (allData[selDate]) {
      setRows(allData[selDate]);
    } else {
      const prev = Object.keys(allData).filter(d=>d<selDate).sort().reverse()[0];
      if (prev) {
        setRows(allData[prev].map(r=>({
          stationId: r.stationId,
          diesel: { prev:r.diesel.closing, received:"", sales:"", closing:"" },
          petrol: { prev:r.petrol.closing, received:"", sales:"", closing:"" },
          octane: { prev:r.octane.closing, received:"", sales:"", closing:"" },
        })));
      } else {
        setRows(emptyData());
      }
    }
  }, [selDate, loaded, allData]); // eslint-disable-line

  const flash = (m) => { setMsg(m); setTimeout(()=>setMsg(""),2500); };

  const setCell = useCallback((ri,f,fi,v) =>
    setRows(rs => rs.map((r,i) => i!==ri ? r : {...r,[f]:{...r[f],[fi]:v}}))
  , []);

  const handleSave = async () => {
    const updated = {...allData, [selDate]: rows};
    setAllData(updated);
    await saveAll(updated, selDate);
    flash("✓ সংরক্ষিত হয়েছে!");
  };

  const handleDl = async (type, date, rowsArr) => {
    setDlState(date+"_"+type);
    try {
      if (type==="docx") await downloadDocx(date, rowsArr);
      else               await downloadPdf(date, rowsArr);
    } catch(e) { console.error(e); alert("ডাউনলোড ব্যর্থ: "+e.message); }
    setDlState("");
  };

  const deleteDate = async (d) => {
    if (!window.confirm("এই তারিখের তথ্য মুছে ফেলবেন?")) return;
    const u = {...allData}; delete u[d];
    setAllData(u); await saveAll(u, d);
    if (histDate===d) { setHistDate(""); setHistRows(null); }
  };

  const savedDates = Object.keys(allData).sort().reverse();

  const Signature = () => (
    <table style={{width:"100%",borderCollapse:"collapse",marginTop:20}}>
      <tbody><tr>
        <td style={{width:"50%",border:"none",padding:0}}/>
        <td style={{width:"50%",border:"none",textAlign:"center",fontSize:14,lineHeight:"2.2",color:"#000",paddingTop:8}}>
          উপজেলা নির্বাহী অফিসার<br/>জীবননগর, চুয়াডাঙ্গা।
        </td>
      </tr></tbody>
    </table>
  );

  const ReportHeader = ({date}) => (
    <div style={{textAlign:"center",padding:"10px 0 8px",borderBottom:"2px solid #000",marginBottom:10}}>
      <div style={{fontWeight:800,fontSize:17}}>উপজেলা: জীবননগর</div>
      <div style={{fontWeight:700,fontSize:15,marginTop:3}}>জ্বালানী তেলের দৈনিক রিপোর্ট</div>
      <div style={{fontSize:13,marginTop:3}}>তারিখ: {fmtDate(date)}</div>
    </div>
  );

  const DlBar = ({date, rowsArr}) => (
    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}>
      {[["docx","📄 DOCX"],["pdf","📕 PDF"]].map(([t,lbl])=>{
        const busy = dlState===date+"_"+t;
        return <button key={t} onClick={()=>handleDl(t,date,rowsArr)} disabled={!!dlState}
          style={{background:busy?"#888":"#111",color:"#fff",border:"none",padding:"8px 18px",cursor:busy?"not-allowed":"pointer",fontWeight:700,fontSize:13,borderRadius:2,fontFamily:"'Nikosh',sans-serif"}}>
          {busy?"⏳ তৈরি হচ্ছে...":lbl+" ডাউনলোড"}
        </button>;
      })}
    </div>
  );

  if (!loaded) return (
    <div style={{padding:40,textAlign:"center",fontFamily:"'Nikosh',sans-serif",fontSize:16}}>
      লোড হচ্ছে...
    </div>
  );

  return (
    <div style={{fontFamily:"'Nikosh',sans-serif",minHeight:"100vh",background:"#eee",color:"#000"}}>

      {/* ── Setup Modal ── */}
      {setupOpen && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{background:"#fff",border:"2px solid #000",padding:24,maxWidth:480,width:"100%",borderRadius:4}}>
            <div style={{fontWeight:800,fontSize:16,marginBottom:4}}>⚙️ Cloud Storage সেটআপ</div>
            <div style={{fontSize:12,color:"#555",marginBottom:16,lineHeight:1.6}}>
              যেকোনো browser এ data দেখতে JSONBin.io ব্যবহার করুন।<br/>
              ১. <a href="https://jsonbin.io" target="_blank" rel="noreferrer" style={{color:"#000",fontWeight:700}}>jsonbin.io</a> তে free account খুলুন<br/>
              ২. "New Bin" এ গিয়ে content: <code style={{background:"#eee",padding:"1px 4px"}}>{"{}".replace(/'/g,'"')}</code> দিয়ে বানান<br/>
              ৩. Bin ID ও Master Key নিচে paste করুন
            </div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:12,fontWeight:700,marginBottom:4}}>Master Key ($2a$10$...)</div>
              <input value={mkInput} onChange={e=>setMkInput(e.target.value)} placeholder="$2a$10$xxxxxxxx..."
                style={{width:"100%",border:"1px solid #000",padding:"7px 8px",fontSize:12,boxSizing:"border-box",fontFamily:"monospace"}}/>
            </div>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:12,fontWeight:700,marginBottom:4}}>Bin ID</div>
              <input value={bidInput} onChange={e=>setBidInput(e.target.value)} placeholder="6xxxxxxxxxxxxxxxxxxxxxxxxx"
                style={{width:"100%",border:"1px solid #000",padding:"7px 8px",fontSize:12,boxSizing:"border-box",fontFamily:"monospace"}}/>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{
                  localStorage.setItem("fuel_mk", mkInput.trim());
                  localStorage.setItem("fuel_binid", bidInput.trim());
                  setSetupOpen(false);
                  setLoaded(false);
                  loadAll().then(all=>{ setAllData(all); setLoaded(true); });
                }}
                style={{flex:1,background:"#000",color:"#fff",border:"none",padding:"10px",fontWeight:800,fontSize:14,cursor:"pointer",borderRadius:2,fontFamily:"'Nikosh',sans-serif"}}>
                ✅ সংরক্ষণ করুন
              </button>
              <button onClick={()=>setSetupOpen(false)}
                style={{background:"#fff",color:"#000",border:"1px solid #000",padding:"10px 16px",fontWeight:700,fontSize:14,cursor:"pointer",borderRadius:2,fontFamily:"'Nikosh',sans-serif"}}>
                বাতিল
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Top bar ── */}
      <div style={{background:"#111",color:"#fff",padding:"12px 16px",position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 4px rgba(0,0,0,.4)"}}>
        <div style={{maxWidth:1100,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
          <div>
            <div style={{fontWeight:800,fontSize:16,lineHeight:1.3}}>⛽ জ্বালানী তেলের দৈনিক রিপোর্ট</div>
            <div style={{fontSize:11,opacity:.65}}>উপজেলা: জীবননগর, চুয়াডাঙ্গা</div>
          </div>
          <div style={{display:"flex",gap:6}}>
            {[["entry","📝 এন্ট্রি"],["history","📅 ইতিহাস"]].map(([v,l])=>(
              <button key={v} onClick={()=>setTab(v)}
                style={{background:tab===v?"#fff":"transparent",color:tab===v?"#111":"#fff",border:tab===v?"none":"1px solid rgba(255,255,255,.4)",borderRadius:3,padding:"6px 12px",cursor:"pointer",fontWeight:700,fontSize:12,fontFamily:"'Nikosh',sans-serif"}}>
                {l}
              </button>
            ))}
            <button onClick={()=>setSetupOpen(true)}
              title="Cloud Storage সেটআপ"
              style={{background:isConfigured()?"#2a2":"#c00",color:"#fff",border:"none",borderRadius:3,padding:"6px 10px",cursor:"pointer",fontWeight:700,fontSize:13,fontFamily:"'Nikosh',sans-serif"}}>
              {isConfigured()?"☁️":"⚠️"}
            </button>
          </div>
        </div>
      </div>

      <div style={{maxWidth:1100,margin:"0 auto",padding:"12px 10px"}}>

        {/* ══ ENTRY TAB ══ */}
        {tab==="entry" && (
          <>
            {/* Date picker bar */}
            <div style={{background:"#fff",border:"1px solid #ccc",padding:"10px 12px",marginBottom:10,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              <span style={{fontWeight:700,fontSize:14}}>📅 তারিখ:</span>
              <input type="date" value={selDate} onChange={e=>setSelDate(e.target.value)}
                style={{padding:"6px 10px",border:"1px solid #888",fontSize:14,fontFamily:"'Nikosh',sans-serif",borderRadius:2}}/>
              <span style={{fontWeight:600,fontSize:13,color:"#333"}}>{fmtDate(selDate)}</span>
              <button onClick={handleSave}
                style={{background:"#111",color:"#fff",border:"none",borderRadius:2,padding:"7px 18px",fontSize:13,cursor:"pointer",fontWeight:700,fontFamily:"'Nikosh',sans-serif",marginLeft:"auto"}}>
                💾 সংরক্ষণ করুন
              </button>
              {msg && <span style={{fontWeight:700,fontSize:13,padding:"3px 10px",border:"1px solid #000",background:"#f5f5f5"}}>{msg}</span>}
            </div>

            {/* Info note */}
            {allData[selDate] && (
              <div style={{background:"#f0f0f0",border:"1px solid #999",padding:"6px 12px",fontSize:12,marginBottom:8,color:"#333"}}>
                ✏️ এই তারিখের তথ্য আগে সংরক্ষিত আছে। এডিট করে আবার সংরক্ষণ করুন।
              </div>
            )}

            {/* Report */}
            <div style={{background:"#fff",border:"1px solid #ccc",padding:"12px"}}>
              <ReportHeader date={selDate}/>
              <ReportTable rowsArr={rows} editable={true} editRows={rows} setCell={setCell}/>
              <Signature/>
            </div>

            <DlBar date={selDate} rowsArr={allData[selDate]||rows}/>
            <div style={{fontSize:11,color:"#666",marginTop:6}}>
              💡 <b>পূর্বের মজুদ</b> আগের দিনের সমাপনী থেকে স্বয়ংক্রিয়ভাবে আসে। <b>গাঢ় বর্ডার</b> = সমাপনী মজুদ।
            </div>
          </>
        )}

        {/* ══ HISTORY TAB ══ */}
        {tab==="history" && (
          <>
            <div style={{fontWeight:700,fontSize:16,marginBottom:10,borderBottom:"2px solid #000",paddingBottom:6}}>
              📅 সংরক্ষিত তারিখসমূহ
            </div>

            {savedDates.length===0
              ? <div style={{color:"#666",fontSize:14}}>কোনো তথ্য সংরক্ষিত নেই।</div>
              : <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:14}}>
                  {savedDates.map(d=>(
                    <div key={d} onClick={()=>{setHistDate(d);setHistRows(allData[d]);}}
                      style={{background:histDate===d?"#222":"#fff",color:histDate===d?"#fff":"#000",border:"1px solid #000",padding:"5px 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:6,fontWeight:600,fontSize:13,borderRadius:2,userSelect:"none"}}>
                      {fmtDate(d)}
                      <span title="মুছুন" onClick={e=>{e.stopPropagation();deleteDate(d);}}
                        style={{fontWeight:900,fontSize:14,cursor:"pointer",opacity:.7,marginLeft:2}}>×</span>
                    </div>
                  ))}
                </div>
            }

            {histRows && (
              <>
                {/* Edit button for this history date */}
                <button onClick={()=>{ setSelDate(histDate); setTab("entry"); }}
                  style={{background:"#111",color:"#fff",border:"none",padding:"7px 16px",fontSize:13,cursor:"pointer",fontWeight:700,borderRadius:2,marginBottom:10,fontFamily:"'Nikosh',sans-serif"}}>
                  ✏️ এই তারিখ এডিট করুন
                </button>

                <div style={{background:"#fff",border:"1px solid #ccc",padding:"12px"}}>
                  <ReportHeader date={histDate}/>
                  <ReportTable rowsArr={histRows} editable={false} editRows={histRows} setCell={setCell}/>
                  <Signature/>
                </div>
                <DlBar date={histDate} rowsArr={histRows}/>
              </>
            )}
          </>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nikosh&display=swap');
        * { box-sizing:border-box; }
        body,input,button,th,td,div,span { font-family:'Nikosh',sans-serif !important; }
        input:focus { outline:2px solid #000; }
        .desktop-only { display:block; }
        .mobile-only  { display:none;  }
        @media (max-width:700px) {
          .desktop-only { display:none !important; }
          .mobile-only  { display:block !important; }
        }
      `}</style>
    </div>
  );
}
