// js/drug_manage.js

let currentCustomCategories = [];
let dragStartIndex = null; // 紀錄目前正在拖曳的項目索引

// ==================== 拖拉排序專用事件 ====================
window.handleDragStart = function(e, index) {
    dragStartIndex = index;
    e.target.style.opacity = '0.5'; // 拖曳時半透明
    e.dataTransfer.effectAllowed = 'move';
};

window.handleDragOver = function(e) {
    e.preventDefault(); // 必須 preventDefault 才能觸發 Drop
    e.dataTransfer.dropEffect = 'move';
    return false;
};

window.handleDragEnter = function(e) {
    e.preventDefault();
    const target = e.target.closest('.custom-drag-item');
    if(target) target.classList.add('border-primary', 'border-2'); // 經過時加上藍框
};

window.handleDragLeave = function(e) {
    const target = e.target.closest('.custom-drag-item');
    if(target) target.classList.remove('border-primary', 'border-2');
};

window.handleDrop = function(e, dropIndex) {
    e.stopPropagation();
    e.preventDefault();
    
    const target = e.target.closest('.custom-drag-item');
    if(target) target.classList.remove('border-primary', 'border-2');
    
    if (dragStartIndex !== null && dragStartIndex !== dropIndex) {
        // 👉 防呆：不允許拖動第 0 筆 (初次申請)
        if (dragStartIndex === 0) return false;
        
        // 👉 防呆：如果試圖放到第 0 筆的位置，強制退回第 1 筆 (保護初次申請)
        if (dropIndex === 0) dropIndex = 1;

        // 執行陣列元素交換/插入
        const draggedItem = currentCustomCategories.splice(dragStartIndex, 1)[0];
        currentCustomCategories.splice(dropIndex, 0, draggedItem);
        
        renderCustomCategories(); // 重新渲染
    }
    return false;
};

window.handleDragEnd = function(e) {
    e.target.style.opacity = '1';
    document.querySelectorAll('.custom-drag-item').forEach(el => el.classList.remove('border-primary', 'border-2'));
    dragStartIndex = null;
};
// ==========================================================

