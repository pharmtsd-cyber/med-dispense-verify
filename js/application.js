// js/application.js

let activeDrugs = [];

document.addEventListener("DOMContentLoaded", async () => {
  // 確認登入
  const userStr = sessionStorage.getItem("currentUser");
  if (!userStr) {
    window.location.href = "index.html";
    return;
  }
  const user = JSON.parse(userStr);

  // 取得 DOM 元素
  const inputPatientId = document.getElementById("app-patient-id");
  const selectDrug = document.getElementById("app-drug-code");
  const selectType = document.getElementById("app-type");
  const inputDays = document.getElementById("app-days");
  const selectDays = document.getElementById("app-days-select");
  const inputQty = document.getElementById("app-qty");
  const managerGroup = document.getElementById("manager-input-group");
  const inputManager = document.getElementById("app-manager");
  const alertContainer = document.getElementById("alert-msg-container");
  const alertMsg = document.getElementById("alert-msg");
  const btnSubmit = document.getElementById("btn-submit");

  // 1. 載入藥品清單
  activeDrugs = await fetchData('getActiveDrugs');
  selectDrug.innerHTML = '<option value="" selected disabled>-- 選擇藥品 --</option>';
  activeDrugs.forEach(drug => {
    const opt = document.createElement('option');
    opt.value = drug['藥品代碼'];
    opt.textContent = `${drug['藥品名稱']} (${drug['藥品代碼']})`;
    selectDrug.appendChild(opt);
  });
  selectDrug.disabled = false;

  // 2. 當病歷號與藥品都選定後，去後端檢查資格
  async function checkEligibility() {
    const pid = inputPatientId.value.trim();
    const drugId = selectDrug.value;
    
    if (pid && drugId) {
      alertContainer.style.display = "block";
      alertMsg.className = "alert alert-info";
      alertMsg.textContent = "正在檢查 14 天內申請紀錄...";
      selectType.disabled = true;
      btnSubmit.disabled = true;

      // 呼叫後端 API
      const result = await fetch(`${GAS_API_URL}?action=checkEligibility&patientId=${pid}&drugCode=${drugId}`).then(res => res.json());
      
      if(result.status === 'success') {
        const { hasInitialIn14Days, hasExtensionIn14Days } = result.data;
        
        // 重置選項狀態
        document.getElementById("opt-initial").disabled = false;
        document.getElementById("opt-extend").disabled = false;
        
        if (hasInitialIn14Days && !hasExtensionIn14Days) {
          // 情境 B: 已有初次，無展延
          document.getElementById("opt-initial").disabled = true;
          alertMsg.className = "alert alert-warning";
          alertMsg.textContent = "注意：此病患 14 天內已申請過，僅可申請「展延」或由主管同意「複陽」。";
        } else if (hasInitialIn14Days && hasExtensionIn14Days) {
          // 情境 C: 已展延過
          document.getElementById("opt-initial").disabled = true;
          document.getElementById("opt-extend").disabled = true;
          alertMsg.className = "alert alert-danger";
          alertMsg.textContent = "警告：此病患 14 天內已展延過，僅限申請「複陽」。";
        } else {
           // 情境 A: 都沒申請過
           alertContainer.style.display = "none";
        }

        selectType.disabled = false;
        selectType.value = ""; // 清空選擇
      }
    }
  }

  // 綁定事件：當病歷號離開焦點或選擇藥品時觸發檢查
  inputPatientId.addEventListener("blur", checkEligibility);
  selectDrug.addEventListener("change", checkEligibility);

  // 3. 處理「申請類別」切換時的表單變化
  selectType.addEventListener("change", () => {
    const type = selectType.value;
    const selectedDrugInfo = activeDrugs.find(d => d['藥品代碼'] === selectDrug.value);
    
    btnSubmit.disabled = false;
    managerGroup.style.display = "none";
    inputManager.required = false;

    if (type === "展延申請") {
      // 展延：天數改用下拉選單限制
      inputDays.style.display = "none";
      selectDays.style.display = "block";
      inputDays.required = false;
      selectDays.required = true;
      
      // 動態生成展延天數選項 (例如 4, 5)
      const defaultDays = parseInt(selectedDrugInfo['預設申請天數'] || 3);
      const maxExtDays = parseInt(selectedDrugInfo['展延天數上限'] || 5);
      
      selectDays.innerHTML = '<option value="">請選擇展延天數</option>';
      for(let i = defaultDays + 1; i <= maxExtDays; i++) {
         const opt = document.createElement('option');
         opt.value = i;
         opt.textContent = `${i} 天`;
         selectDays.appendChild(opt);
      }
      
      inputQty.value = selectedDrugInfo['展延數量上限'] || 2; // 預設展延數量

    } else {
      // 初次 或 複陽
      inputDays.style.display = "block";
      selectDays.style.display = "none";
      inputDays.required = true;
      selectDays.required = false;
      
      inputDays.value = selectedDrugInfo['預設申請天數'] || 3;
      inputQty.value = selectedDrugInfo['預設申請數量'] || 3;
      
      if (type === "複陽申請") {
        managerGroup.style.display = "block";
        inputManager.required = true;
      }
    }
  });

  // 4. 表單送出 (寫入 Google Sheet)
  document.getElementById("app-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const type = selectType.value;
    
    const dataObj = {
      "病歷號": inputPatientId.value.trim(),
      "藥品代碼": selectDrug.value,
      "申請類別": type,
      "申請天數": type === "展延申請" ? selectDays.value : inputDays.value,
      "申請數量": inputQty.value,
      "處理單位": document.getElementById("app-unit").value,
      "申請日期": new Date().toLocaleDateString('zh-TW'),
      "收單時間": new Date().toLocaleTimeString('zh-TW'),
      "主管核准人": inputManager.value,
      "申請備註": document.getElementById("app-note").value,
      "藥師員工編號": user.id,
      "藥師姓名": user.name
    };

    btnSubmit.disabled = true;
    const res = await postData("submitApplication", dataObj);
    if(res.status === 'success') {
      alert("申請單已成功送出！");
      window.location.reload(); // 重整頁面準備下一張
    } else {
      alert("錯誤：" + res.message);
      btnSubmit.disabled = false;
    }
  });
});
