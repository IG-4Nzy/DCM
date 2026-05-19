import { validateRoster } from './validation';

const roster = {
  '2026-05-18_Shift-1': { assignees: ['user1', 'user2'] },
  '2026-05-18_Shift-2': { assignees: ['user1'] },
  '2026-05-18_Shift-3': { assignees: ['user3'] },
  '2026-05-19_Shift-1': { assignees: ['user3'] }
};

const dates = ['2026-05-18', '2026-05-19'];
console.log(validateRoster(roster, dates));
