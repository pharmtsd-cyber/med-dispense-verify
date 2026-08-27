// js/application.js

let lockedStartDateStr = ""; 
let absoluteMaxEndDate = new Date(0); 
let globalMaxDays = 0;
let globalMaxQty = 0;

function openApplicationForm() {
  if(!State.currentSelectedDrugCode) return;
  const drug = State.activeDrugs.find(d => String(d['藥品代碼']).toUpperCase() === State.currentSelectedDrugCode);
  const user = JSON.parse(sessionStorage.getItem("currentUser"));

  document.getElementById("app-form-drug-name").innerText = `${drug['藥品名稱']} (${drug['藥品代碼']})`;
  document.getElementById("app-back-drug-name").innerText = drug['藥品名稱'];
  
  globalMaxDays = parseInt(drug['每次最大申請天數'] || 5);
  globalMaxQty = parseInt(drug['每次最大申請量'] || 5);

  document.getElementById("app-drug-info-card").innerHTML = `
    <div class="row text-center">
      <div class="col-4 border-end"><div class="text-muted small">管制天數</div><div class="fw-bold fs-5 text-primary">${drug['管制天數']} 天</div></div>
      <div class="col-4 border-end"><div class="text-muted small">每次最大申請天數</div><div class="fw-bold fs-5 text-danger">${globalMaxDays} 天</div></div>
      <div class="col-4"><div class="text-muted small">每次最大申請量</div><div class="fw-bold fs-5 text-danger">${globalMaxQty} 支</div></div>
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
  
  document.getElementById("app-start-date").value = "";
  document.getElementById("app-start-date").readOnly = true;
  document.getElementById("app-days").value = "";
  document.getElementById("app-qty").value = "";
  document.getElementById("app-days").readOnly = true;
  document.getElementById("app-qty").readOnly = true;
  document.getElementById("lbl-max-days").innerText = "";
  document.getElementById("lbl-max-qty").innerText = "";
  
  let customCats = [];
  try { if (drug['自訂類別']) customCats = JSON.parse(drug['自訂類別']); } catch(e) {}
  
  const hasInitial = customCats.some(c => c.type === 'INITIAL');
  if(!hasInitial) {
      customCats.unshift({name: '初次申請', desc: '系統防呆預設', defDays: 3, defQty: 3, type: 'INITIAL'});
  }
  
  let html = '';
  customCats.forEach((c, idx) => {
     html += `
       <input type="radio" class="btn-check" name="app-type" id="opt-custom-${idx}" value="${c.name}" autocomplete="off" disabled 
              data-desc="${c.desc}" data-def-days="${c.defDays || 3}" data-def-qty="${c.defQty || 3}" data-cat-type="${c.type}">
       <label class="btn btn-outline-primary" for="opt-custom-${idx}">${c.name}</label>
     `;
  });
  document.getElementById("app-type-group").innerHTML = html;
  document.getElementById("app-type-desc").innerHTML = '<i class="bi bi-info-circle text-muted"></i> 請先輸入病歷號檢核';
  
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
  
  const sortSelect = document.getElementById("app-hist-sort");
  const sortBy = sortSelect ? sortSelect.value : 'logTime';
  
  let sortedApps = [...State.applications].sort((a,b) => {
      if (sortBy === 'actDate') {
          const dateA = new Date(formatAsDate(a['啟用日期'] || a['收單時間']));
          const dateB = new Date(formatAsDate(b['啟用日期'] || b['收單時間']));
          if (dateB.getTime() !== dateA.getTime()) {
              return dateB - dateA; 
          }
      }
      const timeA = new Date(formatAsDate(a['收單時間'])+' '+(formatAsTime(a['收單時間'])||'00:00:00'));
      const timeB = new Date(formatAsDate(b['收單時間'])+' '+(formatAsTime(b['收單時間'])||'00:00:00'));
      return timeB - timeA; 
  });
  
  let html = "";
  sortedApps.forEach(app => {
    if(String(app['藥品代碼']).toUpperCase() === State.currentSelectedDrugCode && app['作廢'] !== 'Y') {
      const appPid = String(app['病歷號']).toUpperCase();
      if(pidFilter && !appPid.includes(pidFilter)) return;
      
      let actDateStr = formatAsDate(app['啟用日期']);
      if (!actDateStr) actDateStr = formatAsDate(app['收單時間']); 
      
      if(startStr && actDateStr < startStr) return;
      if(endStr && actDateStr > endStr) return;

      html += `<tr>
        <td>${formatAsDate(app['收單時間'])} ${formatAsTime(app['收單時間'])}</td>
        <td class="fw-bold text-success">${actDateStr || '-'}</td>
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

  if(!inputAppPid) return;

  const runPidCheck = async () => {
    const pid = inputAppPid.value.trim().toUpperCase();
    inputAppPid.value = pid;
    const drugCode = State.currentSelectedDrugCode;
    const drug = State.activeDrugs.find(d => String(d['藥品代碼']).toUpperCase() === drugCode);
    
    if (pid && drugCode && drug) {
      document.getElementById("app-type-desc").innerHTML = '<span class="spinner-border spinner-border-sm text-primary"></span> 正在確認雲端最新額度...';
      btnSubmitApp.disabled = true;

      await window.smartSync(); 

      document.getElementById("app-hist-pid").value = pid; 
      renderAppHistory();

      const radios = document.querySelectorAll('input[name="app-type"]');
      radios.forEach(r => { r.disabled = true; r.checked = false; });
      
      // 👉 取出哪些選項屬於「突破限制(複陽)」
      const breakCatNames = Array.from(radios).filter(r => r.getAttribute("data-cat-type") === "BREAK").map(r => r.value);
      
      inputAppDays.value = "";
      inputAppQty.value = "";
      inputAppDays.readOnly = true;
      inputAppQty.readOnly = true;
      document.getElementById("lbl-max-days").innerText = "";
      document.getElementById("lbl-max-qty").innerText = "";
      document.getElementById("app-start-date").value = "";
      document.getElementById("app-start-date").readOnly = true;

      const controlDays = parseInt(drug['管制天數'] || 14);
      const cutoffDate = new Date();
      cutoffDate.setHours(0, 0, 0, 0); 
      cutoffDate.setDate(cutoffDate.getDate() - controlDays);

      let latestApp = null;
      let absoluteMaxEndDate = new Date(0); 
      let hasUsedBreakInControlPeriod = false; // 👉 核心旗標：管制期內是否已複陽

      State.applications.forEach(app => {
        if (String(app['病歷號']).toUpperCase() === pid && String(app['藥品代碼']).toUpperCase() === drugCode && app['作廢'] !== 'Y') {
          
          const appDate = new Date(formatAsDate(app['申請日期'] || app['收單時間']));
          appDate.setHours(0, 0, 0, 0);
          
          if (appDate >= cutoffDate) {
            let sDate = new Date(formatAsDate(app['啟用日期'] || app['申請日期'] || app['收單時間']));
            let eDate = new Date(sDate);
            eDate.setDate(eDate.getDate() + parseInt(app['申請天數'] || 0));
            if (eDate > absoluteMaxEndDate) absoluteMaxEndDate = eDate;

            const currentAppActionTime = new Date(formatAsDate(app['收單時間'])+' '+(formatAsTime(app['收單時間'])||'00:00:00'));
            const latestAppActionTime = latestApp ? new Date(formatAsDate(latestApp['收單時間'])+' '+(formatAsTime(latestApp['收單時間'])||'00:00:00')) : new Date(0);

            if(!latestApp || currentAppActionTime > latestAppActionTime) {
                latestApp = app;
            }
            
            // 👉 檢核：只要在管制期內，有任何一筆是突破限制類別或名稱帶有「複陽」，就立起旗標
            if (breakCatNames.includes(app['申請類別']) || String(app['申請類別']).includes('複陽')) {
                hasUsedBreakInControlPeriod = true;
            }
          }
        }
      });

      lockedStartDateStr = "";
      window.currentAbsoluteMaxEndDate = absoluteMaxEndDate; 

      if (!latestApp) {
        radios.forEach(r => {
            if (r.getAttribute("data-cat-type") === "INITIAL") {
                r.disabled = false;
            }
        });
        document.getElementById("app-type-desc").innerHTML = '<i class="bi bi-check-circle text-success fw-bold"></i> ✅ 查無近期有效紀錄，請點選上方亮起的「初次類別」。';
      } else {
        let latestActDateStr = formatAsDate(latestApp['啟用日期']);
        if (!latestActDateStr) latestActDateStr = formatAsDate(latestApp['收單時間']);

        lockedStartDateStr = latestActDateStr.replace(/\//g, '-');
        
        let cycleAppCount = 0;
        State.applications.forEach(app => {
            if (String(app['病歷號']).toUpperCase() === pid && String(app['藥品代碼']).toUpperCase() === drugCode && app['作廢'] !== 'Y') {
                let thisActDateStr = formatAsDate(app['啟用日期']);
                if (!thisActDateStr) thisActDateStr = formatAsDate(app['收單時間']);
                if (thisActDateStr === latestActDateStr) cycleAppCount++;
            }
        });

        const initialQty = parseInt(latestApp['申請數量'] || 0);
        const initialDays = parseInt(latestApp['申請天數'] || 0);
        const isMaxedOut = (initialQty >= globalMaxQty || initialDays >= globalMaxDays);
        const hasUsedExtension = (cycleAppCount >= 2); 

        radios.forEach(r => {
            const catType = r.getAttribute("data-cat-type");
            if (catType === "BREAK") {
                // 👉 突破限制卡控：如果已經突破過，則鎖死
                r.disabled = hasUsedBreakInControlPeriod;
            } else if (catType === "EXTENSION") {
                r.disabled = (isMaxedOut || hasUsedExtension);
            } else {
                r.disabled = true; 
            }
        });

        // 決定提示文字與阻擋警告
        if (isMaxedOut || hasUsedExtension) {
            if (hasUsedBreakInControlPeriod) {
                document.getElementById("app-type-desc").innerHTML = '<i class="bi bi-x-circle text-danger fw-bold"></i> ⛔ 本次療程已達額度，且管制期內已使用過突破限制(複陽)，無法再次申請！';
                alert(`⛔ 阻擋：此病患本次療程已達額度，且在管制期內已經申請過一次「突破限制/複陽」，無法再次申請。`);
            } else {
                document.getElementById("app-type-desc").innerHTML = '<i class="bi bi-exclamation-triangle text-danger fw-bold"></i> ⚠️ 本次療程已達全局額度，僅能選擇「突破限制」建立新療程。';
                alert(`此病患本次療程已達全局額度，或已申請過展延。\n僅能選擇「🔴 突破限制」之類別建立新療程。`);
            }
        } else {
            if (hasUsedBreakInControlPeriod) {
                document.getElementById("app-type-desc").innerHTML = '<i class="bi bi-info-circle text-primary fw-bold"></i> 🔍 尚有一般額度可延伸 (突破限制/複陽 額度已用罄)。';
            } else {
                document.getElementById("app-type-desc").innerHTML = '<i class="bi bi-info-circle text-primary fw-bold"></i> 🔍 已找到近期紀錄，可選擇「一般延伸」或「突破限制」。';
            }
        }
      }
    }
  };

  inputAppPid.addEventListener("blur", runPidCheck);
  inputAppPid.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault(); 
      runPidCheck();
    }
  });

  document.getElementById("app-type-group").addEventListener("change", (e) => {
    if(e.target.name === "app-type") {
      const typeEl = e.target;
      const desc = typeEl.getAttribute("data-desc");
      const catType = typeEl.getAttribute("data-cat-type");
      const cDefDays = parseInt(typeEl.getAttribute("data-def-days") || 3);
      const cDefQty = parseInt(typeEl.getAttribute("data-def-qty") || 3);
      
      let badgeHtml = '';
      if(catType === 'INITIAL') badgeHtml = '<span class="badge bg-primary ms-2">初次專用</span>';
      else if(catType === 'EXTENSION') badgeHtml = '<span class="badge bg-warning text-dark ms-2">合併前次額度與日期</span>';
      else if(catType === 'BREAK') badgeHtml = '<span class="badge bg-danger ms-2">新療程(獨立額度/防重疊)</span>';

      document.getElementById("app-type-desc").innerHTML = `<i class="bi bi-info-circle"></i> 說明：${desc} ${badgeHtml}`;
      btnSubmitApp.disabled = false;
      
      const needsManager = typeEl.value.includes("主管") || typeEl.value.includes("複陽");
      document.getElementById("manager-input-group").style.display = needsManager ? "block" : "none";
      document.getElementById("app-manager").required = needsManager;

      inputAppDays.readOnly = false;
      inputAppQty.readOnly = false;

      if (catType === "EXTENSION" && lockedStartDateStr) {
          inputAppDays.value = globalMaxDays;
          inputAppQty.value = globalMaxQty;
          document.getElementById("lbl-max-days").innerText = `(合併上限 ${globalMaxDays})`;
          document.getElementById("lbl-max-qty").innerText = `(合併上限 ${globalMaxQty})`;
          
          document.getElementById("app-start-date").value = lockedStartDateStr;
          document.getElementById("app-start-date").readOnly = true;
      } else {
          inputAppDays.value = cDefDays;
          inputAppQty.value = cDefQty;
          document.getElementById("lbl-max-days").innerText = `(全局上限 ${globalMaxDays})`;
          document.getElementById("lbl-max-qty").innerText = `(全局上限 ${globalMaxQty})`;
          
          document.getElementById("app-start-date").readOnly = false;
          
          const today = new Date();
          // 若為突破限制，防重疊起點設為「前次最晚結束日」與「今天」兩者取晚
          if (catType === "BREAK" && window.currentAbsoluteMaxEndDate > today) {
              document.getElementById("app-start-date").value = window.currentAbsoluteMaxEndDate.toISOString().split('T')[0];
          } else {
              document.getElementById("app-start-date").value = today.toISOString().split('T')[0];
          }
      }
    }
  });

  document.getElementById("app-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if(!checkNetwork()) return;
    
    if(parseInt(inputAppDays.value) > globalMaxDays || parseInt(inputAppQty.value) > globalMaxQty) {
        alert(`申請天數或數量不可超過全局上限！\n最大天數: ${globalMaxDays}\n最大數量: ${globalMaxQty}`); 
        return;
    }
    
    const unitEl = document.querySelector('input[name="app-unit-radio"]:checked');
    if(!unitEl) { alert("請選擇處理單位！"); return; }

    const typeEl = document.querySelector('input[name="app-type"]:checked');
    const catType = typeEl.getAttribute("data-cat-type");
    const startDateRaw = document.getElementById("app-start-date").value;
    const startDateStr = startDateRaw ? startDateRaw.replace(/-/g, '/') : formatAsDate(new Date()); 
    
    // 👉 終極防疊：突破限制的啟用日不得小於前次療程的結束日
    if (catType === "BREAK" && new Date(startDateStr) < window.currentAbsoluteMaxEndDate) {
        alert(`⛔ 突破限制(新療程)的啟用日期不可與前次重疊！\n前次療程將於 ${formatAsDate(window.currentAbsoluteMaxEndDate)} 結束，您必須選取此日期或更晚的日期。`);
        return;
    }
    
    btnSubmitApp.disabled = true;
    btnSubmitApp.innerText = "傳送中...";
    const now = new Date();

    const dataObj = {
      "病歷號": inputAppPid.value.trim().toUpperCase(),
      "藥品代碼": State.currentSelectedDrugCode,
      "申請類別": typeEl.value,
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
      document.getElementById("app-type-desc").innerHTML = '<i class="bi bi-info-circle text-muted"></i> 請先輸入病歷號檢核';
      document.getElementById("app-start-date").value = "";
      document.getElementById("app-start-date").readOnly = true;
      document.getElementById("app-days").value = "";
      document.getElementById("app-qty").value = "";
      document.getElementById("app-days").readOnly = true;
      document.getElementById("app-qty").readOnly = true;
      document.getElementById("lbl-max-days").innerText = "";
      document.getElementById("lbl-max-qty").innerText = "";
      
      btnSubmitApp.disabled = true;
      btnSubmitApp.innerText = "確認送出申請";
    } else {
      alert("錯誤：" + res.message);
      btnSubmitApp.disabled = false;
      btnSubmitApp.innerText = "確認送出申請";
    }
  });
});
