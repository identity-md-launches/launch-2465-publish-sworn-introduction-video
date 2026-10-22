// Replays every eth_call in artifacts/cards/PROVENANCE.json and checks the SVG sha256.
// usage: RPC=<ethereum rpc url> node video/verify-cards.cjs
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { encodeFunctionData, decodeFunctionResult, parseAbi } = require("viem");

const RPC = process.env.RPC || "https://ethereum-rpc.publicnode.com";
const abi = parseAbi(["function tokenURI(uint256) view returns (string)", "function tokenURIOf(address,uint256) view returns (string)"]);
const prov = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "artifacts/cards/PROVENANCE.json"), "utf8"));

(async () => {
  let bad = 0;
  for (const c of prov.cards) {
    const fn = c.function.split("(")[0];
    const args = fn === "tokenURI" ? [BigInt(c.arguments[0])] : [c.arguments[0], BigInt(c.arguments[1])];
    const params = [{ to: c.contract, data: encodeFunctionData({ abi, functionName: fn, args }) }, "0x" + c.block.toString(16)];
    if (c.stateOverride) params.push(c.stateOverride);
    const r = await (await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params }) })).json();
    if (r.error) throw new Error(JSON.stringify(r.error));
    const uri = decodeFunctionResult({ abi, functionName: fn, data: r.result });
    const img = JSON.parse(Buffer.from(uri.replace(/^data:application\/json;base64,/, ""), "base64").toString("utf8")).image;
    const svg = decodeURIComponent(img.replace(/^data:image\/svg\+xml(;utf8|;charset=utf-8)?,/, ""));
    const sha = crypto.createHash("sha256").update(svg, "utf8").digest("hex");
    const fileSha = crypto.createHash("sha256").update(fs.readFileSync(path.join(__dirname, "..", "artifacts/cards", c.file))).digest("hex");
    const ok = sha === c.sha256 && fileSha === c.sha256;
    if (!ok) bad++;
    console.log(ok ? "ok  " : "FAIL", c.file, sha);
  }
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
