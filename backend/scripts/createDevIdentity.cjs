const fs = require('fs');
const path = require('path');
const { Wallets } = require('fabric-network');

async function createDevIdentity() {
  try {
    // Create a wallet directory
    const walletPath = path.join(process.cwd(), 'fabric-config', 'wallet');
    const wallet = await Wallets.newFileSystemWallet(walletPath);

    // Check if the identity already exists
    const identity = await wallet.get('appUser');
    if (identity) {
      console.log('Identity "appUser" already exists in the wallet');
      return;
    }

    // Create a test identity (for development only!)
    const cert = fs.readFileSync(path.join(__dirname, '../test/fixtures/dev-cert.pem')).toString();
    const key = fs.readFileSync(path.join(__dirname, '../test/fixtures/dev-key.pem')).toString();
    
    // Import the identity to wallet
    const identityLabel = 'appUser';
    const identityJson = {
      credentials: {
        certificate: cert,
        privateKey: key,
      },
      mspId: 'Org1MSP',
      type: 'X.509',
    };

    await wallet.put(identityLabel, identityJson);
    console.log(`Successfully added identity "${identityLabel}" to the wallet`);
    
  } catch (error) {
    console.error(`Failed to create development identity: ${error}`);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

createDevIdentity();
