import type { VideoPayload } from './types';
import type { VideoScene } from './timeline';
import { EVENT_TIMING, eventEase, eventStoryFont, expressionOpacityAt, parseEventSpeaker, shownEventDialogue, spriteMotionAt } from '../../utils/eventPresentation';

type Context = CanvasRenderingContext2D;
export type VideoImages = Map<string, HTMLImageElement>;

/** TitleBanner: 500ms reveal, hide at 3s, 300ms fade; next line at 4s. */
export function titleAnimationAt(seconds: number) {
  const reveal = eventEase(seconds / EVENT_TIMING.titleReveal);
  return { expansion: reveal, opacity: seconds < EVENT_TIMING.titleShow ? reveal : 1 - eventEase((seconds - EVENT_TIMING.titleShow) / EVENT_TIMING.titleFade) };
}

function box(ctx: Context, x: number, y: number, w: number, h: number, color: string, radius = 12) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
}

function wrap(ctx: Context, text: string, width: number) {
  const lines: string[] = [];
  let line = '';
  for (const character of Array.from(text)) {
    if (character === '\n') { lines.push(line); line = ''; continue; }
    if (line && ctx.measureText(line + character).width > width) { lines.push(line); line = character; }
    else line += character;
  }
  lines.push(line);
  return lines;
}

function fit(ctx: Context, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, width, height); ctx.clip();
  ctx.drawImage(image, x + (width - image.naturalWidth * scale) / 2, y + (height - image.naturalHeight * scale) / 2, image.naturalWidth * scale, image.naturalHeight * scale);
  ctx.restore();
}

function chat(ctx: Context, payload: VideoPayload, scene: VideoScene, images: VideoImages, W: number, H: number) {
  const short = Math.min(W, H);
  const font = Math.round(short * 0.034 * payload.chatSize);
  const lineHeight = font * 1.4;
  const pad = short * 0.022;
  const header = short * 0.1;
  const footer = scene.showStoryButton ? short * 0.12 : 0;
  const avatar = short * 0.075 * payload.chatSize;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  ctx.font = `${font}px MomoExport`;
  const rows = payload.timeline.messages.slice(0, scene.chatCount).map((message) => {
    const lines = wrap(ctx, message.text, W * 0.7 - pad * 2);
    const width = Math.min(W * 0.7, Math.max(...lines.map((line) => ctx.measureText(line).width), font) + pad * 2);
    return { message, lines, width, height: lines.length * lineHeight + pad * 2 + (!message.showImage || message.sender === 'user' ? 0 : font * 1.4) };
  });
  const total = rows.reduce((sum, row) => sum + row.height + pad, 0);
  let y = header + pad - Math.max(0, total - (H - header - footer - pad));
  ctx.save(); ctx.beginPath(); ctx.rect(0, header, W, H - header - footer); ctx.clip();
  for (const row of rows) {
    const user = row.message.sender === 'user';
    const x = user ? W - row.width - pad : avatar + pad * 2;
    let top = y;
    if (!user && row.message.showImage) {
      const image = images.get('avatar');
      if (image) fit(ctx, image, pad, top, avatar, avatar);
      ctx.fillStyle = '#333'; ctx.fillText(payload.name, x, top + font);
      top += font * 1.4;
    }
    box(ctx, x, top, row.width, row.lines.length * lineHeight + pad * 2, user ? '#DCF8C6' : '#44546A');
    ctx.fillStyle = user ? '#111' : '#fff';
    row.lines.forEach((line, index) => ctx.fillText(line, x + pad, top + pad + font + index * lineHeight));
    y += row.height + pad;
  }
  ctx.restore();
  ctx.fillStyle = '#FB94A7'; ctx.fillRect(0, 0, W, header);
  ctx.fillStyle = '#fff'; ctx.fillText(payload.name, pad * 1.5, header * 0.65);
  if (scene.showStoryButton) {
    ctx.fillStyle = '#fff'; ctx.fillRect(0, H - footer, W, footer);
    ctx.fillStyle = '#888'; ctx.textAlign = 'center'; ctx.font = `${short * 0.025}px MomoExport`;
    ctx.fillText(`| ${payload.labels.bondEvent} |`, W / 2, H - footer * 0.72);
    const buttonWidth = Math.min(W * 0.8, short * 0.7);
    box(ctx, (W - buttonWidth) / 2, H - footer * 0.57, buttonWidth, footer * 0.46, '#F48FB1');
    ctx.fillStyle = '#fff'; ctx.fillText(payload.labels.bondStory, W / 2, H - footer * 0.27);
  }
  ctx.textAlign = 'left';
}

