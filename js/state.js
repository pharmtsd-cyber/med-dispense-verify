// js/state.js

const State = {
  activeDrugs: [],
  employeeData: [],
  unitData: [],
  applications: [], 
  dispenseLogs: [], 
  currentSelectedDrugCode: null,
  chartInstances: {}
};

// 工具：防禦型日期標準化 YYYY/MM/DD
function formatAsDate(dateStr) {
  if (!dateStr) return "";
  const str = String(dateStr);
  
  // 嘗試直接用正規表達式抓取 YYYY-MM-DD 或 YYYY/MM/DD
  const regexMatch = str.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (regexMatch) {
    const y = regexMatch[1];
    const m = regexMatch[2].padStart(2, '0');
    const d = regexMatch[3].padStart(2, '0');
    if (parseInt(y) < 1900) return ""; // 濾掉 1899 年的怪物日期
    return `${y}/${m}/${d}`;
  }

  // 備用方案：使用原生 Date 解析
  const d = new Date(str);
  if (isNaN(d.getTime())) return str; 
  if (d.getFullYear() < 1900) return ""; 
  
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${dd}`;
}

// 工具：防禦型時間標準化 HH:mm:ss
function formatAsTime(dateStr) {
  if (!dateStr) return "";
  const str = String(dateStr);
  
  // 直接用正規表達式暴力抽出時間 (無視後面的台北標準時間或 1899 年)
  const timeMatch = str.match(/\b(\d{1,2}:\d{2}:\d{2})\b/);
  if (timeMatch) {
    // 確保如果是 8:30:00 這種格式，會補零變成 08:30:00
    const parts = timeMatch[1].split(':');
    const h = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const s = parts[2].padStart(2, '0');
    return `${h}:${m}:${s}`;
  }
  
  // 備用方案
  const d = new Date(str);
  if (isNaN(d.getTime())) return str;
  
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

// 網路狀態檢查工具
function checkNetwork() {
  if (!navigator.onLine) {
    alert("⛔ 網路已斷線！請確認網路連線後再進行操作，避免資料遺失。");
    return false;
  }
  return true;
}
