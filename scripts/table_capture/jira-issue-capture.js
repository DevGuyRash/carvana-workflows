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
      [/notarize/i,["NOTARIZE INC"]],
      [/plate express/i,["PLATE EXPRESS"]],
      [/scale invoice/i,["HARBOR TRUCK STOP INC"]],
      [/motor\s*car\s*tag\s*(?:&|and)\s*title/i,["MOTOR CAR TAG & TITLE"]],
      [/tag\s*agency\s*of\s*pinellas/i,["TAG AGENCY PROFESSIONALS"]],
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
      [/service oklahoma/i,["SERVICE OKLAHOMA",CR,H]],
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
      const hh=v=>s(v)
        .replace(/[\u00A0\u2007\u202F]/g," ")
        .replace(/\s*[-\u2010\u2011\u2012\u2013\u2014\u2015\uFE58\uFE63\uFF0D]\s*/g,"-");
      const sid=v=>hh(v).replace(/[\s\u200B\u200C\u200D\u2060\uFEFF]+/g,"").trim();

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

      // -------------------------------
      // Address parsing (supports: full address, split columns, and description scraping)
      // -------------------------------
      // Address "blank" (slightly broader than b())
      const ab=v=>{v=s(v).trim();return!v||/^(?:n\/?a|none|null|unknown|tbd|-|)$/i.test(v)};
      const aw=v=>s(v).replace(/[\u00A0\u2007\u202F]/g," ").replace(/\r/g,"");
      const a1=v=>aw(v).replace(/\s+/g," ").trim();
      const aq=v=>a1(v).replace(/^["']+|["']+$/g,"").trim();

      const ZIP_RX=/\b(\d{5})(?:[-\s]?(\d{4}))?\b/;
      const normZip=v=>{
        v=aq(v);
        let m=ZIP_RX.exec(v);
        if(!m) return "";
        return m[2]?m[1]+"-"+m[2]:m[1]
      };

      const STMAP=(function(){
        const m=Object.create(null);
        const nk=x=>a1(x).toUpperCase().replace(/[^A-Z]/g,"");
        const pairs=[
          ["ALABAMA","AL"],["ALASKA","AK"],["ARIZONA","AZ"],["ARKANSAS","AR"],
          ["CALIFORNIA","CA"],["COLORADO","CO"],["CONNECTICUT","CT"],["DELAWARE","DE"],
          ["FLORIDA","FL"],["GEORGIA","GA"],["HAWAII","HI"],["IDAHO","ID"],
          ["ILLINOIS","IL"],["INDIANA","IN"],["IOWA","IA"],["KANSAS","KS"],
          ["KENTUCKY","KY"],["LOUISIANA","LA"],["MAINE","ME"],["MARYLAND","MD"],
          ["MASSACHUSETTS","MA"],["MICHIGAN","MI"],["MINNESOTA","MN"],["MISSISSIPPI","MS"],
          ["MISSOURI","MO"],["MONTANA","MT"],["NEBRASKA","NE"],["NEVADA","NV"],
          ["NEW HAMPSHIRE","NH"],["NEW JERSEY","NJ"],["NEW MEXICO","NM"],["NEW YORK","NY"],
          ["NORTH CAROLINA","NC"],["NORTH DAKOTA","ND"],["OHIO","OH"],["OKLAHOMA","OK"],
          ["OREGON","OR"],["PENNSYLVANIA","PA"],["RHODE ISLAND","RI"],["SOUTH CAROLINA","SC"],
          ["SOUTH DAKOTA","SD"],["TENNESSEE","TN"],["TEXAS","TX"],["UTAH","UT"],
          ["VERMONT","VT"],["VIRGINIA","VA"],["WASHINGTON","WA"],["WEST VIRGINIA","WV"],
          ["WISCONSIN","WI"],["WYOMING","WY"],
          ["DISTRICT OF COLUMBIA","DC"],["PUERTO RICO","PR"]
        ];
        const names=[];
        for(const [name,abbr] of pairs){
          m[nk(name)]=abbr;
          m[nk(abbr)]=abbr;
          names.push(name)
        }
        for(const nm of ["WASHINGTON DC","WASHINGTON D C","WASHINGTON D.C."]){
          m[nk(nm)]="DC";
          names.push(nm)
        }
        const uniq=Array.from(new Set(names.map(x=>a1(x).toUpperCase()))).sort((a,b)=>b.length-a.length);
        return {m,nk,names:uniq}
      })();

      const normState=v=>{
        v=aq(v);
        if(ab(v)) return "";
        let key=STMAP.nk(v);
        return STMAP.m[key]||""
      };

      const isCity=v=>{
        v=aq(v);
        if(ab(v)) return false;
        if(v.length<2||v.length>60) return false;
        if(/\d/.test(v)) return false;
        if(/\b(united\s*states|usa|us)\b/i.test(v)) return false;
        return true
      };

      // More conservative street check (avoid misclassifying cities like "St Louis" as street)
      const isStreet=v=>{
        v=aq(v);
        if(ab(v)) return false;
        if(/\b\d{1,6}\b/.test(v)) return true;
        if(/\bP\.?\s*O\.?\s*BOX\b/i.test(v)) return true;
        if(/\b(AVE|AVENUE|RD|ROAD|BLVD|BOULEVARD|DR|DRIVE|LN|LANE|HWY|HIGHWAY|PKWY|PARKWAY|CT|COURT|PL|PLACE|WAY|TRL|TRAIL|CIR|CIRCLE|TER|TERRACE)\b/i.test(v)) return true;
        return v.length>18
      };

      const isApt=v=>{
        v=aq(v);
        if(ab(v)) return false;
        return /(?:^|[,\s])#\s*\w+/.test(v) || /\b(APT|APARTMENT|UNIT|STE|SUITE|BLDG|BUILDING|FL|FLOOR|RM|ROOM|LOT|TRLR|TRAILER)\b/i.test(v)
      };

      const splitAptFromStreet=(street)=>{
        street=aq(street);
        if(!street) return ["",""];
        const pats=[
          {s:2,rx:/\b(?:APT|APARTMENT)\b\.?\s*(?:#\s*)?[A-Za-z0-9-]+(?:\s*[A-Za-z0-9-]+)*/ig},
          {s:2,rx:/\b(?:STE|SUITE)\b\.?\s*(?:#\s*)?[A-Za-z0-9-]+(?:\s*[A-Za-z0-9-]+)*/ig},
          {s:2,rx:/\b(?:UNIT)\b\.?\s*(?:#\s*)?[A-Za-z0-9-]+(?:\s*[A-Za-z0-9-]+)*/ig},
          {s:2,rx:/\b(?:BLDG|BUILDING)\b\.?\s*(?:#\s*)?[A-Za-z0-9-]+(?:\s*[A-Za-z0-9-]+)*/ig},
          {s:2,rx:/\b(?:FL|FLOOR|RM|ROOM|LOT|TRLR|TRAILER)\b\.?\s*(?:#\s*)?[A-Za-z0-9-]+(?:\s*[A-Za-z0-9-]+)*/ig},
          {s:1,rx:/(?:^|[,\s])#\s*[A-Za-z0-9-]+/ig}
        ];
        let best=null;
        for(const p of pats){
          p.rx.lastIndex=0;
          let m;
          while((m=p.rx.exec(street))){
            let cand={score:p.s,index:m.index,text:m[0]};
            if(!best || cand.score>best.score || (cand.score===best.score && cand.index>best.index) || (cand.score===best.score && cand.index===best.index && cand.text.length>best.text.length)){
              best=cand
            }
          }
        }
        if(!best) return [street,""];
        let apt=a1(best.text.replace(/^[,\s]+/,"").trim());
        // If apt is like "#1215" and there's a stray "Apt" token right before it, fix to "Apt #1215"
        if(/^#\s*/.test(apt)){
          let pre=street.slice(0,best.index).trim();
          if(/\bAPT\b\.?\s*$/i.test(pre)) apt="Apt "+apt;
          if(/\bSUITE\b\.?\s*$/i.test(pre)) apt="Suite "+apt;
          if(/\bSTE\b\.?\s*$/i.test(pre)) apt="Ste "+apt;
          if(/\bUNIT\b\.?\s*$/i.test(pre)) apt="Unit "+apt
        }
        let out=(street.slice(0,best.index)+street.slice(best.index+best.text.length))
          .replace(/\s{2,}/g," ")
          .replace(/[,\s]+$/,"")
          .replace(/^[,\s]+/,"")
          .trim();
        // If we removed just the unit number, also remove a dangling "Apt"/"Suite" token at the end
        out=out.replace(/\b(?:APT|APARTMENT|SUITE|STE|UNIT)\b\.?\s*$/i,"").replace(/[ ,]+$/g,"").trim();
        return [out,apt]
      };

      const stripAddrLabels=(t)=>{
        t=aw(t).replace(/\n{2,}/g,"\n").trim();
        t=t.replace(/^\s*(?:mail(?:ing)?|remit(?:tance)?|payee|vendor|check)?\s*address\s*[:\-]\s*/i,"");
        t=t.replace(/^\s*(?:please\s+)?(?:mail(?:\s+the)?\s+check|send(?:\s*check)?|mail)\s*(?:to)?\s*[:\-]\s*/i,"");
        return t.trim()
      };

      const parseAddressParts=(raw)=>{
        raw=stripAddrLabels(raw);
        raw=raw.replace(/<br\s*\/?>/gi,"\n");
        raw=raw.replace(/\s*\|\s*/g,"\n").replace(/\s+\/\s+/g,"\n");
        raw=raw.replace(/\r/g,"").replace(/\n{2,}/g,"\n").trim();
        if(ab(raw)) return {street:"",apt:"",city:"",state:"",zip:""};
        let lines=raw.split(/\n+/).map(aq).filter(Boolean);

        let city="",state="",zip="",street="",apt="";

        const takeLabeled=(rx)=>{
          for(let i=0;i<lines.length;i++){
            let m=lines[i].match(rx);
            if(m){
              let v=aq(m[1]);
              lines.splice(i,1);
              return v
            }
          }
          return ""
        };

        let lCity=takeLabeled(/^\s*city\s*[:\-]\s*(.+)\s*$/i);
        let lState=takeLabeled(/^\s*state\s*[:\-]\s*(.+)\s*$/i);
        let lZip=takeLabeled(/^\s*(?:zip|zip\s*code|postal\s*code)\s*[:\-]\s*(.+)\s*$/i);
        let lStreet=takeLabeled(/^\s*(?:street\s*address|address\s*line\s*1|address1|address\s*1|address)\s*[:\-]\s*(.+)\s*$/i);
        let lApt=takeLabeled(/^\s*(?:address\s*line\s*2|address2|address\s*2|apt|apt\/suite|suite|unit)\s*[:\-]\s*(.+)\s*$/i);

        city=isCity(lCity)?lCity:"";
        state=normState(lState)||"";
        zip=normZip(lZip)||"";
        street=isStreet(lStreet)?lStreet:"";
        apt=isApt(lApt)?lApt:"";

        const popLine=()=>lines.length?lines[lines.length-1]:"";
        const dropLine=()=>lines.pop();

        // Zip: allow last line to be just the zip, or zip embedded in last 1-3 lines
        if(!zip && lines.length){
          let ln=popLine();
          let z=normZip(ln);
          if(z && aq(ln).replace(ZIP_RX,"").trim()===""){
            zip=z; dropLine()
          }
        }
        if(!zip){
          for(let i=lines.length-1;i>=Math.max(0,lines.length-3);i--){
            let z=normZip(lines[i]);
            if(z){
              zip=z;
              let rem=a1(lines[i].replace(ZIP_RX," ").trim());
              lines[i]=rem;
              if(!lines[i]) lines.splice(i,1);
              break
            }
          }
        }

        // State: whole-line state OR trailing state token OR trailing full state name
        if(!state && lines.length){
          let ln=popLine();
          let st=normState(ln);
          if(st && !/\d/.test(ln) && aq(ln).length<=30){
            state=st; dropLine()
          }
        }

        if(!state && lines.length){
          let ln=popLine();
          let m=ln.match(/(?:^|[,\s])([A-Za-z]{2})\s*$/);
          let st=m?normState(m[1]):"";
          if(st){
            state=st;
            ln=a1(ln.slice(0,m.index).replace(/[,\s]+$/,""));
            if(ln) lines[lines.length-1]=ln; else dropLine()
          } else {
            let up=a1(ln).toUpperCase().replace(/[,\s]+$/,"");
            for(const nm of STMAP.names){
              const rx=new RegExp(nm.split(/\s+/).map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("\\s+")+"\\s*$","i");
              if(rx.test(up)){
                state=normState(nm);
                ln=a1(ln.replace(rx,"").replace(/[,\s]+$/,""));
                if(ln) lines[lines.length-1]=ln; else dropLine();
                break
              }
            }
          }
        }

        // City: usually a whole last line OR last comma segment OR token-scan near the end
        if(!city && lines.length){
          let ln=popLine();
          if(isCity(ln) && !isStreet(ln) && !normState(ln) && !normZip(ln)){
            city=ln; dropLine()
          }
        }

        if(!city && (state||zip) && lines.length){
          let ln=popLine();
          if(/,/.test(ln)){
            let parts=ln.split(/\s*,\s*/).filter(Boolean);
            if(parts.length>1){
              let c=parts.pop();
              if(isCity(c)){
                city=c;
                ln=parts.join(", ").trim();
                if(ln) lines[lines.length-1]=ln; else dropLine()
              }
            }
          }
        }

        if(!city && (state||zip) && lines.length){
          let ln=popLine();
          let tokens=aq(ln).split(/\s+/).filter(Boolean);
          const STSUF=new Set(["ST","STREET","AVE","AVENUE","RD","ROAD","BLVD","BOULEVARD","DR","DRIVE","LN","LANE","HWY","HIGHWAY","PKWY","PARKWAY","CT","COURT","PL","PLACE","WAY","TRL","TRAIL","CIR","CIRCLE","TER","TERRACE"]);
          const APTTOK=new Set(["APT","APARTMENT","UNIT","STE","SUITE","BLDG","BUILDING","FL","FLOOR","RM","ROOM","LOT","TRLR","TRAILER"]);
          const CITYPFX=new Set(["ST","SAINT","MT","MOUNT","FORT","FT","PORT"]);
          const isNumTok=t=>/^\d+$/.test(t);
          let cityT=[];
          for(let i=tokens.length-1;i>=0;i--){
            let w=tokens[i];
            let uw=w.toUpperCase().replace(/[^\w]/g,"");
            let left=tokens[i-1]?tokens[i-1].toUpperCase().replace(/[^\w]/g,""):"";
            let leftLeft=tokens[i-2]?tokens[i-2].toUpperCase().replace(/[^\w]/g,""):"";
            if(!uw) continue;
            if(/\d/.test(uw) || uw.includes("#")) break;
            if(APTTOK.has(uw) || (left && APTTOK.has(left) && uw.length===1)) break;
            if(STSUF.has(uw) && cityT.length){
              if((uw==="ST" || uw==="STREET") && CITYPFX.has(left) && !isNumTok(leftLeft)){
                // include (city prefix) e.g., Port St Lucie
              } else break
            }
            if(uw.length===1 && cityT.length) break;
            cityT.unshift(w);
            if(cityT.length>=6) break
          }
          if(cityT.length){
            let c=a1(cityT.join(" "));
            if(isCity(c)){
              city=c;
              let cut=tokens.slice(0,tokens.length-cityT.length).join(" ").trim();
              if(cut) lines[lines.length-1]=cut; else dropLine()
            }
          }
        }

        // Everything remaining is street/apt
        let streetLines=lines.slice();
        if(!apt && streetLines.length){
          for(let i=streetLines.length-1;i>=0;i--){
            let ln=streetLines[i];
            if(isApt(ln) && !isStreet(ln) && !isCity(ln) && !normState(ln) && !normZip(ln)){
              apt=ln;
              streetLines.splice(i,1);
              break
            }
          }
        }

        street=a1(street || streetLines.join(", "));

        if(street){
          let sp=splitAptFromStreet(street);
          street=sp[0];
          if(!apt && sp[1]) apt=sp[1]
        }

        city=isCity(city)?city:"";

        return {street:street||"",apt:apt||"",city:city||"",state:state||"",zip:zip||""}
      };

      const extractAddressFromText=(txt)=>{
        txt=aw(txt).replace(/\r/g,"");
        if(ab(txt)) return "";
        let lines=txt.split(/\n+/).map(aq);

        // 1) labeled blocks
        const lbl=/^\s*(?:mail(?:ing)?\s*address|remit(?:tance)?\s*address|remit\s*to|payee\s*address|vendor\s*address|send(?:\s*check)?\s*to|mail\s*to|address)\s*[:\-]\s*(.*)$/i;
        const lbl2=/^\s*(?:please\s+)?(?:mail(?:\s+the)?\s+check|send(?:\s*check)?|mail)\s*(?:to)?\s*[:\-]\s*(.*)$/i;
        const addrPartLbl=/^\s*(?:city|state|zip|zip\s*code|postal\s*code|apt|apt\/suite|suite|unit|address\s*line\s*2|address2|address\s*2|attention|attn)\s*[:\-]/i;

        for(let i=0;i<lines.length;i++){
          let m=lines[i].match(lbl)||lines[i].match(lbl2);
          if(!m) continue;
          let block=[];
          let first=aq(m[1]);
          first && block.push(first);
          for(let j=i+1;j<lines.length && block.length<6;j++){
            let l=aq(lines[j]);
            if(!l) break;
            // Stop if this is clearly a new unrelated field label (but allow address-part labels)
            if(/^\s*\w[\w\s\/&]{0,25}\s*:\s*/.test(l) && !addrPartLbl.test(l) && !/^\s*(?:c\/o|attn)\b/i.test(l)) break;
            if(/\b(vin|pid|stock|oracle|invoice|tracking|amount)\b/i.test(l) && block.length) break;
            block.push(l)
          }
          let cand=block.join("\n").trim();
          if(cand) return cand
        }

        // 2) zip heuristic: line with zip + up to 4 lines above it
        for(let i=0;i<lines.length;i++){
          if(!ZIP_RX.test(lines[i])) continue;
          let start=i;
          let block=[];
          while(start>0 && block.length<4){
            let prev=aq(lines[start-1]);
            if(!prev) break;
            if(/:\s*$/.test(prev)) break;
            if(/\b(vin|pid|stock|oracle|invoice|tracking|amount)\b/i.test(prev)) break;
            start--
          }
          block=lines.slice(start,i+1).filter(Boolean);
          let cand=block.join("\n").trim();
          if(cand) return cand
        }

        return ""
      };

      const buildFullAddress=(p)=>{
        let parts=[];
        let st=a1(p.street||"");
        let apt=a1(p.apt||"");
        let city=a1(p.city||"");
        let state=a1(p.state||"");
        let zip=a1(p.zip||"");
        st && parts.push(st);
        apt && parts.push(apt);
        let tail="";
        if(city){
          tail=city;
          if(state||zip) tail+=", "
        }
        if(state){
          tail+=state;
          if(zip) tail+=" "+zip
        } else if(zip){
          tail+=zip
        }
        tail && parts.push(tail);
        return parts.join(", ").replace(/\s{2,}/g," ").trim()
      };

      const parseAddressSmart=(args)=>{
        args=args||{};
        let base=parseAddressParts(args.address||"");

        // Column hints (fill blanks only  don't clobber a fully-parsed Address or a vendor-rule override)
        let cStreet=aq(args.street||"");
        let cApt=aq(args.apt||"");
        let cCity=aq(args.city||"");
        let cState=normState(args.state||"");
        let cZip=normZip(args.zip||"");

        if(isStreet(cStreet) && (!base.street || !isStreet(base.street))) base.street=cStreet;
        if(isApt(cApt) && !base.apt) base.apt=cApt;
        if(isCity(cCity) && !base.city) base.city=cCity;
        if(cState && !base.state) base.state=cState;
        if(cZip && !base.zip) base.zip=cZip;

        // If we're still missing key parts, try extracting from noisy text (Description, etc)
        if((!base.street || !base.city || !base.state || !base.zip) && args.text){
          let cand=extractAddressFromText(args.text);
          if(cand){
            let extra=parseAddressParts(cand);
            if(!base.street && extra.street) base.street=extra.street;
            if(!base.apt && extra.apt) base.apt=extra.apt;
            if(!base.city && extra.city) base.city=extra.city;
            if(!base.state && extra.state) base.state=extra.state;
            if(!base.zip && extra.zip) base.zip=extra.zip
          }
        }

        // Final normalize / split apt if needed
        if(base.street){
          let sp=splitAptFromStreet(base.street);
          base.street=sp[0]||base.street;
          if(!base.apt && sp[1]) base.apt=sp[1]
        }

        base.full=buildFullAddress(base);
        return base
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
              line=hh(a.split("\n",2)[0]||""),
              mm=new RegExp("^\\s*(?:[#:\\(\\)\\[\\]\\-]\\s*)*"+pat,"i").exec(line);
          if(mm)return sid(mm[1]);
          let ls=a.split("\n");
          for(let i=0;i<ls.length;i++){
            let ln=hh(ls[i]);
            if(!ln.trim())continue;
            if(!/[A-Za-z0-9]/.test(ln))continue; // punctuation-only line like ':' -> skip
            let m2=new RegExp("^\\s*"+pat,"i").exec(ln);
            if(m2)return sid(m2[1]);
            break
          }
        }
        return ""
      };

      // Patterns (kept compact + compiled once per run)
      const VVP='([A-HJ-NPR-Z0-9]{11,17})\\b', SVP='((?:[A-Z0-9]{2,5}-)?\\d{7,12}(?:-(?:[A-Z]{2,8}|\\d{1,4}))?)\\b', PVP='(\\d{3,})\\b';
      const DVP=/(?:^|[^A-Z0-9])((?:[A-Z0-9]{2,5}-)?\d{7,12})(?:-([A-Z]{2,8}|\d{1,4}))?-([A-HJ-NPR-Z0-9]{11,17})-(\d{3,})(?:$|[^A-Z0-9])/i;
      const SXP=/^((?:[A-Z0-9]{2,5}-)?\d{7,12})(?:-([A-Z]{2,8}|\d{1,4}))?$/i;
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
      const iAdr=ix("Address","Mailing Address","Payee Address","Remit Address","Remittance Address","Mail To Address","Mail-To Address");
      const iStr=ix("Street Address","Street","Address Line 1","Address1","Address 1","Address Line1","Line 1","Line1");
      const iApt=ix("Apt/Suite","Apt","Suite","Unit","Address Line 2","Address2","Address 2","Address Line2","Line 2","Line2");
      const iCity=ix("City","Town");
      const iState=ix("State","Province","Region");
      const iZip=ix("Zip","Zip Code","ZipCode","Postal Code","PostalCode","Post Code","PostCode");

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

        let oi=iOIN>-1?sid(row[iOIN]):"";
        o[7]=oi;
        o[1]=b(oi)?"False":"True";

        let oe=iOE>-1?s(row[iOE]).trim():"";
        o[2]=/^(yes|true)$/i.test(oe)?T:F;

        let key=iK>-1?row[iK]:"";
        o[5]=C.h?hl(key):s(key).trim();

        o[6]=iV>-1?s(row[iV]).trim():"";
        o[9]=iMI>-1?s(row[iMI]).trim():"";
        // Address inputs can come from:
        // - A single Address column
        // - Separate Street/Apt/City/State/Zip columns
        // We'll capture all, then resolve later (after vendor rules may override o[16]).
        let aAdr=iAdr>-1?s(row[iAdr]).trim():"";
        let aStr=iStr>-1?s(row[iStr]).trim():"";
        let aApt=iApt>-1?s(row[iApt]).trim():"";
        let aCity=iCity>-1?s(row[iCity]).trim():"";
        let aState=iState>-1?s(row[iState]).trim():"";
        let aZip=iZip>-1?s(row[iZip]).trim():"";

        o[16]=aAdr;

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
        let st=iSN1>-1?sid(row[iSN1]):"";
        if(b(st)&&iSN2>-1)st=sid(row[iSN2]);

        let vin=iVIN>-1?sid(row[iVIN]):"";
        let pid=iPID>-1?sid(row[iPID]):"";

        if(b(st)) st=fv(txt,"stock",SVP);
        if(b(vin))vin=fv(txt,"vin",VVP);
        if(b(pid))pid=fv(txt,"pid",PVP);

       let dm=DVP.exec(hh(txt).toUpperCase());
       if(dm){
         if(b(st)) st=dm[1]+(dm[2]?("-"+dm[2]):"");
         if(b(vin))vin=dm[3];
         if(b(pid))pid=dm[4]
       }

       st=sid(st);
       vin=sid(vin);
       pid=sid(pid);

       // Safety: don't let STOCK be a VIN by mistake
       if(st && VCHK.test(st)) st="";

       let stInvoice=st;
       let sm=SXP.exec(st);
       if(sm){
         let stBase=sid(sm[1]).toUpperCase(),
             stTag=sid(sm[2]||"").toUpperCase(),
             stBaseNumeric=stBase.replace(/^[A-Z0-9]{2,5}-/,"");
         st=stTag?(stBase+"-"+stTag):stBase;
         stInvoice=stTag?(stBaseNumeric+"-"+stTag):stBaseNumeric
       }

       // Defaults (requested):
       // - If ANY of (stock/vin/pid) exists, fill missing pieces with placeholders:
       //     StockNumber -> "STOCK", VIN -> "VIN", PID -> "PID"
       // - If NONE exist, keep all three blank (no placeholders, no reference)
       // NOTE: Invoice uses numeric stock base + optional modifier.
       let anyId=!b(st)||!b(vin)||!b(pid);
       let stD=anyId?(b(st)?"STOCK":sid(st)):"";
       let vinD=anyId?(b(vin)?"VIN":sid(vin)):"";
       let pidD=anyId?(b(pid)?"PID":sid(pid)):"";

       o[12]=sid(stD);
       o[13]=sid(vinD);
       o[14]=sid(pidD);

       // Reference: HUB-STOCK-VIN-PID (inserted after Mailing Instructions)
       o[10]=anyId?sid("HUB-"+[stD,vinD,pidD].join("-")):"";

        // Invoice: STOCK-TR else MMDDYYYY-TR (example: 12302025-TR)
        o[11]=sid((stInvoice?stInvoice:DT)+"-TR");

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

        let ap=parseAddressSmart({
          address:o[16],
          street:aStr,
          apt:aApt,
          city:aCity,
          state:aState,
          zip:aZip,
          text:txt
        });

        // Normalize Address + parts
        if(!ab(ap.full)) o[16]=ap.full;
        o[17]=ap.street;
        o[18]=ap.apt;
        o[19]=ap.city;
        o[20]=ap.state;
        o[21]=ap.zip;

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