export function paintVideo(ctx: Context, payload: VideoPayload, scene: VideoScene, local: number, images: VideoImages, W: number, H: number) {
  ctx.save();
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  if (scene.kind === 'chat') { chat(ctx, payload, scene, images, W, H); ctx.restore(); return; }
  const line = scene.line!;
  if (scene.backgroundTransition) {
    ctx.globalAlpha *= scene.backgroundTransition === 'out'
      ? 1 - eventEase(local / EVENT_TIMING.backgroundFade)
      : eventEase(local / EVENT_TIMING.backgroundFade);
  }
  const fade = line.commandType === 'deleteAll' || line.commandType === 'deleteEmotion' ? 1 - eventEase(local / EVENT_TIMING.deleteFade) : 1;
  const background = images.get(`bg:${scene.background}`);
  if (background) {
    ctx.save(); if (line.commandType === 'deleteAll') ctx.globalAlpha = fade;
    fit(ctx, background, 0, 0, W, H); ctx.restore();
  }
  const sprite = images.get(`emotion:${scene.emotion}`);
  const motion = scene.animation;
  const offset = spriteMotionAt(motion?.type ?? line.animationType, motion ? scene.start + local - motion.start : local);
  if (sprite) {
    ctx.save(); ctx.globalAlpha *= fade;
    const height = H * 0.98;
    const width = height * (payload.spriteAspects?.[scene.emotion!] ?? sprite.naturalWidth / sprite.naturalHeight);
    const left = (W - width) / 2 + offset.x;
    const top = H * 0.13 + offset.y;
    ctx.drawImage(sprite, left, top, width, height);
    const effect = scene.expression;
    const expression = images.get(`expression:${effect?.key ?? line.expression}`);
    const effectOpacity = expressionOpacityAt(effect ? scene.start + local - effect.start : local);
    if (expression && effectOpacity > 0) {
      ctx.globalAlpha *= effectOpacity;
      const size = 80 * (W / 1280);
      const scale = Math.min(size / expression.naturalWidth, size / expression.naturalHeight);
      const effectWidth = expression.naturalWidth * scale;
      const effectHeight = expression.naturalHeight * scale;
      const x = left + width - Math.min(W * 0.02, width * 0.08) - size;
      const y = top + H * 0.04;
      ctx.drawImage(expression, x + (size - effectWidth) / 2, y + (size - effectHeight) / 2, effectWidth, effectHeight);
    }
    ctx.restore();
  }
  // Transition scenes contain only the stage: no dialogue, choices or HUD.
  if (scene.backgroundTransition) { ctx.restore(); return; }
  if (line.type === 'selection') {
    ctx.fillStyle = 'rgba(5,13,36,0.24)'; ctx.fillRect(0, 0, W, H);
  }
  const short = Math.min(W, H);
  let font = eventStoryFont(W, H, 0.04, 20);
  const spoken = shownEventDialogue(line, line.type === 'dialogue' ? line : scene.previous);
  if (spoken?.text) {
    // Fit using the complete line, so typewriter progress never changes font size.
    while (font > 14) {
      ctx.font = `${font}px MomoExport`;
      const used = wrap(ctx, spoken.text, W * 0.89).length * font * 1.4 + (spoken.character ? font * 2.2 : 0);
      if (used <= H * 0.26) break;
      font--;
    }
    const gradient = ctx.createLinearGradient(0, H * 0.65, 0, H);
    gradient.addColorStop(0, 'rgba(4,10,24,0.18)'); gradient.addColorStop(0.3, 'rgba(4,10,24,0.72)'); gradient.addColorStop(1, 'rgba(4,10,24,0.96)');
    ctx.fillStyle = gradient; ctx.fillRect(0, H * 0.65, W, H * 0.35);
    const padding = W * 0.055;
    let y = H * 0.715;
    if (spoken.character) {
      const speaker = parseEventSpeaker(spoken.character);
      const nameFont = eventStoryFont(W, H, 0.044, 22) * font / eventStoryFont(W, H, 0.04, 20);
      ctx.font = `bold ${nameFont}px MomoExport`; ctx.fillStyle = '#fff';
      ctx.fillText(speaker.name, padding, y + nameFont);
      if (speaker.affiliation) {
        const nameWidth = ctx.measureText(speaker.name).width;
        ctx.font = `bold ${eventStoryFont(W, H, 0.027, 16) * font / eventStoryFont(W, H, 0.04, 20)}px MomoExport`;
        ctx.fillStyle = '#6fc5ee';
        ctx.fillText(speaker.affiliation, padding + nameWidth + 8, y + nameFont);
      }
      ctx.fillStyle = '#ffffff88'; ctx.fillRect(padding, y + font * 1.5, W * 0.42, 1);
      y += font * 2.2;
    }
    ctx.font = `${font}px MomoExport`; ctx.fillStyle = '#fff';
    const text = spoken === line ? spoken.text.slice(0, Math.floor(local / EVENT_TIMING.typewriter)) : spoken.text;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowOffsetY = 1; ctx.shadowBlur = 2;
    wrap(ctx, text, W - padding * 2).forEach((part, index) => ctx.fillText(part, padding, y + font + index * font * 1.4));
    ctx.restore();
    ctx.font = `bold ${eventStoryFont(W, H, 0.026, 16)}px MomoExport`;
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.textAlign = 'right'; ctx.fillText('▾', W * 0.96, H * 0.96); ctx.textAlign = 'left';
  }
  if (line.type === 'selection' && line.options?.length) {
    const optionFont = eventStoryFont(W, H, 0.026, 16);
    const height = Math.max(40, Math.round(short * 0.068));
    const width = W < 768 ? Math.round(W * 0.78) : Math.min(W * 0.62, short * 1.7);
    const gap = Math.max(4, Math.round(short * 0.012));
    const top = H / 2 - (height * line.options.length + gap * (line.options.length - 1)) / 2;
    ctx.font = `${optionFont}px MomoExport`;
    line.options.forEach((option, index) => {
      const chosen = index === 0 && local >= scene.duration - 0.6;
      const x = (W - width) / 2;
      const y = top + index * (height + gap);
      const gradient = ctx.createLinearGradient(x, y, x + width, y);
      ['#b9d8f3', '#eef6fc', '#ffffff', '#eef6fc', '#b9d8f3'].forEach((color, stop) => gradient.addColorStop([0, 0.18, 0.5, 0.82, 1][stop], color));
      ctx.fillStyle = gradient; ctx.fillRect(x, y, width, height);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);
      if (chosen) { ctx.fillStyle = '#74bcec66'; ctx.fillRect(x, y, width, height); }
      ctx.fillStyle = '#263f5d'; ctx.textAlign = 'center';
      const parts = wrap(ctx, option.trim().replace(/^["“”]+|["“”]+$/g, ''), width * 0.9).slice(0, 2);
      parts.forEach((part, row) => ctx.fillText(part, W / 2, top + index * (height + gap) + height / 2 + optionFont * (row - (parts.length - 1) / 2 + 0.35)));
    });
    ctx.textAlign = 'left';
  }
  const titleAnimation = titleAnimationAt(local);
  if (line.type === '타이틀' && titleAnimation.opacity > 0) {
    ctx.save();
    ctx.globalAlpha *= titleAnimation.opacity;
    ctx.fillStyle = '#0008'; ctx.fillRect(0, 0, W, H);
    const titleFont = W < 768 ? Math.min(36, Math.max(28, Math.round(W * 0.082))) : 48 * (W / 1280);
    ctx.font = `bold ${titleFont}px MomoExport`;
    const parts = wrap(ctx, line.text ?? '', W - 32);
    const height = W < 768 ? Math.round(titleFont * 2.6 + 28) : H / 4;
    const animatedHeight = height * titleAnimation.expansion;
    const top = (H - animatedHeight) / 2;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, top, W, animatedHeight);
    ctx.fillStyle = '#ccc'; ctx.fillRect(0, top + animatedHeight - 2, W, Math.min(2, animatedHeight));
    ctx.beginPath(); ctx.rect(0, top, W, animatedHeight); ctx.clip();
    ctx.fillStyle = '#556390'; ctx.textAlign = 'center';
    parts.forEach((part, index) => ctx.fillText(part, W / 2, H / 2 + (index - (parts.length - 1) / 2) * titleFont * 1.4 + titleFont * 0.35));
    ctx.textAlign = 'left';
    ctx.restore();
  }
  ctx.font = `${short * 0.024}px MomoExport`; ctx.fillStyle = '#fff';
  ctx.fillText('MomoStory', W * 0.03, short * 0.055);
  ctx.restore();
}
