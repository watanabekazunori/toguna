/**
 * Email Sending Service
 * Supports multiple providers: Resend, SendGrid, SMTP, and Mock
 */

export type EmailProvider = 'resend' | 'sendgrid' | 'smtp' | 'mock';

export interface EmailConfig {
  provider: EmailProvider;
  apiKey?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  fromEmail: string;
  fromName: string;
}

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType: string;
  }>;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface AppointmentNotification {
  companyName: string;
  scheduledAt: string;
  meetingType: string;
  salesRepEmail: string;
  notes?: string;
}

interface DocumentEmailParams {
  to: string;
  companyName: string;
  subject: string;
  body: string;
  documentUrl?: string;
}

/**
 * Get email configuration from environment variables
 */
function getEmailConfig(): EmailConfig {
  const provider = (process.env.EMAIL_PROVIDER || 'mock') as EmailProvider;

  return {
    provider,
    apiKey:
      process.env.RESEND_API_KEY ||
      process.env.SENDGRID_API_KEY ||
      undefined,
    smtpHost: process.env.SMTP_HOST,
    smtpPort: process.env.SMTP_PORT
      ? parseInt(process.env.SMTP_PORT)
      : undefined,
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
    fromEmail: process.env.EMAIL_FROM || 'noreply@toguna.jp',
    fromName: process.env.EMAIL_FROM_NAME || 'Toguna',
  };
}

/**
 * Send email using Resend provider
 */
async function sendViaResend(
  config: EmailConfig,
  params: SendEmailParams
): Promise<EmailResult> {
  if (!config.apiKey) {
    return {
      success: false,
      error: 'RESEND_API_KEY is not configured',
    };
  }

  try {
    const toAddresses = Array.isArray(params.to) ? params.to : [params.to];

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${config.fromName} <${config.fromEmail}>`,
        to: toAddresses,
        subject: params.subject,
        html: params.html,
        text: params.text,
        cc: params.cc,
        bcc: params.bcc,
        reply_to: params.replyTo,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return {
        success: false,
        error: `Resend API error: ${JSON.stringify(error)}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      messageId: data.id,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to send via Resend: ${String(error)}`,
    };
  }
}

/**
 * Send email using SendGrid provider
 */
async function sendViaSendGrid(
  config: EmailConfig,
  params: SendEmailParams
): Promise<EmailResult> {
  if (!config.apiKey) {
    return {
      success: false,
      error: 'SENDGRID_API_KEY is not configured',
    };
  }

  try {
    const toAddresses = Array.isArray(params.to) ? params.to : [params.to];

    const sendGridParams = {
      personalizations: [
        {
          to: toAddresses.map((email) => ({ email })),
          cc: params.cc?.map((email) => ({ email })),
          bcc: params.bcc?.map((email) => ({ email })),
        },
      ],
      from: {
        email: config.fromEmail,
        name: config.fromName,
      },
      subject: params.subject,
      content: [
        {
          type: 'text/html',
          value: params.html,
        },
      ],
      reply_to: params.replyTo
        ? { email: params.replyTo }
        : undefined,
    };

    // Remove undefined fields
    if (!sendGridParams.personalizations[0].cc)
      delete sendGridParams.personalizations[0].cc;
    if (!sendGridParams.personalizations[0].bcc)
      delete sendGridParams.personalizations[0].bcc;
    if (!sendGridParams.reply_to) delete sendGridParams.reply_to;

    const response = await fetch(
      'https://api.sendgrid.com/v3/mail/send',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sendGridParams),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return {
        success: false,
        error: `SendGrid API error: ${JSON.stringify(error)}`,
      };
    }

    // SendGrid returns 202 with no body on success
    return {
      success: true,
      messageId: `sendgrid-${Date.now()}`,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to send via SendGrid: ${String(error)}`,
    };
  }
}

/**
 * Send email using SMTP provider
 */
async function sendViaSMTP(
  config: EmailConfig,
  params: SendEmailParams
): Promise<EmailResult> {
  // Note: Node.js SMTP would require a library like nodemailer
  // For now, return not implemented
  console.warn(
    'SMTP provider requires nodemailer installation. Using mock instead.'
  );
  return {
    success: false,
    error: 'SMTP provider requires nodemailer package to be installed',
  };
}

/**
 * Send email using mock provider (logs to console)
 */
