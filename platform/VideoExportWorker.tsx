import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NativeModules, Platform } from 'react-native';
import { Asset } from 'expo-asset';
import { Directory, File, FileMode, Paths, type FileHandle } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';
import { videoFileName } from '@/services/videoExport/types';
import { decodeBase64 } from '@/services/videoExport/base64';
import type { VideoExportWorkerProps } from './VideoExportWorker.types';
import { readableVideoAsset } from './videoAsset';

export default function VideoExportWorker(props: VideoExportWorkerProps) {
  const latest = useRef(props); latest.current = props;
  const webView = useRef<WebView>(null);
  const [html, setHtml] = useState<string | null>(null);
  const source = useMemo(() => ({ html: html ?? '', baseUrl: 'https://localhost/' }), [html]);
  const file = useRef<File | null>(null);
  const directory = useRef<Directory | null>(null);
  const handle = useRef<FileHandle | null>(null);
  const disposed = useRef(false);
  const settled = useRef(false);
  const received = useRef(0);
  const expected = useRef(0);
  const bridgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fail = (error: unknown) => {
    if (disposed.current || settled.current) return;
    settled.current = true;
    latest.current.onError(error instanceof Error ? error : new Error(String(error)));
  };
  useEffect(() => {
    let active = true;
    disposed.current = false;
    void (async () => {
      if (Platform.OS === 'android' && !NativeModules.MomoVideoDownloads) throw new Error('VIDEO_NATIVE_REBUILD');
      const asset = Asset.fromModule(require('../assets/video-renderer.js.txt'));
      const script = await (await readableVideoAsset(asset)).text();
      if (active && !disposed.current) {
        setHtml(`<!doctype html><html><head><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval' blob:; worker-src blob:; connect-src data: blob:; img-src data:; font-src data:; style-src 'unsafe-inline'"></head><body><script>${script.replace(/<\/script/gi, '<\\/script')}</script></body></html>`);
        bridgeTimer.current = setTimeout(() => fail(new Error('VIDEO_UNSUPPORTED')), 30000);
      }
    })().catch((error) => { if (active) fail(error); });
    return () => {
      active = false;
      disposed.current = true;
      if (bridgeTimer.current) clearTimeout(bridgeTimer.current);
      try { handle.current?.close(); } catch { /* already closed */ }
      try { if (file.current?.exists) file.current.delete(); } catch { /* cache will expire */ }
      try { if (directory.current?.exists) directory.current.delete(); } catch { /* cache will expire */ }
    };
  }, [props.payload]);

  const onMessage = (event: WebViewMessageEvent) => {
    if (disposed.current || settled.current || props.options.signal.aborted) return;
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.type === 'ready') {
        if (bridgeTimer.current) clearTimeout(bridgeTimer.current);
        webView.current?.injectJavaScript(`window.startVideoExport(${JSON.stringify(props.payload)});true;`);
      } else if (message.type === 'progress' && typeof message.progress === 'number') {
        latest.current.options.onProgress({ phase: 'encoding', progress: Math.min(0.95, Math.max(0.1, message.progress)) });
      } else if (message.type === 'begin') {
        if (!Number.isSafeInteger(message.size) || message.size <= 0 || message.size > 150 * 1024 * 1024 || handle.current) throw new Error('VIDEO_TOO_LARGE');
        expected.current = message.size;
        const temp = new Directory(Paths.cache, `video-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
        temp.create(); directory.current = temp;
        const result = new File(temp, videoFileName(props.payload.title, props.payload.ratio));
        result.create(); file.current = result; handle.current = result.open(FileMode.WriteOnly);
        latest.current.options.onProgress({ phase: 'saving', progress: 0.96 });
      } else if (message.type === 'chunk') {
        if (!handle.current || typeof message.data !== 'string' || message.data.length > 262144) throw new Error('VIDEO_ENCODE_FAILED');
        const bytes = decodeBase64(message.data);
        received.current += bytes.length;
        if (received.current > expected.current) throw new Error('VIDEO_ENCODE_FAILED');
        handle.current.writeBytes(bytes);
        webView.current?.injectJavaScript('window.acknowledgeVideoChunk();true;');
      } else if (message.type === 'complete') {
        if (!file.current || !handle.current || received.current !== expected.current) throw new Error('VIDEO_ENCODE_FAILED');
        handle.current.close(); handle.current = null;
        const result = file.current;
        void (async () => {
          if (Platform.OS === 'android') {
            await NativeModules.MomoVideoDownloads.save(result.uri, videoFileName(props.payload.title, props.payload.ratio));
          } else {
            if (!(await Sharing.isAvailableAsync())) throw new Error('VIDEO_UNSUPPORTED');
            await Sharing.shareAsync(result.uri, { mimeType: 'video/mp4', UTI: 'public.mpeg-4' });
          }
          if (!disposed.current) { settled.current = true; latest.current.onComplete(); }
        })().catch(fail);
      } else if (message.type === 'error') {
        fail(new Error(typeof message.message === 'string' ? message.message : 'VIDEO_ENCODE_FAILED'));
      }
    } catch (error) { fail(error); }
  };

  if (!html) return null;
  return (
    <WebView
      ref={webView}
      source={source}
      originWhitelist={['https://localhost', 'about:*']}
      javaScriptEnabled
      onMessage={onMessage}
      onError={() => fail(new Error('VIDEO_ENCODE_FAILED'))}
      onRenderProcessGone={() => fail(new Error('VIDEO_ENCODE_FAILED'))}
      onShouldStartLoadWithRequest={(request) => request.url === 'about:blank' || request.url === 'https://localhost/'}
      style={{ position: 'absolute', width: 1, height: 1, opacity: 0.01, bottom: 0 }}
    />
  );
}
