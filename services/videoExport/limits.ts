export const MAX_VIDEO_BYTES = 512 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 600;
export const AUDIO_BITRATE = 128_000;

// Hardware encoders may overshoot their requested average bitrate. Reserve
// enough room for AAC, MP4 metadata and encoder variance before the hard cap.
export const VIDEO_SIZE_HEADROOM = 0.85;
