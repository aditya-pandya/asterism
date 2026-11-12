'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const{applyCommand}=require('../editor-commands');
test('inline styles toggle using returned selection and distinguish bold from italic',()=>{for(const c of ['bold','italic','code','strike']){const a=applyCommand('hello',0,5,c),b=applyCommand(a.markdown,a.selectionStart,a.selectionEnd,c);assert.equal(b.markdown,'hello',c);}assert.equal(applyCommand('**x**',2,3,'italic').markdown,'***x***');});
test('link preserves label and selects URL placeholder',()=>assert.deepEqual(applyCommand('read',0,4,'link'),{markdown:'[read](https://)',selectionStart:7,selectionEnd:15}));
test('fences and inline code choose longer delimiter runs',()=>{assert.equal(applyCommand('a```b',0,5,'code').markdown,'````a```b````');assert.equal(applyCommand('x```y',0,5,'fencedCode').markdown,'````\nx```y\n````');});
test('line selection transforms exact lines and maps selection through inserted prefixes',()=>{const a=applyCommand('one\ntwo\nthree',0,7,'bulletList');assert.equal(a.markdown,'- one\n- two\nthree');assert.deepEqual([a.selectionStart,a.selectionEnd],[2,11]);const b=applyCommand('one\ntwo',0,4,'blockquote');assert.equal(b.markdown,'> one\ntwo');});
test('end at newline does not change next line; prefix styles toggle',()=>{assert.equal(applyCommand('one\ntwo',0,4,'taskList').markdown,'- [ ] one\ntwo');assert.equal(applyCommand('- [ ] one\n- [x] two',0,17,'paragraph').markdown,'one\ntwo');});
test('list styles replace existing prefixes and preserve indentation',()=>{assert.equal(applyCommand('  - item\n  - [x] done',0,22,'orderedList').markdown,'  1. item\n  1. done');assert.equal(applyCommand('1. item',0,7,'taskList').markdown,'- [ ] item');});
test('indent and outdent selected lines',()=>{assert.equal(applyCommand('a\nb',0,3,'indent').markdown,'  a\n  b');assert.equal(applyCommand('  a\n  b',0,7,'outdent').markdown,'a\nb');});
test('collapsed cursor and UTF-16 Unicode offsets remain valid',()=>{const a=applyCommand('😀 hello',3,3,'bold');assert.equal(a.markdown,'😀 **bold**hello');assert.equal(a.markdown.slice(a.selectionStart,a.selectionEnd),'bold');});
test('line commands cover headings, nested indentation and paragraph cleanup',()=>{
 assert.equal(applyCommand('  text\nmore',2,10,'h3').markdown,'  ### text\n### more');
 assert.equal(applyCommand('  ### text',5,11,'paragraph').markdown,'  text');
 assert.equal(applyCommand('  - [x] done\n    plain',2,21,'orderedList').markdown,'  1. done\n    1. plain');
});
test('task list format toggles off for checked or unchecked tasks and switches styles cleanly',()=>{
 assert.equal(applyCommand('- [x] done\n- [ ] next',0,21,'taskList').markdown,'done\nnext');
 assert.equal(applyCommand('- [x] done\n- [ ] next',0,21,'bulletList').markdown,'- done\n- next');
 assert.equal(applyCommand('1. done\n- [x] next',0,17,'taskList').markdown,'- [ ] done\n- [ ] next');
});
test('line selection maps content and cursor through changed prefixes',()=>{
 const a=applyCommand('  item\nnext',2,6,'taskList');
 assert.equal(a.markdown,'  - [ ] item\nnext');
 assert.equal(a.markdown.slice(a.selectionStart,a.selectionEnd),'item');
 const b=applyCommand('one\ntwo',4,4,'indent'); assert.equal(b.markdown,'one\n  two'); assert.equal(b.selectionStart,6);
});
test('continueList inserts Enter output, exits empty lists and increments ordered markers',()=>{
 const bullet=applyCommand('- item',6,6,'continueList'); assert.equal(bullet.markdown,'- item\n- '); assert.equal(bullet.selectionStart,9);
 assert.equal(applyCommand('- ',2,2,'continueList').markdown,'');
 const ordered=applyCommand('7. item',7,7,'continueList'); assert.equal(ordered.markdown,'7. item\n8. ');
 assert.equal(applyCommand('8. ',4,4,'continueList').markdown,'');
 const plain=applyCommand('left right',4,4,'continueList'); assert.equal(plain.markdown,'left\n right'); assert.equal(plain.selectionStart,5);
 assert.equal(applyCommand('',0,0,'continueList').markdown,'\n');
});
test('fenced blocks unwrap on the returned inner selection and preserve info strings',()=>{
 const first=applyCommand('sample',0,6,'fencedCode'); assert.equal(first.markdown,'```\nsample\n```');
 const second=applyCommand(first.markdown,first.selectionStart,first.selectionEnd,'fencedCode'); assert.equal(second.markdown,'sample');
 const info=applyCommand('```js\nlet x = 1;\n```',6,16,'fencedCode'); assert.equal(info.markdown,'let x = 1;');
});
test('code spans pad backtick edges and unwrap with returned selection',()=>{
 const first=applyCommand('`value',0,6,'code'); assert.equal(first.markdown,'`` `value ``');
 const second=applyCommand(first.markdown,first.selectionStart,first.selectionEnd,'code'); assert.equal(second.markdown,'`value');
});
test('taskList switches task formatting off while preserving checked item text and tabs',()=>{
 assert.equal(applyCommand('\t- [x] done',0,10,'taskList').markdown,'\tdone');
 assert.equal(applyCommand('\titem',1,5,'bulletList').markdown,'\t- item');
});
