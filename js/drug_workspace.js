// js/drug_workspace.js

let activeDrugs = [];

document.addEventListener("DOMContentLoaded", async () => {
  const userStr = sessionStorage.getItem("currentUser");
  if (!userStr) {
    window.location.href = "index.html";
    return;
  }
  const user = JSON.parse(userStr);

  const tabList = document.getElementById("drugTabs");
  const tabContent = document.getElementById("drugTabContent");
  const loadingMsg = document.getElementById("loading-msg");

  // 1. 取得啟用的藥品清單
  activeDrugs = await fetchData('getActiveDrugs');
  loadingMsg.style.display = "none";

  if (activeDrugs.length === 0) {
    tabContent.innerHTML = '<div class="alert alert-warning">目前無啟用的藥品，請先至「藥品主檔維護」新增。</div>';
    return;
  }

  // 2. 為每個藥品生成獨立的頁籤與內容
  activeDrugs.forEach((drug, index) => {
    const code = drug['藥品代碼'];
    const safeCode = code.replace(/[^a-zA-Z0-9]/g, ''); // 轉換成安全的 HTML ID
    const name = drug['藥品名稱'];
    const isActive = index === 0 ? 'active' : '';

    // -- 生成頁籤標題 (Tab) --
    const tabLi = document.createElement("li");
    tabLi.className = "nav-item";
    tabLi.setAttribute("role", "presentation");
    tabLi.innerHTML = `
      <button class="nav-link fs-5 ${isActive}" id="tab-${safeCode}" data-bs-toggle="tab" data-bs-target="#pane-${safeCode}" type="button" role="tab">
        ${name} (${code})
      </button>
    `;
    tabList.appendChild(tabLi);

    // -- 生成頁籤內容 (Pane) --
    const paneDiv = document.createElement("div");
    paneDiv.className = `tab-pane fade ${isActive ? 'show active' : ''} p-3 border border-top-0 bg-white`;
    paneDiv.id = `pane-${safeCode}`;
    paneDiv.setAttribute("role", "tabpanel");

    // 每個藥品專屬的畫面結構 (Dashboard + 調劑區 + 查詢區)
    paneDiv.innerHTML = `
      <div class="row">
        <!-- 左側：調劑與退藥作業區 -->
        <div class="col-md-6 border-end">
          <h4 class="text-primary mb-3">調劑與退藥作業</h4>
          
          <div class="alert alert-warning mb-3">
            <label class="fw-bold text-danger">📷 條碼掃描區 (請在此處刷入條碼)</label>
            <input type="text" id="barcode-${safeCode}" class="form-control border-danger mt-1 barcode-input" placeholder="掃描或輸入條碼字串後按 Enter" data-code="${code}">
          </div>

          <form class="dispense-form" id="form-${safeCode}" data-code="${code}">
            <div class="row g-2 mb-3">
              <div class="col-6">
                <label>病歷號</label>
                <input type="text" id="pid-${safeCode}" class="form-control req-field" required>
              </div>
              <div class="col-6">
                <label>領藥號 / 退藥號</label>
                <input type="text" id="no-${safeCode}" class="form-control req-field" required>
              </div>
              <div class="col-6">
                <label>作業類別</label>
                <select id="type-${safeCode}" class="form-select req-field">
                  <option value="調劑">調劑發藥</option>
                  <option value="退藥">退藥</option>
                </select>
              </div>
              <div class="col-6">
                <label>數量</label>
                <input type="number" id="qty-${safeCode}" class="form-control req-field" required min="1">
              </div>
              <div class="col-12">
                <label>備註 (退藥請務必填寫)</label>
                <input type="text" id="note-${safeCode}" class="form-control">
              </div>
            </div>
            <button type="button" class="btn btn-info w-100 mb-2 btn-check-limit" data-safe="${safeCode}" data-code="${code}">🔍 送出前：檢核剩餘可用量</button>
            <button type="submit" class="btn btn-success w-100 btn-submit-dispense" id="btn-submit-${safeCode}" disabled>確認送出紀錄</button>
          </form>
        </div>

        <!-- 右側：此藥品的儀表板與病歷查詢 -->
        <div class="col-md-6">
          <h4 class="text-secondary mb-3">病歷號查詢與狀態</h4>
          
          <div class="input-group mb-3">
            <input type="text" id="search-pid-${safeCode}" class="form-control" placeholder="輸入病歷號查詢使用紀錄">
            <button class="btn btn-outline-secondary btn-search" type="button" data-safe="${safeCode}" data-code="${code}">查詢</button>
          </div>

          <div class="card shadow-sm mb-3">
            <div class="card-header bg-light fw-bold">該病患此藥品額度狀態</div>
            <div class="card-body">
              <ul class="list-group list-group-flush" id="status-${safeCode}">
                <li class="list-group-item text-muted">請先在上方輸入病歷號進行查詢...</li>
              </ul>
            </div>
          </div>
          
          <!-- 未來可以擴充放入這個藥品整體的總用量 Dashboard 圓餅圖或長條圖 -->
        </div>
      </div>
    `;
    tabContent.appendChild(paneDiv);
  });

  // 3. 綁定條碼輸入事件 (對應到所屬頁籤)
  document.querySelectorAll('.barcode-input').forEach(input => {
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const safeCode = e.target.id.split('-')[1]; // 取得專屬 ID 後綴
        const str = e.target.value.trim();
        if(!str) return;
        
        // 解析: 病歷號;藥品代碼;領藥號;數量;條碼號;用法
        const parts = str.split(';');
        if (parts.length >= 4) {
          const barcodeDrugCode = parts[1];
          const expectedDrugCode = e.target.getAttribute("data-code");
          
          if(barcodeDrugCode !== expectedDrugCode) {
             alert(`⚠️ 嚴重警告：您掃描的藥品代碼 (${barcodeDrugCode}) 與當前頁籤 (${expectedDrugCode}) 不符！`);
             e.target.value = "";
             return;
          }

          document.getElementById(`pid-${safeCode}`).value = parts[0];
          document.getElementById(`no-${safeCode}`).value = parts[2];
          document.getElementById(`qty-${safeCode}`).value = parts[3];
          
          // 自動帶入右側查詢框並觸發查詢
          document.getElementById(`search-pid-${safeCode}`).value = parts[0];
          document.querySelector(`.btn-search[data-safe="${safeCode}"]`).click();

          e.target.value = ""; 
        } else {
          alert("條碼格式不符！");
        }
      }
    });
  });

  // 4. (預留) 檢核可用量與提交表單事件...
  // 這裡我們會需要向後端撈取 Applications 與 DispenseLogs 來動態計算
});
