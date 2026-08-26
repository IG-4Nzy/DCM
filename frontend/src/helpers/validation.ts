/**
 * Validation utilities for application-wide forms.
 * These match user-defined patterns and limits exactly.
 */

export const validators = {
  // Alphanumeric, spaces, and underscores: a-z, A-Z, 0-9, _, space
  alphanumeric: (val: string, maxLen?: number, label = "Field") => {
    if (!val) return "";
    if (!/^[a-zA-Z0-9_\s]+$/.test(val)) return `${label} must contain alphanumeric characters, spaces, or underscores only`;
    if (maxLen && val.length > maxLen) return `${label} must be maximum ${maxLen} characters`;
    return "";
  },

  // Alphanumeric and spaces
  alphanumericSpaces: (val: string, maxLen?: number, label = "Field") => {
    if (!val) return "";
    if (!/^[a-zA-Z0-9\s]+$/.test(val)) return `${label} must be alphanumeric with spaces only`;
    if (maxLen && val.length > maxLen) return `${label} must be maximum ${maxLen} characters`;
    return "";
  },

  // Alphanumeric, spaces, dots, hyphens, and underscores
  alphanumericSpacesDotsDashesUnderscores: (val: string, maxLen?: number, label = "Field") => {
    if (!val) return "";
    if (!/^[a-zA-Z0-9\s._-]+$/.test(val)) return `${label} must contain alphanumeric characters, spaces, dots, underscores, or dashes only`;
    if (maxLen && val.length > maxLen) return `${label} must be maximum ${maxLen} characters`;
    return "";
  },

  // Alphabets and spaces
  alphabetsSpaces: (val: string, maxLen?: number, label = "Field") => {
    if (!val) return "";
    if (!/^[a-zA-Z\s]+$/.test(val)) return `${label} must contain alphabetic characters and spaces only`;
    if (maxLen && val.length > maxLen) return `${label} must be maximum ${maxLen} characters`;
    return "";
  },

  // Serial/Asset number: alphanumeric, spaces, dots, slashes, underscores, and dashes
  serialAsset: (val: string, maxLen?: number, label = "Field") => {
    if (!val) return "";
    if (!/^[a-zA-Z0-9\s./_-]+$/.test(val)) return `${label} must contain alphanumeric characters, spaces, dots, slashes, underscores, or dashes only`;
    if (maxLen && val.length > maxLen) return `${label} must be maximum ${maxLen} characters`;
    return "";
  },

  // Alphanumeric, spaces, commas, hyphens, dots, and colons
  alphanumericGeneral: (val: string, maxLen?: number, label = "Field") => {
    if (!val) return "";
    if (!/^[a-zA-Z0-9\s,.:-]+$/.test(val)) return `${label} must contain alphanumeric characters, spaces, commas, periods, colons, or dashes only`;
    if (maxLen && val.length > maxLen) return `${label} must be maximum ${maxLen} characters`;
    return "";
  },

  // Alphanumeric and comma (with spaces allowed)
  alphanumericComma: (val: string, maxLen?: number, label = "Field") => {
    if (!val) return "";
    if (!/^[a-zA-Z0-9\s,]+$/.test(val)) return `${label} must contain alphanumeric characters, spaces, and commas only`;
    if (maxLen && val.length > maxLen) return `${label} must be maximum ${maxLen} characters`;
    return "";
  },

  // Alphanumeric and dots
  alphanumericDots: (val: string, maxLen?: number, label = "Field") => {
    if (!val) return "";
    if (!/^[a-zA-Z0-9.]+$/.test(val)) return `${label} must be alphanumeric and dots only`;
    if (maxLen && val.length > maxLen) return `${label} must be maximum ${maxLen} characters`;
    return "";
  },

  // Alphanumeric, underscore, spaces, and dots
  alphanumericUnderscore: (val: string, maxLen?: number, label = "Field") => {
    if (!val) return "";
    if (!/^[a-zA-Z0-9_\s]+$/.test(val)) return `${label} must contain alphanumeric characters, spaces, or underscores only`;
    if (maxLen && val.length > maxLen) return `${label} must be maximum ${maxLen} characters`;
    return "";
  },

  // Alphabets, numbers and underscore
  username: (val: string, maxLen?: number, label = "Username") => {
    if (!val) return "";
    if (!/^[a-zA-Z0-9_]+$/.test(val)) return `${label} must contain only alphabets, numbers, and underscores`;
    if (maxLen && val.length > maxLen) return `${label} must be maximum ${maxLen} characters`;
    return "";
  },

  // Contact number: letters, numbers, spaces, hyphens, plus signs
  contactNumber: (val: string, maxLen = 15, label = "Contact Number") => {
    if (!val) return "";
    if (!/^[a-zA-Z0-9\s+-]+$/.test(val)) return `${label} must contain letters, numbers, spaces, hyphens, and plus signs only`;
    if (val.length > maxLen) return `${label} must be maximum ${maxLen} characters`;
    return "";
  },

  // Alphabets and spaces
  alphabets: (val: string, maxLen?: number, label = "Field") => {
    if (!val) return "";
    if (!/^[a-zA-Z\s]+$/.test(val)) return `${label} must contain alphabets and spaces only`;
    if (maxLen && val.length > maxLen) return `${label} must be maximum ${maxLen} characters`;
    return "";
  },

  // Numeric only: 0-9
  numeric: (val: string, maxLen?: number, label = "Field") => {
    if (!val) return "";
    if (!/^[0-9]+$/.test(val)) return `${label} must contain numbers only`;
    if (maxLen && val.length > maxLen) return `${label} must be maximum ${maxLen} characters`;
    return "";
  },

  // Numeric and comma
  numericComma: (val: string, maxLen?: number, label = "Field") => {
    if (!val) return "";
    if (!/^[0-9,]+$/.test(val)) return `${label} must contain numbers and commas only`;
    if (maxLen && val.length > maxLen) return `${label} must be maximum ${maxLen} characters`;
    return "";
  },

  // Numeric and dot
  numericDots: (val: string, maxLen?: number, label = "Field") => {
    if (!val) return "";
    if (!/^[0-9.]+$/.test(val)) return `${label} must contain numbers and dots only`;
    if (maxLen && val.length > maxLen) return `${label} must be maximum ${maxLen} characters`;
    return "";
  },

  // Numbers 1 to 31
  rangeDay: (val: any, label = "Field") => {
    if (val === undefined || val === null || val === "") return "";
    const n = Number(val);
    if (isNaN(n) || n < 1 || n > 31 || !Number.isInteger(n)) return `${label} must be a whole number between 1 and 31`;
    return "";
  },

  // Date cannot be in the future
  dateNotFuture: (val: string, label = "Date") => {
    if (!val) return "";
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (new Date(val) > today) return `${label} cannot be a future date`;
    return "";
  },

  // Date cannot be in the past
  dateNotPast: (val: string, label = "Date") => {
    if (!val) return "";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(val) < today) return `${label} cannot be a past date`;
    return "";
  },

  // IPv4 Address validation
  ipv4: (val: string, label = "IP Address") => {
    if (!val) return "";
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(val)) return `${label} must be a valid IPv4 address (e.g. 192.168.1.1)`;
    return "";
  },

  // IPv4 Comma-Separated Address validation
  ipv4CommaSeparated: (val: string, label = "IP Address") => {
    if (!val) return "";
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const parts = val.split(',').map(part => part.trim()).filter(Boolean);
    if (parts.length === 0) return "";
    for (const part of parts) {
      if (!ipRegex.test(part)) {
        return `${label} must contain valid IPv4 addresses separated by commas (e.g. 192.168.1.1, 192.168.1.2)`;
      }
    }
    return "";
  },

  // Maximum character limit
  maxLength: (val: string, maxLen: number, label = "Field") => {
    if (!val) return "";
    if (val.length > maxLen) return `${label} must be maximum ${maxLen} characters`;
    return "";
  },

  // File size limit
  fileSize: (file: File | null, maxMb = 5, label = "File") => {
    if (!file) return "";
    const maxSize = maxMb * 1024 * 1024;
    if (file.size > maxSize) return `${label} size must be maximum ${maxMb}MB`;
    return "";
  },

  // OS and Expiry: alphanumeric, spaces, dots, slashes, parentheses, dashes
  osExpiry: (val: string, maxLen?: number, label = "Field") => {
    if (!val) return "";
    if (!/^[a-zA-Z0-9\s._/()-]+$/.test(val)) return `${label} must contain alphanumeric characters, spaces, dots, slashes, parentheses, or dashes only`;
    if (maxLen && val.length > maxLen) return `${label} must be maximum ${maxLen} characters`;
    return "";
  },

  // Applications: alphanumeric, spaces, commas, dots, slashes, parentheses, dashes
  applicationsGeneral: (val: string, maxLen?: number, label = "Field") => {
    if (!val) return "";
    if (!/^[a-zA-Z0-9\s,._/()-]+$/.test(val)) return `${label} must contain alphanumeric characters, spaces, commas, dots, slashes, parentheses, or dashes only`;
    if (maxLen && val.length > maxLen) return `${label} must be maximum ${maxLen} characters`;
    return "";
  },

  // Phone/digits: digits, spaces, commas, plus, dashes
  phoneDigits: (val: string, maxLen?: number, label = "Field") => {
    if (!val) return "";
    if (!/^[0-9\s,+-]+$/.test(val)) return `${label} must contain digits, spaces, commas, plus signs, or dashes only`;
    if (maxLen && val.length > maxLen) return `${label} must be maximum ${maxLen} characters`;
    return "";
  },

  // Alphanumeric with spaces and dots (for resource values like RAM/CPU/HDD)
  alphanumericSpacesDots: (val: string, maxLen?: number, label = "Field") => {
    if (!val) return "";
    if (!/^[a-zA-Z0-9\s.]+$/.test(val)) return `${label} must contain alphanumeric characters, spaces, or dots only`;
    if (maxLen && val.length > maxLen) return `${label} must be maximum ${maxLen} characters`;
    return "";
  }
};

export const getTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
