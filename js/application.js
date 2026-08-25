// js/application.js

let lockedStartDate = ""; 

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
  document.getElementById("app-start-date").readOnly = false;
  
  // 重置 Radio 按鈕
  document.querySelectorAll('input[name="app-type"]').forEach(r => { r.disabled = true; r.checked = false; });
  
  switchView('application');
  document.getElementById("app-patient-id").focus();
  renderAppHistory(); 
}

function renderAppHistory() {
  // ...維持原本歷史渲染邏輯 (與前一個版本完全相同，此處省略以省字數)...
  const tbody = document.getElementById("app-history-table");
  if(!tbody) return;
  const pidFilter = document.getElementById("app-hist-pid").value.trim().toUpperCase();
  const startStr = document.getElementById("app-hist-start").value.replace(/-/g, '/');
  const endStr = document.getElementById("app-hist-end").value.replace(/-/g, '/');
  
  let html = "";
  let sortedApps = [...State.applications].sort((a,b) => new Date(b['申請日期']+' '+(b['收單時間']||'00:00:00')) - new Date(a['申請日期']+' '+(a['收單時間']||'00:00:00')));
  
  sortedApps.forEach(app => {
    if(String(app['藥品代碼']).toUpperCase() === State.currentSelectedDrugCode && app['作廢'] !== 'Y') {
      const appPid = String(app['病歷號']).toUpperCase();
      if(pidFilter && !appPid.includes(pidFilter)) return;
      const appDateStr = formatAsDate(app['申請日期']);
      if(startStr && appDateStr < startStr) return;
      if(endStr && appDateStr > endStr) return;

      html += `<tr>
        <td>${app['申請日期']} ${app['收單時間']||''}</td>
        <td>${app['啟用日期'] || '-'}</td>
        <td class="fw-bold text-primary">${appPid}</td>
        <td><span class="badge bg-info text-dark">${app['申請類別']}</span></td>
        <td class="fw-bold">${app['申請天數']} 天 / ${app['申請數量']} 支</td>
        <td class="small text-muted">${app['處理單位']}</td>
      </tr>`;
    }
  });
  tbody.innerHTML = html || '<tr><td colspan="6" class="text-muted">查無符合紀錄</td></tr>';
}

document.addEventListener("DOMContentLoaded", () => {
  const inputAppPid = document.getElementById("app-patient-id");
  const inputAppDays = document.getElementById("app-days");
  const inputAppQty = document.getElementById("app-qty");
  const btnSubmitApp = document.getElementById("btn-submit-app");
  const lblMaxDays = document.getElementById("lbl-max-days");
  const lblMaxQty = document.getElementById("lbl-max-qty");
  const radios = document.querySelectorAll('input[name="app-type"]');

  if(!inputAppPid) return;

  inputAppPid.addEventListener("blur", async () => {
    const pid = inputAppPid.value.trim().toUpperCase();
    inputAppPid.value = pid;
    const drugCode = State.currentSelectedDrugCode;
    const drug = State.activeDrugs.find(d => String(d['藥品代碼']).toUpperCase() === drugCode);
    
    if (pid && drugCode && drug) {
      document.getElementById("app-hist-pid").value = pid; 
      renderAppHistory();

      radios.forEach(r => { r.disabled = true; r.checked = false; });
      btnSubmitApp.disabled = true;

      let latestApp = null;
      const controlDays = parseInt(drug['管制天數'] || 14);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - controlDays);

      State.applications.forEach(app => {
        if (String(app['病歷號']).toUpperCase() === pid && String(app['藥品代碼']).toUpperCase() === drugCode && app['作廢'] !== 'Y') {
          const appDate = new Date(app['申請日期']);
          if (appDate >= cutoffDate) {
            if(!latestApp || new Date(app['申請日期']+' '+(app['收單時間']||'00:00:00')) > new Date(latestApp['申請日期']+' '+(latestApp['收單時間']||'00:00:00'))) {
                latestApp = app;
            }
          }
        }
      });

      lockedStartDate = "";
      document.getElementById("app-start-date").readOnly = false;

      let targetRadioId = "opt-initial"; // 預設初次

      if (!latestApp) {
        document.getElementById("opt-initial").disabled = false;
      } else {
        const totalMaxQty = parseInt(drug['展延數量上限'] || 5);
        const totalMaxDays = parseInt(drug['展延天數上限'] || 5);
        
        if (latestApp['申請類別'] === '初次申請') {
            const initialQty = parseInt(latestApp['申請數量'] || 0);
            const initialDays = parseInt(latestApp['申請天數'] || 0);
            
            if (initialQty >= totalMaxQty && initialDays >= totalMaxDays) {
                targetRadioId = "opt-repositive";
                document.getElementById("opt-repositive").disabled = false;
                alert("此病患的初次申請已達最大額度，僅能進行「複陽申請」。");
            } else {
                targetRadioId = "opt-extend";
                document.getElementById("opt-extend").disabled = false;
                lockedStartDate = latestApp['啟用日期'] ? latestApp['啟用日期'].replace(/\//g, '-') : latestApp['申請日期'].replace(/\//g, '-');
            }
        } else {
            targetRadioId = "opt-repositive";
            document.getElementById("opt-repositive").disabled = false;
            alert("此病患已展延過，僅能進行「複陽申請」。");
        }
      }
      
      // 自動點擊對應的 Radio
      const targetRadio = document.getElementById(targetRadioId);
      if(targetRadio) {
          targetRadio.checked = true;
          targetRadio.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  });

  // 👉 監聽 Radio 的 Change 事件
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
        const maxD = parseInt(drug['展延天數上限'] || 5);
        const maxQ = parseInt(drug['展延數量上限'] || 5);
        inputAppDays.value = maxD;
        inputAppQty.value = maxQ;
        lblMaxDays.innerText = `(鎖定上限 ${maxD})`;
        lblMaxQty.innerText = `(鎖定上限 ${maxQ})`;
        
        if(lockedStartDate) {
            document.getElementById("app-start-date").value = lockedStartDate;
            document.getElementById("app-start-date").readOnly = true;
        }
      } else {
        const maxD = parseInt(drug['預設申請天數'] || 3);
        const maxQ = parseInt(drug['預設申請數量'] || 3);
        inputAppDays.value = maxD;
        inputAppQty.value = maxQ;
        lblMaxDays.innerText = `(鎖定上限 ${maxD})`;
        lblMaxQty.innerText = `(鎖定上限 ${maxQ})`;
        
        document.getElementById("app-start-date").readOnly = false;
        document.getElementById("app-start-date").value = new Date().toISOString().split('T')[0];
      }
    });
  });

  document.getElementById("app-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if(!checkNetwork()) return;
    
    if(parseInt(inputAppDays.value) > parseInt(inputAppDays.max)) {
        alert(`申請天數不可超過上限 ${inputAppDays.max}`); return;
    }
    
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
      dataObj['申請單號'] = `剛成立(同步中)`; 
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
