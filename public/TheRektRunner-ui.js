const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight*0.8;
let x=50,y=canvas.height/2,v=0;
function loop(){
 ctx.clearRect(0,0,canvas.width,canvas.height);
 ctx.fillStyle="#00ff66";
 ctx.fillRect(x,y,10,10);
 y+=v; v+=0.5;
 if(y>canvas.height-10){y=canvas.height-10;v=0;}
 requestAnimationFrame(loop);
}
window.addEventListener("touchstart",()=>{v=-10;});
loop();