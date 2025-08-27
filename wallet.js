import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@5.7.2/dist/ethers.esm.min.js";

let web3Modal;
let provider;
let signer;
let walletAddress = null;

async function initWallet() {
  if (web3Modal) return;

  const providerOptions = {
    walletconnect: {
      package: window.WalletConnectProvider, 
      options: {
        projectId: "7a57f2c18d39463c142588ecf6d87d1a",
        chains: [1],
        showQrModal: true
      }
    }
  };

  web3Modal = new window.Web3Modal.default({ 
    cacheProvider: false,
    providerOptions,
    theme: "dark"
  });
}

export async function connectWallet() {
  await initWallet();

  try {
    const instance = await web3Modal.connect();
    provider = new ethers.providers.Web3Provider(instance);
    signer = provider.getSigner();
    walletAddress = await signer.getAddress();

    document.getElementById("connectWallet").innerText =
      walletAddress.slice(0, 6) + "..." + walletAddress.slice(-4);

    console.log("✅ Wallet connected:", walletAddress);
    return walletAddress;
  } catch (err) {
    console.error("❌ Wallet connection failed:", err);
  }
}

document.getElementById("connectWallet").addEventListener("click", async () => {
  await connectWallet();
});