async function sendViaMock(
  _config: EmailConfig,
  params: SendEmailParams
): Promise<EmailResult> {
  const toAddresses = Array.isArray(params.to)
    ? params.to.join(', ')
    : params.to;

  console.log('=== Mock Email Sent ===');
  console.log(`To: ${toAddresses}`);
  if (params.cc) console.log(`CC: ${params.cc.join(', ')}`);
  if (params.bcc) console.log(`BCC: ${params.bcc.join(', ')}`);
  console.log(`Subject: ${params.subject}`);
  console.log(`---`);
  console.log(params.html);
  console.log('=======================');

  return {
    success: true,
    messageId: `mock-${Date.now()}`,
  };
}

/**
 * Main send email function
 */
export async function sendEmail(
  params: SendEmailParams
): Promise<EmailResult> {
  const config = getEmailConfig();

  // Validate required fields
  if (!params.subject || !params.html) {
    return {
      success: false,
      error: 'Subject and HTML content are required',
    };
  }

  switch (config.provider) {
    case 'resend':
      return sendViaResend(config, params);
    case 'sendgrid':
      return sendViaSendGrid(config, params);
    case 'smtp':
      return sendViaSMTP(config, params);
    case 'mock':
    default:
      return sendViaMock(config, params);
  }
}

/**
 * Send template-based email
 */
export async function sendTemplateEmail(params: {
  to: string;
  templateId: string;
  variables: Record<string, string>;
}): Promise<EmailResult> {
  // Build HTML from template and variables
  const htmlTemplates: Record<string, string> = {
    appointment_confirmation: `
      <h2>予約確認</h2>
      <p>お客様へ</p>
      <p>下記の通り、打ち合わせのご予約をさせていただきました。</p>
      <ul>
        <li>会社名: {{companyName}}</li>
        <li>日時: {{scheduledAt}}</li>
        <li>内容: {{meetingType}}</li>
      </ul>
      <p>ご不明な点はお気軽にお問い合わせください。</p>
    `,
    document_share: `
      <h2>資料のお送り</h2>
      <p>{{companyName}} 様へ</p>
      <p>{{subject}}</p>
      <p>{{body}}</p>
      {{#documentUrl}}
        <p><a href="{{documentUrl}}">資料をダウンロード</a></p>
      {{/documentUrl}}
    `,
  };

  const template = htmlTemplates[params.templateId] || '';
  let html = template;

  // Simple template variable replacement
  Object.entries(params.variables).forEach(([key, value]) => {
    html = html.replace(new RegExp(`{{${key}}}`, 'g'), value);
  });

  // Remove unused template variables
  html = html.replace(/{{#[^}]+}}[\s\S]*?{{\/[^}]+}}/g, '');

  return sendEmail({
    to: params.to,
    subject: `Email from Toguna`,
    html,
  });
}

/**
 * Send appointment notification email
 */
export async function sendAppointmentNotification(
  appointment: AppointmentNotification
): Promise<EmailResult> {
  const htmlContent = `
    <h2>新規予約確認</h2>
    <p>営業担当者様へ</p>
    <p>新しい打ち合わせが予約されました。</p>
    <ul>
      <li><strong>会社名:</strong> ${appointment.companyName}</li>
      <li><strong>日時:</strong> ${appointment.scheduledAt}</li>
      <li><strong>種類:</strong> ${appointment.meetingType}</li>
      ${appointment.notes ? `<li><strong>備考:</strong> ${appointment.notes}</li>` : ''}
    </ul>
    <p>予約内容をご確認の上、必要な準備をお願いいたします。</p>
  `;

  return sendEmail({
    to: appointment.salesRepEmail,
    subject: `新規予約: ${appointment.companyName} - ${appointment.scheduledAt}`,
    html: htmlContent,
  });
}

/**
 * Send document email
 */
export async function sendDocumentEmail(
  params: DocumentEmailParams
): Promise<EmailResult> {
  const htmlContent = `
    <h2>${params.subject}</h2>
    <p>${params.companyName} 様へ</p>
    <p>${params.body}</p>
    ${
      params.documentUrl
        ? `<p><a href="${params.documentUrl}" style="display: inline-block; padding: 10px 20px; background-color: #0066cc; color: white; text-decoration: none; border-radius: 4px;">資料をダウンロード</a></p>`
        : ''
    }
    <hr />
    <p style="color: #666; font-size: 12px;">このメールはシステムから自動送信されています。</p>
  `;

  return sendEmail({
    to: params.to,
    subject: params.subject,
    html: htmlContent,
  });
}
