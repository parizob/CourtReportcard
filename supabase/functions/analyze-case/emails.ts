/** User-facing analysis failure / success email HTML for analyze-case. */

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** True when Gemini blocked the request under its content filter (retrying will not help). */
export function isProhibitedContentError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '')
  return /PROHIBITED_CONTENT|blockReason\s*=\s*PROHIBITED/i.test(msg)
}

export type FailureEmailKind = 'transient' | 'repeat' | 'prohibited'

export function failureEmailKind(err: unknown, repeatFailure: boolean): FailureEmailKind {
  if (isProhibitedContentError(err)) return 'prohibited'
  if (repeatFailure) return 'repeat'
  return 'transient'
}

export function failureEmailHtml(
  caseName: string,
  refunded: number,
  kind: FailureEmailKind = 'transient',
  siteUrl = 'https://courtreportcard.com',
): string {
  const supportUrl = `${siteUrl}/support`
  const safeName = escapeHtml(caseName)
  let nextStep: string
  if (kind === 'prohibited') {
    nextStep =
      `This wasn't a temporary glitch. Our review system blocked this file under its content rules ` +
      `(that can happen with some court transcripts even when the content is fine for filing). ` +
      `Uploading the same file again won't help. Email us at ` +
      `<a href="mailto:support@courtreportcard.com" style="color: #001939; font-weight: 700; text-decoration: underline;">support@courtreportcard.com</a> ` +
      `or use <a href="${supportUrl}" style="color: #001939; font-weight: 700; text-decoration: underline;">Contact Support</a> ` +
      `and we'll look at what happened.`
  } else if (kind === 'repeat') {
    nextStep =
      `This is the second time this specific file has run into a problem. Sometimes that's something about the file, ` +
      `sometimes it's on our end, we're not sure yet without a closer look. Instead of trying again, email us at ` +
      `<a href="mailto:support@courtreportcard.com" style="color: #001939; font-weight: 700; text-decoration: underline;">support@courtreportcard.com</a> ` +
      `or use <a href="${supportUrl}" style="color: #001939; font-weight: 700; text-decoration: underline;">Contact Support</a> ` +
      `so we can check what's actually going on.`
  } else {
    nextStep =
      `This is usually a temporary issue. Please try uploading again. If it happens a second time, reach out and we'll take a look. ` +
      `Don't keep retrying the same file over and over.`
  }
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; color: #1a1a1a;">
      <div style="background: #001939; padding: 24px 32px; border-radius: 8px 8px 0 0;">
        <p style="color: white; font-size: 18px; font-weight: 800; margin: 0;">We couldn't finish your transcript</p>
      </div>
      <div style="background: #f8f9fa; padding: 32px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0;">
        <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
          We hit a problem analyzing <strong>${safeName}</strong>, so it wasn't completed.
          We've <strong>refunded ${Number(refunded) || 0} token${refunded === 1 ? '' : 's'}</strong>. You weren't charged.
        </p>
        <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
          ${nextStep}
        </p>
        <a href="${supportUrl}" style="display: inline-block; background: #001939; color: white; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 24px; border-radius: 8px;">Contact Support</a>
      </div>
    </div>
  `
}
