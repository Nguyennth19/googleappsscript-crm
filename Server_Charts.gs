/**
 * @file Server_Charts.gs
 * @description Handles data aggregation for charts and form/filter settings.
 * @version 11.0 - Role-Based Access Control
 */

/**
 * Aggregates data for dashboard charts based on a specified date range.
 * @param {string} [dateRange='all'] The date range filter ('7', '30', '90', or 'all').
 * @returns {object} An object containing data for program, gender, and channel charts.
 */
function getChartsData(dateRange = 'all') {
  const cacheKey = `chartsData_v11.0_${dateRange}`;
  const cache = CacheService.getScriptCache();
  const cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(DATA_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 4) {
    return { programData: [], genderData: [], channelData: [] };
  }
  
  const lastRow = sheet.getLastRow();
  const allValues = sheet.getRange(4, 1, lastRow - 3, sheet.getLastColumn()).getValues();
  const now = new Date();
  
  const filteredValues = allValues.filter(row => {
    if (dateRange === 'all' || !row[COLUMN_MAP.DAY_UPDATE]) return true;
    const updateDate = new Date(row[COLUMN_MAP.DAY_UPDATE]);
    const diffDays = (now.getTime() - updateDate.getTime()) / (1000 * 3600 * 24);
    return diffDays <= Number(dateRange);
  });
  
  const countOccurrences = (data, label) => {
    const counts = data.flat().filter(String).reduce((acc, val) => {
      acc[val] = (acc[val] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).map(([name, count]) => ({ [label]: name, count })).sort((a, b) => b.count - a.count);
  };

  const programCol = filteredValues.map(row => row[COLUMN_MAP.PROGRAM]);
  const genderCol = filteredValues.map(row => row[COLUMN_MAP.GENDER]);
  const channelCol = filteredValues.map(row => row[COLUMN_MAP.CHANNELS]);
  
  const chartsData = {
    programData: countOccurrences(programCol, 'program'),
    genderData: countOccurrences(genderCol, 'gender'),
    channelData: countOccurrences(channelCol, 'channel')
  };
  
  cache.put(cacheKey, JSON.stringify(chartsData), 3600); // Cache for 1 hour
  return chartsData;
}

/**
 * Gets unique values for filter dropdowns from the data sheet.
 * @returns {object} An object containing arrays of unique genders, programs, and channels.
 */
function getFilterOptions() {
  const cache = CacheService.getScriptCache();
  const CACHE_KEY = "filterOptions_v11.0";
  const cached = cache.get(CACHE_KEY);
  if (cached) return JSON.parse(cached);

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(DATA_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 4) return { genders: [], programs: [], channels: [] };
  
  const getUniqueValues = (colIndex) => {
    const values = sheet.getRange(4, colIndex + 1, sheet.getLastRow() - 3, 1).getValues();
    return [...new Set(values.flat().filter(String))].sort();
  };

  const options = {
    genders: getUniqueValues(COLUMN_MAP.GENDER),
    programs: getUniqueValues(COLUMN_MAP.PROGRAM),
    channels: getUniqueValues(COLUMN_MAP.CHANNELS)
  };
  
  cache.put(CACHE_KEY, JSON.stringify(options), 3600);
  return options;
}

/**
 * Gets settings for form dropdowns from the Setting sheet.
 * This function is protected and can only be called by admins.
 * @returns {object} An object containing arrays for programs, channels, locations, and statuses.
 */
function getFormSettings() {
  const userRole = getRole_();
  if (userRole !== 'admin') {
    throw new Error('Permission Denied: You cannot create new candidates.');
  }

  const cache = CacheService.getScriptCache();
  const CACHE_KEY = "formSettings_v11.0";
  const cached = cache.get(CACHE_KEY);
  if (cached) return JSON.parse(cached);

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const settingSheet = ss.getSheetByName(SETTING_SHEET_NAME);
  if (!settingSheet || settingSheet.getLastRow() < 4) {
    return { locations: [], programs: [], channels: [], statuses: [] };
  }
  
  const settingData = settingSheet.getRange(4, 1, settingSheet.getLastRow() - 3, 6).getValues();

  const statusSettings = settingData.map(row => ({
      name: row[3],
      requireNote: row[4] === 'Yes',
      prompt: row[5]
  })).filter(status => status.name);

  const settings = {
    programs: [...new Set(settingData.map(row => row[0]).filter(String))].sort(),
    channels: [...new Set(settingData.map(row => row[1]).filter(String))].sort(),
    locations: [...new Set(settingData.map(row => row[2]).filter(String))].sort(),
    statuses: statusSettings
  };

  cache.put(CACHE_KEY, JSON.stringify(settings), 3600);
  return settings;
}