// js/main.js
document.addEventListener("DOMContentLoaded", async () => {
  // 預設日期設定
  const today = new Date();
  const priorDate = new Date(new Date().setDate(today.getDate() - 14));
  const todayStr = today.toISOString().split('T')[0];
  const priorStr = priorDate.toISOString().split('T')[0];
  
  const dateInputs = ['overview-date-start', 'overview-date-end', 'single-drug-date-start', 'single-drug-date-end'];
  dateInputs.forEach(id => {
      const el = document.getElementById(id);
      if(el) el.value = id.includes('start') ? priorStr : todayStr;
  });

  const userStr = sessionStorage.getItem("currentUser");
  if (userStr) {
    initApp(JSON.parse(userStr));
  } else {
    initLogin();
  }
});

async function initLogin() {
  document.getElementById("login-container").classList.remove("d-none-important");
  document.getElementById("app-container").classList.add("d-none-important");
  
  State.employeeData = await fetchData('getEmployeeData');
  
  if (State.employeeData.length > 0) {
    document.getElementById("loading-msg").classList.add("d-none-important");
    document.getElementById("login-form").classList.remove("d-none-important");
  } else {
    document.getElementById("loading-msg").innerText = "無法載入員工資料，請檢查連線。";
    document.getElementById("loading-msg").className = "alert alert-danger text-center";
  }

  document.getElementById("login-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const inputId = document.getElementById("employee-input").value.trim();
    const selectedEmp = State.employeeData.find(emp => emp['員工編號'] === inputId);
    
    if (selectedEmp) {
      const user = { id: selectedEmp['員工編號'], name: selectedEmp['姓名'], role: selectedEmp['權限'] };
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

async function initApp(user) {
  document.getElementById("login-container").classList.add("d-none-important");
  document.getElementById("app-container").classList.remove("d-none-important");
  document.getElementById("user-info").innerText = `${user.name} (${user.role})`;

  State.activeDrugs = await fetchData('getActiveDrugs');
  State.unitData = await fetchData('getUnits');
  
  const menuContainer = document.getElementById("dynamic-drug-menu");
  const overviewFilter = document.getElementById("overview-drug-filter");
  
  if(State.activeDrugs.length > 0) {
    menuContainer.innerHTML = '<div class="px-3 pt-3 pb-1 text-secondary small fw-bold">藥品專區</div>';
    State.activeDrugs.forEach(drug => {
      const code = drug['藥品代碼'];
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
  
  if (typeof renderOverview === "function") renderOverview();
}

function populateUnitSelects() {
  const appUnit = document.getElementById("app-unit");
  const dispUnit = document.getElementById("disp-unit");
  if(appUnit && dispUnit && State.unitData.length > 0) {
    let unitOptions = '<option value="">--請選擇--</option>';
    State.unitData.forEach(u => {
      if(u['單位名稱']) unitOptions += `<option value="${u['單位名稱']}">${u['單位名稱']}</option>`;
    });
    appUnit.innerHTML = unitOptions;
    dispUnit.innerHTML = unitOptions;
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

// 修復：藥師重選的無限迴圈問題
function enablePharmacistChange(prefix) {
  const inputId = document.getElementById(`${prefix}-pharmacist-id`);
  const inputName = document.getElementById(`${prefix}-pharmacist-name`);
  
  inputId.readOnly = false;
  inputId.classList.remove("bg-light");
  inputId.value = "";
  inputName.value = "";
  inputId.focus();
  
  const checkPharmacist = function() {
    const val = inputId.value.trim();
    if(val === "") return; 
    
    const emp = State.employeeData.find(e => e['員工編號'] === val);
    if(emp) {
      inputName.value = emp['姓名'];
      inputId.readOnly = true;
      inputId.classList.add("bg-light");
    } else {
      alert('找不到此員工編號，請重新輸入！');
      inputId.value = ""; // 清空欄位而不是強制 focus，避免迴圈
    }
    inputId.removeEventListener('blur', checkPharmacist);
  };
  inputId.addEventListener('blur', checkPharmacist);
}
