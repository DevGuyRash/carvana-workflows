// =====================================================================
// Table Capture Recipe (SAFE INIT)
// - Avoids top-level const collisions if Table Capture re-evaluates code.
// - Stores helpers on a unique global namespace.
// =====================================================================

var __g = (typeof globalThis !== "undefined") ? globalThis : window;
var CVR = __g.__CARVANA_TC_RECIPE__ || (__g.__CARVANA_TC_RECIPE__ = {});

// =====================================================================
// REQUIRED COLUMNS (SOURCE TABLE) - used by downstream flows
// ---------------------------------------------------------------------
// Header matching is case-insensitive and ignores punctuation/spaces (see n()).
//
// MUST INCLUDE (at minimum) in the captured table view:
//   - Key
//   - Mailing Instructions (or Mail Instructions / Mailing)
//   - Address
//   - Description (or Details / Issue Details)
//   - Fee Amount and/or Tax Amount (amount fallback math)
//   - Check Request Amount OR Amount to be Paid / Amount to be paid
//   - StockNumber and/or Stock Number
//   - VIN (recommended)
//   - PID (recommended)
//
// Optional but supported (improves accuracy / routing rules):
//   - Vendor
//   - Oracle Invoice Number
//   - Oracle Error
//   - AP Department
//   - AP Description
//   - AP Request Type
//   - Summary / Ticket Summary / Title
//
// OUTPUT COLUMNS our flows consume (generated here):
//   - Reference  (HUB-STOCK-VIN-PID)  <-- inserted after Mailing Instructions
//   - Invoice    (STOCK-TR or MMDDYYYY-TR if no stock found)
//   - StockNumber, VIN, PID
//   - Final Amount (Check Request Amount -> Amount to be Paid -> Fee+Tax)
// =====================================================================

