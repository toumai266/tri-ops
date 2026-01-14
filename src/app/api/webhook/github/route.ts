import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { githubEvents } from '@/db/schema';
import { verifyGithubSignature } from '@/lib/github-utils';

export async function POST(req: NextRequest) {
  const bodyText = await req.text(); // Read body as text for signature verification
  const deliveryId = req.headers.get('x-github-delivery');
  const eventType = req.headers.get('x-github-event');
  const signature = req.headers.get('x-hub-signature-256');

  if (!deliveryId || !eventType || !signature) {
    return NextResponse.json({ error: 'Missing headers' }, { status: 400 });
  }

  // 1. Verify Signature
  const isVerified = await verifyGithubSignature(
    process.env.GITHUB_WEBHOOK_SECRET || '',
    signature,
    bodyText
  );

  if (!isVerified) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // 2. Parse Payload
  const payload = JSON.parse(bodyText);
  const action = payload.action || null;
  // Use payload.repository.id for repo mapping if needed later

  try {
    // 3. Store Event (Idempotency Key: delivery_id)
    // Using onConflictDoNothing to handle re-deliveries smoothly
    await db.insert(githubEvents).values({
      delivery_id: deliveryId,
      event_type: eventType,
      action: action,
      signature_ok: true,
      payload_json: payload,
      process_status: 'NEW',
    }).onConflictDoNothing({ target: githubEvents.delivery_id });

    // In a real scenario, we might want to trigger processing here asynchronously
    // e.g., await processEvent({ deliveryId, ... }) (Fire and forget or queue)
    
    return NextResponse.json({ message: 'Event received' }, { status: 200 });

  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
