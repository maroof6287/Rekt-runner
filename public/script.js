import { sdk } from "https://esm.sh/@farcaster/miniapp-sdk";
import { Attribution } from "https://esm.sh/ox/erc8021";

// Base mainnet USDC
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDC_DECIMALS = 6;

const BUILDER_CODE = "TODO_REPLACE_BUILDER_CODE"; // base.dev -> Settings -> Builder Code
const RECIPIENT = "0x0000000000000000000000000000000000000000"; // TODO: replace with your tip recipient address (EVM)

const BASE_MAINNET = "0x2105";
const BASE_SEPOLIA = "0x14a34";

function $(id){ return document.getElementById(id); }

function toast(msg){
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._to);
  toast._to = setTimeout(()=>t.classList.remove("show"), 2400);
}

function isHexAddress(a){
  return /^0x[a-fA-F0-9]{40}$/.test(a);
}

function strip0x(h){ return h.startsWith("0x") ? h.slice(2) : h; }

function pad32(hexNo0x){
  return hexNo0x.padStart(64, "0");
}

function toHex(n){ // BigInt -> 0x...
  const h = n.toString(16);
  return "0x" + (h.length ? h : "0");
}

function parseAmountToUnits(amountStr){
  const s = String(amountStr || "").trim();
  if(!/^\d+(\.\d+)?$/.test(s)) throw new Error("Enter a valid number.");
  if(s === "0" || s === "0.0" || s === "0.00") throw new Error("Amount must be > 0.");

  const [whole, fracRaw=""] = s.split(".");
  const frac = (fracRaw + "0".repeat(USDC_DECIMALS)).slice(0, USDC_DECIMALS);
  const units = BigInt(whole) * (10n ** BigInt(USDC_DECIMALS)) + BigInt(frac);
  if(units <= 0n) throw new Error("Amount must be > 0.");
  return units;
}

function encodeErc20Transfer(to, units){
  // transfer(address,uint256) selector = a9059cbb
  const selector = "a9059cbb";
  const toPadded = pad32(strip0x(to).toLowerCase());
  const amtPadded = pad32(units.toString(16));
  return "0x" + selector + toPadded + amtPadded;
}

async function ensureBaseChain(){
  if(!window.ethereum) throw new Error("No wallet detected.");
  const chainId = await window.ethereum.request({ method: "eth_chainId" });
  if(chainId === BASE_MAINNET || chainId === BASE_SEPOLIA) return chainId;

  try{
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: BASE_MAINNET }]
    });
    return BASE_MAINNET;
  }catch(e){
    throw new Error("Please switch to Base network in your wallet.");
  }
}

function canSend(){
  if(BUILDER_CODE === "TODO_REPLACE_BUILDER_CODE") return false;
  if(!isHexAddress(RECIPIENT) || RECIPIENT.toLowerCase() === "0x0000000000000000000000000000000000000000") return false;
  return true;
}

function setSheetOpen(open){
  const back = $("sheetBack");
  const sheet = $("sheet");
  if(open){
    back.classList.add("open");
    sheet.classList.add("open");
    sheet.setAttribute("aria-hidden","false");
  }else{
    back.classList.remove("open");
    sheet.classList.remove("open");
    sheet.setAttribute("aria-hidden","true");
  }
}

function setSendLabel(label, enabled){
  const btn = $("sendBtn");
  btn.textContent = label;
  btn.classList.toggle("disabled", !enabled);
  btn.classList.toggle("ok", !!enabled);
  btn.disabled = !enabled;
}

async function animatePreTx(ms=1200){
  const barWrap = $("prepBar");
  const bar = barWrap.querySelector("i");
  barWrap.style.display = "block";
  bar.style.width = "0%";
  const start = performance.now();
  await new Promise(resolve=>{
    function step(t){
      const p = Math.min(1, (t-start)/ms);
      bar.style.width = (p*100).toFixed(1) + "%";
      if(p >= 1) resolve();
      else requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });
  barWrap.style.display = "none";
}

window.addEventListener("load", async () => {
  // 1) Detect env
  const isMini = await sdk.isInMiniApp();

  // 2) Always ready
  await sdk.actions.ready();

  $("mode").textContent = isMini ? "Mini App Mode" : "Browser Mode";

  // --- Tip sheet wiring ---
  let selected = "1"; // dollars as string
  const presetRow = $("presetRow");
  const custom = $("customAmt");

  function markPills(){
    [...presetRow.querySelectorAll(".pill")].forEach(b=>{
      b.classList.toggle("active", b.dataset.amt === selected);
    });
  }
  markPills();

  presetRow.addEventListener("click", (e)=>{
    const b = e.target.closest("button[data-amt]");
    if(!b) return;
    selected = b.dataset.amt;
    custom.value = "";
    markPills();
  });

  $("useCustom").addEventListener("click", ()=>{
    if(!custom.value.trim()) { toast("Type a custom amount first."); return; }
    selected = custom.value.trim();
    markPills();
  });

  $("tipBtn").addEventListener("click", ()=> setSheetOpen(true));
  $("closeSheet").addEventListener("click", ()=> setSheetOpen(false));
  $("sheetBack").addEventListener("click", ()=> setSheetOpen(false));

  // State machine
  const STATES = ["Send USDC","Preparing tip…","Confirm in wallet","Sending…","Send again"];
  let state = 0;

  function resetState(){
    state = 0;
    setSendLabel(STATES[state], canSend());
  }

  function showDisabledReason(){
    if(BUILDER_CODE === "TODO_REPLACE_BUILDER_CODE") toast("Set your BUILDER_CODE first (base.dev → Settings → Builder Code).");
    else toast("Set a valid RECIPIENT address first.");
  }

  resetState();

  $("sendBtn").addEventListener("click", async ()=>{
    if(!canSend()){ showDisabledReason(); resetState(); return; }

    try{
      // validate amount
      const units = parseAmountToUnits(selected);
      const data = encodeErc20Transfer(RECIPIENT, units);

      state = 1; setSendLabel(STATES[state], false);

      // Emotional UX BEFORE wallet opens
      await animatePreTx(1250);

      // wallet interactions
      if(!window.ethereum) throw new Error("No wallet detected.");
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const from = accounts?.[0];
      if(!from) throw new Error("No account available.");

      const chainId = await ensureBaseChain();

      state = 2; setSendLabel(STATES[state], false);

      const dataSuffix = Attribution.toDataSuffix({ codes: [BUILDER_CODE] });

      state = 3; setSendLabel(STATES[state], false);

      const params = [{
        version: "2.0.0",
        from,
        chainId,
        atomicRequired: true,
        calls: [{
          to: USDC,
          value: "0x0",
          data
        }],
        capabilities: { dataSuffix }
      }];

      // ERC-5792
      const result = await window.ethereum.request({
        method: "wallet_sendCalls",
        params
      });

      toast("Tip sent. Respect 🟩");
      state = 4; setSendLabel(STATES[state], true);

      // optional: give game a little boost moment
      window.RektUI?.flashBoost?.();

      return result;
    }catch(err){
      const msg = (err && (err.message || err.toString())) || "Transaction cancelled.";
      // gentle fallback on reject
      if(/denied|rejected|user/i.test(msg)){
        toast("No worries — tip cancelled.");
      }else{
        toast(msg);
      }
      resetState();
    }
  });

  // Let UI know mode
  window.RektUI?.setMode?.(isMini ? "mini" : "web");
});
