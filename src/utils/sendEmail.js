import { Resend } from "resend";
import dotenv from "dotenv";
dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendShareEmail = async ({ to, link, password, expiryDays }) => {
  const isPrivate = !!password;

  const { data, error } = await resend.emails.send({
    from: "Secure Drive <onboarding@resend.dev>",
    subject: "Secure Drive - Files have been shared with you",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: auto; padding: 24px;">
        
        <h2 style="margin-bottom: 8px;">📁 Files Shared With You</h2>
        
        <p style="color: #555;">
          Someone shared files with you on Secure Drive.
        </p>

        <a 
          href="${link}" 
          style="display:inline-block; margin-top:16px; padding:10px 24px; background:#000; color:#fff; border-radius:8px; text-decoration:none; font-weight:600;"
        >
          Open Files
        </a>

        ${
          isPrivate
            ? `
          <div style="margin-top:20px; padding:12px 16px; background:#f4f4f4; border-radius:8px;">
            <p style="margin:0; font-size:13px; color:#333;">
              <strong>Password:</strong> 
              <code style="background:#e0e0e0; padding:2px 6px; border-radius:4px;">${password}</code>
            </p>
          </div>`
            : ""
        }

        <p style="margin-top:24px; font-size:12px; color:#999;">
          ⏳ This link expires in ${expiryDays ?? 7} days.
        </p>

      </div>
    `,
  });

  if (error) {
    console.error("Resend email error:", error);
    throw new Error(error.message);
  }

  return data;
};
