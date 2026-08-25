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
  if(user.unit) {
    const radio = document.querySelector(`input[name="app-unit-radio"][value="${user.unit}"]`);
    if(radio) radio.checked = true;
  }
  
  document.getElementById("app-start-date").value = new Date().toISOString().split('T')[0];
  document.getElementById("app-start-date").readOnly = false;
  
  // 👉 核心：動態解析並生成「申請類別」按鈕 (包含基本款與自訂款)
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
  
  customCats.forEach((c, idx) => {
     html += `
       <input type="radio" class="btn-check" name="app-type" id="opt-custom-${idx}" value="${c.name}" autocomplete="off" disabled data-desc="${c.desc}">
       <label class="btn btn-outline-primary" for="opt-custom-${idx}">${c.name}</label>
     `;
  });
  
  document.getElementById("app-type-group").innerHTML = html;
  document.getElementById("app-type-desc").innerHTML = '<i class="bi bi-info-circle"></i> 尚未選擇類別';
  
  switchView('application');
  document.getElementById("app-patient-id").focus();
  renderAppHistory(); 
}

// ... renderAppHistory 函數不變 ...

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
      
      // 👉 解鎖所有自訂類別 (讓自訂類別隨時可用)
      radios.forEach(r => { if(r.id.includes("custom")) r.disabled = false; });
      
      const targetRadio = document.getElementById(targetRadioId);
      if(targetRadio) {
          targetRadio.checked = true;
          // Trigger change on the group
          document.getElementById("app-type-group").dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  });

  // 👉 使用事件委派監聽動態生成的 Radio
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
        inputAppDays.value = parseInt(drug['展延天數上限'] || 5);
        inputAppQty.value = parseInt(drug['展延數量上限'] || 5);
        if(lockedStartDate) {
            document.getElementById("app-start-date").value = lockedStartDate;
            document.getElementById("app-start-date").readOnly = true;
        }
      } else {
        // 初次、複陽、與自訂類別，全部套用「預設申請上限」
        inputAppDays.value = parseInt(drug['預設申請天數'] || 3);
        inputAppQty.value = parseInt(drug['預設申請數量'] || 3);
        document.getElementById("app-start-date").readOnly = false;
        document.getElementById("app-start-date").value = new Date().toISOString().split('T')[0];
      }
    }
  });

  document.getElementById("app-form").addEventListener("submit", async (e) => {
    // ... 維持上個版本的 Submit 邏輯 ...
  });
});