// =====================================================================
// 1) TC_AOA: Element/Table -> AoA exporter (init once)
// =====================================================================
if (!CVR.TC_AOA) {
  // Config: dh = drop output header row (1 = drop, 0 = keep). Default ON.
  CVR.dh == null && (CVR.dh = 1);
  CVR.TC_AOA = (function () {
    const CFG = {
      includeLinkUrls: true,
      preferInnerText: true,
      normalizeWhitespace: true,
    };

    const toStr = (v) => (v == null ? "" : String(v));

    const norm = (v) => {
      let t = toStr(v).replace(/\u00A0/g, " ");
      if (CFG.normalizeWhitespace) t = t.replace(/\s+/g, " ");
      return t.trim();
    };

    const absUrl = (href) => {
      try {
        if (!href) return "";
        return new URL(href, document.baseURI).href;
      } catch {
        return "";
      }
    };

    const cellValue = (cell) => {
      if (!cell) return "";

      const input = cell.querySelector?.("input, textarea, select");
      if (input) {
        const tag = input.tagName?.toUpperCase?.() || "";
        if (tag === "INPUT") {
          const type = (input.getAttribute("type") || "").toLowerCase();
          if (type === "checkbox" || type === "radio") return input.checked ? "TRUE" : "FALSE";
          return norm(input.value);
        }
        if (tag === "TEXTAREA") return norm(input.value);
        if (tag === "SELECT") {
          const opt = input.selectedOptions?.[0];
          return norm(opt ? opt.textContent : input.value);
        }
      }

      let text = "";
      if (CFG.preferInnerText && "innerText" in cell) text = cell.innerText;
      else text = cell.textContent;
      text = norm(text);

      if (CFG.includeLinkUrls) {
        const links = Array.from(cell.querySelectorAll?.("a[href]") || [])
          .map((a) => ({ a, href: absUrl(a.getAttribute("href")) }))
          .filter((x) => /^https?:/i.test(x.href));

        if (links.length === 1) {
          const href = links[0].href;
          if (href && !text.includes(href)) {
            const aText = norm(links[0].a.innerText || links[0].a.textContent);
            const label = text || aText || href;
            return label === href ? href : `${label} (${href})`;
          }
        }
      }

      return text;
    };

    const rowCellElements = (row) => {
      if (!row) return [];

      if ((row.tagName || "").toUpperCase() === "TR") {
        const out = [];
        for (const ch of Array.from(row.children || [])) {
          const t = (ch.tagName || "").toUpperCase();
          if (t === "TD" || t === "TH") out.push(ch);
        }
        if (out.length) return out;
      }

      const roleCells = row.querySelectorAll?.(
        ':scope > [role="cell"], :scope > [role="gridcell"], :scope > [role="columnheader"]'
      );
      if (roleCells?.length) return Array.from(roleCells);

      return Array.from(row.children || []);
    };

    const spanNum = (el, prop, attr) => {
      const v =
        (el && el[prop]) ||
        (el && el.getAttribute && parseInt(el.getAttribute(attr), 10)) ||
        1;
      return Math.max(1, Number(v) || 1);
    };

    const buildGrid = (rows) => {
      const grid = [];
      const spans = [];
      let maxCols = 0;

      for (const row of rows) {
        const out = [];

        for (let c = 0; c < spans.length; c++) {
          const sp = spans[c];
          if (sp && sp.left > 0) {
            out[c] = sp.text;
            sp.left--;
            if (sp.left === 0) spans[c] = null;
          }
        }

        const cells = rowCellElements(row);
        let col = 0;

        for (const cell of cells) {
          while (out[col] !== undefined) col++;

          const text = cellValue(cell);
          const cs = spanNum(cell, "colSpan", "colspan");
          const rs = spanNum(cell, "rowSpan", "rowspan");

          out[col] = text;
          for (let k = 1; k < cs; k++) out[col + k] = "";

          if (rs > 1) {
            for (let k = 0; k < cs; k++) {
              spans[col + k] = { text: k === 0 ? text : "", left: rs - 1 };
            }
          }

          col += cs;
        }

        maxCols = Math.max(maxCols, out.length, spans.length);
        grid.push(out);
      }

      for (const r of grid) {
        for (let i = 0; i < maxCols; i++) {
          if (r[i] === undefined) r[i] = "";
        }
      }

      return { grid, maxCols };
    };

    const mergeHeaderRows = (headerGrid) => {
      if (!headerGrid.length) return [];
      const cols = headerGrid[0].length;
      const merged = new Array(cols).fill("");

      for (let c = 0; c < cols; c++) {
        const parts = [];
        for (let r = 0; r < headerGrid.length; r++) {
          const v = norm(headerGrid[r][c]);
          if (v && !parts.includes(v)) parts.push(v);
        }
        merged[c] = parts.join(" ").trim();
      }
      return merged;
    };

    const makeHeadersUnique = (headers) => {
      const seen = Object.create(null);
      return headers.map((h, i) => {
        h = norm(h) || `Column ${i + 1}`;
        const key = h.toLowerCase();
        if (!seen[key]) {
          seen[key] = 1;
          return h;
        }
        seen[key]++;
        return `${h} (${seen[key]})`;
      });
    };

    const findTable = (el) => {
      if (!el) return null;
      const up = el.closest?.("table");
      if (up) return up;
      if ((el.tagName || "").toUpperCase() === "TABLE") return el;
      return el.querySelector?.("table") || null;
    };

    const rowsInThisTable = (table) => {
      if (!table) return [];
      return Array.from(table.querySelectorAll("tr")).filter(
        (tr) => tr.closest("table") === table
      );
    };

    const tableToAoA = (element) => {
      const table = findTable(element);

      let headerRows = [];
      let bodyRows = [];

      if (table) {
        const all = rowsInThisTable(table);
        const theadRows = table.tHead
          ? Array.from(table.tHead.rows).filter((r) => r.closest("table") === table)
          : [];

        if (theadRows.length) {
          headerRows = theadRows;
          bodyRows = all.filter((r) => !theadRows.includes(r));
        } else if (all.length) {
          headerRows = [all[0]];
          bodyRows = all.slice(1);
        }
      } else {
        const all = Array.from(element?.querySelectorAll?.('[role="row"]') || []);
        if (all.length) {
          headerRows = [all[0]];
          bodyRows = all.slice(1);
        } else {
          const kids = Array.from(element?.children || []);
          if (kids.length) {
            headerRows = [kids[0]];
            bodyRows = kids.slice(1);
          }
        }
      }

      if (!headerRows.length) return [];

      const { grid: hGrid, maxCols: hCols } = buildGrid(headerRows);
      const header = makeHeadersUnique(mergeHeaderRows(hGrid));

      const { grid: bGrid, maxCols: bCols } = buildGrid(bodyRows);

      const colCount = Math.max(header.length, hCols, bCols);
      while (header.length < colCount) header.push(`Column ${header.length + 1}`);
      for (const r of bGrid) while (r.length < colCount) r.push("");

      return [header, ...bGrid];
    };

    const rowToArray = (rowElement) => {
      const cells = rowCellElements(rowElement);
      const out = [];
      for (const cell of cells) {
        const text = cellValue(cell);
        const cs = spanNum(cell, "colSpan", "colspan");
        out.push(text);
        for (let k = 1; k < cs; k++) out.push("");
      }
      return out;
    };

    return { tableToAoA, rowToArray };
  })();
}

