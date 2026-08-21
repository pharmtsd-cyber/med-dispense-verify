// js/api.js

/**
 * 取得員工資料清單
 */
async function fetchEmployees() {
  try {
    const response = await fetch(`${GAS_API_URL}?action=getEmployeeData`);
    const result = await response.json();
    
    if (result.status === 'success') {
      return result.data;
    } else {
      console.error("取得員工資料失敗：", result.message);
      return [];
    }
  } catch (error) {
    console.error("API 連線錯誤：", error);
    return [];
  }
}
