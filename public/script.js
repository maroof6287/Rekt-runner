import { sdk } from "https://esm.sh/@farcaster/miniapp-sdk";
import { Attribution } from "https://esm.sh/ox/erc8021";

const BUILDER_CODE = "bc_3s8mexvy"; // base.dev -> Settings -> Builder Code
const RECIPIENT = "0x04514c3d1a7074E6972190A5632875F4d14785F8";

window.addEventListener("load", async () => {
  const isMini = await sdk.isInMiniApp();
  document.getElementById("status").innerText = isMini ? "Mini App Mode" : "Browser Mode";
  await sdk.actions.ready();
});
