/**
 * @file Server_Data.gs
 * @description Handles CRUD data operations.
 * @version 14.0 - Advanced Features (History & Filters)
 */

function getAppCoreData() {
  try {
    return {
      columnMap: COLUMN_MAP,
      appConfig: APP_CONFIG,
      dataVersion: getDataVersion()
    };
  } catch (e) {
    Logger.log(`FATAL getAppCoreData: ${e.message} ${e.stack}`);
    throw new Error('Could not load core app data.');
  }
}

function saveCandidateData(data) {
  const userRole = getRole_();
  if (userRole !== 'admin') {
    return { success: false, message: "Permission Denied: You cannot create new candidates.", type: 'error' };
  }
  
  if (!data.program || !data.channels) {
    return { success: false, message: "Error: Program and Channel are required.", type: 'error' };
  }
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(DATA_SHEET_NAME);
    const lastRow = sheet.getLastRow();
    const currentUser = CacheService.getUserCache().get('authenticated_username') || Session.getActiveUser().getEmail();
    let warnings = [];

    if (lastRow >= 4) {
      const allData = sheet.getRange(4, 1, lastRow - 3, sheet.getLastColumn()).getValues();
      const newEmail = data.email ? data.email.trim().toLowerCase() : null;
      const newPhone = data.phone ? data.phone.trim().replace(/\s/g, '') : null;
      const newName = data.name ? data.name.trim().toLowerCase() : null;

      for (const row of allData) {
        if (newEmail && row[COLUMN_MAP.EMAIL] === newEmail && row[COLUMN_MAP.PROGRAM] === data.program) {
          return { success: false, message: `Error: This email has already registered for the '${data.program}' program.`, type: 'error' };
        }
        if (newPhone && row[COLUMN_MAP.PHONE] === `'${newPhone}`) {
            warnings.push("Phone number already exists.");
        }
        if (newName && row[COLUMN_MAP.NAME] && typeof row[COLUMN_MAP.NAME].toLowerCase === 'function' && row[COLUMN_MAP.NAME].toLowerCase() === newName) {
            warnings.push("Candidate name already exists.");
        }
      }
    }
    
    const phoneRegex = /^0\d{9}$/;
    if (data.phone && !phoneRegex.test(data.phone.trim().replace(/\s/g, ''))) {
        return { success: false, message: "Error: Invalid phone number format.", type: 'error' };
    }

    const newRow = new Array(Object.keys(COLUMN_MAP).length).fill('');
    newRow[COLUMN_MAP.STATUS] = "New";
    newRow[COLUMN_MAP.NOTE] = 0;
    newRow[COLUMN_MAP.NAME] = data.name ? data.name.trim() : "";
    newRow[COLUMN_MAP.GENDER] = data.gender;
    newRow[COLUMN_MAP.PHONE] = data.phone ? "'" + data.phone.trim().replace(/\s/g, '') : "";
    newRow[COLUMN_MAP.EMAIL] = data.email ? data.email.trim().toLowerCase() : "";
    newRow[COLUMN_MAP.PROGRAM] = data.program;
    newRow[COLUMN_MAP.CHANNELS] = data.channels;
    newRow[COLUMN_MAP.LOCATION] = data.location;
    newRow[COLUMN_MAP.DAY_UPDATE] = new Date();
    newRow[COLUMN_MAP.ZALO] = data.phone ? `https://zalo.me/${data.phone.trim().replace(/\s/g, '')}` : "";
    newRow[COLUMN_MAP.COLLABORATOR] = currentUser;
    
    sheet.appendRow(newRow);
    const newRowIndex = sheet.getLastRow();
    const candidateName = data.name ? data.name.trim() : `(No name)`;
    const target = `${candidateName} (row ${newRowIndex})`;

    writeToLog_(currentUser, 'CREATE_CANDIDATE', target, 'New candidate created.');
    updateDataVersion();

    if (warnings.length > 0) {
        const uniqueWarnings = [...new Set(warnings)];
        return { success: true, message: `Saved successfully, but with warnings: ${uniqueWarnings.join(' ')}`, type: 'warning' };
    }

    return { success: true, message: 'Candidate saved successfully.', type: 'success' };
  } catch (e) {
    return { success: false, message: `Server Error: ${e.message}`, type: 'error' };
  }
}

