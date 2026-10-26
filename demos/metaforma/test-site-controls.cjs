#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const dir=__dirname;
const read=p=>fs.readFileSync(path.join(dir,p),'utf8');
const html=read('index.html'),css=read('art-gallery.css'),js=read('art-gallery.js'),sw=read('service-worker.js');
const manifest=JSON.parse(read('manifest.webmanifest'));
assert.match(html,/Metaphysical Kineticism/,'Gallery title missing');
assert.match(html,/id="gallery"/,'Gallery grid missing');
assert.match(html,/id="viewer"/,'Artwork viewer missing');
assert.match(html,/id="globalPalettes"/,'Palette selector missing');
assert.match(html,/art-gallery\.css/,'Gallery style missing');
assert.match(html,/art-gallery\.js/,'Artwork renderer missing');
assert.doesNotMatch(html,/onlinepilatesclasses|instructor|biomechanical|anatomy assessment|classical pilates/i,'Teaching content displayed');
assert.match(css,/aspect-ratio:1\/1/,'Square original proportion not maintained');
assert.doesNotMatch(css,/object-fit:cover/,'Art may be cropped');
assert.match(js,/preserveAspectRatio="xMidYMid meet"/,'SVG proportion safeguard missing');
assert.match(js,/new Blob/,'Full-vector download missing');
const tt=js.match(/const titles=\[([\s\S]*?)\];/);
const dd=js.match(/const descriptions=\[([\s\S]*?)\];/);
assert.ok(tt&&dd,'Art title and description manifests missing');
const titles=JSON.parse('['+tt[1]+']'),descriptions=JSON.parse('['+dd[1]+']');
assert.equal(titles.length,34,'Exactly 34 studies required');
const classicalTitles=[
'The Hundred','Roll Up','Roll Over','Single Leg Circles','Rolling Like a Ball',
'Single Leg Stretch','Double Leg Stretch','Spine Stretch Forward','Open Leg Rocker',
'Corkscrew','Saw','Swan Dive','Single Leg Kick','Double Leg Kick','Neck Pull',
'High Scissors','High Bicycle','Shoulder Bridge','Spine Twist','Jackknife',
'Side Kicks','Teaser','Hip Circles / Twist','Swimming','Leg Pull Front',
'Leg Pull Back','Kneeling Side Kicks','Side Bend','Boomerang','Seal','Crab',
'Rocking','Control Balance','Push-Ups'];
assert.deepEqual(titles,classicalTitles,'Artwork titles must preserve the original 34 forms in order');
assert.match(js,/collection:i<4\?1:i<9\?2:i<14\?3:i<20\?4:i<26\?5:6/,'Six original block boundaries changed');

assert.equal(new Set(titles).size,34,'Art titles must be distinct');
assert.equal(descriptions.length,34,'Each study needs a curatorial description');
assert.equal((js.match(/id:"(?:original|nocturne|venetian|botanical|chromatic)"/g)||[]).length,5,'Exactly five palettes required');
new Function(js);new Function(sw);
assert.match(sw,/art-gallery\.js/,'Offline shell must include new art renderer');
assert.match(sw,/art-gallery\.css/,'Offline shell must include new style');
assert.equal(manifest.name,'MetaForma · Metaphysical Kineticism');
assert.equal(manifest.scope,'./');
console.log('MetaForma gallery: PASS (34 distinct artworks, 5 palettes, responsive/vector viewer, art-only shell).');
