// js/application.js

let lockedStartDateStr = ""; // 一般延伸鎖定的日期
let absoluteMaxEndDate = new Date(0); // 突破限制時用來防重疊的底線日期
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
  
  document.getElementById("app-start-date").value = new Date().toISOString().split('T')[0];
  document.getElementById("app-start-date").readOnly = false;
  
  let customCats = [];
  try { if (drug['自訂類別']) customCats = JSON.parse(drug['自訂類別']); } catch(e) {}
  if(customCats.length === 0 || customCats[0].name !== '初次申請') {
      customCats = [{name: '初次申請', desc: '系統強制預設', defDays: 3, defQty: 3, isBreak: false}];
  }
  
  let html = '';
  customCats.forEach((c, idx) => {
     html += `
       <input type="radio" class="btn-check" name="app-type" id="opt-custom-${idx}" value="${c.name}" autocomplete="off" disabled 
              data-desc="${c.desc}" data-def-days="${c.defDays || 3}" data-def-qty="${c.defQty || 3}" data-is-break="${c.isBreak || false}">
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
  
  let sortedApps = [...State.applications].sort((a,b) => new Date(formatAsDate(b['申請日期'])+' '+(formatAsTime(b['收單時間'])||'00:00:00')) - new Date(formatAsDate(a['申請日期'])+' '+(formatAsTime(a['收單時間'])||'00:00:00')));
  let html = "";
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

      const controlDays = parseInt(drug['管制天數'] || 14);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - controlDays);

      let latestApp = null;
      absoluteMaxEndDate = new Date(0); // 尋找所有管制期內單據的「最晚結束日」

      State.applications.forEach(app => {
        if (String(app['病歷號']).toUpperCase() === pid && String(app['藥品代碼']).toUpperCase() === drugCode && app['作廢'] !== 'Y') {
          const appDate = new Date(formatAsDate(app['申請日期']));
          if (appDate >= cutoffDate) {
            
            // 計算最大結束日期防重疊 (啟用日 + 申請天數)
            let sDate = new Date(formatAsDate(app['啟用日期'] || app['申請日期']));
            let eDate = new Date(sDate);
            eDate.setDate(eDate.getDate() + parseInt(app['申請天數'] || 0));
            if (eDate > absoluteMaxEndDate) absoluteMaxEndDate = eDate;

            // 尋找最新一筆 (看誰最晚建單)
            if(!latestApp || new Date(formatAsDate(app['申請日期'])+' '+(formatAsTime(app['收單時間'])||'00:00:00')) > new Date(formatAsDate(latestApp['申請日期'])+' '+(formatAsTime(latestApp['收單時間'])||'00:00:00'))) {
                latestApp = app;
            }
          }
        }
      });

      lockedStartDateStr = "";
      document.getElementById("app-start-date").readOnly = false;
      let targetRadioId = "opt-custom-0"; // 預設指向初次

      if (!latestApp) {
        // 👉 管制期內完全沒紀錄，強制只能點選「初次申請」
        document.getElementById("opt-custom-0").disabled = false;
      } else {
        // 👉 有紀錄，禁用初次，開啟其他選項
        document.getElementById("opt-custom-0").disabled = true;
        
        // 算出該「啟用日期」循環週期中，已經送了幾張單、累計了多少量
        const currentCycleStart = formatAsDate(latestApp['啟用日期'] || latestApp['申請日期']);
        lockedStartDateStr = currentCycleStart.replace(/\//g, '-');
        let cycleAppCount = 0;
        
        State.applications.forEach(app => {
            if (String(app['病歷號']).toUpperCase() === pid && String(app['藥品代碼']).toUpperCase() === drugCode && app['作廢'] !== 'Y') {
                if (formatAsDate(app['啟用日期'] || app['申請日期']) === currentCycleStart) cycleAppCount++;
            }
        });

        // 判斷是否已經達全局最大量
        const initialQty = parseInt(latestApp['申請數量'] || 0);
        const initialDays = parseInt(latestApp['申請天數'] || 0);
        const isMaxedOut = (initialQty >= globalMaxQty && initialDays >= globalMaxDays);
        const hasUsedExtension = (cycleAppCount >= 2); // 已經用過一次一般延伸了

        let foundValidOption = false;

        radios.forEach((r, idx) => {
            if(idx === 0) return; // 略過初次
            const isBreak = r.getAttribute("data-is-break") === "true";
            
            if (isBreak) {
                // 突破限制 (新療程) 永遠可以選
                r.disabled = false;
                if(!foundValidOption) { targetRadioId = r.id; foundValidOption = true; }
            } else {
                // 一般延伸：必須沒滿額，且還沒展延過
                if (isMaxedOut || hasUsedExtension) {
                    r.disabled = true;
                } else {
                    r.disabled = false;
                    if(!foundValidOption) { targetRadioId = r.id; foundValidOption = true; }
                }
            }
        });

        if (isMaxedOut || hasUsedExtension) {
            alert(`此病患本次療程已達最大額度或已延伸過。\n若需用藥，僅能選擇「突破限制」之類別建立新療程。`);
        }
      }
      
      const targetRadio = document.getElementById(targetRadioId);
      if(targetRadio && !targetRadio.disabled) {
          targetRadio.checked = true;
          document.getElementById("app-type-group").dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  });

  document.getElementById("app-type-group").addEventListener("change", (e) => {
    if(e.target.name === "app-type") {
      const typeEl = e.target;
      const desc = typeEl.getAttribute("data-desc");
      const isBreak = typeEl.getAttribute("data-is-break") === "true";
      const cDefDays = parseInt(typeEl.getAttribute("data-def-days") || 3);
      const cDefQty = parseInt(typeEl.getAttribute("data-def-qty") || 3);
      
      // 👉 顯示描述與主管框 (包含「主管」兩字即開啟)
      document.getElementById("app-type-desc").innerHTML = `<i class="bi bi-info-circle"></i> 說明：${desc} <span class="badge ${isBreak?'bg-danger':'bg-warning text-dark'} ms-2">${isBreak?'獨立額度與日期':'合併前次額度與日期'}</span>`;
      btnSubmitApp.disabled = false;
      const needsManager = typeEl.value.includes("主管") || typeEl.value.includes("複陽");
      document.getElementById("manager-input-group").style.display = needsManager ? "block" : "none";
      document.getElementById("app-manager").required = needsManager;

      inputAppDays.readOnly = false;
      inputAppQty.readOnly = false;

      if (!isBreak && lockedStartDateStr && typeEl.value !== "初次申請") {
          // 👉 一般延伸：鎖定開始日期，並帶入全局最大值
          inputAppDays.value = globalMaxDays;
          inputAppQty.value = globalMaxQty;
          document.getElementById("lbl-max-days").innerText = `(合併上限 ${globalMaxDays})`;
          document.getElementById("lbl-max-qty").innerText = `(合併上限 ${globalMaxQty})`;
          
          document.getElementById("app-start-date").value = lockedStartDateStr;
          document.getElementById("app-start-date").readOnly = true;
      } else {
          // 👉 初次申請 或 突破限制：解鎖開始日期，帶入該類別預設值
          inputAppDays.value = cDefDays;
          inputAppQty.value = cDefQty;
          document.getElementById("lbl-max-days").innerText = `(全局上限 ${globalMaxDays})`;
          document.getElementById("lbl-max-qty").innerText = `(全局上限 ${globalMaxQty})`;
          
          document.getElementById("app-start-date").readOnly = false;
          // 若是突破限制，預設日期帶「前次結束日」或「今天」(取晚的)
          const today = new Date();
          if (isBreak && absoluteMaxEndDate > today) {
              document.getElementById("app-start-date").value = absoluteMaxEndDate.toISOString().split('T')[0];
          } else {
              document.getElementById("app-start-date").value = today.toISOString().split('T')[0];
          }
      }
    }
  });

  document.getElementById("app-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if(!checkNetwork()) return;
    
    // 👉 終極防呆：不可大於全局上限
    if(parseInt(inputAppDays.value) > globalMaxDays || parseInt(inputAppQty.value) > globalMaxQty) {
        alert(`申請天數或數量不可超過全局上限！\n最大天數: ${globalMaxDays}\n最大數量: ${globalMaxQty}`); 
        return;
    }
    
    const unitEl = document.querySelector('input[name="app-unit-radio"]:checked');
    if(!unitEl) { alert("請選擇處理單位！"); return; }

    const typeEl = document.querySelector('input[name="app-type"]:checked');
    const isBreak = typeEl.getAttribute("data-is-break") === "true";
    const startDateRaw = document.getElementById("app-start-date").value;
    const startDateStr = startDateRaw ? startDateRaw.replace(/-/g, '/') : formatAsDate(new Date()); 
    
    // 👉 終極防呆：突破限制的日期不可與前次療程重疊
    if (isBreak && new Date(startDateStr) < absoluteMaxEndDate) {
        alert(`⛔ 突破限制(新療程)的啟用日期不可與前次重疊！\n前次療程將於 ${formatAsDate(absoluteMaxEndDate)} 結束，您必須選取此日期或更晚的日期。`);
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
      btnSubmitApp.disabled = true;
      btnSubmitApp.innerText = "確認送出申請";
    } else {
      alert("錯誤：" + res.message);
      btnSubmitApp.disabled = false;
      btnSubmitApp.innerText = "確認送出申請";
    }
  });
});
