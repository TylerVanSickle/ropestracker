//ropesSms.js

export function buildNotifyMessage({ entry, estStartText }) {
  return `Hi there! You're up next for the ropes course.
Please check in with the front desk!

Estimated start: ${estStartText}

* Please check in at the front within 5 minutes, or your spot will go to the next in line.
`;
}
