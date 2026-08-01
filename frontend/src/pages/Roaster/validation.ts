// @ts-nocheck
import dayjs from "dayjs";

export interface ValidationError {
  date: string;
  shift: string;
  username: string;
  reason: string;
}

export interface RosterRow {
  name: string;
  mappedShift: string;
}

export interface RosterValidationRule {
  id?: string;
  fromShift: string;
  allowedNextShifts?: string[];
  restrictedNextShifts?: string[];
  description?: string;
}

export const validateRoster = (
  rosterData: Record<string, { assignees: string[] }>,
  weekDates: string[],
  rows: RosterRow[] = [],
  shifts: any[] = [],
  validationRules: RosterValidationRule[] = []
): ValidationError[] => {
  const errors: ValidationError[] = [];
  const activeRows = rows.length > 0 ? rows : [
    { name: "Shift 1 Row 1", mappedShift: "Shift-1" },
    { name: "Shift 1 Row 2", mappedShift: "Shift-1" },
    { name: "Shift 2 Row 1", mappedShift: "Shift-2" },
    { name: "Shift 2 Row 2", mappedShift: "Shift-2" },
    { name: "Shift 3 Row 1", mappedShift: "Shift-3" },
    { name: "Shift 3 Row 2", mappedShift: "Shift-3" },
    { name: "Leave", mappedShift: "Leave" }
  ];

  interface UserShiftMapping {
    actualShift: string;
    colShift: string;
    rowName: string;
    rIdx: number;
  }

  const normStr = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  const matchesShiftTarget = (m: UserShiftMapping, target: string) => {
    if (!target) return false;
    const normT = normStr(target);
    const normCol = normStr(m.colShift);
    const normAct = normStr(m.actualShift);
    const normRow = normStr(m.rowName);

    if (normT === normCol || normT === normAct || normT === normRow) return true;
    if (normCol && normCol.includes(normT)) return true;
    if (normAct && normAct.includes(normT)) return true;
    if (normRow && normRow.includes(normT)) return true;
    if (normT.includes(normCol) || normT.includes(normAct) || normT.includes(normRow)) return true;
    return false;
  };

  // Helper to map all assignees on a date to their actual shifts and source columns
  const getUserShiftsForDate = (date: string): Record<string, UserShiftMapping[]> => {
    const userShifts: Record<string, UserShiftMapping[]> = {};
    const rosterColumns = ['Shift-1', 'Shift-2', 'Shift-3'];

    rosterColumns.forEach((colShift) => {
      const assignees = rosterData[`${date}_${colShift}`]?.assignees || [];
      let colRows = activeRows
        .filter(r => normStr(r.name).includes(normStr(colShift)))
        .sort((a, b) => a.name.localeCompare(b.name));
      if (colRows.length === 0) {
        colRows = [
          { name: `${colShift.replace('-', ' ')} Row 1`, mappedShift: colShift },
          { name: `${colShift.replace('-', ' ')} Row 2`, mappedShift: colShift }
        ];
      }

      colRows.forEach((row, rIdx) => {
        const username = assignees[rIdx];
        if (username) {
          const actualShift = row.mappedShift?.replace(/\s+/g, '-') || colShift;
          if (!userShifts[username]) {
            userShifts[username] = [];
          }
          userShifts[username].push({ actualShift, colShift, rowName: row.name, rIdx });
        }
      });
    });

    return userShifts;
  };

  const isNightDuty = (m: UserShiftMapping) => {
    const normActual = (m.actualShift || '').toLowerCase();
    const normRow = (m.rowName || '').toLowerCase();
    return (
      m.colShift === 'Shift-3' ||
      normActual.includes('3') ||
      normActual.includes('4') ||
      normActual.includes('night') ||
      normRow.includes('shift 3') ||
      normRow.includes('shift 4')
    );
  };

  const isRestrictedNextDayShift = (m: UserShiftMapping) => {
    if (m.colShift === 'Shift-1' || m.colShift === 'Shift-2') {
      return true;
    }
    if (m.colShift === 'Shift-3') {
      const normActual = (m.actualShift || '').toLowerCase();
      const normRow = (m.rowName || '').toLowerCase();
      if (m.rIdx === 1 || normActual.includes('4') || normRow.includes('row 2') || normRow.includes('shift 4')) {
        return false;
      }
      return true;
    }
    const normActual = (m.actualShift || '').toLowerCase();
    if (normActual.includes('1') || normActual.includes('2') || normActual.includes('3')) {
      return true;
    }
    return false;
  };

  weekDates.forEach((date, index) => {
    const userShiftsToday = getUserShiftsForDate(date);

    // Rule 1: A person cannot be in 2 shifts a day
    Object.entries(userShiftsToday).forEach(([username, mappings]) => {
      if (mappings.length > 1) {
        mappings.forEach((m) => {
          errors.push({
            date,
            shift: m.colShift,
            username,
            reason: "Cannot be in multiple shifts on the same day",
          });
        });
      }
    });

    // Dynamic Rule Evaluation if custom rules are configured
    if (validationRules && validationRules.length > 0) {
      if (index < weekDates.length - 1) {
        const nextDate = weekDates[index + 1];
        const userShiftsTomorrow = getUserShiftsForDate(nextDate);

        Object.entries(userShiftsToday).forEach(([username, todayMappings]) => {
          const tomorrowMappings = userShiftsTomorrow[username] || [];
          if (tomorrowMappings.length === 0) return;

          todayMappings.forEach(todayS => {
            validationRules.forEach(rule => {
              if (matchesShiftTarget(todayS, rule.fromShift)) {
                tomorrowMappings.forEach(tomorrowS => {
                  let isViolated = false;
                  if (rule.restrictedNextShifts && rule.restrictedNextShifts.length > 0) {
                    if (rule.restrictedNextShifts.some(rTarget => matchesShiftTarget(tomorrowS, rTarget))) {
                      isViolated = true;
                    }
                  } else if (rule.allowedNextShifts && rule.allowedNextShifts.length > 0) {
                    if (!rule.allowedNextShifts.some(aTarget => matchesShiftTarget(tomorrowS, aTarget))) {
                      isViolated = true;
                    }
                  }

                  if (isViolated) {
                    errors.push({
                      date: nextDate,
                      shift: tomorrowS.colShift,
                      username,
                      reason: rule.description || `Cannot take ${tomorrowS.rowName || tomorrowS.colShift} after ${todayS.rowName || todayS.colShift}`,
                    });
                    errors.push({
                      date,
                      shift: todayS.colShift,
                      username,
                      reason: `Follow-up assignment ${tomorrowS.rowName || tomorrowS.colShift} next day violates shift transition policy`,
                    });
                  }
                });
              }
            });
          });
        });
      }
    } else {
      // Default Night Duty Constraint Logic (Fallback)
      if (index < weekDates.length - 1) {
        const nextDate = weekDates[index + 1];
        const userShiftsTomorrow = getUserShiftsForDate(nextDate);

        Object.entries(userShiftsToday).forEach(([username, todayMappings]) => {
          const todayNightShifts = todayMappings.filter(isNightDuty);

          if (todayNightShifts.length > 0) {
            const tomorrowMappings = userShiftsTomorrow[username] || [];
            const tomorrowRestrictedShifts = tomorrowMappings.filter(isRestrictedNextDayShift);

            if (tomorrowRestrictedShifts.length > 0) {
              todayNightShifts.forEach(todayS => {
                tomorrowRestrictedShifts.forEach(tomorrowS => {
                  errors.push({
                    date: nextDate,
                    shift: tomorrowS.colShift,
                    username,
                    reason: `Cannot take ${tomorrowS.rowName || tomorrowS.colShift} immediately after night duty (requires off-day or Shift 4)`,
                  });
                  errors.push({
                    date,
                    shift: todayS.colShift,
                    username,
                    reason: `Assigned to ${tomorrowS.rowName || tomorrowS.colShift} the next day without off-day / Shift 4`,
                  });
                });
              });
            }
          }
        });
      }
    }
  });

  // Default Prev Sunday Rule for Night Duty
  if ((!validationRules || validationRules.length === 0) && weekDates.length > 0) {
    const monday = weekDates[0];
    const prevSunday = dayjs(monday).subtract(1, 'day').format('YYYY-MM-DD');
    const prevSundayUserShifts = getUserShiftsForDate(prevSunday);

    Object.entries(prevSundayUserShifts).forEach(([username, sundayMappings]) => {
      const sundayNightShifts = sundayMappings.filter(isNightDuty);
      if (sundayNightShifts.length > 0) {
        const mondayMappings = getUserShiftsForDate(monday)[username] || [];
        const mondayRestrictedShifts = mondayMappings.filter(isRestrictedNextDayShift);

        mondayRestrictedShifts.forEach((mondayS) => {
          errors.push({
            date: monday,
            shift: mondayS.colShift,
            username,
            reason: `Cannot enter ${mondayS.rowName || mondayS.colShift} on Monday after being in night duty on Sunday of the previous week`,
          });
        });
      }
    });
  }

  return errors;
};
