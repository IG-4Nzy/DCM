const rosterData = {
  '2026-05-18_Shift-1': { assignees: ['user1', 'user2'] },
  '2026-05-18_Shift-2': { assignees: ['user1'] },
  '2026-05-18_Shift-3': { assignees: ['user3'] },
  '2026-05-19_Shift-1': { assignees: ['user3'] }
};

const weekDates = ['2026-05-18', '2026-05-19'];
const errors = [];

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
      if (shift1.includes(username)) errors.push({ date, shift: "Shift-1", username });
      if (shift2.includes(username)) errors.push({ date, shift: "Shift-2", username });
      if (shift3.includes(username)) errors.push({ date, shift: "Shift-3", username });
    });

    // Rule 2: Person in shift 3 cannot be in shift 1 or 2 the next day
    if (index < weekDates.length - 1) {
      const nextDate = weekDates[index + 1];
      const nextShift1 = rosterData[`${nextDate}_Shift-1`]?.assignees || [];
      const nextShift2 = rosterData[`${nextDate}_Shift-2`]?.assignees || [];

      shift3.forEach((username) => {
        if (nextShift1.includes(username)) {
          errors.push({ date: nextDate, shift: "Shift-1", username });
          errors.push({ date, shift: "Shift-3", username });
        }
        if (nextShift2.includes(username)) {
          errors.push({ date: nextDate, shift: "Shift-2", username });
          errors.push({ date, shift: "Shift-3", username });
        }
      });
    }
});

console.log(errors);
