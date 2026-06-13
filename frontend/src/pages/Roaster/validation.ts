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

export const validateRoster = (
  rosterData: Record<string, { assignees: string[] }>,
  weekDates: string[],
  rows: RosterRow[] = []
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
  }

  // Helper to map all assignees on a date to their actual shifts and source columns
  const getUserShiftsForDate = (date: string): Record<string, UserShiftMapping[]> => {
    const userShifts: Record<string, UserShiftMapping[]> = {};
    const rosterColumns = ['Shift-1', 'Shift-2', 'Shift-3'];

    rosterColumns.forEach((colShift) => {
      const assignees = rosterData[`${date}_${colShift}`]?.assignees || [];
      const colRows = [
        activeRows.find(r => r.name === `${colShift.replace('-', ' ')} Row 1`) || { name: `${colShift.replace('-', ' ')} Row 1`, mappedShift: colShift },
        activeRows.find(r => r.name === `${colShift.replace('-', ' ')} Row 2`) || { name: `${colShift.replace('-', ' ')} Row 2`, mappedShift: colShift }
      ];

      colRows.forEach((row, rIdx) => {
        const username = assignees[rIdx];
        if (username) {
          const actualShift = row.mappedShift?.replace(/\s+/g, '-') || colShift;
          if (!userShifts[username]) {
            userShifts[username] = [];
          }
          userShifts[username].push({ actualShift, colShift });
        }
      });
    });

    return userShifts;
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

    // Rule 2: Person in shift 3 (or night shift) cannot be in shift 1 or 2 the next day
    if (index < weekDates.length - 1) {
      const nextDate = weekDates[index + 1];
      const userShiftsTomorrow = getUserShiftsForDate(nextDate);

      Object.entries(userShiftsToday).forEach(([username, todayMappings]) => {
        const todayNightShifts = todayMappings.filter(
          m => m.actualShift.includes("3") || m.actualShift.toLowerCase().includes("night")
        );

        if (todayNightShifts.length > 0) {
          const tomorrowMappings = userShiftsTomorrow[username] || [];
          const tomorrowRestrictedShifts = tomorrowMappings.filter(
            m => m.actualShift.includes("1") || m.actualShift.includes("2") || m.actualShift.toLowerCase().includes("morning") || m.actualShift.toLowerCase().includes("afternoon")
          );

          if (tomorrowRestrictedShifts.length > 0) {
            todayNightShifts.forEach(todayS => {
              tomorrowRestrictedShifts.forEach(tomorrowS => {
                errors.push({
                  date: nextDate,
                  shift: tomorrowS.colShift,
                  username,
                  reason: `Cannot take ${tomorrowS.actualShift} immediately after a ${todayS.actualShift} (requires off-day)`,
                });
                errors.push({
                  date,
                  shift: todayS.colShift,
                  username,
                  reason: `Assigned to ${tomorrowS.actualShift} the next day without an off-day`,
                });
              });
            });
          }
        }
      });
    }
  });

  // Rule 3: Those who were in Shift 4 (UI Shift-3) on Sunday of the previous week cannot enter Shift 1, 2, and 3 (UI Shift-1, Shift-2, Shift-3) on Monday.
  if (weekDates.length > 0) {
    const monday = weekDates[0];
    const prevSunday = dayjs(monday).subtract(1, 'day').format('YYYY-MM-DD');
    const prevSundayShift3Assignees = rosterData[`${prevSunday}_Shift-3`]?.assignees || [];

    prevSundayShift3Assignees.forEach((username) => {
      if (username) {
        ['Shift-1', 'Shift-2', 'Shift-3'].forEach((colShift) => {
          const mondayAssignees = rosterData[`${monday}_${colShift}`]?.assignees || [];
          if (mondayAssignees.includes(username)) {
            errors.push({
              date: monday,
              shift: colShift,
              username,
              reason: `Cannot enter ${colShift.replace('-', ' ')} on Monday after being in Shift 4 (Shift-3 Row 1/2) on Sunday of the previous week`,
            });
          }
        });
      }
    });
  }

  return errors;
};