// =====================================================================
// 2) apProcess: init once (YOUR existing post-processor)
// Put your existing AP processor in here so it doesn't pollute globals.
// =====================================================================
if (!CVR.apProcess) {
  CVR.apProcess = (function () {
    // --- BEGIN: your existing AP processor "globals" (kept private) ---
    const IV="Invoice",CR="Check Request",GW="Goodwill",TR="Title & Reg",WT="Wire Transfer",M="MISC",I="INHOUSE",H="HUB CHECKS",T="TRUE",F="FALSE",Z="0000000001",S="NOT FINISHED";
    const C={m:"table",j:" | ",h:1};
    const FM='=LET(_c,MATCH("Oracle Invoice Number",$1:$1,0),_v,INDEX($A:$XFD,ROW(),_c),NOT(OR(ISBLANK(_v),LEN(TRIM(_v))=0,LOWER(TRIM(_v))="n/a",_v="-",_v="—")))';
    const R=[
      [/notice of lien online application/i,["MISSOURI DEPARTMENT OF REVENUE"]],
      [/villarreal\s*enterprise\s*group/i,["VILLARREAL ENTERPRISE GROUP LLC"]],
      [/lyft/i,["LYFT, INC"]],
      [/waymo/i,["WAYMO LLC"]],
      [/motor\s*car\s*tag\s*(?:&|and)\s*title/i,["MOTOR CAR TAG & TITLE"]],
      [/edealer\s*services/i,["eDealer Services"]],
      [/\bvitu\b|vitu llc|vitu,?\s*inc/i,["VITU",IV,M,T]],
      [/title one/i,["Title One",IV,M,T]],
      [/omv\s*express|expres+s\s*omv|\[external\](?: *carvana [a-z] #\d+)+/i,["Express OMV",IV,M,T]],
      [/daily activity summary/i,[0,IV,M,T]],
      [/add invoice/i,[0,IV,M,T]],
      [/best[- ]?pass/i,["Bestpass",IV,M]],
      [/ez title/i,[0,IV,M]],
      [/troy licensing office/i,[0,IV,M,T]],
      [/ean services llc|enterprise holdings inc/i,["ENTERPRISE HOLDINGS INC",IV,M]],
      [/invoice\s*\d+\s*and\s*spreadsheet|mvd\s*now|mvdnow/i,["MVD NOW LLC",IV,M]],
      [/hertz car sales|cv7775|hertz/i,["HERTZ CAR SALES",IV,M]],
      [/quick[- ]?serv/i,["QUICK-SERV LICENSE CENTER",IV,M,T]],
      [/invoice/i,[0,IV,M]],
      [/wire\s*transfer/i,[0,WT,M]],
      [/folder/i,[0,CR,H]],
      [/walked to the dmv/i,[0,CR,H]],
      [/\bncdmv\b|\bnc dmv\b/i,[0,CR,H]],
      [/service oklahoma/i,[0,CR,H]],
      [/commonwealth of pennsylvania/i,[0,CR,H]],
      [/market street/i,["Market Street",CR,I,0,"4011 N MARKET ST, Spokane, WA 99207"]],
      [/corporate check request/i,[0,CR,I]],
      [/50 state dmv/i,[0,CR,I]],
      [/dealer account no 43259|sc dmv/i,["SC DMV",CR,I,0,"South Carolina Department of Motor / ATTN Carol Reynolds / 10311 Wilson Boulevard, Blythewood, SC 29016"]],
      [/sell to carvana/i,[0,CR]],
      [/ttstc/i,[0,CR]],
      [/customer check request/i,[0,CR,0,0,0,0,/good\s*will|goodwill|GDW/i]],
      [/t&r check request/i,[0,CR]],
      [/title & reg checks/i,[0,CR]],
      [/carvana az processing/i,[0,0,0,T]]
    ];
    // --- END: your existing AP processor "globals" ---

    // Return the actual processor function:
    return (data) => {
      if(!Array.isArray(data)||!data.length)return data;

      // NOTE: New columns inserted after "Mailing Instructions":
      //   Reference, Invoice, StockNumber, VIN, PID, Final Amount
      const O=[
        "Status","Invoice Exists","Oracle Error","Auto Close","Tracking ID","Key","Vendor",
        "Oracle Invoice Number","Request Type","Mailing Instructions",
        "Reference","Invoice","StockNumber","VIN","PID","Final Amount",
        "Address","Street Address","Apt/Suite","City","State","Zip",
        "Amount to be paid","Fee Amount","Tax Amount","Description",
        "AP Department","AP Description","AP Request Type"
      ];

      const s=v=>(v??"").toString();
      const b=v=>{v=s(v).trim();return!v||/^(n\/?a|-|—)$/i.test(v)};
      const n=v=>s(v).toLowerCase().replace(/[^a-z0-9]+/g,"");

      const hl=v=>{
        v=s(v).trim();
        if(!v||/^=hyperlink\(/i.test(v))return v;
        let m=v.match(/\((https?:\/\/[^)]+)\)/i),
            u=m?m[1]:(/^https?:\/\//i.test(v)?v:"");
        if(!u)return v;
        let t=m?v.slice(0,m.index).trim():(u.split("/").filter(Boolean).pop()||u);
        u=u.replace(/"/g,'""');t=(t||u).replace(/"/g,'""');
        return '=HYPERLINK("'+u+'","'+t+'")'
      };

      const pa=a=>{
        a=s(a).replace(/\s*\|\s*/g,",").replace(/\s+/g," ").trim();
        if(!a)return["","","","",""];
        let z=(a.match(/\b\d{5}(?:-\d{4})?\b(?!.*\b\d{5})/)||[])[0]||"";
        if(z)a=a.replace(z,"").replace(/[,\s]+$/,"").trim();
        let st="",m=a.match(/(?:,|\s)([A-Za-z]{2})\s*$/);
        if(m){st=m[1].toUpperCase();a=a.slice(0,m.index).replace(/[,\s]+$/,"").trim()}
        let apt="",am=a.match(/\b(?:apt|unit|ste|suite|#)\s*[\w-]+/i);
        if(am){apt=am[0];a=a.replace(am[0],"").replace(/\s{2,}/g," ").replace(/[,\s]+$/,"").trim()}
        let p=a.split(/\s*,\s*/).filter(Boolean),city="";
        if(p.length>1){city=p.pop();a=p.join(", ")}
        return[a,apt,city,st,z]
      };

      // Money parser (used ONLY for Fee+Tax fallback math)
      const pm=v=>{
        v=s(v).replace(/[$,]/g,"").trim();
        v=parseFloat(v);
        return isFinite(v)?v:NaN
      };

      // Find values near labels in multi-line text (PS espanso logic -> JS)
      const fv=(t,l,pat)=>{
        let rx=new RegExp("\\b"+l+"(?:\\s*number(?:s)?)?\\b","ig"),m;
        while((m=rx.exec(t))){
          let a=t.slice(m.index+m[0].length),
              line=(a.split("\n",2)[0]||""),
              mm=new RegExp("^\\s*(?:[#:\\(\\)\\[\\]\\-]\\s*)*"+pat,"i").exec(line);
          if(mm)return mm[1].trim();
          let ls=a.split("\n");
          for(let i=0;i<ls.length;i++){
            let ln=ls[i];
            if(!ln.trim())continue;
            if(!/[A-Za-z0-9]/.test(ln))continue; // punctuation-only line like ':' -> skip
            let m2=new RegExp("^\\s*"+pat,"i").exec(ln);
            if(m2)return m2[1].trim();
            break
          }
        }
        return ""
      };

      // Patterns (kept compact + compiled once per run)
      const VVP='([A-HJ-NPR-Z0-9]{11,17})\\b', SVP='([A-Z0-9-]{3,})\\b', PVP='(\\d{3,})\\b';
      const VCHK=/^[A-HJ-NPR-Z0-9]{11,17}$/i;

      // Today's date for Invoice fallback: MMDDYYYY-TR (example: 12302025-TR)
      const _d=new Date(), DT=("0"+(_d.getMonth()+1)).slice(-2)+("0"+_d.getDate()).slice(-2)+_d.getFullYear();

      const H0=data[0].map(x=>s(x).trim()),mp={};
      for(let i=0;i<H0.length;i++)mp[n(H0[i])]=i;

      const ix=(...a)=>{for(let x of a){let k=n(x);if(k in mp)return mp[k]}return-1};

      // Exact-header finder (used to support StockNumber vs Stock Number priority)
      const ixr=(name)=>{
        name=s(name).trim().toLowerCase();
        for(let i=0;i<H0.length;i++)if(s(H0[i]).trim().toLowerCase()===name)return i;
        return -1
      };

      const iOE =ix("Oracle Error");
      const iK  =ix("Key");
      const iV  =ix("Vendor");
      const iOIN=ix("Oracle Invoice Number","Oracle invoice #","Oracle Invoice #");
      const iMI =ix("Mailing Instructions","Mail Instructions","Mailing");
      const iAdr=ix("Address");

      // Amount priority:
      //   Check Request Amount -> Amount to be Paid -> Fee+Tax (treat missing as 0)
      const iCRA=ix("Check Request Amount","Check Request Amt");
      const iAmt=ix("Amount to be paid","Amount to be Paid","Amount Payable","Amount");
      const iFee=ix("Fee Amount","Fees");
      const iTax=ix("Tax Amount","Taxes","Tax");

      // Stock/VIN/PID (StockNumber primary, Stock Number fallback)
      const iSN1=ixr("StockNumber");
      const iSN2=ixr("Stock Number");
      const iVIN=ix("VIN","VIN Number","VIN Numbers");
      const iPID=ix("PID","PID Number");

      const iD  =ix("Description","Details","Issue Details");
      const iAPD=ix("AP Department","AP Dept","Department","AP Department ");
      const iAPX=ix("AP Description","AP Desc","AP-Description","AP description","A/P Description");
      const iAPT=ix("AP Request Type","AP Type","AP RequestType","Request Type (AP)");
      const iSum=ix("Summary","Issue Summary","Ticket Summary","Title");

      const cmp=(a,b)=>{
        for(const k of [9,8,1,2,6,5]){
          let A=s(a[k]).trim().toLowerCase(),B=s(b[k]).trim().toLowerCase();
          if(A===B)continue;
          if(!A)return 1;
          if(!B)return -1;
          return A<B?-1:1
        }
        return 0
      };

      const apply=(o,a)=>{
        a[0]&&(o[6]=a[0]);
        a[1]&&(o[8]=a[1]);
        a[2]&&(o[9]=a[2]);
        a[3]&&(o[3]=T);
        a[4]&&(o[16]=a[4]) // Address moved (new columns inserted before it)
      };

      let rows=[];

      for(let r=1;r<data.length;r++){
        const row=data[r];
        let o=Array(O.length).fill("");

        o[0]=S;
        o[3]=F;
        o[4]=Z;

        let oi=iOIN>-1?s(row[iOIN]).trim():"";
        o[7]=oi;
        o[1]=b(oi)?"False":"True";

        let oe=iOE>-1?s(row[iOE]).trim():"";
        o[2]=/^(yes|true)$/i.test(oe)?T:F;

        let key=iK>-1?row[iK]:"";
        o[5]=C.h?hl(key):s(key).trim();

        o[6]=iV>-1?s(row[iV]).trim():"";
        o[9]=iMI>-1?s(row[iMI]).trim():"";
        o[16]=iAdr>-1?s(row[iAdr]).trim():"";

        // Raw columns (kept for visibility / debugging)
        let _fee=iFee>-1?row[iFee]:"";
        let _tax=iTax>-1?row[iTax]:"";
        o[23]=_fee;
        o[24]=_tax;

        o[25]=iD>-1?row[iD]:"";
        o[26]=iAPD>-1?row[iAPD]:"";
        o[27]=iAPX>-1?row[iAPX]:"";
        o[28]=iAPT>-1?row[iAPT]:"";

        let txt=row.map(s).join("\n");

        // -------------------------------
        // Stock / VIN / PID (columns -> description fallback)
        // -------------------------------
        let st=iSN1>-1?s(row[iSN1]).trim():"";
        if(b(st)&&iSN2>-1)st=s(row[iSN2]).trim();

        let vin=iVIN>-1?s(row[iVIN]).trim():"";
        let pid=iPID>-1?s(row[iPID]).trim():"";

        if(b(st)) st=fv(txt,"stock",SVP);
        if(b(vin))vin=fv(txt,"vin",VVP);
        if(b(pid))pid=fv(txt,"pid",PVP);

       // Safety: don't let STOCK be a VIN by mistake
       if(st && VCHK.test(st)) st="";

       // Defaults (requested):
       // - If ANY of (stock/vin/pid) exists, fill missing pieces with placeholders:
       //     StockNumber -> "STOCK", VIN -> "VIN", PID -> "PID"
       // - If NONE exist, keep all three blank (no placeholders, no reference)
       // NOTE: we still use raw `st` for Invoice (date fallback).
       let anyId=!b(st)||!b(vin)||!b(pid);
       let stD=anyId?(b(st)?"STOCK":st):"";
       let vinD=anyId?(b(vin)?"VIN":vin):"";
       let pidD=anyId?(b(pid)?"PID":pid):"";

       o[12]=stD;
       o[13]=vinD;
       o[14]=pidD;

       // Reference: HUB-STOCK-VIN-PID (inserted after Mailing Instructions)
       o[10]=anyId?("HUB-"+[stD,vinD,pidD].join("-")):"";

        // Invoice: STOCK-TR else MMDDYYYY-TR (example: 12302025-TR)
        o[11]=(st?st:DT)+"-TR";

        // -------------------------------
        // Final Amount (CRA -> Amount -> Fee+Tax)
        // -------------------------------
        let cra=iCRA>-1?s(row[iCRA]).trim():"";
        let amt=iAmt>-1?s(row[iAmt]).trim():"";
        let fin="";

       if(!b(cra)) fin=cra;
       else if(!b(amt)) fin=amt;
       else {
         let fn=pm(_fee),tn=pm(_tax);
         if(isFinite(fn)||isFinite(tn)) fin=String((isFinite(fn)?fn:0)+(isFinite(tn)?tn:0))
       }

       // Default Final Amount (requested): if every source is missing/blank -> "0"
       if(b(fin)) fin="0";

        o[15]=fin;   // New: Final Amount (near identifiers)
        o[22]=fin;   // Existing: Amount to be paid now uses the same finalized value

        let u=oi.replace(/\s+/g,"").toUpperCase();
        if(u.endsWith("CR"))      o[8]=CR;
        else if(u.endsWith("GDW"))o[8]=GW;
        else if(u.endsWith("TR")) o[8]=TR;

        if(!o[6]&&iSum>-1){
          let v=s(row[iSum]).trim();
          v&&(o[6]=v)
        }

        let good=/good\s*will|goodwill/i.test(txt),
            hub=/hub\s*checks/i.test(txt),
            gdw=u.endsWith("GDW");

        let apd=s(o[26]),
            apx=s(o[27]),
            stc=/(^|\b)stc(\b|$)/i;

        if(!hub&&!good&&!gdw&&/logistics/i.test(apd))o[8]=CR,o[9]=I;
        if(!hub&&!good&&!gdw&&stc.test(apd+" "+apx))o[8]=CR,o[9]=I;
        if(stc.test(apd+" "+apx)&&good)o[8]=GW,o[9]=I;
        if(!hub&&!good&&!gdw&&/finance\s*operations/i.test(apd))o[8]=CR,o[9]=I;

        if(/\b(title\s*&?\s*reg(istration)?|t\s*&\s*r|t\/r|title\s*and\s*registration|title&registration)\b/i.test(apx))o[8]=CR;

        for(const rr of R){
          const a=rr[1];
          if(rr[0].test(txt)&&!(a[5]&&a[5].test(txt)))apply(o,a)
        }

        if(o[8]==IV||o[8]==WT)o[9]=M;

        for(const rr of R){
          const a=rr[1];
          if(rr[0].test(txt)&&!(a[5]&&a[5].test(txt)))apply(o,a)
        }

        let mi=s(o[9]);
        o[9]=/inhouse/i.test(mi)?I:/hub\s*checks/i.test(mi)?H:/misc/i.test(mi)?M:mi;

        let p=pa(o[16]);
        o[17]=p[0];
        o[18]=p[1];
        o[19]=p[2];
        o[20]=p[3];
        o[21]=p[4];

        rows.push(o)
      }

      rows.sort(cmp);
      for(const r of rows)r[1]=FM;

      let out=[O,...rows];

      if(C.m=="singleColumn")return [["Data"],...rows.map(r=>[r.map(s).join(C.j)])];
      if(C.m=="singleCell"){
        let L=out.map(r=>r.map(s).join(C.j)).join("\n");
        return [[L]]
      }
      return out
    };
  })();
}

// =====================================================================
// 3) Always return a VALID AoA (Table Capture can be picky)
// =====================================================================
function __cvEnsureAoA(x) {
  const fallback = [["Column 1"], [""]];

  if (!Array.isArray(x)) return fallback;
  if (x.length === 0) return fallback;

  // Must be 2D array
  for (let i = 0; i < x.length; i++) {
    if (!Array.isArray(x[i])) return fallback;
  }

  // Determine max cols, pad
  let cols = 0;
  for (let i = 0; i < x.length; i++) cols = Math.max(cols, x[i].length);

  if (cols <= 0) return fallback;

  for (let i = 0; i < x.length; i++) {
    while (x[i].length < cols) x[i].push("");
  }

  // Some versions require at least header + 1 data row
  if (x.length === 1) x.push(new Array(cols).fill(""));

  return x;
}

// =====================================================================
// REQUIRED: Element -> Array of Arrays
// =====================================================================
function element2DataTable(element) {
  // Extract table -> AoA
  var data = CVR.TC_AOA.tableToAoA(element);
  data = __cvEnsureAoA(data);

  // Run your existing post-processor
  var out = CVR.apProcess(data);
  out = __cvEnsureAoA(out);

  // Drop the output header row (default ON)
  CVR.dh && out.shift();

  return out;
}

// =====================================================================
// REQUIRED: Row -> Array
// =====================================================================
// var __g = (typeof globalThis !== "undefined") ? globalThis : window;
// var CVR = __g.__CARVANA_TC_RECIPE__ || (__g.__CARVANA_TC_RECIPE__ = {});

// function element2RowArray(rowEl) {
//   try {
//     if (CVR.TC_AOA && typeof CVR.TC_AOA.rowToArray === "function") {
//       const r = CVR.TC_AOA.rowToArray(rowEl);
//       return Array.isArray(r) ? r : [];
//     }
//   } catch (_) {}

//   // Fallback (very simple)
//   if (!rowEl) return [];
//   const cells = Array.from(rowEl.querySelectorAll?.("td,th") || []);
//   return cells.map((c) => (c?.innerText ?? c?.textContent ?? "").trim());
// }
