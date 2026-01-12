// scripts/segmentVideo.js

const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../src/config');

// Set ffmpeg paths if configured
if (config.ffmpeg.ffmpegPath) {
  ffmpeg.setFfmpegPath(config.ffmpeg.ffmpegPath);
}
if (config.ffmpeg.ffprobePath) {
  ffmpeg.setFfprobePath(config.ffmpeg.ffprobePath);
}

const CHUNK_DURATION = config.storage.chunkDuration || 5;

const QUALITIES = {
  '1080p': { resolution: '1920x1080', videoBitrate: '5000k', audioBitrate: '192k' },
  '720p': { resolution: '1280x720', videoBitrate: '2500k', audioBitrate: '128k' },
  '480p': { resolution: '854x480', videoBitrate: '1000k', audioBitrate: '96k' },
  '360p': { resolution: '640x360', videoBitrate: '500k', audioBitrate: '64k' }
};

/**
 * Get video metadata using ffprobe
 */
function getVideoInfo(inputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

        resolve({
          duration: parseFloat(metadata.format.duration),
          width: videoStream?.width,
          height: videoStream?.height,
          videoCodec: videoStream?.codec_name,
          audioCodec: audioStream?.codec_name,
          bitrate: parseInt(metadata.format.bit_rate, 10),
          size: parseInt(metadata.format.size, 10)
        });
      }
    });
  });
}

/**
 * Segment video into chunks for a specific quality
 */
function segmentQuality(inputPath, outputDir, quality, settings, onProgress) {
  return new Promise((resolve, reject) => {
    const qualityDir = path.join(outputDir, 'chunks', quality);

    // Create directory
    fsSync.mkdirSync(qualityDir, { recursive: true });

    const outputPattern = path.join(qualityDir, 'chunk_%06d.ts');

    let lastProgress = 0;

    ffmpeg(inputPath)
      .outputOptions([
        `-vf scale=${settings.resolution}`,
        '-c:v libx264',
        '-preset fast',
        '-crf 22',
        `-b:v ${settings.videoBitrate}`,
        `-maxrate ${settings.videoBitrate}`,
        `-bufsize ${parseInt(settings.videoBitrate) * 2}k`,
        '-c:a aac',
        `-b:a ${settings.audioBitrate}`,
        '-f segment',
        `-segment_time ${CHUNK_DURATION}`,
        '-segment_format mpegts',
        '-reset_timestamps 1',
        '-force_key_frames', `expr:gte(t,n_forced*${CHUNK_DURATION})`
      ])
      .output(outputPattern)
      .on('progress', (progress) => {
        if (progress.percent && onProgress) {
          const currentProgress = Math.round(progress.percent);
          if (currentProgress > lastProgress) {
            lastProgress = currentProgress;
            onProgress({
              stage: 'encoding',
              quality,
              progress: currentProgress
            });
          }
        }
      })
      .on('end', () => {
        console.log(`✅ ${quality} encoding completed`);
        resolve();
      })
      .on('error', (err) => {
        console.error(`❌ ${quality} encoding failed:`, err.message);
        reject(err);
      })
      .run();
  });
}

/**
 * Generate thumbnail from video
 */
function generateThumbnail(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .screenshots({
        timestamps: ['10%'],
        filename: 'thumbnail.jpg',
        folder: path.dirname(outputPath),
        size: '320x180'
      })
      .on('end', () => {
        console.log('📷 Thumbnail generated');
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.warn('⚠️ Thumbnail generation failed:', err.message);
        resolve(null); // Don't fail the whole process
      });
  });
}

/**
 * Main segmentation function
 */
