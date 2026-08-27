// js/application.js

let lockedStartDateStr = ""; 
let absoluteMaxEndDate = new Date(0); 
let globalMaxDays = 0;
let globalMaxQty = 0;
// 👉 新增全域變數，紀錄本次療程「還能展延多少」
let cycleRemainingDays = 0; 
let cycleRemainingQty = 0;

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
  
  const drug = State.activeDrugs.find(d => String(d['藥品代碼']).toUpperCase() === State.currentSelectedDrugCode);
  let cutoffDate = new Date(0);
  if (drug) {
      cutoffDate = new Date();
      cutoffDate.setHours(0, 0, 0, 0);
      cutoffDate.setDate(cutoffDate.getDate() - parseInt(drug['管制天數'] || 14));
  }
  
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

      const checkDate = new Date(actDateStr);
      checkDate.setHours(0, 0, 0, 0);
      const isWithinControl = (checkDate >= cutoffDate);
      
      const rowClass = isWithinControl ? 'table-warning' : '';
      const badgeHtml = isWithinControl ? `<br><span class="badge bg-danger mt-1 shadow-sm"><i class="bi bi-shield-lock"></i> 管制期內</span>` : '';

      html += `<tr class="${rowClass}">
        <td>${formatAsDate(app['收單時間'])} ${formatAsTime(app['收單時間'])}</td>
        <td class="fw-bold ${isWithinControl ? 'text-danger' : 'text-success'}">${actDateStr || '-'}${badgeHtml}</td>
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
      document.getElementById("app-hist-start").value = "";
      document.getElementById("app-hist-end").value = "";
      renderAppHistory();

      const radios = document.querySelectorAll('input[name="app-type"]');
      radios.forEach(r => { r.disabled = true; r.checked = false; });
      
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
      let hasUsedBreakInControlPeriod = false; 

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
            
            const breakCatNames = Array.from(radios).filter(r => r.getAttribute("data-cat-type") === "BREAK").map(r => r.value);
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
        
        // 👉 核心邏輯升級：精準計算「同一個療程」已經開了多少總天數與總量
        let cycleTotalQty = 0;
        let cycleTotalDays = 0;
        
        State.applications.forEach(app => {
            if (String(app['病歷號']).toUpperCase() === pid && String(app['藥品代碼']).toUpperCase() === drugCode && app['作廢'] !== 'Y') {
                let thisActDateStr = formatAsDate(app['啟用日期']);
                if (!thisActDateStr) thisActDateStr = formatAsDate(app['收單時間']);
                // 只要啟用日期一樣，就算在同一個療程 (初次+展延)
                if (thisActDateStr === latestActDateStr) {
                    cycleTotalQty += parseInt(app['申請數量'] || 0);
                    cycleTotalDays += parseInt(app['申請天數'] || 0);
                }
            }
        });

        // 算出本次展延還能開多少 (全局上限 - 已經開過的總和)
        cycleRemainingQty = Math.max(0, globalMaxQty - cycleTotalQty);
        cycleRemainingDays = Math.max(0, globalMaxDays - cycleTotalDays);

        const isMaxedOut = (cycleRemainingQty <= 0 || cycleRemainingDays <= 0);

        radios.forEach(r => {
            const catType = r.getAttribute("data-cat-type");
            if (catType === "BREAK") {
                r.disabled = hasUsedBreakInControlPeriod;
            } else if (catType === "EXTENSION") {
                r.disabled = isMaxedOut;
            } else {
                r.disabled = true; 
            }
        });

        if (isMaxedOut) {
            if (hasUsedBreakInControlPeriod) {
                document.getElementById("app-type-desc").innerHTML = '<i class="bi bi-x-circle text-danger fw-bold"></i> ⛔ 本次療程已達額度，且管制期內已使用過複陽(突破)，無法再次申請！';
                alert(`⛔ 阻擋：此病患本次療程已達額度，且在管制期內已經申請過一次「複陽 / 突破限制」，無法再次申請。`);
            } else {
                document.getElementById("app-type-desc").innerHTML = '<i class="bi bi-exclamation-triangle text-danger fw-bold"></i> ⚠️ 本次療程之展延額度已用盡，僅能選擇「複陽 / 突破限制」建立新療程。';
                alert(`此病患本次療程的額度已經用盡。\n若有醫療需求，僅能選擇「🔴 複陽 / 突破限制」建立新的獨立療程。`);
            }
        } else {
            if (hasUsedBreakInControlPeriod) {
                document.getElementById("app-type-desc").innerHTML = '<i class="bi bi-info-circle text-primary fw-bold"></i> 🔍 尚有展延額度可使用 (複陽額度已用罄)。';
            } else {
                document.getElementById("app-type-desc").innerHTML = '<i class="bi bi-info-circle text-primary fw-bold"></i> 🔍 已找到近期紀錄，可選擇「展延」或「複陽(突破)」。';
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
      else if(catType === 'EXTENSION') badgeHtml = '<span class="badge bg-warning text-dark ms-2">展延 (扣除初次後之剩餘額度)</span>';
      else if(catType === 'BREAK') badgeHtml = '<span class="badge bg-danger ms-2">複陽/新療程 (獲得全新額度)</span>';

      document.getElementById("app-type-desc").innerHTML = `<i class="bi bi-info-circle"></i> 說明：${desc} ${badgeHtml}`;
      btnSubmitApp.disabled = false;
      
      const needsManager = typeEl.value.includes("主管") || typeEl.value.includes("複陽");
      document.getElementById("manager-input-group").style.display = needsManager ? "block" : "none";
      document.getElementById("app-manager").required = needsManager;

      inputAppDays.readOnly = false;
      inputAppQty.readOnly = false;

      // 👉 核心修復：當選擇展延時，自動帶入「剩餘可展延數量」，而不是合併上限
      if (catType === "EXTENSION" && lockedStartDateStr) {
          inputAppDays.value = Math.min(cDefDays, cycleRemainingDays);
          inputAppQty.value = Math.min(cDefQty, cycleRemainingQty);
          
          document.getElementById("lbl-max-days").innerText = `(最多可再展延 ${cycleRemainingDays})`;
          document.getElementById("lbl-max-qty").innerText = `(最多可再展延 ${cycleRemainingQty})`;
          
          document.getElementById("app-start-date").value = lockedStartDateStr;
          document.getElementById("app-start-date").readOnly = true;
      } else {
          // 👉 初次或複陽，則帶入該類別預設值
          inputAppDays.value = cDefDays;
          inputAppQty.value = cDefQty;
          document.getElementById("lbl-max-days").innerText = `(全局上限 ${globalMaxDays})`;
          document.getElementById("lbl-max-qty").innerText = `(全局上限 ${globalMaxQty})`;
          
          document.getElementById("app-start-date").readOnly = false;
          
          const today = new Date();
          // 如果是複陽(新療程)，強制啟用日期必須在舊療程結束之後
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
    
    const typeEl = document.querySelector('input[name="app-type"]:checked');
    const catType = typeEl.getAttribute("data-cat-type");
    
    const reqDays = parseInt(inputAppDays.value);
    const reqQty = parseInt(inputAppQty.value);

    // 👉 核心驗證：分開驗證展延單與初次/複陽單
    if (catType === "EXTENSION") {
        if(reqDays > cycleRemainingDays || reqQty > cycleRemainingQty) {
            alert(`⛔ 展延申請超額！\n本次療程最多僅能再展延:\n天數: ${cycleRemainingDays} 天\n數量: ${cycleRemainingQty} 支`); 
            return;
        }
    } else {
        if(reqDays > globalMaxDays || reqQty > globalMaxQty) {
            alert(`⛔ 申請天數或數量不可超過全局上限！\n最大天數: ${globalMaxDays}\n最大數量: ${globalMaxQty}`); 
            return;
        }
    }
    
    const unitEl = document.querySelector('input[name="app-unit-radio"]:checked');
    if(!unitEl) { alert("請選擇處理單位！"); return; }

    const startDateRaw = document.getElementById("app-start-date").value;
    const startDateStr = startDateRaw ? startDateRaw.replace(/-/g, '/') : formatAsDate(new Date()); 
    
    // 防呆：複陽療程的啟用日期不能與舊療程重疊
    if (catType === "BREAK" && new Date(startDateStr) < window.currentAbsoluteMaxEndDate) {
        alert(`⛔ 複陽/新療程的啟用日期不可與前次重疊！\n前次療程將於 ${formatAsDate(window.currentAbsoluteMaxEndDate)} 結束，您必須選取此日期或更晚的日期。`);
        return;
    }
    
    btnSubmitApp.disabled = true;
    btnSubmitApp.innerText = "傳送中...";
    const now = new Date();

    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const generatedAppId = `APP-${yyyy}${mm}${dd}-${hh}${min}${ss}`;

    const dataObj = {
      "申請單號": generatedAppId,
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
      alert("✅ 申請單已成功送出！");
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