window.renderCustomCategories = function() {
    const container = document.getElementById("custom-categories-container");
    if (!container) return;
    container.innerHTML = "";

    // 自動向下相容舊資料
    currentCustomCategories.forEach(cat => {
        if (!cat.type) {
            if (cat.name === "初次申請") cat.type = "INITIAL";
            else if (cat.isBreak) cat.type = "BREAK";
            else cat.type = "EXTENSION";
        }
    });

    // 防呆：確保第一筆永遠是初次申請
    if(currentCustomCategories.length === 0 || currentCustomCategories[0].name !== "初次申請") {
        const initCat = currentCustomCategories.find(c => c.name === "初次申請") || {name: "初次申請", desc: "系統強制預設：管制期內第一筆申請必選", defDays: 3, defQty: 3, type: "INITIAL"};
        currentCustomCategories = [initCat, ...currentCustomCategories.filter(c => c.name !== "初次申請")];
    }

    currentCustomCategories.forEach((cat, idx) => {
        const isInit = (idx === 0 && cat.name === "初次申請"); 
        
        // 只有非首筆的項目可以被拖曳
        const dragAttrs = !isInit ? `draggable="true" ondragstart="handleDragStart(event, ${idx})" ondragend="handleDragEnd(event)"` : ``;
        // 所有項目都可以作為接收放下的目標
        const dropAttrs = `ondragover="handleDragOver(event)" ondragenter="handleDragEnter(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event, ${idx})"`;

        container.innerHTML += `
            <div class="custom-drag-item border rounded p-2 mb-2 ${isInit ? 'bg-primary bg-opacity-10' : 'bg-light'} position-relative shadow-sm transition-all" style="${!isInit ? 'cursor: grab;' : ''}" ${dragAttrs} ${dropAttrs}>
                
                <!-- 拖曳手把 (僅非預設項目顯示) -->
                ${!isInit ? `<div class="position-absolute top-50 start-0 translate-middle-y ms-1 text-secondary"><i class="bi bi-grip-vertical fs-5"></i></div>` : ''}
                
                ${!isInit ? `<button type="button" class="btn btn-sm btn-danger position-absolute top-0 end-0 m-1" onclick="removeCustomCategory(${idx})" title="刪除此選項"><i class="bi bi-x"></i></button>` : `<span class="badge bg-primary position-absolute top-0 end-0 m-1">系統鎖定必填 (不可移動)</span>`}
                
                <!-- 調整 padding 以容納左側拖曳手把 -->
                <div class="row g-2 me-4 ${!isInit ? 'ps-3' : ''}">
                    <div class="col-md-5">
                        <label class="small text-muted fw-bold mb-0">選項文字</label>
                        <input type="text" class="form-control form-control-sm border-primary fw-bold" placeholder="例: 門診初次申請" value="${cat.name}" ${isInit ? 'readonly' : `onchange="currentCustomCategories[${idx}].name = this.value"`}>
                    </div>
                    <div class="col-md-7">
                        <label class="small text-muted fw-bold mb-0">選項描述</label>
                        <input type="text" class="form-control form-control-sm border-info" placeholder="說明文字..." value="${cat.desc || ''}" onchange="currentCustomCategories[${idx}].desc = this.value">
                    </div>
                    <div class="col-6">
                        <label class="small text-muted mb-0">預設天數 (不可大於全局)</label>
                        <input type="number" class="form-control form-control-sm" value="${cat.defDays || 3}" onchange="currentCustomCategories[${idx}].defDays = this.value">
                    </div>
                    <div class="col-6">
                        <label class="small text-muted mb-0">預設數量 (不可大於全局)</label>
                        <input type="number" class="form-control form-control-sm" value="${cat.defQty || 3}" onchange="currentCustomCategories[${idx}].defQty = this.value">
                    </div>
                    
                    <div class="col-12 mt-1">
                        <label class="small text-muted mb-0">類別屬性卡控</label>
                        <select class="form-select form-select-sm border-warning fw-bold" onchange="currentCustomCategories[${idx}].type = this.value; renderCustomCategories();">
                            <option value="INITIAL" ${cat.type === 'INITIAL' ? 'selected' : ''}>🔵 初次類別 (無紀錄時必定且僅能選此類)</option>
                            <option value="EXTENSION" ${cat.type === 'EXTENSION' ? 'selected' : ''}>🟢 一般延伸 (綁定前次日期，合併計算額度)</option>
                            <option value="BREAK" ${cat.type === 'BREAK' ? 'selected' : ''}>🔴 突破限制 (視為新療程，獨立日期與額度)</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
    });
};

window.addCustomCategory = function() {
    currentCustomCategories.push({name: "", desc: "", defDays: 3, defQty: 3, type: "EXTENSION"});
    renderCustomCategories();
};

window.removeCustomCategory = function(idx) {
    currentCustomCategories.splice(idx, 1);
    renderCustomCategories();
};

function renderDrugManageTable() {
  const tableBody = document.getElementById("drug-table-body");
  if(!tableBody) return;
  const allDrugs = State.allDrugs || [];
  tableBody.innerHTML = '';
  
  if (allDrugs.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="6" class="text-center">目前無藥品資料。</td></tr>';
    return;
  }

  allDrugs.forEach(drug => {
    if(!drug['藥品代碼']) return; 
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="fw-bold">${drug['藥品代碼']}</td>
      <td>${drug['藥品名稱']}</td>
      <td>${drug['管制天數']} 天</td>
      <td class="text-danger fw-bold">${drug['每次最大申請天數']||0}天 / ${drug['每次最大申請量']||0}支</td>
      <td><span class="badge ${String(drug['啟用狀態']).toUpperCase() === 'Y' ? 'bg-success' : 'bg-danger'}">${String(drug['啟用狀態']).toUpperCase() === 'Y' ? '啟用' : '停用'}</span></td>
      <td><button class="btn btn-sm btn-outline-primary btn-edit-drug" data-code="${drug['藥品代碼']}">編輯</button></td>
    `;
    tableBody.appendChild(tr);
  });

  document.querySelectorAll(".btn-edit-drug").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const code = e.target.getAttribute("data-code");
      const drug = State.allDrugs.find(d => String(d['藥品代碼']).toUpperCase() === String(code).toUpperCase());
      if (drug) {
        document.getElementById("drug-code").value = drug['藥品代碼'];
        document.getElementById("drug-name").value = drug['藥品名稱'];
        document.getElementById("drug-control-days").value = drug['管制天數'];
        document.getElementById("drug-global-max-days").value = drug['每次最大申請天數'] || 5;
        document.getElementById("drug-global-max-qty").value = drug['每次最大申請量'] || 5;
        document.getElementById("drug-status").value = String(drug['啟用狀態']).toUpperCase() || 'Y';
        document.getElementById("drug-code").setAttribute("readonly", true);
        
        try {
            currentCustomCategories = drug['自訂類別'] ? JSON.parse(drug['自訂類別']) : [];
        } catch(e) { currentCustomCategories = []; }
        renderCustomCategories();
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const drugForm = document.getElementById("drug-form");
  if(!drugForm) return;

  drugForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btnSave = document.getElementById("btn-save-drug");
    btnSave.disabled = true;
    btnSave.innerText = "儲存中...";
    
    const globalMaxDays = parseInt(document.getElementById("drug-global-max-days").value || 0);
    const globalMaxQty = parseInt(document.getElementById("drug-global-max-qty").value || 0);
    const validCats = currentCustomCategories.filter(c => c.name.trim() !== "");

    const hasInitial = validCats.some(c => c.type === "INITIAL");
    if (!hasInitial) {
        alert("⛔ 儲存失敗！\n您必須至少設定一個「初次類別 (INITIAL)」，否則新病患將無法申請藥品！");
        btnSave.disabled = false;
        btnSave.innerText = "儲存藥品設定";
        return;
    }

    for (let i = 0; i < validCats.length; i++) {
      const cat = validCats[i];
      if (parseInt(cat.defDays) > globalMaxDays || parseInt(cat.defQty) > globalMaxQty) {
        alert(`⛔ 儲存失敗！\n選項【${cat.name}】的預設天數 (${cat.defDays}) 或數量 (${cat.defQty})\n不可超過全局的 最大天數(${globalMaxDays}) 或 數量(${globalMaxQty})！`);
        btnSave.disabled = false;
        btnSave.innerText = "儲存藥品設定";
        return;
      }
    }
    
    const dataObj = {
      "藥品代碼": document.getElementById("drug-code").value.trim().toUpperCase(),
      "藥品名稱": document.getElementById("drug-name").value.trim(),
      "管制天數": document.getElementById("drug-control-days").value,
      "每次最大申請天數": document.getElementById("drug-global-max-days").value,
      "每次最大申請量": document.getElementById("drug-global-max-qty").value,
      "啟用狀態": document.getElementById("drug-status").value,
      "自訂類別": JSON.stringify(validCats)
    };

    const res = await postData("saveDrug", dataObj);
    if(res.status === 'success') {
      alert("藥品設定已儲存！");
      State.allDrugs = await fetchData('getAllDrugs');
      renderDrugManageTable(); 
      document.getElementById("btn-clear-drug").click();
    } else {
      alert("錯誤：" + res.message);
    }
    btnSave.disabled = false;
    btnSave.innerText = "儲存藥品設定";
  });

  document.getElementById("btn-clear-drug").addEventListener("click", () => {
    drugForm.reset();
    document.getElementById("drug-code").removeAttribute("readonly");
    currentCustomCategories = [];
    renderCustomCategories();
  });
});
