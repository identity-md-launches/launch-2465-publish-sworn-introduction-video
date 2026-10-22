// Fetches every Sworn card used in the video straight from the deployed Renderer
// on Ethereum mainnet and writes artifacts/cards/*.svg + PROVENANCE.json.
// usage: RPC=<ethereum rpc url> node video/fetch-cards.cjs [block]
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { encodeFunctionData, decodeFunctionResult, parseAbi, keccak256, encodeAbiParameters, pad, toHex } = require("viem");

const RPC = process.env.RPC || "https://ethereum-rpc.publicnode.com";
const REGISTRY = "0x0da2679000ea5380d1361cc3cca7d4e8c881f766";
const RENDERER = "0x3039eaf3b979759c77a2a3fc62850f9534162c3b";
const abi = parseAbi([
  "function tokenURI(uint256) view returns (string)",
  "function tokenURIOf(address,uint256) view returns (string)",
  "function ownerOf(uint256) view returns (address)",
  "function claimantOf(uint256) view returns (address)",
]);
const OUT = path.join(__dirname, "..", "artifacts", "cards");

async function rpc(method, params) {
  const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = await r.json();
  if (j.error) throw new Error(method + ": " + JSON.stringify(j.error));
  return j.result;
}
async function call(to, fn, args, blockHex, override) {
  const data = encodeFunctionData({ abi, functionName: fn, args });
  const params = [{ to, data }, blockHex];
  if (override) params.push(override);
  return decodeFunctionResult({ abi, functionName: fn, data: await rpc("eth_call", params) });
}
const slotOf = (key, slot, type) => keccak256(encodeAbiParameters([{ type }, { type: "uint256" }], [key, BigInt(slot)]));
const bitOf = (id) => (Math.floor(id / 100) - 1) * 4 + (id % 100) - 1;
function svgFromUri(uri) {
  const b64 = uri.replace(/^data:application\/json;base64,/, "");
  const meta = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  const img = meta.image;
  const m = img.match(/^data:image\/svg\+xml(;utf8|;charset=utf-8)?,(.*)$/s);
  if (m) return decodeURIComponent(m[2]);
  const m64 = img.match(/^data:image\/svg\+xml;base64,(.*)$/s);
  if (m64) return Buffer.from(m64[1], "base64").toString("utf8");
  throw new Error("unexpected image uri " + img.slice(0, 60));
}

(async () => {
  const block = process.argv[2] ? Number(process.argv[2]) : Number(await rpc("eth_blockNumber", [])) - 5;
  const blockHex = "0x" + block.toString(16);
  const blk = await rpc("eth_getBlockByNumber", [blockHex, false]);
  if (Number(blk.number) !== block) throw new Error("wrong block");
  fs.mkdirSync(OUT, { recursive: true });
  const entries = [];
  const save = (file, svg, rec) => {
    fs.writeFileSync(path.join(OUT, file), svg);
    entries.push({ file, ...rec, block, blockHash: blk.hash, sha256: crypto.createHash("sha256").update(svg, "utf8").digest("hex") });
    console.log(file, svg.length);
  };
  for (const id of [1n, 2n, 3n]) {
    const uri = await call(REGISTRY, "tokenURI", [id], blockHex);
    save(`card-${id}.svg`, svgFromUri(uri), { contract: REGISTRY, contractName: "Registry", function: "tokenURI(uint256)", arguments: [id.toString()], stateOverride: null });
  }
  // preview wallet: the real claimant of minted card #1 (a wallet already in the registry)
  const wallet = (await call(REGISTRY, "claimantOf", [1n], blockHex)).toLowerCase();
  const steps = [[101], [101, 201, 202], [101, 201, 202, 301, 302, 303], [101, 201, 202, 301, 302, 303, 401, 402], [101, 201, 202, 301, 302, 303, 401, 402, 501, 502]];
  for (const ids of steps) {
    let mask = 0n;
    for (const id of ids) mask |= 1n << BigInt(bitOf(id));
    const stateDiff = {
      [slotOf(wallet, 14, "address")]: pad(toHex(1n), { size: 32 }),
      [slotOf(1n, 15, "uint256")]: pad(wallet, { size: 32 }),
      [slotOf(1n, 17, "uint256")]: pad(toHex(mask), { size: 32 }),
    };
    const override = { [REGISTRY]: { stateDiff } };
    const uri = await call(RENDERER, "tokenURIOf", [REGISTRY, 1n], blockHex, override);
    save(`preview-${ids.length}.svg`, svgFromUri(uri), {
      contract: RENDERER, contractName: "Renderer", function: "tokenURIOf(address,uint256)", arguments: [REGISTRY, "1"],
      stateOverride: { [REGISTRY]: { stateDiff } },
      stateOverrideMeaning: { wallet, "tokenOf(wallet) [slot 14]": "1", "claimantOf(1) [slot 15]": wallet, "frozenDirect(1) [slot 17]": "0x" + mask.toString(16), directFactIds: ids },
    });
  }
  fs.writeFileSync(path.join(OUT, "PROVENANCE.json"), JSON.stringify({
    chain: "Ethereum mainnet (chainId 1)", rpc: "https://ethereum-rpc.publicnode.com", method: "eth_call at the block below; tokenURI/tokenURIOf return base64 JSON whose image is a data:image/svg+xml URI, URL-decoded byte for byte into the .svg file",
    sha256Of: "the .svg file bytes (UTF-8)", cards: entries,
  }, null, 2) + "\n");
})().catch((e) => { console.error(e); process.exit(1); });
