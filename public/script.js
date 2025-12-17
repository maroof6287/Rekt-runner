import { sdk } from "https://esm.sh/@farcaster/miniapp-sdk";
import { Attribution } from "https://esm.sh/ox/erc8021";

const BUILDER_CODE = "TODO_REPLACE_BUILDER_CODE"; // base.dev -> Settings -> Builder Code
const RECIPIENT = "0x0000000000000000000000000000000000000000";

window.addEventListener("load", async () => {
  const isMini = await sdk.isInMiniApp();
  document.getElementById("status").innerText = isMini ? "Mini App Mode" : "Browser Mode";
  await sdk.actions.ready();
});
