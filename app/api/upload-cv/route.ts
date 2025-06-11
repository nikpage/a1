// app/api/upload-cv/route.ts
import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import * as fs from 'fs/promises';
import pdfParse from 'pdf-parse';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Parse PDF content
    const pdfData = await pdfParse(buffer);
    const text = pdfData.text;

    console.log('File received:', file.name);
    console.log('Extracted text:', text.substring(0, 100) + '...');

    return NextResponse.json({
      success: true,
      message: 'File uploaded and parsed successfully',
      fileName: file.name,
      textContent: text
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
