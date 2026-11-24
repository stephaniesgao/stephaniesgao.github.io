const owner='stephaniesgao';
const repo='stephaniesgao.github.io';
const api=`https://api.github.com/repos/${owner}/${repo}/contents/blog-posts.json`;
const vaultKey='steph-blog-editor-v1';
const encoder=new TextEncoder();
const decoder=new TextDecoder();
const $=selector=>document.querySelector(selector);
const setup=$('#setup');
const unlock=$('#unlock');
const workspace=$('#workspace');
const form=$('#post-form');
const editor=$('#body-editor');
let token=null,posts=[],fileSha=null,selectedId=null,dirty=false,busy=false;

function notice(message,type=''){
  const status=$('#status');
  status.textContent=message;
  status.className=type;
}
function bytesToBase64(bytes){
  let binary='';
  for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(binary);
}
function base64ToBytes(base64){
  const binary=atob(base64.replace(/\s/g,''));
  return Uint8Array.from(binary,character=>character.charCodeAt(0));
}
async function deriveKey(passphrase,salt){
  const material=await crypto.subtle.importKey('raw',encoder.encode(passphrase),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:310000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function encryptToken(value,passphrase){
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await deriveKey(passphrase,salt);
  const data=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,encoder.encode(value));
  return JSON.stringify({version:1,salt:bytesToBase64(salt),iv:bytesToBase64(iv),data:bytesToBase64(new Uint8Array(data))});
}
async function decryptToken(vault,passphrase){
  const saved=JSON.parse(vault);
  if(saved.version!==1)throw new Error('Unsupported saved passphrase format.');
  const key=await deriveKey(passphrase,base64ToBytes(saved.salt));
  const data=await crypto.subtle.decrypt({name:'AES-GCM',iv:base64ToBytes(saved.iv)},key,base64ToBytes(saved.data));
  return decoder.decode(data);
}
async function github(url,options={}){
  const response=await fetch(url,{...options,headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28',...options.headers}});
  if(!response.ok){
    let detail='';
    try{detail=(await response.json()).message||''}catch{}
    throw new Error(`GitHub returned ${response.status}${detail?`: ${detail}`:''}.`);
  }
  return response.json();
}
function parsePostsFile(text){
  const value=JSON.parse(text);
  if(!Array.isArray(value))throw new Error('The blog file has an unexpected format.');
  return value;
}
async function loadPosts(){
  const file=await github(api+'?ref=main&fresh='+Date.now());
  fileSha=file.sha;
  posts=parsePostsFile(decoder.decode(base64ToBytes(file.content)));
  selectedId=posts[0]?.id||null;
  renderList();
  renderEditor();
}
async function confirmOwner(){
  const user=await github('https://api.github.com/user');
  if(user.login?.toLowerCase()!==owner)throw new Error(`This token belongs to ${user.login||'another account'}, not ${owner}.`);
  await loadPosts();
}
function showWorkspace(){
  setup.hidden=true;
  unlock.hidden=true;
  workspace.hidden=false;
  $('#lock').hidden=false;
  notice('');
}
function lockEditor(){
  token=null;posts=[];fileSha=null;selectedId=null;editor.replaceChildren();
  workspace.hidden=true;setup.hidden=true;unlock.hidden=false;$('#lock').hidden=true;
  notice('Locked.');
}
function currentPost(){return posts.find(post=>post.id===selectedId)}
function renderList(){
  const list=$('#post-list');
  list.replaceChildren();
  for(const post of posts){
    const button=document.createElement('button');
    button.type='button';
    button.textContent=post.title;
    button.setAttribute('aria-current',String(post.id===selectedId));
    const date=document.createElement('small');date.textContent=post.date;button.append(date);
    button.addEventListener('click',()=>{if(!canLeave())return;selectedId=post.id;renderList();renderEditor()});
    list.append(button);
  }
}
function renderEditor(){
  const post=currentPost();
  form.elements.title.value=post?.title||'';
  form.elements.subtitle.value=post?.subtitle||'';
  form.elements.date.value=post?.date||new Intl.DateTimeFormat('en',{month:'long',year:'numeric'}).format(new Date());
  form.elements.byline.value=post?.byline||'Stephanie Gao';
  form.elements.excerpt.value=post?.excerpt||'';
  editor.innerHTML=post?.body||'';
  $('#editor-state').textContent=post?'Editing':'New post';
  $('#delete-post').hidden=!post;
  dirty=false;
}
function canLeave(){return !dirty||confirm('Discard your unsaved changes?')}
function slug(value){return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
function cleanBody(html){
  const doc=new DOMParser().parseFromString(html,'text/html');
  for(const element of [...doc.body.querySelectorAll('*')]){
    if(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','FORM','INPUT','BUTTON','IMG','SVG','TEMPLATE'].includes(element.tagName)){element.remove();continue}
    for(const attribute of [...element.attributes]){
      const name=attribute.name.toLowerCase();
      if(!['href','id','class','role','aria-label','display','mathvariant'].includes(name))element.removeAttribute(attribute.name);
      if(name==='href'&&!/^(https?:\/\/|mailto:|#)/i.test(attribute.value))element.removeAttribute(attribute.name);
    }
  }
  return doc.body.innerHTML.trim();
}
function sectionsFromBody(body){
  const doc=new DOMParser().parseFromString(body,'text/html');
  const used=new Set();
  const sections=[...doc.querySelectorAll('h2')].map((heading,index)=>{
    let id=heading.id||slug(heading.textContent)||`section-${index+1}`;
    while(used.has(id))id+=`-${index+1}`;
    used.add(id);heading.id=id;
    return {id,title:heading.textContent.trim()};
  });
  return {body:doc.body.innerHTML,sections};
}
function dateRank(date){
  const time=Date.parse(`1 ${date}`);
  return Number.isFinite(time)?time:0;
}
async function publish(nextPosts,message){
  if(busy)return;
  busy=true;$('#publish').disabled=true;notice('Publishing…');
  try{
    const source=JSON.stringify(nextPosts,null,2)+'\n';
    const result=await github(api,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,content:bytesToBase64(encoder.encode(source)),sha:fileSha,branch:'main'})});
    fileSha=result.content.sha;
    posts=nextPosts;
    dirty=false;
    renderList();renderEditor();
    notice('Published. GitHub Pages may take a minute or two to show the change.','success');
  }catch(error){notice(error.message,'error')}
  finally{busy=false;$('#publish').disabled=false}
}

$('#setup-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const setupForm=event.currentTarget;
  const data=new FormData(setupForm);
  const passphrase=String(data.get('passphrase'));
  if(passphrase!==data.get('confirm')){notice('The passphrases do not match.','error');return}
  token=String(data.get('token')).trim();
  notice('Checking GitHub access…');
  try{
    await confirmOwner();
    localStorage.setItem(vaultKey,await encryptToken(token,passphrase));
    setupForm.reset();showWorkspace();
  }catch(error){token=null;notice(error.message,'error')}
});
$('#unlock-form').addEventListener('submit',async event=>{
  event.preventDefault();notice('Unlocking…');
  const unlockForm=event.currentTarget;
  try{
    token=await decryptToken(localStorage.getItem(vaultKey),String(new FormData(unlockForm).get('passphrase')));
    await confirmOwner();unlockForm.reset();showWorkspace();
  }catch(error){token=null;notice(error.name==='OperationError'?'That passphrase did not unlock the editor.':error.message,'error')}
});
$('#lock').addEventListener('click',lockEditor);
$('#reset').addEventListener('click',()=>{
  if(!confirm('Remove this browser’s saved editor setup? Your published posts will stay online.'))return;
  localStorage.removeItem(vaultKey);token=null;unlock.hidden=true;setup.hidden=false;notice('');
});
$('#new-post').addEventListener('click',()=>{if(!canLeave())return;selectedId=null;renderList();renderEditor();form.elements.title.focus()});
form.addEventListener('input',()=>{dirty=true});
editor.addEventListener('input',()=>{dirty=true});
$('.format-toolbar').addEventListener('mousedown',event=>{if(event.target.closest('button'))event.preventDefault()});
$('.format-toolbar').addEventListener('click',event=>{
  const button=event.target.closest('[data-format]');if(!button)return;
  editor.focus();document.execCommand(button.dataset.format,false,button.dataset.value||null);dirty=true;
});
$('#add-link').addEventListener('click',()=>{
  const value=prompt('Link URL (https://...)');if(!value)return;
  if(!/^https?:\/\//i.test(value)){notice('Use a full https:// link.','error');return}
  editor.focus();document.execCommand('createLink',false,value);dirty=true;
});
form.addEventListener('submit',event=>{
  event.preventDefault();
  const data=new FormData(form);
  const title=String(data.get('title')).trim();
  const body=cleanBody(editor.innerHTML);
  if(!body||!editor.textContent.trim()){notice('Add some essay text before publishing.','error');return}
  const existing=currentPost();
  let id=existing?.id||slug(title);
  if(!id){notice('The title needs at least one letter or number.','error');return}
  if(!existing&&posts.some(post=>post.id===id)){notice('A post with this title already exists.','error');return}
  const normalized=sectionsFromBody(body);
  const post={id,title,subtitle:String(data.get('subtitle')).trim(),byline:String(data.get('byline')).trim(),date:String(data.get('date')).trim(),tag:existing?.tag||'ESSAY',excerpt:String(data.get('excerpt')).trim()||String(data.get('subtitle')).trim(),body:normalized.body,sections:normalized.sections};
  selectedId=id;
  const next=posts.filter(item=>item.id!==id);
  next.unshift(post);
  next.sort((a,b)=>dateRank(b.date)-dateRank(a.date));
  publish(next,`${existing?'Update':'Add'} blog post: ${title}`);
});
$('#delete-post').addEventListener('click',()=>{
  const post=currentPost();if(!post)return;
  if(!confirm(`Delete “${post.title}” from the public blog?`))return;
  const next=posts.filter(item=>item.id!==post.id);
  selectedId=next[0]?.id||null;
  publish(next,`Remove blog post: ${post.title}`);
});
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue=''}});
if(localStorage.getItem(vaultKey))unlock.hidden=false;else setup.hidden=false;
