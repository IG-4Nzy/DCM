// @ts-nocheck
// Default Cluster Checklist Configuration
// This structure drives the entire checklist UI dynamically.
// To add new categories, fields groups, or parameters, simply extend this JSON.

export interface Rule {
  type: 'fail' | 'warning';
  operator: string;
  value: number | string;
  label?: string;
}

export interface ClusterParamConfig {
  value: string;
  bmsReading: string; // Keep as bmsReading (or clusterReading) to map to backend structure easily
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

export interface ClusterGroupConfig {
  [parameter: string]: ClusterParamConfig | string;
}

export interface ClusterCategoryConfig {
  [group: string]: ClusterGroupConfig;
}

export interface ClusterChecklistConfig {
  [category: string]: ClusterCategoryConfig;
}

export interface SavedClusterChecklist {
  id: string;
  date: string;
  time: string;
  preparedBy: string;
  status: 'Draft' | 'Completed';
  data: ClusterChecklistConfig;
  createdAt: string;
  updatedAt: string;
  department?: string;
  createdBy?: string;
  completedBy?: string;
}

// Normalise a parameter entry
export function normalizeClusterParam(val: ClusterParamConfig | string): ClusterParamConfig {
  if (typeof val === 'string') {
    return { value: val, bmsReading: '', remarks: '' };
  }
  return { 
    ...val, 
    bmsReading: val.bmsReading || '',
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
export interface ClusterFlatRow {
  id?: string;
  category: string; // maps to Category Name
  device: string;   // maps to Fields Group
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

export function flattenClusterConfig(config: ClusterChecklistConfig): ClusterFlatRow[] {
  const rows: ClusterFlatRow[] = [];
  Object.entries(config).forEach(([category, devices]) => {
    if (category === '__categoryRemarks__') return;
    Object.entries(devices).forEach(([device, params]) => {
      Object.entries(params).forEach(([param, raw]) => {
        const p = normalizeClusterParam(raw);
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
          device, // Fields group name
          parameter: param,
          value: p.value,
          bmsReading: p.bmsReading,
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
export function unflattenClusterRows(rows: ClusterFlatRow[]): ClusterChecklistConfig {
  const config: ClusterChecklistConfig = {};
  rows.forEach((row) => {
    if (!config[row.category]) config[row.category] = {};
    if (!config[row.category][row.device]) config[row.category][row.device] = {};
    const paramObj: ClusterParamConfig = {
      value: row.value,
      bmsReading: row.bmsReading,
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

export const DEFAULT_CLUSTER_CONFIG: ClusterChecklistConfig = {};

export function getClusterChecklistTemplate(): ClusterChecklistConfig {
  try {
    const raw = localStorage.getItem('cluster_checklist_template');
    return raw ? JSON.parse(raw) : DEFAULT_CLUSTER_CONFIG;
  } catch {
    return DEFAULT_CLUSTER_CONFIG;
  }
}
