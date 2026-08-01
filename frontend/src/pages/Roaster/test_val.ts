// @ts-nocheck
import { validateRoster } from './validation';

const rosterShift3Today = {
  '2026-05-18_Shift-3': { assignees: ['user3', ''] },
  '2026-05-19_Shift-3': { assignees: ['user3', ''] }
};

const rosterShift4Today = {
  '2026-05-18_Shift-3': { assignees: ['user3', ''] },
  '2026-05-19_Shift-3': { assignees: ['', 'user3'] }
};

const dates = ['2026-05-18', '2026-05-19'];
validateRoster(rosterShift3Today, dates);
validateRoster(rosterShift4Today, dates);

