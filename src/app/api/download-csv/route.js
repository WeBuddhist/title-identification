import { NextResponse } from 'next/server';
import prisma from '@/service/db';

export async function POST(request) {
  try {
    const { groupId, fromDate, toDate, userEmail } = await request.json();

    if (!groupId || !fromDate || !toDate || !userEmail) {
      return NextResponse.json(
        { error: 'Group ID, from date, to date, and user email are required' },
        { status: 400 }
      );
    }

    // Verify user exists and has the correct role for download access
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      select: { role: true, id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      );
    }

    if (user.role !== 'REVIEWER' && user.role !== 'FINAL_REVIEWER') {
      return NextResponse.json(
        { error: 'Access denied. Only reviewers and final reviewers can download data.' },
        { status: 403 }
      );
    }

    // Fetch tasks within the date range for the specified group
    const tasks = await prisma.task.findMany({
      where: {
        group_id: parseInt(groupId),
        AND: [
          {
            OR: [
              { submitted_at: { gte: new Date(fromDate), lte: new Date(toDate) } },
              { reviewed_at: { gte: new Date(fromDate), lte: new Date(toDate) } },
              { final_reviewed_at: { gte: new Date(fromDate), lte: new Date(toDate) } },
            ]
          }
        ]
      },
      include: {
        transcriber: { select: { name: true } },
        reviewer: { select: { name: true } },
        final_reviewer: { select: { name: true } },
        group: { select: { name: true } },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // Convert to CSV format
    const csvHeaders = [
      'Task ID',
      'Group',
      'State',
      'Batch ID',
      'Image Name',
      'Image URL',
      'Transcriber',
      'Reviewer',
      'Final Reviewer',
      'Diplomatic Context',
      'Normalised Context',
      'Is Title Page',
      'Is Section Title',
      'Corrected Diplomatic',
      'Corrected Normalised',
      'Reviewed Is Title',
      'Reviewed Is Section Title',
      'Reviewed Diplomatic',
      'Reviewed Normalised',
      'Final Is Title',
      'Final Is Section Title',
      'Final Diplomatic',
      'Final Normalised',
      'Created At',
      'Submitted At',
      'Reviewed At',
      'Final Reviewed At',
      'Duration',
      'Reviewer Rejected Count',
      'Final Reviewer Rejected Count'
    ];

    const boolToYesNo = (value) =>
      value === true ? 'YES' : value === false ? 'NO' : '';

    const csvRows = tasks.map(task => [
      task.id,
      task.group?.name || '',
      task.state,
      task.batch_id,
      task.image_name || '',
      task.url || '',
      task.transcriber?.name || '',
      task.reviewer?.name || '',
      task.final_reviewer?.name || '',
      `"${(task.diplomatic_context || '').replace(/"/g, '""')}"`,
      `"${(task.normalised_context || '').replace(/"/g, '""')}"`,
      boolToYesNo(task.is_title_page),
      boolToYesNo(task.is_section_title),
      `"${(task.corrected_diplomatic || '').replace(/"/g, '""')}"`,
      `"${(task.corrected_normalised || '').replace(/"/g, '""')}"`,
      boolToYesNo(task.reviewed_is_title),
      boolToYesNo(task.reviewed_is_section_title),
      `"${(task.reviewed_diplomatic || '').replace(/"/g, '""')}"`,
      `"${(task.reviewed_normalised || '').replace(/"/g, '""')}"`,
      boolToYesNo(task.final_is_title),
      boolToYesNo(task.final_is_section_title),
      `"${(task.final_diplomatic || '').replace(/"/g, '""')}"`,
      `"${(task.final_normalised || '').replace(/"/g, '""')}"`,
      task.created_at?.toISOString() || '',
      task.submitted_at?.toISOString() || '',
      task.reviewed_at?.toISOString() || '',
      task.final_reviewed_at?.toISOString() || '',
      task.duration || '',
      task.reviewer_rejected_count || 0,
      task.final_reviewer_rejected_count || 0
    ]);

    // Create CSV content
    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.join(','))
    ].join('\n');

    // Return CSV as downloadable file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="tasks-${groupId}-${fromDate}-${toDate}.csv"`,
      },
    });

  } catch (error) {
    console.error('Error generating CSV:', error);
    return NextResponse.json(
      { error: 'Failed to generate CSV' },
      { status: 500 }
    );
  }
}
