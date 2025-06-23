import initEmscriptenModule from './emulator/out.js';
import './vendor/xterm.js';
import './vendor/xterm-pty.js';

let Module = { preRun: [], arguments: [] };
let term;
let currentVM = null;
let vms = JSON.parse(localStorage.getItem('vms') || '[]');
let ramTestResult = localStorage.getItem('ramTest');

const vmList = document.getElementById('vm-list');
const manager = document.getElementById('manager');
const controls = document.getElementById('controls');
const currentVMEl = document.getElementById('current-vm');
const createBtn = document.getElementById('create-vm');
const vmNameInput = document.getElementById('vm-name');
const startBtn = document.getElementById('start-vm');
const isoUpload = document.getElementById('iso-upload');
const graphicsMode = document.getElementById('graphics-mode');
const screen = document.getElementById('screen');
const runRamTestBtn = document.getElementById('run-ramtest');
const log = document.getElementById('log');

let isoDBPromise = null;

function openIsoDB(){
  if(!isoDBPromise){
    isoDBPromise = new Promise((resolve,reject)=>{
      const req = indexedDB.open('iso-storage',1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('isos');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return isoDBPromise;
}

async function saveIso(file){
  const db = await openIsoDB();
  return new Promise((res,rej)=>{
    const tx = db.transaction('isos','readwrite');
    tx.objectStore('isos').put(file,'uploaded');
    tx.oncomplete=()=>res();
    tx.onerror=e=>rej(e.target.error);
  });
}

async function loadIso(){
  const db = await openIsoDB();
  return new Promise((res,rej)=>{
    const tx = db.transaction('isos','readonly');
    const rq = tx.objectStore('isos').get('uploaded');
    rq.onsuccess=()=>res(rq.result);
    rq.onerror=e=>rej(e.target.error);
  });
}

function logMsg(msg){
  log.textContent += msg + '\n';
}

function saveVMs(){
  localStorage.setItem('vms', JSON.stringify(vms));
}

function refreshList(){
  vmList.innerHTML = '';
  vms.forEach((vm,i)=>{
    const div=document.createElement('div');
    div.textContent=vm.name;
    const btn=document.createElement('button');
    btn.textContent='Open';
    btn.onclick=()=>openVM(i);
    div.appendChild(btn);
    vmList.appendChild(div);
  });
}

function openVM(idx){
  currentVM=vms[idx];
  currentVMEl.textContent=currentVM.name;
  manager.classList.add('hidden');
  controls.classList.remove('hidden');
}

createBtn.onclick=()=>{
  if(vmNameInput.value.trim()){
    vms.push({name:vmNameInput.value.trim(), ram:ramTestResult?Math.floor(ramTestResult/2):256});
    saveVMs();
    refreshList();
    vmNameInput.value='';
  }
};

isoUpload.addEventListener('change', async () => {
  if(!isoUpload.files[0]) return;
  startBtn.disabled = true;
  logMsg('Saving ISO...');
  await saveIso(isoUpload.files[0]);
  logMsg('ISO saved');
  startBtn.disabled = false;
});

startBtn.onclick=async()=>{
  let isoBlob = await loadIso();
  if(!isoBlob){
    alert('Upload an ISO or IMG and wait for it to be saved');
    return;
  }
  let isoBuffer = await isoBlob.arrayBuffer();
  Module = { preRun: [], arguments: [] };
  Module.print = logMsg;
  Module.printErr = logMsg;
  let master, slave;
  if(!graphicsMode.checked){
    ({ master, slave } = openpty());
    term = new Terminal();
    term.open(document.getElementById('terminal'));
    term.loadAddon(master);
    Module.pty = slave;
    screen.classList.add('hidden');
    document.getElementById('terminal').classList.remove('hidden');
  } else {
    Module.canvas = screen;
    document.getElementById('terminal').classList.add('hidden');
    screen.classList.remove('hidden');
  }
  Module.preRun.push(()=>{
    Module.FS.mkdir('/img');
    Module.FS.writeFile('/img/user.iso', new Uint8Array(isoBuffer));
    isoBuffer = null;
    Module.FS.mkdir('/persistent');
    Module.FS.mount(IDBFS,{},'/persistent');
  });
  Module.postRun = [()=>{
    setInterval(()=>Module.FS.syncfs(false,()=>logMsg('autosaved')),30000);
  }];
  Module.arguments=[
    '-d','guest_errors', '-D','/dev/stderr',
    '-m', currentVM.ram+'M','-accel','tcg,tb-size=500',
    '-cdrom','/img/user.iso'
  ];
  if(!graphicsMode.checked){
    Module.arguments.unshift('-nographic');
  }
  Module.locateFile=(path,prefix)=>'./emulator/'+path;
  Module.mainScriptUrlOrBlob='./emulator/out.js';
  logMsg('Starting VM...');
  await initEmscriptenModule(Module);
};

runRamTestBtn.onclick=()=>{
  let size=64*1024*1024; // start 64MB
  let max=0;
  try{
    while(true){
      let arr=new Uint8Array(size);
      for(let i=0;i<arr.length;i+=4096){arr[i]=1;}
      max=size; size+=64*1024*1024;
    }
  }catch(e){
    logMsg('Max RAM usable '+(max/1024/1024)+'MB');
    localStorage.setItem('ramTest', max/1024/1024);
    ramTestResult=max/1024/1024;
  }
};

refreshList();
if(ramTestResult){
  logMsg('Last RAM test: '+ramTestResult+'MB');
}

navigator.serviceWorker.register('emulator/coi-serviceworker.js');
