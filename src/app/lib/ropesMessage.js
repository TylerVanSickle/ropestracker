//ropesSms.js

export function buildNotifyMessage({ entry, estStartText }) {
  return `Hi there! You're up next for the ropes course.
Please check in with the front desk!

Estimated start: ${estStartText}
* If you do not check in with the front desk within 5 miuntes, your time will be forfeited to the next group in line.`;
}
