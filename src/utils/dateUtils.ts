/**
 * Get current date in DD/MM/YYYY format (Vietnam locale)
 */
export const getCurrentDateFormatted = (): string => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Convert date string to YYYY-MM-DD format (required by Google Flights API)
 * Supports: DD/MM/YYYY, vague dates (sớm nhất, hôm nay, ngày mai, etc)
 */
export const convertToGoogleFlightsFormat = (dateStr: string | undefined): string => {
  if (!dateStr) {
    return getTodayInGoogleFormat();
  }

  const lowerDate = dateStr.toLowerCase().trim();

  // Handle vague date expressions
  if (lowerDate.includes('sớm nhất') || lowerDate.includes('soon')) {
    return getTodayInGoogleFormat(); // Today for earliest
  }
  if (lowerDate.includes('hôm nay') || lowerDate.includes('today')) {
    return getTodayInGoogleFormat();
  }
  if (lowerDate.includes('ngày mai') || lowerDate.includes('tomorrow')) {
    return getTomorrowInGoogleFormat();
  }
  if (lowerDate.includes('tuần tới') || lowerDate.includes('next week')) {
    return getDateInGoogleFormat(7);
  }
  if (lowerDate.includes('tháng tới') || lowerDate.includes('next month')) {
    return getDateInGoogleFormat(30);
  }

  // Try to parse DD/MM/YYYY format
  const datePattern = /(\d{1,2})\/(\d{1,2})\/(\d{4})/;
  const match = dateStr.match(datePattern);
  if (match) {
    const day = String(parseInt(match[1], 10)).padStart(2, '0');
    const month = String(parseInt(match[2], 10)).padStart(2, '0');
    const year = match[3];
    return `${year}-${month}-${day}`;
  }

  // If already YYYY-MM-DD format, return as is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // Default to today
  return getTodayInGoogleFormat();
};

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayInGoogleFormat(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get tomorrow's date in YYYY-MM-DD format
 */
function getTomorrowInGoogleFormat(): string {
  const now = new Date();
  now.setDate(now.getDate() + 1);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get date N days from today in YYYY-MM-DD format
 */
function getDateInGoogleFormat(daysFromNow: number): string {
  const now = new Date();
  now.setDate(now.getDate() + daysFromNow);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get date after N days in DD/MM/YYYY format
 */
export const getDateAfterDays = (days: number): string => {
  const now = new Date();
  now.setDate(now.getDate() + days);
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Parse duration (number of days) from user message
 * Examples: "3 ngày", "hai ngày", "1 tuần" (7 days)
 */
export const parseDurationFromMessage = (message: string): number => {
  const lowerMsg = message.toLowerCase();

  // Check for specific patterns
  if (lowerMsg.includes('một tuần') || lowerMsg.includes('1 tuần')) {
    return 7;
  }
  if (lowerMsg.includes('2 tuần') || lowerMsg.includes('hai tuần')) {
    return 14;
  }

  // Check for "X ngày" pattern
  const dayPattern = /(\d+)\s*ngày/;
  const dayMatch = lowerMsg.match(dayPattern);
  if (dayMatch) {
    return parseInt(dayMatch[1], 10);
  }

  // Check for "một/hai/ba/bốn/năm" patterns
  const numberWords: Record<string, number> = {
    'một': 1,
    'hai': 2,
    'ba': 3,
    'bốn': 4,
    'năm': 5,
    'sáu': 6,
    'bảy': 7,
    'tám': 8,
    'chín': 9,
    'mười': 10,
  };

  for (const [word, num] of Object.entries(numberWords)) {
    if (lowerMsg.includes(`${word} ngày`)) {
      return num;
    }
  }

  // Default: 3 days
  return 3;
};

/**
 * Parse start date from user message
 * Supports formats: DD/MM, DD/MM/YYYY, DD-MM, DD-MM-YYYY, YYYY-MM-DD
 */
export const parseStartDateFromMessage = (message: string): string | null => {
  // Match DD/MM/YYYY or DD/MM/YY
  const datePattern1 = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/;
  const match1 = message.match(datePattern1);
  if (match1) {
    let day = String(parseInt(match1[1])).padStart(2, '0');
    let month = String(parseInt(match1[2])).padStart(2, '0');
    let year = match1[3];
    // If year is 2-digit, assume 20XX
    if (year.length === 2) {
      year = `20${year}`;
    }
    return `${day}/${month}/${year}`;
  }

  // Match YYYY-MM-DD
  const datePattern2 = /(\d{4})-(\d{1,2})-(\d{1,2})/;
  const match2 = message.match(datePattern2);
  if (match2) {
    let day = String(parseInt(match2[3])).padStart(2, '0');
    let month = String(parseInt(match2[2])).padStart(2, '0');
    let year = match2[1];
    return `${day}/${month}/${year}`;
  }

  return null;
};

/**
 * Calculate end date from start date + duration
 */
export const calculateEndDate = (startDate: string, durationDays: number): string => {
  // Parse startDate (format: DD/MM/YYYY)
  const parts = startDate.split('/');
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // JavaScript months are 0-indexed
  const year = parseInt(parts[2], 10);

  const date = new Date(year, month, day);
  date.setDate(date.getDate() + durationDays - 1); // -1 because start day is day 1

  const endDay = String(date.getDate()).padStart(2, '0');
  const endMonth = String(date.getMonth() + 1).padStart(2, '0');
  const endYear = date.getFullYear();

  return `${endDay}/${endMonth}/${endYear}`;
};
