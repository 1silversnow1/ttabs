// What the sync decides, with no browser API in sight.

import { colorFor } from './statuses.js';
import { isOurTitle, titleFor } from './titles.js';

// Returns the group updates to apply and the titles map to store in their
// place. The map is rebuilt from the groups that still exist, which is also
// what keeps it from growing forever as tasks come and go.
//
// With `colorByStatus` the colour follows the status too, under the same
// ownership rule as the title: a group the user renamed keeps its colour.
// Without it the colour stays whatever `task-color` gave the group.
export const planUpdates = (tracked, statuses, written, { colorByStatus = false } = {}) => {
  const updates = [];
  const titles = {};

  for (const { group, key } of tracked) {
    const remembered = written[key];
    if (remembered) titles[key] = remembered;

    const status = statuses[key];
    if (!status) continue;

    const current = group.title ?? '';
    if (!isOurTitle(current, key, remembered)) continue;

    const title = titleFor(key, status);
    titles[key] = title;

    const update = { groupId: group.id, title };
    if (colorByStatus) update.color = colorFor(status);
    if (title !== current || (update.color && update.color !== group.color)) updates.push(update);
  }

  return { updates, titles };
};
