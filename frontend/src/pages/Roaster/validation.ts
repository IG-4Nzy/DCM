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
    const normAct = normStr(m.actualShift);
    const normRow = normStr(m.rowName);

    // 1. Exact match with row name (e.g., "Shift 3 Row 2") or exact mapped shift (e.g., "Shift-4")
    if (normT === normRow || normT === normAct) return true;

    // 2. If target specifies a row (e.g. "Shift 3 Row 2"), it must match row name
    if (normT.includes('row')) {
      return normT === normRow;
    }

    // 3. Compare shift numbers (e.g., target "Shift 3" or "Shift-3" vs actual shift "Shift-4")
    const targetDigits = (target.match(/\d+/) || [])[0];
    const actDigits = ((m.actualShift || '').match(/\d+/) || [])[0];

    if (targetDigits && actDigits) {
      return targetDigits === actDigits;
    }

    // 4. Non-numeric shift name matching (e.g. "Leave")
    if (normAct && normAct.includes(normT)) return true;
    if (normT && normT.includes(normAct)) return true;

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
          { name: `${colShift.replace('-', ' ')} Row 2`, mappedShift: colShift === 'Shift-3' ? 'Shift-4' : colShift }
        ];
      }

      colRows.forEach((row, rIdx) => {
        const rawUsername = assignees[rIdx];
        if (rawUsername) {
          const parts = rawUsername.split(',').map(p => p.trim()).filter(Boolean);
          parts.forEach((username) => {
            let actualShift = row.mappedShift?.replace(/\s+/g, '-');
            if (!actualShift || actualShift === 'None') {
              actualShift = (colShift === 'Shift-3' && rIdx === 1) ? 'Shift-4' : colShift;
            } else if (colShift === 'Shift-3' && rIdx === 1 && (actualShift === 'Shift-3' || actualShift === 'Shift3')) {
              // Default second row of Shift 3 is Shift 4
              actualShift = 'Shift-4';
            }
            if (!userShifts[username]) {
              userShifts[username] = [];
            }
            userShifts[username].push({ actualShift, colShift, rowName: row.name, rIdx });
          });
        }
      });
    });

    // Also include Leave column assignees
    const leaveAssignees = rosterData[`${date}_Leave`]?.assignees || [];
    leaveAssignees.forEach((rawUsername) => {
      if (rawUsername) {
        const parts = rawUsername.split(',').map(p => p.trim()).filter(Boolean);
        parts.forEach((username) => {
          if (!userShifts[username]) {
            userShifts[username] = [];
          }
          userShifts[username].push({
            actualShift: 'Leave',
            colShift: 'Leave',
            rowName: 'Leave',
            rIdx: 0
          });
        });
      }
    });

    return userShifts;
  };

  const isNightDuty = (m: UserShiftMapping) => {
    const normActual = (m.actualShift || '').toLowerCase();
    const normRow = (m.rowName || '').toLowerCase();
    if (normActual.includes('4') || normRow.includes('shift 4') || normRow.includes('row 2') || m.rIdx === 1) {
      return false;
    }
    return (
      normActual.includes('3') ||
      normActual.includes('night') ||
      normRow.includes('shift 3') ||
      m.colShift === 'Shift-3'
    );
  };

  const isRestrictedNextDayShift = (m: UserShiftMapping) => {
    const normActual = (m.actualShift || '').toLowerCase();
    const normRow = (m.rowName || '').toLowerCase();
    if (m.rIdx === 1 || normActual.includes('4') || normRow.includes('shift 4') || normRow.includes('row 2')) {
      return false;
    }
    if (m.colShift === 'Shift-1' || m.colShift === 'Shift-2' || m.colShift === 'Shift-3') {
      return true;
    }
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

  // Unified Prev Sunday Rule (supports both dynamic validationRules and default Night Duty constraint)
  if (weekDates.length > 0) {
    const monday = weekDates[0];
    const prevSunday = dayjs(monday).subtract(1, 'day').format('YYYY-MM-DD');
    const prevSundayUserShifts = getUserShiftsForDate(prevSunday);
    const userShiftsMonday = getUserShiftsForDate(monday);

    Object.entries(prevSundayUserShifts).forEach(([username, sundayMappings]) => {
      const mondayMappings = userShiftsMonday[username] || [];
      if (mondayMappings.length === 0) return;

      sundayMappings.forEach(sundayS => {
        if (validationRules && validationRules.length > 0) {
          validationRules.forEach(rule => {
            if (matchesShiftTarget(sundayS, rule.fromShift)) {
              mondayMappings.forEach(mondayS => {
                let isViolated = false;
                if (rule.restrictedNextShifts && rule.restrictedNextShifts.length > 0) {
                  if (rule.restrictedNextShifts.some(rTarget => matchesShiftTarget(mondayS, rTarget))) {
                    isViolated = true;
                  }
                } else if (rule.allowedNextShifts && rule.allowedNextShifts.length > 0) {
                  if (!rule.allowedNextShifts.some(aTarget => matchesShiftTarget(mondayS, aTarget))) {
                    isViolated = true;
                  }
                }

                if (isViolated) {
                  errors.push({
                    date: monday,
                    shift: mondayS.colShift,
                    username,
                    reason: rule.description || `Cannot take ${mondayS.rowName || mondayS.colShift} on Monday after ${sundayS.rowName || sundayS.colShift} on Sunday`,
                  });
                }
              });
            }
          });
        } else {
          // Default Night Duty Constraint Logic (Fallback)
          const sundayNightShifts = sundayMappings.filter(isNightDuty);
          if (sundayNightShifts.length > 0) {
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
        }
      });
    });
  }

  return errors;
};
