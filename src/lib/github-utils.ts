import crypto from 'crypto';

export async function verifyGithubSignature(
  secret: string,
  headerSignature: string,
  payload: string | Buffer
): Promise<boolean> {
  const parts = headerSignature.split('=');
  const sigHex = parts[1];
  const algorithm = parts[0];

  if (algorithm !== 'sha256') {
    return false;
  }

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const calculatedSignature = hmac.digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(sigHex),
    Buffer.from(calculatedSignature)
  );
}
