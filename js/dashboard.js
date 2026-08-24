// js/dashboard.js
function renderOverview() {
  const filterCode = document.getElementById("overview-drug-filter").value;
  const container = document.getElementById("overview-content");
  if(!container) return;
  container.innerHTML = ""; 
  
  let drugsToRender = State.activeDrugs;
  if (filterCode !== "ALL") {
    drugsToRender = State.activeDrugs.filter(d => d['藥品代碼'] === filterCode);
  }

  drugsToRender.forEach(drug => {
    const code = drug['藥品代碼'];
    
    // 👉 真實資料計算邏輯
    let totalPatients = new Set();
    let totalAppQty = 0;
    State.applications.forEach(app => {
      if(String(app['藥品代碼']).toUpperCase() === code && app['作廢'] !== 'Y') {
        totalPatients.add(app['病歷號']);
        totalAppQty += parseInt(app['申請數量'] || 0);
      }
    });

    let totalDispensed = 0;
    let totalReturned = 0;
    State.dispenseLogs.forEach(log => {
      if(String(log['藥品代碼']).toUpperCase() === code && log['作廢'] !== 'Y') {
        totalDispensed += parseInt(log['調劑數量'] || 0);
        totalReturned += parseInt(log['退藥數量'] || 0);
      }
    });

    const sectionHtml = `
      <div class="card shadow-sm border-0 mb-4" id="overview-card-${code}">
        <div class="card-header bg-white border-bottom border-primary border-3 py-3">
          <h5 class="mb-0 fw-bold text-primary"><i class="bi bi-box-seam me-2"></i>${drug['藥品名稱']} (${code})</h5>
        </div>
        <div class="card-body">
          <div class="row text-center mb-4">
            <div class="col-md-3 border-end">
              <div class="text-muted small">申請人數</div><h3 class="text-dark mt-1">${totalPatients.size} 人</h3>
            </div>
            <div class="col-md-3 border-end">
              <div class="text-muted small">核准總量</div><h3 class="text-info mt-1">${totalAppQty} 支</h3>
            </div>
            <div class="col-md-3 border-end">
              <div class="text-muted small">發出總量</div><h3 class="text-success mt-1">${totalDispensed} 支</h3>
            </div>
            <div class="col-md-3">
              <div class="text-muted small">退回總量</div><h3 class="text-danger mt-1">${totalReturned} 支</h3>
            </div>
          </div>
          <div style="height: 250px; width: 100%;"><canvas id="chart-${code}"></canvas></div>
        </div>
      </div>
    `;
    container.innerHTML += sectionHtml;
  });

  setTimeout(() => {
    drugsToRender.forEach(drug => drawChart(drug['藥品代碼']));
  }, 100);
}

function drawChart(code) {
  const ctx = document.getElementById(`chart-${code}`);
  if(!ctx) return;
  if (State.chartInstances[code]) { State.chartInstances[code].destroy(); }
  State.chartInstances[code] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['08/19', '08/20', '08/21', '08/22', '08/23', '08/24'],
      datasets: [
        { label: '申請量', data: [5, 2, 8, 4, 1, 6], borderColor: '#0dcaf0', tension: 0.3 },
        { label: '調劑量', data: [4, 3, 7, 3, 2, 5], borderColor: '#198754', tension: 0.3 }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } }
  });
}

function openDrugDashboard(code, name, element) {
  State.currentSelectedDrugCode = code;
  switchView('drug-dashboard', element);
  document.getElementById("current-drug-title").innerText = `${name} (${code})`;
  refreshSingleDrugDashboard();
}

function refreshSingleDrugDashboard() {
  const code = State.currentSelectedDrugCode;
  if(!code) return;
  
  const startDate = document.getElementById("single-drug-date-start").value;
  const endDate = document.getElementById("single-drug-date-end").value;
  const recordType = document.getElementById("single-drug-record-type").value;
  
  const statsContainer = document.getElementById("drug-dashboard-stats");
  document.getElementById("overview-drug-filter").value = code;
  renderOverview(); 
  
  setTimeout(() => {
    const cardContent = document.getElementById(`overview-card-${code}`);
    if(cardContent && statsContainer) {
       statsContainer.innerHTML = cardContent.innerHTML;
       drawChart(code);
    }
    document.getElementById("overview-drug-filter").value = "ALL";
  }, 150);

  const tableContainer = document.getElementById("single-drug-records-table");
  if(tableContainer) {
    tableContainer.innerHTML = `<div class="text-center py-4">正在撈取 <b>${startDate}</b> 至 <b>${endDate}</b> 的 ${recordType === 'ALL' ? '所有' : recordType} 紀錄...</div>`;
  }
}
