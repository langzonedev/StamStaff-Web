import test from 'node:test';
import assert from 'node:assert/strict';
import {bannerFormat} from '../app/connected/event-banner.ts';
test('private banner uploads require allowed MIME plus matching image signature',async()=>{
 assert.equal(await bannerFormat(new File([new Uint8Array([137,80,78,71,13,10,26,10])],'fictional.png',{type:'image/png'})),'png');
 assert.equal(await bannerFormat(new File([new Uint8Array([255,216,255,224])],'fictional.jpg',{type:'image/jpeg'})),'jpg');
 assert.equal(await bannerFormat(new File(['RIFF1234WEBP'],'fictional.webp',{type:'image/webp'})),'webp');
 await assert.rejects(bannerFormat(new File(['<svg>'],'fictional.png',{type:'image/png'})),/PNG, JPEG or WebP/);
 await assert.rejects(bannerFormat(new File([new Uint8Array([255,216,255])],'fictional.svg',{type:'image/svg+xml'})),/PNG, JPEG or WebP/);
 await assert.rejects(bannerFormat(new File([''],'fictional.png',{type:'image/png'})),/up to 2 MB/);
 await assert.rejects(bannerFormat(new File([new Uint8Array(2*1024*1024+1)],'fictional.png',{type:'image/png'})),/up to 2 MB/);
});
