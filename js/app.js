// js/app.js
let activeDrugs = [];
let employeeData = [];
let currentSelectedDrugCode = null;

// 用來儲存建立的 Chart 實例，方便切換時銷毀與重繪
let chartInstances = {}; 

document.addEventListener("DOMContentLoaded", async () => {
  // 設定預設日期 (14天內)
  const today = new Date();
  const priorDate = new Date(new Date().setDate(today.getDate() - 14));
  
  const todayStr = today.toISOString().split('T')[0];
  const priorStr = priorDate.toISOString().split('T')[0];
  
  document.getElementById("overview-date-start").value = priorStr;
  document.getElementById("overview-date-end").value = todayStr;
  document.getElementById("record-date-start").value = priorStr;
  document.getElementById("record-date-end").value = todayStr;

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
  
  employeeData = await fetchData('getEmployeeData');
  
  if (employeeData.length > 0) {
    document.getElementById("loading-msg").classList.add("d-none-important");
    document.getElementById("login-form").classList.remove("d-none-important");
  } else {
    document.getElementById("loading-msg").innerText = "無法載入員工資料，請檢查連線。";
    document.getElementById("loading-msg").className = "alert alert-danger text-center";
  }

  document.getElementById("login-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const inputId = document.getElementById("employee-input").value.trim();
    const selectedEmp = employeeData.find(emp => emp['員工編號'] === inputId);
    
    if (selectedEmp) {
      const user = { id: selectedEmp['員工編號'], name: selectedEmp['姓名'], role: selectedEmp['權限'] };
      sessionStorage.setItem("currentUser", JSON.stringify(user));
      window.location.reload(); // 重整載入系統
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
  document.getElementById("user-info").innerText = `${user.name} (${user.role})`;

  // 載入藥品清單
  activeDrugs = await fetchData('getActiveDrugs');
  const menuContainer = document.getElementById("dynamic-drug-menu");
  const overviewFilter = document.getElementById("overview-drug-filter");
  
  if(activeDrugs.length > 0) {
    menuContainer.innerHTML = '<div class="px-3 pt-3 pb-1 text-secondary small fw-bold">藥品專區</div>';
    activeDrugs.forEach(drug => {
      const code = drug['藥品代碼'];
      const name = drug['藥品名稱'];
      
      // 生成側邊欄
      menuContainer.innerHTML += `
        <li class="nav-item">
          <a href="#" class="nav-link drug-menu-item" id="menu-${code}" onclick="openDrugDashboard('${code}', '${name}', this)">
            <i class="bi bi-capsule me-1"></i> ${name}
          </a>
        </li>
      `;
      // 生成總覽下拉選單
      overviewFilter.innerHTML += `<option value="${code}">${name}</option>`;
    });
  }
  
  // 渲染總覽畫面
  renderOverview();
}

// ================= 畫面切換邏輯 =================
function switchView(viewId, element = null) {
  document.querySelectorAll(".view-section").forEach(el => el.classList.add("d-none-important"));
  document.getElementById(`view-${viewId}`).classList.remove("d-none-important");
  
  if (element) {
    document.querySelectorAll('.sidebar .nav-link').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
  }
}

// ================= 總覽畫面生成 =================
function renderOverview() {
  const filterCode = document.getElementById("overview-drug-filter").value;
  const container = document.getElementById("overview-content");
  container.innerHTML = ""; // 清空舊內容
  
  let drugsToRender = activeDrugs;
  if (filterCode !== "ALL") {
    drugsToRender = activeDrugs.filter(d => d['藥品代碼'] === filterCode);
  }

  drugsToRender.forEach(drug => {
    const code = drug['藥品代碼'];
    // 建立每個藥品的 HTML 區段
    const sectionHtml = `
      <div class="card shadow-sm border-0 mb-4" id="overview-card-${code}">
        <div class="card-header bg-white border-bottom border-primary border-3 py-3">
          <h5 class="mb-0 fw-bold text-primary"><i class="bi bi-box-seam me-2"></i>${drug['藥品名稱']} (${code})</h5>
        </div>
        <div class="card-body">
          <div class="row text-center mb-4">
            <div class="col-md-3 border-end">
              <div class="text-muted small">申請人數</div><h3 class="text-dark mt-1">15 人</h3>
            </div>
            <div class="col-md-3 border-end">
              <div class="text-muted small">使用總量</div><h3 class="text-info mt-1">42 支</h3>
            </div>
            <div class="col-md-3 border-end">
              <div class="text-muted small">調劑發出</div><h3 class="text-success mt-1">38 支</h3>
            </div>
            <div class="col-md-3">
              <div class="text-muted small">退藥數量</div><h3 class="text-danger mt-1">2 支</h3>
            </div>
          </div>
          <!-- 圖表區塊 -->
          <div style="height: 250px; width: 100%;">
            <canvas id="chart-${code}"></canvas>
          </div>
        </div>
      </div>
    `;
    container.innerHTML += sectionHtml;
  });

  // 等待 HTML 插入後，繪製 Chart.js
  setTimeout(() => {
    drugsToRender.forEach(drug => drawChart(drug['藥品代碼']));
  }, 100);
}

// 繪製假資料折線圖
function drawChart(code) {
  const ctx = document.getElementById(`chart-${code}`);
  if(!ctx) return;
  
  // 銷毀舊圖表避免重疊
  if (chartInstances[code]) { chartInstances[code].destroy(); }

  chartInstances[code] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['08/19', '08/20', '08/21', '08/22', '08/23', '08/24'],
      datasets: [
        { label: '申請量', data: [5, 2, 8, 4, 1, 6], borderColor: '#0dcaf0', tension: 0.3 },
        { label: '調劑量', data: [4, 3, 7, 3, 2, 5], borderColor: '#198754', tension: 0.3 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top' } }
    }
  });
}

// ================= 單一藥品主頁面切換 =================
function openDrugDashboard(code, name, element) {
  currentSelectedDrugCode = code;
  switchView('drug-dashboard', element);
  
  document.getElementById("current-drug-title").innerText = `${name} (${code})`;
  
  // 為了節省資源，我們直接把總覽頁面中「該藥品」的那一整塊 HTML 複製過來！
  const statsContainer = document.getElementById("drug-dashboard-stats");
  
  // 呼叫 renderOverview 但只渲染該藥品 (背景隱藏執行)
  document.getElementById("overview-drug-filter").value = code;
  renderOverview(); 
  
  // 將總覽產生的卡片內容，搬移到單一藥品頁面
  setTimeout(() => {
    const cardContent = document.getElementById(`overview-card-${code}`);
    if(cardContent) {
       statsContainer.innerHTML = cardContent.innerHTML;
       // 重繪圖表
       drawChart(code);
    }
    // 把總覽的 filter 復原
    document.getElementById("overview-drug-filter").value = "ALL";
  }, 150);
}

// ================= 功能按鈕 =================
function openApplicationForm() {
  alert(`開啟填寫申請單 (鎖定藥品代碼: ${currentSelectedDrugCode}) - 開發中`);
}

function openDispenseForm() {
  alert(`開啟調劑剩餘量檢核作業 (鎖定藥品代碼: ${currentSelectedDrugCode}) - 開發中`);
}
