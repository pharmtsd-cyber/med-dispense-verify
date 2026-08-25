// js/state.js

const State = {
  allDrugs: [], // 👉 新增：存放所有藥品 (含停用)，供主檔維護使用
  activeDrugs: [],
  employeeData: [],
  unitData: [],
  applications: [], 
  dispenseLogs: [], 
  currentSelectedDrugCode: null,
  chartInstances: {}
};

function formatAsDate(dateStr) {
  if (!dateStr) return "";
  const str = String(dateStr);
  const regexMatch = str.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (regexMatch) {
    const y = regexMatch[1];
    const m = regexMatch[2].padStart(2, '0');
    const d = regexMatch[3].padStart(2, '0');
    if (parseInt(y) < 1900) return ""; 
    return `${y}/${m}/${d}`;
  }
  const d = new Date(str);
  if (isNaN(d.getTime())) return str; 
  if (d.getFullYear() < 1900) return ""; 
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${dd}`;
}

function formatAsTime(dateStr) {
  if (!dateStr) return "";
  const str = String(dateStr);
  const timeMatch = str.match(/\b(\d{1,2}:\d{2}:\d{2})\b/);
  if (timeMatch) {
    const parts = timeMatch[1].split(':');
    const h = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const s = parts[2].padStart(2, '0');
    return `${h}:${m}:${s}`;
  }
  const d = new Date(str);
  if (isNaN(d.getTime())) return str;
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function checkNetwork() {
  if (!navigator.onLine) {
    alert("⛔ 網路已斷線！請確認網路連線後再進行操作，避免資料遺失。");
    return false;
  }
  return true;
}
