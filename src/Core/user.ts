import {QVoting} from "./QVoteAglorand"
import * as algosdk from "algosdk" 

const baseServer = 'https://testnet-algorand.api.purestake.io/ps2'
const port = '';
const token = {
	'X-API-Key': process.env.PURESTAKE_ALGORAND_API
}
const creatorMnemonic = "deposit stem walnut elbow attend million noble clay never left enlist pattern aerobic program rib orchard point odor guide chapter display obscure scare able fruit"

const creatorAccount = algosdk.mnemonicToSecretKey(creatorMnemonic);
const userMnemonic = "menu circle frozen typical radio cry various shrug chef dance inmate obtain trouble absent food bicycle twice bench undo rice snow click ability abstract mystery";



/*
 * Build object, get txs, deploy, init object to deployed contract, use object 
 */
async function deployNew () {
	try{
		const conf = {token: token, baseServer: baseServer, port: port}
		const params = {
			decisionName: "muchdecision", 
			votingStartTime: Math.round(Date.now() / 1000),
			votingEndTime: Math.round(Date.now() / 1000) + 300, 
			assetID: 333333,
			assetCoefficient: 2,
			options:  ["first", "second", "third"]
		}

		const qv = new QVoting(creatorAccount.addr, 10, conf, params) 
		const {appCreateTx, addOptionFns} = await qv.buildDeployTx()

		const txId = appCreateTx.txID().toString();
		console.log("built tx", txId);

		let signedTxn = appCreateTx.signTxn(creatorAccount.sk);
		console.log("Signed transaction with txID: %s", txId);

		await qv.sendSignedTx(signedTxn)
		console.log("SENT")

		await qv.waitForConfirmation(txId);
		const appID = await qv.getAppId()
		console.log(appID)

			
		// evaluate the addOptionTx generator functions, sign and send 
		const addOptionTxs = addOptionFns.map(f => f(appID))
		const signedAddOtionTxs = addOptionTxs.map(tx => tx.signTxn(creatorAccount.sk))
		const addOptiontxIDs = addOptionTxs.map(tx => tx.txID().toString()); 

		signedAddOtionTxs.map(tx => qv.sendSignedTx(tx))
		addOptiontxIDs.map(txID => {qv.waitForConfirmation(txID)})

		console.log("sign and send all the add options") 

		await qv.initState(appID);

		const state = await qv.readGlobalState();
		console.log(state);

		const results = await qv.getCurrentResults();
		console.log(results);

	} catch (e) {
		console.log(e)
	}

}

/*
 * Build object, init from existing appID state, use object 
 */
async function existingInstance(){
	try {
		const conf = {token: token, baseServer: baseServer, port: port}
		const qv = new QVoting(creatorAccount.addr, 10, conf)
		const appID = 15448562;
		await qv.initState(appID)
		console.log('created') 

		const state = await qv.readGlobalState();
		const results = await qv.getCurrentResults();
		console.log('STATE', state)
		console.log('RESULTS', results)
	} catch (e) {
		console.log(e);
	}
}


// TODO 
//
// test new object creation flow 
//
// --- QVoting
// voting 
// opt-in registration 
// read local state (getting user's balance for tokens) 
// add option after deploy (only need to test, this should already work) 
// convenience deploy as a single function 
// --- queue 
// --- algosigner 

(async () => {
	try {
		// await deployNew(); 
		await existingInstance();
	} catch (e) {
		console.log(e)
	}
})(); 


