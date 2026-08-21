// js/api.js

// 通用 GET 請求函數
async function fetchData(action) {
  try {
    const response = await fetch(`${GAS_API_URL}?action=${action}`);
    const result = await response.json();
    if (result.status === 'success') return result.data;
    console.error(`GET ${action} 錯誤:`, result.message);
    return [];
  } catch (error) {
    console.error(`API 連線錯誤 (${action}):`, error);
    return [];
  }
}

// 通用 POST 請求函數
async function postData(action, dataObj) {
  try {
    const response = await fetch(GAS_API_URL, {
      method: "POST",
      body: JSON.stringify({ action: action, data: dataObj })
    });
    const result = await response.json();
    return result; // 回傳 {status, message}
  } catch (error) {
    console.error(`POST ${action} 錯誤:`, error);
    return { status: 'error', message: '網路連線異常' };
  }
}
