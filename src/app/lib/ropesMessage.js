//ropesSms.js

export function buildNotifyMessage({ entry, estStartText }) {
  return `Hi there! You're up next for the ropes course.
Please check in with the front desk!

Estimated start: ${estStartText}

* Please check in at the front desk within 5 minutes to keep your spot.

If you need more time, please call this number to adjust your start time.
`;
}
