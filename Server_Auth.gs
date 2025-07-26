/**
 * @file Server_Auth.gs
 * @description Handles user authentication.
 * @version 12.0 - Robust RBAC
 */

function authenticateUser(username, password) {
  if (!username || !password) return { success: false, message: "Username and password are required." };
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const usersSheet = ss.getSheetByName(USERS_SHEET_NAME);
  if (!usersSheet || usersSheet.getLastRow() < 2) return { success: false, message: "System Error: No user data found." };

  const hashedPassword = hashPassword_(password);
  const data = usersSheet.getRange(2, 1, usersSheet.getLastRow() - 1, 3).getValues(); 

  for (const row of data) {
    if (row[0] && String(row[0]).toLowerCase() === username.toLowerCase()) {
      if (row[1] === hashedPassword) {
        const role = row[2] || 'viewer';
        // Sửa lỗi: Lưu username đã được xác thực vào UserCache để các hàm khác có thể sử dụng
        CacheService.getUserCache().put('authenticated_username', String(row[0]), 1800); // Lưu trong 30 phút

        return { 
          success: true, 
          message: 'Login successful!', 
          redirectUrl: ScriptApp.getService().getUrl() + '?page=index',
          role: role
        };
      } else {
        return { success: false, message: "Incorrect password." };
      }
    }
  }
  return { success: false, message: "Username not found." };
}

function hashPassword_(password) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password, Utilities.Charset.UTF_8);
  return digest.map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
}

function utility_setupAdmin() {
  const username = "admin";
  const password = "password123";

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const usersSheet = ss.getSheetByName(USERS_SHEET_NAME) || ss.insertSheet(USERS_SHEET_NAME);
  usersSheet.clear();
  usersSheet.appendRow(["Username", "Hashed Password", "Role"]);
  usersSheet.appendRow([username, hashPassword_(password), "admin"]);
  Logger.log(`Admin user '${username}' created with 'admin' role.`);
}