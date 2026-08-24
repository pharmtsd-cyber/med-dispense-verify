// js/application.js
function openApplicationForm() {
  if(!State.currentSelectedDrugCode) return;
  const drug = State.activeDrugs.find(d => d['藥品代碼'] === State.currentSelectedDrugCode);
  const user = JSON.parse(sessionStorage.getItem("currentUser"));

  document.getElementById("app-form-drug-name").innerText = `${drug['藥品名稱']} (${drug['藥品代碼']})`;
  document.getElementById("app-back-drug-name").innerText = drug['藥品名稱'];
  
  const form = document.getElementById("app-form");
  if(form) form.reset();
  
  document.getElementById("app-pharmacist-id").value = user.id;
  document.getElementById("app-pharmacist-name").value = user.name;
  
  document.getElementById("app-type").disabled = true;
  document.getElementById("app-type").innerHTML = '<option value="">-- 請先輸入病歷號 --</option>';
  
  switchView('application');
  document.getElementById("app-patient-id").focus();
}

document.addEventListener("DOMContentLoaded", () => {
  const inputAppPid = document.getElementById("app-patient-id");
  const selectAppType = document.getElementById("app-type");
  const inputAppDays = document.getElementById("app-days");
  const inputAppQty = document.getElementById("app-qty");
  const btnSubmitApp = document.getElementById("btn-submit-app");
  const alertMsg = document.getElementById("alert-msg");
  const alertContainer = document.getElementById("alert-msg-container");
  const managerGroup = document.getElementById("manager-input-group");
  const inputManager = document.getElementById("app-manager");

  if(!inputAppPid) return;

  inputAppPid.addEventListener("blur", async () => {
    const pid = inputAppPid.value.trim();
    const drugCode = State.currentSelectedDrugCode;
    
    if (pid && drugCode) {
      alertContainer.style.display = "block";
      alertMsg.className = "alert alert-info";
      alertMsg.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>正在檢查 14 天內申請紀錄...';
      selectAppType.disabled = true;
      btnSubmitApp.disabled = true;

      const result = await fetch(`${GAS_API_URL}?action=checkEligibility&patientId=${pid}&drugCode=${drugCode}`).then(res => res.json());
      
      if(result.status === 'success') {
        const { hasInitialIn14Days, hasExtensionIn14Days } = result.data;
        selectAppType.innerHTML = `
          <option value="">-- 請選擇 --</option>
          <option value="初次申請" id="opt-initial">初次申請</option>
          <option value="展延申請" id="opt-extend">展延申請</option>
          <option value="複陽申請" id="opt-repositive">複陽申請</option>
        `;
        
        if (hasInitialIn14Days && !hasExtensionIn14Days) {
          document.getElementById("opt-initial").disabled = true;
          alertMsg.className = "alert alert-warning";
          alertMsg.textContent = "注意：此病患 14 天內已申請過，僅可申請「展延」或由主管同意「複陽」。";
        } else if (hasInitialIn14Days && hasExtensionIn14Days) {
          document.getElementById("opt-initial").disabled = true;
          document.getElementById("opt-extend").disabled = true;
          alertMsg.className = "alert alert-danger";
          alertMsg.textContent = "警告：此病患 14 天內已展延過，僅限申請「複陽」。";
        } else {
           alertContainer.style.display = "none";
        }
        selectAppType.disabled = false;
      } else {
        alertMsg.className = "alert alert-danger";
        alertMsg.textContent = "檢查失敗，請重試！";
      }
    }
  });

  selectAppType.addEventListener("change", () => {
    const type = selectAppType.value;
    if(!type) return;
    
    const drug = State.activeDrugs.find(d => d['藥品代碼'] === State.currentSelectedDrugCode);
    btnSubmitApp.disabled = false;
    managerGroup.style.display = "none";
    inputManager.required = false;

    // 依需求：直接鎖定為設定檔的最大值
    if (type === "展延申請") {
      inputAppDays.value = drug['展延天數上限'] || 5;
      inputAppQty.value = drug['展延數量上限'] || 2;
    } else {
      inputAppDays.value = drug['預設申請天數'] || 3;
      inputAppQty.value = drug['預設申請數量'] || 3;
      if (type === "複陽申請") {
        managerGroup.style.display = "block";
        inputManager.required = true;
      }
    }
  });

  document.getElementById("app-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    btnSubmitApp.disabled = true;
    btnSubmitApp.innerText = "傳送中...";
    
    const dataObj = {
      "病歷號": inputAppPid.value.trim(),
      "藥品代碼": State.currentSelectedDrugCode,
      "申請類別": selectAppType.value,
      "申請天數": inputAppDays.value, 
      "申請數量": inputAppQty.value,
      "處理單位": document.getElementById("app-unit").value,
      "申請日期": new Date().toLocaleDateString('zh-TW'),
      "收單時間": new Date().toLocaleTimeString('zh-TW'),
      "主管核准人": document.getElementById("app-manager").value,
      "申請備註": document.getElementById("app-note").value,
      "藥師員工編號": document.getElementById("app-pharmacist-id").value,
      "藥師姓名": document.getElementById("app-pharmacist-name").value
    };

    const res = await postData("submitApplication", dataObj);
    if(res.status === 'success') {
      alert("申請單已成功送出！");
      switchView('drug-dashboard');
      if (typeof refreshSingleDrugDashboard === "function") refreshSingleDrugDashboard(); 
    } else {
      alert("錯誤：" + res.message);
      btnSubmitApp.disabled = false;
      btnSubmitApp.innerText = "確認送出申請";
    }
  });
});
