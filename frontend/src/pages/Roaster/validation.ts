export interface ValidationError {
  date: string;
  shift: string;
  username: string;
  reason: string;
}

export const validateRoster = (
  rosterData: Record<string, { assignees: string[] }>,
  weekDates: string[]
): ValidationError[] => {
  const errors: ValidationError[] = [];

  weekDates.forEach((date, index) => {
    const shift1 = rosterData[`${date}_Shift-1`]?.assignees || [];
    const shift2 = rosterData[`${date}_Shift-2`]?.assignees || [];
    const shift3 = rosterData[`${date}_Shift-3`]?.assignees || [];

    // Rule 1: A person cannot be in 2 shifts a day
    const allAssignees = [...shift1, ...shift2, ...shift3];
    const duplicates = allAssignees.filter(
      (item, idx) => allAssignees.indexOf(item) !== idx
    );
    const uniqueDuplicates = Array.from(new Set(duplicates));

    uniqueDuplicates.forEach((username) => {
      if (shift1.includes(username)) {
        errors.push({
          date,
          shift: "Shift-1",
          username,
          reason: "Cannot be in multiple shifts on the same day",
        });
      }
      if (shift2.includes(username)) {
        errors.push({
          date,
          shift: "Shift-2",
          username,
          reason: "Cannot be in multiple shifts on the same day",
        });
      }
      if (shift3.includes(username)) {
        errors.push({
          date,
          shift: "Shift-3",
          username,
          reason: "Cannot be in multiple shifts on the same day",
        });
      }
    });

    // Rule 2: Person in shift 3 cannot be in shift 1 or 2 the next day
    if (index < weekDates.length - 1) {
      const nextDate = weekDates[index + 1];
      const nextShift1 = rosterData[`${nextDate}_Shift-1`]?.assignees || [];
      const nextShift2 = rosterData[`${nextDate}_Shift-2`]?.assignees || [];

      shift3.forEach((username) => {
        if (nextShift1.includes(username)) {
          errors.push({
            date: nextDate,
            shift: "Shift-1",
            username,
            reason: "Cannot take Shift 1 immediately after a Shift 3 (requires off-day)",
          });
          errors.push({
            date,
            shift: "Shift-3",
            username,
            reason: "Assigned to Shift 1 the next day without an off-day",
          });
        }
        if (nextShift2.includes(username)) {
          errors.push({
            date: nextDate,
            shift: "Shift-2",
            username,
            reason: "Cannot take Shift 2 immediately after a Shift 3 (requires off-day)",
          });
          errors.push({
            date,
            shift: "Shift-3",
            username,
            reason: "Assigned to Shift 2 the next day without an off-day",
          });
        }
      });
    }
  });

  return errors;
};
