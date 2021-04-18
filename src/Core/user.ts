import {QVoting} from "./QVoteAglorand"
import * as algosdk from "algosdk" 


(async () => {
	const baseServer = 'https://testnet-algorand.api.purestake.io/ps2'
	const port = '';
	const token = {
		'X-API-Key': process.env.PURESTAKE_ALGORAND_API
	}
	const creatorMnemonic = "brush travel spot crumble network trigger kind pear depth warm dash assault poet jump frown aim embrace clog obtain simple six perfect junk abstract speak"

	const creatorAccount = algosdk.mnemonicToSecretKey(creatorMnemonic);
	const userMnemonic = "menu circle frozen typical radio cry various shrug chef dance inmate obtain trouble absent food bicycle twice bench undo rice snow click ability abstract mystery";

	// NOTE this client is the one that will be injected from the wallet, with sign capabilites. In general the sdk need to be helpful even without this.
	// right now there's no difference between which one we use, both need to be given the privatekey to sign
	// const signerClient = new algosdk.Algodv2(token, baseServer, port); 

	try{

		const startTime = Math.round(Date.now() / 1000)
		const registrationSeconds = 300	
		const assetId = 13164495;
		const assetCoefficient = 2;
		const decisionName = "muchdecision"
		const options = ["first", "second", "third"]

		const qv = new QVoting(10, token, baseServer, port);
		const deployTx = await qv.buildDeployTx(creatorAccount.addr, startTime, registrationSeconds, assetId, assetCoefficient, decisionName, options);

		const txId = deployTx.txID().toString();
		console.log("built tx", txId);

		let signedTxn = deployTx.signTxn(creatorAccount.sk);
		console.log("Signed transaction with txID: %s", txId);

		await qv.sendSignedTx(signedTxn)
		console.log("SENT")

		await qv.waitForConfirmation(txId);
		const appID = await qv.getAppId()
		console.log(appID)
	} catch (e) {
		console.log(e)
	}

})()
