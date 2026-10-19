import { EventLine } from '@/types/EventLine';

/** 파일명에 공백이 있어도 쉼표나 ] 앞에서 끊는다. */
const musicOf = (line: string) => line.match(/music\s*:\s*([^,\]\n]+?\.mp3|none)/)?.[1]?.trim();

/**
 * 스크립트 문자열 → EventLine[]
 * 화면 재생과 영상 추출이 같은 대본 해석 규칙을 사용한다.
 */
export default function parseEventScript(script: string): EventLine[] {
    const out: EventLine[] = [];

    script
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .forEach(l => {
        if (/^(?:타이틀|title)\s*[:：]/i.test(l)) {
          const txt = l.replace(/^(?:타이틀|title)\s*[:：]\s*/i, '').trim();
          out.push({ type: '타이틀', text: txt });
          return;
        }

        if (l.startsWith('selection')) {
          // (1)"대사" 와 (1)(행동) 둘 다 선택지로 읽는다. 따옴표가 없으면 버튼이 안 생겨 진행이 멈춘다.
          const opts = [...l.matchAll(/\(\d+\)\s*(?:"([^"]*)"|\(([^)]*)\))/g)].map(
            (m) => (m[1] ?? m[2] ?? '').trim(),
          );
          const emo = l.match(/emotion\s*:\s*([A-Za-z0-9_]+)(?:\.png)?/)?.[1];
          const bg = l.match(/bg\s*:\s*(BG_[\w]+\.jpg)/)?.[1]?.replace('.jpg', '');
          const mus = musicOf(l);
          const snd = l.match(/sound\s*:\s*([\w'_.-]+\.(?:mp3|wav))/i)?.[1];
          const exp = l.match(/expression\s*:\s*([\w_.-]+\.png)/)?.[1];
          const anim = l.match(/animation\s*:\s*(\w+)/)?.[1];
          const speaker = l.match(/speaker\s*:\s*([^,\]]+)/)?.[1]?.trim();
          const dialogue = l
            .match(/dialogue\s*:\s*(.*?)(?=,\s*(?:emotion|bg|music|sound|speaker|expression|animation)\s*:|\])/i)?.[1]
            ?.trim();
          out.push({
            type: 'selection',
            character: speaker,
            text: dialogue,
            options: opts,
            emotion: emo,
            bg,
            music: mus,
            soundFile: snd,
            expression: exp,
            animationType: anim,
          });
          return;
        }

        if (l.startsWith('narration')) {
          const rawNar = l.replace(/^narration\s*:\s*/i, '');
          const txt = rawNar
            .replace(/\[.*?]/g, '')
            .replace(/,?\s*(bg|sound)\s*:\s*\S+/gi, '')
            .replace(/,?\s*music\s*:\s*(?:none|[^,\]\n]+?\.mp3)/gi, '')
            .replace(/[,\s]+$/, '')
            .trim();
          const bg = l.match(/bg\s*:\s*(BG_[\w]+\.jpg)/)?.[1]?.replace('.jpg', '');
          const mus = musicOf(l);
          const snd = l.match(/sound\s*:\s*([\w'_.-]+\.(?:mp3|wav))/i)?.[1];
          const emo = l.match(/emotion\s*:\s*([A-Za-z0-9_]+)(?:\.(?:png|jpg))?/)?.[1];
          const exp = l.match(/expression\s*:\s*([\w_.-]+\.png)/)?.[1];
          const anim = l.match(/animation\s*:\s*(\w+)/)?.[1];
          out.push({ type: 'narration', character: '', text: txt, bg, music: mus, soundFile: snd, emotion: emo, expression: exp, animationType: anim });
          return;
        }

        if (l.startsWith('animation')) {
          const anim = l.match(/animation\s*:\s*(\w+)/)?.[1];
          if (anim) {
            out.push({ type: 'animation', animationType: anim });
          }
          return;
        }

        if (/^(deleteAll|deleteEmotion|endEvent)/.test(l)) {
          out.push({ type: 'command', commandType: l.trim(), text: '' });
          return;
        }

        if (l.startsWith('waitSecond')) {
          const s = Number(l.replace(/[^\d]/g, '')) || 1;
          out.push({ type: 'command', commandType: 'waitSecond', waitSecond: s, text: '' });
          return;
        }

        // 일반 대사 처리 - 먼저 대화인지 확인
        const i = l.indexOf(':');
        if (i !== -1) {
          const speakerRaw = l.slice(0, i).trim();
          // 화자가 있고 narration, selection, animation 등의 키워드가 아닌 경우 대화로 처리
          if (!l.startsWith('[') && speakerRaw && !['narration', 'selection', 'animation', 'waitSecond', 'bg', 'music', 'sound', 'emotion', 'expression'].includes(speakerRaw)) {
            const speakerMatch = speakerRaw.match(/^(.+?)\s*\((.+?)\)$/);
            const spk = speakerMatch ? `${speakerMatch[1]}(${speakerMatch[2]})` : speakerRaw;
            const rest = l.slice(i + 1).trim();

            const emo = rest.match(/emotion\s*:\s*([A-Za-z0-9_]+)(?:\.png)?/)?.[1];
            const bg = rest.match(/bg\s*:\s*(BG_[\w]+\.jpg)/)?.[1]?.replace('.jpg', '');
            const mus = musicOf(rest);
            const snd = rest.match(/sound\s*:\s*([\w'_.-]+\.(?:mp3|wav))/i)?.[1];
            const exp = rest.match(/expression\s*:\s*([\w_.-]+\.png)/)?.[1];
            const anim = rest.match(/animation\s*:\s*(\w+)/)?.[1];
            const txt = rest
              .replace(/\[.*?]/g, '')
              .replace(/,?\s*(emotion|bg|sound|expression|animation)\s*:\s*\S+/gi, '')
              .replace(/,?\s*music\s*:\s*(?:none|[^,\]\n]+?\.mp3)/gi, '')
              .replace(/[,\s]+$/, '')
              .trim();

            out.push({
              type: 'dialogue',
              character: spk,
              text: txt,
              emotion: emo,
              bg,
              music: mus,
              soundFile: snd,
              expression: exp,
              animationType: anim,
            });
            return;
          }
        }

        // ✅ bg나 music, sound만 있는 줄 처리
        if (
          /\bbg\s*:\s*BG_[\w]+\.jpg\b/i.test(l) ||
          /\bmusic\s*:\s*(?:none|[^,\]\n]+?\.mp3)/i.test(l) ||
          /\bsound\s*:\s*[\w'_.-]+\.(?:mp3|wav)\b/i.test(l) ||
          /\b(?:emotion|expression|animation)\s*:/i.test(l)
        ) {
          const bg = l.match(/bg\s*:\s*(BG_[\w]+\.jpg)/)?.[1]?.replace('.jpg', '');
          const mus = musicOf(l);
          const snd = l.match(/sound\s*:\s*([\w'_.-]+\.(?:mp3|wav))/i)?.[1];
          const emo = l.match(/emotion\s*:\s*([A-Za-z0-9_]+)(?:\.(?:png|jpg))?/)?.[1];
          const exp = l.match(/expression\s*:\s*([\w_.-]+\.png)/)?.[1];
          const anim = l.match(/animation\s*:\s*(\w+)/)?.[1];
          out.push({
            type: 'command',
            commandType: 'backgroundOnly',
            text: '',
            bg,
            music: mus,
            soundFile: snd,
            emotion: emo,
            expression: exp,
            animationType: anim,
          });
          return;
        }
      });

    return out;
}
