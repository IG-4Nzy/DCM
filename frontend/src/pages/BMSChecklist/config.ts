// Default BMS Checklist Configuration
// This structure drives the entire checklist UI dynamically.
// To add new categories, devices, or parameters, simply extend this JSON.

export interface ParamConfig {
  value: string;
  BMS_Reading: string;
  unit?: string;
  remarks?: string;
  timestamp?: string;
  ruleOperator?: string;
  ruleValue?: number;
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
    ruleValue: val.ruleValue
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
}

export function flattenConfig(config: ChecklistConfig): FlatRow[] {
  const rows: FlatRow[] = [];
  Object.entries(config).forEach(([category, devices]) => {
    Object.entries(devices).forEach(([device, params]) => {
      Object.entries(params).forEach(([param, raw]) => {
        const p = normalizeParam(raw);
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
    if (row.ruleOperator) paramObj.ruleOperator = row.ruleOperator;
    if (row.ruleValue !== undefined && row.ruleValue !== '') {
      paramObj.ruleValue = typeof row.ruleValue === 'string' ? parseFloat(row.ruleValue) : row.ruleValue;
    }
    config[row.category][row.device][row.parameter] = paramObj;
  });
  return config;
}

export const DEFAULT_CONFIG: ChecklistConfig = {
  "Server room PAC": {
    "PAC-1": {
      "Humidity": { value: "", BMS_Reading: "", unit: "%" },
      "Temperature": { value: "", BMS_Reading: "", unit: "°C" },
      "Status": { value: "", BMS_Reading: "", unit: "" }
    },
    "PAC-2": {
      "Humidity": { value: "", BMS_Reading: "", unit: "%" },
      "Temperature": { value: "", BMS_Reading: "", unit: "°C" },
      "Status": { value: "", BMS_Reading: "", unit: "" }
    },
    "PAC-3": {
      "Humidity": { value: "", BMS_Reading: "", unit: "%" },
      "Temperature": { value: "", BMS_Reading: "", unit: "°C" },
      "Status": { value: "", BMS_Reading: "", unit: "" }
    },
    "PAC-4": {
      "Humidity": { value: "", BMS_Reading: "", unit: "%" },
      "Temperature": { value: "", BMS_Reading: "", unit: "°C" },
      "Status": { value: "", BMS_Reading: "", unit: "" }
    }
  },
  "Chiller Status": {
    "Chiller - 1": {
      "ON/OFF Status": { value: "", BMS_Reading: "" },
      "CH Inlet Temp": { value: "", BMS_Reading: "", unit: "°C" },
      "CH Outlet Temp": { value: "", BMS_Reading: "", unit: "°C" },
      "Discharge Pressure": { value: "", BMS_Reading: "", unit: "bar" },
      "Suction Pressure": { value: "", BMS_Reading: "", unit: "bar" },
      "Con-Run-Hrs": { value: "", BMS_Reading: "", unit: "hrs" }
    },
    "Chiller - 2": {
      "ON/OFF Status": { value: "", BMS_Reading: "" },
      "CH Inlet Temp": { value: "", BMS_Reading: "", unit: "°C" },
      "CH Outlet Temp": { value: "", BMS_Reading: "", unit: "°C" },
      "Discharge Pressure": { value: "", BMS_Reading: "", unit: "bar" },
      "Suction Pressure": { value: "", BMS_Reading: "", unit: "bar" },
      "Con-Run-Hrs": { value: "", BMS_Reading: "", unit: "hrs" }
    },
    "Chiller - 3": {
      "ON/OFF Status": { value: "", BMS_Reading: "" },
      "CH Inlet Temp": { value: "", BMS_Reading: "", unit: "°C" },
      "CH Outlet Temp": { value: "", BMS_Reading: "", unit: "°C" },
      "Discharge Pressure": { value: "", BMS_Reading: "", unit: "bar" },
      "Suction Pressure": { value: "", BMS_Reading: "", unit: "bar" },
      "Con-Run-Hrs": { value: "", BMS_Reading: "", unit: "hrs" }
    }
  },
  "Electrical Panels": {
    "UPS Panel -1 in Electrical Room DC": {
      "R PH Voltage": { value: "", BMS_Reading: "", unit: "V" },
      "Y PH Voltage": { value: "", BMS_Reading: "", unit: "V" },
      "B PH Voltage": { value: "", BMS_Reading: "", unit: "V" },
      "R PH Current": { value: "", BMS_Reading: "", unit: "A" },
      "Y PH Current": { value: "", BMS_Reading: "", unit: "A" },
      "B PH Current": { value: "", BMS_Reading: "", unit: "A" },
      "Power Factor": { value: "", BMS_Reading: "", unit: "PF" },
      "Power": { value: "", BMS_Reading: "", unit: "kW" }
    },
    "UPS Panel -2 in Electrical Room DC": {
      "R PH Voltage": { value: "", BMS_Reading: "", unit: "V" },
      "Y PH Voltage": { value: "", BMS_Reading: "", unit: "V" },
      "B PH Voltage": { value: "", BMS_Reading: "", unit: "V" },
      "R PH Current": { value: "", BMS_Reading: "", unit: "A" },
      "Y PH Current": { value: "", BMS_Reading: "", unit: "A" },
      "B PH Current": { value: "", BMS_Reading: "", unit: "A" },
      "Power Factor": { value: "", BMS_Reading: "", unit: "PF" },
      "Power": { value: "", BMS_Reading: "", unit: "kW" }
    },
    "Panel -3 (PAC) in DC": {
      "R PH Voltage": { value: "", BMS_Reading: "", unit: "V" },
      "Y PH Voltage": { value: "", BMS_Reading: "", unit: "V" },
      "B PH Voltage": { value: "", BMS_Reading: "", unit: "V" },
      "R PH Current": { value: "", BMS_Reading: "", unit: "A" },
      "Y PH Current": { value: "", BMS_Reading: "", unit: "A" },
      "B PH Current": { value: "", BMS_Reading: "", unit: "A" },
      "Power Factor": { value: "", BMS_Reading: "", unit: "PF" },
      "Power": { value: "", BMS_Reading: "", unit: "kW" }
    },
    "Panel -4 (UPS Panel) in DC": {
      "R PH Voltage": { value: "", BMS_Reading: "", unit: "V" },
      "Y PH Voltage": { value: "", BMS_Reading: "", unit: "V" },
      "B PH Voltage": { value: "", BMS_Reading: "", unit: "V" },
      "R PH Current": { value: "", BMS_Reading: "", unit: "A" },
      "Y PH Current": { value: "", BMS_Reading: "", unit: "A" },
      "B PH Current": { value: "", BMS_Reading: "", unit: "A" },
      "Power Factor": { value: "", BMS_Reading: "", unit: "PF" },
      "Power": { value: "", BMS_Reading: "", unit: "kW" }
    },
    "Chiller Panel -1": {
      "R PH Voltage": { value: "", BMS_Reading: "", unit: "V" },
      "Y PH Voltage": { value: "", BMS_Reading: "", unit: "V" },
      "B PH Voltage": { value: "", BMS_Reading: "", unit: "V" },
      "R PH Current": { value: "", BMS_Reading: "", unit: "A" },
      "Y PH Current": { value: "", BMS_Reading: "", unit: "A" },
      "B PH Current": { value: "", BMS_Reading: "", unit: "A" },
      "Power Factor": { value: "", BMS_Reading: "", unit: "PF" },
      "Power": { value: "", BMS_Reading: "", unit: "kW" }
    },
    "Chiller Panel -2": {
      "R PH Voltage": { value: "", BMS_Reading: "", unit: "V" },
      "Y PH Voltage": { value: "", BMS_Reading: "", unit: "V" },
      "B PH Voltage": { value: "", BMS_Reading: "", unit: "V" },
      "R PH Current": { value: "", BMS_Reading: "", unit: "A" },
      "Y PH Current": { value: "", BMS_Reading: "", unit: "A" },
      "B PH Current": { value: "", BMS_Reading: "", unit: "A" },
      "Power Factor": { value: "", BMS_Reading: "", unit: "PF" },
      "Power": { value: "", BMS_Reading: "", unit: "kW" }
    },
    "PDU - 1A": {
      "Voltage": { value: "", BMS_Reading: "", unit: "V" },
      "Current": { value: "", BMS_Reading: "", unit: "A" },
      "Power": { value: "", BMS_Reading: "", unit: "kW" },
      "Power Factor": { value: "", BMS_Reading: "", unit: "PF" }
    },
    "PDU - 1B": {
      "Voltage": { value: "", BMS_Reading: "", unit: "V" },
      "Current": { value: "", BMS_Reading: "", unit: "A" },
      "Power": { value: "", BMS_Reading: "", unit: "kW" },
      "Power Factor": { value: "", BMS_Reading: "", unit: "PF" }
    },
    "PDU - 2A": {
      "Voltage": { value: "", BMS_Reading: "", unit: "V" },
      "Current": { value: "", BMS_Reading: "", unit: "A" },
      "Power": { value: "", BMS_Reading: "", unit: "kW" },
      "Power Factor": { value: "", BMS_Reading: "", unit: "PF" }
    },
    "PDU - 2B": {
      "Voltage": { value: "", BMS_Reading: "", unit: "V" },
      "Current": { value: "", BMS_Reading: "", unit: "A" },
      "Power": { value: "", BMS_Reading: "", unit: "kW" },
      "Power Factor": { value: "", BMS_Reading: "", unit: "PF" }
    }
  },
  "Water Leak Detection (WLD) Status": {
    "Zone 1": {
      "Status": { value: "", BMS_Reading: "" }
    },
    "Zone 2": {
      "Status": { value: "", BMS_Reading: "" }
    },
    "Zone 3": {
      "Status": { value: "Normal", BMS_Reading: "" }
    },
    "Zone 4": {
      "Status": { value: "Normal", BMS_Reading: "Normal" }
    }
  },
  "Vesda Status": {
    "Vesda Panel": {
      "Status": { value: "Normal", BMS_Reading: "Normal" }
    }
  }
};

export function getChecklistTemplate(): ChecklistConfig {
  try {
    const raw = localStorage.getItem('bms_checklist_template');
    return raw ? JSON.parse(raw) : DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}