function updateCandidateData(data) {
   const userRole = getRole_();
   if (userRole !== 'admin') {
     return { success: false, message: "Permission Denied: You cannot update candidates.", type: 'error' };
   }

   if (!data.program || !data.channels || !data.status) {
    return { success: false, message: "Error: Program, Channel and Status are required.", type: 'error' };
  }
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(DATA_SHEET_NAME);
    const currentUser = CacheService.getUserCache().get('authenticated_username') || Session.getActiveUser().getEmail();
    const rowIndex = data.rowIndex;
    if (!rowIndex) throw new Error("Row index is missing.");

    const rangeToUpdate = sheet.getRange(rowIndex, 1, 1, Object.keys(COLUMN_MAP).length);
    const originalRow = rangeToUpdate.getValues()[0];
    const updatedRow = originalRow.slice();
    const candidateName = data.name ? data.name.trim() : originalRow[COLUMN_MAP.NAME];
    const target = `${candidateName} (row ${rowIndex})`;

    const changedFields = [];
    const fieldsToCompare = {
        'Name': { index: COLUMN_MAP.NAME, newValue: data.name ? data.name.trim() : "" },
        'Gender': { index: COLUMN_MAP.GENDER, newValue: data.gender },
        'Phone': { index: COLUMN_MAP.PHONE, newValue: data.phone ? `'` + data.phone.trim().replace(/\s/g, '') : "" },
        'Email': { index: COLUMN_MAP.EMAIL, newValue: data.email ? data.email.trim().toLowerCase() : "" },
        'Program': { index: COLUMN_MAP.PROGRAM, newValue: data.program },
        'Channels': { index: COLUMN_MAP.CHANNELS, newValue: data.channels },
        'Location': { index: COLUMN_MAP.LOCATION, newValue: data.location }
    };

    for (const fieldName in fieldsToCompare) {
        const field = fieldsToCompare[fieldName];
        if (String(originalRow[field.index]) !== String(field.newValue)) {
            changedFields.push(fieldName);
        }
    }

    if (changedFields.length > 0) {
        const details = `Updated fields: ${changedFields.join(', ')}.`;
        writeToLog_(currentUser, 'EDIT_CANDIDATE', target, details);
    }

    const oldStatus = originalRow[COLUMN_MAP.STATUS];
    const newStatus = data.status;
    if (oldStatus !== newStatus) {
        writeToLog_(currentUser, 'CHANGE_STATUS', target, `Status changed from '${oldStatus}' to '${newStatus}'.`);
    }

    updatedRow[COLUMN_MAP.NAME] = fieldsToCompare.Name.newValue;
    updatedRow[COLUMN_MAP.GENDER] = fieldsToCompare.Gender.newValue;
    updatedRow[COLUMN_MAP.PHONE] = fieldsToCompare.Phone.newValue;
    updatedRow[COLUMN_MAP.EMAIL] = fieldsToCompare.Email.newValue;
    updatedRow[COLUMN_MAP.PROGRAM] = fieldsToCompare.Program.newValue;
    updatedRow[COLUMN_MAP.CHANNELS] = fieldsToCompare.Channels.newValue;
    updatedRow[COLUMN_MAP.LOCATION] = fieldsToCompare.Location.newValue;
    updatedRow[COLUMN_MAP.STATUS] = newStatus;
    updatedRow[COLUMN_MAP.ACTION_NOTE] = data.actionNote || "";
    updatedRow[COLUMN_MAP.DAY_UPDATE] = new Date();
    updatedRow[COLUMN_MAP.COLLABORATOR] = currentUser;
    updatedRow[COLUMN_MAP.ZALO] = data.phone ? `https://zalo.me/${data.phone.trim().replace(/\s/g, '')}` : "";
    
    rangeToUpdate.setValues([updatedRow]);
    updateDataVersion();
    return { success: true, message: "Candidate updated successfully.", type: 'success' };
  } catch (e) {
    return { success: false, message: `Server Error: ${e.message}`, type: 'error' };
  }
}

