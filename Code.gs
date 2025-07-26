/**
 * @file Code.gs
 * @description Core functions, final configuration, and web app entry points.
 * @version 13.0 - Audit Trail Implementation
 */

// --- GLOBAL CONFIGURATION ---
const SPREADSHEET_ID = '1-G0V76ab4HRAE1HqYE-Pda472o0BWFKrazHfCzLrFIA';
const DATA_SHEET_NAME = "Data";
const USERS_SHEET_NAME = "Users";
const SETTING_SHEET_NAME = "Setting";
const AUDIT_LOG_SHEET_NAME = "Audit_Log";

const APP_CONFIG = {
  ITEMS_PER_PAGE: 10,
  DEFAULT_SORT_DIRECTION: 'desc'
};

// Cập nhật lại toàn bộ sau khi xóa 2 cột
const COLUMN_MAP = {
  STATUS: 0,
  NOTE: 1,
  NAME: 2,
  GENDER: 3,
  PHONE: 4,
  EMAIL: 5,
  PROGRAM: 6,
  CHANNELS: 7,
  LOCATION: 8,
  DAY_UPDATE: 9,
  ZALO: 10,
  ACTION_NOTE: 11,
  COLLABORATOR: 12,
  COUNT_ZALO: 13,
  COUNT_EMAIL: 14
};

// --- PRIVATE HELPERS ---

/**
 * Writes a new entry to the Audit_Log sheet.
 * @private
 */
function writeToLog_(user, action, target, details) {
  try {
    const logSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(AUDIT_LOG_SHEET_NAME);
    const timestamp = new Date();
    logSheet.appendRow([timestamp, user, action, target, details]);
  } catch (e) {
    Logger.log(`Failed to write to Audit Log: ${e.message}`);
  }
}

function getRole_() {
  try {
    const userCache = CacheService.getUserCache();
    // Lấy username từ cache thay vì email session
    const username = userCache.get('authenticated_username');
    if (!username) return 'viewer'; // If no user is logged in via our system, treat as viewer

    // Use a script-level cache to avoid hitting the spreadsheet multiple times in one execution
    const scriptCache = CacheService.getScriptCache();
    const roleCacheKey = `role_${username}`;
    const cachedRole = scriptCache.get(roleCacheKey);
    if(cachedRole) return cachedRole;

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const usersSheet = ss.getSheetByName(USERS_SHEET_NAME);
    if (!usersSheet || usersSheet.getLastRow() < 2) return 'viewer';

    const data = usersSheet.getRange(2, 1, usersSheet.getLastRow() - 1, 3).getValues();
    for (const row of data) {
      if (row[0] && String(row[0]).toLowerCase() === username.toLowerCase()) {
        const role = row[2] || 'viewer';
        scriptCache.put(roleCacheKey, role, 300); // Cache for 5 minutes
        return role;
      }
    }
    return 'viewer';
  } catch(e) {
    Logger.log('Error in getRole_: ' + e.toString());
    return 'viewer';
  }
}


/**
 * Updates the data version timestamp in PropertiesService.
 * This indicates a change in the underlying data.
 */
function updateDataVersion() {
  PropertiesService.getScriptProperties().setProperty('DATA_VERSION', new Date().getTime());
}

/**
 * Gets the current data version from PropertiesService.
 * @returns {string} The data version timestamp.
 */
function getDataVersion() {
  return PropertiesService.getScriptProperties().getProperty('DATA_VERSION');
}

// --- WEB APP ENTRY POINTS ---

function doGet(e) {
  if (e.parameter.page === 'index') {
    const template = HtmlService.createTemplateFromFile('Index');
    return template.evaluate().setTitle('SOM-AIT | Data Hub').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } else {
    const template = HtmlService.createTemplateFromFile('Login');
    return template.evaluate().setTitle('SOM-AIT | Login').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
}

function include(filename) {
  try {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  } catch (e) {
    Logger.log(`ERROR in include('${filename}'): ${e.message}`);
    return `<div style="color:red;font-weight:bold;">Error: Could not include file '${filename}'.</div>`;
  }
}

function trigger_updateNoteDays() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(DATA_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 4) return;
  const range = sheet.getRange(4, 1, sheet.getLastRow() - 3, COLUMN_MAP.DAY_UPDATE + 1);
  const values = range.getValues();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < values.length; i++) {
    const updateDateVal = values[i][COLUMN_MAP.DAY_UPDATE];
    if (updateDateVal instanceof Date) {
      const updateDate = new Date(updateDateVal);
      updateDate.setHours(0, 0, 0, 0);
      const diffTime = Math.abs(today - updateDate);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      values[i][COLUMN_MAP.NOTE] = diffDays;
    }
  }
  range.setValues(values);
  Logger.log('trigger_updateNoteDays: NOTE column updated.');
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('🛠️ Admin Tools').addItem('Setup Daily Trigger', 'setupTriggers').addToUi();
}

function setupTriggers() {
  const triggerFunctionName = 'trigger_updateNoteDays';
  const allTriggers = ScriptApp.getProjectTriggers();
  for (const trigger of allTriggers) {
    if (trigger.getHandlerFunction() === triggerFunctionName) {
      ScriptApp.deleteTrigger(trigger);
    }
  }
  ScriptApp.newTrigger(triggerFunctionName).timeBased().everyDays(1).atHour(1).create();
  SpreadsheetApp.getUi().alert('✅ Success!', `The trigger for '${triggerFunctionName}' has been set up to run daily.`, SpreadsheetApp.getUi().ButtonSet.OK);
}