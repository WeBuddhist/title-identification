import { NextResponse } from 'next/server';

// Receives browser crash reports from ErrorScreen and writes them to the
// server log (Render → Logs, search "[client-error]").
export async function POST(request) {
  try {
    const report = await request.json();
    console.error('[client-error]', JSON.stringify(report).slice(0, 5000));
  } catch (error) {
    console.error('[client-error] unreadable report:', error);
  }
  return NextResponse.json({ ok: true });
}
