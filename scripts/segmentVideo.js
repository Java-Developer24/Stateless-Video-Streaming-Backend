// scripts/segmentVideo.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const CHUNK_DURATION = 5; // seconds
const QUALITIES = {
  '1080p': { resolution: '1920x1080', bitrate: '5000k' },
  '720p': { resolution: '1280x720', bitrate: '2500k' },
  '480p': { resolution: '854x480', bitrate: '1000k' },
  '360p': { resolution: '640x360', bitrate: '500k' }
};

async function segmentVideo(inputPath, outputDir, videoId = null) {
  const id = videoId || uuidv4();
  const videoDir = path.join(outputDir, id);
  const chunksDir = path.join(videoDir, 'chunks');

  console.log(`📹 Processing video: ${inputPath}`);
  console.log(`📁 Output directory: ${videoDir}`);

  // Create directories
  fs.mkdirSync(videoDir, { recursive: true });

  // Get video info
  const probeCmd = `ffprobe -v quiet -print_format json -show_format -show_streams "${inputPath}"`;
  const probeOutput = JSON.parse(execSync(probeCmd).toString());
  
  const duration = parseFloat(probeOutput.format.duration);
  const totalChunks = Math.ceil(duration / CHUNK_DURATION);

  console.log(`⏱️  Duration: ${duration}s, Chunks: ${totalChunks}`);

  // Process each quality
  for (const [quality, settings] of Object.entries(QUALITIES)) {
    const qualityDir = path.join(chunksDir, quality);
    fs.mkdirSync(qualityDir, { recursive: true });

    console.log(`🔄 Processing ${quality}...`);

    // Segment video using ffmpeg
    const ffmpegCmd = `ffmpeg -i "${inputPath}" \
      -vf "scale=${settings.resolution}" \
      -c:v libx264 -preset fast -b:v ${settings.bitrate} \
      -c:a aac -b:a 128k \
      -f segment -segment_time ${CHUNK_DURATION} \
      -segment_format mpegts \
      -reset_timestamps 1 \
      "${path.join(qualityDir, 'chunk_%06d.ts')}" \
      -y -loglevel warning`;

    try {
      execSync(ffmpegCmd);
      console.log(`✅ ${quality} completed`);
    } catch (error) {
      console.error(`❌ ${quality} failed:`, error.message);
    }
  }

  // Generate thumbnail
  const thumbnailPath = path.join(videoDir, 'thumbnail.jpg');
  const thumbnailCmd = `ffmpeg -i "${inputPath}" -ss 00:00:05 -vframes 1 -vf "scale=320:-1" "${thumbnailPath}" -y -loglevel warning`;
  
  try {
    execSync(thumbnailCmd);
    console.log('📷 Thumbnail generated');
  } catch (error) {
    console.error('Thumbnail generation failed:', error.message);
  }

  // Create metadata file
  const metadata = {
    title: path.basename(inputPath, path.extname(inputPath)),
    description: '',
    duration,
    chunkDuration: CHUNK_DURATION,
    totalChunks,
    qualities: Object.keys(QUALITIES),
    resolutions: Object.fromEntries(
      Object.entries(QUALITIES).map(([k, v]) => [k, v.resolution])
    ),
    bitrates: Object.fromEntries(
      Object.entries(QUALITIES).map(([k, v]) => [k, v.bitrate])
    ),
    thumbnail: 'thumbnail.jpg',
    createdAt: new Date().toISOString()
  };

  fs.writeFileSync(
    path.join(videoDir, 'metadata.json'),
    JSON.stringify(metadata, null, 2)
  );

  console.log(`✅ Video processed successfully!`);
  console.log(`📋 Video ID: ${id}`);

  return { videoId: id, metadata };
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('Usage: node segmentVideo.js <input-video> [output-dir] [video-id]');
    process.exit(1);
  }

  const inputPath = args[0];
  const outputDir = args[1] || './storage/videos';
  const videoId = args[2];

  segmentVideo(inputPath, outputDir, videoId)
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Error:', err);
      process.exit(1);
    });
}

module.exports = { segmentVideo };