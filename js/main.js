// js/main.js 的最上方替換為：

document.addEventListener("DOMContentLoaded", async () => {
  
  // 👉 新增：動態讀取 config.js 中的天數設定，並顯示在畫面上
  const daysText = (typeof LOAD_HISTORY_DAYS !== 'undefined' && LOAD_HISTORY_DAYS > 0) ? LOAD_HISTORY_DAYS : "全部";
  const displayEl = document.getElementById("history-days-display");
  const overviewTitleEl = document.getElementById("overview-history-days");
  
  if(displayEl) displayEl.innerHTML = `<i class="bi bi-database-check"></i> 快取範圍: 近 ${daysText} 天`;
  if(overviewTitleEl) overviewTitleEl.innerText = `(資料範圍: 近 ${daysText} 天)`;

  // 底下維持原本的日期設定邏輯...
  const today = new Date();
  const priorDate = new Date(new Date().setDate(today.getDate() - 14));
  const priorDate2 = new Date(new Date().setDate(today.getDate() - 2));
  
  const todayStr = today.toISOString().split('T')[0];
  const priorStr14 = priorDate.toISOString().split('T')[0];
  const priorStr2 = priorDate2.toISOString().split('T')[0];
  
  const dateInputs14 = ['overview-date-start', 'overview-date-end', 'single-drug-date-start', 'single-drug-date-end', 'app-hist-start', 'app-hist-end'];
  dateInputs14.forEach(id => {
      const el = document.getElementById(id);
      if(el) el.value = id.includes('start') ? priorStr14 : todayStr;
  });

  const dateInputs2 = ['disp-hist-start', 'disp-hist-end'];
  dateInputs2.forEach(id => {
      const el = document.getElementById(id);
      if(el) el.value = id.includes('start') ? priorStr2 : todayStr;
  });

  const userStr = sessionStorage.getItem("currentUser");
  if (userStr) {
    initApp(JSON.parse(userStr));
  } else {
    initLogin();
  }
});

// ================= 登入邏輯 =================
async function initLogin() {
  document.getElementById("login-container").classList.remove("d-none-important");
  document.getElementById("app-container").classList.add("d-none-important");
  
  // 登入前同時載入員工與單位資料
  State.employeeData = await fetchData('getEmployeeData');
  State.unitData = await fetchData('getUnits');
  
  if (State.employeeData.length > 0) {
    document.getElementById("loading-msg").classList.add("d-none-important");
    document.getElementById("login-form").classList.remove("d-none-important");
    
    // 填入登入單位選項
    const loginUnitSelect = document.getElementById("login-unit-select");
    if(loginUnitSelect && State.unitData.length > 0) {
      let unitOpts = '<option value="" selected disabled>-- 請選擇登入單位 --</option>';
      State.unitData.forEach(u => {
        if(u['單位名稱']) unitOpts += `<option value="${u['單位名稱']}">${u['單位名稱']}</option>`;
      });
      loginUnitSelect.innerHTML = unitOpts;
    }
  } else {
    document.getElementById("loading-msg").innerText = "無法載入員工資料，請檢查連線。";
    document.getElementById("loading-msg").className = "alert alert-danger text-center";
  }

  document.getElementById("login-form").addEventListener("submit", (e) => {
    e.preventDefault();
    // 統一轉大寫
    const inputId = document.getElementById("employee-input").value.trim().toUpperCase();
    const loginUnit = document.getElementById("login-unit-select").value;
    
    // 尋找員工時也將來源轉大寫比對，避免大小寫不一
    const selectedEmp = State.employeeData.find(emp => String(emp['員工編號']).toUpperCase() === inputId);
    
    if (selectedEmp) {
      const user = { 
        id: inputId, 
        name: selectedEmp['姓名'], 
        role: selectedEmp['權限'],
        unit: loginUnit // 紀錄登入單位
      };
      sessionStorage.setItem("currentUser", JSON.stringify(user));
      window.location.reload(); 
    } else {
      alert("找不到此員工編號，請重新確認！");
      document.getElementById("employee-input").value = "";
    }
  });
}

