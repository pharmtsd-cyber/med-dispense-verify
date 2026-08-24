// js/app.js
let activeDrugs = [];
let employeeData = [];
let currentSelectedDrugCode = null;

// 用來儲存建立的 Chart 實例，方便切換時銷毀與重繪
let chartInstances = {}; 

document.addEventListener("DOMContentLoaded", async () => {
  const today = new Date();
  const priorDate = new Date(new Date().setDate(today.getDate() - 14));
  
  const todayStr = today.toISOString().split('T')[0];
  const priorStr = priorDate.toISOString().split('T')[0];
  
  // 設定總覽的日期
  document.getElementById("overview-date-start").value = priorStr;
  document.getElementById("overview-date-end").value = todayStr;
  // 設定單一藥品 Dashboard 的日期
  document.getElementById("single-drug-date-start").value = priorStr;
  document.getElementById("single-drug-date-end").value = todayStr;

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
  
  // 觸發該藥品的資料更新 (包含 Dashboard 與紀錄表)
  refreshSingleDrugDashboard();
}

// 點擊右上角「查詢」時，會連動更新 Dashboard 數字、圖表與下方的紀錄表
function refreshSingleDrugDashboard() {
  const code = currentSelectedDrugCode;
  if(!code) return;
  
  const startDate = document.getElementById("single-drug-date-start").value;
  const endDate = document.getElementById("single-drug-date-end").value;
  const recordType = document.getElementById("single-drug-record-type").value;
  
  // 1. 更新上半部的圖表與數據 (利用總覽的渲染機制)
  const statsContainer = document.getElementById("drug-dashboard-stats");
  document.getElementById("overview-drug-filter").value = code;
  // 實務上這裡還要將 startDate 與 endDate 傳入 renderOverview，讓圖表跟著日期變動
  renderOverview(); 
  
  setTimeout(() => {
    const cardContent = document.getElementById(`overview-card-${code}`);
    if(cardContent) {
       statsContainer.innerHTML = cardContent.innerHTML;
       drawChart(code);
    }
    document.getElementById("overview-drug-filter").value = "ALL";
  }, 150);

  // 2. 更新下半部的紀錄表
  document.getElementById("single-drug-records-table").innerHTML = 
    `正在撈取 <b>${startDate}</b> 至 <b>${endDate}</b> 的 ${recordType === 'ALL' ? '所有' : recordType} 紀錄...`;
    
  // TODO: 呼叫 getApplications 與 getDispenseLogs 來渲染下方的表格
}

// ================= 功能按鈕 =================
function openApplicationForm() {
  alert(`開啟填寫申請單 (鎖定藥品代碼: ${currentSelectedDrugCode}) - 開發中`);
}

function openDispenseForm() {
  alert(`開啟調劑剩餘量檢核作業 (鎖定藥品代碼: ${currentSelectedDrugCode}) - 開發中`);
}

// ==========================================
// 藥品主檔維護 (整合邏輯)
// ==========================================
async function renderDrugManageTable() {
  const tableBody = document.getElementById("drug-table-body");
  tableBody.innerHTML = '<tr><td colspan="7" class="text-center">資料載入中...</td></tr>';
  
  const allDrugs = await fetchData('getAllDrugs');
  tableBody.innerHTML = '';
  
  if (allDrugs.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="7" class="text-center">目前無藥品資料。</td></tr>';
    return;
  }

  allDrugs.forEach(drug => {
    if(!drug['藥品代碼']) return; 
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="fw-bold">${drug['藥品代碼']}</td>
      <td>${drug['藥品名稱']}</td>
      <td>${drug['管制天數']} 天</td>
      <td>${drug['預設申請天數']} / ${drug['預設申請數量']}</td>
      <td>${drug['展延天數上限']} / ${drug['展延數量上限']}</td>
      <td><span class="badge ${drug['啟用狀態'].toUpperCase() === 'Y' ? 'bg-success' : 'bg-danger'}">${drug['啟用狀態'].toUpperCase() === 'Y' ? '啟用' : '停用'}</span></td>
      <td><button class="btn btn-sm btn-outline-primary btn-edit-drug" data-code="${drug['藥品代碼']}">編輯</button></td>
    `;
    tableBody.appendChild(tr);
  });

  document.querySelectorAll(".btn-edit-drug").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const code = e.target.getAttribute("data-code");
      const drug = allDrugs.find(d => d['藥品代碼'] === code);
      if (drug) {
        document.getElementById("drug-code").value = drug['藥品代碼'];
        document.getElementById("drug-name").value = drug['藥品名稱'];
        document.getElementById("drug-control-days").value = drug['管制天數'];
        document.getElementById("drug-default-days").value = drug['預設申請天數'];
        document.getElementById("drug-default-qty").value = drug['預設申請數量'];
        document.getElementById("drug-max-ext-days").value = drug['展延天數上限'];
        document.getElementById("drug-max-ext-qty").value = drug['展延數量上限'];
        document.getElementById("drug-status").value = drug['啟用狀態'].toUpperCase() || 'Y';
        document.getElementById("drug-code").setAttribute("readonly", true);
      }
    });
  });
}

// 綁定藥品維護表單事件
document.getElementById("drug-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btnSave = document.getElementById("btn-save-drug");
  btnSave.disabled = true;
  btnSave.innerText = "儲存中...";

  const dataObj = {
    "藥品代碼": document.getElementById("drug-code").value.trim(),
    "藥品名稱": document.getElementById("drug-name").value.trim(),
    "管制天數": document.getElementById("drug-control-days").value,
    "預設申請天數": document.getElementById("drug-default-days").value,
    "預設申請數量": document.getElementById("drug-default-qty").value,
    "展延天數上限": document.getElementById("drug-max-ext-days").value,
    "展延數量上限": document.getElementById("drug-max-ext-qty").value,
    "啟用狀態": document.getElementById("drug-status").value
  };

  const res = await postData("saveDrug", dataObj);
  if(res.status === 'success') {
    alert("藥品設定已儲存！");
    document.getElementById("btn-clear-drug").click();
    await renderDrugManageTable();
  } else {
    alert("錯誤：" + res.message);
  }
  btnSave.disabled = false;
  btnSave.innerText = "儲存藥品設定";
});

document.getElementById("btn-clear-drug").addEventListener("click", () => {
  document.getElementById("drug-form").reset();
  document.getElementById("drug-code").removeAttribute("readonly");
});

// 如果點擊側邊欄的「藥品主檔維護」，自動載入表格
document.querySelector('a[onclick="switchView(\'drug-manage\', this)"]').addEventListener('click', renderDrugManageTable);

// ==========================================
// 申請單與調劑單的開啟邏輯 (代入當前藥品)
// ==========================================
function openApplicationForm() {
  if(!currentSelectedDrugCode) return;
  const drug = activeDrugs.find(d => d['藥品代碼'] === currentSelectedDrugCode);
  
  // 顯示藥品名稱在標題
  document.getElementById("app-form-drug-name").innerText = `${drug['藥品名稱']} (${drug['藥品代碼']})`;
  document.getElementById("app-back-drug-name").innerText = drug['藥品名稱'];
  
  // 清空表單，準備輸入病歷號
  document.getElementById("app-form").reset();
  document.getElementById("app-type").disabled = true;
  document.getElementById("app-type").innerHTML = '<option value="">-- 請先輸入病歷號 --</option>';
  
  switchView('application');
  document.getElementById("app-patient-id").focus();
}

function openDispenseForm() {
  if(!currentSelectedDrugCode) return;
  const drug = activeDrugs.find(d => d['藥品代碼'] === currentSelectedDrugCode);
  
  document.getElementById("disp-form-drug-name").innerText = `${drug['藥品名稱']} (${drug['藥品代碼']})`;
  document.getElementById("disp-back-drug-name").innerText = drug['藥品名稱'];
  
  document.getElementById("dispense-form").reset();
  document.getElementById("btn-submit-disp").classList.add("d-none-important");
  
  switchView('dispense');
  document.getElementById("barcode-input").focus();
}

// ==========================================
// 核心邏輯一：申請單防呆與提交
// ==========================================
const inputAppPid = document.getElementById("app-patient-id");
const selectAppType = document.getElementById("app-type");
const inputAppDays = document.getElementById("app-days");
const selectAppDays = document.getElementById("app-days-select");
const inputAppQty = document.getElementById("app-qty");
const btnSubmitApp = document.getElementById("btn-submit-app");
const alertMsg = document.getElementById("alert-msg");
const alertContainer = document.getElementById("alert-msg-container");
const managerGroup = document.getElementById("manager-input-group");
const inputManager = document.getElementById("app-manager");

// 監聽病歷號輸入完成 (離開焦點時觸發檢查)
inputAppPid.addEventListener("blur", async () => {
  const pid = inputAppPid.value.trim();
  const drugCode = currentSelectedDrugCode;
  
  if (pid && drugCode) {
    alertContainer.style.display = "block";
    alertMsg.className = "alert alert-info";
    alertMsg.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>正在檢查 14 天內申請紀錄...';
    selectAppType.disabled = true;
    btnSubmitApp.disabled = true;

    // 呼叫後端 API 檢查資格
    const result = await fetch(`${GAS_API_URL}?action=checkEligibility&patientId=${pid}&drugCode=${drugCode}`).then(res => res.json());
    
    if(result.status === 'success') {
      const { hasInitialIn14Days, hasExtensionIn14Days } = result.data;
      
      // 重新生成選項 (為了重置狀態)
      selectAppType.innerHTML = `
        <option value="">-- 請選擇 --</option>
        <option value="初次申請" id="opt-initial">初次申請</option>
        <option value="展延申請" id="opt-extend">展延申請</option>
        <option value="複陽申請" id="opt-repositive">複陽申請</option>
      `;
      
      if (hasInitialIn14Days && !hasExtensionIn14Days) {
        // 情境 B: 已有初次，無展延 -> 鎖定初次
        document.getElementById("opt-initial").disabled = true;
        alertMsg.className = "alert alert-warning";
        alertMsg.textContent = "注意：此病患 14 天內已申請過，僅可申請「展延」或由主管同意「複陽」。";
      } else if (hasInitialIn14Days && hasExtensionIn14Days) {
        // 情境 C: 已展延過 -> 鎖定初次與展延
        document.getElementById("opt-initial").disabled = true;
        document.getElementById("opt-extend").disabled = true;
        alertMsg.className = "alert alert-danger";
        alertMsg.textContent = "警告：此病患 14 天內已展延過，僅限申請「複陽」。";
      } else {
         // 情境 A: 都沒申請過
         alertContainer.style.display = "none";
      }

      selectAppType.disabled = false;
    } else {
      alertMsg.className = "alert alert-danger";
      alertMsg.textContent = "檢查失敗，請重試！";
    }
  }
});

// 監聽申請類別切換 (動態調整天數與數量)
selectAppType.addEventListener("change", () => {
  const type = selectAppType.value;
  if(!type) return;
  
  const drug = activeDrugs.find(d => d['藥品代碼'] === currentSelectedDrugCode);
  btnSubmitApp.disabled = false;
  managerGroup.style.display = "none";
  inputManager.required = false;

  if (type === "展延申請") {
    inputAppDays.style.display = "none";
    selectAppDays.style.display = "block";
    inputAppDays.required = false;
    selectAppDays.required = true;
    
    const defaultDays = parseInt(drug['預設申請天數'] || 3);
    const maxExtDays = parseInt(drug['展延天數上限'] || 5);
    
    selectAppDays.innerHTML = '<option value="">請選擇展延天數</option>';
    for(let i = defaultDays + 1; i <= maxExtDays; i++) {
       selectAppDays.innerHTML += `<option value="${i}">${i} 天</option>`;
    }
    inputAppQty.value = drug['展延數量上限'] || 2;
  } else {
    // 初次 或 複陽
    inputAppDays.style.display = "block";
    selectAppDays.style.display = "none";
    inputAppDays.required = true;
    selectAppDays.required = false;
    
    inputAppDays.value = drug['預設申請天數'] || 3;
    inputAppQty.value = drug['預設申請數量'] || 3;
    
    if (type === "複陽申請") {
      managerGroup.style.display = "block";
      inputManager.required = true;
    }
  }
});

// 提交申請單
document.getElementById("app-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  btnSubmitApp.disabled = true;
  btnSubmitApp.innerText = "傳送中...";
  
  const type = selectAppType.value;
  const user = JSON.parse(sessionStorage.getItem("currentUser"));
  
  const dataObj = {
    "病歷號": inputAppPid.value.trim(),
    "藥品代碼": currentSelectedDrugCode,
    "申請類別": type,
    "申請天數": type === "展延申請" ? selectAppDays.value : inputAppDays.value,
    "申請數量": inputAppQty.value,
    "處理單位": document.getElementById("app-unit").value,
    "申請日期": new Date().toLocaleDateString('zh-TW'),
    "收單時間": new Date().toLocaleTimeString('zh-TW'),
    "主管核准人": inputManager.value,
    "申請備註": document.getElementById("app-note").value,
    "藥師員工編號": user.id,
    "藥師姓名": user.name
  };

  const res = await postData("submitApplication", dataObj);
  if(res.status === 'success') {
    alert("申請單已成功送出！");
    switchView('drug-dashboard');
    refreshSingleDrugDashboard(); // 回去更新 Dashboard 數據
  } else {
    alert("錯誤：" + res.message);
    btnSubmitApp.disabled = false;
    btnSubmitApp.innerText = "送出申請";
  }
});


// ==========================================
// 核心邏輯二：條碼解析與調劑總量檢核
// ==========================================
const barcodeInput = document.getElementById("barcode-input");
const btnCheckLimit = document.getElementById("btn-check-limit");
const btnSubmitDisp = document.getElementById("btn-submit-disp");

// 監聽條碼槍輸入
barcodeInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const str = barcodeInput.value.trim();
    if(!str) return;
    
    // 解析條碼: 病歷號;藥品代碼;領藥號;數量;條碼號;用法
    const parts = str.split(';');
    if (parts.length >= 4) {
      if(parts[1] !== currentSelectedDrugCode) {
         alert(`⚠️ 條碼解析錯誤：藥品代碼 (${parts[1]}) 與當前頁面 (${currentSelectedDrugCode}) 不符！`);
         barcodeInput.value = "";
         return;
      }
      document.getElementById("disp-patient-id").value = parts[0];
      document.getElementById("disp-no").value = parts[2];
      document.getElementById("disp-qty").value = parts[3];
      barcodeInput.value = ""; 
      
      // 成功解析後，隱藏送出按鈕，強迫使用者點擊「檢核」
      btnSubmitDisp.classList.add("d-none-important");
    } else {
      alert("條碼格式不符！");
    }
  }
});

// 送出前檢核剩餘量 (這部分需要向後端撈取所有紀錄來計算)
btnCheckLimit.addEventListener("click", async () => {
  const pid = document.getElementById("disp-patient-id").value.trim();
  const qty = parseInt(document.getElementById("disp-qty").value);
  const type = document.getElementById("disp-type").value;
  
  if(!pid || !qty) { alert("請先刷入條碼或輸入完整資料"); return; }
  
  btnCheckLimit.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>計算中...';
  btnCheckLimit.disabled = true;

  // 為了精準計算，我們需要把 Applications 跟 DispenseLogs 都撈回來算
  // 實務上這段邏輯寫在 GAS 後端會更好，但為了讓您好維護，我們先在前端處理
  const apps = await fetchData('getApplications');
  const logs = await fetchData('getDispenseLogs');
  
  // 計算累積申請量
  let totalAllowed = 0;
  apps.forEach(app => {
    if(app['病歷號'] === pid && app['藥品代碼'] === currentSelectedDrugCode && app['作廢'] !== 'Y') {
      totalAllowed += parseInt(app['申請數量'] || 0);
    }
  });

  // 計算已調劑與退藥量
  let totalDispensed = 0;
  let totalReturned = 0;
  logs.forEach(log => {
    if(log['病歷號'] === pid && log['藥品代碼'] === currentSelectedDrugCode && log['作廢'] !== 'Y') {
      totalDispensed += parseInt(log['調劑數量'] || 0);
      totalReturned += parseInt(log['退藥數量'] || 0);
    }
  });

  const currentUsed = totalDispensed - totalReturned;
  const remaining = totalAllowed - currentUsed;
  
  btnCheckLimit.innerHTML = '🔍 送出前：檢核剩餘可用量';
  btnCheckLimit.disabled = false;

  // 判斷邏輯
  if (type === "調劑") {
    if (totalAllowed === 0) {
      alert("⚠️ 阻擋：此病患尚未申請此藥品！");
      return;
    }
    if (qty > remaining) {
      alert(`⚠️ 阻擋：超量調劑！\n累積申請：${totalAllowed}\n已發藥量：${currentUsed}\n剩餘額度：${remaining}\n本次欲調劑：${qty}`);
      return;
    }
    alert(`✅ 檢核通過！\n剩餘額度：${remaining} -> 調劑後剩餘：${remaining - qty}`);
  } else {
    // 退藥
    if (qty > currentUsed) {
      alert(`⚠️ 阻擋：退藥數量 (${qty}) 大於總調劑量 (${currentUsed})！`);
      return;
    }
    alert(`✅ 檢核通過！本次退藥將恢復額度。`);
  }

  // 檢核通過，顯示送出按鈕
  btnSubmitDisp.classList.remove("d-none-important");
});

// 提交調劑單
document.getElementById("dispense-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  btnSubmitDisp.disabled = true;
  btnSubmitDisp.innerText = "寫入紀錄中...";
  
  const user = JSON.parse(sessionStorage.getItem("currentUser"));
  const type = document.getElementById("disp-type").value;
  const qty = parseInt(document.getElementById("disp-qty").value);

  const dataObj = {
    "病歷號": document.getElementById("disp-patient-id").value,
    "藥品代碼": currentSelectedDrugCode,
    "選擇調劑或退藥": type,
    "調劑數量": type === "調劑" ? qty : 0,
    "退藥數量": type === "退藥" ? qty : 0,
    "手動或條碼": "條碼掃描",
    "領藥號": document.getElementById("disp-no").value,
    "備註": document.getElementById("disp-note").value,
    "調劑日期": new Date().toLocaleDateString('zh-TW'),
    "調劑時間": new Date().toLocaleTimeString('zh-TW'),
    "藥師員工編號": user.id,
    "藥師姓名": user.name
  };

  const res = await postData("submitDispense", dataObj);
  if(res.status === 'success') {
    alert("調劑紀錄已成功儲存！");
    document.getElementById("dispense-form").reset();
    btnSubmitDisp.classList.add("d-none-important");
    barcodeInput.focus();
  } else {
    alert("錯誤：" + res.message);
    btnSubmitDisp.disabled = false;
    btnSubmitDisp.innerText = "確認送出紀錄";
  }
});
