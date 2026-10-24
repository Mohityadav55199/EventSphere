import nodemailer from "nodemailer";

/**
 * Configure Nodemailer Transport
 * Supports:
 * 1. Custom SMTP (Host, Port, User, Pass)
 * 2. Gmail / SendGrid / Mailgun via Service config
 * 3. Fallback: Ethereal / Dry-run test logger if no credentials configured
 */
let transporter = null;

async function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

  if (host && user && pass) {
    transporter = nodemailer.createTransport({
      host: host,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user, pass },
    });
    return transporter;
  }

  if (user && pass) {
    // Gmail or direct service
    transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || "gmail",
      auth: { user, pass },
    });
    return transporter;
  }

  // Fallback: create mock / ethereal test transporter for local development / testing
  try {
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log("📧 Ethereal mock email transporter initialized for EventSphere");
    return transporter;
  } catch (err) {
    console.warn("⚠️ Could not initialize Ethereal transporter:", err.message);
    return null;
  }
}

/**
 * Send Password Reset Email (link valid for 15 minutes)
 */
export async function sendPasswordResetEmail({ user, resetUrl }) {
  try {
    const mailer = await getTransporter();
    if (!mailer) {
      console.warn("⚠️ Email transporter not configured, skipping password reset email.");
      return;
    }
    const name = (user.name || "there").replace(/[<>&"]/g, "");
    await mailer.sendMail({
      from: `"EventSphere" <${process.env.EMAIL_FROM || "no-reply@eventsphere.com"}>`,
      to: user.email,
      subject: "Reset your EventSphere password",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
          <h2 style="color: #4f46e5;">Reset your password</h2>
          <p>Hi ${name},</p>
          <p>We received a request to reset your EventSphere password. This link is valid for 15 minutes.</p>
          <p><a href="${resetUrl}" style="display:inline-block;padding:12px 20px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;">Reset Password</a></p>
          <p style="font-size:12px;color:#64748b;">If you didn't request this, you can safely ignore this email.</p>
        </div>`,
    });
  } catch (err) {
    console.error("❌ Failed to send password reset email:", err.message);
  }
}

/**
 * Send Booking Confirmation Email with QR Code
 */
export async function sendTicketConfirmationEmail({ user, event, booking }) {
  try {
    const mailer = await getTransporter();
    if (!mailer) {
      console.warn("⚠️ Email transporter not configured, skipping email dispatch.");
      return;
    }

    const eventDateStr = event.eventDate 
      ? new Date(event.eventDate).toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : "Date Announced Soon";

    const seatsList = Array.isArray(booking.selectedSeats) 
      ? booking.selectedSeats.join(", ") 
      : `${booking.seatsBooked || 1} Seat(s)`;

    // Convert base64 dataURL QR code to Buffer for email inline CID attachment
    let qrAttachments = [];
    let qrImgSrc = "";

    if (booking.qrCode && booking.qrCode.startsWith("data:image")) {
      const base64Data = booking.qrCode.split(";base64,").pop();
      qrAttachments.push({
        filename: `ticket-qr-${booking._id}.png`,
        content: Buffer.from(base64Data, "base64"),
        cid: "ticket_qrcode_cid",
      });
      qrImgSrc = "cid:ticket_qrcode_cid";
    } else if (booking.qrCode) {
      qrImgSrc = booking.qrCode;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
          .header { background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 32px 24px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
          .header p { margin: 6px 0 0 0; font-size: 13px; opacity: 0.9; }
          .content { padding: 32px 28px; }
          .ticket-card { background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 16px; padding: 24px; margin-bottom: 24px; text-align: center; }
          .event-title { font-size: 20px; font-weight: 800; color: #0f172a; margin-bottom: 12px; }
          .info-table { width: 100%; border-collapse: collapse; margin-top: 16px; text-align: left; font-size: 13px; }
          .info-table td { padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
          .info-table td.label { color: #64748b; font-weight: 600; width: 40%; }
          .info-table td.value { color: #0f172a; font-weight: 700; text-align: right; }
          .qr-wrapper { margin: 20px auto 10px auto; display: inline-block; padding: 12px; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; }
          .qr-wrapper img { width: 180px; height: 180px; display: block; }
          .footer { text-align: center; font-size: 11px; color: #94a3b8; padding: 20px; border-top: 1px solid #f1f5f9; background: #f8fafc; }
          .badge { display: inline-block; padding: 4px 12px; background: #e0e7ff; color: #4338ca; border-radius: 999px; font-size: 11px; font-weight: 700; margin-top: 8px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Booking Confirmed 🎉</h1>
            <p>Your tickets for ${event.title} are ready!</p>
          </div>
          <div class="content">
            <p>Hello <b>${user.name || "Attendee"}</b>,</p>
            <p>Thank you for booking with EventSphere! Your seat reservation is confirmed. Present the QR code below at the venue entrance for gate check-in.</p>
            
            <div class="ticket-card">
              <div class="event-title">${event.title}</div>
              <span class="badge">Verified Admission Pass</span>

              ${qrImgSrc ? `
                <div class="qr-wrapper">
                  <img src="${qrImgSrc}" alt="Admission QR Code" />
                </div>
                <div style="font-size: 11px; color: #64748b; font-family: monospace;">Booking ID: ${booking._id}</div>
              ` : ''}

              <table class="info-table">
                <tr>
                  <td class="label">📅 Date & Time</td>
                  <td class="value">${eventDateStr} ${event.eventTime ? `at ${event.eventTime}` : ''}</td>
                </tr>
                <tr>
                  <td class="label">📍 Venue / Location</td>
                  <td class="value">${event.location || "Venue Announced on Event Page"}</td>
                </tr>
                <tr>
                  <td class="label">🎟️ Allocated Seats</td>
                  <td class="value" style="color: #4f46e5;">${seatsList}</td>
                </tr>
                <tr>
                  <td class="label">⭐ Ticket Tier</td>
                  <td class="value">${booking.ticketTier || "Standard Pass"}</td>
                </tr>
                <tr>
                  <td class="label">💰 Total Paid</td>
                  <td class="value">₹${booking.amountPaid ?? 0}</td>
                </tr>
              </table>
            </div>

            <p style="font-size: 12px; color: #64748b; line-height: 1.5;">
              💡 <b>Tip:</b> You can also download your official PDF ticket anytime by visiting your <a href="${process.env.CLIENT_URL || "http://localhost:5173"}/profile" style="color: #4f46e5; font-weight: 600;">EventSphere Profile</a>.
            </p>
          </div>
          <div class="footer">
            EventSphere &bull; High-Concurrency Live Ticketing & Communities &bull; Support: support@eventsphere.com
          </div>
        </div>
      </body>
      </html>
    `;

    const info = await mailer.sendMail({
      from: `"EventSphere Tickets" <${process.env.EMAIL_FROM || "no-reply@eventsphere.com"}>`,
      to: user.email,
      subject: `🎟️ Your Tickets for ${event.title} - Booking Confirmed!`,
      html: htmlContent,
      attachments: qrAttachments,
    });

    console.log(`✅ Ticket confirmation email dispatched to ${user.email} (Message ID: ${info.messageId})`);
    if (nodemailer.getTestMessageUrl && nodemailer.getTestMessageUrl(info)) {
      console.log(`🔗 Preview Email: ${nodemailer.getTestMessageUrl(info)}`);
    }
  } catch (err) {
    console.error("❌ Failed to send booking confirmation email:", err.message);
  }
}