function logout() {
  sessionStorage.removeItem("currentUser");
  window.location.reload();
}

// ================= 系統初始化 =================

async function initApp(user) {
  document.getElementById("login-container").classList.add("d-none-important");
  document.getElementById("app-container").classList.remove("d-none-important");
  document.getElementById("user-info").innerText = `${user.name} (${user.unit || '無單位'})`;

  document.getElementById("overview-content").innerHTML = '<div class="alert alert-info">正在載入系統巨量資料，請稍候...</div>';
  
  const initData = await fetchData(`getInitData&days=${typeof LOAD_HISTORY_DAYS !== 'undefined' ? LOAD_HISTORY_DAYS : 0}`);
  
  if (!initData || Object.keys(initData).length === 0) {
      alert("資料載入失敗，請檢查網路連線或重新整理頁面。");
      return;
  }

  State.employeeData = initData.employees || [];
  State.allDrugs = initData.allDrugs || [];
  State.activeDrugs = initData.activeDrugs || [];
  State.unitData = initData.units || [];
  State.applications = initData.applications || [];
  State.dispenseLogs = initData.dispenseLogs || [];
  
  const menuContainer = document.getElementById("dynamic-drug-menu");
  const overviewFilter = document.getElementById("overview-drug-filter");
  
  if(State.activeDrugs.length > 0) {
    menuContainer.innerHTML = '<div class="px-3 pt-3 pb-1 text-secondary small fw-bold">藥品專區</div>';
    State.activeDrugs.forEach(drug => {
      const code = String(drug['藥品代碼']).toUpperCase();
      const name = drug['藥品名稱'];
      menuContainer.innerHTML += `
        <li class="nav-item">
          <a href="#" class="nav-link drug-menu-item" id="menu-${code}" onclick="openDrugDashboard('${code}', '${name}', this)">
            <i class="bi bi-capsule me-1"></i> ${name}
          </a>
        </li>
      `;
      if(overviewFilter) overviewFilter.innerHTML += `<option value="${code}">${name}</option>`;
    });
  }
  
  populateUnitSelects();
  
  // 👉 修正：精準對應「空白欄位五」作為主管權限判斷
  const managerSelect = document.getElementById("app-manager");
  if(managerSelect && State.employeeData) {
      let mgrHtml = '<option value="">-- 請選擇簽核主管 --</option>';
      State.employeeData.forEach(emp => {
          let isManager = false;
          // 直接鎖定「空白欄位五」是否為「是」
          if (emp['空白欄位五'] === '是' || emp['主管權限'] === '是' || emp['主管'] === '是') {
              isManager = true;
          } else {
              Object.keys(emp).forEach(key => {
                  if ((key.includes('主管') || key === '空白欄位五') && emp[key] === '是') isManager = true;
              });
          }
          if (isManager && emp['姓名']) {
              mgrHtml += `<option value="${emp['姓名']}">${emp['姓名']} (${emp['員工編號']})</option>`;
          }
      });
      managerSelect.innerHTML = mgrHtml;
  }

  if (typeof renderOverview === "function") renderOverview();
  if (typeof renderDrugManageTable === "function") renderDrugManageTable(); 
}

let lastSyncTimestamp = 0;
let isSmartSyncing = false;
let smartSyncPromise = null;

