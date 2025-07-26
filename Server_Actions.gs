/**
 * @file Server_Actions.gs
 * @description Handles discrete user actions.
 * @version 13.0 - Audit Trail Implementation
 */

function handleContactActivity(rowIndex, actionType) { // actionType is 'zalo' or 'email'
  const userRole = getRole_();
  if (userRole === 'viewer') {
    return { success: false, message: "Permission Denied: Viewers cannot perform this action.", type: 'error' };
  }

  try {
    if (!rowIndex || !actionType) {
      throw new Error("Row index or action type is missing.");
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(DATA_SHEET_NAME);
    
    const targetCol = actionType === 'zalo' ? COLUMN_MAP.COUNT_ZALO : COLUMN_MAP.COUNT_EMAIL;
    const range = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn());
    const originalRow = range.getValues()[0];
    const currentRow = originalRow.slice();
    const currentUser = CacheService.getUserCache().get('authenticated_username') || Session.getActiveUser().getEmail();
    const candidateName = originalRow[COLUMN_MAP.NAME] || `(No name)`;
    const target = `${candidateName} (row ${rowIndex})`;
    
    // --- Update counter ---
    const currentCounter = originalRow[targetCol] || '[ 0 ]';
    const match = currentCounter.match(/\[\s*(\d+)\s*\]/);
    const currentCount = match ? parseInt(match[1], 10) : 0;
    const newCount = currentCount + 1;
    currentRow[targetCol] = `[ ${newCount} ] ${currentUser}`;
    
    // --- Update status and day ---
    const oldStatus = originalRow[COLUMN_MAP.STATUS];
    currentRow[COLUMN_MAP.DAY_UPDATE] = new Date();
    if (oldStatus === 'New') {
      const newStatus = 'Contacted';
      currentRow[COLUMN_MAP.STATUS] = newStatus;
      writeToLog_(currentUser, 'CHANGE_STATUS', target, `Status changed from '${oldStatus}' to '${newStatus}'.`);
    }
    
    currentRow[COLUMN_MAP.COLLABORATOR] = currentUser;
    range.setValues([currentRow]);
    
    // Log the contact action
    const logAction = `CONTACT_${actionType.toUpperCase()}`;
    const logDetails = `User clicked ${actionType} button.`;
    writeToLog_(currentUser, logAction, target, logDetails);

    updateDataVersion();
    return { success: true, message: 'Contact activity logged.' };

  } catch (e) {
    Logger.log(`ERROR in handleContactActivity: ${e.message}`);
    return { success: false, message: `Server Error: ${e.message}`, type: 'error' };
  }
}

function logPhoneContact(rowIndex) {
    const userRole = getRole_();
    if (userRole === 'viewer') return;

    try {
        if (!rowIndex) return;
        const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
        const sheet = ss.getSheetByName(DATA_SHEET_NAME);
        const currentUser = CacheService.getUserCache().get('authenticated_username') || Session.getActiveUser().getEmail();
        const candidateName = sheet.getRange(rowIndex, COLUMN_MAP.NAME + 1).getValue() || `(No name)`;
        const target = `${candidateName} (row ${rowIndex})`;
        
        writeToLog_(currentUser, 'CONTACT_PHONE', target, 'User clicked phone link.');
        updateDataVersion();
    } catch(e) {
        Logger.log(`Failed to log phone contact: ${e.message}`);
    }
}