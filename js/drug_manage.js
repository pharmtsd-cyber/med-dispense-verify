// js/drug_manage.js

let allDrugs = [];

document.addEventListener("DOMContentLoaded", async () => {
  // 檢查權限 (實務上可以檢查 user.role 是否為管理員)
  const userStr = sessionStorage.getItem("currentUser");
  if (!userStr) {
    window.location.href = "index.html";
    return;
  }

  const tableBody = document.getElementById("drug-table-body");
  const drugForm = document.getElementById("drug-form");
  const btnSave = document.getElementById("btn-save-drug");

  // 1. 載入並渲染藥品清單
  async function loadDrugs() {
    tableBody.innerHTML = '<tr><td colspan="7" class="text-center">資料載入中...</td></tr>';
    allDrugs = await fetchData('getAllDrugs');
    tableBody.innerHTML = '';

    if (allDrugs.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="7" class="text-center">目前無藥品資料，請從左側新增。</td></tr>';
      return;
    }

    allDrugs.forEach(drug => {
      // 確保排除完全空白的列
      if(!drug['藥品代碼']) return; 

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="fw-bold">${drug['藥品代碼']}</td>
        <td>${drug['藥品名稱']}</td>
        <td>${drug['管制天數']} 天</td>
        <td>${drug['預設申請天數']} 天 / ${drug['預設申請數量']} 支</td>
        <td>${drug['展延天數上限']} 天 / ${drug['展延數量上限']} 支</td>
        <td>
          <span class="badge ${drug['啟用狀態'].toUpperCase() === 'Y' ? 'bg-success' : 'bg-danger'}">
            ${drug['啟用狀態'].toUpperCase() === 'Y' ? '啟用' : '停用'}
          </span>
        </td>
        <td>
          <button class="btn btn-sm btn-outline-primary btn-edit" data-code="${drug['藥品代碼']}">編輯</button>
        </td>
      `;
      tableBody.appendChild(tr);
    });

    // 綁定編輯按鈕事件
    document.querySelectorAll(".btn-edit").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const code = e.target.getAttribute("data-code");
        const drug = allDrugs.find(d => d['藥品代碼'] === code);
        if (drug) {
          document.getElementById("drug-code").value = drug['藥品代碼'];
          document.getElementById("drug-name").value = drug['藥品名稱'];
          document.getElementById("drug-control-days").value = drug['管制天數'];
          document.getElementById("drug-default-days").value = drug['預設申請天數'];
          document.getElementById("drug-default-qty").value = drug['預設申請數量'];
          document.getElementById("drug-max-ext-days").value = drug['展延天數上限'];
          document.getElementById("drug-max-ext-qty").value = drug['展延數量上限'];
          document.getElementById("drug-status").value = drug['啟用狀態'].toUpperCase() || 'Y';
          
          // 編輯模式時可以鎖定代碼不給改，避免改錯主鍵
          document.getElementById("drug-code").setAttribute("readonly", true);
        }
      });
    });
  }

  // 初次載入
  await loadDrugs();

  // 2. 處理表單送出 (新增或更新)
  drugForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    btnSave.disabled = true;
    btnSave.innerText = "儲存中...";

    const dataObj = {
      "藥品代碼": document.getElementById("drug-code").value.trim(),
      "藥品名稱": document.getElementById("drug-name").value.trim(),
      "管制天數": document.getElementById("drug-control-days").value,
      "預設申請天數": document.getElementById("drug-default-days").value,
      "預設申請數量": document.getElementById("drug-default-qty").value,
      "展延天數上限": document.getElementById("drug-max-ext-days").value,
      "展延數量上限": document.getElementById("drug-max-ext-qty").value,
      "啟用狀態": document.getElementById("drug-status").value
    };

    const res = await postData("saveDrug", dataObj);
    
    if(res.status === 'success') {
      alert("藥品設定已儲存！");
      document.getElementById("drug-code").removeAttribute("readonly");
      drugForm.reset();
      await loadDrugs(); // 重新載入列表
    } else {
      alert("錯誤：" + res.message);
    }
    
    btnSave.disabled = false;
    btnSave.innerText = "儲存藥品設定";
  });

  // 3. 清除表單按鈕
  document.getElementById("btn-clear").addEventListener("click", () => {
    drugForm.reset();
    document.getElementById("drug-code").removeAttribute("readonly");
  });
});
