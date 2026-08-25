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

function formatAsDate(dateStr) {
  if(!dateStr) return "";
  const d = new Date(dateStr);
  if(isNaN(d.getTime())) return dateStr;
  // 👉 阻擋 Google Sheets 的 1899 年純時間物件被當成日期顯示
  if(d.getFullYear() < 1900) return ""; 
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${dd}`;
}

function formatAsTime(dateStr) {
  if(!dateStr) return "";
  // 若字串已經是 HH:mm:ss，直接回傳
  if(typeof dateStr === 'string' && dateStr.match(/^\d{1,2}:\d{2}:\d{2}$/)) return dateStr;
  const d = new Date(dateStr);
  if(isNaN(d.getTime())) return dateStr;
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
