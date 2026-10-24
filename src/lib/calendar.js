// Builds an "Add to Google Calendar" link. Google expects UTC timestamps like 20301201T100000Z.
const toGoogleDate = (date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function googleCalendarUrl({ title, date, location, description, durationHours = 2 }) {
  const start = new Date(date);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title || "EventSphere event",
    dates: `${toGoogleDate(start)}/${toGoogleDate(end)}`,
    location: location || "",
    details: description || "Booked on EventSphere",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
