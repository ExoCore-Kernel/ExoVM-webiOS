import initEmscriptenModule from './emulator/out.js';
import 'https://unpkg.com/xterm@5.3.0/lib/xterm.js';
import 'https://unpkg.com/xterm-pty/index.js';

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
const runRamTestBtn = document.getElementById('run-ramtest');
const backBtn = document.getElementById('back');
const log = document.getElementById('log');

function logMsg(msg){
  log.textContent += msg + '\n';
}

function saveVMs(){
  localStorage.setItem('vms', JSON.stringify(vms));
}

function refreshList(){
  vmList.innerHTML = '';
  if(ramTestResult){
    const info=document.createElement('div');
    info.textContent='Last RAM test: '+ramTestResult+'MB';
    vmList.appendChild(info);
  }
  vms.forEach((vm,i)=>{
    const div=document.createElement('div');
    const name=document.createElement('span');
    name.textContent=vm.name;
    const open=document.createElement('button');
    open.textContent='Open';
    open.onclick=()=>openVM(i);
    const del=document.createElement('button');
    del.textContent='Delete';
    del.onclick=()=>{ vms.splice(i,1); saveVMs(); refreshList(); };
    div.appendChild(name);
    div.appendChild(open);
    div.appendChild(del);
    vmList.appendChild(div);
  });
}

function openVM(idx){
  currentVM=vms[idx];
  currentVMEl.textContent=currentVM.name;
  manager.classList.add('hidden');
  controls.classList.remove('hidden');
}

backBtn.onclick=()=>{
  controls.classList.add('hidden');
  manager.classList.remove('hidden');
  log.textContent='';
  document.getElementById('terminal').innerHTML='';
};

createBtn.onclick=()=>{
  if(vmNameInput.value.trim()){
    vms.push({name:vmNameInput.value.trim(), ram:ramTestResult?Math.floor(ramTestResult/2):256});
    saveVMs();
    refreshList();
    vmNameInput.value='';
  }
};

startBtn.onclick=async()=>{
  if(!isoUpload.files[0]){
    alert('Upload an ISO or IMG');
    return;
  }
  const buf=await isoUpload.files[0].arrayBuffer();
  Module = { preRun: [], arguments: [] };
  const { master, slave } = openpty();
  term = new Terminal();
  term.open(document.getElementById('terminal'));
  term.loadAddon(master);
  Module.pty = slave;
  Module.preRun.push(()=>{
    Module.FS.mkdir('/img');
    Module.FS.writeFile('/img/user.iso', new Uint8Array(buf));
    Module.FS.mkdir('/persistent');
    Module.FS.mount(IDBFS,{},'/persistent');
    Module.FS.syncfs(true,()=>logMsg('state loaded'));
  });
  Module.postRun = [()=>{
    setInterval(()=>Module.FS.syncfs(false,()=>logMsg('autosaved')),30000);
  }];
  Module.arguments=[
    '-nographic','-m', currentVM.ram+'M','-accel','tcg,tb-size=500',
    '-cdrom','/img/user.iso'
  ];
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