// 👉 全新：智能無感同步引擎
window.smartSync = async function(force = false) {
    const now = Date.now();
    
    // 如果距離上次同步不到 15 秒，且不強制更新，則直接秒回傳 (啟動快取護盾，保障連續刷條碼極速體驗)
    if (!force && (now - lastSyncTimestamp < 15000)) {
        return true; 
    }
    
    // 如果已經有另一個動作正在同步中，就搭順風車等待同一個結果 (避免連按 Enter 發出多個請求)
    if (isSmartSyncing) return smartSyncPromise;

    isSmartSyncing = true;
    smartSyncPromise = (async () => {
        try {
            const syncData = await fetchData(`getSyncData&days=${typeof LOAD_HISTORY_DAYS !== 'undefined' ? LOAD_HISTORY_DAYS : 0}`);
            if (syncData) {
                State.applications = syncData.applications || [];
                State.dispenseLogs = syncData.dispenseLogs || [];
                State.allDrugs = syncData.allDrugs || [];
                lastSyncTimestamp = Date.now(); // 更新護盾時間
            }
            return true;
        } catch (e) {
            console.error("智能同步失敗:", e);
            return false;
        } finally {
            isSmartSyncing = false;
        }
    })();
    
    return smartSyncPromise;
};

// 手動強制同步按鈕改為呼叫智能引擎 (強制更新)
window.forceSyncData = async function() {
  if(!checkNetwork()) return;
  alert("開始與伺服器同步最新資料，請稍候...");
  
  await window.smartSync(true); // 傳入 true 無視 15 秒護盾
  
  if (State.currentSelectedDrugCode) {
    refreshSingleDrugDashboard();
  } else {
    renderOverview();
  }
  if (typeof renderDrugManageTable === "function") renderDrugManageTable();
  alert("資料同步完成！");
};

function populateUnitSelects() {
  const appUnitGrp = document.getElementById("app-unit-group");
  const dispUnitGrp = document.getElementById("disp-unit-group");
  if(State.unitData.length > 0) {
    let html = '';
    State.unitData.forEach((u, idx) => {
      if(u['單位名稱']) {
        html += `
          <input type="radio" class="btn-check" name="app-unit-radio" id="app-unit-${idx}" value="${u['單位名稱']}" autocomplete="off">
          <label class="btn btn-outline-primary" for="app-unit-${idx}">${u['單位名稱']}</label>
        `;
      }
    });
    if(appUnitGrp) appUnitGrp.innerHTML = html;
    let dispHtml = '';
    State.unitData.forEach((u, idx) => {
      if(u['單位名稱']) {
        dispHtml += `
          <input type="radio" class="btn-check" name="disp-unit-radio" id="disp-unit-${idx}" value="${u['單位名稱']}" autocomplete="off">
          <label class="btn btn-outline-primary" for="disp-unit-${idx}">${u['單位名稱']}</label>
        `;
      }
    });
    if(dispUnitGrp) dispUnitGrp.innerHTML = dispHtml;
  }
}

function switchView(viewId, element = null) {
  document.querySelectorAll(".view-section").forEach(el => el.classList.add("d-none-important"));
  const viewEl = document.getElementById(`view-${viewId}`);
  if(viewEl) viewEl.classList.remove("d-none-important");
  if (element) {
    document.querySelectorAll('.sidebar .nav-link').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
  }
}

// ================= 重選藥師 (Enter 鍵觸發) =================
function enablePharmacistChange(prefix) {
  const inputId = document.getElementById(`${prefix}-pharmacist-id`);
  const inputName = document.getElementById(`${prefix}-pharmacist-name`);
  inputId.readOnly = false;
  inputId.classList.remove("bg-light");
  inputId.value = "";
  inputName.value = "";
  inputId.focus();
  if (inputId._phHandler) inputId.removeEventListener('keypress', inputId._phHandler);
  inputId._phHandler = function(e) {
    if (e.key === 'Enter') {
      e.preventDefault(); 
      const val = inputId.value.trim().toUpperCase(); 
      if(val === "") return; 
      const emp = State.employeeData.find(e => String(e['員工編號']).toUpperCase() === val);
      if(emp) {
        inputName.value = emp['姓名'];
        inputId.value = val;
        inputId.readOnly = true;
        inputId.classList.add("bg-light");
      } else {
        alert('找不到此員工編號，請重新輸入！');
        inputId.value = "";
      }
    }
  };
  inputId.addEventListener('keypress', inputId._phHandler);
}
