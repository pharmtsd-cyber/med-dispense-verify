// js/login.js

let employeeData = [];

document.addEventListener("DOMContentLoaded", async () => {
  const loadingMsg = document.getElementById("loading-msg");
  const loginForm = document.getElementById("login-form");
  const employeeSelect = document.getElementById("employee-select");

  // 1. 載入員工資料
  employeeData = await fetchEmployees();

  if (employeeData.length > 0) {
    // 2. 將員工資料填入下拉選單
    employeeData.forEach(emp => {
      // 排除空白資料
      if(emp['員工編號']) {
        const option = document.createElement("option");
        option.value = emp['員工編號'];
        // 顯示：員工編號 - 姓名 (權限)
        option.textContent = `${emp['員工編號']} - ${emp['姓名']} (${emp['權限']})`;
        employeeSelect.appendChild(option);
      }
    });

    // 3. 切換畫面顯示
    loadingMsg.style.display = "none";
    loginForm.style.display = "block";
  } else {
    loadingMsg.className = "alert alert-danger text-center";
    loadingMsg.textContent = "無法載入員工資料，請確認系統連線。";
  }

  // 4. 處理登入按鈕點擊事件
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault(); // 防止表單重新整理頁面
    const selectedId = employeeSelect.value;
    
    // 找出選中的員工完整資料
    const selectedEmp = employeeData.find(emp => emp['員工編號'] === selectedId);
    
    if (selectedEmp) {
      // 將登入資訊存入瀏覽器的 sessionStorage
      sessionStorage.setItem("currentUser", JSON.stringify({
        id: selectedEmp['員工編號'],
        name: selectedEmp['姓名'],
        role: selectedEmp['權限']
      }));
      
      alert(`歡迎登入，${selectedEmp['姓名']}！`);
      
      // TODO: 登入成功後，跳轉到申請單或調劑首頁
    }
  });
});
