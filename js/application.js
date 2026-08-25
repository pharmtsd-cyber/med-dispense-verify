// js/application.js

let lockedStartDate = ""; 

function openApplicationForm() {
  if(!State.currentSelectedDrugCode) return;
  const drug = State.activeDrugs.find(d => String(d['藥品代碼']).toUpperCase() === State.currentSelectedDrugCode);
  const user = JSON.parse(sessionStorage.getItem("currentUser"));

  document.getElementById("app-form-drug-name").innerText = `${drug['藥品名稱']} (${drug['藥品代碼']})`;
  document.getElementById("app-back-drug-name").innerText = drug['藥品名稱'];
  
  // 👉 修正：文字改為「初次申請預設」
  document.getElementById("app-drug-info-card").innerHTML = `
    <div class="row text-center">
      <div class="col-4 border-end"><div class="text-muted small">管制天數</div><div class="fw-bold fs-5 text-primary">${drug['管制天數']} 天</div></div>
      <div class="col-4 border-end"><div class="text-muted small">初次申請預設</div><div class="fw-bold fs-5">${drug['預設申請天數']} 天 / ${drug['預設申請數量']} 支</div></div>
      <div class="col-4"><div class="text-muted small">展延申請上限</div><div class="fw-bold fs-5">${drug['展延天數上限']} 天 / ${drug['展延數量上限']} 支</div></div>
    </div>
  `;

  // ... (表單重置與初始化不變) ...
  const form = document.getElementById("app-form");
  if(form) form.reset();
  document.getElementById("app-pharmacist-id").value = user.id;
  document.getElementById("app-pharmacist-name").value = user.name;
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

function renderAppHistory() {
  const tbody = document.getElementById("app-history-table");
  if(!tbody) return;
  const pidFilter = document.getElementById("app-hist-pid").value.trim().toUpperCase();
  const startStr = document.getElementById("app-hist-start").value.replace(/-/g, '/');
  const endStr = document.getElementById("app-hist-end").value.replace(/-/g, '/');
  
  let html = "";
  // 👉 修復：排序時強制過濾時間
  let sortedApps = [...State.applications].sort((a,b) => new Date(formatAsDate(b['申請日期'])+' '+(formatAsTime(b['收單時間'])||'00:00:00')) - new Date(formatAsDate(a['申請日期'])+' '+(formatAsTime(a['收單時間'])||'00:00:00')));
  
  sortedApps.forEach(app => {
    if(String(app['藥品代碼']).toUpperCase() === State.currentSelectedDrugCode && app['作廢'] !== 'Y') {
      const appPid = String(app['病歷號']).toUpperCase();
      if(pidFilter && !appPid.includes(pidFilter)) return;
      const appDateStr = formatAsDate(app['申請日期']);
      if(startStr && appDateStr < startStr) return;
      if(endStr && appDateStr > endStr) return;

      // 👉 修復：顯示時強制過濾時間
      html += `<tr>
        <td>${appDateStr} ${formatAsTime(app['收單時間'])}</td>
        <td>${formatAsDate(app['啟用日期']) || '-'}</td>
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
          const appDate = new Date(formatAsDate(app['申請日期']));
          if (appDate >= cutoffDate) {
            // 👉 修復：尋找最新申請單時過濾時間
            if(!latestApp || new Date(formatAsDate(app['申請日期'])+' '+(formatAsTime(app['收單時間'])||'00:00:00')) > new Date(formatAsDate(latestApp['申請日期'])+' '+(formatAsTime(latestApp['收單時間'])||'00:00:00'))) {
                latestApp = app;
            }
          }
        }
      });

      lockedStartDate = "";
      document.getElementById("app-start-date").readOnly = false;

      let targetRadioId = "opt-initial"; 

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
                lockedStartDate = formatAsDate(latestApp['啟用日期'] || latestApp['申請日期']).replace(/\//g, '-');
            }
        } else {
            targetRadioId = "opt-repositive";
            document.getElementById("opt-repositive").disabled = false;
            alert("此病患已展延過，僅能進行「複陽申請」。");
        }
      }
      
      const targetRadio = document.getElementById(targetRadioId);
      if(targetRadio) {
          targetRadio.checked = true;
          targetRadio.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  });

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
      // 👉 修正重點：儲存時強制給予「完整日期 + 時間」，打破 1899 魔咒
      "收單時間": formatAsDate(now) + " " + formatAsTime(now), 
      "主管核准人": document.getElementById("app-manager").value,
      "申請備註": document.getElementById("app-note").value,
      "藥師員工編號": document.getElementById("app-pharmacist-id").value,
      "藥師姓名": document.getElementById("app-pharmacist-name").value
    };

    const res = await postData("submitApplication", dataObj);
    if(res.status === 'success') {
      alert("申請單已成功送出！");
      dataObj['申請單號'] = ""; 
      State.applications.push(dataObj); 
      renderAppHistory(); 
      document.getElementById("app-form").reset();
      document.querySelectorAll('input[name="app-type"]').forEach(r => { r.disabled = true; r.checked = false; });
      btnSubmitApp.disabled = true;
      btnSubmitApp.innerText = "確認送出申請";
    } else {
      alert("錯誤：" + res.message);
      btnSubmitApp.disabled = false;
      btnSubmitApp.innerText = "確認送出申請";
    }
  });
});
