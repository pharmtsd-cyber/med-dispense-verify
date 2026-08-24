// js/state.js

const State = {
  activeDrugs: [],
  employeeData: [],
  unitData: [],
  applications: [], // 前端快取：申請單
  dispenseLogs: [], // 前端快取：調劑紀錄
  currentSelectedDrugCode: null,
  chartInstances: {}
};

// 工具：標準化日期 YYYY/MM/DD
function formatAsDate(dateStr) {
  if(!dateStr) return "";
  const d = new Date(dateStr);
  if(isNaN(d.getTime())) return dateStr;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${dd}`;
}

// 工具：標準化時間 HH:mm:ss
function formatAsTime(dateStr) {
  if(!dateStr) return "";
  const d = new Date(dateStr);
  if(isNaN(d.getTime())) return dateStr;
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
