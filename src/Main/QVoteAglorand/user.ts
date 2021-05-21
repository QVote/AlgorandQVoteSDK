// import {QVoting} from "."
// import * as algosdk from "algosdk" 

// const baseServer = 'https://testnet-algorand.api.purestake.io/ps2'
// const port = '';
// const token = {
// 	'X-API-Key': process.env.PURESTAKE_ALGORAND_API
// }
// const creatorMnemonic = "leopard wrestle history fog scare twist churn bullet action poet enter ketchup gasp media bonus joke anger month defy degree grit witness strategy able income"

// const creatorAccount = algosdk.mnemonicToSecretKey(creatorMnemonic);
// const userMnemonic = "menu circle frozen typical radio cry various shrug chef dance inmate obtain trouble absent food bicycle twice bench undo rice snow click ability abstract mystery";

// const userAccount = algosdk.mnemonicToSecretKey(userMnemonic);

// // NOTE ALL OF THIS HAS TO BE UPDATED 


// /*
//  * Build object, get txs, deploy, init object to deployed contract, use object 
//  */
// export async function deployNew() {
// 	try{
// 		const conf = {token: token, baseServer: baseServer, port: port}
// 		const registrationTime = 60;  // in seconds 
// 		const votingTime = 10*24*60*60   // 10 days to vote  
// 		const params = {
// 			decisionName: "muchdecision", 
// 			votingStartTime: Math.round(Date.now() / 1000) + registrationTime, 
// 			votingEndTime: Math.round(Date.now() / 1000) + registrationTime + votingTime, 
// 			assetID: 13164495,
// 			assetCoefficient: 2,
// 			options:  ["first", "second", "third"]
// 		}

// 		const qv = new QVoting(creatorAccount.addr, 10, conf, params) 
// 		const {appCreateTx, addOptionFns} = await qv.buildDeployTx()

// 		const txId = appCreateTx.txID().toString();
// 		console.log("built tx", txId);

// 		let signedTxn = appCreateTx.signTxn(creatorAccount.sk);
// 		console.log("Signed transaction with txID: %s", txId);

// 		await qv.sendSignedTx(signedTxn)
// 		console.log("SENT")

// 		await qv.waitForConfirmation(txId);
// 		const appID = await qv.getAppId()
// 		console.log(appID)

			
// 		// evaluate the addOptionTx generator functions, sign and send 
// 		const addOptionTxs = addOptionFns.map(f => f(appID))   
// 		const signedAddOtionTxs = addOptionTxs.map(tx => tx.signTxn(creatorAccount.sk))
// 		const addOptiontxIDs = addOptionTxs.map(tx => tx.txID().toString()); 

// 		console.log("sign and send all the add options") 
// 		signedAddOtionTxs.map(tx => qv.sendSignedTx(tx))
// 		addOptiontxIDs.map(txID => {qv.waitForConfirmation(txID)})


// 		// initilize and read the state
// 		await qv.initState(appID);
// 		const state = await qv.readGlobalState();
// 		console.log(state);

// 		// opt int with useAccount
// 		const optInTx = await qv.buildOptInTx(userAccount.addr)
// 		const optInSigned = optInTx.signTxn(userAccount.sk)
// 		await qv.sendSignedTx(optInSigned) 
// 		const optInTxID = optInTx.txID().toString();
// 		await qv.waitForConfirmation(optInTxID);
	
// 		// did opt-in work? 
// 		const localStorage = await qv.getUserBalance(userAccount.addr);
// 		console.log('STORAGE')
// 		console.log(localStorage)


// 	} catch (e) {
// 		console.log(e)
// 	}

// }

// /*
//  * Build object, init from existing appID state, use object 
//  */
// export async function existingInstance(){
// 	try {
// 		const conf = {token: token, baseServer: baseServer, port: port}
// 		const qv = new QVoting(creatorAccount.addr, 10, conf)
// 		// const appID = 15464120;  // long registration time app 
// 		const appID = 15510883   // long voting time app 

// 		await qv.initState(appID)
// 		console.log('created') 

// 		var state = await qv.readGlobalState();
// 		console.log('STATE', state)

// 		var userBalance = await qv.getUserBalance(userAccount.addr);
// 		console.log('userBalance')
// 		console.log(userBalance)

// 		const options = [
// 			{optionTitle: 'second', creditNumber: 9}
// 		]

// 		const voteTxs = await qv.buildVoteTxs(userAccount.addr, options);
// 		const signedVoteTxs = voteTxs.map(tx => tx.signTxn(userAccount.sk))
// 		const voteTxIDs = voteTxs.map(tx => tx.txID().toString());

// 		await qv.sendSignedTx(signedVoteTxs[0])
// 		await qv.waitForConfirmation(voteTxIDs[0]) 

// 		// signedVoteTxs.map(tx => qv.sendSignedTx(tx))
// 		// voteTxIDs.map(txID => {qv.waitForConfirmation(txID)})
		
// 		console.log('signed and sent all vote txs') 

// 		state = await qv.readGlobalState(); // TODO this doesn't work
// 		state.options.map(o => console.log(o.value.toString()))
// 		console.log('STATE', state)

// 		userBalance = await qv.getUserBalance(userAccount.addr);
// 		console.log('userBalance')
// 		console.log(userBalance) 

// 	} catch (e) {
// 		console.log(e);
// 	}
// }


// // TODO 
// // --- QVoting
// // more test voting / cheating 
// // add option after deploy (only need to test, this should already work) 
// // convenience deploy as a single function 
// // --- queue 
// // --- algosigner 
// // --- webapp compatibility  

// (async () => {
// 	try {
// 		await deployNew(); 
// 		// await existingInstance();
// 	} catch (e) {
// 		console.log(e)
// 	}
// })(); 