function getDataForTable(options) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(DATA_SHEET_NAME);
    if (!sheet || sheet.getLastRow() < 4) return { data: [], totalItems: 0, header: [] };
    
    const allData = sheet.getRange(3, 1, sheet.getLastRow() - 2, sheet.getLastColumn()).getValues();
    const header = allData[0];
    let dataRows = allData.slice(1);
    
    dataRows = dataRows.filter(row => row[COLUMN_MAP.STATUS] !== 'Archived');
    
    const userRole = getRole_();
    if (userRole === 'viewer') {
      dataRows.forEach(row => {
        row[COLUMN_MAP.PHONE] = 'Protected';
      });
    }
    
    dataRows = dataRows.map((row, index) => [...row, 3 + index + 1]);
    const rowIndexInPayload = header.length;

    const { gender, program, channels } = options.filters; 
    if (gender) dataRows = dataRows.filter(row => row[COLUMN_MAP.GENDER] === gender);
    if (program) dataRows = dataRows.filter(row => row[COLUMN_MAP.PROGRAM] === program);
    if (channels) dataRows = dataRows.filter(row => row[COLUMN_MAP.CHANNELS] === channels);

    const searchTerm = options.searchTerm?.toLowerCase().trim();
    if (searchTerm) {
      const searchIndexes = [COLUMN_MAP.NAME, COLUMN_MAP.PHONE, COLUMN_MAP.EMAIL];
      dataRows = dataRows.filter(row => searchIndexes.some(index => row[index]?.toString().toLowerCase().includes(searchTerm)));
    }

    dataRows.sort((a, b) => {
      const dateA = new Date(a[COLUMN_MAP.DAY_UPDATE]);
      const dateB = new Date(b[COLUMN_MAP.DAY_UPDATE]);
      return options.sortDirection === 'asc' ? dateA - dateB : dateB - dateA; 
    });

    const totalItems = dataRows.length;
    const { page, itemsPerPage } = options;
    const startIndex = (page - 1) * itemsPerPage;
    const paginatedData = dataRows.slice(startIndex, startIndex + itemsPerPage);

    const finalData = paginatedData.map(row => {
      if (row[COLUMN_MAP.DAY_UPDATE] instanceof Date) {
        row[COLUMN_MAP.DAY_UPDATE] = Utilities.formatDate(row[COLUMN_MAP.DAY_UPDATE], Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
      }
      return row;
    });
    
    return { header: header, data: finalData, totalItems: totalItems, totalPages: Math.ceil(totalItems / itemsPerPage), rowIndexInPayload: rowIndexInPayload };
  } catch (e) {
    Logger.log(`Error in getDataForTable: ${e.message} at ${e.stack}`);
    return { error: `Server Error: ${e.message}` };
  }
}

/**
 * Gets the formatted history and interaction counts for a specific candidate.
 * @param {number} rowIndex The row index of the candidate in the 'Data' sheet.
 * @returns {object} An object containing zaloCount, emailCount, and an array of log strings.
 */
function getCandidateHistory(rowIndex) {
  try {
    if (!rowIndex) {
      throw new Error("Row index is required to get history.");
    }
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const dataSheet = ss.getSheetByName(DATA_SHEET_NAME);
    const logSheet = ss.getSheetByName(AUDIT_LOG_SHEET_NAME);

    // Get candidate's name and interaction counts from Data sheet
    const candidateDataRange = dataSheet.getRange(rowIndex, 1, 1, dataSheet.getLastColumn());
    const candidateData = candidateDataRange.getValues()[0];
    const candidateName = candidateData[COLUMN_MAP.NAME];
    const zaloCount = candidateData[COLUMN_MAP.COUNT_ZALO] || '[ 0 ]';
    const emailCount = candidateData[COLUMN_MAP.COUNT_EMAIL] || '[ 0 ]';
    const targetIdentifier = `${candidateName} (row ${rowIndex})`;
    
    // Get detailed logs from Audit_Log sheet
    let history = ["No detailed history found for this candidate."];
    if (logSheet.getLastRow() >= 2) {
      const logData = logSheet.getRange(2, 1, logSheet.getLastRow() - 1, 5).getValues();
      
      const filteredLogs = logData
        .filter(row => row[3] === targetIdentifier) // Filter by Target Candidate
        .map(row => {
          const timestamp = Utilities.formatDate(new Date(row[0]), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
          const user = row[1];
          const action = row[2];
          const details = row[4];
          return `[${timestamp}] by ${user} - Action: ${action} - Details: ${details}`;
        })
        .reverse(); // Newest first
      
      if (filteredLogs.length > 0) {
        history = filteredLogs;
      }
    }

    return {
      zaloCount: zaloCount,
      emailCount: emailCount,
      logs: history
    };

  } catch (e) {
    Logger.log(`Error in getCandidateHistory: ${e.message}`);
    return { 
        zaloCount: 'N/A', 
        emailCount: 'N/A',
        logs: [`Error fetching history: ${e.message}`] 
    };
  }
}