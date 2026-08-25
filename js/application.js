// js/application.js

let lockedStartDate = ""; 

function openApplicationForm() {
  if(!State.currentSelectedDrugCode) return;
  const drug = State.activeDrugs.find(d => String(d['藥品代碼']).toUpperCase() === State.currentSelectedDrugCode);
  const user = JSON.parse(sessionStorage.getItem("currentUser"));

  document.getElementById("app-form-drug-name").innerText = `${drug['藥品名稱']} (${drug['藥品代碼']})`;
  document.getElementById("app-back-drug-name").innerText = drug['藥品名稱'];
  
  // 👉 顯示藥品主檔資訊小卡片
  document.getElementById("app-drug-info-card").innerHTML = `
    <div class="row text-center">
      <div class="col-4 border-end"><div class="text-muted small">管制天數</div><div class="fw-bold fs-5 text-primary">${drug['管制天數']} 天</div></div>
      <div class="col-4 border-end"><div class="text-muted small">初次申請上限</div><div class="fw-bold fs-5">${drug['預設申請天數']} 天 / ${drug['預設申請數量']} 支</div></div>
      <div class="col-4"><div class="text-muted small">展延申請上限</div><div class="fw-bold fs-5">${drug['展延天數上限']} 天 / ${drug['展延數量上限']} 支</div></div>
    </div>
  `;

  const form = document.getElementById("app-form");
  if(form) form.reset();
  
  document.getElementById("app-pharmacist-id").value = user.id;
  document.getElementById("app-pharmacist-name").value = user.name;
  
  // 單位設定為預設
  if(user.unit) {
    const radio = document.querySelector(`input[name="app-unit-radio"][value="${user.unit}"]`);
    if(radio) radio.checked = true;
  }
  
  document.getElementById("app-start-date").value = new Date().toISOString().split('T')[0];
  document.getElementById("app-start-date").readOnly = false;
  
  document.querySelectorAll('input[name="app-type"]').forEach(r => { r.disabled = true; r.checked = false; });
  
  switchView('application');
  document.getElementById("app-patient-id").focus();
  renderAppHistory(); 
}

// ... renderAppHistory 維持不變 ...

document.addEventListener("DOMContentLoaded", () => {
  const inputAppPid = document.getElementById("app-patient-id");
  const inputAppDays = document.getElementById("app-days");
  const inputAppQty = document.getElementById("app-qty");
  const btnSubmitApp = document.getElementById("btn-submit-app");
  const radios = document.querySelectorAll('input[name="app-type"]');

  if(!inputAppPid) return;

  // ... inputAppPid blur 邏輯不變，只移除 lblMaxDays 那些行 ...

  radios.forEach(radio => {
    radio.addEventListener("change", (e) => {
      if(!e.target.checked) return;
      const type = e.target.value;
      const drug = State.activeDrugs.find(d => String(d['藥品代碼']).toUpperCase() === State.currentSelectedDrugCode);
      btnSubmitApp.disabled = false;
      
      document.getElementById("manager-input-group").style.display = (type === "複陽申請") ? "block" : "none";
      document.getElementById("app-manager").required = (type === "複陽申請");

      inputAppDays.readOnly = false;
      inputAppQty.readOnly = false;

      if (type === "展延申請") {
        inputAppDays.value = parseInt(drug['展延天數上限'] || 5);
        inputAppQty.value = parseInt(drug['展延數量上限'] || 5);
        if(lockedStartDate) {
            document.getElementById("app-start-date").value = lockedStartDate;
            document.getElementById("app-start-date").readOnly = true;
        }
      } else {
        inputAppDays.value = parseInt(drug['預設申請天數'] || 3);
        inputAppQty.value = parseInt(drug['預設申請數量'] || 3);
        document.getElementById("app-start-date").readOnly = false;
        document.getElementById("app-start-date").value = new Date().toISOString().split('T')[0];
      }
    });
  });

  document.getElementById("app-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if(!checkNetwork()) return;
    
    // 👉 抓取單選的單位
    const unitEl = document.querySelector('input[name="app-unit-radio"]:checked');
    if(!unitEl) { alert("請選擇處理單位！"); return; }
    
    btnSubmitApp.disabled = true;
    btnSubmitApp.innerText = "傳送中...";
    
    const now = new Date();
    const startDateRaw = document.getElementById("app-start-date").value;
    const startDateStr = startDateRaw ? startDateRaw.replace(/-/g, '/') : formatAsDate(now); 
    const type = document.querySelector('input[name="app-type"]:checked').value;

    const dataObj = {
      "病歷號": inputAppPid.value.trim().toUpperCase(),
      "藥品代碼": State.currentSelectedDrugCode,
      "申請類別": type,
      "啟用日期": startDateStr,
      "申請天數": inputAppDays.value, 
      "申請數量": inputAppQty.value,
      "處理單位": unitEl.value,
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
      // 👉 修復：不寫死單號，如果後端有單號就會從伺服器覆蓋，前端先空著以防混淆
      dataObj['申請單號'] = ""; 
      State.applications.push(dataObj); 
      renderAppHistory(); 
      document.getElementById("app-form").reset();
      radios.forEach(r => { r.disabled = true; r.checked = false; });
      btnSubmitApp.disabled = true;
      btnSubmitApp.innerText = "確認送出申請";
    } else {
      alert("錯誤：" + res.message);
      btnSubmitApp.disabled = false;
      btnSubmitApp.innerText = "確認送出申請";
    }
  });
});
