// js/api.js
async function fetchActiveDrugs() {
  try {
    // 組合網址，帶上 action 參數
    const response = await fetch(`${GAS_API_URL}?action=getActiveDrugs`);
    const result = await response.json();
    
    if (result.status === 'success') {
      return result.data;
    } else {
      console.error("後端回傳錯誤：", result.message);
      return [];
    }
  } catch (error) {
    console.error("Fetch 失敗：", error);
    return [];
  }
}
