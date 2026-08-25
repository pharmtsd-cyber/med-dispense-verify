// js/application.js

let lockedStartDate = ""; 

function openApplicationForm() {
  if(!State.currentSelectedDrugCode) return;
  const drug = State.activeDrugs.find(d => String(d['藥品代碼']).toUpperCase() === State.currentSelectedDrugCode);
  const user = JSON.parse(sessionStorage.getItem("currentUser"));

  document.getElementById("app-form-drug-name").innerText = `${drug['藥品名稱']} (${drug['藥品代碼']})`;
  document.getElementById("app-back-drug-name").innerText = drug['藥品名稱'];
  
  document.getElementById("app-drug-info-card").innerHTML = `
    <div class="row text-center">
      <div class="col-4 border-end"><div class="text-muted small">管制天數</div><div class="fw-bold fs-5 text-primary">${drug['管制天數']} 天</div></div>
      <div class="col-4 border-end"><div class="text-muted small">初次申請預設</div><div class="fw-bold fs-5">${drug['預設申請天數']} 天 / ${drug['預設申請數量']} 支</div></div>
      <div class="col-4"><div class="text-muted small">展延申請上限</div><div class="fw-bold fs-5">${drug['展延天數上限']} 天 / ${drug['展延數量上限']} 支</div></div>
    </div>
  `;

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
  
  let customCats = [];
  try { if (drug['自訂類別']) customCats = JSON.parse(drug['自訂類別']); } catch(e) {}
  
  let html = `
    <input type="radio" class="btn-check" name="app-type" id="opt-initial" value="初次申請" autocomplete="off" disabled data-desc="系統預設：初次申請或管制期外重新申請">
    <label class="btn btn-outline-primary" for="opt-initial">初次申請</label>
    <input type="radio" class="btn-check" name="app-type" id="opt-extend" value="展延申請" autocomplete="off" disabled data-desc="系統預設：接續前次申請延長額度">
    <label class="btn btn-outline-primary" for="opt-extend">展延申請</label>
    <input type="radio" class="btn-check" name="app-type" id="opt-repositive" value="複陽申請" autocomplete="off" disabled data-desc="系統預設：超過展延上限，需主管簽核放行">
    <label class="btn btn-outline-primary" for="opt-repositive">複陽申請</label>
  `;
  
  // 👉 將獨立限制埋入 HTML data 屬性中
  customCats.forEach((c, idx) => {
     html += `
       <input type="radio" class="btn-check" name="app-type" id="opt-custom-${idx}" value="${c.name}" autocomplete="off" disabled 
              data-desc="${c.desc}" data-def-days="${c.defDays || 3}" data-def-qty="${c.defQty || 3}" data-max-days="${c.maxDays || 5}" data-max-qty="${c.maxQty || 5}">
       <label class="btn btn-outline-primary" for="opt-custom-${idx}">${c.name}</label>
     `;
  });
  
  document.getElementById("app-type-group").innerHTML = html;
  document.getElementById("app-type-desc").innerHTML = '<i class="bi bi-info-circle"></i> 尚未選擇類別';
  
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
  let sortedApps = [...State.applications].sort((a,b) => new Date(formatAsDate(b['申請日期'])+' '+(formatAsTime(b['收單時間'])||'00:00:00')) - new Date(formatAsDate(a['申請日期'])+' '+(formatAsTime(a['收單時間'])||'00:00:00')));
  
  sortedApps.forEach(app => {
    if(String(app['藥品代碼']).toUpperCase() === State.currentSelectedDrugCode && app['作廢'] !== 'Y') {
      const appPid = String(app['病歷號']).toUpperCase();
      if(pidFilter && !appPid.includes(pidFilter)) return;
      const appDateStr = formatAsDate(app['申請日期']);
      if(startStr && appDateStr < startStr) return;
      if(endStr && appDateStr > endStr) return;

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
  const lblMaxDays = document.getElementById("lbl-max-days");
  const lblMaxQty = document.getElementById("lbl-max-qty");

  if(!inputAppPid) return;

  inputAppPid.addEventListener("blur", async () => {
    const pid = inputAppPid.value.trim().toUpperCase();
    inputAppPid.value = pid;
    const drugCode = State.currentSelectedDrugCode;
    const drug = State.activeDrugs.find(d => String(d['藥品代碼']).toUpperCase() === drugCode);
    
    if (pid && drugCode && drug) {
      document.getElementById("app-hist-pid").value = pid; 
      renderAppHistory();

      const radios = document.querySelectorAll('input[name="app-type"]');
      radios.forEach(r => { r.disabled = true; r.checked = false; });
      document.getElementById("app-type-desc").innerHTML = '<i class="bi bi-info-circle"></i> 尚未選擇類別';
      btnSubmitApp.disabled = true;

      let latestApp = null;
      const controlDays = parseInt(drug['管制天數'] || 14);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - controlDays);

      State.applications.forEach(app => {
        if (String(app['病歷號']).toUpperCase() === pid && String(app['藥品代碼']).toUpperCase() === drugCode && app['作廢'] !== 'Y') {
          const appDate = new Date(formatAsDate(app['申請日期']));
          if (appDate >= cutoffDate) {
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
      
      // 解鎖自訂類別 (不論管制狀態為何，自訂類別都允許選取)
      radios.forEach(r => { if(r.id.includes("custom")) r.disabled = false; });
      
      const targetRadio = document.getElementById(targetRadioId);
      if(targetRadio) {
          targetRadio.checked = true;
          document.getElementById("app-type-group").dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  });

  // 👉 切換按鈕時，動態套用個別選項的限制
  document.getElementById("app-type-group").addEventListener("change", (e) => {
    if(e.target.name === "app-type") {
      const type = e.target.value;
      const desc = e.target.getAttribute("data-desc");
      document.getElementById("app-type-desc").innerHTML = `<i class="bi bi-info-circle"></i> 說明：${desc}`;
      
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
        inputAppDays.max = maxD;
        inputAppQty.max = maxQ;
        lblMaxDays.innerText = `(上限 ${maxD})`;
        lblMaxQty.innerText = `(上限 ${maxQ})`;
        
        if(lockedStartDate) {
            document.getElementById("app-start-date").value = lockedStartDate;
            document.getElementById("app-start-date").readOnly = true;
        }
      } else if (type === "初次申請" || type === "複陽申請") {
        // 系統預設類別套用公規
        const maxD = parseInt(drug['預設申請天數'] || 3);
        const maxQ = parseInt(drug['預設申請數量'] || 3);
        inputAppDays.value = maxD;
        inputAppQty.value = maxQ;
        inputAppDays.max = maxD;
        inputAppQty.max = maxQ;
        lblMaxDays.innerText = `(上限 ${maxD})`;
        lblMaxQty.innerText = `(上限 ${maxQ})`;
        
        document.getElementById("app-start-date").readOnly = false;
        document.getElementById("app-start-date").value = new Date().toISOString().split('T')[0];
      } else {
        // 👉 自訂類別套用私規
        const cDefDays = parseInt(e.target.getAttribute("data-def-days") || 3);
        const cDefQty = parseInt(e.target.getAttribute("data-def-qty") || 3);
        const cMaxDays = parseInt(e.target.getAttribute("data-max-days") || 5);
        const cMaxQty = parseInt(e.target.getAttribute("data-max-qty") || 5);

        inputAppDays.value = cDefDays;
        inputAppQty.value = cDefQty;
        inputAppDays.max = cMaxDays;
        inputAppQty.max = cMaxQty;
        lblMaxDays.innerText = `(專屬上限 ${cMaxDays})`;
        lblMaxQty.innerText = `(專屬上限 ${cMaxQty})`;
        
        document.getElementById("app-start-date").readOnly = false;
        document.getElementById("app-start-date").value = new Date().toISOString().split('T')[0];
      }
    }
  });

  document.getElementById("app-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if(!checkNetwork()) return;
    
    // 送出前的終極防呆：再次檢核不能超過該選項設定的 max 值
    if(parseInt(inputAppDays.value) > parseInt(inputAppDays.max) || parseInt(inputAppQty.value) > parseInt(inputAppQty.max)) {
        alert(`申請天數或數量不可超過設定上限！\n最大天數: ${inputAppDays.max}\n最大數量: ${inputAppQty.max}`); 
        return;
    }
    
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
