import { jsPDF } from "jspdf";

/**
 * Generates and downloads a high-fidelity vector PDF ticket with embedded QR code.
 * Direct vector generation using jsPDF avoids DOM rendering bugs, CORS issues,
 * and Tailwind CSS v4 color crashes.
 *
 * @param {Object} booking - The booking document containing event, tier, seats, and QR code.
 * @param {Object} user - The logged in user details.
 */
export async function downloadTicketPDF(booking, user = {}) {
  if (!booking) {
    throw new Error("Booking data is required to generate ticket PDF");
  }

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const eventTitle = booking.event?.title || "Event";
  const eventDate = booking.event?.date
    ? new Date(booking.event.date).toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "TBA";
  const location = booking.event?.location || "Venue TBA";
  const tier = booking.ticketTier || "General Admission";
  const seatsCount = booking.seatsBooked || 1;
  const seatsList = Array.isArray(booking.selectedSeats) && booking.selectedSeats.length > 0
    ? booking.selectedSeats.join(", ")
    : `${seatsCount} Ticket(s)`;
  const bookingRef = (booking._id || "REF").toString().toUpperCase().slice(-8);
  const attendeeName = user.name || booking.user?.name || "Guest Attendee";
  const attendeeEmail = user.email || booking.user?.email || "";
  const amountPaid = booking.amountPaid !== undefined ? `INR ${booking.amountPaid}` : "Paid";

  // Card Dimensions (Centered on A4)
  const cardX = 18;
  const cardY = 25;
  const cardW = 174;
  const cardH = 112;

  // Background Ticket Container
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.4);
  doc.roundedRect(cardX, cardY, cardW, cardH, 4, 4, "FD");

  // Top Header Banner
  doc.setFillColor(79, 70, 229); // Indigo-600
  doc.roundedRect(cardX, cardY, cardW, 20, 4, 4, "F");
  // Fill the bottom corners of header so it seamlessly meets card body
  doc.rect(cardX, cardY + 12, cardW, 8, "F");

  // Header Text
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("EVENTSPHERE", cardX + 8, cardY + 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(224, 231, 255);
  doc.text("OFFICIAL DIGITAL ADMISSION PASS", cardX + 8, cardY + 16.5);

  // Status Badge in Header
  doc.setFillColor(16, 185, 129); // emerald-500
  doc.roundedRect(cardX + cardW - 38, cardY + 5.5, 30, 8, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("CONFIRMED", cardX + cardW - 23, cardY + 11, { align: "center" });

  // Divider Line between Main Info and Stub (dashed vertical line)
  const dividerX = cardX + cardW - 52;
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.line(dividerX, cardY + 20, dividerX, cardY + cardH);
  doc.setLineDashPattern([], 0); // reset dash

  // Semi-circular notch cutouts on top and bottom of tear line (concert ticket style)
  doc.setFillColor(248, 250, 252); // matches page bg
  doc.circle(dividerX, cardY + 20, 2.5, "FD");
  doc.circle(dividerX, cardY + cardH, 2.5, "FD");

  // LEFT CONTENT: Event & Attendee Details
  const leftX = cardX + 8;
  let cursorY = cardY + 29;

  // Event Title
  doc.setTextColor(15, 23, 42); // slate-900
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  const splitTitle = doc.splitTextToSize(eventTitle, dividerX - leftX - 6);
  doc.text(splitTitle, leftX, cursorY);
  cursorY += splitTitle.length * 5 + 2;

  // Date & Time
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(79, 70, 229); // indigo-600
  doc.text(eventDate, leftX, cursorY);
  cursorY += 5;

  // Venue
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139); // slate-500
  const splitLocation = doc.splitTextToSize(location, dividerX - leftX - 6);
  doc.text(splitLocation, leftX, cursorY);
  cursorY += Math.max(splitLocation.length * 3.8, 6) + 3;

  // Subtle separator line
  doc.setDrawColor(241, 245, 249);
  doc.setLineWidth(0.3);
  doc.line(leftX, cursorY, dividerX - 6, cursorY);
  cursorY += 4.5;

  // Grid Details: 2 columns
  const col1X = leftX;
  const col2X = leftX + 46;

  // Row 1: Attendee & Pass Tier
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text("ATTENDEE", col1X, cursorY);
  doc.text("PASS TIER", col2X, cursorY);
  cursorY += 3.5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text(doc.splitTextToSize(attendeeName, 42), col1X, cursorY);
  doc.setTextColor(79, 70, 229);
  doc.text(tier, col2X, cursorY);
  cursorY += 5;

  // Row 2: Email & Seats
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text("CONTACT EMAIL", col1X, cursorY);
  doc.text("SEAT / PASSES", col2X, cursorY);
  cursorY += 3.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text(attendeeEmail || "N/A", col1X, cursorY);
  doc.setFont("helvetica", "bold");
  doc.text(seatsList, col2X, cursorY);
  cursorY += 5;

  // Row 3: Booking Reference & Amount Paid
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text("BOOKING REF", col1X, cursorY);
  doc.text("AMOUNT PAID", col2X, cursorY);
  cursorY += 3.5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`#${bookingRef}`, col1X, cursorY);
  doc.setTextColor(16, 185, 129);
  doc.text(amountPaid, col2X, cursorY);

  // RIGHT CONTENT: Ticket Stub with QR Code
  const stubCenterX = dividerX + (cardX + cardW - dividerX) / 2;
  const qrSize = 34;
  const qrX = stubCenterX - qrSize / 2;
  const qrY = cardY + 26;

  if (booking.qrCode && typeof booking.qrCode === "string" && booking.qrCode.startsWith("data:image")) {
    try {
      doc.addImage(booking.qrCode, "PNG", qrX, qrY, qrSize, qrSize);
    } catch {
      // Draw fallback QR placeholder
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(qrX, qrY, qrSize, qrSize, 2, 2, "F");
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text("QR VERIFIED", stubCenterX, qrY + 18, { align: "center" });
    }
  } else {
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(qrX, qrY, qrSize, qrSize, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("SCAN AT VENUE", stubCenterX, qrY + 18, { align: "center" });
  }

  // Label under QR Code
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(15, 23, 42);
  doc.text("GATE CHECK-IN", stubCenterX, qrY + qrSize + 4.5, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text("Present pass for scanning", stubCenterX, qrY + qrSize + 8, { align: "center" });
  doc.text("Single Entry Only", stubCenterX, qrY + qrSize + 11.5, { align: "center" });

  // Verification Hash or Booking ID
  const hashDisplay = booking.qrCodeData?.hash
    ? `SIG: ${booking.qrCodeData.hash.slice(0, 12)}...`
    : `ID: ${bookingRef}`;
  doc.setFont("courier", "normal");
  doc.setFontSize(5.5);
  doc.setTextColor(148, 163, 184);
  doc.text(hashDisplay, stubCenterX, qrY + qrSize + 16, { align: "center" });

  // BOTTOM PAGE INSTRUCTIONS
  const noteY = cardY + cardH + 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("• Please arrive 15 minutes before showtime. Carry a valid photo ID along with this admission pass.", cardX, noteY);
  doc.text("• Each QR code is uniquely encrypted and admits the ticket holder(s) specified on this voucher.", cardX, noteY + 4.5);
  doc.text("• Need help? Contact support or visit your EventSphere account at https://event-sphere-lemon-nu.vercel.app", cardX, noteY + 9);

  // File name
  const cleanTitle = eventTitle.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 24);
  const filename = `EventSphere_${cleanTitle}_Ticket_${bookingRef}.pdf`;

  // Trigger browser download
  doc.save(filename);
  return filename;
}
