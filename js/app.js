// js/app.js
let activeDrugs = [];
let currentSelectedDrugCode = null;

document.addEventListener("DOMContentLoaded", async () => {
  // 檢查登入狀態
  const userStr = sessionStorage.getItem("currentUser");
  if (userStr) {
    initApp(JSON.parse(userStr));
  } else {
    initLogin();
  }
});

// =================登入邏輯=================
async function initLogin() {
  document.getElementById("login-container").style.display = "block";
  document.getElementById("app-container").style.display = "none";
  
  const loadingMsg = document.getElementById("loading-msg");
  const loginForm = document.getElementById("login-form");
  const employeeSelect = document.getElementById("employee-select");

  const employeeData = await fetchData('getEmployeeData');
  
  if (employeeData.length > 0) {
    employeeSelect.innerHTML = '<option value="" selected disabled>-- 請選擇 --</option>';
    employeeData.forEach(emp => {
      if(emp['員工編號']) {
        employeeSelect.innerHTML += `<option value="${emp['員工編號']}">${emp['員工編號']} - ${emp['姓名']} (${emp['權限']})</option>`;
      }
    });
    loadingMsg.style.display = "none";
    loginForm.style.display = "block";
  }

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const selectedId = employeeSelect.value;
    const selectedEmp = employeeData.find(emp => emp['員工編號'] === selectedId);
    if (selectedEmp) {
      const user = { id: selectedEmp['員工編號'], name: selectedEmp['姓名'], role: selectedEmp['權限'] };
      sessionStorage.setItem("currentUser", JSON.stringify(user));
      initApp(user); // 登入成功，初始化主系統
    }
  });
}

function logout() {
  sessionStorage.removeItem("currentUser");
  window.location.reload();
}

// =================系統初始化=================
async function initApp(user) {
  document.getElementById("login-container").style.display = "none";
  document.getElementById("app-container").style.display = "flex";
  document.getElementById("user-info").innerText = `${user.name} (${user.role})`;

  // 載入側邊欄藥品選單
  activeDrugs = await fetchData('getActiveDrugs');
  const menuContainer = document.getElementById("dynamic-drug-menu");
  
  if(activeDrugs.length > 0) {
    menuContainer.innerHTML = '<div class="px-3 pt-2 text-muted small fw-bold">藥品專區</div>';
    activeDrugs.forEach(drug => {
      const code = drug['藥品代碼'];
      menuContainer.innerHTML += `
        <li class="nav-item">
          <a href="#" class="nav-link drug-menu-item" onclick="openDrugDashboard('${code}', '${drug['藥品名稱']}')">
            <i class="bi bi-capsule me-1"></i> ${drug['藥品名稱']}
          </a>
        </li>
      `;
    });
  }
}

// =================畫面切換邏輯=================
function switchView(viewId) {
  // 隱藏所有 view-section
  document.querySelectorAll(".view-section").forEach(el => el.style.display = "none");
  // 顯示指定的 view
  document.getElementById(`view-${viewId}`).style.display = "block";
  
  // 更新側邊欄 active 狀態 (簡化處理)
  document.querySelectorAll('.sidebar .nav-link').forEach(el => el.classList.remove('active'));
}

// 點擊側邊欄的藥品時觸發
function openDrugDashboard(code, name) {
  currentSelectedDrugCode = code;
  document.getElementById("current-drug-title").innerText = `📊 ${name} (${code}) 專屬儀表板`;
  switchView('drug-dashboard');
}

// 點擊「填寫申請單」
function openApplicationForm() {
  if(!currentSelectedDrugCode) return;
  // TODO: 將表單裡的「選擇藥品」自動鎖定在 currentSelectedDrugCode
  switchView('application');
}

// 點擊「調劑檢核」
function openDispenseForm() {
  if(!currentSelectedDrugCode) return;
  // TODO: 將調劑表單的藥品參數設為 currentSelectedDrugCode
  switchView('dispense');
}
