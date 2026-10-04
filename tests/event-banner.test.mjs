import test from 'node:test';
import assert from 'node:assert/strict';
import {bannerFormat,copyBanner} from '../app/connected/event-banner.ts';
test('private banner uploads require allowed MIME plus matching image signature',async()=>{
 assert.equal(await bannerFormat(new File([new Uint8Array([137,80,78,71,13,10,26,10])],'fictional.png',{type:'image/png'})),'png');
 assert.equal(await bannerFormat(new File([new Uint8Array([255,216,255,224])],'fictional.jpg',{type:'image/jpeg'})),'jpg');
 assert.equal(await bannerFormat(new File(['RIFF1234WEBP'],'fictional.webp',{type:'image/webp'})),'webp');
 await assert.rejects(bannerFormat(new File(['<svg>'],'fictional.png',{type:'image/png'})),/PNG, JPEG or WebP/);
 await assert.rejects(bannerFormat(new File([new Uint8Array([255,216,255])],'fictional.svg',{type:'image/svg+xml'})),/PNG, JPEG or WebP/);
 await assert.rejects(bannerFormat(new File([''],'fictional.png',{type:'image/png'})),/up to 2 MB/);
 await assert.rejects(bannerFormat(new File([new Uint8Array(2*1024*1024+1)],'fictional.png',{type:'image/png'})),/up to 2 MB/);
});
test('picker contents are copied immediately and camera-size photos are allowed before resizing',async()=>{
 const bytes=new Uint8Array(3*1024*1024);bytes.set([255,216,255,224]);
 const copied=await copyBanner(new File([bytes],'fictional-camera.jpg',{type:'image/jpeg'}));
 bytes.fill(0);
 assert.equal(copied.size,3*1024*1024);
 assert.equal(copied.type,'image/jpeg');
 assert.deepEqual([...new Uint8Array(await copied.slice(0,4).arrayBuffer())],[255,216,255,224]);
});
test('unreadable picker handles return a recoverable action instead of a browser exception',async()=>{
 const file=new File([new Uint8Array([255,216,255,224])],'fictional.jpg',{type:'image/jpeg'});
 file.arrayBuffer=async()=>{throw new DOMException('Provider permission expired','NotReadableError');};
 await assert.rejects(copyBanner(file),/Choose it again, or save it to your device first/);
 await assert.rejects(copyBanner(new File([new Uint8Array(20*1024*1024+1)],'fictional.jpg',{type:'image/jpeg'})),/up to 20 MB/);
});
