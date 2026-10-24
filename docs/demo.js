let count=0;
function record(text){count++;document.getElementById('result').textContent=text;document.getElementById('count').textContent=count+' activations';}
document.querySelectorAll('[data-course]').forEach(b=>b.addEventListener('click',()=>{const status=document.getElementById('status-'+b.dataset.course);status.textContent=status.textContent==='In progress'?'Paused':'In progress';b.textContent=status.textContent==='In progress'?'Pause':'Start';record(status.textContent+': '+b.closest('tr').querySelector('th').textContent);}));
document.querySelectorAll('[data-details]').forEach(b=>b.addEventListener('click',()=>record('Details: '+b.closest('tr').querySelector('th').textContent)));
document.getElementById('reminders').addEventListener('change',e=>record('Reminders '+(e.target.checked?'on':'off')));
document.getElementById('practice-form').addEventListener('submit',e=>{e.preventDefault();record('Nickname saved in this demo');});
document.getElementById('far-button').addEventListener('click',()=>record('Advanced lesson started'));
