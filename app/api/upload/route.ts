import { NextRequest, NextResponse } from 'next/server';
import cloudinary from '@/lib/cloudinary';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as string) || 'golqi-absensi/profiles';

    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan.' }, { status: 400 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Cloudinary
    const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder,
            resource_type: 'image',
            transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face', quality: 'auto' }],
          },
          (err, result) => {
            if (err || !result) return reject(err || new Error('Upload gagal'));
            resolve({ secure_url: result.secure_url, public_id: result.public_id });
          }
        )
        .end(buffer);
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('cloudinary upload error:', err);
    return NextResponse.json({ error: 'Gagal upload gambar.' }, { status: 500 });
  }
}
