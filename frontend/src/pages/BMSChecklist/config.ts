// Default BMS Checklist Configuration
// This structure drives the entire checklist UI dynamically.
// To add new categories, devices, or parameters, simply extend this JSON.

export interface Rule {
  type: 'fail' | 'warning';
  operator: string;
  value: number | string;
  label?: string;
}

export interface ParamConfig {
  value: string;
  BMS_Reading: string;
  unit?: string;
  remarks?: string;
  timestamp?: string;
  ruleOperator?: string;
  ruleValue?: number;
  maxValue?: number;
  warningOperator?: string;
  warningValue?: number;
  warningLabel?: string;
  rules?: Rule[];
}

export interface DeviceConfig {
  [parameter: string]: ParamConfig | string;
}

export interface CategoryConfig {
  [device: string]: DeviceConfig;
}

export interface ChecklistConfig {
  [category: string]: CategoryConfig;
}

export interface SavedChecklist {
  id: string;
  date: string;
  time: string;
  preparedBy: string;
  status: 'Draft' | 'Completed';
  data: ChecklistConfig;
  createdAt: string;
  updatedAt: string;
  department?: string;
  createdBy?: string;
  completedBy?: string;
}

// Normalise a parameter entry: handles both object-form { value, BMS_Reading, unit }
// and simple string-form like "ON"
export function normalizeParam(val: ParamConfig | string): ParamConfig {
  if (typeof val === 'string') {
    return { value: val, BMS_Reading: '', remarks: '' };
  }
  return { 
    ...val, 
    remarks: val.remarks || '',
    ruleOperator: val.ruleOperator || '',
    ruleValue: val.ruleValue,
    maxValue: val.maxValue,
    warningOperator: val.warningOperator || '',
    warningValue: val.warningValue,
    warningLabel: val.warningLabel || '',
    rules: val.rules || [],
  };
}

// Flatten config into table rows
export interface FlatRow {
  id?: string;
  category: string;
  device: string;
  parameter: string;
  value: string;
  bmsReading: string;
  unit: string;
  remarks: string;
  timestamp?: string;
  ruleOperator?: string;
  ruleValue?: string | number;
  maxValue?: string | number;
  warningOperator?: string;
  warningValue?: string | number;
  warningLabel?: string;
  rules?: Rule[];
}

export function flattenConfig(config: ChecklistConfig): FlatRow[] {
  const rows: FlatRow[] = [];
  Object.entries(config).forEach(([category, devices]) => {
    Object.entries(devices).forEach(([device, params]) => {
      Object.entries(params).forEach(([param, raw]) => {
        const p = normalizeParam(raw);
        let rulesList = p.rules || [];
        if (rulesList.length === 0) {
          if (p.ruleOperator && p.ruleValue !== undefined) {
            rulesList.push({
              type: 'fail',
              operator: p.ruleOperator,
              value: p.ruleValue,
            });
          }
          if (p.warningOperator && p.warningValue !== undefined) {
            rulesList.push({
              type: 'warning',
              operator: p.warningOperator,
              value: p.warningValue,
              label: p.warningLabel,
            });
          }
        }
        rows.push({
          id: `${category}-${device}-${param}`,
          category,
          device,
          parameter: param,
          value: p.value,
          bmsReading: p.BMS_Reading,
          unit: p.unit || '',
          remarks: p.remarks || '',
          timestamp: p.timestamp,
          ruleOperator: p.ruleOperator || '',
          ruleValue: p.ruleValue !== undefined ? p.ruleValue : '',
          maxValue: p.maxValue !== undefined ? p.maxValue : '',
          warningOperator: p.warningOperator || '',
          warningValue: p.warningValue !== undefined ? p.warningValue : '',
          warningLabel: p.warningLabel || '',
          rules: rulesList,
        });
      });
    });
  });
  return rows;
}

// Rebuild the nested config from flat rows
export function unflattenRows(rows: FlatRow[]): ChecklistConfig {
  const config: ChecklistConfig = {};
  rows.forEach((row) => {
    if (!config[row.category]) config[row.category] = {};
    if (!config[row.category][row.device]) config[row.category][row.device] = {};
    const paramObj: ParamConfig = {
      value: row.value,
      BMS_Reading: row.bmsReading,
      remarks: row.remarks,
      timestamp: row.timestamp,
    };
    if (row.unit) paramObj.unit = row.unit;
    if (row.maxValue !== undefined && row.maxValue !== '') {
      paramObj.maxValue = typeof row.maxValue === 'string' ? parseFloat(row.maxValue) : row.maxValue;
    }

    const rulesList = row.rules || [];
    const firstFail = rulesList.find(r => r.type === 'fail');
    const firstWarning = rulesList.find(r => r.type === 'warning');

    if (firstFail) {
      paramObj.ruleOperator = firstFail.operator;
      paramObj.ruleValue = typeof firstFail.value === 'string' ? parseFloat(firstFail.value) : firstFail.value;
    }
    if (firstWarning) {
      paramObj.warningOperator = firstWarning.operator;
      paramObj.warningValue = typeof firstWarning.value === 'string' ? parseFloat(firstWarning.value) : firstWarning.value;
      paramObj.warningLabel = firstWarning.label;
    }
    if (rulesList.length > 0) {
      paramObj.rules = rulesList.map(r => ({
        ...r,
        value: typeof r.value === 'string' ? parseFloat(r.value) : r.value
      }));
    }

    config[row.category][row.device][row.parameter] = paramObj;
  });
  return config;
}

export const DEFAULT_CONFIG: ChecklistConfig = {};

export function getChecklistTemplate(): ChecklistConfig {
  try {
    const raw = localStorage.getItem('bms_checklist_template');
    return raw ? JSON.parse(raw) : DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}
