// The booth keeps every frame in this browser. Nothing is uploaded.
export function mountPhotoBooth(dialog){
  const video=dialog.querySelector('.booth-video');
  const start=dialog.querySelector('.booth-start');
  const shoot=dialog.querySelector('.booth-shoot');
  const download=dialog.querySelector('.booth-download');
  const strip=dialog.querySelector('.booth-strip');
  const status=dialog.querySelector('.booth-status');
  let stream=null;
  let photos=[];
  let closed=false;
  let capturing=false;
  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

  function setStatus(message){status.textContent=message}
  function stop(){
    closed=true;
    stream?.getTracks().forEach(track=>track.stop());
    stream=null;
    video.srcObject=null;
  }
  dialog.addEventListener('close',stop,{once:true});

  start.addEventListener('click',async()=>{
    if(stream)return;
    if(!navigator.mediaDevices?.getUserMedia){setStatus('Camera access needs a secure browser connection.');return}
    start.disabled=true;
    setStatus('Waiting for camera permission…');
    try{
      const opened=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'user',width:{ideal:1280},height:{ideal:960}}});
      if(closed){opened.getTracks().forEach(track=>track.stop());return}
      stream=opened;
      dialog.querySelector('.booth-camera').classList.add('has-camera');
      video.srcObject=stream;
      await video.play();
      if(!video.videoWidth)await new Promise(resolve=>video.addEventListener('loadedmetadata',resolve,{once:true}));
      start.hidden=true;
      shoot.disabled=false;
      setStatus('Ready. Four photos, three seconds between each one.');
    }catch(error){
      stream?.getTracks().forEach(track=>track.stop());
      stream=null;video.srcObject=null;
      dialog.querySelector('.booth-camera').classList.remove('has-camera');
      start.disabled=false;
      setStatus(error.name==='NotAllowedError'?'Camera permission was declined. You can try again.':'Camera unavailable. Check that another app is not using it.');
    }
  });

  function snap(){
    const canvas=document.createElement('canvas');
    canvas.width=800;canvas.height=600;
    const ctx=canvas.getContext('2d');
    const scale=Math.max(canvas.width/video.videoWidth,canvas.height/video.videoHeight);
    const width=video.videoWidth*scale,height=video.videoHeight*scale;
    ctx.translate(canvas.width,0);ctx.scale(-1,1);
    ctx.drawImage(video,(canvas.width-width)/2,(canvas.height-height)/2,width,height);
    return canvas.toDataURL('image/png');
  }
  function renderStrip(){
    strip.replaceChildren(...Array.from({length:4},(_,index)=>{
      const slot=document.createElement('span');
      slot.className='booth-slot';
      if(photos[index]){
        const img=document.createElement('img');
        img.src=photos[index];
        img.alt=`Photo ${index+1} of 4`;
        slot.classList.add('is-filled');
        slot.append(img);
      }else{
        slot.textContent=String(index+1).padStart(2,'0');
        slot.setAttribute('aria-label',`Photo ${index+1} pending`);
      }
      return slot;
    }));
    strip.setAttribute('aria-label',`Photo strip, ${photos.length} of 4 photos taken`);
  }
  renderStrip();
  shoot.addEventListener('click',async()=>{
    if(!stream||capturing)return;
    capturing=true;
    photos=[];renderStrip();download.disabled=true;shoot.disabled=true;
    for(let i=0;i<4&&!closed;i++){
      for(let count=3;count>0&&!closed;count--){setStatus(`Photo ${i+1} of 4 in ${count}…`);await delay(800)}
      if(closed)break;
      photos.push(snap());renderStrip();
      setStatus(`Photo ${i+1} of 4 taken.`);
      await delay(280);
    }
    capturing=false;
    if(!closed){shoot.disabled=false;download.disabled=photos.length!==4;setStatus(photos.length===4?'Your strip is ready. Choose a frame, then download.':'Camera session ended.');}
  });

  dialog.querySelectorAll('[name="booth-frame"]').forEach(input=>input.addEventListener('change',()=>{
    strip.dataset.frame=input.value;
  }));
  download.addEventListener('click',async()=>{
    if(photos.length!==4)return;
    const frame=dialog.querySelector('[name="booth-frame"]:checked').value;
    const colors={cream:['#f5f0e6','#292722'],ink:['#252525','#f6f0e6'],rose:['#e8cad0','#30282b']};
    const [paper,letter]=colors[frame];
    const canvas=document.createElement('canvas');
    canvas.width=900;canvas.height=2910;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle=paper;ctx.fillRect(0,0,canvas.width,canvas.height);
    for(let i=0;i<4;i++){
      const image=new Image();image.src=photos[i];await image.decode();
      ctx.drawImage(image,55,100+i*660,790,592);
    }
    ctx.fillStyle=letter;
    ctx.font='26px Georgia';ctx.textAlign='center';
    ctx.fillText('four little moments',450,2814);
    const link=document.createElement('a');
    link.download='stephs-photo-booth.png';
    link.href=canvas.toDataURL('image/png');
    link.click();
  });
}
