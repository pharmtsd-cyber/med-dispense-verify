// js/application.js

function openApplicationForm() {
  if(!State.currentSelectedDrugCode) return;
  const drug = State.activeDrugs.find(d => String(d['藥品代碼']).toUpperCase() === State.currentSelectedDrugCode);
  const user = JSON.parse(sessionStorage.getItem("currentUser"));

  document.getElementById("app-form-drug-name").innerText = `${drug['藥品名稱']} (${drug['藥品代碼']})`;
  document.getElementById("app-back-drug-name").innerText = drug['藥品名稱'];
  
  const form = document.getElementById("app-form");
  if(form) form.reset();
  
  document.getElementById("app-pharmacist-id").value = user.id;
  document.getElementById("app-pharmacist-name").value = user.name;
  document.getElementById("app-unit").value = user.unit || "";
  document.getElementById("app-start-date").value = new Date().toISOString().split('T')[0];
  
  document.getElementById("app-type").disabled = true;
  document.getElementById("app-type").innerHTML = '<option value="">-- 請先輸入病歷號 --</option>';
  
  switchView('application');
  document.getElementById("app-patient-id").focus();
  renderAppHistory(); // 載入下方歷史清單
}

// 渲染申請單歷史清單
function renderAppHistory() {
  const tbody = document.getElementById("app-history-table");
  if(!tbody) return;
  const pidFilter = document.getElementById("app-hist-pid").value.trim().toUpperCase();
  const startStr = document.getElementById("app-hist-start").value;
  const endStr = document.getElementById("app-hist-end").value;
  
  let html = "";
  State.applications.forEach(app => {
    if(String(app['藥品代碼']).toUpperCase() === State.currentSelectedDrugCode && app['作廢'] !== 'Y') {
      const appPid = String(app['病歷號']).toUpperCase();
      if(pidFilter && !appPid.includes(pidFilter)) return;
      
      const appDateStr = formatAsDate(app['申請日期']).replace(/\//g, '-');
      if(startStr && appDateStr < startStr) return;
      if(endStr && appDateStr > endStr) return;

      html += `<tr>
        <td>${app['申請日期']}</td>
        <td>${app['啟用日期'] || '-'}</td>
        <td class="fw-bold">${appPid}</td>
        <td><span class="badge bg-info text-dark">${app['申請類別']}</span></td>
        <td>${app['申請天數']} 天 / ${app['申請數量']} 支</td>
        <td>${app['處理單位']}</td>
      </tr>`;
    }
  });
  tbody.innerHTML = html || '<tr><td colspan="6" class="text-muted">查無符合紀錄</td></tr>';
}

document.addEventListener("DOMContentLoaded", () => {
  const inputAppPid = document.getElementById("app-patient-id");
  const selectAppType = document.getElementById("app-type");
  const inputAppDays = document.getElementById("app-days");
  const inputAppQty = document.getElementById("app-qty");
  const btnSubmitApp = document.getElementById("btn-submit-app");
  const lblMaxDays = document.getElementById("lbl-max-days");
  const lblMaxQty = document.getElementById("lbl-max-qty");

  // 用來儲存該病患目前累計的額度
  let currentAppliedDays = 0;
  let currentAppliedQty = 0;

  if(!inputAppPid) return;

  inputAppPid.addEventListener("blur", async () => {
    const pid = inputAppPid.value.trim().toUpperCase();
    inputAppPid.value = pid;
    const drugCode = State.currentSelectedDrugCode;
    const drug = State.activeDrugs.find(d => String(d['藥品代碼']).toUpperCase() === drugCode);
    
    if (pid && drugCode && drug) {
      document.getElementById("app-hist-pid").value = pid; // 自動帶入下方查詢
      renderAppHistory();

      selectAppType.disabled = true;
      btnSubmitApp.disabled = true;
      currentAppliedDays = 0;
      currentAppliedQty = 0;
      let hasInitial = false;

      // 1. 本地快取秒算 (檢查管制天數內的紀錄)
      const controlDays = parseInt(drug['管制天數'] || 14);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - controlDays);

      State.applications.forEach(app => {
        if (String(app['病歷號']).toUpperCase() === pid && String(app['藥品代碼']).toUpperCase() === drugCode && app['作廢'] !== 'Y') {
          const appDate = new Date(app['申請日期']);
          if (appDate >= cutoffDate) {
            if (app['申請類別'] === '初次申請') hasInitial = true;
            currentAppliedDays += parseInt(app['申請天數'] || 0);
            currentAppliedQty += parseInt(app['申請數量'] || 0);
          }
        }
      });

      // 2. 動態生成下拉並自動選定
      selectAppType.innerHTML = `
        <option value="初次申請" id="opt-initial">初次申請</option>
        <option value="展延申請" id="opt-extend">展延申請</option>
        <option value="複陽申請" id="opt-repositive">複陽申請</option>
      `;

      if (!hasInitial) {
        // 管制期內沒申請 -> 自動鎖定為初次申請
        selectAppType.value = "初次申請";
        document.getElementById("opt-extend").disabled = true;
      } else {
        // 已有申請 -> 檢查是否還能展延
        const totalMaxDays = parseInt(drug['展延天數上限'] || 5);
        const totalMaxQty = parseInt(drug['展延數量上限'] || 5);
        
        document.getElementById("opt-initial").disabled = true;
        
        if (currentAppliedDays >= totalMaxDays || currentAppliedQty >= totalMaxQty) {
          // 額度已滿，只能複陽
          selectAppType.value = "複陽申請";
          document.getElementById("opt-extend").disabled = true;
          alert("此病患已達最大展延額度，僅能進行「複陽申請」。");
        } else {
          // 還能展延
          selectAppType.value = "展延申請";
        }
      }
      
      selectAppType.disabled = false;
      selectAppType.dispatchEvent(new Event('change')); // 觸發數值變更
    }
  });

  selectAppType.addEventListener("change", () => {
    const type = selectAppType.value;
    if(!type) return;
    const drug = State.activeDrugs.find(d => String(d['藥品代碼']).toUpperCase() === State.currentSelectedDrugCode);
    btnSubmitApp.disabled = false;
    
    document.getElementById("manager-input-group").style.display = (type === "複陽申請") ? "block" : "none";
    document.getElementById("app-manager").required = (type === "複陽申請");

    // 取消唯讀，允許手改
    inputAppDays.readOnly = false;
    inputAppQty.readOnly = false;

    if (type === "初次申請" || type === "複陽申請") {
      const maxD = parseInt(drug['預設申請天數'] || 3);
      const maxQ = parseInt(drug['預設申請數量'] || 3);
      
      inputAppDays.max = maxD;
      inputAppDays.value = maxD;
      lblMaxDays.innerText = `(上限 ${maxD})`;
      
      inputAppQty.max = maxQ;
      inputAppQty.value = maxQ;
      lblMaxQty.innerText = `(上限 ${maxQ})`;

    } else if (type === "展延申請") {
      // 展延上限 = 總上限 - 已申請
      const totalMaxD = parseInt(drug['展延天數上限'] || 5);
      const totalMaxQ = parseInt(drug['展延數量上限'] || 5);
      
      const remainD = Math.max(0, totalMaxD - currentAppliedDays);
      const remainQ = Math.max(0, totalMaxQ - currentAppliedQty);

      inputAppDays.max = remainD;
      inputAppDays.value = remainD;
      lblMaxDays.innerText = `(上限 ${remainD})`;

      inputAppQty.max = remainQ;
      inputAppQty.value = remainQ;
      lblMaxQty.innerText = `(上限 ${remainQ})`;
    }
  });

  document.getElementById("app-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if(!checkNetwork()) return;
    
    // 再次雙重防呆檢核最大值
    if(parseInt(inputAppDays.value) > parseInt(inputAppDays.max)) {
        alert(`申請天數不可超過上限 ${inputAppDays.max}`); return;
    }
    
    btnSubmitApp.disabled = true;
    btnSubmitApp.innerText = "傳送中...";
    
    const now = new Date();
    const startDateRaw = document.getElementById("app-start-date").value;
    const startDateStr = startDateRaw ? startDateRaw.replace(/-/g, '/') : formatAsDate(now); 

    const dataObj = {
      "病歷號": inputAppPid.value.trim().toUpperCase(),
      "藥品代碼": State.currentSelectedDrugCode,
      "申請類別": selectAppType.value,
      "啟用日期": startDateStr,
      "申請天數": inputAppDays.value, 
      "申請數量": inputAppQty.value,
      "處理單位": document.getElementById("app-unit").value,
      "申請日期": formatAsDate(now), 
      "收單時間": formatAsTime(now), 
      "主管核准人": document.getElementById("app-manager").value,
      "申請備註": document.getElementById("app-note").value,
      "藥師員工編號": document.getElementById("app-pharmacist-id").value,
      "藥師姓名": document.getElementById("app-pharmacist-name").value
    };

    const res = await postData("submitApplication", dataObj);
    if(res.status === 'success') {
      alert("申請單已成功送出！");
      State.applications.push(dataObj); // 快取更新
      renderAppHistory(); // 重繪歷史
      document.getElementById("app-form").reset();
      selectAppType.disabled = true;
      btnSubmitApp.disabled = true;
    } else {
      alert("錯誤：" + res.message);
    }
    btnSubmitApp.innerText = "確認送出申請";
  });
});