async function segmentVideo(inputPath, outputDir, videoId = null, options = {}) {
  const {
    title = null,
    description = '',
    qualities = ['720p', '480p', '360p'], // Default qualities to generate
    onProgress = null
  } = options;

  const id = videoId || uuidv4();
  const videoDir = path.join(outputDir, id);

  console.log(`\n📹 Processing video: ${inputPath}`);
  console.log(`📁 Output directory: ${videoDir}`);
  console.log(`🎬 Video ID: ${id}`);

  // Create output directory
  await fs.mkdir(videoDir, { recursive: true });

  // Get video information
  console.log('\n🔍 Analyzing video...');
  const videoInfo = await getVideoInfo(inputPath);
  console.log(`   Duration: ${videoInfo.duration}s`);
  console.log(`   Resolution: ${videoInfo.width}x${videoInfo.height}`);
  console.log(`   Size: ${(videoInfo.size / 1024 / 1024).toFixed(2)} MB`);

  const totalChunks = Math.ceil(videoInfo.duration / CHUNK_DURATION);
  console.log(`   Chunks: ${totalChunks} (${CHUNK_DURATION}s each)`);

  // Determine which qualities to generate based on source resolution
  const sourceHeight = videoInfo.height || 720;
  const qualitiesToGenerate = qualities.filter(q => {
    const targetHeight = parseInt(QUALITIES[q].resolution.split('x')[1], 10);
    return targetHeight <= sourceHeight;
  });

  if (qualitiesToGenerate.length === 0) {
    qualitiesToGenerate.push('360p'); // Always generate at least 360p
  }

  console.log(`\n🎞️  Generating qualities: ${qualitiesToGenerate.join(', ')}`);

  // Process each quality
  for (let i = 0; i < qualitiesToGenerate.length; i++) {
    const quality = qualitiesToGenerate[i];
    const settings = QUALITIES[quality];

    console.log(`\n[${i + 1}/${qualitiesToGenerate.length}] Processing ${quality}...`);

    await segmentQuality(inputPath, videoDir, quality, settings, (progress) => {
      if (onProgress) {
        const overallProgress = Math.round(
          ((i / qualitiesToGenerate.length) + (progress.progress / 100 / qualitiesToGenerate.length)) * 100
        );
        onProgress({
          stage: 'encoding',
          quality,
          qualityProgress: progress.progress,
          overallProgress,
          currentQuality: i + 1,
          totalQualities: qualitiesToGenerate.length
        });
      }
    });
  }

  // Generate thumbnail
  console.log('\n📷 Generating thumbnail...');
  const thumbnailPath = path.join(videoDir, 'thumbnail.jpg');
  await generateThumbnail(inputPath, thumbnailPath);

  // Create metadata
  const metadata = {
    id,
    title: title || path.basename(inputPath, path.extname(inputPath)),
    description,
    duration: videoInfo.duration,
    chunkDuration: CHUNK_DURATION,
    totalChunks,
    qualities: qualitiesToGenerate,
    resolutions: Object.fromEntries(
      qualitiesToGenerate.map(q => [q, QUALITIES[q].resolution])
    ),
    bitrates: Object.fromEntries(
      qualitiesToGenerate.map(q => [q, QUALITIES[q].videoBitrate])
    ),
    sourceInfo: {
      width: videoInfo.width,
      height: videoInfo.height,
      codec: videoInfo.videoCodec
    },
    thumbnail: 'thumbnail.jpg',
    createdAt: new Date().toISOString()
  };

  // Save metadata
  const metadataPath = path.join(videoDir, 'metadata.json');
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

  console.log('\n✅ Video processing completed!');
  console.log(`📋 Video ID: ${id}`);
  console.log(`🎬 Stream URL: /api/videos/${id}`);

  return { videoId: id, metadata, videoDir };
}

/**
 * Update existing video metadata
 */
async function updateMetadata(videoId, updates) {
  const metadataPath = path.join(config.storage.basePath, videoId, 'metadata.json');

  try {
    const existing = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    await fs.writeFile(metadataPath, JSON.stringify(updated, null, 2));
    return updated;
  } catch (error) {
    throw new Error(`Failed to update metadata: ${error.message}`);
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log('Usage: node segmentVideo.js <input-video> [output-dir] [video-id]');
    console.log('\nExample:');
    console.log('  node segmentVideo.js ./my-video.mp4');
    console.log('  node segmentVideo.js ./my-video.mp4 ./storage/videos');
    console.log('  node segmentVideo.js ./my-video.mp4 ./storage/videos my-custom-id');
    process.exit(1);
  }

  const inputPath = args[0];
  const outputDir = args[1] || './storage/videos';
  const videoId = args[2];

  segmentVideo(inputPath, outputDir, videoId, {
    onProgress: (progress) => {
      process.stdout.write(`\r   Progress: ${progress.overallProgress || progress.progress}%`);
    }
  })
    .then((result) => {
      console.log('\n');
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n❌ Error:', err.message);
      process.exit(1);
    });
}

module.exports = { segmentVideo, updateMetadata, getVideoInfo };