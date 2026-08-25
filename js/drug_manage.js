// js/drug_manage.js

let currentCustomCategories = [];
let dragStartIndex = null; 

// ==================== 拖拉排序專用事件 ====================
window.handleDragStart = function(e, index) {
    dragStartIndex = index;
    e.target.style.opacity = '0.5'; 
    e.dataTransfer.effectAllowed = 'move';
};

window.handleDragOver = function(e) {
    e.preventDefault(); 
    e.dataTransfer.dropEffect = 'move';
    return false;
};

window.handleDragEnter = function(e) {
    e.preventDefault();
    const target = e.target.closest('.custom-drag-item');
    if(target) target.classList.add('border-primary', 'border-2'); 
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
        // 👉 已經移除所有鎖定，所有選項都可以自由拖曳交換
        const draggedItem = currentCustomCategories.splice(dragStartIndex, 1)[0];
        currentCustomCategories.splice(dropIndex, 0, draggedItem);
        renderCustomCategories(); 
    }
    return false;
};

window.handleDragEnd = function(e) {
    e.target.style.opacity = '1';
    document.querySelectorAll('.custom-drag-item').forEach(el => el.classList.remove('border-primary', 'border-2'));
    dragStartIndex = null;
};
// ==========================================================

// 👉 即時驗證函數 (不重新渲染畫面，只動態加上紅框，避免輸入時失去焦點)
window.validateCustomCategories = function() {
    const globalMaxDays = parseInt(document.getElementById("drug-global-max-days").value) || 0;
    const globalMaxQty = parseInt(document.getElementById("drug-global-max-qty").value) || 0;
    
    document.querySelectorAll('.custom-cat-days').forEach(input => {
        if (parseInt(input.value) > globalMaxDays) {
            input.classList.add('is-invalid', 'border-danger', 'border-2');
            input.previousElementSibling.classList.add('text-danger', 'fw-bold');
            input.previousElementSibling.classList.remove('text-muted');
        } else {
            input.classList.remove('is-invalid', 'border-danger', 'border-2');
            input.previousElementSibling.classList.remove('text-danger', 'fw-bold');
            input.previousElementSibling.classList.add('text-muted');
        }
    });
    
    document.querySelectorAll('.custom-cat-qty').forEach(input => {
        if (parseInt(input.value) > globalMaxQty) {
            input.classList.add('is-invalid', 'border-danger', 'border-2');
            input.previousElementSibling.classList.add('text-danger', 'fw-bold');
            input.previousElementSibling.classList.remove('text-muted');
        } else {
            input.classList.remove('is-invalid', 'border-danger', 'border-2');
            input.previousElementSibling.classList.remove('text-danger', 'fw-bold');
            input.previousElementSibling.classList.add('text-muted');
        }
    });
};

window.renderCustomCategories = function() {
    const container = document.getElementById("custom-categories-container");
    if (!container) return;
    container.innerHTML = "";

    currentCustomCategories.forEach(cat => {
        if (!cat.type) {
            if (cat.name === "初次申請") cat.type = "INITIAL";
            else if (cat.isBreak) cat.type = "BREAK";
            else cat.type = "EXTENSION";
        }
    });

    if(currentCustomCategories.length === 0) {
        currentCustomCategories.push({name: "初次申請", desc: "系統預設", defDays: 3, defQty: 3, type: "INITIAL"});
    }

    currentCustomCategories.forEach((cat, idx) => {
        const dragAttrs = `draggable="true" ondragstart="handleDragStart(event, ${idx})" ondragend="handleDragEnd(event)"`;
        const dropAttrs = `ondragover="handleDragOver(event)" ondragenter="handleDragEnter(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event, ${idx})"`;

        // 👉 所有項目皆解鎖，皆可拖曳、編輯、刪除
        container.innerHTML += `
            <div class="custom-drag-item border rounded p-2 mb-2 bg-light position-relative shadow-sm transition-all" style="cursor: grab;" ${dragAttrs} ${dropAttrs}>
                <div class="position-absolute top-50 start-0 translate-middle-y ms-1 text-secondary"><i class="bi bi-grip-vertical fs-5"></i></div>
                <button type="button" class="btn btn-sm btn-danger position-absolute top-0 end-0 m-1" onclick="removeCustomCategory(${idx})" title="刪除此選項"><i class="bi bi-x"></i></button>
                
                <div class="row g-2 me-4 ps-3">
                    <div class="col-md-5">
                        <label class="small text-muted fw-bold mb-0">選項文字</label>
                        <input type="text" class="form-control form-control-sm border-primary fw-bold" placeholder="例: 門診初次申請" value="${cat.name}" oninput="currentCustomCategories[${idx}].name = this.value">
                    </div>
                    <div class="col-md-7">
                        <label class="small text-muted fw-bold mb-0">選項描述</label>
                        <input type="text" class="form-control form-control-sm border-info" placeholder="說明文字..." value="${cat.desc || ''}" oninput="currentCustomCategories[${idx}].desc = this.value">
                    </div>
                    <div class="col-6">
                        <label class="small text-muted mb-0 transition-all">預設天數 (不可大於全局)</label>
                        <input type="number" class="form-control form-control-sm custom-cat-days transition-all" value="${cat.defDays || 3}" oninput="currentCustomCategories[${idx}].defDays = this.value; validateCustomCategories();">
                    </div>
                    <div class="col-6">
                        <label class="small text-muted mb-0 transition-all">預設數量 (不可大於全局)</label>
                        <input type="number" class="form-control form-control-sm custom-cat-qty transition-all" value="${cat.defQty || 3}" oninput="currentCustomCategories[${idx}].defQty = this.value; validateCustomCategories();">
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
    validateCustomCategories(); // 渲染後馬上觸發一次驗證
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
  // 👉 監聽全局設定變更，即時觸發下方自訂類別的紅框驗證
  const maxDaysInput = document.getElementById("drug-global-max-days");
  const maxQtyInput = document.getElementById("drug-global-max-qty");
  if(maxDaysInput) maxDaysInput.addEventListener('input', validateCustomCategories);
  if(maxQtyInput) maxQtyInput.addEventListener('input', validateCustomCategories);

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
        alert("⛔ 儲存失敗！\n您必須至少設定一個「🔵 初次類別 (INITIAL)」，否則新病患將無法申請藥品！");
        btnSave.disabled = false;
        btnSave.innerText = "儲存藥品設定";
        return;
    }

    for (let i = 0; i < validCats.length; i++) {
      const cat = validCats[i];
      if (parseInt(cat.defDays) > globalMaxDays || parseInt(cat.defQty) > globalMaxQty) {
        alert(`⛔ 儲存失敗！\n選項【${cat.name}】的預設值已被紅框標記，不可超過全局的最大天數或數量！`);
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
